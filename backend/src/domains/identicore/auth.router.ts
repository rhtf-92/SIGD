/** Autenticación centralizada con un único perfil RBAC activo por sesión. */
import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { z } from 'zod';
import {
  extraerTokenBearer,
  firmarTokenAcceso,
  firmarTokenSeleccionPerfil,
  verificarTokenAcceso,
  verificarTokenSeleccionPerfil,
} from '../../core/auth/jwt.service.js';
import { AppError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { Argon2Service } from './argon2.service.js';

const loginSchema = z.object({ identificador: z.string().min(3).max(100), password: z.string().min(6).max(128) });
const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const seleccionPerfilSchema = z.object({ tokenSeleccionPerfil: z.string().min(20), rolId: z.string().uuid() });
const cambioPerfilSchema = z.object({ refreshToken: z.string().min(20), rolId: z.string().uuid() });

interface RolDisponible { id: string; codigo: string; nombre: string; areaId?: string | null }
interface Queryable { query: (text: string, values?: unknown[]) => Promise<QueryResult> }

function cuentaBloqueada(valor: unknown): boolean {
  if (valor === 'infinity' || valor === Number.POSITIVE_INFINITY) return true;
  if (!valor) return false;
  const instante = new Date(valor as string | number | Date).getTime();
  return Number.isFinite(instante) && instante > Date.now();
}

function normalizarRoles(valor: unknown): RolDisponible[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((rol): rol is RolDisponible =>
    typeof rol === 'object' && rol !== null &&
    typeof (rol as RolDisponible).id === 'string' && typeof (rol as RolDisponible).codigo === 'string');
}

function asegurarCuentaHabilitada(usuario: { activo?: boolean; bloqueado_hasta?: unknown }): void {
  if (!usuario.activo) {
    throw new AppError({ status: 403, code: 'ACCOUNT_DISABLED', message: 'Cuenta deshabilitada.', detail: 'Su cuenta institucional se encuentra suspendida o deshabilitada.' });
  }
  if (cuentaBloqueada(usuario.bloqueado_hasta)) {
    throw new AppError({ status: 423, code: 'ACCOUNT_LOCKED', message: 'Cuenta bloqueada.', detail: 'Su cuenta institucional se encuentra bloqueada. Contacte al administrador.' });
  }
}

async function crearSesion(db: Queryable, req: Request, idUsuario: string, rol: RolDisponible) {
  const accessToken = firmarTokenAcceso({ sub: idUsuario, roles: [rol.codigo], expiraSegundos: 900 });
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    `INSERT INTO sigd_auth.sesion_usuario
       (id_usuario, refresh_token, rol_activo_id, ip_origen, user_agent, expira_en)
     VALUES ($1, $2, $3, $4, $5, $6);`,
    [idUsuario, refreshToken, rol.id, req.ip ?? null, req.get('user-agent') ?? null, expiraEn],
  );
  return { accessToken, refreshToken };
}

const consultaRolActivo = `
  SELECT c.id_usuario, c.usuario, c.correo, c.activo, c.bloqueado_hasta,
         COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
         r.rol_id AS id, r.codigo, r.nombre, ur.area_id AS "areaId"
    FROM sigd_auth.cuenta_usuario c
    JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario
    JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
    LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
   WHERE c.id_usuario = $1 AND r.rol_id = $2
     AND ur.vigente_desde <= now()
     AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
   LIMIT 1;`;

export function crearRouterAuth(pool: Pool): Router {
  const router = Router();

  router.post('/auth/login', async (req: Request, res: Response) => {
    const datos = loginSchema.parse(req.body);
    const resultado = await pool.query(
      `SELECT c.id_usuario, c.id_persona, c.usuario, c.correo, c.password_hash,
              c.activo, c.bloqueado_hasta,
              COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
              COALESCE(rv.roles, '[]'::jsonb) AS roles
         FROM sigd_auth.cuenta_usuario c
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
         LEFT JOIN LATERAL (
           SELECT jsonb_agg(jsonb_build_object('id', r.rol_id, 'codigo', r.codigo,
                    'nombre', r.nombre, 'areaId', ur.area_id)
                    ORDER BY r.codigo, ur.area_id NULLS FIRST) AS roles
             FROM sigd_org.usuario_rol ur
             JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
            WHERE ur.id_usuario = c.id_usuario
              AND ur.vigente_desde <= now()
              AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
         ) rv ON TRUE
        WHERE (c.usuario = $1 OR c.correo = $1)
        LIMIT 1;`,
      [datos.identificador.trim()],
    );
    const usuario = resultado.rows[0];
    if (!usuario) throw new UnauthorizedError({ detail: 'Credenciales inválidas. Verifique su usuario o contraseña institucional.' });
    asegurarCuentaHabilitada(usuario);
    if (!(await Argon2Service.verify(usuario.password_hash, datos.password))) {
      throw new UnauthorizedError({ detail: 'Credenciales inválidas. Verifique su usuario o contraseña institucional.' });
    }

    const roles = normalizarRoles(usuario.roles);
    if (roles.length === 0) {
      throw new AppError({ status: 403, code: 'ACCOUNT_WITHOUT_ACTIVE_ROLES', message: 'La cuenta no tiene perfiles activos.', detail: 'Solicite al administrador la asignación de un rol institucional vigente.' });
    }
    const usuarioBase = { id: usuario.id_usuario, nombreCompleto: usuario.nombre_completo, correo: usuario.correo };
    if (roles.length > 1) {
      return res.status(200).json({
        requiereSeleccionPerfil: true,
        tokenSeleccionPerfil: firmarTokenSeleccionPerfil({ sub: usuario.id_usuario, rolesDisponibles: roles.map((rol) => rol.id) }),
        rolesDisponibles: roles,
        usuario: usuarioBase,
      });
    }

    const rol = roles[0];
    const tokens = await crearSesion(pool, req, usuario.id_usuario, rol);
    return res.status(200).json({
      ...tokens,
      requiereSeleccionPerfil: false,
      usuario: { ...usuarioBase, rol: rol.codigo, roles: [rol.codigo], areaId: rol.areaId ?? undefined },
    });
  });

  router.post('/auth/seleccionar-perfil', async (req: Request, res: Response) => {
    const datos = seleccionPerfilSchema.parse(req.body);
    const claims = verificarTokenSeleccionPerfil(datos.tokenSeleccionPerfil);
    if (!claims.rolesDisponibles.includes(datos.rolId)) {
      throw new UnauthorizedError({ detail: 'El perfil solicitado no pertenece a la autenticación actual.' });
    }
    const resultado = await pool.query(consultaRolActivo, [claims.sub, datos.rolId]);
    const usuarioRol = resultado.rows[0];
    if (!usuarioRol) throw new UnauthorizedError({ detail: 'El perfil ya no se encuentra asignado o vigente.' });
    asegurarCuentaHabilitada(usuarioRol);
    const tokens = await crearSesion(pool, req, usuarioRol.id_usuario, usuarioRol as RolDisponible);
    return res.status(200).json({
      ...tokens,
      usuario: { id: usuarioRol.id_usuario, nombreCompleto: usuarioRol.nombre_completo, correo: usuarioRol.correo,
        rol: usuarioRol.codigo, roles: [usuarioRol.codigo], areaId: usuarioRol.areaId ?? undefined },
    });
  });

  router.post('/auth/logout', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await pool.query(`UPDATE sigd_auth.sesion_usuario SET revocado_en = now() WHERE refresh_token = $1 AND revocado_en IS NULL;`, [refreshToken]);
    res.status(200).json({ ok: true, mensaje: 'Sesión cerrada correctamente' });
  });

  router.post('/auth/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const resultado = await client.query(
        `SELECT s.id_usuario, s.rol_activo_id, s.expira_en, s.revocado_en,
                c.activo, c.bloqueado_hasta, r.codigo, r.nombre, ur.area_id AS "areaId"
           FROM sigd_auth.sesion_usuario s
           JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = s.id_usuario
           JOIN sigd_org.usuario_rol ur ON ur.id_usuario = s.id_usuario AND ur.rol_id = s.rol_activo_id
           JOIN sigd_org.rol_sistema r ON r.rol_id = s.rol_activo_id AND r.vigente = TRUE
          WHERE s.refresh_token = $1
            AND ur.vigente_desde <= now()
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
          LIMIT 1
          FOR UPDATE OF s;`,
        [refreshToken],
      );
      const sesion = resultado.rows[0];
      if (!sesion || sesion.revocado_en !== null || new Date(sesion.expira_en) < new Date()) {
        throw new UnauthorizedError({ detail: 'El token de refresco o su perfil activo son inválidos o han expirado.' });
      }
      asegurarCuentaHabilitada(sesion);
      await client.query(
        `UPDATE sigd_auth.sesion_usuario SET revocado_en = now() WHERE refresh_token = $1 AND revocado_en IS NULL;`,
        [refreshToken],
      );
      const tokens = await crearSesion(client, req, sesion.id_usuario,
        { id: sesion.rol_activo_id, codigo: sesion.codigo, nombre: sesion.nombre, areaId: sesion.areaId });
      await client.query('COMMIT');
      return res.status(200).json(tokens);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  router.post('/auth/cambiar-perfil', async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    const claims = verificarTokenAcceso(token);
    if (claims.roles.length !== 1) throw new UnauthorizedError({ detail: 'La sesión no contiene un único perfil activo.' });
    const datos = cambioPerfilSchema.parse(req.body);
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const sesionResultado = await client.query(
        `SELECT id_usuario, expira_en, revocado_en FROM sigd_auth.sesion_usuario WHERE refresh_token = $1 FOR UPDATE;`,
        [datos.refreshToken],
      );
      const sesion = sesionResultado.rows[0];
      if (!sesion || sesion.id_usuario !== claims.sub || sesion.revocado_en !== null || new Date(sesion.expira_en) < new Date()) {
        throw new UnauthorizedError({ detail: 'La sesión utilizada para cambiar de perfil no es válida.' });
      }
      const rolResultado = await client.query(consultaRolActivo, [claims.sub, datos.rolId]);
      const usuarioRol = rolResultado.rows[0];
      if (!usuarioRol) throw new UnauthorizedError({ detail: 'El perfil solicitado no está asignado o vigente.' });
      asegurarCuentaHabilitada(usuarioRol);
      await client.query(`UPDATE sigd_auth.sesion_usuario SET revocado_en = now() WHERE refresh_token = $1;`, [datos.refreshToken]);
      const tokens = await crearSesion(client, req, claims.sub, usuarioRol as RolDisponible);
      await client.query('COMMIT');
      return res.status(200).json({
        ...tokens,
        usuario: { id: usuarioRol.id_usuario, nombreCompleto: usuarioRol.nombre_completo, correo: usuarioRol.correo,
          rol: usuarioRol.codigo, roles: [usuarioRol.codigo], areaId: usuarioRol.areaId ?? undefined },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  const handlerPerfil = async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    const claims = verificarTokenAcceso(token);
    if (claims.roles.length !== 1) throw new UnauthorizedError({ detail: 'El token debe autorizar exactamente un perfil activo.' });
    const resultado = await pool.query(
      `SELECT c.id_usuario, c.usuario, c.correo, c.activo, c.bloqueado_hasta,
              COALESCE(pn.nombre_completo, pj.razon_social, c.usuario) AS nombre_completo,
              p.cargo_id, p.telefono, activo.area_id,
              COALESCE(rv.roles, '[]'::jsonb) AS roles_disponibles
         FROM sigd_auth.cuenta_usuario c
         JOIN sigd_org.usuario_rol activo ON activo.id_usuario = c.id_usuario
         JOIN sigd_org.rol_sistema rol_activo ON rol_activo.rol_id = activo.rol_id AND rol_activo.vigente = TRUE
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
         LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = c.id_usuario
         LEFT JOIN LATERAL (
           SELECT jsonb_agg(jsonb_build_object('id', r.rol_id, 'codigo', r.codigo, 'nombre', r.nombre, 'areaId', ur.area_id)
                    ORDER BY r.codigo, ur.area_id NULLS FIRST) AS roles
             FROM sigd_org.usuario_rol ur
             JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
            WHERE ur.id_usuario = c.id_usuario AND ur.vigente_desde <= now()
              AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
         ) rv ON TRUE
        WHERE c.id_usuario = $1 AND rol_activo.codigo = $2
          AND activo.vigente_desde <= now()
          AND (activo.vigente_hasta IS NULL OR activo.vigente_hasta > now())
        LIMIT 1;`,
      [claims.sub, claims.roles[0]],
    );
    const usuario = resultado.rows[0];
    if (!usuario) throw new UnauthorizedError({ detail: 'Usuario o perfil activo no encontrado.' });
    asegurarCuentaHabilitada(usuario);
    res.status(200).json({
      id: usuario.id_usuario, usuario: usuario.usuario, username: usuario.usuario,
      nombreCompleto: usuario.nombre_completo, correo: usuario.correo,
      rol: claims.roles[0], roles: [claims.roles[0]], rolesDisponibles: normalizarRoles(usuario.roles_disponibles),
      areaId: usuario.area_id, cargoId: usuario.cargo_id, telefono: usuario.telefono,
    });
  };

  router.get('/auth/me', handlerPerfil);
  router.get('/auth/perfil', handlerPerfil);
  return router;
}

export default crearRouterAuth;
