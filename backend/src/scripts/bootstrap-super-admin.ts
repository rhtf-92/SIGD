import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { crearPool } from '../database.js';

export interface BootstrapOptions {
  actorId?: string;
  targetUserId: string;
  motivoJustificacion: string;
  ipOrigen?: string;
  userAgent?: string;
  breakGlass?: boolean;
  breakGlassKey?: string;
}

export interface RevokeOptions {
  actorId: string;
  targetUserId: string;
  motivoJustificacion: string;
  ipOrigen?: string;
  userAgent?: string;
}

export interface SuperAdminStatus {
  idUsuario: string;
  usuario: string;
  correo: string;
  rolPlataforma: string;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
  esSuperAdminEfectivo: boolean;
}

export interface OperacionResult {
  exito: boolean;
  correlationId: string;
  operacion: string;
  targetUserId: string;
  actorId: string;
  mensaje: string;
}

const MotivoSchema = z
  .string()
  .min(15, 'El motivo de justificación debe contener al menos 15 caracteres para auditoría WORM.');
const UuidSchema = z.string().uuid('El identificador debe ser un UUID válido.');

/**
 * Obtiene el conteo de super administradores actualmente vigentes.
 */
export async function contarSuperAdminsVigentes(clientOrPool: Pool | PoolClient): Promise<number> {
  const res = await clientOrPool.query<{ total: string }>(`
    SELECT count(*)::text AS total
      FROM sigd_auth.usuario_rol_plataforma urp
      JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = urp.id_usuario
     WHERE urp.rol_plataforma = 'SUPER_ADMIN'
       AND cu.activo = TRUE
       AND urp.vigente_desde <= clock_timestamp()
       AND (urp.vigente_hasta IS NULL OR urp.vigente_hasta > clock_timestamp())
  `);
  return parseInt(res.rows[0]?.total ?? '0', 10);
}

/**
 * Verifica si un usuario es super admin activo.
 */
export async function esSuperAdminActivo(clientOrPool: Pool | PoolClient, idUsuario: string): Promise<boolean> {
  const res = await clientOrPool.query<{ es_super_admin: boolean }>(
    'SELECT sigd_auth.fn_es_super_admin($1::uuid) AS es_super_admin',
    [idUsuario],
  );
  return Boolean(res.rows[0]?.es_super_admin);
}

/**
 * Lista todos los registros de asignación de roles de plataforma.
 */
export async function listarSuperAdmins(clientOrPool: Pool | PoolClient): Promise<SuperAdminStatus[]> {
  const res = await clientOrPool.query<{
    id_usuario: string;
    usuario: string;
    correo: string;
    rol_plataforma: string;
    vigente_desde: Date;
    vigente_hasta: Date | null;
    es_super_admin_efectivo: boolean;
  }>(`
    SELECT urp.id_usuario,
           cu.usuario,
           cu.correo,
           urp.rol_plataforma,
           urp.vigente_desde,
           urp.vigente_hasta,
           sigd_auth.fn_es_super_admin(urp.id_usuario) AS es_super_admin_efectivo
      FROM sigd_auth.usuario_rol_plataforma urp
      JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = urp.id_usuario
     ORDER BY urp.vigente_desde DESC
  `);

  return res.rows.map(r => ({
    idUsuario: r.id_usuario,
    usuario: r.usuario,
    correo: r.correo,
    rolPlataforma: r.rol_plataforma,
    vigenteDesde: r.vigente_desde,
    vigenteHasta: r.vigente_hasta,
    esSuperAdminEfectivo: r.es_super_admin_efectivo,
  }));
}

/**
 * Asigna el rol SUPER_ADMIN de forma canónica y auditada con estricto WORM.
 *
 * Controles de seguridad exigidos:
 * 1. Validación de formato UUID y justificación mínima (>= 15 caracteres).
 * 2. Autenticación del actor solicitante (debe ser SUPER_ADMIN activo salvo break-glass).
 * 3. Control anti-autoconcesión (actorId !== targetUserId, prohibición estricta de auto-atribución).
 * 4. Break-glass recovery ante desastre o bootstrap inicial (0 super admins activos o clave maestra).
 * 5. Registro WORM obligatorio en sigd_audit.auditoria_plataforma_log.
 */
export async function bootstrapSuperAdmin(
  pool: Pool,
  options: BootstrapOptions,
): Promise<OperacionResult> {
  UuidSchema.parse(options.targetUserId);
  MotivoSchema.parse(options.motivoJustificacion);

  // Validación previa de clave maestra en TypeScript si está configurada en entorno
  const masterKeyEsperada = process.env.SIGD_BREAK_GLASS_KEY;
  if (options.breakGlass && masterKeyEsperada && options.breakGlassKey !== masterKeyEsperada) {
    throw new Error('BOOTSTRAP_REJECTED: Clave maestra de break-glass inválida o no provista.');
  }

  const client = await pool.connect();
  try {
    const res = await client.query<{ fn_asignar_rol_plataforma: string }>(
      `SELECT sigd_auth.fn_asignar_rol_plataforma(
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7::inet, $8
       ) AS fn_asignar_rol_plataforma`,
      [
        options.actorId ?? null,
        options.targetUserId,
        'SUPER_ADMIN',
        options.motivoJustificacion.trim(),
        Boolean(options.breakGlass),
        options.breakGlassKey ?? null,
        options.ipOrigen ?? null,
        options.userAgent ?? 'SIGD-Bootstrap-SuperAdmin/CLI',
      ],
    );

    const correlationId = res.rows[0].fn_asignar_rol_plataforma;

    return {
      exito: true,
      correlationId,
      operacion: options.breakGlass ? 'BOOTSTRAP_BREAK_GLASS_SUPER_ADMIN' : 'ASIGNACION_SUPER_ADMIN',
      targetUserId: options.targetUserId,
      actorId: options.actorId ?? options.targetUserId,
      mensaje: `Rol SUPER_ADMIN asignado exitosamente al usuario ${options.targetUserId} mediante función SECURITY DEFINER. Auditoría WORM registrada con correlationId ${correlationId}.`,
    };
  } catch (error: any) {
    throw new Error(`BOOTSTRAP_ERROR: ${error.message || error}`);
  } finally {
    client.release();
  }
}

/**
 * Revoca el rol SUPER_ADMIN de forma canónica y auditada con estricto WORM.
 *
 * Invoca la función rectora sigd_auth.fn_revocar_rol_plataforma (SECURITY DEFINER)
 * garantizando la prohibición de auto-revocación y el registro WORM atómico.
 */
export async function revokeSuperAdmin(
  pool: Pool,
  options: RevokeOptions,
): Promise<OperacionResult> {
  UuidSchema.parse(options.targetUserId);
  UuidSchema.parse(options.actorId);
  MotivoSchema.parse(options.motivoJustificacion);

  // Anti-autoliquidación check en aplicación
  if (options.actorId === options.targetUserId) {
    throw new Error(
      'ANTI_SELF_REVOCATION_VIOLATION: Un SUPER_ADMIN no puede auto-revocar su propio rol unilateralmente para prevenir orfandad de plataforma.',
    );
  }

  const client = await pool.connect();
  try {
    const res = await client.query<{ fn_revocar_rol_plataforma: string }>(
      `SELECT sigd_auth.fn_revocar_rol_plataforma(
         $1::uuid, $2::uuid, $3, $4, $5::inet, $6
       ) AS fn_revocar_rol_plataforma`,
      [
        options.actorId,
        options.targetUserId,
        'SUPER_ADMIN',
        options.motivoJustificacion.trim(),
        options.ipOrigen ?? null,
        options.userAgent ?? 'SIGD-Bootstrap-SuperAdmin/CLI',
      ],
    );

    const correlationId = res.rows[0].fn_revocar_rol_plataforma;

    return {
      exito: true,
      correlationId,
      operacion: 'REVOCACION_SUPER_ADMIN',
      targetUserId: options.targetUserId,
      actorId: options.actorId,
      mensaje: `Rol SUPER_ADMIN revocado exitosamente del usuario ${options.targetUserId} mediante función SECURITY DEFINER. Auditoría WORM registrada con correlationId ${correlationId}.`,
    };
  } catch (error: any) {
    throw new Error(`REVOKE_ERROR: ${error.message || error}`);
  } finally {
    client.release();
  }
}

/**
 * Runner de Línea de Comandos (CLI).
 */
async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return undefined;
  };
  const hasFlag = (name: string): boolean => args.includes(`--${name}`);

  const action = getArg('action') ?? process.env.ACTION ?? 'status';
  const customDbUrl = getArg('db-url');
  const useIsolated = hasFlag('isolated') || process.env.SIGD_ALLOW_TEST_DB === 'true';

  const databaseUrl =
    customDbUrl ??
    (useIsolated
      ? 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_isolated_cert_m2'
      : (process.env.DATABASE_URL ?? 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo'));

  const pool = crearPool(databaseUrl);

  try {
    console.log(`[BOOTSTRAP-SUPER-ADMIN] Conectado a base de datos. Acción: "${action}"`);

    if (action === 'status') {
      const lista = await listarSuperAdmins(pool);
      console.log(`Total usuarios registrados con rol de plataforma: ${lista.length}`);
      console.table(lista);
      return;
    }

    const targetUserId = getArg('target-user') ?? process.env.TARGET_USER_ID;
    const actorId = getArg('actor-id') ?? process.env.ACTOR_ID;
    const motivo = getArg('motivo') ?? process.env.MOTIVO_JUSTIFICACION;
    const breakGlass = hasFlag('break-glass') || process.env.BREAK_GLASS === 'true';
    const breakGlassKey = getArg('break-glass-key') ?? process.env.SIGD_BREAK_GLASS_KEY;

    if (!targetUserId) {
      throw new Error('Falta el argumento obligatorio --target-user <uuid>.');
    }

    if (action === 'assign' || action === 'break-glass') {
      if (!motivo) {
        throw new Error('Falta el argumento obligatorio --motivo <texto_justificacion_min_15_chars>.');
      }
      const res = await bootstrapSuperAdmin(pool, {
        actorId,
        targetUserId,
        motivoJustificacion: motivo,
        breakGlass: action === 'break-glass' || breakGlass,
        breakGlassKey,
      });
      console.log('[OK]', res.mensaje);
      console.log(`Correlation ID: ${res.correlationId}`);
      return;
    }

    if (action === 'revoke') {
      if (!actorId) {
        throw new Error('Falta el argumento obligatorio --actor-id <uuid>.');
      }
      if (!motivo) {
        throw new Error('Falta el argumento obligatorio --motivo <texto_justificacion_min_15_chars>.');
      }
      const res = await revokeSuperAdmin(pool, {
        actorId,
        targetUserId,
        motivoJustificacion: motivo,
      });
      console.log('[OK]', res.mensaje);
      console.log(`Correlation ID: ${res.correlationId}`);
      return;
    }

    throw new Error(`Acción desconocida: "${action}". Opciones válidas: status, assign, revoke, break-glass.`);
  } finally {
    await pool.end();
  }
}

// Ejecutar si es el módulo principal
const isDirectRun = Boolean(
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
);

if (isDirectRun) {
  runCli().catch((err) => {
    console.error('[BOOTSTRAP-SUPER-ADMIN ERROR]:', err.message || err);
    process.exit(1);
  });
}
