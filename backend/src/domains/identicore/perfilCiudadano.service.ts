import type { Pool } from 'pg';
import { z } from 'zod';
import { Argon2Service } from './argon2.service.js';
import { usernameSchema } from './registro.schemas.js';
import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from '../../shared/domain/errors/index.js';

export const actualizarPerfilSchema = z.object({
  username: usernameSchema.optional(),
  correo: z.string().trim().email().max(150).transform((value) => value.toLowerCase()).optional(),
  telefono: z.string().regex(/^9[0-9]{8}$/, 'Ingrese un celular de nueve dígitos que empiece en 9.').optional(),
  direccion: z.string().trim().min(5).max(250).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Indique al menos un dato para actualizar.');

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva: z.string().min(8).max(128),
  confirmarPassword: z.string().min(8),
}).strict().refine((data) => data.passwordNueva === data.confirmarPassword, {
  path: ['confirmarPassword'], message: 'Las contraseñas no coinciden.',
});

export type ActualizarPerfilInput = z.infer<typeof actualizarPerfilSchema>;

interface CuentaPerfil {
  id_persona: string;
  id_documento: string;
  usuario: string | null;
  correo: string;
  activo: boolean;
  tipo: 'NATURAL' | 'JURIDICA';
  es_ciudadano: boolean;
  password_hash?: string;
}

function errorUnicidad(error: unknown): 'username' | 'correo' | 'otro' | null {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== '23505') return null;
  const constraint = 'constraint' in error ? String(error.constraint) : '';
  if (constraint === 'cuenta_usuario_usuario_key') return 'username';
  if (constraint === 'cuenta_usuario_correo_key') return 'correo';
  return 'otro';
}

function lanzarConflicto(campo: 'username' | 'correo' | 'otro'): never {
  if (campo === 'username') throw new ConflictError({ code: 'USERNAME_ALREADY_EXISTS', message: 'Este nombre de usuario ya está en uso.' });
  if (campo === 'correo') throw new ConflictError({ code: 'EMAIL_ALREADY_EXISTS', message: 'Este correo ya está en uso.' });
  throw new ConflictError({ code: 'ACCOUNT_ALREADY_EXISTS', message: 'Ya existe una cuenta con estos datos.' });
}

export class PerfilCiudadanoService {
  constructor(private readonly pool: Pool) {}

  async actualizar(idUsuario: string, datos: ActualizarPerfilInput): Promise<void> {
    const client = await this.pool.connect();
    let abierta = false;
    try {
      await client.query('BEGIN');
      abierta = true;
      const cuenta = await client.query<CuentaPerfil>(`
        SELECT c.id_persona, c.usuario, c.correo, c.activo, p.id_documento, p.tipo,
               EXISTS (SELECT 1 FROM sigd_org.usuario_rol ur
                       JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
                      WHERE ur.id_usuario = c.id_usuario AND r.codigo = 'CIUDADANO' AND r.vigente = TRUE
                        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())) AS es_ciudadano
          FROM sigd_auth.cuenta_usuario c
          JOIN sigd_auth.persona p ON p.id_persona = c.id_persona
         WHERE c.id_usuario = $1::uuid
         FOR UPDATE OF c`, [idUsuario]);
      const actual = cuenta.rows[0];
      if (!actual?.activo) throw new UnauthorizedError({ detail: 'La cuenta no existe o está deshabilitada.' });
      if (!actual.es_ciudadano) throw new ForbiddenError({ detail: 'Este perfil es exclusivo de cuentas ciudadanas.' });

      if (datos.username !== undefined) {
        if (actual.usuario && actual.usuario !== actual.id_documento) {
          throw new ConflictError({ code: 'USERNAME_ALREADY_CONFIGURED', message: 'El nombre de usuario ya fue configurado.' });
        }
        if (datos.username === actual.id_documento) {
          throw new ValidationError({ invalidParams: [{ name: 'username', reason: 'Elija un nombre de usuario distinto de su documento.' }] });
        }
        const duplicado = await client.query(
          `SELECT 1 FROM sigd_auth.cuenta_usuario WHERE lower(usuario) = lower($1) AND id_usuario <> $2::uuid LIMIT 1`,
          [datos.username, idUsuario],
        );
        if ((duplicado.rowCount ?? 0) > 0) lanzarConflicto('username');
        await client.query(`UPDATE sigd_auth.cuenta_usuario SET usuario = $1 WHERE id_usuario = $2::uuid`,
          [datos.username, idUsuario]);
      }

      if (datos.correo !== undefined) {
        const duplicado = await client.query(
          `SELECT 1 FROM sigd_auth.cuenta_usuario WHERE lower(correo) = lower($1) AND id_usuario <> $2::uuid LIMIT 1`,
          [datos.correo, idUsuario],
        );
        if ((duplicado.rowCount ?? 0) > 0) lanzarConflicto('correo');
        await client.query(`UPDATE sigd_auth.cuenta_usuario SET correo = $1 WHERE id_usuario = $2::uuid`,
          [datos.correo, idUsuario]);
        if (actual.tipo === 'NATURAL') {
          await client.query(`UPDATE sigd_auth.persona_natural SET correo = $1 WHERE id_persona = $2::uuid`,
            [datos.correo, actual.id_persona]);
        }
      }

      if (datos.telefono !== undefined) {
        if (actual.tipo === 'NATURAL') {
          await client.query(`UPDATE sigd_auth.persona_natural SET telefono = $1 WHERE id_persona = $2::uuid`,
            [datos.telefono, actual.id_persona]);
        } else {
          await client.query(`INSERT INTO sigd_auth.perfil_usuario (id_usuario, telefono)
                              VALUES ($1::uuid, $2)
                              ON CONFLICT (id_usuario) DO UPDATE SET telefono = EXCLUDED.telefono, actualizado_en = now()`,
            [idUsuario, datos.telefono]);
        }
      }

      if (datos.direccion !== undefined) {
        await client.query(`UPDATE sigd_auth.persona SET direccion = $1 WHERE id_persona = $2::uuid`,
          [datos.direccion, actual.id_persona]);
        if (actual.tipo === 'JURIDICA') {
          await client.query(`UPDATE sigd_auth.persona_juridica SET direccion = $1 WHERE id_persona = $2::uuid`,
            [datos.direccion, actual.id_persona]);
        }
      }

      await client.query('COMMIT');
      abierta = false;
    } catch (error) {
      if (abierta) await client.query('ROLLBACK');
      const campo = errorUnicidad(error);
      if (campo) lanzarConflicto(campo);
      throw error;
    } finally {
      client.release();
    }
  }

  async cambiarPassword(idUsuario: string, datos: z.infer<typeof cambiarPasswordSchema>): Promise<void> {
    const client = await this.pool.connect();
    let abierta = false;
    try {
      await client.query('BEGIN');
      abierta = true;
      const cuenta = await client.query<CuentaPerfil>(`
        SELECT c.password_hash, c.activo,
               EXISTS (SELECT 1 FROM sigd_org.usuario_rol ur
                       JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
                      WHERE ur.id_usuario = c.id_usuario AND r.codigo = 'CIUDADANO' AND r.vigente = TRUE
                        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())) AS es_ciudadano
          FROM sigd_auth.cuenta_usuario c
         WHERE c.id_usuario = $1::uuid FOR UPDATE OF c`, [idUsuario]);
      const actual = cuenta.rows[0];
      if (!actual?.activo) throw new UnauthorizedError({ detail: 'La cuenta no existe o está deshabilitada.' });
      if (!actual.es_ciudadano) throw new ForbiddenError({ detail: 'Este perfil es exclusivo de cuentas ciudadanas.' });
      if (!actual.password_hash || !(await Argon2Service.verify(actual.password_hash, datos.passwordActual))) {
        throw new ValidationError({ invalidParams: [{ name: 'passwordActual', reason: 'La contraseña actual es incorrecta.' }] });
      }
      if (datos.passwordActual === datos.passwordNueva) {
        throw new ValidationError({ invalidParams: [{ name: 'passwordNueva', reason: 'Elija una contraseña distinta de la actual.' }] });
      }
      const hash = await Argon2Service.hash(datos.passwordNueva);
      await client.query(`UPDATE sigd_auth.cuenta_usuario SET password_hash = $1 WHERE id_usuario = $2::uuid`, [hash, idUsuario]);
      await client.query(`UPDATE sigd_auth.sesion_usuario SET revocado_en = now()
                           WHERE id_usuario = $1::uuid AND revocado_en IS NULL`, [idUsuario]);
      await client.query('COMMIT');
      abierta = false;
    } catch (error) {
      if (abierta) await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
