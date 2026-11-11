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
import { actualizarPerfilSchema, cambiarPasswordSchema, PerfilCiudadanoService } from './perfilCiudadano.service.js';

const loginSchema = z.object({
  identificador: z.string().min(3).max(100),
  password: z.string().min(6).max(128),
  contexto: z.enum(['PERSONAL', 'INSTITUCIONAL']).optional(),
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
             COALESCE(ur.area_id, p.area_id) AS area_id
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
         WHEN 'TESORERIA' THEN 5 WHEN 'MESA_PARTES' THEN 5 WHEN 'CIUDADANO' THEN 6 ELSE 7 END
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
    // Descubrimiento no arbitrario de roles y contextos vigentes
    const { rows: rolesRows } = await pool.query<{ codigo: string; area_id: string | null }>(
      `SELECT r.codigo, ur.area_id
         FROM sigd_org.usuario_rol ur
         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        WHERE ur.id_usuario = $1::uuid
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        ORDER BY CASE r.codigo
          WHEN 'ADMINISTRADOR' THEN 1 WHEN 'DIRECTOR' THEN 2
          WHEN 'SECRETARIO' THEN 3 WHEN 'ESPECIALISTA' THEN 4
          WHEN 'TESORERIA' THEN 5 WHEN 'MESA_PARTES' THEN 5 WHEN 'CIUDADANO' THEN 6 ELSE 7 END`,
      [usuario.id_usuario]
    );

    // Descubrimiento de perfiles operativos asignados vigentes
    const { rows: perfilesRows } = await pool.query<{ codigo: string; area_id: string | null; scope: string }>(
      `SELECT p.codigo, ap.area_id, ap.scope
         FROM sigd_org.asignacion_perfil_operativo ap
         JOIN sigd_org.perfil_operativo p ON p.perfil_id = ap.perfil_id
        WHERE ap.id_usuario = $1::uuid
          AND ap.estado = 'ACTIVO'
          AND p.vigente = TRUE
          AND ap.vigente_desde <= now()
          AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())`,
      [usuario.id_usuario]
    );

    // Descubrimiento de asignaciones ordinarias y responsabilidades
    const { rows: asigRows } = await pool.query<{ area_id: string }>(
      `SELECT a.area_id
         FROM sigd_org.asignacion_personal a
        WHERE (a.id_usuario = $1::uuid OR a.id_persona = $2::uuid)
          AND a.estado = 'ACTIVO'
          AND a.vigente_desde <= now()
          AND (a.vigente_hasta IS NULL OR a.vigente_hasta > now())`,
      [usuario.id_usuario, usuario.id_persona]
    );

    const tieneCapacidadInstitucional =
      (usuario.rol_codigo && usuario.rol_codigo !== 'CIUDADANO') ||
      rolesRows.some((r) => r.codigo !== 'CIUDADANO') ||
      perfilesRows.length > 0 ||
      asigRows.length > 0;

    const contextosDisponibles: Array<{
      tipo: 'PERSONAL' | 'INSTITUCIONAL';
      descripcion: string;
      rol?: string;
      areaId?: string;
      perfiles?: string[];
    }> = [
      {
        tipo: 'PERSONAL',
        descripcion: 'Trámites personales, consulta ciudadana y casilla electrónica',
        rol: 'CIUDADANO',
      },
    ];

    let rolInstitucional =
      rolesRows.find((r) => r.codigo !== 'CIUDADANO')?.codigo ??
      (usuario.rol_codigo !== 'CIUDADANO' ? usuario.rol_codigo : undefined);
    let areaIdInstitucional =
      rolesRows.find((r) => r.codigo !== 'CIUDADANO')?.area_id ??
      usuario.area_id ??
      perfilesRows.find((p) => p.area_id)?.area_id ??
      asigRows[0]?.area_id;

    if (tieneCapacidadInstitucional) {
      contextosDisponibles.push({
        tipo: 'INSTITUCIONAL',
        descripcion: 'Gestión institucional, despacho y operación funcional',
        rol: rolInstitucional ?? 'ESPECIALISTA',
        areaId: areaIdInstitucional ?? undefined,
        perfiles: perfilesRows.map((p) => p.codigo),
      });
    }

    // Selección de contexto seguro (Opción B: PERSONAL por defecto)
    const contextoSolicitado = datos.contexto;
    let contextoEfectivo: 'PERSONAL' | 'INSTITUCIONAL' = 'PERSONAL';
    let rolEfectivo = 'CIUDADANO';
    let areaIdEfectivo: string | undefined = undefined;

    if (contextoSolicitado === 'INSTITUCIONAL') {
      if (!tieneCapacidadInstitucional) {
        throw new AppError({
          status: 403,
          code: 'INSTITUTIONAL_CONTEXT_NOT_AVAILABLE',
          message: 'Contexto institucional no disponible.',
          detail: 'La cuenta no posee roles, asignaciones ni perfiles operativos institucionales vigentes.',
        });
      }
      contextoEfectivo = 'INSTITUCIONAL';
      rolEfectivo = rolInstitucional ?? 'ESPECIALISTA';
      areaIdEfectivo = areaIdInstitucional ?? undefined;
    } else {
      // Por defecto y para contexto PERSONAL: siempre contexto seguro PERSONAL
      contextoEfectivo = 'PERSONAL';
      rolEfectivo = 'CIUDADANO';
      areaIdEfectivo = undefined;
    }

    const accessToken = firmarTokenAcceso({
      sub: usuario.id_usuario,
      roles: [rolEfectivo],
      expiraSegundos: 900,
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashRefreshToken(refreshToken);
    const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
      contextoActivo: contextoEfectivo,
      contextos: contextosDisponibles,
      usuario: {
        id: usuario.id_usuario,
        idPersona: usuario.id_persona,
        nombreCompleto: usuario.nombre_completo,
        correo: usuario.correo ?? `${usuario.usuario}@iestp-suiza.edu.pe`,
        rol: rolEfectivo,
        contexto: contextoEfectivo,
        areaId: areaIdEfectivo,
      },
    });
  });

  // #1.1 — POST /auth/contexto (cambio explícito de contexto operativo)
  router.post('/auth/contexto', async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    }
    const claims = verificarTokenAcceso(token);
    const schema = z.object({
      contexto: z.enum(['PERSONAL', 'INSTITUCIONAL']),
    });
    const { contexto } = schema.parse(req.body);

    const { rows: uRows } = await pool.query<{
      id_usuario: string;
      id_persona: string;
      usuario: string;
      correo: string;
      activo: boolean;
      nombre_completo: string;
    }>(
      `SELECT c.id_usuario, c.id_persona, c.usuario, c.correo, c.activo,
              COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo
         FROM sigd_auth.cuenta_usuario c
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
        WHERE c.id_usuario = $1::uuid`,
      [claims.sub]
    );
    const user = uRows[0];
    if (!user || !user.activo) {
      throw new AppError({
        status: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'Cuenta deshabilitada.',
      });
    }

    if (contexto === 'PERSONAL') {
      const nuevoToken = firmarTokenAcceso({
        sub: user.id_usuario,
        roles: ['CIUDADANO'],
        expiraSegundos: 900,
      });
      res.status(200).json({
        ok: true,
        accessToken: nuevoToken,
        contextoActivo: 'PERSONAL',
        usuario: {
          id: user.id_usuario,
          idPersona: user.id_persona,
          nombreCompleto: user.nombre_completo,
          rol: 'CIUDADANO',
          contexto: 'PERSONAL',
        },
      });
      return;
    }

    // Contexto INSTITUCIONAL: verificar que posea credenciales activas
    const { rows: rRows } = await pool.query<{ codigo: string; area_id: string | null }>(
      `SELECT r.codigo, ur.area_id
         FROM sigd_org.usuario_rol ur
         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        WHERE ur.id_usuario = $1::uuid
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        ORDER BY CASE r.codigo
          WHEN 'ADMINISTRADOR' THEN 1 WHEN 'DIRECTOR' THEN 2
          WHEN 'SECRETARIO' THEN 3 WHEN 'ESPECIALISTA' THEN 4
          WHEN 'TESORERIA' THEN 5 WHEN 'MESA_PARTES' THEN 5 ELSE 6 END`,
      [user.id_usuario]
    );

    const { rows: apRows } = await pool.query<{ codigo: string; area_id: string | null }>(
      `SELECT p.codigo, ap.area_id
         FROM sigd_org.asignacion_perfil_operativo ap
         JOIN sigd_org.perfil_operativo p ON p.perfil_id = ap.perfil_id
        WHERE ap.id_usuario = $1::uuid
          AND ap.estado = 'ACTIVO'
          AND p.vigente = TRUE
          AND ap.vigente_desde <= now()
          AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())`,
      [user.id_usuario]
    );

    if (rRows.length === 0 && apRows.length === 0) {
      throw new AppError({
        status: 403,
        code: 'INSTITUTIONAL_CONTEXT_NOT_AVAILABLE',
        message: 'No posee facultades institucionales activas.',
      });
    }

    const rolInst = rRows.find((r) => r.codigo !== 'CIUDADANO')?.codigo ?? 'ESPECIALISTA';
    const areaInst = rRows.find((r) => r.codigo !== 'CIUDADANO')?.area_id ?? apRows[0]?.area_id;

    const nuevoToken = firmarTokenAcceso({
      sub: user.id_usuario,
      roles: [rolInst],
      expiraSegundos: 900,
    });

    res.status(200).json({
      ok: true,
      accessToken: nuevoToken,
      contextoActivo: 'INSTITUCIONAL',
      usuario: {
        id: user.id_usuario,
        idPersona: user.id_persona,
        nombreCompleto: user.nombre_completo,
        rol: rolInst,
        contexto: 'INSTITUCIONAL',
        areaId: areaInst ?? undefined,
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
        SELECT s.id_usuario, s.expira_en, s.revocado_en, c.activo,
               COALESCE(r.codigo, 'CIUDADANO') AS rol_codigo
          FROM sigd_auth.sesion_usuario s
          JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = s.id_usuario
          LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = s.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
          LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
         WHERE (s.refresh_token = $1 OR s.refresh_token = $2)
         ORDER BY CASE r.codigo
           WHEN 'ADMINISTRADOR' THEN 1 WHEN 'DIRECTOR' THEN 2
           WHEN 'SECRETARIO' THEN 3 WHEN 'ESPECIALISTA' THEN 4
            WHEN 'TESORERIA' THEN 5 WHEN 'MESA_PARTES' THEN 5 WHEN 'CIUDADANO' THEN 6 ELSE 7 END
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

      if (sesion.activo === false) {
        await cliente.query('ROLLBACK');
        throw new AppError({
          status: 403,
          code: 'ACCOUNT_DISABLED',
          message: 'Cuenta deshabilitada.',
          detail: 'Su cuenta institucional se encuentra suspendida o deshabilitada.',
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
             pers.id_documento AS numero_documento,
             CASE WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
                  WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
                  ELSE 'CE' END AS tipo_documento,
             COALESCE(pn.nombres, pj.razon_social) AS nombres,
             pn.apellidos,
             pers.direccion,
             COALESCE(r.codigo, 'CIUDADANO') AS rol_codigo,
             COALESCE(ur.area_id, p.area_id) AS area_id,
             p.cargo_id, COALESCE(pn.telefono, p.telefono) AS telefono
        FROM sigd_auth.cuenta_usuario c
        JOIN sigd_auth.persona pers ON pers.id_persona = c.id_persona
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
        LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
       WHERE c.id_usuario = $1
       ORDER BY CASE r.codigo
         WHEN 'ADMINISTRADOR' THEN 1 WHEN 'DIRECTOR' THEN 2
         WHEN 'SECRETARIO' THEN 3 WHEN 'ESPECIALISTA' THEN 4
         WHEN 'TESORERIA' THEN 5 WHEN 'MESA_PARTES' THEN 5 WHEN 'CIUDADANO' THEN 6 ELSE 7 END
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
      usernameConfigurado: Boolean(usuario.usuario && usuario.usuario !== usuario.numero_documento),
      nombreCompleto: usuario.nombre_completo,
      correo: usuario.correo,
      rol: usuario.rol_codigo,
      areaId: usuario.area_id,
      cargoId: usuario.cargo_id,
      telefono: usuario.telefono,
      tipoDocumento: usuario.tipo_documento,
      numeroDocumento: usuario.numero_documento,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos ?? '',
      direccion: usuario.direccion,
    });
  };

  router.get('/auth/me', handlerPerfil);
  router.get('/auth/perfil', handlerPerfil);

  const perfilCiudadano = new PerfilCiudadanoService(pool);
  const idUsuarioAutenticado = (req: Request): string => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    const sub = verificarTokenAcceso(token).sub;
    if (!z.uuid().safeParse(sub).success) throw new UnauthorizedError({ detail: 'La sesión no identifica una cuenta válida.' });
    return sub;
  };

  router.patch('/auth/me', async (req: Request, res: Response) => {
    const idUsuario = idUsuarioAutenticado(req);
    await perfilCiudadano.actualizar(idUsuario, actualizarPerfilSchema.parse(req.body));
    res.status(204).end();
  });

  router.patch('/auth/me/password', async (req: Request, res: Response) => {
    const idUsuario = idUsuarioAutenticado(req);
    await perfilCiudadano.cambiarPassword(idUsuario, cambiarPasswordSchema.parse(req.body));
    res.status(204).end();
  });

  return router;
}

export default crearRouterAuth;