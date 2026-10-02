import type { Pool } from "pg";
import { registrarMutacion } from "../../audit/bitacora-auditoria.repository.js";
import type {
  ListarUsuariosQuery,
} from "./dto/usuarioAdmin.dto.js";

/**
 * OrganiCore - Servicio de administración de usuarios
 * Responsable: Leonardo
 * Rama: B_LEONARDO
 *
 * Tareas:
 * - T-BE-OC-06: Directorio institucional de usuarios
 * - T-BE-OC-08: Revocación de sesiones al desactivar usuarios
 */

export interface UsuarioDirectorio {
  id: number;
  nombre: string;
  dni: string;
  correo: string;
  sede: string | null;
  area: string | null;
  cargo: string | null;
  rol: string | null;
  estado: "ACTIVO" | "INACTIVO" | "BLOQUEADO";
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

export function crearUsuariosAdminService(pool: Pool) {
  /**
   * GET /api/v1/admin/usuarios
   *
   * Lista el directorio institucional con:
   * - búsqueda
   * - filtro por área
   * - filtro por sede
   * - filtro por rol
   * - filtro por estado
   * - paginación
   */
  async function listarUsuarios(
    filtros: ListarUsuariosQuery,
  ): Promise<ResultadoUsuariosPaginado> {
    const {
      busqueda,
      areaId,
      sedeId,
      rolId,
      estado,
      pagina,
      limite,
    } = filtros;

    const condiciones: string[] = [];
    const parametros: unknown[] = [];

    function agregarParametro(valor: unknown): string {
      parametros.push(valor);
      return `$${parametros.length}`;
    }

    /**
     * Búsqueda del directorio.
     *
     * Se busca por:
     * - nombres
     * - apellidos
     * - DNI/documento
     * - correo institucional
     */
    if (busqueda && busqueda.trim() !== "") {
      const posicion = agregarParametro(busqueda.trim());

      condiciones.push(`
        (
          to_tsvector(
            'spanish',
            concat_ws(
              ' ',
              p.nombres,
              p.apellido_paterno,
              p.apellido_materno,
              p.numero_documento
            )
          )
          @@ websearch_to_tsquery('spanish', ${posicion})
          OR p.numero_documento ILIKE '%' || ${posicion} || '%'
          OR cu.email_login ILIKE '%' || ${posicion} || '%'
        )
      `);
    }

    if (areaId) {
      const posicion = agregarParametro(areaId);
      condiciones.push(`pl.id_area = ${posicion}`);
    }

    if (sedeId) {
      const posicion = agregarParametro(sedeId);
      condiciones.push(`pl.sede_id = ${posicion}`);
    }

    if (rolId) {
      const posicion = agregarParametro(rolId);
      condiciones.push(`ur.rol_id = ${posicion}`);
    }

    if (estado) {
      if (estado === "ACTIVO") {
        condiciones.push(`
          cu.estado = TRUE
          AND (
            cu.bloqueado_hasta IS NULL
            OR cu.bloqueado_hasta <= now()
          )
        `);
      }

      if (estado === "INACTIVO") {
        condiciones.push(`
          cu.estado = FALSE
        `);
      }

      if (estado === "BLOQUEADO") {
        condiciones.push(`
          cu.estado = TRUE
          AND cu.bloqueado_hasta IS NOT NULL
          AND cu.bloqueado_hasta > now()
        `);
      }
    }

    const where =
      condiciones.length > 0
        ? `WHERE ${condiciones.join(" AND ")}`
        : "";

    const offset = (pagina - 1) * limite;

    const parametroLimite = agregarParametro(limite);
    const parametroOffset = agregarParametro(offset);

    const sqlDatos = `
      SELECT DISTINCT
        cu.id AS id,

        concat_ws(
          ' ',
          p.nombres,
          p.apellido_paterno,
          p.apellido_materno
        ) AS nombre,

        p.numero_documento AS dni,

        cu.email_login AS correo,

        s.nombre AS sede,

        a.nombre AS area,

        c.nombre AS cargo,

        rs.nombre AS rol,

        CASE
          WHEN cu.estado = FALSE THEN 'INACTIVO'
          WHEN cu.bloqueado_hasta IS NOT NULL
               AND cu.bloqueado_hasta > now()
            THEN 'BLOQUEADO'
          ELSE 'ACTIVO'
        END AS estado,

        cu.ultimo_acceso AS "ultimoAcceso"

      FROM sigd_auth.cuenta_usuario AS cu

      INNER JOIN sigd_auth.persona AS p
        ON p.id = cu.persona_id

      LEFT JOIN sigd_org.asignacion_personal AS ap
        ON ap.cuenta_id::text = cu.id::text
        AND ap.activo = TRUE
        AND ap.vigencia @> now()

      LEFT JOIN sigd_org.puesto_laboral AS pl
        ON pl.puesto_laboral_id = ap.puesto_laboral_id
        AND pl.activo = TRUE

      LEFT JOIN sigd_org.sede AS s
        ON s.sede_id = pl.sede_id

      LEFT JOIN sigd_org.area AS a
        ON a.id_area = pl.id_area

      LEFT JOIN sigd_org.cargo AS c
        ON c.cargo_id = pl.cargo_id

      LEFT JOIN sigd_org.usuario_rol AS ur
        ON ur.cuenta_id::text = cu.id::text
        AND ur.vigencia @> now()

      LEFT JOIN sigd_org.rol_sistema AS rs
        ON rs.rol_id = ur.rol_id
        AND rs.activo = TRUE

      ${where}

      ORDER BY nombre ASC

      LIMIT ${parametroLimite}
      OFFSET ${parametroOffset};
    `;

    /**
     * Para contar se usan los mismos filtros,
     * pero sin LIMIT ni OFFSET.
     */
    const parametrosConteo = parametros.slice(0, -2);

    const sqlConteo = `
      SELECT COUNT(DISTINCT cu.id)::int AS total

      FROM sigd_auth.cuenta_usuario AS cu

      INNER JOIN sigd_auth.persona AS p
        ON p.id = cu.persona_id

      LEFT JOIN sigd_org.asignacion_personal AS ap
        ON ap.cuenta_id::text = cu.id::text
        AND ap.activo = TRUE
        AND ap.vigencia @> now()

      LEFT JOIN sigd_org.puesto_laboral AS pl
        ON pl.puesto_laboral_id = ap.puesto_laboral_id
        AND pl.activo = TRUE

      LEFT JOIN sigd_org.usuario_rol AS ur
        ON ur.cuenta_id::text = cu.id::text
        AND ur.vigencia @> now()

      ${where};
    `;

    const [resultadoDatos, resultadoConteo] = await Promise.all([
      pool.query<UsuarioDirectorio>(
        sqlDatos,
        parametros,
      ),
      pool.query<{ total: number }>(
        sqlConteo,
        parametrosConteo,
      ),
    ]);

    const total =
      resultadoConteo.rows[0]?.total ?? 0;

    return {
      datos: resultadoDatos.rows,

      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas:
          total === 0
            ? 0
            : Math.ceil(total / limite),
      },
    };
  }

  /**
   * T-BE-OC-08
   *
   * Revoca todas las sesiones activas almacenadas
   * en PostgreSQL para un usuario.
   *
   * Se usará cuando la cuenta sea:
   * - desactivada
   * - bloqueada administrativamente
   *
   * La integración con Redis queda pendiente
   * hasta que exista la implementación real
   * correspondiente en el backend.
   */
  async function revocarSesionesUsuario(
    usuarioId: number,
  ): Promise<number> {
    const resultado = await pool.query(
      `
        DELETE FROM sigd_auth.sesion_usuario
        WHERE usuario_id = $1
      `,
      [usuarioId],
    );

    return resultado.rowCount ?? 0;
  }

  return {
    listarUsuarios,
    revocarSesionesUsuario,
  };
}

export type UsuariosAdminService =
  ReturnType<typeof crearUsuariosAdminService>;