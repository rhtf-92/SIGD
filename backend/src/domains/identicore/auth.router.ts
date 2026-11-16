/**
 * Endpoints #1, #2, #3, #4, #5, #6 del catálogo REST — Autenticación Centralizada, Perfil y Contexto
 * Responsables: B_SEGUNDO (Segundo), B_TAPULLIMA (Tania), B_JAIR (Jair), B_JACOBO (Jacobo)
 * Subdominio: IdentiCore / Auth (sigd_auth)
 *
 *   #1  POST /api/v1/auth/login                  — Autenticación con verificación de hash y emisión de JWT dual
 *   #2  POST /api/v1/auth/logout                 — Cierre de sesión y revocación de refresh token
 *   #3  POST /api/v1/auth/refresh                — Rotación de tokens con validación de vigencia y preservación de contexto
 *   #4  GET  /api/v1/auth/me                     — Perfil y facultades institucionales del contexto activo
 *       GET  /api/v1/auth/perfil                 — Alias de compatibilidad frontend
 *   #5  GET  /api/v1/auth/contextos              — Lista de asignaciones y contextos disponibles para la sesión
 *   #6  POST /api/v1/auth/seleccionar-contexto   — Selección y conmutación obligatoria de contexto activo por sesión
 *
 * REGLAS TSK-1.0A:
 * - Un contexto disponible: selección automática.
 * - Varios contextos: exigir selección explícita (NO preseleccionar silenciosamente el primero).
 * - Sin contexto activo en cuentas multirrol: permisos = [] y requiereSeleccionContexto = true.
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { firmarTokenAcceso, extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { AppError, UnauthorizedError, ForbiddenError } from '../../shared/domain/errors/index.js';
import { Argon2Service } from './argon2.service.js';
import { obtenerAutorizacionCuenta } from '../../core/auth/auth.guard.js';
import {
  listarContextosDisponibles,
  cambiarContexto,
  validarYResolverContexto,
} from '../../core/auth/contexto.service.js';
import type { ContextoUsuario } from '../../core/auth/contexto.types.js';

const loginSchema = z.object({
  identificador: z.string().min(3).max(100),
  password: z.string().min(6).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
  contextoId: z.string().uuid().optional(),
});

const seleccionarContextoSchema = z.object({
  idAsignacion: z.string().uuid(),
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
             r.codigo AS rol_codigo,
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

    const autorizacion = await obtenerAutorizacionCuenta(pool, usuario.id_usuario);
    if (!autorizacion || (autorizacion.roles.length === 0 && !autorizacion.requiereSeleccionContexto)) {
      throw new AppError({
        status: 403,
        code: 'ACCOUNT_WITHOUT_ROLES',
        message: 'Cuenta sin roles asignados.',
        detail: 'Su cuenta institucional no tiene roles activos asignados en el sistema.',
      });
    }

    const contextos = await listarContextosDisponibles(pool, usuario.id_usuario);
    let contextoActivo: ContextoUsuario | null = null;
    let requiereSeleccionContexto = false;

    if (contextos.length === 1) {
      // Regla TSK-1.0A: Un único contexto disponible -> selección automática
      contextoActivo = contextos[0];
      requiereSeleccionContexto = false;
    } else if (contextos.length > 1) {
      // Regla TSK-1.0A: Varios contextos -> exigir selección explícita (NO preseleccionar el primero)
      contextoActivo = null;
      requiereSeleccionContexto = true;
    }

    const rolFallback = usuario.rol_codigo ?? '';
    const rol = contextoActivo?.codigo || (contextos.length <= 1 ? (autorizacion.roles[0] ?? rolFallback) : '');
    const rolesToken = contextoActivo?.codigo
      ? [contextoActivo.codigo]
      : (contextos.length <= 1
          ? (autorizacion.roles.length > 0 ? autorizacion.roles : (rolFallback ? [rolFallback] : []))
          : []);
    const accessToken = firmarTokenAcceso({
      sub: usuario.id_usuario,
      roles: rolesToken,
      ctx: contextoActivo?.idAsignacion,
      rol: contextoActivo?.codigo,
      expiraSegundos: 1140, // 19 minutos normativos
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiraEn = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días normativos B_JACOBO

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
      requiereSeleccionContexto,
      usuario: {
        id: usuario.id_usuario,
        nombreCompleto: usuario.nombre_completo,
        correo: usuario.correo ?? `${usuario.usuario}@iestp-suiza.edu.pe`,
        rol: rol,
        roles: rolesToken,
        permisos: contextoActivo ? contextoActivo.permisos : (contextos.length === 0 ? autorizacion.permisos : []),
        areaId: contextoActivo?.areaId ?? usuario.area_id ?? undefined,
        contextoActivo: contextoActivo ?? undefined,
        contextosDisponibles: contextos.length > 0 ? contextos : undefined,
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
    const { refreshToken, contextoId } = refreshSchema.parse(req.body);

    const query = `
      SELECT s.id_usuario, s.expira_en, s.revocado_en,
             r.codigo AS rol_codigo
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

    // Identificar contexto a preservar en la renovación
    let idContexto = contextoId;
    if (!idContexto) {
      const headerAuth = extraerTokenBearer(req.get('authorization'));
      if (headerAuth) {
        try {
          const claimsPrevias = verificarTokenAcceso(headerAuth);
          if (claimsPrevias.ctx) idContexto = claimsPrevias.ctx;
        } catch {
          // Si el token expiró antes del refresh, es normal
        }
      }
    }

    let contextoValido: ContextoUsuario | null = null;
    if (idContexto) {
      try {
        contextoValido = await validarYResolverContexto(pool, sesion.id_usuario, idContexto);
      } catch {
        contextoValido = null;
      }
    }

    const autorizacion = await obtenerAutorizacionCuenta(pool, sesion.id_usuario, contextoValido?.idAsignacion ?? null);
    if (!autorizacion) {
      throw new UnauthorizedError({
        detail: 'No se pudo obtener la autorización de la cuenta. Inicie sesión nuevamente.',
      });
    }

    const nuevoAccessToken = firmarTokenAcceso({
      sub: sesion.id_usuario,
      roles: contextoValido ? [contextoValido.codigo] : (autorizacion.requiereSeleccionContexto ? [] : autorizacion.roles),
      ctx: contextoValido?.idAsignacion,
      rol: contextoValido?.codigo,
      expiraSegundos: 1140, // 19 minutos normativos
    });

    const nuevoRefreshToken = crypto.randomBytes(32).toString('hex');
    const nuevaExpira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días normativos B_JACOBO

    // Rotación atómica de refresh token
    const rotacion = await pool.query(
      `WITH anterior AS (
         UPDATE sigd_auth.sesion_usuario SET revocado_en = now()
          WHERE refresh_token = $1 AND id_usuario = $2::uuid
            AND revocado_en IS NULL AND expira_en > now()
          RETURNING id_usuario
       )
       INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, ip_origen, user_agent, expira_en)
       SELECT id_usuario, $3, $4, $5, $6 FROM anterior RETURNING id_usuario;`,
      [refreshToken, sesion.id_usuario, nuevoRefreshToken, req.ip ?? null, req.get('user-agent') ?? null, nuevaExpira]);
    if (rotacion.rowCount !== 1) throw new UnauthorizedError();

    res.status(200).json({
      accessToken: nuevoAccessToken,
      refreshToken: nuevoRefreshToken,
      requiereSeleccionContexto: !contextoValido && autorizacion.requiereSeleccionContexto === true,
      roles: contextoValido ? [contextoValido.codigo] : autorizacion.roles,
      permisos: contextoValido ? contextoValido.permisos : autorizacion.permisos,
      contextoActivo: contextoValido ?? undefined,
    });
  });

  // #4 — GET /auth/me & alias /auth/perfil
  const handlerPerfil = async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    }

    const claims = verificarTokenAcceso(token);
    const contextoHeader = req.get('x-contexto-id')?.trim() || null;

    if (contextoHeader && claims.ctx && contextoHeader !== claims.ctx) {
      throw new ForbiddenError({
        message: 'Violación de seguridad: El encabezado x-contexto-id no coincide con el contexto activo firmado en el token.',
      });
    }

    const idContextoActivo = claims.ctx || null;
    const autorizacion = await obtenerAutorizacionCuenta(pool, claims.sub, idContextoActivo);
    if (!autorizacion) {
      throw new UnauthorizedError({ detail: 'Cuenta institucional inactiva o sesión caducada.' });
    }
    const contextos = await listarContextosDisponibles(pool, claims.sub);
    const contextoActivo = autorizacion.contextoRevocado
      ? null
      : (contextos.find((c) => c.idAsignacion === idContextoActivo) ??
         (contextos.length === 1 ? contextos[0] : null));

    const query = `
      SELECT c.id_usuario, c.id_persona, c.usuario, c.correo,
             COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
             r.codigo AS rol_codigo,
             p.area_id, p.cargo_id, p.telefono,
             persona.tipo AS tipo_persona, persona.id_documento,
             documento.codigo AS tipo_documento,
             pn.nombres, pn.apellidos, pj.razon_social,
             COALESCE(to_jsonb(p)->>'direccion', pj.direccion) AS direccion_persona,
             to_jsonb(p)->>'ubigeo_distrito' AS ubigeo_distrito,
             to_jsonb(p)->>'referencia' AS referencia_persona,
             pn.fecha_nacimiento::text AS fecha_nacimiento,
             pn.correo AS correo_persona, pn.telefono AS telefono_persona
        FROM sigd_auth.cuenta_usuario c
        LEFT JOIN sigd_auth.persona persona ON persona.id_persona = c.id_persona
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
        LEFT JOIN LATERAL (
          SELECT td.codigo
            FROM sigd_auth.persona_documento_historial h
            JOIN sigd_auth.tipos_documento td ON td.id_tipo_documento = h.tipo_documento
           WHERE h.id_persona = c.id_persona
             AND h.id_documento = persona.id_documento
           ORDER BY h.fecha_registro DESC, h.id_historial DESC
           LIMIT 1
        ) documento ON TRUE
        LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
       WHERE c.id_usuario = $1 AND c.activo = TRUE
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [claims.sub]);
    const usuario = resultado.rows[0];

    if (!usuario) {
      throw new UnauthorizedError({ detail: 'Usuario no encontrado o sesión caducada.' });
    }

    const requiereSeleccion = !contextoActivo && contextos.length > 1;
    const rolFallback = usuario.rol_codigo ?? '';

    res.status(200).json({
      id: usuario.id_usuario,
      usuario: usuario.usuario,
      username: usuario.usuario,
      nombreCompleto: usuario.nombre_completo,
      correo: usuario.correo,
      rol: contextoActivo?.codigo || (requiereSeleccion ? '' : (autorizacion?.roles[0] ?? rolFallback)),
      roles: contextoActivo?.codigo
        ? [contextoActivo.codigo]
        : (requiereSeleccion
            ? []
            : (autorizacion?.roles && autorizacion.roles.length > 0 ? autorizacion.roles : (rolFallback ? [rolFallback] : []))),
      permisos: contextoActivo?.permisos ?? (requiereSeleccion ? [] : autorizacion?.permisos ?? []),
      areaId: contextoActivo?.areaId ?? usuario.area_id,
      cargoId: usuario.cargo_id,
      telefono: usuario.telefono,
      requiereSeleccionContexto: requiereSeleccion || autorizacion.contextoRevocado === true,
      contextoRevocado: autorizacion.contextoRevocado === true,
      contextoActivo: contextoActivo ?? undefined,
      contextosDisponibles: contextos.length > 0 ? contextos : undefined,
      identidad: {
        tipoPersona: usuario.tipo_persona,
        tipoDocumento: usuario.tipo_documento,
        numeroDocumento: usuario.id_documento,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        razonSocial: usuario.razon_social,
        direccion: usuario.direccion_persona,
        ubigeoDistrito: usuario.ubigeo_distrito,
        referencia: usuario.referencia_persona,
        fechaNacimiento: usuario.fecha_nacimiento,
        correo: usuario.correo ?? usuario.correo_persona,
        telefono: usuario.telefono ?? usuario.telefono_persona,
      },
    });
  };

  router.get('/auth/me', handlerPerfil);
  router.get('/auth/perfil', handlerPerfil);

  // #5 — GET /auth/contextos: Lista asignaciones y contextos disponibles
  router.get('/auth/contextos', async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    const claims = verificarTokenAcceso(token);
    const contextos = await listarContextosDisponibles(pool, claims.sub);
    const contextoActivoId = claims.ctx ?? (contextos.length === 1 ? contextos[0]?.idAsignacion : null);
    res.status(200).json({
      contextos,
      contextoActivoId,
      requiereSeleccionContexto: !claims.ctx && contextos.length > 1,
    });
  });

  // #6 — POST /auth/seleccionar-contexto: Conmutación de contexto activo con token renovado
  router.post('/auth/seleccionar-contexto', async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    const claims = verificarTokenAcceso(token);
    const { idAsignacion } = seleccionarContextoSchema.parse(req.body);

    const resultado = await cambiarContexto(
      pool,
      claims.sub,
      idAsignacion,
      req.ip ?? undefined,
      req.get('user-agent') ?? undefined,
    );

    res.status(200).json(resultado);
  });

  return router;
}

export default crearRouterAuth;
