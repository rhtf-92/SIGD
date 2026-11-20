import type { Pool, PoolClient, QueryResultRow } from 'pg';

import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { AppError, ConflictError, NotFoundError } from '../../shared/domain/errors/index.js';
import { Argon2Service } from '../identicore/argon2.service.js';
import type { ActualizarUsuarioAdminDTO, CrearUsuarioAdminDTO, ListarUsuariosQuery } from './dto/usuarioAdmin.dto.js';

export interface ReferenciaCatalogo { id: string; nombre: string }
export interface UsuarioDirectorio extends QueryResultRow {
  id: string;
  idPersona: string;
  nombre: string;
  nombres?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  documento: string;
  correo: string;
  area: ReferenciaCatalogo | null;
  cargo: ReferenciaCatalogo | null;
  rol: ReferenciaCatalogo | null;
  roles: ReferenciaCatalogo[];
  estado: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
  ultimoAcceso: Date | null;
}
export interface ResultadoUsuariosPaginado {
  datos: UsuarioDirectorio[];
  paginacion: { pagina: number; limite: number; total: number; totalPaginas: number };
}
type Consultable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const PROYECCION_USUARIO = `
  SELECT cu.id_usuario AS id, cu.id_persona AS "idPersona",
    COALESCE(pn.nombre_completo, pj.razon_social, cu.usuario) AS nombre,
    pn.nombres, pn.apellidos, pn.telefono,
    p.id_documento AS documento, cu.correo,
    CASE WHEN a.area_id IS NULL THEN NULL ELSE jsonb_build_object('id', a.area_id, 'nombre', a.nombre) END AS area,
    CASE WHEN c.cargo_id IS NULL THEN NULL ELSE jsonb_build_object('id', c.cargo_id, 'nombre', c.nombre) END AS cargo,
    roles_vigentes.roles -> 0 AS rol, roles_vigentes.roles AS roles,
    CASE WHEN NOT cu.activo THEN 'INACTIVO'
      WHEN cu.bloqueado_hasta IS NOT NULL AND cu.bloqueado_hasta > now() THEN 'BLOQUEADO'
      ELSE 'ACTIVO' END AS estado,
    cu.ultimo_acceso AS "ultimoAcceso"
  FROM sigd_auth.cuenta_usuario AS cu
  INNER JOIN sigd_auth.persona AS p ON p.id_persona = cu.id_persona
  LEFT JOIN sigd_auth.persona_natural AS pn ON pn.id_persona = p.id_persona
  LEFT JOIN sigd_auth.persona_juridica AS pj ON pj.id_persona = p.id_persona
  LEFT JOIN LATERAL (
    SELECT asignacion.area_id, asignacion.cargo_id
    FROM sigd_org.asignacion_personal AS asignacion
    WHERE asignacion.id_usuario = cu.id_usuario AND asignacion.vigente_desde <= now()
      AND (asignacion.vigente_hasta IS NULL OR asignacion.vigente_hasta > now())
    ORDER BY asignacion.vigente_desde DESC LIMIT 1
  ) AS ap ON TRUE
  LEFT JOIN sigd_org.area AS a ON a.area_id = ap.area_id
  LEFT JOIN sigd_org.cargo AS c ON c.cargo_id = ap.cargo_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', rs.rol_id, 'nombre', rs.nombre) ORDER BY rs.nombre), '[]'::jsonb) AS roles
    FROM sigd_org.usuario_rol AS relacion
    INNER JOIN sigd_org.rol_sistema AS rs ON rs.rol_id = relacion.rol_id
    WHERE relacion.id_usuario = cu.id_usuario AND relacion.vigente_desde <= now()
      AND (relacion.vigente_hasta IS NULL OR relacion.vigente_hasta > now()) AND rs.vigente = TRUE
  ) AS roles_vigentes ON TRUE
`;

function esDuplicado(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
async function obtenerUsuario(db: Consultable, usuarioId: string): Promise<UsuarioDirectorio> {
  const resultado = await db.query<UsuarioDirectorio>(`${PROYECCION_USUARIO} WHERE cu.id_usuario = $1`, [usuarioId]);
  const usuario = resultado.rows[0];
  if (!usuario) throw new NotFoundError({ message: 'El usuario indicado no existe.' });
  return usuario;
}
async function validarRoles(cliente: PoolClient, rolIds: string[]): Promise<void> {
  const unicos = [...new Set(rolIds)];
  if (!unicos.length) return;
  const resultado = await cliente.query<{ rol_id: string }>(
    'SELECT rol_id FROM sigd_org.rol_sistema WHERE rol_id = ANY($1::uuid[]) AND vigente = TRUE', [unicos],
  );
  if (resultado.rows.length !== unicos.length) {
    throw new AppError({ status: 422, code: 'ROL_INVALIDO', message: 'Uno o más roles no existen o están inactivos.' });
  }
}

async function resolverRolPorDefectoNoPrivilegiado(cliente: PoolClient): Promise<string> {
  const { rows } = await cliente.query<{ rol_id: string }>(
    `SELECT rol_id
       FROM sigd_org.rol_sistema
      WHERE vigente = TRUE
        AND codigo <> 'ADMINISTRADOR'
      ORDER BY CASE codigo
        WHEN 'ESPECIALISTA' THEN 1
        WHEN 'MESA_PARTES' THEN 2
        WHEN 'SECRETARIO' THEN 3
        WHEN 'CIUDADANO' THEN 4
        ELSE 5
      END, nombre ASC
      LIMIT 1`,
  );
  if (!rows[0]?.rol_id) {
    throw new AppError({
      status: 422,
      code: 'ROL_REQUERIDO',
      message: 'No existe un rol institucional no privilegiado activo para asignar a la nueva cuenta.',
    });
  }
  return rows[0].rol_id;
}

export function crearUsuariosAdminService(pool: Pool) {
  async function listarUsuarios(filtros: ListarUsuariosQuery): Promise<ResultadoUsuariosPaginado> {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];
    const agregar = (valor: unknown) => { parametros.push(valor); return `$${parametros.length}`; };
    if (filtros.busqueda) {
      const p = agregar(filtros.busqueda.trim());
      condiciones.push(
        `(to_tsvector('spanish', concat_ws(' ', pn.nombres, pn.apellidos, pj.razon_social, p.id_documento, cu.correo, a.nombre)) @@ websearch_to_tsquery('spanish', ${p})` +
        ` OR pn.nombre_completo ILIKE '%' || ${p} || '%' OR pj.razon_social ILIKE '%' || ${p} || '%'` +
        ` OR cu.usuario ILIKE '%' || ${p} || '%' OR p.id_documento ILIKE '%' || ${p} || '%'` +
        ` OR cu.correo ILIKE '%' || ${p} || '%' OR a.nombre ILIKE '%' || ${p} || '%')`,
      );
    }
    if (filtros.areaId) condiciones.push(`ap.area_id = ${agregar(filtros.areaId)}`);
    if (filtros.rolId) condiciones.push(`EXISTS (SELECT 1 FROM sigd_org.usuario_rol filtro_rol WHERE filtro_rol.id_usuario = cu.id_usuario AND filtro_rol.rol_id = ${agregar(filtros.rolId)} AND filtro_rol.vigente_desde <= now() AND (filtro_rol.vigente_hasta IS NULL OR filtro_rol.vigente_hasta > now()))`);
    if (filtros.estado === 'ACTIVO') condiciones.push('cu.activo = TRUE AND (cu.bloqueado_hasta IS NULL OR cu.bloqueado_hasta <= now())');
    else if (filtros.estado === 'INACTIVO') condiciones.push('cu.activo = FALSE');
    else if (filtros.estado === 'BLOQUEADO') condiciones.push('cu.activo = TRUE AND cu.bloqueado_hasta > now()');
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const parametrosConteo = [...parametros];
    const limite = agregar(filtros.limite);
    const offset = agregar((filtros.pagina - 1) * filtros.limite);
    const [datos, conteo] = await Promise.all([
      pool.query<UsuarioDirectorio>(`${PROYECCION_USUARIO} ${where} ORDER BY nombre ASC LIMIT ${limite} OFFSET ${offset}`, parametros),
      pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM (${PROYECCION_USUARIO} ${where}) AS directorio`, parametrosConteo),
    ]);
    const total = conteo.rows[0]?.total ?? 0;
    return { datos: datos.rows, paginacion: { pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: total ? Math.ceil(total / filtros.limite) : 0 } };
  }

  async function crearUsuario(datos: CrearUsuarioAdminDTO): Promise<UsuarioDirectorio> {
    const cliente = await pool.connect();
    try {
      const correoNormalizado = datos.correo.trim().toLowerCase();
      const documentoNormalizado = datos.numeroDocumento.trim();
      const passwordHash = await Argon2Service.hash(datos.passwordInicial);
      await cliente.query('BEGIN');

      const rolesSolicitados = [...new Set([...(datos.rolIds ?? []), ...(datos.rolId ? [datos.rolId] : [])])];
      if (rolesSolicitados.length > 0) {
        await validarRoles(cliente, rolesSolicitados);
      }
      const rolesAsignar = rolesSolicitados.length > 0
        ? rolesSolicitados
        : [await resolverRolPorDefectoNoPrivilegiado(cliente)];

      const persona = await cliente.query<{ id_persona: string }>(
        'INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ($1, $2) RETURNING id_persona',
        [datos.tipo, documentoNormalizado],
      );
      const idPersona = persona.rows[0].id_persona;
      if (datos.tipo === 'JURIDICA') {
        await cliente.query('INSERT INTO sigd_auth.persona_juridica (id_persona, razon_social) VALUES ($1, $2)', [idPersona, `${datos.nombres} ${datos.apellidos}`.trim()]);
      } else {
        await cliente.query(
          `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [idPersona, datos.nombres.trim(), datos.apellidos.trim(), `${datos.nombres.trim()} ${datos.apellidos.trim()}`.trim(), correoNormalizado, datos.telefono?.trim() || null],
        );
      }
      const cuenta = await cliente.query<{ id_usuario: string }>(
        `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash)
         VALUES ($1, $2, $3, $4) RETURNING id_usuario`,
        [idPersona, documentoNormalizado, correoNormalizado, passwordHash],
      );
      const usuarioId = cuenta.rows[0].id_usuario;
      await cliente.query('INSERT INTO sigd_org.asignacion_personal (id_usuario, area_id, cargo_id) VALUES ($1, $2, $3)', [usuarioId, datos.areaId, datos.cargoId]);
      await cliente.query(
        `INSERT INTO sigd_auth.perfil_usuario (id_usuario, area_id, cargo_id, telefono)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_usuario) DO UPDATE
           SET area_id = EXCLUDED.area_id,
               cargo_id = EXCLUDED.cargo_id,
               telefono = COALESCE(EXCLUDED.telefono, sigd_auth.perfil_usuario.telefono),
               actualizado_en = now()`,
        [usuarioId, datos.areaId, datos.cargoId, datos.telefono?.trim() || null],
      );
      await cliente.query(
        `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, area_id)
         SELECT $1, nuevo_rol, $3 FROM unnest($2::uuid[]) AS nuevo_rol`,
        [usuarioId, rolesAsignar, datos.areaId],
      );
      await registrarMutacion(cliente, {
        esquema: 'sigd_auth',
        tabla: 'cuenta_usuario',
        operacion: 'INSERT',
        datos_antes: null,
        datos_despues: {
          evento: 'CORRECTO',
          accion: 'USUARIO_CREADO',
          id_usuario: usuarioId,
          usuario: documentoNormalizado,
          correo: correoNormalizado,
          area_id: datos.areaId,
          cargo_id: datos.cargoId,
          rol_ids: rolesAsignar,
        },
      });
      await cliente.query('COMMIT');
      return await obtenerUsuario(pool, usuarioId);
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      if (esDuplicado(error)) throw new ConflictError({ code: 'USUARIO_DUPLICADO', message: 'El documento, usuario o correo ya está registrado.' });
      throw error;
    } finally { cliente.release(); }
  }

  async function actualizarUsuario(usuarioId: string, datos: ActualizarUsuarioAdminDTO): Promise<UsuarioDirectorio> {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const existente = await cliente.query<{
        id_usuario: string;
        id_persona: string;
        correo?: string;
        activo?: boolean;
        bloqueado_hasta?: Date | string | null;
      }>(
        'SELECT id_usuario, id_persona, correo, activo, bloqueado_hasta FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1 FOR UPDATE', [usuarioId],
      );
      const cuenta = existente.rows[0];
      if (!cuenta) throw new NotFoundError({ message: 'El usuario indicado no existe.' });
      const correoNormalizado = datos.correo?.trim().toLowerCase() ?? null;
      if (datos.correo !== undefined || datos.estado !== undefined) {
        await cliente.query(
          `UPDATE sigd_auth.cuenta_usuario SET correo = COALESCE($2, correo),
             activo = CASE WHEN $3::text IS NULL THEN activo WHEN $3 = 'INACTIVO' THEN FALSE ELSE TRUE END,
             bloqueado_hasta = CASE WHEN $3::text IS NULL THEN bloqueado_hasta WHEN $3 = 'BLOQUEADO' THEN 'infinity'::timestamptz ELSE NULL END,
             intentos_fallidos = CASE WHEN $3 = 'ACTIVO' THEN 0 ELSE intentos_fallidos END WHERE id_usuario = $1`,
          [usuarioId, correoNormalizado, datos.estado ?? null],
        );
      }
      if (datos.nombres !== undefined || datos.apellidos !== undefined || datos.telefono !== undefined || datos.correo !== undefined) {
        await cliente.query(
          `UPDATE sigd_auth.persona_natural SET nombres = COALESCE($2, nombres), apellidos = COALESCE($3, apellidos),
             nombre_completo = concat_ws(' ', COALESCE($2, nombres), COALESCE($3, apellidos)),
             correo = COALESCE($6, correo),
             telefono = CASE WHEN $5::boolean THEN $4::text ELSE telefono END WHERE id_persona = $1`,
          [cuenta.id_persona, datos.nombres ?? null, datos.apellidos ?? null, datos.telefono ?? null, datos.telefono !== undefined, correoNormalizado],
        );
      }
      let asignacion: { area_id: string; cargo_id: string } | undefined;
      if (datos.areaId !== undefined || datos.cargoId !== undefined || datos.rolId || datos.rolesAgregar?.length) {
        const actual = await cliente.query<{ area_id: string; cargo_id: string }>(
          `SELECT area_id, cargo_id FROM sigd_org.asignacion_personal WHERE id_usuario = $1 AND vigente_desde <= now()
           AND (vigente_hasta IS NULL OR vigente_hasta > now()) ORDER BY vigente_desde DESC LIMIT 1`, [usuarioId],
        );
        asignacion = actual.rows[0];
      }
      if (datos.areaId !== undefined || datos.cargoId !== undefined) {
        const areaId = datos.areaId ?? asignacion?.area_id;
        const cargoId = datos.cargoId ?? asignacion?.cargo_id;
        if (!areaId || !cargoId) throw new AppError({ status: 422, code: 'ASIGNACION_INCOMPLETA', message: 'Se requieren área y cargo.' });
        await cliente.query(`UPDATE sigd_org.asignacion_personal SET vigente_hasta = now() WHERE id_usuario = $1 AND (vigente_hasta IS NULL OR vigente_hasta > now())`, [usuarioId]);
        await cliente.query('INSERT INTO sigd_org.asignacion_personal (id_usuario, area_id, cargo_id) VALUES ($1, $2, $3)', [usuarioId, areaId, cargoId]);
        await cliente.query(
          `INSERT INTO sigd_auth.perfil_usuario (id_usuario, area_id, cargo_id, telefono)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id_usuario) DO UPDATE
             SET area_id = EXCLUDED.area_id,
                 cargo_id = EXCLUDED.cargo_id,
                 telefono = COALESCE(EXCLUDED.telefono, sigd_auth.perfil_usuario.telefono),
                 actualizado_en = now()`,
          [usuarioId, areaId, cargoId, datos.telefono ?? null],
        );
      }
      const rolesAgregar = [...new Set([...(datos.rolesAgregar ?? []), ...(datos.rolId ? [datos.rolId] : [])])];
      const rolesQuitar = [...new Set(datos.rolesQuitar ?? [])];
      await validarRoles(cliente, rolesAgregar);
      if (rolesQuitar.length) {
        await cliente.query(`UPDATE sigd_org.usuario_rol SET vigente_hasta = now() WHERE id_usuario = $1 AND rol_id = ANY($2::uuid[]) AND vigente_desde <= now() AND (vigente_hasta IS NULL OR vigente_hasta > now())`, [usuarioId, rolesQuitar]);
      }
      if (rolesAgregar.length) {
        await cliente.query(
          `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, area_id)
           SELECT $1, nuevo_rol, $3 FROM unnest($2::uuid[]) AS nuevo_rol WHERE NOT EXISTS (
             SELECT 1 FROM sigd_org.usuario_rol actual WHERE actual.id_usuario = $1 AND actual.rol_id = nuevo_rol
             AND actual.vigente_desde <= now() AND (actual.vigente_hasta IS NULL OR actual.vigente_hasta > now()))`,
          [usuarioId, rolesAgregar, datos.areaId ?? asignacion?.area_id ?? null],
        );
      }
      if (rolesAgregar.length || rolesQuitar.length) {
        const vigentes = await cliente.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM sigd_org.usuario_rol WHERE id_usuario = $1 AND vigente_desde <= now()
           AND (vigente_hasta IS NULL OR vigente_hasta > now())`, [usuarioId],
        );
        if ((vigentes.rows[0]?.total ?? 0) < 1) throw new AppError({ status: 422, code: 'USUARIO_SIN_ROLES', message: 'El usuario debe conservar al menos un rol activo.' });
      }
      if (datos.estado === 'INACTIVO' || datos.estado === 'BLOQUEADO') {
        await cliente.query(`UPDATE sigd_auth.sesion_usuario SET revocado_en = now() WHERE id_usuario = $1 AND revocado_en IS NULL`, [usuarioId]);
      }
      const accionAuditoria = datos.estado === 'BLOQUEADO'
        ? 'USUARIO_BLOQUEADO'
        : datos.estado === 'INACTIVO'
          ? 'USUARIO_DESACTIVADO'
          : datos.estado === 'ACTIVO' && (cuenta.bloqueado_hasta || cuenta.activo === false)
            ? 'USUARIO_ACTIVADO_O_DESBLOQUEADO'
            : 'USUARIO_ACTUALIZADO';
      await registrarMutacion(cliente, {
        esquema: 'sigd_auth',
        tabla: 'cuenta_usuario',
        operacion: 'UPDATE',
        datos_antes: {
          id_usuario: usuarioId,
          correo: cuenta.correo ?? null,
          activo: cuenta.activo ?? null,
          bloqueado_hasta: cuenta.bloqueado_hasta ?? null,
        },
        datos_despues: {
          evento: 'CORRECTO',
          accion: accionAuditoria,
          id_usuario: usuarioId,
          correo: correoNormalizado ?? cuenta.correo ?? null,
          estado: datos.estado ?? null,
          area_id: datos.areaId ?? asignacion?.area_id ?? null,
          cargo_id: datos.cargoId ?? asignacion?.cargo_id ?? null,
          roles_agregar: rolesAgregar,
          roles_quitar: rolesQuitar,
        },
      });
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      if (esDuplicado(error)) throw new ConflictError({ code: 'USUARIO_DUPLICADO', message: 'El correo ya está registrado.' });
      throw error;
    } finally { cliente.release(); }
    return obtenerUsuario(pool, usuarioId);
  }

  async function revocarSesionesUsuario(usuarioId: string): Promise<number> {
    const resultado = await pool.query(`UPDATE sigd_auth.sesion_usuario SET revocado_en = now() WHERE id_usuario = $1 AND revocado_en IS NULL`, [usuarioId]);
    return resultado.rowCount ?? 0;
  }
  return { listarUsuarios, crearUsuario, actualizarUsuario, revocarSesionesUsuario };
}
export type UsuariosAdminService = ReturnType<typeof crearUsuariosAdminService>;
