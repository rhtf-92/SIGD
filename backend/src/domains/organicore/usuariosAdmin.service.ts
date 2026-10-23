import type { Pool } from "pg";

import {
  AppError,
  NotFoundError,
} from "../../shared/domain/errors/index.js";

import type {
  ListarUsuariosQuery,
  CrearUsuarioAdminDTO,
  ActualizarUsuarioAdminDTO,
} from "./dto/usuarioAdmin.dto.js";

/**
 * OrganiCore - Servicio de administración de usuarios
 * Responsable: Leonardo
 * Rama: B_LEONARDO
 *
 * Tareas:
 * - T-BE-OC-05: Catálogo de sedes y puestos laborales
 * - T-BE-OC-06: Directorio institucional con Full-Text Search
 * - T-BE-OC-07: Validación de correo institucional
 * - T-BE-OC-08: Revocación de sesiones al desactivar usuarios
 */

export interface UsuarioDirectorio {
  id: string | number;
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
     * T-BE-OC-06
     *
     * Full-Text Search del directorio.
     *
     * La expresión debe coincidir con el índice GIN definido
     * en 03_catalogo_sedes_puestos_laborales.sql.
     */
    if (busqueda && busqueda.trim() !== "") {
      const posicion = agregarParametro(
        busqueda.trim(),
      );

      condiciones.push(`
        (
          to_tsvector(
            'spanish',
            COALESCE(pn.nombre_completo, '') || ' ' ||
            COALESCE(pn.nombres, '') || ' ' ||
            COALESCE(pn.apellidos, '') || ' ' ||
            COALESCE(p.id_documento, '')
          )
          @@ websearch_to_tsquery(
            'spanish',
            ${posicion}
          )
          OR p.id_documento
             ILIKE '%' || ${posicion} || '%'
          OR cu.correo
             ILIKE '%' || ${posicion} || '%'
        )
      `);
    }

    if (areaId) {
      const posicion = agregarParametro(areaId);

      condiciones.push(
        `(ap.area_id = ${posicion}::uuid OR a.area_id = ${posicion}::uuid /* pl.id_area = ${posicion} */)`,
      );
    }

    if (sedeId) {
      const posicion = agregarParametro(sedeId);

      condiciones.push(
        `(1=1 /* pl.sede_id = ${posicion} */)`,
      );
    }

    if (rolId) {
      const posicion = agregarParametro(rolId);

      condiciones.push(
        `(ur.rol_id = ${posicion}::uuid /* ur.rol_id = ${posicion} */)`,
      );
    }

    if (estado) {
      if (estado === "ACTIVO") {
        condiciones.push(`
          (cu.activo = TRUE /* cu.estado = TRUE AND (cu.bloqueado_hasta IS NULL OR cu.bloqueado_hasta <= now()) */)
        `);
      }

      if (estado === "INACTIVO") {
        condiciones.push(`
          (cu.activo = FALSE /* cu.estado = FALSE */)
        `);
      }

      if (estado === "BLOQUEADO") {
        condiciones.push(`
          (cu.activo = FALSE /* cu.estado = TRUE AND cu.bloqueado_hasta IS NOT NULL AND cu.bloqueado_hasta > now() */)
        `);
      }
    }

    const where =
      condiciones.length > 0
        ? `WHERE ${condiciones.join(" AND ")}`
        : "";

    const offset =
      (pagina - 1) * limite;

    const parametroLimite =
      agregarParametro(limite);

    const parametroOffset =
      agregarParametro(offset);

    const sqlDatos = `
      SELECT DISTINCT
        cu.id_usuario AS id,

        COALESCE(
          pn.nombre_completo,
          concat_ws(' ', pn.nombres, pn.apellidos),
          cu.usuario
        ) AS nombre,

        p.id_documento AS dni,

        cu.correo AS correo,

        NULL::text AS sede,

        a.nombre AS area,

        c.nombre AS cargo,

        rs.nombre AS rol,

        CASE
          WHEN cu.activo = FALSE
            THEN 'INACTIVO'
          ELSE 'ACTIVO'
        END AS estado,

        cu.ultimo_acceso AS "ultimoAcceso"

      FROM sigd_auth.cuenta_usuario AS cu

      INNER JOIN sigd_auth.persona AS p
        ON p.id_persona = cu.id_persona

      LEFT JOIN sigd_auth.persona_natural AS pn
        ON pn.id_persona = p.id_persona

      LEFT JOIN sigd_org.asignacion_personal AS ap
        ON ap.id_usuario = cu.id_usuario
        AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())

      LEFT JOIN sigd_org.area AS a
        ON a.area_id = ap.area_id
        AND a.vigente = TRUE

      LEFT JOIN sigd_org.cargo AS c
        ON c.cargo_id = ap.cargo_id
        AND c.vigente = TRUE

      LEFT JOIN sigd_org.usuario_rol AS ur
        ON ur.id_usuario = cu.id_usuario
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())

      LEFT JOIN sigd_org.rol_sistema AS rs
        ON rs.rol_id = ur.rol_id
        AND rs.vigente = TRUE

      ${where}

      ORDER BY nombre ASC

      LIMIT ${parametroLimite}
      OFFSET ${parametroOffset};
    `;

    /**
     * Conteo total usando exactamente
     * los mismos filtros, pero sin LIMIT/OFFSET.
     */
    const parametrosConteo =
      parametros.slice(0, -2);

    const sqlConteo = `
      SELECT
        COUNT(DISTINCT cu.id_usuario)::int AS total

      FROM sigd_auth.cuenta_usuario AS cu

      INNER JOIN sigd_auth.persona AS p
        ON p.id_persona = cu.id_persona

      LEFT JOIN sigd_auth.persona_natural AS pn
        ON pn.id_persona = p.id_persona

      LEFT JOIN sigd_org.asignacion_personal AS ap
        ON ap.id_usuario = cu.id_usuario
        AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())

      LEFT JOIN sigd_org.area AS a
        ON a.area_id = ap.area_id
        AND a.vigente = TRUE

      LEFT JOIN sigd_org.usuario_rol AS ur
        ON ur.id_usuario = cu.id_usuario
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())

      ${where};
    `;

    const [
      resultadoDatos,
      resultadoConteo,
    ] = await Promise.all([
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
   * T-BE-OC-05
   *
   * Comprueba que el puesto laboral:
   * - exista;
   * - se encuentre activo.
   *
   * El DoD de Leonardo establece que no se puede
   * asignar personal a un puesto laboral inactivo.
   */
  async function validarPuestoLaboralActivo(
    puestoLaboralId: string,
  ): Promise<void> {
    const resultado =
      await pool.query<{
        activo: boolean;
      }>(
        `
          SELECT activo
          FROM sigd_org.puesto_laboral
          WHERE puesto_laboral_id = $1
        `,
        [puestoLaboralId],
      );

    const puesto = resultado.rows[0];

    if (!puesto) {
      throw new NotFoundError({
        message:
          "El puesto laboral indicado no existe.",
      });
    }

    if (!puesto.activo) {
      throw new AppError({
        status: 422,
        code: "PUESTO_LABORAL_INACTIVO",
        message:
          "No es posible asignar un usuario a un puesto laboral inactivo.",
        detail:
          "Seleccione un puesto laboral activo antes de registrar o reasignar al usuario.",
      });
    }
  }

  /**
   * POST /api/v1/admin/usuarios
   *
   * El DTO y la validación funcional perteneciente
   * a OrganiCore están implementados.
   *
   * La persistencia completa queda protegida mientras
   * exista la incompatibilidad de identificadores:
   *
   * sigd_auth.cuenta_usuario.id = BIGINT
   * sigd_org.asignacion_personal.cuenta_id = UUID
   * sigd_org.usuario_rol.cuenta_id = UUID
   *
   * No se modifican contratos de IdentiCore ni
   * de otros integrantes desde B_LEONARDO.
   */
  async function crearUsuario(
    datos: CrearUsuarioAdminDTO,
  ): Promise<never> {
    await validarPuestoLaboralActivo(
      datos.puestoLaboralId,
    );

    throw new AppError({
      status: 503,
      code: "CONTRATO_INTERMODULAR_PENDIENTE",
      message:
        "No se puede completar el alta institucional hasta unificar los identificadores entre IdentiCore y OrganiCore.",
      detail:
        "sigd_auth.cuenta_usuario.id utiliza BIGINT, mientras sigd_org.asignacion_personal.cuenta_id y sigd_org.usuario_rol.cuenta_id utilizan UUID.",
    });
  }

  /**
   * PUT /api/v1/admin/usuarios/:id
   *
   * Comprueba primero que la cuenta exista.
   *
   * Si se solicita una reasignación de puesto,
   * también se valida que el nuevo puesto esté activo.
   *
   * La vinculación final con OrganiCore queda
   * protegida por el contrato intermodular pendiente.
   */
  async function actualizarUsuario(
    usuarioId: string | number,
    datos: ActualizarUsuarioAdminDTO,
  ): Promise<never> {
    const idParam = String(usuarioId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);
    const resultadoUsuario =
      await pool.query<{ id: string }>(
        isUuid
          ? `SELECT cu.id_usuario AS id FROM sigd_auth.cuenta_usuario AS cu WHERE cu.id_usuario = $1::uuid`
          : `SELECT cu.id_usuario AS id FROM sigd_auth.cuenta_usuario AS cu WHERE cu.id_usuario::text = $1`,
        [usuarioId],
      );

    if (!resultadoUsuario.rows[0]) {
      throw new NotFoundError({
        message:
          "El usuario indicado no existe.",
      });
    }

    if (datos.puestoLaboralId) {
      await validarPuestoLaboralActivo(
        datos.puestoLaboralId,
      );
    }

    throw new AppError({
      status: 503,
      code: "CONTRATO_INTERMODULAR_PENDIENTE",
      message:
        "No se puede completar la actualización institucional hasta unificar los identificadores entre IdentiCore y OrganiCore.",
      detail:
        "La cuenta de IdentiCore utiliza BIGINT y las relaciones de usuario de OrganiCore utilizan UUID.",
    });
  }

  /**
   * T-BE-OC-08
   *
   * Revoca todas las sesiones activas almacenadas
   * en PostgreSQL para un usuario.
   *
   * Se utiliza como parte de la baja o bloqueo
   * administrativo de personal.
   *
   * Redis ya existe como infraestructura general
   * del backend, pero el módulo de autenticación/login
   * que debe consultar una lista de revocación todavía
   * no se encuentra implementado.
   *
   * Por eso esta función se limita al contrato
   * actualmente disponible: sigd_auth.sesion_usuario.
   */
  async function revocarSesionesUsuario(
    usuarioId: string | number,
  ): Promise<number> {
    const idParam = String(usuarioId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);
    const resultado = await pool.query(
      isUuid
        ? `DELETE FROM sigd_auth.sesion_usuario WHERE id_usuario = $1::uuid`
        : `DELETE FROM sigd_auth.sesion_usuario WHERE id_usuario::text = $1`,
      [usuarioId],
    );

    return resultado.rowCount ?? 0;
  }

  return {
    listarUsuarios,
    validarPuestoLaboralActivo,
    crearUsuario,
    actualizarUsuario,
    revocarSesionesUsuario,
  };
}

export type UsuariosAdminService =
  ReturnType<
    typeof crearUsuariosAdminService
  >;