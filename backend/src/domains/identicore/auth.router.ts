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
import { normalizarRol } from '../../shared/domain/roles.js';
import { Argon2Service } from './argon2.service.js';
import { enviarCorreo } from '../../services/mail.service.js';

const loginSchema = z
  .object({
    identificador: z.string().trim().min(3).max(160).optional(),
    usuario: z.string().trim().min(3).max(100).optional(),
    correo: z.string().trim().min(3).max(160).optional(),
    password: z.string().min(3).max(128),
  })
  .refine((datos) => Boolean(datos.identificador ?? datos.usuario ?? datos.correo), {
    message: 'Debe indicar identificador, usuario o correo.',
    path: ['identificador'],
  });

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const recuperarSchema = z.object({
  identificador: z.string().min(3).max(160),
});

async function verificarHashPassword(passwordPlana: string, hashAlmacenado: string): Promise<boolean> {
  return Argon2Service.verify(hashAlmacenado, passwordPlana);
}

export function crearRouterAuth(pool: Pool): Router {
  const router = Router();

  // #1 — POST /auth/login
  router.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const datos = loginSchema.parse(req.body);
      const identificador = (datos.identificador ?? datos.usuario ?? datos.correo ?? '').trim();

      // Búsqueda flexible por usuario, correo o documento (DNI/RUC) de la persona.
      const query = `
        SELECT c.id_usuario, c.id_persona, c.usuario, c.correo,
               c.password_hash, c.activo,
               COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
               COALESCE(r.codigo, 'CIUDADANO') AS rol_codigo,
               pu.area_id
          FROM sigd_auth.cuenta_usuario c
          JOIN sigd_auth.persona p ON p.id_persona = c.id_persona
          LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
          LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
          LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
          LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
          LEFT JOIN sigd_auth.perfil_usuario pu ON pu.id_usuario = c.id_usuario
         WHERE (c.usuario = $1 OR c.correo = $1 OR p.id_documento = $1)
         ORDER BY CASE COALESCE(r.codigo, 'CIUDADANO')
           WHEN 'ADMIN' THEN 0 WHEN 'ADMINISTRADOR' THEN 1 WHEN 'SUPER_ADMIN' THEN 1
           WHEN 'DIRECTOR' THEN 2 WHEN 'DOCENTE' THEN 3 WHEN 'SECRETARIO' THEN 3
           WHEN 'ESPECIALISTA' THEN 4 WHEN 'MESA_PARTES' THEN 5 ELSE 6
         END
         LIMIT 1;
      `;

      const resultado = await pool.query(query, [identificador]);
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

      const rolCodigo = String(usuario.rol_codigo ?? 'CIUDADANO').toUpperCase();
      const rol = normalizarRol(rolCodigo) ?? 'CIUDADANO';
      const accessToken = firmarTokenAcceso({ sub: usuario.id_usuario, roles: [rol], expiraSegundos: 900 });
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      try {
        await pool.query(
          `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, ip_origen, user_agent, expira_en)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (refresh_token) DO NOTHING;`,
          [usuario.id_usuario, refreshToken, req.ip ?? null, req.get('user-agent') ?? null, expiraEn],
        );
      } catch (error) {
        console.error('[AUTH] Error al persistir sesión:', error);
      }

      res.status(200).json({
        accessToken,
        refreshToken,
        usuario: {
          id: usuario.id_usuario,
          nombreCompleto: usuario.nombre_completo,
          correo: usuario.correo ?? `${usuario.usuario}@iestp-suiza.edu.pe`,
          rol,
          rolCodigo,
          areaId: usuario.area_id ?? undefined,
        },
      });
    } catch (error: any) {
      const status = error?.status ?? (error?.name === 'ZodError' ? 400 : undefined);
      if (status === 400 || status === 401 || status === 403 || status === 422) {
        const detail = error?.issues?.map((i: any) => `${(i.path ?? []).join('.')}: ${i.message}`).join('; ') || error?.detail || error?.message;
        res.status(status).json({ status, detail, code: error?.code ?? 'AUTH_ERROR' });
        return;
      }
      console.error('[auth/login]', error);
      res.status(503).json({ ok: false, status: 503, detail: 'Servicio de autenticación no disponible. Verifique la base de datos.' });
    }
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
             COALESCE(r.codigo, 'ESTUDIANTE') AS rol_codigo
        FROM sigd_auth.sesion_usuario s
        LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = s.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
       WHERE s.refresh_token = $1
       ORDER BY CASE COALESCE(r.codigo, 'CIUDADANO')
         WHEN 'ADMIN' THEN 0
         WHEN 'ADMINISTRADOR' THEN 1
         WHEN 'SUPER_ADMIN' THEN 1
         WHEN 'DIRECTOR' THEN 2
         WHEN 'DOCENTE' THEN 3
         WHEN 'SECRETARIO' THEN 3
         WHEN 'ESPECIALISTA' THEN 4
         WHEN 'MESA_PARTES' THEN 5
         ELSE 6
       END
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [refreshToken]);
    const sesion = resultado.rows[0];

    if (!sesion || sesion.revocado_en !== null || new Date(sesion.expira_en) < new Date()) {
      throw new UnauthorizedError({
        detail: 'El token de refresco es inválido o ha expirado. Inicie sesión nuevamente.',
      });
    }

    const rolRefresco = normalizarRol(sesion.rol_codigo) ?? 'CIUDADANO';
    const nuevoAccessToken = firmarTokenAcceso({
      sub: sesion.id_usuario,
      roles: [rolRefresco],
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
             p.area_id, p.cargo_id, p.telefono
        FROM sigd_auth.cuenta_usuario c
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
        LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
       WHERE c.id_usuario = $1
       ORDER BY CASE COALESCE(r.codigo, 'CIUDADANO')
         WHEN 'ADMIN' THEN 0
         WHEN 'ADMINISTRADOR' THEN 1
         WHEN 'SUPER_ADMIN' THEN 1
         WHEN 'DIRECTOR' THEN 2
         WHEN 'DOCENTE' THEN 3
         WHEN 'SECRETARIO' THEN 3
         WHEN 'ESPECIALISTA' THEN 4
         WHEN 'MESA_PARTES' THEN 5
         ELSE 6
       END
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [claims.sub]);
    const usuario = resultado.rows[0];

    if (!usuario) {
      throw new UnauthorizedError({ detail: 'Usuario no encontrado o sesión caducada.' });
    }

    res.status(200).json({
      id: usuario.id_usuario,
      usuario: usuario.usuario,
      username: usuario.usuario,
      nombreCompleto: usuario.nombre_completo,
      correo: usuario.correo,
      rol: normalizarRol(usuario.rol_codigo) ?? usuario.rol_codigo,
      rolCodigo: usuario.rol_codigo,
      areaId: usuario.area_id,
      cargoId: usuario.cargo_id,
      telefono: usuario.telefono,
    });
  };

  router.get('/auth/me', handlerPerfil);
  router.get('/auth/perfil', handlerPerfil);

  // #5 — POST /auth/recuperar-password — envía código/enlace de recuperación por correo
  router.post('/auth/recuperar-password', async (req: Request, res: Response) => {
    const { identificador } = recuperarSchema.parse(req.body);

    // Buscar cuenta por correo o usuario (sin revelar si existe).
    const query = `
      SELECT c.id_usuario, c.correo, c.usuario, c.activo
        FROM sigd_auth.cuenta_usuario c
       WHERE c.correo = $1 OR c.usuario = $1
       LIMIT 1;
    `;
    const resultado = await pool.query(query, [identificador.trim()]);
    const cuenta = resultado.rows[0];

    // Respuesta genérica para evitar enumeración de correos.
    const responderOk = () => {
      res.status(200).json({
        ok: true,
        mensaje:
          'Si existe una cuenta asociada a ese correo o usuario, se ha enviado un código de recuperación a su correo institucional.',
      });
    };

    if (!cuenta || !cuenta.activo || !cuenta.correo) {
      return responderOk();
    }

    // Generar token de un solo uso (válido 1 hora).
    const tokenPlano = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex');
    const expiraEn = new Date(Date.now() + 60 * 60 * 1000);

    try {
      await pool.query(
        `INSERT INTO sigd_auth.token_recuperacion (id_usuario, token_hash, correo, expira_en)
         VALUES ($1, $2, $3, $4);`,
        [cuenta.id_usuario, tokenHash, cuenta.correo, expiraEn],
      );
    } catch (error) {
      console.error('[AUTH] Error al guardar token de recuperación:', error);
      throw new AppError({
        status: 500,
        code: 'RECUPERACION_ERROR',
        message: 'No se pudo procesar la solicitud de recuperación.',
        detail: 'Error al persistir el token de recuperación.',
      });
    }

    // Enviar correo real (no silencioso). Si falla el SMTP, reportar error.
    try {
      await enviarCorreo({
        a: cuenta.correo,
        asunto: 'Código de recuperación de contraseña — SIGD IESTP Suiza',
        texto: `Hola ${cuenta.usuario},\n\nSolicitaste restablecer tu contraseña en el SIGD.\nTu código de recuperación es: ${tokenPlano}\nEl código expira en 1 hora.\n\nSi no solicitaste esto, ignora este mensaje.\n\n— SIGD IESTP "Suiza"`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;padding:24px;border:1px solid #ddd;border-radius:12px">
            <h2 style="color:#04213f">Recuperación de contraseña — SIGD</h2>
            <p>Hola <strong>${cuenta.usuario}</strong>, solicitaste restablecer tu contraseña.</p>
            <p style="font-size:18px;font-weight:bold;letter-spacing:2px;background:#f3f4f6;padding:12px;border-radius:8px;display:inline-block">${tokenPlano}</p>
            <p style="color:#555">El código expira en <strong>1 hora</strong>.</p>
            <p style="color:#777;font-size:12px">Si no solicitaste este cambio, ignora este mensaje.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('[AUTH] Error al enviar correo de recuperación:', error);
      // Eliminar token si el correo no se envió, para evitar códigos huérfanos.
      try {
        await pool.query('DELETE FROM sigd_auth.token_recuperacion WHERE id_usuario = $1;', [
          cuenta.id_usuario,
        ]);
      } catch {}
      throw new AppError({
        status: 503,
        code: 'MAIL_UNAVAILABLE',
        message: 'El servicio de correo no está disponible.',
        detail: 'No se pudo enviar el código de recuperación. Inténtelo nuevamente más tarde.',
      });
    }

    return responderOk();
  });

  // #6 — POST /auth/restablecer-password — valida token y actualiza la contraseña
  const restablecerSchema = z.object({
    identificador: z.string().min(3).max(160),
    codigo: z.string().min(6).max(128),
    password: z.string().min(6).max(128),
  });

  router.post('/auth/restablecer-password', async (req: Request, res: Response) => {
    const { identificador, codigo, password } = restablecerSchema.parse(req.body);

    const codigoHash = crypto.createHash('sha256').update(codigo).digest('hex');

    const tokenQuery = `
      SELECT t.id_usuario, t.correo, t.expira_en, t.usado_en
        FROM sigd_auth.token_recuperacion t
        JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = t.id_usuario
       WHERE t.token_hash = $1
         AND (c.correo = $2 OR c.usuario = $2)
       ORDER BY t.expira_en DESC
       LIMIT 1;
    `;
    const tokenResultado = await pool.query(tokenQuery, [codigoHash, identificador.trim()]);
    const token = tokenResultado.rows[0];

    if (!token || token.usado_en !== null || new Date(token.expira_en) < new Date()) {
      throw new UnauthorizedError({
        detail: 'Código de recuperación inválido o expirado. Solicite uno nuevo.',
      });
    }

    const passwordHash = await Argon2Service.hash(password);

    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(
        `UPDATE sigd_auth.cuenta_usuario
           SET password_hash = $1
         WHERE id_usuario = $2;`,
        [passwordHash, token.id_usuario],
      );
      await cliente.query(
        `UPDATE sigd_auth.token_recuperacion
           SET usado_en = now()
         WHERE token_hash = $1;`,
        [codigoHash],
      );
      await cliente.query('COMMIT');
    } catch {
      await cliente.query('ROLLBACK');
      throw new AppError({
        status: 500,
        code: 'RESTABLECER_ERROR',
        message: 'No se pudo restablecer la contraseña.',
        detail: 'Error al actualizar la contraseña en la base de datos.',
      });
    } finally {
      cliente.release();
    }

    res.status(200).json({ ok: true, mensaje: 'Contraseña restablecida correctamente.' });
  });

  return router;
}

export default crearRouterAuth;
