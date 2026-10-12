import type { Pool, PoolClient, QueryResultRow } from 'pg';

import { AppError, NotFoundError } from '../../shared/domain/errors/index.js';
import type {
  ActualizarUsuarioAdminDTO,
  CrearUsuarioAdminDTO,
  ListarUsuariosQuery,
} from './dto/usuarioAdmin.dto.js';

export interface ReferenciaCatalogo {
  id: string;
  nombre: string;
}

export interface UsuarioDirectorio extends QueryResultRow {
  id: string;
  idPersona: string;
  nombre: string;
  documento: string;
  correo: string;
  area: ReferenciaCatalogo | null;
  cargo: ReferenciaCatalogo | null;
  rol: ReferenciaCatalogo | null;
  estado: 'ACTIVO' | 'INACTIVO';
  ultimoAcceso: Date | null;
}

export interface ResultadoUsuariosPaginado {
  datos: UsuarioDirectorio[];
  paginacion: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
}

type Consultable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const PROYECCION_USUARIO = `
  SELECT
    cu.id_usuario AS id,
    cu.id_persona AS "idPersona",
    pn.nombre_completo AS nombre,
    p.id_documento AS documento,
    cu.correo,
    CASE WHEN a.area_id IS NULL THEN NULL
      ELSE jsonb_build_object('id', a.area_id, 'nombre', a.nombre) END AS area,
    CASE WHEN c.cargo_id IS NULL THEN NULL
      ELSE jsonb_build_object('id', c.cargo_id, 'nombre', c.nombre) END AS cargo,
    CASE WHEN rs.rol_id IS NULL THEN NULL
      ELSE jsonb_build_object('id', rs.rol_id, 'nombre', rs.nombre) END AS rol,
    CASE WHEN cu.activo THEN 'ACTIVO' ELSE 'INACTIVO' END AS estado,
    cu.ultimo_acceso AS "ultimoAcceso"
  FROM sigd_auth.cuenta_usuario AS cu
  INNER JOIN sigd_auth.persona AS p ON p.id_persona = cu.id_persona
  LEFT JOIN sigd_auth.persona_natural AS pn ON pn.id_persona = p.id_persona
  LEFT JOIN LATERAL (
    SELECT asignacion.area_id, asignacion.cargo_id
    FROM sigd_org.asignacion_personal AS asignacion
    WHERE asignacion.id_usuario = cu.id_usuario
      AND asignacion.vigente_desde <= now()
      AND (asignacion.vigente_hasta IS NULL OR asignacion.vigente_hasta > now())
    ORDER BY asignacion.vigente_desde DESC
    LIMIT 1
  ) AS ap ON TRUE
  LEFT JOIN sigd_org.area AS a ON a.area_id = ap.area_id
  LEFT JOIN sigd_org.cargo AS c ON c.cargo_id = ap.cargo_id
  LEFT JOIN LATERAL (
    SELECT relacion.rol_id
    FROM sigd_org.usuario_rol AS relacion
    WHERE relacion.id_usuario = cu.id_usuario
      AND relacion.vigente_desde <= now()
      AND (relacion.vigente_hasta IS NULL OR relacion.vigente_hasta > now())
    ORDER BY relacion.vigente_desde DESC
    LIMIT 1
  ) AS ur ON TRUE
  LEFT JOIN sigd_org.rol_sistema AS rs ON rs.rol_id = ur.rol_id
`;

async function obtenerUsuario(
  db: Consultable,
  usuarioId: string,
): Promise<UsuarioDirectorio> {
  const resultado = await db.query<UsuarioDirectorio>(
    `${PROYECCION_USUARIO} WHERE cu.id_usuario = $1`,
    [usuarioId],
  );
  const usuario = resultado.rows[0];
  if (!usuario) {
    throw new NotFoundError({ message: 'El usuario indicado no existe.' });
  }
  return usuario;
}

export function crearUsuariosAdminService(pool: Pool) {
  async function listarUsuarios(
    filtros: ListarUsuariosQuery,
  ): Promise<ResultadoUsuariosPaginado> {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];
    const agregar = (valor: unknown): string => {
      parametros.push(valor);
      return `$${parametros.length}`;
    };

    if (filtros.busqueda) {
      const parametro = agregar(filtros.busqueda.trim());
      condiciones.push(`(
        to_tsvector('spanish', concat_ws(' ', pn.nombres, pn.apellidos, p.id_documento, cu.correo))
          @@ websearch_to_tsquery('spanish', ${parametro})
        OR p.id_documento ILIKE '%' || ${parametro} || '%'
        OR cu.correo ILIKE '%' || ${parametro} || '%'
      )`);
    }
    if (filtros.areaId) condiciones.push(`ap.area_id = ${agregar(filtros.areaId)}`);
    if (filtros.rolId) condiciones.push(`ur.rol_id = ${agregar(filtros.rolId)}`);
    if (filtros.estado === 'ACTIVO') condiciones.push('cu.activo = TRUE');
    if (filtros.estado === 'INACTIVO') condiciones.push('cu.activo = FALSE');

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const parametrosConteo = [...parametros];
    const limite = agregar(filtros.limite);
    const offset = agregar((filtros.pagina - 1) * filtros.limite);

    const [datos, conteo] = await Promise.all([
      pool.query<UsuarioDirectorio>(
        `${PROYECCION_USUARIO} ${where} ORDER BY nombre ASC LIMIT ${limite} OFFSET ${offset}`,
        parametros,
      ),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM (${PROYECCION_USUARIO} ${where}) AS directorio`,
        parametrosConteo,
      ),
    ]);

    const total = conteo.rows[0]?.total ?? 0;
    return {
      datos: datos.rows,
      paginacion: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        totalPaginas: total === 0 ? 0 : Math.ceil(total / filtros.limite),
      },
    };
  }

  async function crearUsuario(_datos: CrearUsuarioAdminDTO): Promise<never> {
    throw new AppError({
      status: 501,
      code: 'ALTA_USUARIO_NO_IMPLEMENTADA',
      message: 'El alta administrativa de usuarios no forma parte de esta entrega.',
    });
  }

  async function actualizarUsuario(
    usuarioId: string,
    datos: ActualizarUsuarioAdminDTO,
  ): Promise<UsuarioDirectorio> {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const existente = await cliente.query<{ id_usuario: string; id_persona: string }>(
        `SELECT cu.id_usuario, cu.id_persona
         FROM sigd_auth.cuenta_usuario AS cu
         WHERE cu.id_usuario = $1
         FOR UPDATE`,
        [usuarioId],
      );
      const cuenta = existente.rows[0];
      if (!cuenta) throw new NotFoundError({ message: 'El usuario indicado no existe.' });

      if (datos.correo !== undefined || datos.estado !== undefined) {
        await cliente.query(
          `UPDATE sigd_auth.cuenta_usuario
           SET correo = COALESCE($2, correo),
               activo = COALESCE($3, activo)
           WHERE id_usuario = $1`,
          [
            usuarioId,
            datos.correo ?? null,
            datos.estado === undefined ? null : datos.estado === 'ACTIVO',
          ],
        );
      }

      if (datos.nombres !== undefined || datos.apellidos !== undefined || datos.telefono !== undefined) {
        await cliente.query(
          `UPDATE sigd_auth.persona_natural
           SET nombres = COALESCE($2, nombres),
               apellidos = COALESCE($3, apellidos),
               nombre_completo = concat_ws(' ', COALESCE($2, nombres), COALESCE($3, apellidos)),
               telefono = CASE WHEN $5::boolean THEN $4::text ELSE telefono END
           WHERE id_persona = $1`,
          [
            cuenta.id_persona,
            datos.nombres ?? null,
            datos.apellidos ?? null,
            datos.telefono ?? null,
            datos.telefono !== undefined,
          ],
        );
      }

      let asignacionActual: { area_id: string; cargo_id: string } | undefined;
      if (datos.areaId !== undefined || datos.cargoId !== undefined || datos.rolId !== undefined) {
        const resultadoAsignacion = await cliente.query<{ area_id: string; cargo_id: string }>(
          `SELECT area_id, cargo_id
           FROM sigd_org.asignacion_personal
           WHERE id_usuario = $1
             AND vigente_desde <= now()
             AND (vigente_hasta IS NULL OR vigente_hasta > now())
           ORDER BY vigente_desde DESC
           LIMIT 1`,
          [usuarioId],
        );
        asignacionActual = resultadoAsignacion.rows[0];
      }

      if (datos.areaId !== undefined || datos.cargoId !== undefined) {
        const areaId = datos.areaId ?? asignacionActual?.area_id;
        const cargoId = datos.cargoId ?? asignacionActual?.cargo_id;
        if (!areaId || !cargoId) {
          throw new AppError({
            status: 422,
            code: 'ASIGNACION_INCOMPLETA',
            message: 'Se requieren área y cargo para crear la asignación institucional.',
          });
        }
        await cliente.query(
          `UPDATE sigd_org.asignacion_personal
           SET vigente_hasta = now()
           WHERE id_usuario = $1
             AND (vigente_hasta IS NULL OR vigente_hasta > now())`,
          [usuarioId],
        );
        await cliente.query(
          `INSERT INTO sigd_org.asignacion_personal (id_usuario, area_id, cargo_id, vigente_desde)
           VALUES ($1, $2, $3, now())`,
          [usuarioId, areaId, cargoId],
        );
      }

      if (datos.rolId !== undefined) {
        await cliente.query(
          `UPDATE sigd_org.usuario_rol
           SET vigente_hasta = now()
           WHERE id_usuario = $1
             AND (vigente_hasta IS NULL OR vigente_hasta > now())`,
          [usuarioId],
        );
        await cliente.query(
          `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, area_id, vigente_desde)
           VALUES ($1, $2, $3, now())`,
          [usuarioId, datos.rolId, datos.areaId ?? asignacionActual?.area_id ?? null],
        );
      }

      if (datos.estado === 'INACTIVO') {
        await cliente.query(
          `UPDATE sigd_auth.sesion_usuario
           SET revocado_en = now()
           WHERE id_usuario = $1 AND revocado_en IS NULL`,
          [usuarioId],
        );
      }

      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
    return obtenerUsuario(pool, usuarioId);
  }

  async function revocarSesionesUsuario(usuarioId: string): Promise<number> {
    const resultado = await pool.query(
      `UPDATE sigd_auth.sesion_usuario
       SET revocado_en = now()
       WHERE id_usuario = $1 AND revocado_en IS NULL`,
      [usuarioId],
    );
    return resultado.rowCount ?? 0;
  }

  return { listarUsuarios, crearUsuario, actualizarUsuario, revocarSesionesUsuario };
}

export type UsuariosAdminService = ReturnType<typeof crearUsuariosAdminService>;
