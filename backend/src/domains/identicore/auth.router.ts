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
import { loginRateLimiter } from '../../middleware/rate-limiter.middleware.js';

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

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function crearRouterAuth(pool: Pool): Router {
  const router = Router();

  // #1 — POST /auth/login (con rate limiting contra ataques de fuerza bruta SEC-10)
  router.post('/auth/login', loginRateLimiter, async (req: Request, res: Response) => {
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
       ORDER BY CASE r.codigo
         WHEN 'ADMINISTRADOR' THEN 1 WHEN 'DIRECTOR' THEN 2
         WHEN 'SECRETARIO' THEN 3 WHEN 'ESPECIALISTA' THEN 4
         WHEN 'MESA_PARTES' THEN 5 WHEN 'CIUDADANO' THEN 6 ELSE 7 END
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
    const accessToken = firmarTokenAcceso({
      sub: usuario.id_usuario,
      roles: [rol],
      expiraSegundos: 900, // 15 minutos
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashRefreshToken(refreshToken);
    const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    // Registrar sesión en base de datos almacenando el digest hash (SEC-05) con propagación y registro explícito de errores
    try {
      await pool.query(
        `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, ip_origen, user_agent, expira_en)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (refresh_token) DO NOTHING;`,
        [usuario.id_usuario, tokenHash, req.ip ?? null, req.get('user-agent') ?? null, expiraEn],
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
        idPersona: usuario.id_persona,
        nombreCompleto: usuario.nombre_completo,
        correo: usuario.correo ?? `${usuario.usuario}@iestp-suiza.edu.pe`,
        rol: rol,
        areaId: usuario.area_id ?? undefined,
      },
    });
  });

  // #2 — POST /auth/logout
  router.post('/auth/logout', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokenHash = hashRefreshToken(refreshToken);

    try {
      await pool.query(
        `UPDATE sigd_auth.sesion_usuario
            SET revocado_en = now()
          WHERE (refresh_token = $1 OR refresh_token = $2) AND revocado_en IS NULL;`,
        [tokenHash, refreshToken],
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
    const tokenHash = hashRefreshToken(refreshToken);

    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');

      const query = `
        SELECT s.id_usuario, s.expira_en, s.revocado_en,
               COALESCE(r.codigo, 'CIUDADANO') AS rol_codigo
          FROM sigd_auth.sesion_usuario s
          LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = s.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
          LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
         WHERE (s.refresh_token = $1 OR s.refresh_token = $2)
         ORDER BY CASE r.codigo
           WHEN 'ADMINISTRADOR' THEN 1 WHEN 'DIRECTOR' THEN 2
           WHEN 'SECRETARIO' THEN 3 WHEN 'ESPECIALISTA' THEN 4
           WHEN 'MESA_PARTES' THEN 5 WHEN 'CIUDADANO' THEN 6 ELSE 7 END
         FOR UPDATE OF s
         LIMIT 1;
      `;

      const resultado = await cliente.query(query, [tokenHash, refreshToken]);
      const sesion = resultado.rows[0];

      if (!sesion || sesion.revocado_en !== null || new Date(sesion.expira_en) < new Date()) {
        await cliente.query('ROLLBACK');
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
      const nuevoHash = hashRefreshToken(nuevoRefreshToken);
      const nuevaExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Rotación atómica de refresh token bajo lock exclusivo (SEC-07)
      await cliente.query(
        `UPDATE sigd_auth.sesion_usuario
            SET revocado_en = now()
          WHERE (refresh_token = $1 OR refresh_token = $2);`,
        [tokenHash, refreshToken],
      );

      await cliente.query(
        `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, ip_origen, user_agent, expira_en)
         VALUES ($1, $2, $3, $4, $5);`,
        [sesion.id_usuario, nuevoHash, req.ip ?? null, req.get('user-agent') ?? null, nuevaExpira],
      );

      await cliente.query('COMMIT');

      res.status(200).json({
        accessToken: nuevoAccessToken,
        refreshToken: nuevoRefreshToken,
      });
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      cliente.release();
    }
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
             p.area_id, p.cargo_id, p.telefono
        FROM sigd_auth.cuenta_usuario c
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
        LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
       WHERE c.id_usuario = $1
       ORDER BY CASE r.codigo
         WHEN 'ADMINISTRADOR' THEN 1 WHEN 'DIRECTOR' THEN 2
         WHEN 'SECRETARIO' THEN 3 WHEN 'ESPECIALISTA' THEN 4
         WHEN 'MESA_PARTES' THEN 5 WHEN 'CIUDADANO' THEN 6 ELSE 7 END
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [claims.sub]);
    const usuario = resultado.rows[0];

    if (!usuario) {
      throw new UnauthorizedError({ detail: 'Usuario no encontrado o sesión caducada.' });
    }

    res.status(200).json({
      id: usuario.id_usuario,
      idPersona: usuario.id_persona,
      usuario: usuario.usuario,
      username: usuario.usuario,
      nombreCompleto: usuario.nombre_completo,
      correo: usuario.correo,
      rol: usuario.rol_codigo,
      areaId: usuario.area_id,
      cargoId: usuario.cargo_id,
      telefono: usuario.telefono,
    });
  };

  router.get('/auth/me', handlerPerfil);
  router.get('/auth/perfil', handlerPerfil);

  return router;
}

export default crearRouterAuth;
