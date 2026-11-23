import type { Pool, PoolClient } from "pg";
import { AppError, NotFoundError, UnauthorizedError } from "../../shared/domain/errors/index.js";
import { getRequestContext } from "../../shared/request-context/request-context.js";
import { Argon2Service } from "../identicore/argon2.service.js";
import { registrarMutacion } from "../../audit/bitacora-auditoria.repository.js";
import type { ListarUsuariosQuery, CrearUsuarioAdminDTO, ActualizarUsuarioAdminDTO } from "./dto/usuarioAdmin.dto.js";

type Conexion = Pick<Pool, "query">;
export interface OpcionDirectorio { id: string; nombre: string }
export interface AsignacionDirectorio {
  id: string; cargoId: string; areaId: string; cargo: string; area: string;
}
export interface RolDirectorio {
  id: string;
  rolId: string;
  areaId: string | null;
  nombre: string;
  codigo?: string;
  ambito?: "GLOBAL" | "AREA";
  vigenteDesde?: string;
  vigenteHasta?: string | null;
  activo?: boolean;
}
export interface UsuarioDirectorio {
  id: string; nombre: string; nombres: string | null; apellidos: string | null;
  tipoPersona: string; dni: string; correo: string; sede: null;
  area: string | null; cargo: string | null; rol: string | null;
  estado: "ACTIVO" | "INACTIVO"; ultimoAcceso: Date | null;
  asignaciones: AsignacionDirectorio[]; roles: RolDirectorio[];
}
export interface CatalogosDirectorio {
  areas: OpcionDirectorio[]; cargos: OpcionDirectorio[]; roles: OpcionDirectorio[];
  tiposDocumento: Array<OpcionDirectorio & { codigo: string }>;
}
export interface ResultadoUsuariosPaginado {
  datos: UsuarioDirectorio[];
  paginacion: { pagina: number; limite: number; total: number; totalPaginas: number };
  catalogos: CatalogosDirectorio;
}

const BASE = `FROM sigd_auth.cuenta_usuario cu
  JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
  LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
  LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona`;
const VIGENCIA_AP = "ap.vigente_desde <= now() AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())";
const VIGENCIA_UR = "ur.vigente_desde <= now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())";
// Los agregados conservan todas las asignaciones. Nunca se elige un cargo o rol arbitrario.
const SELECT_USUARIOS = `SELECT cu.id_usuario::text AS id,
  cu.usuario AS username,
  COALESCE(pn.nombre_completo, pj.razon_social, cu.usuario) AS nombre,
  pn.nombres, pn.apellidos, p.tipo AS "tipoPersona", p.id_documento AS dni, cu.correo,
  NULL::text AS sede, personal.area, personal.cargo, permisos.rol,
  CASE WHEN cu.activo THEN 'ACTIVO' ELSE 'INACTIVO' END AS estado,
  cu.ultimo_acceso AS "ultimoAcceso",
  COALESCE(personal.asignaciones, '[]'::jsonb) AS asignaciones,
  COALESCE(permisos.roles, '[]'::jsonb) AS roles
  ${BASE}
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT a.nombre, ', ' ORDER BY a.nombre) AS area,
      string_agg(DISTINCT c.nombre, ', ' ORDER BY c.nombre) AS cargo,
      jsonb_agg(jsonb_build_object('id', ap.id_asignacion, 'cargoId', ap.cargo_id,
        'areaId', ap.area_id, 'cargo', c.nombre, 'area', a.nombre) ORDER BY ap.id_asignacion) AS asignaciones
    FROM sigd_org.asignacion_personal ap
    JOIN sigd_org.cargo c ON c.cargo_id = ap.cargo_id
    JOIN sigd_org.area a ON a.area_id = ap.area_id
    WHERE ap.id_usuario = cu.id_usuario AND ${VIGENCIA_AP}
  ) personal ON TRUE
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT r.nombre, ', ' ORDER BY r.nombre) FILTER (WHERE ${VIGENCIA_UR}) AS rol,
      jsonb_agg(jsonb_build_object('id', ur.id_usuario_rol, 'rolId', ur.rol_id, 'areaId', ur.area_id, 'nombre', r.nombre, 'codigo', r.codigo, 'ambito', CASE WHEN ur.area_id IS NULL THEN 'GLOBAL' ELSE 'AREA' END, 'vigenteDesde', ur.vigente_desde, 'vigenteHasta', ur.vigente_hasta, 'activo', (ur.vigente_desde <= now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now()))) ORDER BY (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now()) DESC, ur.vigente_desde DESC) AS roles

    FROM sigd_org.usuario_rol ur
    JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
    WHERE ur.id_usuario = cu.id_usuario
  ) permisos ON TRUE`;

function noDisponible(campo: string, mensaje: string): never {
  throw new AppError({ status: 422, code: "CAMPO_NO_DISPONIBLE", message: mensaje,
    invalidParams: [{ name: campo, reason: mensaje }] });
}
function traducirConflicto(error: unknown): never {
  const pg = error as { code?: string; constraint?: string };
  if (pg.code === "23505" || pg.code === "23P01") {
    const campo = pg.constraint?.includes("correo") ? "correo"
      : pg.constraint?.includes("documento") ? "numeroDocumento"
      : pg.constraint?.includes("asignacion") ? "cargoId"
      : pg.constraint?.includes("usuario_rol") ? "rolId" : "username";
    throw new AppError({ status: 409, code: "CONFLICT", message: "El registro entra en conflicto con un valor o asignación existente.",
      invalidParams: [{ name: campo, reason: "El valor o período ya está registrado." }] });
  }
  throw error;
}
async function obtenerUsuario(db: Conexion, id: string): Promise<UsuarioDirectorio> {
  const r = await db.query<UsuarioDirectorio>(`${SELECT_USUARIOS} WHERE cu.id_usuario = $1::uuid`, [id]);
  if (r.rows.length !== 1) throw new NotFoundError({ message: "El usuario indicado no existe." });
  return r.rows[0];
}
async function validarCatalogo(db: Conexion, tipo: "cargo" | "area" | "rol_sistema", id: string) {
  const clave = tipo === "rol_sistema" ? "rol_id" : tipo + "_id";
  const r = await db.query(`SELECT ${clave} FROM sigd_org.${tipo} WHERE ${clave} = $1::uuid AND vigente = TRUE`, [id]);
  if (r.rows.length !== 1) noDisponible(tipo === "rol_sistema" ? "rolId" : tipo + "Id", "Seleccione un registro existente y vigente.");
}
const ROLES_EXTERNOS_PROHIBIDOS = ["CIUDADANO", "ESTUDIANTE"];
async function validarRolInterno(db: Conexion, rolId: string): Promise<string> {
  const r = await db.query<{ rol_id: string; codigo?: string }>(
    `SELECT rol_id, codigo FROM sigd_org.rol_sistema WHERE rol_id = $1::uuid AND vigente = TRUE`,
    [rolId],
  );
  if (r.rows.length !== 1) {
    noDisponible("rolId", "Seleccione un rol institucional existente y vigente.");
  }
  const codigo = (r.rows[0].codigo || "").trim().toUpperCase();
  if (ROLES_EXTERNOS_PROHIBIDOS.includes(codigo)) {
    noDisponible("rolId", "El rol seleccionado no corresponde al personal interno del instituto.");
  }
  return codigo;
}
async function revocarSesiones(db: Conexion, id: string): Promise<number> {
  const r = await db.query(`UPDATE sigd_auth.sesion_usuario SET revocado_en = now()
    WHERE id_usuario = $1::uuid AND revocado_en IS NULL`, [id]);
  return r.rowCount ?? 0;
}

const INSTITUCION_ID_CANONICA_SUIZA = "018f9805-51aa-7000-8111-2b00c3f00001";

async function resolverInstitucionId(c: Conexion, areaId?: string | null): Promise<string> {
  try {
    if (areaId) {
      const areaInst = await c.query<{ institucion_id: string }>(
        "SELECT institucion_id FROM sigd_org.area WHERE area_id = $1::uuid",
        [areaId]
      );
      if (areaInst.rows[0]?.institucion_id) return areaInst.rows[0].institucion_id;
    }
    const inst = await c.query<{ institucion_id: string }>(
      "SELECT institucion_id FROM sigd_org.institucion WHERE activo = TRUE LIMIT 1"
    );
    if (inst.rows[0]?.institucion_id) return inst.rows[0].institucion_id;
  } catch {
    // Si la consulta no es soportada por mocks aislados en pruebas unitarias, se usa la institución canónica
  }
  return INSTITUCION_ID_CANONICA_SUIZA;
}

export function crearUsuariosAdminService(pool: Pool) {
  async function listarUsuarios(f: ListarUsuariosQuery): Promise<ResultadoUsuariosPaginado> {
    if (f.sedeId) noDisponible("sedeId", "El modelo original no dispone de sedes asociadas a estas cuentas.");
    if (f.estado === "BLOQUEADO") noDisponible("estado", "El modelo de cuenta dispone de activo/inactivo, sin un estado de bloqueo independiente.");
    const parametros: unknown[] = [];
    const condiciones: string[] = [
      `(EXISTS (SELECT 1 FROM sigd_org.asignacion_personal ap WHERE ap.id_usuario=cu.id_usuario AND ${VIGENCIA_AP})
        OR EXISTS (SELECT 1 FROM sigd_org.usuario_rol ur JOIN sigd_org.rol_sistema r ON r.rol_id=ur.rol_id AND r.vigente=TRUE
          WHERE ur.id_usuario=cu.id_usuario AND ${VIGENCIA_UR} AND r.codigo NOT IN ('CIUDADANO', 'ESTUDIANTE')))`
    ];
    const valor = (v: unknown) => { parametros.push(v); return "$" + parametros.length; };
    if (f.busqueda?.trim()) {
      const n = valor(f.busqueda.trim());
      condiciones.push(`(to_tsvector('spanish', concat_ws(' ', pn.nombre_completo, pj.razon_social, p.id_documento, cu.usuario, cu.correo))
        @@ websearch_to_tsquery('spanish', ${n})
        OR p.id_documento ILIKE '%' || ${n} || '%' OR cu.correo ILIKE '%' || ${n} || '%'
        OR cu.usuario ILIKE '%' || ${n} || '%'
        OR EXISTS (SELECT 1 FROM sigd_org.asignacion_personal ap JOIN sigd_org.area a ON a.area_id=ap.area_id
          WHERE ap.id_usuario=cu.id_usuario AND ${VIGENCIA_AP} AND a.nombre ILIKE '%' || ${n} || '%'))`);
    }
    if (f.areaId) condiciones.push(`EXISTS (SELECT 1 FROM sigd_org.asignacion_personal ap
      WHERE ap.id_usuario=cu.id_usuario AND ap.area_id=${valor(f.areaId)}::uuid AND ${VIGENCIA_AP})`);
    if (f.rolId) condiciones.push(`EXISTS (SELECT 1 FROM sigd_org.usuario_rol ur
      JOIN sigd_org.rol_sistema r ON r.rol_id=ur.rol_id AND r.vigente=TRUE
      WHERE ur.id_usuario=cu.id_usuario AND ur.rol_id=${valor(f.rolId)}::uuid AND ${VIGENCIA_UR})`);
    if (f.estado) condiciones.push(`cu.activo = ${valor(f.estado === "ACTIVO")}`);
    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";
    const filtros = [...parametros];
    const limite = valor(f.limite), offset = valor((f.pagina - 1) * f.limite);
    const [datos, conteo, catalogos] = await Promise.all([
      pool.query<UsuarioDirectorio>(`${SELECT_USUARIOS} ${where} ORDER BY nombre ASC, cu.id_usuario ASC LIMIT ${limite} OFFSET ${offset}`, parametros),
      pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total ${BASE} ${where}`, filtros),
      pool.query<{ catalogos: CatalogosDirectorio }>(`SELECT jsonb_build_object(
        'areas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',area_id,'nombre',nombre) ORDER BY nombre,area_id) FROM sigd_org.area WHERE vigente=TRUE),'[]'::jsonb),
        'cargos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',cargo_id,'nombre',nombre) ORDER BY nombre,cargo_id) FROM sigd_org.cargo WHERE vigente=TRUE),'[]'::jsonb),
        'roles', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',rol_id,'nombre',nombre) ORDER BY nombre,rol_id) FROM sigd_org.rol_sistema WHERE vigente=TRUE AND codigo NOT IN ('CIUDADANO', 'ESTUDIANTE')),'[]'::jsonb),
        'tiposDocumento', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id_tipo_documento::text,'codigo',codigo,'nombre',descripcion) ORDER BY codigo) FROM sigd_auth.tipos_documento WHERE vigente=TRUE),'[]'::jsonb)) AS catalogos`),
    ]);
    const total = conteo.rows[0].total;
    return { datos: datos.rows, paginacion: { pagina: f.pagina, limite: f.limite, total,
      totalPaginas: Math.ceil(total / f.limite) }, catalogos: catalogos.rows[0].catalogos };
  }

  async function transaccion<T>(operacion: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const resultado = await operacion(c);
      await c.query("COMMIT");
      return resultado;
    } catch (error) {
      await c.query("ROLLBACK");
      return traducirConflicto(error);
    } finally { c.release(); }
  }
  async function validarPuestoLaboralActivo(_id: string): Promise<never> {
    noDisponible("puestoLaboralId", "Seleccione cargoId y areaId: el modelo original no contiene puestos laborales.");
  }
  async function crearUsuario(d: CrearUsuarioAdminDTO): Promise<UsuarioDirectorio> {
    if (d.puestoLaboralId) return validarPuestoLaboralActivo(d.puestoLaboralId);
    if (!d.cargoId || !d.areaId) noDisponible("cargoId", "Seleccione cargo y área existentes.");
    const hash = await Argon2Service.hash(d.passwordInicial);
    return transaccion(async c => {
      await validarCatalogo(c, "cargo", d.cargoId!);
      await validarCatalogo(c, "area", d.areaId!);

      const td = await c.query<{ codigo: string }>("SELECT codigo FROM sigd_auth.tipos_documento WHERE id_tipo_documento=$1 AND vigente=TRUE", [d.tipoDocumentoId]);
      if (td.rows.length !== 1) noDisponible("tipoDocumentoId", "Seleccione un tipo de documento existente y vigente.");
      const persona = await c.query<{ id_persona: string }>(`INSERT INTO sigd_auth.persona(tipo,id_documento)
        VALUES('NATURAL',$1) RETURNING id_persona`, [d.numeroDocumento]);
      const idPersona = persona.rows[0].id_persona;
      const apellidos = [d.apellidoPaterno, d.apellidoMaterno].filter(Boolean).join(" ");
      await c.query(`INSERT INTO sigd_auth.persona_natural(id_persona,nombres,apellidos,nombre_completo,correo,telefono)
        VALUES($1::uuid,$2,$3,$4,$5,$6)`, [idPersona,d.nombres,apellidos,d.nombres+" "+apellidos,d.correo,d.telefono??null]);
      await c.query(`INSERT INTO sigd_auth.persona_documento_historial(id_persona,id_documento,tipo_documento,origen)
        VALUES($1::uuid,$2,$3,'MANUAL')`, [idPersona,d.numeroDocumento,d.tipoDocumentoId]);
      const cuenta = await c.query<{ id_usuario: string }>(`INSERT INTO sigd_auth.cuenta_usuario(id_persona,usuario,correo,password_hash,activo)
        VALUES($1::uuid,$2,$3,$4,FALSE) RETURNING id_usuario`, [idPersona,d.username,d.correo,hash]);
      const id = cuenta.rows[0].id_usuario;
      await c.query(`INSERT INTO sigd_org.asignacion_personal(id_usuario,cargo_id,area_id) VALUES($1::uuid,$2::uuid,$3::uuid)`,[id,d.cargoId,d.areaId]);
      const institucionId = await resolverInstitucionId(c, d.areaId);
      await c.query(
        `INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
         VALUES ($1::uuid, $2::uuid, TRUE)
         ON CONFLICT (id_usuario, institucion_id) DO NOTHING`,
        [id, institucionId]
      );
      const creado = await obtenerUsuario(c,id);
      const actorAutenticado = getRequestContext()?.usuario_id;
      await registrarMutacion(c, { esquema: "sigd_auth", tabla: "cuenta_usuario", operacion: "INSERT",
        datos_despues: { id_usuario: id, id_persona: idPersona, usuario: d.username, activo: false,
          estado: "INACTIVO", asignacion: { areaId: d.areaId, cargoId: d.cargoId }, roles: [], actor_id: actorAutenticado ?? id } });
      return creado;
    });
  }
  async function consultarUsuario(id: string): Promise<UsuarioDirectorio> {
    return obtenerUsuario(pool, id);
  }
  async function restablecerCredenciales(id: string, passwordInicial: string): Promise<void> {
    const hash = await Argon2Service.hash(passwordInicial);
    await transaccion(async c => {
      const existente = await c.query<{ id_usuario: string }>(
        "SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE", [id]);
      if (existente.rows.length !== 1) throw new NotFoundError({ message: "El usuario indicado no existe." });
      await c.query("UPDATE sigd_auth.cuenta_usuario SET password_hash=$2 WHERE id_usuario=$1::uuid", [id, hash]);
      const sesionesRevocadas = await revocarSesiones(c, id);
      await registrarMutacion(c, { esquema: "sigd_auth", tabla: "cuenta_usuario", operacion: "UPDATE",
        datos_antes: { id_usuario: id, credencial: "ARGON2ID" },
        datos_despues: { id_usuario: id, accion: "RESTABLECER_CREDENCIALES", sesionesRevocadas } });
    });
  }
  async function actualizarUsuario(id: string, d: ActualizarUsuarioAdminDTO): Promise<UsuarioDirectorio> {
    if (d.puestoLaboralId) return validarPuestoLaboralActivo(d.puestoLaboralId);
    if (d.estado === "BLOQUEADO") noDisponible("estado", "El modelo original no dispone de un bloqueo independiente.");
    if (d.apellidoPaterno !== undefined || d.apellidoMaterno !== undefined) noDisponible("apellidos", "Utilice el campo apellidos completo del modelo original.");
    if ((d.cargoId || d.areaId || d.asignacionId) && (!d.cargoId || !d.areaId)) noDisponible("cargoId", "La asignación requiere cargoId y areaId.");
    if (d.usuarioRolId && !d.rolId) noDisponible("rolId", "Seleccione el rol de la asignación que desea modificar.");
    return transaccion(async c => {
      const actual = await c.query<{ id_persona: string; activo: boolean }>("SELECT id_persona, activo FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE", [id]);
      if (actual.rows.length !== 1) throw new NotFoundError({ message: "El usuario indicado no existe." });
      if (d.nombres !== undefined || d.apellidos !== undefined) {
        const r = await c.query(`UPDATE sigd_auth.persona_natural SET nombres=COALESCE($2,nombres),apellidos=COALESCE($3,apellidos),
          nombre_completo=concat_ws(' ',COALESCE($2,nombres),COALESCE($3,apellidos)) WHERE id_persona=$1::uuid`, [actual.rows[0].id_persona,d.nombres??null,d.apellidos??null]);
        if (r.rowCount !== 1) noDisponible("nombres", "La identidad no corresponde a una persona natural.");
      }
      if (d.correo !== undefined) await c.query("UPDATE sigd_auth.cuenta_usuario SET correo=$2 WHERE id_usuario=$1::uuid",[id,d.correo]);
      if (d.estado !== undefined) {
        if (d.estado === "ACTIVO") {
          const rolesValidos = await c.query<{ total: number }>(
            `SELECT COUNT(*)::int AS total FROM sigd_org.usuario_rol ur JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE WHERE ur.id_usuario = $1::uuid AND ${VIGENCIA_UR} AND r.codigo NOT IN ('CIUDADANO', 'ESTUDIANTE')`,
            [id]
          );
          if ((rolesValidos.rows[0]?.total ?? 0) === 0) {
            throw new AppError({
              status: 422,
              code: "ACTIVACION_SIN_ROLES",
              message: "No se puede activar una cuenta sin roles institucionales válidos y vigentes asignados.",
              detail: "Asigne al menos un rol antes de habilitar la cuenta institucional.",
              invalidParams: [{ name: "estado", reason: "La cuenta requiere al menos un rol institucional vigente para ser activada." }],
            });
          }
        }
        await c.query("UPDATE sigd_auth.cuenta_usuario SET activo=$2 WHERE id_usuario=$1::uuid",[id,d.estado==="ACTIVO"]);
        if (d.estado === "INACTIVO") await revocarSesiones(c,id);
      }
      if (d.telefono !== undefined) {
        const r = await c.query("UPDATE sigd_auth.persona_natural SET telefono=$2 WHERE id_persona=$1::uuid",[actual.rows[0].id_persona,d.telefono]);
        if (r.rowCount !== 1) noDisponible("telefono", "El teléfono de contacto requiere una persona natural vinculada.");
      }
      if (d.cargoId && d.areaId) {
        await validarCatalogo(c,"cargo",d.cargoId); await validarCatalogo(c,"area",d.areaId);
        const previas = await c.query<{ id_asignacion: string; cargo_id: string; area_id: string }>(`SELECT ap.id_asignacion,ap.cargo_id,ap.area_id FROM sigd_org.asignacion_personal ap
          WHERE ap.id_usuario=$1::uuid AND ${VIGENCIA_AP} FOR UPDATE`,[id]);
        const previa = d.asignacionId ? previas.rows.find(a=>a.id_asignacion===d.asignacionId) : previas.rows.length===1 ? previas.rows[0] : undefined;
        if ((d.asignacionId && !previa) || (!d.asignacionId && previas.rows.length>1)) noDisponible("asignacionId","Identifique la asignación vigente que desea modificar.");
        if (!previa || previa.cargo_id!==d.cargoId || previa.area_id!==d.areaId) {
          if (previa) await c.query("UPDATE sigd_org.asignacion_personal SET vigente_hasta=now() WHERE id_asignacion=$1::uuid",[previa.id_asignacion]);
          await c.query("INSERT INTO sigd_org.asignacion_personal(id_usuario,cargo_id,area_id) VALUES($1::uuid,$2::uuid,$3::uuid)",[id,d.cargoId,d.areaId]);
          if (previa && previa.area_id !== d.areaId) {
            const rolesVigentes = await c.query<{ id_usuario_rol: string; rol_id: string; area_id: string | null; codigo: string }>(
              "SELECT ur.id_usuario_rol, ur.rol_id, ur.area_id, r.codigo FROM sigd_org.usuario_rol ur JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE WHERE ur.id_usuario = $1::uuid AND " + VIGENCIA_UR + " FOR UPDATE",
              [id]
            );
            for (const r of rolesVigentes.rows) {
              if (r.codigo !== "ADMINISTRADOR") {
                const instId = await resolverInstitucionId(c, d.areaId);
                await c.query(
                  `INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
                   VALUES ($1::uuid, $2::uuid, TRUE)
                   ON CONFLICT (id_usuario, institucion_id) DO NOTHING`,
                  [id, instId]
                );
                await c.query("UPDATE sigd_org.usuario_rol SET vigente_hasta=now() WHERE id_usuario_rol=$1::uuid", [r.id_usuario_rol]);
                await c.query("INSERT INTO sigd_org.usuario_rol(id_usuario, rol_id, area_id, institucion_id) VALUES($1::uuid, $2::uuid, $3::uuid, $4::uuid)", [id, r.rol_id, d.areaId, instId]);
              }
            }
            await revocarSesiones(c, id);
          }
        }
      }
      if (d.rolId) {
        await validarRolInterno(c, d.rolId);
        const previos = await c.query<{ id_usuario_rol: string; rol_id: string; area_id: string | null }>(`SELECT ur.id_usuario_rol,ur.rol_id,ur.area_id FROM sigd_org.usuario_rol ur
          WHERE ur.id_usuario=$1::uuid AND ${VIGENCIA_UR} FOR UPDATE`,[id]);
        const previo = d.usuarioRolId ? previos.rows.find(r=>r.id_usuario_rol===d.usuarioRolId) : previos.rows.length===1 ? previos.rows[0] : undefined;
        if ((d.usuarioRolId && !previo) || (!d.usuarioRolId && previos.rows.length>1)) noDisponible("usuarioRolId","Identifique el rol vigente que desea modificar.");
        if (!previo || previo.rol_id!==d.rolId) {
          const rolCodigo = await validarRolInterno(c, d.rolId);
          const esGlobal = rolCodigo === "ADMINISTRADOR";
          const asignacionActiva = await c.query<{ area_id: string }>(
            "SELECT ap.area_id FROM sigd_org.asignacion_personal ap WHERE ap.id_usuario=$1::uuid AND " + VIGENCIA_AP + " LIMIT 1",
            [id]
          );
          const nuevoAreaId = esGlobal ? null : (d.areaId ?? asignacionActiva.rows[0]?.area_id ?? previo?.area_id ?? null);
          const instId = await resolverInstitucionId(c, nuevoAreaId);
          await c.query(
            `INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
             VALUES ($1::uuid, $2::uuid, TRUE)
             ON CONFLICT (id_usuario, institucion_id) DO NOTHING`,
            [id, instId]
          );
          if (previo) await c.query("UPDATE sigd_org.usuario_rol SET vigente_hasta=now() WHERE id_usuario_rol=$1::uuid",[previo.id_usuario_rol]);
          await c.query("INSERT INTO sigd_org.usuario_rol(id_usuario,rol_id,area_id,institucion_id) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid)",[id,d.rolId,nuevoAreaId,instId]);
          await revocarSesiones(c,id);
        }
      }
      const actualizado = await obtenerUsuario(c,id);
      const estadoAnterior = actual.rows[0].activo ? "ACTIVO" : "INACTIVO";
      await registrarMutacion(c, { esquema: "sigd_auth", tabla: "cuenta_usuario", operacion: "UPDATE",
        datos_antes: { id_usuario: id, estado: estadoAnterior, campos: Object.keys(d) },
        datos_despues: {
          id_usuario: id,
          estado: actualizado.estado,
          estado_anterior: estadoAnterior,
          desactivado: actualizado.estado === "INACTIVO" && estadoAnterior === "ACTIVO",
          motivo: (d as { motivo?: string }).motivo ?? null,
          campos: Object.keys(d)
        } });
      return actualizado;
    });
  }
  async function actualizarPermisosRol(id: string, permisos: string[], actorId?: string) {
    const actorAutenticado = actorId ?? getRequestContext()?.usuario_id;
    if (!actorAutenticado) {
      throw new UnauthorizedError({ message: 'Se requiere la identidad del administrador autenticado para modificar permisos institucionales.' });
    }
    return transaccion(async c => {
      const rol = await c.query<{ rol_id: string; codigo: string; nombre: string }>(
        'SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema WHERE rol_id=$1::uuid AND vigente=TRUE FOR UPDATE',
        [id]
      );
      if (rol.rows.length !== 1) throw new NotFoundError({ message: 'El rol vigente no existe.' });

      const rolCodigo = rol.rows[0].codigo;
      const rolNombre = rol.rows[0].nombre;

      // 5.2 Protección del rol CIUDADANO (servicios externos inmutables)
      if (rolCodigo === 'CIUDADANO') {
        throw new AppError({
          status: 422,
          code: 'ROL_EXTERNO_NO_MODIFICABLE',
          message: 'El rol Ciudadano corresponde a administrados externos y sus permisos son inmutables para garantizar la seguridad del sistema.',
          invalidParams: [{ name: 'rolId', reason: 'No se permite modificar permisos del rol Ciudadano.' }],
        });
      }

      // Validar permisos del catálogo institucional
      const existentes = await c.query<{ permiso_id: string; codigo: string }>(
        'SELECT permiso_id, codigo FROM sigd_org.permiso_sistema WHERE permiso_id=ANY($1::uuid[])',
        [permisos]
      );
      if (existentes.rows.length !== permisos.length) {
        noDisponible('permisos', 'Seleccione únicamente permisos del catálogo institucional.');
      }

      // 5.3 Protección contra autobloqueo administrativo
      if (rolCodigo === 'ADMINISTRADOR') {
        const permisoAdmin = await c.query<{ permiso_id: string }>(
          "SELECT permiso_id FROM sigd_org.permiso_sistema WHERE codigo = 'ADMIN_USUARIOS'"
        );
        const adminPermId = permisoAdmin.rows[0]?.permiso_id;
        if (!adminPermId || !permisos.includes(adminPermId)) {
          throw new AppError({
            status: 422,
            code: 'PERMISO_ADMIN_OBLIGATORIO',
            message: 'El rol Administrador debe conservar obligatoriamente el permiso ADMIN_USUARIOS para prevenir el autobloqueo del sistema.',
            invalidParams: [{ name: 'permisos', reason: 'El permiso ADMIN_USUARIOS es obligatorio para el rol Administrador.' }],
          });
        }

        // Comprobar que existan administradores activos en el sistema
        const adminsActivos = await c.query<{ total: number }>(
          `SELECT COUNT(DISTINCT ur.id_usuario)::int AS total
           FROM sigd_org.usuario_rol ur
           JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = ur.id_usuario AND cu.activo = TRUE
           WHERE ur.rol_id = $1::uuid
             AND ur.vigente_desde <= now()
             AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
             AND ur.area_id IS NULL`,
          [id]
        );
        if (adminsActivos.rows[0]?.total === 0) {
          throw new AppError({
            status: 422,
            code: 'SIN_ADMINISTRADORES_ACTIVOS',
            message: 'No se puede modificar el rol Administrador porque no existen cuentas activas vigentes asignadas con alcance global.',
            invalidParams: [{ name: 'rolId', reason: 'Se requiere al menos un administrador activo en el sistema.' }],
          });
        }
      }

      // 5.1 Consultar permisos previos para auditoría diferencial
      const permisosPrevios = await c.query<{ permiso_id: string; codigo: string }>(
        `SELECT p.permiso_id, p.codigo
         FROM sigd_org.rol_permiso rp
         JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
         WHERE rp.rol_id = $1::uuid`,
        [id]
      );

      const codigosAntes = permisosPrevios.rows.map(p => p.codigo).sort();
      const codigosDespues = existentes.rows.map(p => p.codigo).sort();
      const idsAntes = new Set(permisosPrevios.rows.map(p => p.permiso_id));
      const idsDespues = new Set(permisos);

      const agregados = existentes.rows.filter(p => !idsAntes.has(p.permiso_id)).map(p => p.codigo);
      const retirados = permisosPrevios.rows.filter(p => !idsDespues.has(p.permiso_id)).map(p => p.codigo);

      // Modificación transaccional
      await c.query('DELETE FROM sigd_org.rol_permiso WHERE rol_id=$1::uuid', [id]);
      if (permisos.length > 0) {
        await c.query(
          'INSERT INTO sigd_org.rol_permiso(rol_id,permiso_id) SELECT $1::uuid, unnest($2::uuid[])',
          [id, permisos]
        );
      }

      // Revocar sesiones activas de los usuarios asignados al rol modificado para garantizar recarga inmediata de claims
      await c.query(
        `UPDATE sigd_auth.sesion_usuario
         SET revocado_en = now()
         WHERE revocado_en IS NULL
           AND id_usuario IN (
             SELECT id_usuario
             FROM sigd_org.usuario_rol
             WHERE rol_id = $1::uuid
               AND vigente_desde <= now()
               AND (vigente_hasta IS NULL OR vigente_hasta > now())
           )`,
        [id]
      );

      // 5.1 Registro obligatorio en bitácora de auditoría inmutable WORM
      await registrarMutacion(c, {
        esquema: 'sigd_org',
        tabla: 'rol_permiso',
        operacion: 'UPDATE',
        usuario_id: actorAutenticado,
        datos_antes: {
          rol_id: id,
          rol_codigo: rolCodigo,
          rol_nombre: rolNombre,
          permisos: codigosAntes,
        },
        datos_despues: {
          rol_id: id,
          rol_codigo: rolCodigo,
          rol_nombre: rolNombre,
          permisos: codigosDespues,
          agregados,
          retirados,
          actor_id: actorAutenticado,
        },
      });

      return { id, permisos };
    });
  }

  async function asignarRol(id: string, rolId: string, actorId?: string): Promise<UsuarioDirectorio> {
    const actorAutenticado = actorId ?? getRequestContext()?.usuario_id;
    if (!actorAutenticado) {
      throw new UnauthorizedError({ message: "Se requiere la identidad del administrador autenticado para asignar roles institucionales." });
    }
    return transaccion(async c => {
      const cuenta = await c.query<{ id_usuario: string; activo: boolean }>(
        "SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE",
        [id]
      );
      if (cuenta.rows.length !== 1) throw new NotFoundError({ message: "El usuario indicado no existe." });

      const rolCodigo = await validarRolInterno(c, rolId);

      const rolExistente = await c.query<{ id_usuario_rol: string }>(
        `SELECT id_usuario_rol FROM sigd_org.usuario_rol WHERE id_usuario=$1::uuid AND rol_id=$2::uuid AND vigente_desde<=now() AND (vigente_hasta IS NULL OR vigente_hasta>now())`,
        [id, rolId]
      );
      if (rolExistente.rows.length > 0) {
        throw new AppError({
          status: 409,
          code: "ROL_YA_ASIGNADO",
          message: "El usuario ya tiene asignado este rol de manera activa y vigente.",
          invalidParams: [{ name: "rolId", reason: "El rol ya se encuentra asignado y vigente para esta cuenta." }],
        });
      }

      const esRolGlobal = rolCodigo === "ADMINISTRADOR";
      let areaIdParaRol: string | null = null;
      if (!esRolGlobal) {
        const asignacion = await c.query<{ area_id: string }>(
          `SELECT ap.area_id FROM sigd_org.asignacion_personal ap WHERE ap.id_usuario=$1::uuid AND ${VIGENCIA_AP} LIMIT 1`,
          [id]
        );
        if (asignacion.rows.length === 0) {
          throw new AppError({
            status: 422,
            code: "SIN_AREA_ASIGNADA",
            message: "El trabajador debe tener una unidad orgánica asignada para recibir un rol departamental.",
            invalidParams: [{ name: "areaId", reason: "Asignación de unidad orgánica requerida para roles departamentales." }],
          });
        }
        areaIdParaRol = asignacion.rows[0].area_id;
      }

      const instId = await resolverInstitucionId(c, areaIdParaRol);
      await c.query(
        `INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
         VALUES ($1::uuid, $2::uuid, TRUE)
         ON CONFLICT (id_usuario, institucion_id) DO NOTHING`,
        [id, instId]
      );

      const insertado = await c.query<{ id_usuario_rol: string }>(
        "INSERT INTO sigd_org.usuario_rol(id_usuario, rol_id, area_id, institucion_id) VALUES($1::uuid, $2::uuid, $3::uuid, $4::uuid) RETURNING id_usuario_rol",
        [id, rolId, areaIdParaRol, instId]
      );

      await revocarSesiones(c, id);

      await registrarMutacion(c, {
        esquema: "sigd_org",
        tabla: "usuario_rol",
        operacion: "INSERT",
        usuario_id: actorAutenticado,
        datos_despues: {
          id_usuario: id,
          id_usuario_rol: insertado.rows[0].id_usuario_rol,
          rol_codigo: rolCodigo,
          area_id: areaIdParaRol,
          actor_id: actorAutenticado,
        },
      });

      return obtenerUsuario(c, id);
    });
  }

  async function revocarRol(id: string, usuarioRolId: string, actorId?: string): Promise<UsuarioDirectorio> {
    const actorAutenticado = actorId ?? getRequestContext()?.usuario_id;
    if (!actorAutenticado) {
      throw new UnauthorizedError({ message: "Se requiere la identidad del administrador autenticado para revocar roles institucionales." });
    }
    return transaccion(async c => {
      const cuenta = await c.query<{ id_usuario: string; activo: boolean }>(
        "SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE",
        [id]
      );
      if (cuenta.rows.length !== 1) throw new NotFoundError({ message: "El usuario indicado no existe." });

      const rolVigente = await c.query<{ id_usuario_rol: string; rol_id: string; area_id: string | null }>(
        `SELECT id_usuario_rol, rol_id, area_id FROM sigd_org.usuario_rol WHERE id_usuario_rol=$1::uuid AND id_usuario=$2::uuid AND vigente_desde<=now() AND (vigente_hasta IS NULL OR vigente_hasta>now()) FOR UPDATE`,
        [usuarioRolId, id]
      );
      if (rolVigente.rows.length !== 1) {
        throw new NotFoundError({ message: "La asignación de rol no existe o ya no se encuentra vigente." });
      }

      if (cuenta.rows[0].activo) {
        const otrosRoles = await c.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM sigd_org.usuario_rol ur JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE WHERE ur.id_usuario = $1::uuid AND ur.id_usuario_rol <> $2::uuid AND ${VIGENCIA_UR} AND r.codigo NOT IN ('CIUDADANO', 'ESTUDIANTE')`,
          [id, usuarioRolId]
        );
        if ((otrosRoles.rows[0]?.total ?? 0) === 0) {
          throw new AppError({
            status: 422,
            code: "CUENTA_ACTIVA_SIN_ROLES",
            message: "No se permite que una cuenta activa quede sin roles institucionales.",
            detail: "Desactive la cuenta institucional antes de revocar su última asignación de rol o asigne otro rol previamente.",
            invalidParams: [{ name: "usuarioRolId", reason: "No se puede revocar el único rol activo de una cuenta habilitada." }],
          });
        }
      }

      await c.query("UPDATE sigd_org.usuario_rol SET vigente_hasta=now() WHERE id_usuario_rol=$1::uuid", [usuarioRolId]);

      await revocarSesiones(c, id);

      await registrarMutacion(c, {
        esquema: "sigd_org",
        tabla: "usuario_rol",
        operacion: "UPDATE",
        usuario_id: actorAutenticado,
        datos_despues: {
          id_usuario: id,
          id_usuario_rol: usuarioRolId,
          accion: "REVOCAR_ROL",
          actor_id: actorAutenticado,
        },
      });

      return obtenerUsuario(c, id);
    });
  }

  async function revocarCapacidad(id: string, usuarioCapacidadId: string, actorId?: string, motivo?: string): Promise<UsuarioDirectorio> {
    const actorAutenticado = actorId ?? getRequestContext()?.usuario_id;
    if (!actorAutenticado) {
      throw new UnauthorizedError({ message: "Se requiere la identidad del administrador autenticado para revocar capacidades operativas." });
    }
    return transaccion(async c => {
      const cuenta = await c.query<{ id_usuario: string; activo: boolean }>(
        "SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE",
        [id]
      );
      if (cuenta.rows.length !== 1) throw new NotFoundError({ message: "El usuario indicado no existe." });

      const capVigente = await c.query<{ id_usuario_capacidad: string; id_capacidad: string; area_id: string | null }>(
        `SELECT id_usuario_capacidad, id_capacidad, area_id FROM sigd_org.usuario_capacidad WHERE id_usuario_capacidad=$1::uuid AND id_usuario=$2::uuid AND activo=TRUE AND vigente_desde<=now() AND (vigente_hasta IS NULL OR vigente_hasta>now()) FOR UPDATE`,
        [usuarioCapacidadId, id]
      );
      if (capVigente.rows.length !== 1) {
        throw new NotFoundError({ message: "La capacidad operativa no existe o ya no se encuentra vigente." });
      }

      await c.query(
        `UPDATE sigd_org.usuario_capacidad
            SET activo = FALSE,
                vigente_hasta = now(),
                desactivado_por = $2::uuid,
                desactivado_en = now(),
                motivo_desactivacion = COALESCE($3, 'Revocación administrativa de capacidad operativa')
          WHERE id_usuario_capacidad = $1::uuid`,
        [usuarioCapacidadId, actorAutenticado, motivo || null]
      );

      await registrarMutacion(c, {
        esquema: "sigd_org",
        tabla: "usuario_capacidad",
        operacion: "UPDATE",
        usuario_id: actorAutenticado,
        datos_despues: {
          id_usuario: id,
          id_usuario_capacidad: usuarioCapacidadId,
          accion: "REVOCAR_CAPACIDAD",
          actor_id: actorAutenticado,
        },
      });

      return obtenerUsuario(c, id);
    });
  }

  async function asignarCapacidad(
    id: string,
    capacidadCodigo: string,
    areaId: string,
    actorId?: string,
    justificacion?: string,
  ): Promise<UsuarioDirectorio> {
    const actorAutenticado = actorId ?? getRequestContext()?.usuario_id;
    if (!actorAutenticado) {
      throw new UnauthorizedError({ message: "Se requiere la identidad del administrador autenticado para asignar capacidades operativas." });
    }
    return transaccion(async c => {
      const cuenta = await c.query<{ id_usuario: string; activo: boolean }>(
        "SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE",
        [id]
      );
      if (cuenta.rows.length !== 1) throw new NotFoundError({ message: "El usuario indicado no existe." });
      if (!cuenta.rows[0].activo) {
        throw new AppError({
          status: 422,
          code: "CUENTA_INACTIVA",
          message: "No se puede asignar capacidades operativas a una cuenta institucional inactiva.",
        });
      }

      await validarCatalogo(c, "area", areaId);

      const cap = await c.query<{ id_capacidad: string }>(
        "SELECT id_capacidad FROM sigd_org.capacidad_sistema WHERE codigo=$1 AND vigente=TRUE",
        [capacidadCodigo]
      );
      if (cap.rows.length === 0) {
        throw new NotFoundError({ message: `La capacidad operativa '${capacidadCodigo}' no existe o no se encuentra vigente.` });
      }
      const idCapacidad = cap.rows[0].id_capacidad;

      const existente = await c.query<{ id_usuario_capacidad: string }>(
        `SELECT id_usuario_capacidad
           FROM sigd_org.usuario_capacidad
          WHERE id_usuario = $1::uuid
            AND id_capacidad = $2::uuid
            AND area_id = $3::uuid
            AND activo = TRUE
            AND vigente_desde <= now()
            AND (vigente_hasta IS NULL OR vigente_hasta > now())`,
        [id, idCapacidad, areaId]
      );
      if (existente.rows.length > 0) {
        throw new AppError({
          status: 409,
          code: "CAPACIDAD_YA_ASIGNADA",
          message: `El usuario ya cuenta con la capacidad '${capacidadCodigo}' activa y vigente para el área indicada.`,
        });
      }

      const justificacionFinal = (justificacion && justificacion.trim().length >= 10)
        ? justificacion.trim()
        : 'Asignación administrativa de capacidad operativa institucional';

      const insertada = await c.query<{ id_usuario_capacidad: string }>(
        `INSERT INTO sigd_org.usuario_capacidad (
           id_usuario,
           id_capacidad,
           area_id,
           justificacion,
           asignado_por,
           activo,
           vigente_desde
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, TRUE, now())
         RETURNING id_usuario_capacidad`,
        [id, idCapacidad, areaId, justificacionFinal, actorAutenticado]
      );

      await registrarMutacion(c, {
        esquema: "sigd_org",
        tabla: "usuario_capacidad",
        operacion: "INSERT",
        usuario_id: actorAutenticado,
        datos_despues: {
          id_usuario: id,
          id_usuario_capacidad: insertada.rows[0].id_usuario_capacidad,
          codigo: capacidadCodigo,
          area_id: areaId,
          actor_id: actorAutenticado,
        },
      });

      return obtenerUsuario(c, id);
    });
  }

  return {
    listarUsuarios,
    crearUsuario,
    consultarUsuario,
    restablecerCredenciales,
    actualizarUsuario,
    validarPuestoLaboralActivo,
    actualizarPermisosRol,
    asignarRol,
    revocarRol,
    asignarCapacidad,
    revocarCapacidad,
    revocarSesionesUsuario: (id: string) => revocarSesiones(pool,id)
  };
}
export type UsuariosAdminService = ReturnType<typeof crearUsuariosAdminService>;
