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
import { Argon2Service } from "../identicore/argon2.service.js";

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
  id: string;
  nombre: string;
  dni: string | null;
  correo: string | null;
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
      roles,
      estado,
      pagina,
      limite,
    } = filtros;

    const condiciones: string[] = ["cu.eliminado = FALSE"];
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

      // `sigd_auth.persona` solo guarda el documento; el nombre vive en
      // `persona_natural` (nombres + apellidos) o en `persona_juridica`
      // (razon_social). El indice GIN se apoya en el nombre completo.
      condiciones.push(`
        (
          to_tsvector(
            'spanish',
            COALESCE(pn.nombre_completo, pj.razon_social, '') || ' ' ||
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
          OR cu.usuario
             ILIKE '%' || ${posicion} || '%'
        )
      `);
    }

    if (areaId) {
      const posicion = agregarParametro(areaId);

      condiciones.push(
        `COALESCE(pl.area_id, ap.area_id, ur.area_id) = ${posicion}::uuid`,
      );
    }

    if (sedeId) {
      const posicion = agregarParametro(sedeId);

      condiciones.push(
        `pl.sede_id = ${posicion}::uuid`,
      );
    }

    if (rolId) {
      const posicion = agregarParametro(rolId);

      condiciones.push(
        `ur.rol_id = ${posicion}::uuid`,
      );
    }

    if (roles) {
      const codigos = roles
        .split(",")
        .map((codigo) => codigo.trim().toUpperCase())
        .filter((codigo) => codigo !== "");

      if (codigos.length > 0) {
        const posicion = agregarParametro(codigos);

        condiciones.push(
          `rs.codigo = ANY(${posicion}::text[])`,
        );
      }
    }

    if (estado) {
      if (estado === "ACTIVO") {
        condiciones.push(`
          cu.activo = TRUE
        `);
      }

      if (estado === "INACTIVO") {
        condiciones.push(`
          cu.activo = FALSE
        `);
      }

      if (estado === "BLOQUEADO") {
        // No existe columna de bloqueo en `cuenta_usuario`: una cuenta bloqueada
        // es una cuenta inactiva con una sesion revocada. Se informa del estado
        // real disponible en el DDL vigente.
        condiciones.push(`
          cu.activo = FALSE
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
        cu.id_usuario::text AS id,

        COALESCE(pn.nombre_completo, pj.razon_social, cu.usuario) AS nombre,

        p.id_documento AS dni,

        cu.correo AS correo,

        s.nombre AS sede,

        a.nombre AS area,

        c.nombre AS cargo,

        rs.nombre AS rol,

        CASE
          WHEN cu.activo = FALSE THEN 'INACTIVO'
          ELSE 'ACTIVO'
        END AS estado,

        cu.ultimo_acceso AS "ultimoAcceso"

      FROM sigd_auth.cuenta_usuario AS cu

      INNER JOIN sigd_auth.persona AS p
        ON p.id_persona = cu.id_persona

      LEFT JOIN sigd_auth.persona_natural AS pn
        ON pn.id_persona = p.id_persona

      LEFT JOIN sigd_auth.persona_juridica AS pj
        ON pj.id_persona = p.id_persona

      LEFT JOIN sigd_org.asignacion_personal AS ap
        ON ap.id_usuario = cu.id_usuario
        AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())

      LEFT JOIN sigd_org.puesto_laboral AS pl
        ON pl.puesto_laboral_id = ap.puesto_laboral_id
        AND pl.activo = TRUE

      LEFT JOIN sigd_org.sede AS s
        ON s.sede_id = pl.sede_id
        AND s.activo = TRUE

      LEFT JOIN sigd_org.area AS a
        ON a.area_id = COALESCE(pl.area_id, ap.area_id)
        AND a.vigente = TRUE

      LEFT JOIN sigd_org.cargo AS c
        ON c.cargo_id = COALESCE(pl.cargo_id, ap.cargo_id)
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

      LEFT JOIN sigd_auth.persona_juridica AS pj
        ON pj.id_persona = p.id_persona

      LEFT JOIN sigd_org.asignacion_personal AS ap
        ON ap.id_usuario = cu.id_usuario
        AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())

      LEFT JOIN sigd_org.puesto_laboral AS pl
        ON pl.puesto_laboral_id = ap.puesto_laboral_id
        AND pl.activo = TRUE

      LEFT JOIN sigd_org.usuario_rol AS ur
        ON ur.id_usuario = cu.id_usuario
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())

      LEFT JOIN sigd_org.rol_sistema AS rs
        ON rs.rol_id = ur.rol_id
        AND rs.vigente = TRUE

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
   * Alta institucional completa y persistida. El contrato intermodular que
   * antes bloqueaba la operacion ya no existe: `sigd_auth.cuenta_usuario`,
   * `sigd_auth.persona`, `sigd_org.asignacion_personal` y `sigd_org.usuario_rol`
   * comparten el mismo UUID, de modo que la cuenta, su persona y sus dos
   * relaciones organizativas se escriben en una sola transaccion.
   */
  async function crearUsuario(
    datos: CrearUsuarioAdminDTO,
  ): Promise<UsuarioDirectorio> {
    await validarPuestoLaboralActivo(datos.puestoLaboralId);

    // El tipo documental se persiste como el `tipo` de la persona. La tabla
    // `sigd_auth.tipos_documento` es la fuente; RUC significa persona juridica.
    const tipoDocumento = await pool.query<{ codigo: string }>(
      `SELECT codigo FROM sigd_auth.tipos_documento
        WHERE id_tipo_documento = $1 AND vigente = TRUE`,
      [datos.tipoDocumentoId],
    );
    const codigoTipo = tipoDocumento.rows[0]?.codigo;
    if (!codigoTipo) {
      throw new AppError({
        status: 422,
        code: "TIPO_DOCUMENTO_DESCONOCIDO",
        message: "El tipo de documento indicado no existe o no esta vigente.",
      });
    }

    const duplicado = await pool.query<{ id_usuario: string }>(
      `SELECT cu.id_usuario
         FROM sigd_auth.cuenta_usuario cu
         JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
        WHERE lower(cu.usuario) = lower($1)
           OR lower(cu.correo) = lower($2)
           OR p.id_documento = $3`,
      [datos.username, datos.correo, datos.numeroDocumento],
    );
    if (duplicado.rowCount && duplicado.rowCount > 0) {
      throw new AppError({
        status: 409,
        code: "USUARIO_DUPLICADO",
        message: "Ya existe una cuenta con ese usuario, correo o documento.",
      });
    }

    const hash = await Argon2Service.hash(datos.passwordInicial);
    const tipoPersona = codigoTipo === "RUC" ? "JURIDICA" : "NATURAL";

    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");

      const persona = await cliente.query<{ id_persona: string }>(
        `INSERT INTO sigd_auth.persona (tipo, id_documento)
         VALUES ($1, $2)
         RETURNING id_persona`,
        [tipoPersona, datos.numeroDocumento],
      );
      const idPersona = persona.rows[0].id_persona;

      const apellidos = [datos.apellidoPaterno, datos.apellidoMaterno]
        .filter((apellido): apellido is string => Boolean(apellido))
        .join(" ");
      const nombreCompleto = `${datos.nombres} ${apellidos}`.trim();

      await cliente.query(
        `INSERT INTO sigd_auth.persona_natural
           (id_persona, nombres, apellidos, nombre_completo, telefono, correo)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [idPersona, datos.nombres, apellidos, nombreCompleto, datos.telefono ?? null, datos.correo],
      );

      const cuenta = await cliente.query<{ id_usuario: string }>(
        `INSERT INTO sigd_auth.cuenta_usuario
           (id_persona, usuario, correo, password_hash, activo)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id_usuario`,
        [idPersona, datos.username, datos.correo, hash],
      );
      const idUsuario = cuenta.rows[0].id_usuario;

      await cliente.query(
        `INSERT INTO sigd_org.asignacion_personal
           (id_usuario, puesto_laboral_id, cargo_id, area_id, vigente_desde)
         SELECT $1, pl.puesto_laboral_id, pl.cargo_id, pl.area_id, now()
           FROM sigd_org.puesto_laboral pl
          WHERE pl.puesto_laboral_id = $2::uuid`,
        [idUsuario, datos.puestoLaboralId],
      );

      await cliente.query(
        `INSERT INTO sigd_org.usuario_rol
           (id_usuario, rol_id, area_id, vigente_desde)
         SELECT $1, $2::uuid,
                (SELECT area_id FROM sigd_org.puesto_laboral
                  WHERE puesto_laboral_id = $3::uuid),
                now()
         WHERE EXISTS (SELECT 1 FROM sigd_org.rol_sistema
                        WHERE rol_id = $2::uuid AND vigente = TRUE)`,
        [idUsuario, datos.rolId, datos.puestoLaboralId],
      );

      await cliente.query("COMMIT");

      const directorio = await listarUsuarios({ pagina: 1, limite: 100 });
      const creado = directorio.datos.find((u) => u.id === idUsuario);
      if (creado) return creado;
      return {
        id: idUsuario,
        nombre: nombreCompleto,
        dni: datos.numeroDocumento,
        correo: datos.correo,
        sede: null,
        area: null,
        cargo: null,
        rol: null,
        estado: "ACTIVO",
        ultimoAcceso: null,
      };
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
  }

  /**
   * PUT /api/v1/admin/usuarios/:id
   *
   * Actualización real de la cuenta. Si se desactiva o se cambia de rol, se
   * revocan las sesiones activas: una baja administrativa debe cortar el acceso
   * de inmediato (T-BE-OC-08), no esperar a que expire el token.
   */
  async function actualizarUsuario(
    usuarioId: string,
    datos: ActualizarUsuarioAdminDTO,
  ): Promise<UsuarioDirectorio> {
    const resultadoUsuario = await pool.query<{ id_usuario: string }>(
      `SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
      [usuarioId],
    );
    if (!resultadoUsuario.rows[0]) {
      throw new NotFoundError({ message: "El usuario indicado no existe." });
    }

    if (datos.puestoLaboralId) {
      await validarPuestoLaboralActivo(datos.puestoLaboralId);
    }

    const activo = datos.estado === "ACTIVO" ? true : datos.estado === "INACTIVO" ? false : undefined;

    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");

      const cuenta: string[] = [];
      const valores: unknown[] = [];
      const param = (valor: unknown): string => {
        valores.push(valor);
        return `$${valores.length}`;
      };

      if (datos.correo !== undefined) {
        cuenta.push(`correo = ${param(datos.correo)}`);
      }
      if (activo !== undefined) {
        cuenta.push(`activo = ${param(activo)}`);
      }
      if (cuenta.length > 0) {
        valores.push(usuarioId);
        await cliente.query(
          `UPDATE sigd_auth.cuenta_usuario SET ${cuenta.join(", ")}
            WHERE id_usuario = $${valores.length}::uuid`,
          valores,
        );
      }

      const nombres = datos.nombres ?? null;
      const apellidoPaterno = datos.apellidoPaterno ?? null;
      const apellidoMaterno = datos.apellidoMaterno ?? null;
      if (nombres || apellidoPaterno || apellidoMaterno !== null) {
        await cliente.query(
          `UPDATE sigd_auth.persona_natural
              SET nombres            = COALESCE($1, nombres),
                  apellidos          = COALESCE(trim(both ' ' from COALESCE($2, '') || ' ' || COALESCE($3, '')), apellidos),
                  nombre_completo    = trim(both ' ' from COALESCE($1, nombres) || ' ' ||
                                            COALESCE(trim(both ' ' from COALESCE($2, '') || ' ' || COALESCE($3, '')), apellidos)),
                  telefono           = COALESCE($4, telefono),
                  correo             = COALESCE($5, correo)
            WHERE id_persona = (SELECT id_persona FROM sigd_auth.cuenta_usuario
                                 WHERE id_usuario = $6::uuid)`,
          [nombres, apellidoPaterno, apellidoMaterno, datos.telefono ?? null,
           datos.correo ?? null, usuarioId],
        );
      }

      if (datos.puestoLaboralId) {
        // Se cierra la asignación vigente anterior antes de abrir la nueva:
        // un servidor no puede tener dos puestos vigentes a la vez.
        await cliente.query(
          `UPDATE sigd_org.asignacion_personal
              SET vigente_hasta = now()
            WHERE id_usuario = $1::uuid AND vigente_hasta IS NULL`,
          [usuarioId],
        );
        await cliente.query(
          `INSERT INTO sigd_org.asignacion_personal
             (id_usuario, puesto_laboral_id, cargo_id, area_id, vigente_desde)
           SELECT $1, pl.puesto_laboral_id, pl.cargo_id, pl.area_id, now()
             FROM sigd_org.puesto_laboral pl
            WHERE pl.puesto_laboral_id = $2::uuid`,
          [usuarioId, datos.puestoLaboralId],
        );
      }

      if (datos.rolId) {
        await cliente.query(
          `UPDATE sigd_org.usuario_rol SET vigente_hasta = now()
            WHERE id_usuario = $1::uuid AND vigente_hasta IS NULL`,
          [usuarioId],
        );
        await cliente.query(
          `INSERT INTO sigd_org.usuario_rol
             (id_usuario, rol_id, area_id, vigente_desde)
           SELECT $1, $2::uuid,
                  (SELECT area_id FROM sigd_org.puesto_laboral
                    WHERE puesto_laboral_id = $3::uuid),
                  now()`,
          [usuarioId, datos.rolId, datos.puestoLaboralId ?? null],
        );
      }

      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }

    // Baja o cambio de rol: se cortan las sesiones abiertas.
    if (datos.estado && datos.estado !== "ACTIVO") {
      await revocarSesionesUsuario(usuarioId);
    } else if (datos.rolId || datos.puestoLaboralId) {
      await revocarSesionesUsuario(usuarioId);
    }

    const directorio = await listarUsuarios({ pagina: 1, limite: 100 });
    const actualizado = directorio.datos.find((u) => u.id === usuarioId);
    if (!actualizado) {
      throw new NotFoundError({ message: "El usuario indicado no existe." });
    }
    return actualizado;
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
    usuarioId: string,
  ): Promise<number> {
    const resultado = await pool.query(
      `
        DELETE FROM sigd_auth.sesion_usuario
        WHERE id_usuario = $1::uuid
      `,
      [usuarioId],
    );

    return resultado.rowCount ?? 0;
  }

  async function eliminarUsuario(
    usuarioId: string,
  ): Promise<void> {
    const existe = await pool.query<{ id_usuario: string }>(
      `SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
      [usuarioId],
    );
    if (!existe.rows[0]) {
      throw new NotFoundError({ message: "El usuario indicado no existe." });
    }

    // Baja lógica definitiva: se marca como eliminado y se desactiva.
    await pool.query(
      `UPDATE sigd_auth.cuenta_usuario
          SET activo = FALSE, eliminado = TRUE
        WHERE id_usuario = $1::uuid`,
      [usuarioId],
    );
    await pool.query(`DELETE FROM sigd_auth.sesion_usuario WHERE id_usuario = $1::uuid`, [usuarioId]);
    await pool.query(
      `UPDATE sigd_org.usuario_rol SET vigente_hasta = now()
         WHERE id_usuario = $1::uuid AND vigente_hasta IS NULL`,
      [usuarioId],
    );
  }

  return {
    listarUsuarios,
    validarPuestoLaboralActivo,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
    revocarSesionesUsuario,
  };
}

export type UsuariosAdminService =
  ReturnType<
    typeof crearUsuariosAdminService
  >;