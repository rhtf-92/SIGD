import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
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

async function obtenerCuentaActiva(pool: Pool, idUsuario: string): Promise<CuentaAuth | undefined> {
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
  pool: Pool,
  req: Request,
  cuenta: CuentaAuth,
  perfiles: PerfilRolActivo[],
  rolActivo: string,
) {
  const perfil = perfiles.find((item) => item.rol === rolActivo);
  if (!perfil) {
    throw new ForbiddenError({ detail: 'El perfil solicitado no está asignado o ya no se encuentra vigente.' });
  }
  const rolesAutorizados = perfiles.map((item) => item.rol);
  const accessToken = firmarTokenAcceso({ sub: cuenta.id_usuario, rolActivo, rolesAutorizados, expiraSegundos: 900 });
  const refreshToken = firmarTokenRefresco({ sub: cuenta.id_usuario, rolActivo, rolesAutorizados });
  const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, ip_origen, user_agent, expira_en)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (refresh_token) DO NOTHING`,
    [cuenta.id_usuario, refreshToken, req.ip ?? null, req.get('user-agent') ?? null, expiraEn],
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
    const { rows } = await pool.query<CuentaAuth>(
      `SELECT c.id_usuario, c.id_persona, c.usuario, c.correo, c.password_hash, c.activo, c.bloqueado_hasta,
              COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
              p.area_id
         FROM sigd_auth.cuenta_usuario c
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
         LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
        WHERE c.usuario = $1 OR c.correo = $1
        LIMIT 1`,
      [datos.identificador],
    );
    const cuenta = rows[0];
    if (!cuenta?.password_hash || !(await Argon2Service.verify(cuenta.password_hash, datos.password))) {
      throw new UnauthorizedError({ detail: 'Credenciales inválidas. Verifique su usuario o contraseña institucional.' });
    }
    asegurarCuentaHabilitada(cuenta);

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
      return res.status(200).json(await emitirSesion(pool, req, cuenta, perfiles, perfiles[0].rol));
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
    res.status(200).json(await emitirSesion(pool, req, cuenta, perfiles, datos.rol));
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
          WHERE refresh_token = $1 AND id_usuario = $2 AND revocado_en IS NULL`,
        [datos.refreshToken, cuenta.id_usuario],
      );
    }
    res.status(200).json(await emitirSesion(pool, req, cuenta, perfiles, datos.rol));
  });

  router.post('/auth/logout', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await pool.query(
      `UPDATE sigd_auth.sesion_usuario SET revocado_en = now()
        WHERE refresh_token = $1 AND revocado_en IS NULL`,
      [refreshToken],
    );
    res.status(200).json({ ok: true, mensaje: 'Sesión cerrada correctamente' });
  });

  router.post('/auth/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const claims = verificarTokenRefresco(refreshToken);
    const { rows } = await pool.query<{ id_usuario: string; expira_en: string; revocado_en: string | null; activo: boolean }>(
      `SELECT s.id_usuario, s.expira_en, s.revocado_en, c.activo
         FROM sigd_auth.sesion_usuario s
         JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = s.id_usuario
        WHERE s.refresh_token = $1
        LIMIT 1`,
      [refreshToken],
    );
    const sesion = rows[0];
    if (!sesion || sesion.id_usuario !== claims.sub || !sesion.activo || sesion.revocado_en !== null || new Date(sesion.expira_en) < new Date()) {
      throw new UnauthorizedError({ detail: 'El token de refresco es inválido o ha expirado.' });
    }
    const cuenta = await obtenerCuentaActiva(pool, claims.sub);
    if (!cuenta) throw new UnauthorizedError({ detail: 'La cuenta ya no está habilitada.' });
    asegurarCuentaHabilitada(cuenta);
    const perfiles = await obtenerPerfilesActivos(pool, claims.sub);
    if (!perfiles.some((perfil) => perfil.rol === claims.rolActivo)) {
      throw new UnauthorizedError({ detail: 'El perfil activo ya no está vigente.' });
    }
    await pool.query('UPDATE sigd_auth.sesion_usuario SET revocado_en = now() WHERE refresh_token = $1', [refreshToken]);
    res.status(200).json(await emitirSesion(pool, req, cuenta, perfiles, claims.rolActivo));
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
