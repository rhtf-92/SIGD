/**
 * Endpoints #1, #2, #3, #4 del catálogo REST — Autenticación Centralizada y Perfil
 * Responsables: B_SEGUNDO (Segundo), B_TAPULLIMA (Tania), B_JAIR (Jair)
 * Subdominio: IdentiCore / Auth (sigd_auth)
 *
 *   #1  POST /api/v1/auth/login    — Autenticación con verificación de hash y emisión de JWT dual
 *   #2  POST /api/v1/auth/logout   — Cierre de sesión y revocación de refresh token
 *   #3  POST /api/v1/auth/refresh  — Rotación de tokens con validación de vigencia
 *   #4  GET  /api/v1/auth/me       — Perfil y facultades institucionales del usuario autenticado
 *       GET  /api/v1/auth/perfil   — Alias de compatibilidad frontend
 *
 * ALINEACIÓN DDL POSTGRESQL 18:
 * - sigd_auth.cuenta_usuario: usuario, correo (no username ni correo_institucional; sin bloqueado_hasta).
 * - sigd_auth.persona_natural: nombre_completo (no apellido_paterno / apellido_materno).
 * - sigd_org.usuario_rol: rol_id, (vigente_hasta IS NULL OR vigente_hasta > now()) (no id_rol ni estado).
 * - sigd_org.rol_sistema: rol_id (no id_rol).
 * - sigd_auth.sesion_usuario: propagación y log de errores sin .catch(() => null).
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { firmarTokenAcceso, extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { AppError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { Argon2Service } from './argon2.service.js';

const loginSchema = z.object({
  identificador: z.string().min(3).max(100),
  password: z.string().min(6).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

async function verificarHashPassword(passwordPlana: string, hashAlmacenado: string): Promise<boolean> {
  return Argon2Service.verify(hashAlmacenado, passwordPlana);
}

export function crearRouterAuth(pool: Pool): Router {
  const router = Router();

  // #1 — POST /auth/login
  router.post('/auth/login', async (req: Request, res: Response) => {
    const datos = loginSchema.parse(req.body);

    const query = `
      SELECT c.id_usuario, c.id_persona, c.usuario, c.correo,
             c.password_hash, c.activo,
             COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
             COALESCE(r.codigo, 'CIUDADANO') AS rol_codigo,
             p.area_id
        FROM sigd_auth.cuenta_usuario c
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
        LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
       WHERE (c.usuario = $1 OR c.correo = $1)
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [datos.identificador.trim()]);
    const usuario = resultado.rows[0];

    if (!usuario) {
      throw new UnauthorizedError({
        detail: 'Credenciales inválidas. Verifique su usuario o contraseña institucional.',
      });
    }

    if (!usuario.activo) {
      throw new AppError({
        status: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'Cuenta deshabilitada.',
        detail: 'Su cuenta institucional se encuentra suspendida o deshabilitada.',
      });
    }

    const passwordValida = await verificarHashPassword(datos.password, usuario.password_hash);
    if (!passwordValida) {
      throw new UnauthorizedError({
        detail: 'Credenciales inválidas. Verifique su usuario o contraseña institucional.',
      });
    }

    const rol = usuario.rol_codigo ?? 'CIUDADANO';

    // Obtener todos los roles activos asignados al usuario (Soporte SuperAdmin / Multi-rol)
    let roles: string[] = [rol];
    try {
      const rolesQuery = await pool.query<{ codigo: string }>(
        `SELECT DISTINCT r.codigo
           FROM sigd_org.usuario_rol ur
           JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
          WHERE ur.id_usuario = $1
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
            AND r.vigente = TRUE`,
        [usuario.id_usuario],
      );
      if (rolesQuery.rows.length > 0) {
        roles = rolesQuery.rows.map((r) => r.codigo);
        if (rol && !roles.includes(rol)) roles.unshift(rol);
      }
    } catch {
      // Fallback a rol único
    }

    const rolPrincipal = roles.includes('ADMINISTRADOR')
      ? 'ADMINISTRADOR'
      : (roles[0] ?? rol);

    const accessToken = firmarTokenAcceso({
      sub: usuario.id_usuario,
      roles: roles,
      expiraSegundos: 3600, // 1 hora
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    // Registrar sesión en base de datos con propagación y registro explícito de errores
    try {
      await pool.query(
        `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, ip_origen, user_agent, expira_en)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (refresh_token) DO NOTHING;`,
        [usuario.id_usuario, refreshToken, req.ip ?? null, req.get('user-agent') ?? null, expiraEn],
      );
    } catch (error) {
      console.error('[AUTH] Error al persistir sesión de usuario en sigd_auth.sesion_usuario:', error);
      throw error;
    }

    res.status(200).json({
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id_usuario,
        nombreCompleto: usuario.nombre_completo,
        correo: usuario.correo ?? `${usuario.usuario}@iestp-suiza.edu.pe`,
        rol: rolPrincipal,
        roles: roles,
        areaId: usuario.area_id ?? undefined,
      },
    });
  });

  // #2 — POST /auth/logout
  router.post('/auth/logout', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);

    try {
      await pool.query(
        `UPDATE sigd_auth.sesion_usuario
            SET revocado_en = now()
          WHERE refresh_token = $1 AND revocado_en IS NULL;`,
        [refreshToken],
      );
    } catch (error) {
      console.error('[AUTH] Error al revocar sesión en sigd_auth.sesion_usuario:', error);
      throw error;
    }

    res.status(200).json({ ok: true, mensaje: 'Sesión cerrada correctamente' });
  });

  // #3 — POST /auth/refresh
  router.post('/auth/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);

    const query = `
      SELECT s.id_usuario, s.expira_en, s.revocado_en,
             COALESCE(r.codigo, 'CIUDADANO') AS rol_codigo
        FROM sigd_auth.sesion_usuario s
        LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = s.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
       WHERE s.refresh_token = $1
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [refreshToken]);
    const sesion = resultado.rows[0];

    if (!sesion || sesion.revocado_en !== null || new Date(sesion.expira_en) < new Date()) {
      throw new UnauthorizedError({
        detail: 'El token de refresco es inválido o ha expirado. Inicie sesión nuevamente.',
      });
    }

    const nuevoAccessToken = firmarTokenAcceso({
      sub: sesion.id_usuario,
      roles: [sesion.rol_codigo],
      expiraSegundos: 900,
    });

    const nuevoRefreshToken = crypto.randomBytes(32).toString('hex');
    const nuevaExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Rotación atómica de refresh token
    await pool.query(
      `UPDATE sigd_auth.sesion_usuario
          SET revocado_en = now()
        WHERE refresh_token = $1;`,
      [refreshToken],
    );

    await pool.query(
      `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, ip_origen, user_agent, expira_en)
       VALUES ($1, $2, $3, $4, $5);`,
      [sesion.id_usuario, nuevoRefreshToken, req.ip ?? null, req.get('user-agent') ?? null, nuevaExpira],
    );

    res.status(200).json({
      accessToken: nuevoAccessToken,
      refreshToken: nuevoRefreshToken,
    });
  });

  // #4 — GET /auth/me & alias /auth/perfil
  const handlerPerfil = async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    }

    const claims = verificarTokenAcceso(token);

    const query = `
      SELECT c.id_usuario, c.id_persona, c.usuario, c.correo,
             COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
             COALESCE(r.codigo, 'CIUDADANO') AS rol_codigo,
             p.area_id, p.cargo_id, p.telefono, p.firma_electronica_habilitada
        FROM sigd_auth.cuenta_usuario c
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
        LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
       WHERE c.id_usuario = $1
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [claims.sub]);
    const usuario = resultado.rows[0];

    if (!usuario) {
      throw new UnauthorizedError({ detail: 'Usuario no encontrado o sesión caducada.' });
    }

    let roles: string[] = [usuario.rol_codigo ?? 'CIUDADANO'];
    let permisos: string[] = [];
    try {
      const rolesQuery = await pool.query<{ codigo: string }>(
        `SELECT DISTINCT r.codigo
           FROM sigd_org.usuario_rol ur
           JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
          WHERE ur.id_usuario = $1
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
            AND r.vigente = TRUE`,
        [claims.sub],
      );
      if (rolesQuery.rows.length > 0) {
        roles = rolesQuery.rows.map((r) => r.codigo);
      }

      const permisosQuery = await pool.query<{ codigo: string }>(
        `SELECT DISTINCT p.codigo
           FROM sigd_org.usuario_rol ur
           JOIN sigd_org.rol_permiso rp ON rp.rol_id = ur.rol_id
           JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
          WHERE ur.id_usuario = $1
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())`,
        [claims.sub],
      );
      permisos = permisosQuery.rows.map((p) => p.codigo);
    } catch {
      // Ignorar si falla lectura extendida
    }

    const rolEfectivo = roles.includes('ADMINISTRADOR')
      ? 'ADMINISTRADOR'
      : (usuario.rol_codigo ?? roles[0] ?? 'CIUDADANO');

    res.status(200).json({
      id: usuario.id_usuario,
      usuario: usuario.usuario,
      username: usuario.usuario,
      nombreCompleto: usuario.nombre_completo,
      correo: usuario.correo,
      rol: rolEfectivo,
      roles: roles,
      permisos: permisos,
      firmaElectronicaHabilitada: usuario.firma_electronica_habilitada ?? true,
      areaId: usuario.area_id ?? null,
      cargoId: usuario.cargo_id ?? null,
      telefono: usuario.telefono ?? null,
    });
  };

  router.get('/auth/me', handlerPerfil);
  router.get('/auth/perfil', handlerPerfil);

  return router;
}

export default crearRouterAuth;
