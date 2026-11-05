import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  extraerTokenBearer,
  firmarTokenAcceso,
  firmarTokenRefresco,
  firmarTokenSeleccionPerfil,
  verificarTokenAcceso,
  verificarTokenRefresco,
  verificarTokenSeleccionPerfil,
} from '../../core/auth/jwt.service.js';
import { obtenerPerfilesActivos, type PerfilRolActivo } from '../../core/auth/roles-activos.js';
import { AppError, ForbiddenError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { Argon2Service } from './argon2.service.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';

const loginSchema = z.object({
  identificador: z.string().trim().min(3).max(100),
  password: z.string().min(6).max(128),
});
const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const seleccionPerfilSchema = z.object({
  selectionToken: z.string().min(20),
  rol: z.string().min(2).max(50),
});
const cambioPerfilSchema = z.object({
  rol: z.string().min(2).max(50),
  refreshToken: z.string().min(20).optional(),
});

// Persistir solo una huella del token evita guardar credenciales reutilizables
// y mantiene la columna VARCHAR(255) compatible con JWT de longitud variable.
function huellaRefreshToken(token: string): string {
  return `sha256:${createHash('sha256').update(token, 'utf8').digest('hex')}`;
}

interface CuentaAuth {
  id_usuario: string;
  id_persona: string | null;
  usuario: string;
  correo: string | null;
  password_hash?: string;
  activo: boolean;
  bloqueado_hasta: string | Date | null;
  nombre_completo: string;
  area_id: string | null;
  intentos_fallidos?: number;
}

interface PoliticaSeguridad { max_intentos_fallidos: number; minutos_bloqueo: number; minutos_sesion: number }
const POLITICA_SEGURIDAD_PREDETERMINADA: PoliticaSeguridad = { max_intentos_fallidos: 5, minutos_bloqueo: 30, minutos_sesion: 30 };

async function obtenerPoliticaSeguridad(pool: Pool | PoolClient): Promise<PoliticaSeguridad> {
  const { rows } = await pool.query<PoliticaSeguridad>(`SELECT max_intentos_fallidos, minutos_bloqueo, minutos_sesion
    FROM sigd_org.politicas_seguridad WHERE singleton=TRUE`);
  return rows[0] ?? POLITICA_SEGURIDAD_PREDETERMINADA;
}

async function registrarIntentoAcceso(
  pool: Pool, req: Request, cuenta: CuentaAuth | undefined, evento: 'CORRECTO' | 'FALLIDO' | 'BLOQUEADO',
  identificador: string, politica: PoliticaSeguridad,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let estadoCuenta: Record<string, unknown> | null = null;
    if (cuenta && evento === 'FALLIDO') {
      const { rows } = await client.query<Record<string, unknown>>(`UPDATE sigd_auth.cuenta_usuario
        SET intentos_fallidos = CASE WHEN bloqueado_hasta > now() THEN intentos_fallidos ELSE intentos_fallidos + 1 END,
            bloqueado_hasta = CASE WHEN bloqueado_hasta > now() THEN bloqueado_hasta
              WHEN intentos_fallidos + 1 >= $2 THEN now() + ($3 * interval '1 minute') ELSE NULL END
        WHERE id_usuario=$1 RETURNING intentos_fallidos, bloqueado_hasta`,
      [cuenta.id_usuario, politica.max_intentos_fallidos, politica.minutos_bloqueo]);
      estadoCuenta = rows[0] ?? null;
    } else if (cuenta && evento === 'CORRECTO') {
      await client.query(`UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos=0
        WHERE id_usuario=$1 AND intentos_fallidos<>0`, [cuenta.id_usuario]);
    }
    const contexto = getRequestContext();
    await client.query(`INSERT INTO sigd_audit.bitacora_auditoria
      (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_despues)
      VALUES ($1,$2,$3,$4,'sigd_auth','intento_acceso','INSERT',$5::jsonb)`, [
      contexto?.correlation_id ?? randomUUID(), cuenta?.id_usuario ?? null, req.ip ?? null,
      req.get('user-agent') ?? null,
      JSON.stringify({ evento, identificador: cuenta?.usuario ?? identificador, intentos_fallidos: estadoCuenta?.intentos_fallidos ?? 0,
        bloqueado_hasta: estadoCuenta?.bloqueado_hasta ?? null }),
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

function cuentaBloqueada(valor: unknown): boolean {
  if (valor === 'infinity' || valor === Number.POSITIVE_INFINITY) return true;
  if (!valor) return false;
  const instante = new Date(valor as string | number | Date).getTime();
  return Number.isFinite(instante) && instante > Date.now();
}

function asegurarCuentaHabilitada(cuenta: CuentaAuth): void {
  if (!cuenta.activo) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_DISABLED',
      message: 'Cuenta deshabilitada.',
      detail: 'Su cuenta institucional se encuentra suspendida o deshabilitada.',
    });
  }
  if (cuentaBloqueada(cuenta.bloqueado_hasta)) {
    throw new AppError({
      status: 423,
      code: 'ACCOUNT_LOCKED',
      message: 'Cuenta bloqueada.',
      detail: 'Su cuenta institucional se encuentra bloqueada. Contacte al administrador.',
    });
  }
}

async function obtenerCuentaActiva(pool: Pool | PoolClient, idUsuario: string): Promise<CuentaAuth | undefined> {
  const { rows } = await pool.query<CuentaAuth>(
    `SELECT c.id_usuario, c.id_persona, c.usuario, c.correo, c.activo, c.bloqueado_hasta,
            COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
            p.area_id
       FROM sigd_auth.cuenta_usuario c
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
       LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
       LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
      WHERE c.id_usuario = $1`,
    [idUsuario],
  );
  return rows[0];
}

function perfilPublico(cuenta: CuentaAuth, perfil: PerfilRolActivo, rolesAutorizados: string[]) {
  return {
    id: cuenta.id_usuario,
    idPersona: cuenta.id_persona,
    nombreCompleto: cuenta.nombre_completo,
    correo: cuenta.correo ?? `${cuenta.usuario}@iestp-suiza.edu.pe`,
    rol: perfil.rol,
    rolesAutorizados,
    permisos: perfil.permisos,
    areaId: cuenta.area_id ?? undefined,
  };
}

async function emitirSesion(
  pool: Pool | PoolClient,
  req: Request,
  cuenta: CuentaAuth,
  perfiles: PerfilRolActivo[],
  rolActivo: string,
  minutosSesion = POLITICA_SEGURIDAD_PREDETERMINADA.minutos_sesion,
) {
  const perfil = perfiles.find((item) => item.rol === rolActivo);
  if (!perfil) {
    throw new ForbiddenError({ detail: 'El perfil solicitado no está asignado o ya no se encuentra vigente.' });
  }
  const rolesAutorizados = perfiles.map((item) => item.rol);
  const expiraSegundos = minutosSesion * 60;
  const refreshToken = firmarTokenRefresco({ sub: cuenta.id_usuario, rolActivo, rolesAutorizados, expiraSegundos });
  const huellaSesion = huellaRefreshToken(refreshToken);
  const accessToken = firmarTokenAcceso({ sub: cuenta.id_usuario, sid: huellaSesion, rolActivo, rolesAutorizados, expiraSegundos });
  const expiraEn = new Date(Date.now() + expiraSegundos * 1000);
  await pool.query(
    `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, ip_origen, user_agent, expira_en)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (refresh_token) DO NOTHING`,
    [cuenta.id_usuario, huellaSesion, req.ip ?? null, req.get('user-agent') ?? null, expiraEn],
  );
  return {
    requiresRoleSelection: false,
    accessToken,
    refreshToken,
    usuario: perfilPublico(cuenta, perfil, rolesAutorizados),
  };
}

function exigirPerfiles(perfiles: PerfilRolActivo[]): void {
  if (perfiles.length === 0) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_WITHOUT_ACTIVE_ROLES',
      message: 'Sin perfiles institucionales activos.',
      detail: 'Su cuenta no tiene perfiles de trabajo vigentes. Contacte a administración.',
    });
  }
}

export function crearRouterAuth(pool: Pool): Router {
  const router = Router();

  router.post('/auth/login', async (req: Request, res: Response) => {
    const datos = loginSchema.parse(req.body);
    const politica = await obtenerPoliticaSeguridad(pool);
    const { rows } = await pool.query<CuentaAuth>(
      `SELECT c.id_usuario, c.id_persona, c.usuario, c.correo, c.password_hash, c.activo, c.bloqueado_hasta,
              COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
              p.area_id
         FROM sigd_auth.cuenta_usuario c
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
         LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
        WHERE c.usuario = $1 OR lower(c.correo) = lower($1)
        ORDER BY (lower(c.correo) = lower($1)) DESC
        LIMIT 1`,
      [datos.identificador],
    );
    const cuenta = rows[0];
    if (!cuenta?.password_hash || !(await Argon2Service.verify(cuenta.password_hash, datos.password))) {
      await registrarIntentoAcceso(pool, req, cuenta, 'FALLIDO', datos.identificador, politica);
      throw new UnauthorizedError({ detail: 'Credenciales inválidas. Verifique su usuario o contraseña institucional.' });
    }
    try { asegurarCuentaHabilitada(cuenta); }
    catch (error) {
      await registrarIntentoAcceso(pool, req, cuenta, 'BLOQUEADO', datos.identificador, politica);
      throw error;
    }
    await registrarIntentoAcceso(pool, req, cuenta, 'CORRECTO', datos.identificador, politica);

    const perfiles = await obtenerPerfilesActivos(pool, cuenta.id_usuario);
    exigirPerfiles(perfiles);
    if (perfiles.length > 1) {
      const rolesDisponibles = perfiles.map((perfil) => perfil.rol);
      return res.status(200).json({
        requiresRoleSelection: true,
        selectionToken: firmarTokenSeleccionPerfil({ sub: cuenta.id_usuario, rolesAutorizados: rolesDisponibles }),
        rolesDisponibles,
        usuario: {
          id: cuenta.id_usuario,
          idPersona: cuenta.id_persona,
          nombreCompleto: cuenta.nombre_completo,
          correo: cuenta.correo ?? `${cuenta.usuario}@iestp-suiza.edu.pe`,
        },
      });
    }

    try {
      return res.status(200).json(await emitirSesion(pool, req, cuenta, perfiles, perfiles[0].rol, politica.minutos_sesion));
    } catch (error) {
      console.error('[AUTH] Error al persistir sesión de usuario en sigd_auth.sesion_usuario:', error);
      throw error;
    }
  });

  router.post('/auth/select-role', async (req: Request, res: Response) => {
    const datos = seleccionPerfilSchema.parse(req.body);
    const claims = verificarTokenSeleccionPerfil(datos.selectionToken);
    const cuenta = await obtenerCuentaActiva(pool, claims.sub);
    if (!cuenta) throw new UnauthorizedError({ detail: 'La cuenta ya no está habilitada.' });
    asegurarCuentaHabilitada(cuenta);
    const perfiles = await obtenerPerfilesActivos(pool, cuenta.id_usuario);
    if (!claims.rolesAutorizados.includes(datos.rol) || !perfiles.some((perfil) => perfil.rol === datos.rol)) {
      throw new ForbiddenError({ detail: 'El perfil solicitado no está asignado o ya no se encuentra vigente.' });
    }
    const politica = await obtenerPoliticaSeguridad(pool);
    res.status(200).json(await emitirSesion(pool, req, cuenta, perfiles, datos.rol, politica.minutos_sesion));
  });

  router.post('/auth/switch-role', async (req: Request, res: Response) => {
    const datos = cambioPerfilSchema.parse(req.body);
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    const claims = verificarTokenAcceso(token);
    const cuenta = await obtenerCuentaActiva(pool, claims.sub);
    if (!cuenta) throw new UnauthorizedError({ detail: 'La cuenta ya no está habilitada.' });
    asegurarCuentaHabilitada(cuenta);
    const perfiles = await obtenerPerfilesActivos(pool, cuenta.id_usuario);
    if (!perfiles.some((perfil) => perfil.rol === datos.rol)) {
      throw new ForbiddenError({ detail: 'El perfil solicitado no está asignado o ya no se encuentra vigente.' });
    }
    if (datos.refreshToken) {
      await pool.query(
        `UPDATE sigd_auth.sesion_usuario SET revocado_en = now()
          WHERE refresh_token IN ($1, $2) AND id_usuario = $3 AND revocado_en IS NULL`,
        [huellaRefreshToken(datos.refreshToken), datos.refreshToken, cuenta.id_usuario],
      );
    }
    const politica = await obtenerPoliticaSeguridad(pool);
    res.status(200).json(await emitirSesion(pool, req, cuenta, perfiles, datos.rol, politica.minutos_sesion));
  });

  router.post('/auth/logout', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await pool.query(
      `UPDATE sigd_auth.sesion_usuario SET revocado_en = now()
        WHERE refresh_token IN ($1, $2) AND revocado_en IS NULL`,
      [huellaRefreshToken(refreshToken), refreshToken],
    );
    res.status(200).json({ ok: true, mensaje: 'Sesión cerrada correctamente' });
  });

  router.post('/auth/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const claims = verificarTokenRefresco(refreshToken);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{
        id_usuario: string;
        expira_en: string;
        revocado_en: string | null;
        activo: boolean;
      }>(
        `SELECT s.id_usuario, s.expira_en, s.revocado_en, c.activo
           FROM sigd_auth.sesion_usuario s
           JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = s.id_usuario
          WHERE s.refresh_token IN ($1, $2)
          LIMIT 1
          FOR UPDATE OF s`,
        [huellaRefreshToken(refreshToken), refreshToken],
      );
      const sesion = rows[0];
      if (!sesion || sesion.id_usuario !== claims.sub || !sesion.activo || sesion.revocado_en !== null || new Date(sesion.expira_en) <= new Date()) {
        throw new UnauthorizedError({ detail: 'El token de refresco es inválido o ha expirado.' });
      }
      const cuenta = await obtenerCuentaActiva(client, claims.sub);
      if (!cuenta) throw new UnauthorizedError({ detail: 'La cuenta ya no está habilitada.' });
      asegurarCuentaHabilitada(cuenta);
      const perfiles = await obtenerPerfilesActivos(client, claims.sub);
      if (!perfiles.some((perfil) => perfil.rol === claims.rolActivo)) {
        throw new UnauthorizedError({ detail: 'El perfil activo ya no está vigente.' });
      }
      const consumo = await client.query(
        `UPDATE sigd_auth.sesion_usuario SET revocado_en = now()
          WHERE refresh_token IN ($1, $2) AND revocado_en IS NULL AND expira_en > now()
          RETURNING id_usuario`, [huellaRefreshToken(refreshToken), refreshToken],
      );
      if (consumo.rowCount !== 1) {
        throw new UnauthorizedError({ detail: 'El token de refresco ya fue utilizado o revocado.' });
      }
      const politica = await obtenerPoliticaSeguridad(client);
      const respuesta = await emitirSesion(client, req, cuenta, perfiles, claims.rolActivo, politica.minutos_sesion);
      await client.query('COMMIT');
      res.status(200).json(respuesta);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });

  const handlerPerfil = async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    const claims = verificarTokenAcceso(token);
    const cuenta = await obtenerCuentaActiva(pool, claims.sub);
    if (!cuenta) throw new UnauthorizedError({ detail: 'Usuario no encontrado o sesión caducada.' });
    asegurarCuentaHabilitada(cuenta);
    const perfiles = await obtenerPerfilesActivos(pool, claims.sub);
    const perfil = perfiles.find((item) => item.rol === claims.rolActivo);
    if (!perfil) throw new UnauthorizedError({ detail: 'El perfil activo ya no está vigente.' });
    res.status(200).json({
      ...perfilPublico(cuenta, perfil, perfiles.map((item) => item.rol)),
      usuario: cuenta.usuario,
      username: cuenta.usuario,
    });
  };

  router.get('/auth/me', handlerPerfil);
  router.get('/auth/perfil', handlerPerfil);
  return router;
}

export default crearRouterAuth;
