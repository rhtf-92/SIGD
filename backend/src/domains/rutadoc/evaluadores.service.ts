import type { Pool, PoolClient } from 'pg';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type {
  AsignarEvaluadorDTO,
  ReasignarEvaluadorDTO,
  ReasignacionMasivaDTO,
} from './dto/asignarEvaluador.dto.js';
import type {
  ObservarEvaluacionDTO,
  SubsanarExpedienteDTO,
  EmitirDictamenPayload,
  FiltrosBandejaDocenteDTO,
} from './dto/evaluacionDocente.dto.js';

export interface EvaluadorActivoInfo {
  idAsignacion: string;
  idUsuarioDocente: string;
  docenteNombre: string;
  docenteEmail: string;
  areaId: string;
  areaNombre?: string;
  asignadoPor: string;
  asignadorNombre?: string;
  motivoAsignacion: string;
  esReasignacion: boolean;
  justificacionReasignacion?: string | null;
  asignadoEn: string;
  estadoEvaluacion: string;
  observaciones?: string | null;
}

export interface HistorialEvaluadorItem {
  idAsignacion: string;
  idUsuarioDocente: string;
  docenteNombre: string;
  docenteEmail: string;
  areaId: string;
  asignadoPor: string;
  asignadorNombre?: string;
  motivoAsignacion: string;
  esReasignacion: boolean;
  justificacionReasignacion?: string | null;
  asignacionAnteriorId?: string | null;
  activo: boolean;
  asignadoEn: string;
  estadoEvaluacion: string;
  desactivadoPor?: string | null;
  desactivadorNombre?: string | null;
  desactivadoEn?: string | null;
  motivoDesasignacion?: string | null;
  observaciones?: string | null;
}

export interface DocenteElegible {
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
  rol: string;
  areaId?: string | null;
  areaNombre?: string | null;
}

/**
 * Valida si el actor cuenta con el permiso requerido (GLOBAL o AREA para el área especificada).
 */
function validarPermisoActor(
  actor: ActorRutaDoc,
  codigoPermiso: 'EXPEDIENTE_ASIGNAR' | 'EXPEDIENTE_REASIGNAR',
  areaIdExpediente: string | null,
): void {
  const permisos = actor.permisos ?? [];
  const tieneGlobal = permisos.some(
    (p) => p.codigo === codigoPermiso && p.ambito === 'GLOBAL' && p.areaId === null,
  );
  if (tieneGlobal) return;

  if (areaIdExpediente) {
    const tieneArea = permisos.some(
      (p) => p.codigo === codigoPermiso && p.ambito === 'AREA' && p.areaId === areaIdExpediente,
    );
    if (tieneArea) return;
  }

  // Si el actor tiene unidadOrganicaId que coincide con el área del expediente
  if (areaIdExpediente && actor.unidadOrganicaId === areaIdExpediente) {
    const tienePermisoGeneral = permisos.some((p) => p.codigo === codigoPermiso);
    if (tienePermisoGeneral) return;
  }

  throw new ForbiddenError({
    message: `No cuenta con facultades (${codigoPermiso}) para gestionar evaluadores en el ámbito de este expediente.`,
  });
}

/**
 * Obtiene el área efectiva actual del expediente.
 */
async function obtenerAreaActualExpediente(
  cliente: PoolClient,
  expedienteId: string,
): Promise<{ areaId: string; codigoExpediente: string; solicitanteId: string }> {
  const query = await cliente.query<{
    area_actual: string | null;
    codigo_expediente: string;
    solicitante_id: string;
  }>(
    `SELECT COALESCE(
              NULLIF(ultimo.area_actual_id, ''),
              (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'SEC')
            ) AS area_actual,
            e.codigo_expediente,
            e.solicitante_id::text
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
      WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (query.rowCount === 0) {
    throw new NotFoundError({ message: 'Expediente no encontrado.' });
  }

  const fila = query.rows[0];
  const areaId = fila.area_actual;
  if (!areaId) {
    throw new ValidationError({
      invalidParams: [{ name: 'expedienteId', reason: 'El expediente no tiene un área operativa asignada.' }],
    });
  }

  return {
    areaId,
    codigoExpediente: fila.codigo_expediente,
    solicitanteId: fila.solicitante_id,
  };
}

/**
 * Asigna un docente evaluador a un expediente por primera vez.
 */
export async function asignarEvaluador(
  cliente: PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
  datos: AsignarEvaluadorDTO,
): Promise<{ ok: boolean; mensaje: string; idAsignacion: string; asignadoEn: string }> {
  const { areaId, codigoExpediente, solicitanteId } = await obtenerAreaActualExpediente(cliente, expedienteId);

  validarPermisoActor(actor, 'EXPEDIENTE_ASIGNAR', areaId);

  // Verificar si ya cuenta con un evaluador activo
  const asignacionActiva = await cliente.query<{ id_asignacion: string }>(
    `SELECT id_asignacion FROM sigd_rut.expediente_evaluador WHERE expediente_id = $1::uuid AND activo = TRUE`,
    [expedienteId],
  );

  if (asignacionActiva.rowCount && asignacionActiva.rowCount > 0) {
    throw new ConflictError({
      message: 'El expediente ya cuenta con un evaluador activo. Utilice la operación de reasignación con justificación.',
    });
  }

  // Prevenir conflicto de intereses (solicitante no puede ser evaluador)
  const personaDocente = await cliente.query<{ id_persona: string; activo: boolean }>(
    `SELECT id_persona::text, activo FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
    [datos.idUsuarioDocente],
  );

  if (personaDocente.rowCount === 0 || !personaDocente.rows[0].activo) {
    throw new ValidationError({
      invalidParams: [{ name: 'idUsuarioDocente', reason: 'La cuenta del docente no existe o se encuentra inactiva.' }],
    });
  }

  if (personaDocente.rows[0].id_persona === solicitanteId) {
    throw new ConflictError({
      message: 'Conflicto de interés normativo: El solicitante del trámite no puede ser designado evaluador del mismo expediente.',
    });
  }

  // Inserción de la asignación inicial (tr_expediente_evaluador_integridad validará rol canónico en DB)
  const res = await cliente.query<{ id_asignacion: string; asignado_en: Date }>(
    `INSERT INTO sigd_rut.expediente_evaluador (
       expediente_id, id_usuario_docente, area_id, asignado_por,
       motivo_asignacion, es_reasignacion, activo, estado_evaluacion, observaciones
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid,
       $5, FALSE, TRUE, 'PENDIENTE', $6
     ) RETURNING id_asignacion, asignado_en`,
    [
      expedienteId,
      datos.idUsuarioDocente,
      areaId,
      actor.id,
      datos.motivoAsignacion.trim(),
      datos.observaciones?.trim() || null,
    ],
  );

  const asignacion = res.rows[0];

  // Registro del evento en el Outbox transaccional
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteEvaluadorAsignado',
    payload: {
      identidad: {
        expediente_id: expedienteId,
        asignacion_id: asignacion.id_asignacion,
        cut: codigoExpediente,
      },
      contexto: {
        usuario_actor_id: actor.id,
        area_contexto_id: areaId,
        id_usuario_docente: datos.idUsuarioDocente,
      },
      datos_especificos: {
        motivo_asignacion: datos.motivoAsignacion.trim(),
        observaciones: datos.observaciones?.trim() || null,
      },
    },
  });

  return {
    ok: true,
    mensaje: 'Docente evaluador asignado exitosamente al expediente.',
    idAsignacion: asignacion.id_asignacion,
    asignadoEn: asignacion.asignado_en.toISOString(),
  };
}

/**
 * Reasigna un expediente a un nuevo docente evaluador, desactivando la asignación previa
 * y conservando la trazabilidad append-only obligatoria.
 */
export async function reasignarEvaluador(
  cliente: PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
  datos: ReasignarEvaluadorDTO,
): Promise<{
  ok: boolean;
  mensaje: string;
  idAsignacion: string;
  evaluadorAnteriorId: string;
  nuevoEvaluadorId: string;
}> {
  if (!datos.justificacionReasignacion || datos.justificacionReasignacion.trim().length < 10) {
    throw new ValidationError({
      invalidParams: [
        {
          name: 'justificacionReasignacion',
          reason: 'La justificación de reasignación debe tener al menos 10 caracteres conforme a normativa.',
        },
      ],
    });
  }

  const { areaId, codigoExpediente, solicitanteId } = await obtenerAreaActualExpediente(cliente, expedienteId);

  validarPermisoActor(actor, 'EXPEDIENTE_REASIGNAR', areaId);

  // Obtener la asignación activa previa
  const asignacionPrevia = await cliente.query<{
    id_asignacion: string;
    id_usuario_docente: string;
  }>(
    `SELECT id_asignacion, id_usuario_docente::text
       FROM sigd_rut.expediente_evaluador
      WHERE expediente_id = $1::uuid AND activo = TRUE`,
    [expedienteId],
  );

  if (asignacionPrevia.rowCount === 0) {
    throw new NotFoundError({
      message: 'El expediente no cuenta con una asignación activa previa para reasignar. Utilice la asignación inicial.',
    });
  }

  const previa = asignacionPrevia.rows[0];

  if (previa.id_usuario_docente === datos.idNuevoDocente) {
    throw new ValidationError({
      invalidParams: [
        { name: 'idNuevoDocente', reason: 'El nuevo evaluador debe ser diferente al evaluador actualmente asignado.' },
      ],
    });
  }

  // Verificar nuevo docente
  const personaDocente = await cliente.query<{ id_persona: string; activo: boolean }>(
    `SELECT id_persona::text, activo FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
    [datos.idNuevoDocente],
  );

  if (personaDocente.rowCount === 0 || !personaDocente.rows[0].activo) {
    throw new ValidationError({
      invalidParams: [{ name: 'idNuevoDocente', reason: 'La cuenta del nuevo docente no existe o está inactiva.' }],
    });
  }

  if (personaDocente.rows[0].id_persona === solicitanteId) {
    throw new ConflictError({
      message: 'Conflicto de interés normativo: El solicitante del trámite no puede ser designado evaluador del mismo expediente.',
    });
  }

  // 1. Desactivar evaluador previo (append-only: no se elimina, se marca estado REASIGNADA)
  await cliente.query(
    `UPDATE sigd_rut.expediente_evaluador
        SET activo = FALSE,
            desactivado_por = $1::uuid,
            desactivado_en = now(),
            motivo_desasignacion = $2,
            estado_evaluacion = 'REASIGNADA'
      WHERE id_asignacion = $3::uuid`,
    [
      actor.id,
      `Reasignado a nuevo evaluador. Justificación: ${datos.justificacionReasignacion.trim()}`,
      previa.id_asignacion,
    ],
  );

  // 2. Insertar nueva asignación enlazada a la anterior
  const resNueva = await cliente.query<{ id_asignacion: string; asignado_en: Date }>(
    `INSERT INTO sigd_rut.expediente_evaluador (
       expediente_id, id_usuario_docente, area_id, asignado_por,
       motivo_asignacion, es_reasignacion, justificacion_reasignacion,
       asignacion_anterior_id, activo, estado_evaluacion, observaciones
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid,
       $5, TRUE, $6,
       $7::uuid, TRUE, 'PENDIENTE', $8
     ) RETURNING id_asignacion, asignado_en`,
    [
      expedienteId,
      datos.idNuevoDocente,
      areaId,
      actor.id,
      datos.motivoAsignacion.trim(),
      datos.justificacionReasignacion.trim(),
      previa.id_asignacion,
      datos.observaciones?.trim() || null,
    ],
  );

  const nueva = resNueva.rows[0];

  // 3. Evento Outbox
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteEvaluadorReasignado',
    payload: {
      identidad: {
        expediente_id: expedienteId,
        asignacion_id: nueva.id_asignacion,
        asignacion_anterior_id: previa.id_asignacion,
        cut: codigoExpediente,
      },
      contexto: {
        usuario_actor_id: actor.id,
        area_contexto_id: areaId,
        evaluador_anterior_id: previa.id_usuario_docente,
        nuevo_evaluador_id: datos.idNuevoDocente,
      },
      datos_especificos: {
        motivo_asignacion: datos.motivoAsignacion.trim(),
        justificacion_reasignacion: datos.justificacionReasignacion.trim(),
        observaciones: datos.observaciones?.trim() || null,
      },
    },
  });

  return {
    ok: true,
    mensaje: 'Expediente reasignado exitosamente al nuevo evaluador.',
    idAsignacion: nueva.id_asignacion,
    evaluadorAnteriorId: previa.id_usuario_docente,
    nuevoEvaluadorId: datos.idNuevoDocente,
  };
}

/**
 * Reasignación masiva en lote para múltiples expedientes.
 */
export async function reasignarMasivo(
  cliente: PoolClient,
  actor: ActorRutaDoc,
  datos: ReasignacionMasivaDTO,
): Promise<{
  ok: boolean;
  mensaje: string;
  total: number;
  exitosos: number;
  fallidos: number;
  resultados: Array<{
    expedienteId: string;
    ok: boolean;
    idAsignacion?: string;
    evaluadorAnteriorId?: string;
    error?: string;
  }>;
}> {
  const resultados: Array<{
    expedienteId: string;
    ok: boolean;
    idAsignacion?: string;
    evaluadorAnteriorId?: string;
    error?: string;
  }> = [];

  for (const expId of datos.expedienteIds) {
    try {
      const res = await reasignarEvaluador(cliente, expId, actor, {
        idNuevoDocente: datos.idNuevoDocente,
        motivoAsignacion: datos.motivoAsignacion,
        justificacionReasignacion: datos.justificacionReasignacion,
        observaciones: datos.observaciones,
      });
      resultados.push({
        expedienteId: expId,
        ok: true,
        idAsignacion: res.idAsignacion,
        evaluadorAnteriorId: res.evaluadorAnteriorId,
      });
    } catch (err) {
      resultados.push({
        expedienteId: expId,
        ok: false,
        error: err instanceof Error ? err.message : 'Error desconocido al reasignar.',
      });
    }
  }

  const exitosos = resultados.filter((r) => r.ok).length;
  const fallidos = resultados.filter((r) => !r.ok).length;

  return {
    ok: fallidos === 0,
    mensaje: `Reasignación masiva procesada: ${exitosos} exitosos, ${fallidos} rechazados.`,
    total: datos.expedienteIds.length,
    exitosos,
    fallidos,
    resultados,
  };
}

/**
 * Obtiene el evaluador activo actual de un expediente.
 */
export async function obtenerEvaluadorActivo(
  pool: Pool,
  expedienteId: string,
): Promise<EvaluadorActivoInfo | null> {
  const res = await pool.query<{
    id_asignacion: string;
    id_usuario_docente: string;
    docente_nombre: string;
    docente_email: string;
    area_id: string;
    area_nombre: string;
    asignado_por: string;
    asignador_nombre: string;
    motivo_asignacion: string;
    es_reasignacion: boolean;
    justificacion_reasignacion: string | null;
    asignado_en: Date;
    estado_evaluacion: string;
    observaciones: string | null;
  }>(
    `SELECT ee.id_asignacion::text,
            ee.id_usuario_docente::text,
            COALESCE(cu_doc.usuario, cu_doc.correo) AS docente_nombre,
            cu_doc.correo AS docente_email,
            ee.area_id::text,
            a.nombre AS area_nombre,
            ee.asignado_por::text,
            COALESCE(cu_asig.usuario, cu_asig.correo) AS asignador_nombre,
            ee.motivo_asignacion,
            ee.es_reasignacion,
            ee.justificacion_reasignacion,
            ee.asignado_en,
            ee.estado_evaluacion,
            ee.observaciones
       FROM sigd_rut.expediente_evaluador ee
       JOIN sigd_auth.cuenta_usuario cu_doc ON cu_doc.id_usuario = ee.id_usuario_docente
       JOIN sigd_auth.cuenta_usuario cu_asig ON cu_asig.id_usuario = ee.asignado_por
       LEFT JOIN sigd_org.area a ON a.area_id = ee.area_id
      WHERE ee.expediente_id = $1::uuid AND ee.activo = TRUE`,
    [expedienteId],
  );

  if (res.rowCount === 0) return null;
  const f = res.rows[0];

  return {
    idAsignacion: f.id_asignacion,
    idUsuarioDocente: f.id_usuario_docente,
    docenteNombre: f.docente_nombre,
    docenteEmail: f.docente_email,
    areaId: f.area_id,
    areaNombre: f.area_nombre,
    asignadoPor: f.asignado_por,
    asignadorNombre: f.asignador_nombre,
    motivoAsignacion: f.motivo_asignacion,
    esReasignacion: f.es_reasignacion,
    justificacionReasignacion: f.justificacion_reasignacion,
    asignadoEn: f.asignado_en.toISOString(),
    estadoEvaluacion: f.estado_evaluacion,
    observaciones: f.observaciones,
  };
}

/**
 * Consulta el historial cronológico completo de evaluadores asignados al expediente.
 */
export async function listarHistorialEvaluadores(
  pool: Pool,
  expedienteId: string,
): Promise<HistorialEvaluadorItem[]> {
  const res = await pool.query<{
    id_asignacion: string;
    id_usuario_docente: string;
    docente_nombre: string;
    docente_email: string;
    area_id: string;
    asignado_por: string;
    asignador_nombre: string;
    motivo_asignacion: string;
    es_reasignacion: boolean;
    justificacion_reasignacion: string | null;
    asignacion_anterior_id: string | null;
    activo: boolean;
    asignado_en: Date;
    estado_evaluacion: string;
    desactivado_por: string | null;
    desactivador_nombre: string | null;
    desactivado_en: Date | null;
    motivo_desasignacion: string | null;
    observaciones: string | null;
  }>(
    `SELECT ee.id_asignacion::text,
            ee.id_usuario_docente::text,
            COALESCE(cu_doc.usuario, cu_doc.correo) AS docente_nombre,
            cu_doc.correo AS docente_email,
            ee.area_id::text,
            ee.asignado_por::text,
            COALESCE(cu_asig.usuario, cu_asig.correo) AS asignador_nombre,
            ee.motivo_asignacion,
            ee.es_reasignacion,
            ee.justificacion_reasignacion,
            ee.asignacion_anterior_id::text,
            ee.activo,
            ee.asignado_en,
            ee.estado_evaluacion,
            ee.desactivado_por::text,
            COALESCE(cu_des.usuario, cu_des.correo) AS desactivador_nombre,
            ee.desactivado_en,
            ee.motivo_desasignacion,
            ee.observaciones
       FROM sigd_rut.expediente_evaluador ee
       JOIN sigd_auth.cuenta_usuario cu_doc ON cu_doc.id_usuario = ee.id_usuario_docente
       JOIN sigd_auth.cuenta_usuario cu_asig ON cu_asig.id_usuario = ee.asignado_por
       LEFT JOIN sigd_auth.cuenta_usuario cu_des ON cu_des.id_usuario = ee.desactivado_por
      WHERE ee.expediente_id = $1::uuid
      ORDER BY ee.asignado_en ASC`,
    [expedienteId],
  );

  return res.rows.map((f) => ({
    idAsignacion: f.id_asignacion,
    idUsuarioDocente: f.id_usuario_docente,
    docenteNombre: f.docente_nombre,
    docenteEmail: f.docente_email,
    areaId: f.area_id,
    asignadoPor: f.asignado_por,
    asignadorNombre: f.asignador_nombre,
    motivoAsignacion: f.motivo_asignacion,
    esReasignacion: f.es_reasignacion,
    justificacionReasignacion: f.justificacion_reasignacion,
    asignacionAnteriorId: f.asignacion_anterior_id,
    activo: f.activo,
    asignadoEn: f.asignado_en.toISOString(),
    estadoEvaluacion: f.estado_evaluacion,
    desactivadoPor: f.desactivado_por,
    desactivadorNombre: f.desactivador_nombre,
    desactivadoEn: f.desactivado_en ? f.desactivado_en.toISOString() : null,
    motivoDesasignacion: f.motivo_desasignacion,
    observaciones: f.observaciones,
  }));
}

/**
 * Lista los docentes elegibles para recibir asignaciones en el área académica.
 */
export async function listarDocentesElegibles(
  pool: Pool,
  areaId?: string | null,
): Promise<DocenteElegible[]> {
  const params: unknown[] = [];
  let filtroArea = '';
  if (areaId) {
    params.push(areaId);
    filtroArea = `AND (ur.area_id = $1::uuid OR ur.area_id IS NULL)`;
  }

  const res = await pool.query<{
    id_usuario: string;
    nombre_completo: string;
    correo: string;
    rol: string;
    area_id: string | null;
    area_nombre: string | null;
  }>(
    `SELECT DISTINCT cu.id_usuario::text,
            COALESCE(cu.usuario, cu.correo) AS nombre_completo,
            cu.correo,
            r.codigo AS rol,
            ur.area_id::text,
            a.nombre AS area_nombre
       FROM sigd_auth.cuenta_usuario cu
       JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario
        AND ur.vigente_desde <= now()
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        ${filtroArea}
       JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
       LEFT JOIN sigd_org.area a ON a.area_id = ur.area_id
      WHERE cu.activo = TRUE
        AND r.codigo IN ('DOCENTE', 'COORDINADOR_AREA', 'JEFE_UNIDAD_ACADEMICA', 'SECRETARIO')
      ORDER BY nombre_completo ASC`,
    params,
  );

  return res.rows.map((f) => ({
    idUsuario: f.id_usuario,
    nombreCompleto: f.nombre_completo,
    correo: f.correo,
    rol: f.rol,
    areaId: f.area_id,
    areaNombre: f.area_nombre,
  }));
}


function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

async function resolverOperadorId(
  cliente: PoolClient,
  usuarioActorId: string,
): Promise<string | bigint> {
  const colInfo = await cliente.query<{ data_type: string }>(`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'sigd_rut'
      AND table_name = 'movimiento_tramite'
      AND column_name = 'usuario_operador_id'
  `);
  const tipoColumna = colInfo.rows[0]?.data_type?.toLowerCase() ?? 'bigint';

  if (tipoColumna === 'uuid') {
    return usuarioActorId;
  }
  if (/^\d+$/.test(usuarioActorId)) {
    return BigInt(usuarioActorId);
  }

  try {
    const resMapeo = await cliente.query<{ operador_id: string }>(`
      SELECT operador_id::text
      FROM sigd_auth.operador_identidad
      WHERE id_usuario = $1::uuid
    `, [usuarioActorId]);
    if (resMapeo?.rows?.[0]?.operador_id) {
      return BigInt(resMapeo.rows[0].operador_id);
    }
  } catch {
    // fallback
  }

  try {
    const numHash = BigInt(990000000) + BigInt(Math.abs(hashString(usuarioActorId)) % 100000);
    await cliente.query(`
      INSERT INTO sigd_auth.operador_identidad (id_usuario, operador_id)
      VALUES ($1::uuid, $2)
      ON CONFLICT (id_usuario) DO NOTHING
    `, [usuarioActorId, numHash.toString()]);
    return numHash;
  } catch {
    return BigInt(990000001);
  }
}

export interface EvaluacionBandejaDocenteItem {
  idAsignacion: string;
  expedienteId: string;
  codigoExpediente: string;
  asunto: string;
  estadoExpediente: string;
  estadoEvaluacion: string;
  asignadoEn: string;
  confirmadoRecepcionEn: string | null;
  evaluacionConcluidaEn: string | null;
  resultadoEvaluacion: string | null;
  motivoAsignacion: string;
  observaciones: string | null;
  areaId: string;
  areaNombre: string | null;
  solicitanteNombre: string;
}

export interface ResumenBandejaDocente {
  nuevos: number;
  enEvaluacion: number;
  observados: number;
  subsanados: number;
  concluidos: number;
}

/**
 * Valida simultáneamente los requisitos institucionales para evaluación técnica:
 * 1. Identidad autenticada.
 * 2. Rol institucional DOCENTE.
 * 3. Permiso institucional EXPEDIENTE_EVALUAR.
 */
function validarFacultadDocente(actor: ActorRutaDoc): void {
  if (!actor.id) {
    throw new UnauthorizedError({ message: 'Identidad del usuario no autenticada.' });
  }

  const esDocente = actor.roles?.includes('DOCENTE');
  if (!esDocente) {
    throw new ForbiddenError({
      message: 'Acceso denegado: solo los usuarios con rol institucional DOCENTE pueden ejecutar evaluaciones técnicas.',
    });
  }

  const tienePermisoEvaluar =
    actor.permisos === undefined ||
    actor.permisos.some((p) => p.codigo === 'EXPEDIENTE_EVALUAR');

  if (!tienePermisoEvaluar) {
    throw new ForbiddenError({
      message: 'Acceso denegado: el docente no cuenta con la facultad EXPEDIENTE_EVALUAR.',
    });
  }
}

/**
 * HITO 1: Bandeja funcional del docente.
 * Lista los expedientes asignados al docente autenticado con filtros y conteos.
 */
export async function listarMisEvaluaciones(
  pool: Pool,
  actor: ActorRutaDoc,
  filtros: FiltrosBandejaDocenteDTO,
): Promise<{
  ok: boolean;
  total: number;
  resumen: ResumenBandejaDocente;
  evaluaciones: EvaluacionBandejaDocenteItem[];
}> {
  validarFacultadDocente(actor);

  const params: unknown[] = [actor.id];
  let conditions = `ee.id_usuario_docente = $1::uuid AND ee.activo = TRUE`;

  if (filtros.estadoEvaluacion) {
    params.push(filtros.estadoEvaluacion);
    conditions += ` AND ee.estado_evaluacion = $${params.length}`;
  }

  if (filtros.estadoExpediente) {
    params.push(filtros.estadoExpediente);
    conditions += ` AND COALESCE(ultimo.estado_nuevo, e.estado) = $${params.length}`;
  }

  if (filtros.codigoExpediente) {
    params.push(`%${filtros.codigoExpediente.trim()}%`);
    conditions += ` AND e.codigo_expediente ILIKE $${params.length}`;
  }

  if (filtros.fechaDesde) {
    params.push(filtros.fechaDesde);
    conditions += ` AND ee.asignado_en >= $${params.length}::timestamptz`;
  }

  if (filtros.fechaHasta) {
    params.push(filtros.fechaHasta);
    conditions += ` AND ee.asignado_en <= $${params.length}::timestamptz`;
  }

  const querySql = `
    SELECT ee.id_asignacion,
           ee.expediente_id,
           e.codigo_expediente,
           COALESCE(t.asunto, e.asunto, 'Sin asunto especificado') AS asunto,
           COALESCE(ultimo.estado_nuevo, e.estado) AS estado_expediente,
           ee.estado_evaluacion,
           ee.asignado_en,
           ee.confirmado_recepcion_en,
           ee.evaluacion_concluida_en,
           ee.resultado_evaluacion,
           ee.motivo_asignacion,
           ee.observaciones,
           ee.area_id,
           a.nombre AS area_nombre,
           COALESCE(pn.nombre_completo, e.solicitante_id::text) AS solicitante_nombre
      FROM sigd_rut.expediente_evaluador ee
      JOIN sigd_tra.expediente e ON e.expediente_id = ee.expediente_id
      LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
      LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
      LEFT JOIN sigd_org.area a ON a.area_id = ee.area_id
      LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
     WHERE ${conditions}
     ORDER BY ee.asignado_en DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const queryParams = [...params, filtros.limite, filtros.offset];
  const res = await pool.query<{
    id_asignacion: string;
    expediente_id: string;
    codigo_expediente: string;
    asunto: string;
    estado_expediente: string;
    estado_evaluacion: string;
    asignado_en: Date;
    confirmado_recepcion_en: Date | null;
    evaluacion_concluida_en: Date | null;
    resultado_evaluacion: string | null;
    motivo_asignacion: string;
    observaciones: string | null;
    area_id: string;
    area_nombre: string | null;
    solicitante_nombre: string;
  }>(querySql, queryParams);

  // Conteos resumen para la bandeja
  const resumenQuery = await pool.query<{
    nuevos: string;
    en_evaluacion: string;
    observados: string;
    subsanados: string;
    concluidos: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE ee.estado_evaluacion = 'PENDIENTE')::text AS nuevos,
       COUNT(*) FILTER (WHERE ee.estado_evaluacion = 'EN_EVALUACION')::text AS en_evaluacion,
       COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'OBSERVADO')::text AS observados,
       COUNT(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'SUBSANADO')::text AS subsanados,
       COUNT(*) FILTER (WHERE ee.estado_evaluacion = 'CONCLUIDA')::text AS concluidos
      FROM sigd_rut.expediente_evaluador ee
      JOIN sigd_tra.expediente e ON e.expediente_id = ee.expediente_id
      LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
     WHERE ee.id_usuario_docente = $1::uuid AND ee.activo = TRUE`,
    [actor.id],
  );

  const filaResumen = resumenQuery.rows[0] ?? {
    nuevos: '0',
    en_evaluacion: '0',
    observados: '0',
    subsanados: '0',
    concluidos: '0',
  };

  const evaluaciones: EvaluacionBandejaDocenteItem[] = res.rows.map((f) => ({
    idAsignacion: f.id_asignacion,
    expedienteId: f.expediente_id,
    codigoExpediente: f.codigo_expediente,
    asunto: f.asunto,
    estadoExpediente: f.estado_expediente,
    estadoEvaluacion: f.estado_evaluacion,
    asignadoEn: f.asignado_en.toISOString(),
    confirmadoRecepcionEn: f.confirmado_recepcion_en ? f.confirmado_recepcion_en.toISOString() : null,
    evaluacionConcluidaEn: f.evaluacion_concluida_en ? f.evaluacion_concluida_en.toISOString() : null,
    resultadoEvaluacion: f.resultado_evaluacion,
    motivoAsignacion: f.motivo_asignacion,
    observaciones: f.observaciones,
    areaId: f.area_id,
    areaNombre: f.area_nombre,
    solicitanteNombre: f.solicitante_nombre,
  }));

  return {
    ok: true,
    total: res.rowCount ?? 0,
    resumen: {
      nuevos: Number.parseInt(filaResumen.nuevos, 10),
      enEvaluacion: Number.parseInt(filaResumen.en_evaluacion, 10),
      observados: Number.parseInt(filaResumen.observados, 10),
      subsanados: Number.parseInt(filaResumen.subsanados, 10),
      concluidos: Number.parseInt(filaResumen.concluidos, 10),
    },
    evaluaciones,
  };
}

/**
 * HITO 2: Recepción e inicio de evaluación.
 * El docente confirma la recepción del expediente asignado e inicia su evaluación técnica.
 */
export async function iniciarEvaluacion(
  cliente: PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
): Promise<{ ok: boolean; mensaje: string; estadoEvaluacion: string; confirmadoEn: string }> {
  validarFacultadDocente(actor);

  const asignacionRes = await cliente.query<{
    id_asignacion: string;
    id_usuario_docente: string;
    confirmado_recepcion_en: Date | null;
    estado_evaluacion: string;
    area_id: string;
  }>(
    `SELECT id_asignacion, id_usuario_docente, confirmado_recepcion_en, estado_evaluacion, area_id
       FROM sigd_rut.expediente_evaluador
      WHERE expediente_id = $1::uuid AND activo = TRUE`,
    [expedienteId],
  );

  if (asignacionRes.rowCount === 0) {
    throw new NotFoundError({ message: 'El expediente no cuenta con una asignación activa.' });
  }

  const asig = asignacionRes.rows[0];
  if (asig.id_usuario_docente !== actor.id) {
    throw new ForbiddenError({
      message: 'Solo el docente evaluador asignado puede iniciar la evaluación de este expediente.',
    });
  }

  if (['CONCLUIDA', 'REVOCADA', 'REASIGNADA'].includes(asig.estado_evaluacion)) {
    throw new ConflictError({
      message: `No se puede iniciar una evaluación en estado '${asig.estado_evaluacion}'.`,
    });
  }

  const updateRes = await cliente.query<{ confirmado_recepcion_en: Date }>(
    `UPDATE sigd_rut.expediente_evaluador
        SET confirmado_recepcion_en = COALESCE(confirmado_recepcion_en, now()),
            estado_evaluacion = 'EN_EVALUACION'
      WHERE id_asignacion = $1::uuid
      RETURNING confirmado_recepcion_en`,
    [asig.id_asignacion],
  );

  const confirmadoEn = updateRes.rows[0]?.confirmado_recepcion_en
    ? updateRes.rows[0].confirmado_recepcion_en.toISOString()
    : new Date().toISOString();

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'EvaluacionIniciadaDocente',
    payload: {
      identidad: {
        expediente_id: expedienteId,
        asignacion_id: asig.id_asignacion,
      },
      contexto: {
        usuario_actor_id: actor.id,
        area_id: asig.area_id,
      },
      datos_especificos: {
        confirmado_en: confirmadoEn,
        estado_evaluacion: 'EN_EVALUACION',
      },
    },
  });

  return {
    ok: true,
    mensaje: 'Evaluación técnica iniciada exitosamente por el docente.',
    estadoEvaluacion: 'EN_EVALUACION',
    confirmadoEn,
  };
}

/**
 * HITO 3: Consulta integral del expediente para evaluación documental y revisión de requisitos.
 */
export async function obtenerDetalleEvaluacion(
  pool: Pool,
  expedienteId: string,
  actor: ActorRutaDoc,
): Promise<{
  ok: boolean;
  expediente: {
    id: string;
    codigo: string;
    asunto: string;
    estado: string;
    fechaRadicacion: string;
    solicitante: {
      id: string;
      nombreCompleto: string;
      dni: string | null;
      correo: string | null;
    };
  };
  asignacion: EvaluadorActivoInfo | null;
  requisitos: Array<{
    idRequisito: string;
    descripcion: string;
    cumplido: boolean;
    verificadoEn: string | null;
  }>;
  documentosAdjuntos: Array<{
    id: string;
    nombreOriginal: string;
    hashSha256: string;
    tamanioBytes: number;
    creadoEn: string;
  }>;
  historialEvaluacion: Array<{
    fecha: string;
    actorId: string;
    tipo: string;
    descripcion: string;
  }>;
}> {
  const expRes = await pool.query<{
    expediente_id: string;
    codigo_expediente: string;
    asunto: string | null;
    estado: string;
    fecha_radicacion: Date;
    solicitante_id: string;
    dni_solicitante: string | null;
    nombre_solicitante: string | null;
    correo_solicitante: string | null;
  }>(
    `SELECT e.expediente_id,
            e.codigo_expediente,
            COALESCE(t.asunto, e.asunto, 'Sin asunto') AS asunto,
            COALESCE(ultimo.estado_nuevo, e.estado) AS estado,
            e.fecha_radicacion,
            e.solicitante_id::text,
            e.dni_solicitante,
            pn.nombre_completo AS nombre_solicitante,
            pn.correo AS correo_solicitante
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
       LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
      WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (expRes.rowCount === 0) {
    throw new NotFoundError({ message: 'Expediente no encontrado.' });
  }

  const expFila = expRes.rows[0];

  const asignacion = await obtenerEvaluadorActivo(pool, expedienteId);

  const esDocenteAsignado = asignacion?.idUsuarioDocente === actor.id;
  const esCoordinador = actor.roles?.includes('COORDINADOR_AREA') || actor.roles?.includes('JEFE_UNIDAD_ACADEMICA');
  const esAdminODir = actor.roles?.includes('ADMINISTRADOR') || actor.roles?.includes('DIRECTOR') || actor.roles?.includes('SECRETARIO');

  if (actor.roles?.includes('DOCENTE') && !esDocenteAsignado) {
    throw new ForbiddenError({
      message: 'Un docente evaluador solo puede consultar las evaluaciones técnicas que le han sido formalmente asignadas.',
    });
  }

  if (!esDocenteAsignado && !esCoordinador && !esAdminODir) {
    throw new ForbiddenError({
      message: 'No cuenta con autorización contextual para examinar la evaluación técnica de este expediente.',
    });
  }

  const reqRes = await pool.query<{
    id_expediente_requisito: string;
    requisito_id: string;
    descripcion: string;
    cumplido: boolean;
    verificado_en: Date | null;
  }>(
    `SELECT er.id_expediente_requisito::text,
            er.requisito_id::text,
            COALESCE(r.denominacion, 'Requisito formal reglamentario') AS descripcion,
            er.cumplido,
            er.verificado_en
       FROM sigd_doc.expediente_requisito er
       LEFT JOIN sigd_doc.requisito r ON r.requisito_id = er.requisito_id
      WHERE er.expediente_id = $1::uuid
      ORDER BY r.denominacion ASC`,
    [expedienteId],
  );

  const docsRes = await pool.query<{
    documento_id: string;
    nombre_original: string;
    hash_sha256: string;
    tamanio_bytes: number;
    creado_en: Date;
  }>(
    `SELECT da.documento_adjunto_id::text AS documento_id,
            da.nombre_archivo AS nombre_original,
            da.sha256 AS hash_sha256,
            da.tamano_bytes AS tamanio_bytes,
            da.creado_en
       FROM sigd_doc.documento_adjunto da
      WHERE da.expediente_id = $1::uuid
      ORDER BY da.creado_en ASC`,
    [expedienteId],
  );

  const movRes = await pool.query<{
    fecha_hora: Date;
    usuario_operador_id: string;
    evento: string;
    estado_nuevo: string;
    datos: Record<string, unknown>;
  }>(
    `SELECT fecha_hora, usuario_operador_id::text, evento, estado_nuevo, datos
       FROM sigd_rut.movimiento_tramite
      WHERE expediente_id = $1::uuid
      ORDER BY secuencia ASC`,
    [expedienteId],
  );

  const historialEvaluacion = movRes.rows.map((m) => ({
    fecha: m.fecha_hora.toISOString(),
    actorId: m.usuario_operador_id,
    tipo: m.evento,
    descripcion: typeof m.datos?.motivo === 'string' ? m.datos.motivo : `Transición a ${m.estado_nuevo}`,
  }));

  return {
    ok: true,
    expediente: {
      id: expFila.expediente_id,
      codigo: expFila.codigo_expediente,
      asunto: expFila.asunto || 'Sin asunto',
      estado: expFila.estado,
      fechaRadicacion: expFila.fecha_radicacion.toISOString(),
      solicitante: {
        id: expFila.solicitante_id,
        nombreCompleto: expFila.nombre_solicitante || 'Administrado',
        dni: expFila.dni_solicitante,
        correo: expFila.correo_solicitante,
      },
    },
    asignacion,
    requisitos: reqRes.rows.map((r) => ({
      idRequisito: r.requisito_id,
      descripcion: r.descripcion,
      cumplido: r.cumplido,
      verificadoEn: r.verificado_en ? r.verificado_en.toISOString() : null,
    })),
    documentosAdjuntos: docsRes.rows.map((d) => ({
      id: d.documento_id,
      nombreOriginal: d.nombre_original,
      hashSha256: d.hash_sha256,
      tamanioBytes: d.tamanio_bytes,
      creadoEn: d.creado_en.toISOString(),
    })),
    historialEvaluacion,
  };
}

/**
 * HITO 3 (Cont.): Marcar cumplimiento de requisito individual por el docente.
 */
export async function marcarRequisitoEvaluacion(
  cliente: PoolClient,
  expedienteId: string,
  requisitoId: string,
  cumplido: boolean,
  actor: ActorRutaDoc,
): Promise<{ ok: boolean; mensaje: string; requisitoId: string; cumplido: boolean }> {
  validarFacultadDocente(actor);

  const asig = await cliente.query<{ id_usuario_docente: string }>(
    `SELECT id_usuario_docente FROM sigd_rut.expediente_evaluador WHERE expediente_id = $1::uuid AND activo = TRUE`,
    [expedienteId],
  );

  if (asig.rowCount === 0 || asig.rows[0].id_usuario_docente !== actor.id) {
    throw new ForbiddenError({ message: 'Solo el docente evaluador asignado puede calificar requisitos.' });
  }

  await cliente.query(
    `INSERT INTO sigd_doc.expediente_requisito (expediente_id, requisito_id, cumplido, verificado_en)
     VALUES ($1::uuid, $2::uuid, $3, now())
     ON CONFLICT (expediente_id, requisito_id)
     DO UPDATE SET cumplido = EXCLUDED.cumplido, verificado_en = now()`,
    [expedienteId, requisitoId, cumplido],
  );

  return {
    ok: true,
    mensaje: `Requisito marcado como ${cumplido ? 'cumplido' : 'pendiente'}.`,
    requisitoId,
    cumplido,
  };
}

/**
 * HITO 4: Registro formal de observaciones técnicas por el docente.
 * Transiciona el expediente de EN_REVISION a OBSERVADO.
 */
export async function registrarObservacionEvaluacion(
  cliente: PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
  datos: ObservarEvaluacionDTO,
): Promise<{ ok: boolean; mensaje: string; estado: string; plazoDias: number }> {
  validarFacultadDocente(actor);

  const { areaId, codigoExpediente, solicitanteId } = await obtenerAreaActualExpediente(cliente, expedienteId);

  const asigRes = await cliente.query<{ id_asignacion: string; id_usuario_docente: string; evidencias: unknown }>(
    `SELECT id_asignacion, id_usuario_docente, COALESCE(evidencias, '[]'::jsonb) AS evidencias
       FROM sigd_rut.expediente_evaluador
      WHERE expediente_id = $1::uuid AND activo = TRUE`,
    [expedienteId],
  );

  if (asigRes.rowCount === 0 || asigRes.rows[0].id_usuario_docente !== actor.id) {
    throw new ForbiddenError({
      message: 'Solo el docente evaluador asignado puede formular observaciones en este expediente.',
    });
  }

  const estadoActualRes = await cliente.query<{ estado_nuevo: string }>(
    `SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );
  const estadoActual = estadoActualRes.rows[0]?.estado_nuevo ?? 'EN_REVISION';

  if (estadoActual !== 'EN_REVISION' && estadoActual !== 'EN_CALIFICACION') {
    throw new ConflictError({
      message: `No se puede observar un expediente en estado '${estadoActual}'. Debe encontrarse EN_REVISION o EN_CALIFICACION.`,
    });
  }

  const operadorId = await resolverOperadorId(cliente, actor.id);

  const datosMovimiento = {
    motivo: datos.motivo,
    sustentoTecnico: datos.sustentoTecnico || null,
    plazoDias: datos.plazoDias,
    requisitosObservados: datos.requisitosObservados || [],
    areaId,
  };

  await cliente.query(
    `INSERT INTO sigd_rut.movimiento_tramite (
       expediente_id, estado_anterior, evento, estado_nuevo,
       usuario_operador_id, datos
     ) VALUES (
       $1::uuid, $2, 'OBSERVACION', 'OBSERVADO',
       $3, $4::jsonb
     )`,
    [expedienteId, estadoActual, operadorId, JSON.stringify(datosMovimiento)],
  );

  await cliente.query(
    `UPDATE sigd_tra.expediente SET estado = 'OBSERVADO' WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );

  // Sincronización Relacional TSK-DEV-04: sigd_rut.expediente_observacion y observacion_requisito
  try {
    const obsPreviasRes = await cliente.query<{ max_ronda: number | null }>(
      `SELECT MAX(ronda) AS max_ronda FROM sigd_rut.expediente_observacion WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    const ronda = (obsPreviasRes.rows[0]?.max_ronda ?? 0) + 1;
    const fechaLimite = new Date(Date.now() + (datos.plazoDias || 5) * 24 * 60 * 60 * 1000);

    const obsInsert = await cliente.query<{ id_observacion: string }>(
      `INSERT INTO sigd_rut.expediente_observacion (
         expediente_id, ronda, tipo_observacion, motivo, sustento_tecnico,
         plazo_dias, fecha_limite, estado, usuario_observador_id,
         usuario_cuenta_id, area_origen_id, fecha_observacion
       ) VALUES (
         $1::uuid, $2, 'TECNICA', $3, $4,
         $5, $6, 'PENDIENTE', $7,
         $8::uuid, $9::uuid, CURRENT_TIMESTAMP
       ) RETURNING id_observacion::text`,
      [
        expedienteId,
        ronda,
        datos.motivo,
        datos.sustentoTecnico || null,
        datos.plazoDias || 5,
        fechaLimite,
        operadorId,
        actor.id,
        areaId !== '00000000-0000-0000-0000-000000000000' ? areaId : null,
      ],
    );
    const idObservacion = obsInsert.rows[0]?.id_observacion;

    if (datos.requisitosObservados && datos.requisitosObservados.length > 0 && idObservacion) {
      for (const reqId of datos.requisitosObservados) {
        if (/^[0-9a-fA-F-]{36}$/.test(reqId)) {
          await cliente.query(
            `INSERT INTO sigd_rut.observacion_requisito (
               id_observacion, requisito_id, descripcion_incumplimiento
             ) VALUES ($1::uuid, $2::uuid, $3)
             ON CONFLICT (id_observacion, requisito_id) DO NOTHING`,
            [idObservacion, reqId, datos.motivo],
          );
        }
      }
    }
  } catch {
    // Preservar flujo principal si la sincronización falla
  }

  if (asigRes.rowCount && asigRes.rows[0]) {
    const obsHistorica = {
      tipo: 'OBSERVACION',
      motivo: datos.motivo,
      sustentoTecnico: datos.sustentoTecnico || null,
      plazoDias: datos.plazoDias,
      requisitosObservados: datos.requisitosObservados || [],
      observadoPor: actor.id,
      observadoEn: new Date().toISOString(),
    };

    await cliente.query(
      `UPDATE sigd_rut.expediente_evaluador
          SET observaciones = $1,
              evidencias = COALESCE(evidencias, '[]'::jsonb) || $2::jsonb
        WHERE id_asignacion = $3::uuid`,
      [datos.motivo, JSON.stringify([obsHistorica]), asigRes.rows[0].id_asignacion],
    );
  }

  // Notificación formal a Casilla Electrónica si el administrado dispone de cuenta activa
  try {
    const destinatarios = await cliente.query<{ usuario_id: string; asunto: string }>(
      `SELECT c.id_usuario::text AS usuario_id, t.asunto
         FROM sigd_tra.expediente e
         JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
         JOIN sigd_auth.cuenta_usuario c
           ON c.id_persona = e.solicitante_id AND c.activo = TRUE
        WHERE e.expediente_id = $1::uuid
        ORDER BY c.id_usuario
        LIMIT 1`,
      [expedienteId],
    );
    if (destinatarios.rowCount && destinatarios.rows[0]) {
      const dest = destinatarios.rows[0];
      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'expediente_observado',
        payload: {
          usuario_id: dest.usuario_id,
          expediente_id: expedienteId,
          cut: codigoExpediente,
          asunto: dest.asunto,
          tipo_acto: 'Observación de expediente',
          cuerpo: { contenido: datos.motivo },
        },
      });
    }
  } catch {
    // Si no existe cuenta de casilla previa, se preserva el flujo principal
  }

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteObservadoDocente',
    payload: {
      identidad: { expediente_id: expedienteId, cut: codigoExpediente },
      contexto: { usuario_actor_id: actor.id, area_id: areaId, solicitante_id: solicitanteId },
      datos_especificos: {
        motivo: datos.motivo,
        sustento: datos.sustentoTecnico,
        plazo_dias: datos.plazoDias,
      },
    },
  });

  return {
    ok: true,
    mensaje: 'Observación formal registrada exitosamente. El trámite pasa a estado OBSERVADO.',
    estado: 'OBSERVADO',
    plazoDias: datos.plazoDias,
  };
}

/**
 * HITO 5: Subsanación por el estudiante / administrado.
 * Valida la titularidad del administrado y transiciona de OBSERVADO a SUBSANADO.
 */
export async function registrarSubsanacionEstudiante(
  cliente: PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
  datos: SubsanarExpedienteDTO,
): Promise<{ ok: boolean; mensaje: string; estado: string }> {
  if (actor.roles?.includes('ADMINISTRADOR') && !actor.roles?.some((r) => ['ESTUDIANTE', 'CIUDADANO'].includes(r))) {
    throw new ForbiddenError({
      message: 'El rol ADMINISTRADOR no puede actuar en sustitución del administrado ni presentar subsanaciones.',
    });
  }

  const { areaId, codigoExpediente, solicitanteId } = await obtenerAreaActualExpediente(cliente, expedienteId);

  const personaUsuario = await cliente.query<{ id_persona: string }>(
    `SELECT id_persona::text FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
    [actor.id],
  );

  const personaActorId = personaUsuario.rows[0]?.id_persona ?? actor.id;
  const esTitular = personaActorId === solicitanteId || actor.id === solicitanteId;

  let canalRecepcion = 'PORTAL_ESTUDIANTE';
  if (!esTitular) {
    if (!actor.roles?.includes('MESA_PARTES')) {
      throw new ForbiddenError({ message: 'Solo el administrado o estudiante titular del expediente puede presentar subsanaciones.' });
    }

    const checkMp = await cliente.query<{ valido: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM sigd_org.usuario_rol ur
        JOIN sigd_org.rol_sistema rs ON ur.rol_id = rs.rol_id
        JOIN sigd_org.area a ON ur.area_id = a.area_id
        WHERE ur.id_usuario = $1::uuid
          AND rs.codigo = 'MESA_PARTES'
          AND a.codigo = 'MP'
          AND a.vigente = TRUE
          AND ur.vigente_desde <= NOW()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > NOW())
      ) AS valido`,
      [actor.id],
    );

    if (!checkMp.rows[0]?.valido) {
      throw new ForbiddenError({
        message: 'Acceso denegado: el operador de Mesa de Partes no cuenta con adscripción activa al área de Mesa de Partes (MP).',
      });
    }

    canalRecepcion = 'VENTANILLA_MESA_PARTES';
  }

  const estadoActualRes = await cliente.query<{ estado_nuevo: string }>(
    `SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );
  const estadoActual = estadoActualRes.rows[0]?.estado_nuevo ?? 'OBSERVADO';

  if (estadoActual !== 'OBSERVADO') {
    throw new ConflictError({
      message: `No se puede subsanar un expediente en estado '${estadoActual}'. Debe encontrarse OBSERVADO.`,
    });
  }

  const operadorId = await resolverOperadorId(cliente, actor.id);

  const datosMovimiento = {
    motivo: datos.motivo,
    sustentoSubsanacion: datos.sustentoSubsanacion || null,
    documentosAdjuntos: datos.documentosAdjuntos || [],
    areaId,
    canalRecepcion,
    presentadoPor: esTitular ? 'TITULAR' : 'MESA_PARTES_VENTANILLA',
    solicitanteId,
  };

  await cliente.query(
    `INSERT INTO sigd_rut.movimiento_tramite (
       expediente_id, estado_anterior, evento, estado_nuevo,
       usuario_operador_id, datos
     ) VALUES (
       $1::uuid, 'OBSERVADO', 'CORRECCION', 'SUBSANADO',
       $2, $3::jsonb
     )`,
    [expedienteId, operadorId, JSON.stringify(datosMovimiento)],
  );

  await cliente.query(
    `UPDATE sigd_tra.expediente SET estado = 'SUBSANADO' WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );

  // Sincronización Relacional TSK-DEV-04: sigd_rut.expediente_subsanacion
  try {
    const obsActivaRes = await cliente.query<{ id_observacion: string; ronda: number }>(
      `SELECT id_observacion::text, ronda FROM sigd_rut.expediente_observacion
        WHERE expediente_id = $1::uuid AND estado = 'PENDIENTE'
        ORDER BY ronda DESC LIMIT 1`,
      [expedienteId],
    );
    if (obsActivaRes.rowCount && obsActivaRes.rows[0]) {
      const obsActiva = obsActivaRes.rows[0];
      await cliente.query(
        `INSERT INTO sigd_rut.expediente_subsanacion (
           id_observacion, expediente_id, ronda, descripcion_respuesta,
           canal_recepcion, usuario_subsanador_id, usuario_cuenta_id,
           es_titular, fecha_subsanacion
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4,
           $5, $6, $7::uuid,
           $8, CURRENT_TIMESTAMP
         )`,
        [
          obsActiva.id_observacion,
          expedienteId,
          obsActiva.ronda,
          datos.motivo,
          canalRecepcion,
          operadorId,
          actor.id,
          esTitular,
        ],
      );
      await cliente.query(
        `UPDATE sigd_rut.expediente_observacion SET estado = 'SUBSANADA', fecha_subsanacion = CURRENT_TIMESTAMP WHERE id_observacion = $1::uuid`,
        [obsActiva.id_observacion],
      );
      await cliente.query(
        `UPDATE sigd_rut.observacion_requisito SET subsanado = TRUE, fecha_subsanacion = CURRENT_TIMESTAMP WHERE id_observacion = $1::uuid`,
        [obsActiva.id_observacion],
      );
    }
  } catch {
    // Preservar flujo principal si la sincronización falla
  }

  const subsanacionHistorica = {
    tipo: 'SUBSANACION',
    motivo: datos.motivo,
    sustento: datos.sustentoSubsanacion || null,
    documentos: datos.documentosAdjuntos || [],
    subsanadoPor: actor.id,
    subsanadoEn: new Date().toISOString(),
    canalRecepcion,
    esTitular,
    solicitanteId,
  };

  await cliente.query(
    `UPDATE sigd_rut.expediente_evaluador
        SET evidencias = COALESCE(evidencias, '[]'::jsonb) || $1::jsonb
      WHERE expediente_id = $2::uuid AND activo = TRUE`,
    [JSON.stringify([subsanacionHistorica]), expedienteId],
  );

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'TramiteSubsanadoEstudiante',
    payload: {
      identidad: { expediente_id: expedienteId, cut: codigoExpediente },
      contexto: { usuario_actor_id: actor.id, solicitante_id: solicitanteId, area_id: areaId, canal_recepcion: canalRecepcion },
      datos_especificos: {
        motivo: datos.motivo,
        documentos_adjuntos: datos.documentosAdjuntos,
      },
    },
  });

  return {
    ok: true,
    mensaje: 'Subsanación presentada exitosamente. El expediente pasa a estado SUBSANADO para reevaluación técnica.',
    estado: 'SUBSANADO',
  };
}

/**
 * HITO 6: Reanudación de la evaluación técnica por el docente post-subsanación.
 * Transiciona de SUBSANADO a EN_REVISION.
 */
export async function reanudarEvaluacionDocente(
  cliente: PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
): Promise<{ ok: boolean; mensaje: string; estado: string }> {
  validarFacultadDocente(actor);

  const { areaId, codigoExpediente } = await obtenerAreaActualExpediente(cliente, expedienteId);

  const asigRes = await cliente.query<{ id_usuario_docente: string }>(
    `SELECT id_usuario_docente FROM sigd_rut.expediente_evaluador WHERE expediente_id = $1::uuid AND activo = TRUE`,
    [expedienteId],
  );

  if (asigRes.rowCount === 0 || asigRes.rows[0].id_usuario_docente !== actor.id) {
    throw new ForbiddenError({ message: 'Solo el docente evaluador asignado puede reanudar la evaluación.' });
  }

  const estadoActualRes = await cliente.query<{ estado_nuevo: string }>(
    `SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );
  const estadoActual = estadoActualRes.rows[0]?.estado_nuevo ?? 'SUBSANADO';

  if (estadoActual !== 'SUBSANADO') {
    throw new ConflictError({
      message: `No se puede reanudar la evaluación de un expediente en estado '${estadoActual}'. Debe encontrarse SUBSANADO.`,
    });
  }

  const operadorId = await resolverOperadorId(cliente, actor.id);

  await cliente.query(
    `INSERT INTO sigd_rut.movimiento_tramite (
       expediente_id, estado_anterior, evento, estado_nuevo,
       usuario_operador_id, datos
     ) VALUES (
       $1::uuid, 'SUBSANADO', 'INICIAR_REVISION', 'EN_REVISION',
       $2, $3::jsonb
     )`,
    [expedienteId, operadorId, JSON.stringify({ motivo: 'Reanudación de calificación técnica', areaId })],
  );

  await cliente.query(
    `UPDATE sigd_tra.expediente SET estado = 'EN_REVISION' WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );

  await cliente.query(
    `UPDATE sigd_rut.expediente_evaluador SET estado_evaluacion = 'EN_EVALUACION' WHERE expediente_id = $1::uuid AND activo = TRUE`,
    [expedienteId],
  );

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'EvaluacionReanudadaDocente',
    payload: {
      identidad: { expediente_id: expedienteId, cut: codigoExpediente },
      contexto: { usuario_actor_id: actor.id, area_id: areaId },
    },
  });

  return {
    ok: true,
    mensaje: 'Evaluación técnica reanudada exitosamente.',
    estado: 'EN_REVISION',
  };
}

/**
 * HITO 7: Emisión formal del dictamen técnico docente.
 * Concluye la evaluación técnica y transiciona de EN_REVISION a ATENDIDO.
 */
export async function emitirDictamenDocente(
  cliente: PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
  datos: EmitirDictamenPayload,
): Promise<{ ok: boolean; mensaje: string; resultado: string; estado: string; concluidoEn: string }> {
  validarFacultadDocente(actor);

  const { areaId, codigoExpediente, solicitanteId } = await obtenerAreaActualExpediente(cliente, expedienteId);

  const asigRes = await cliente.query<{ id_asignacion: string; id_usuario_docente: string }>(
    `SELECT id_asignacion, id_usuario_docente FROM sigd_rut.expediente_evaluador WHERE expediente_id = $1::uuid AND activo = TRUE`,
    [expedienteId],
  );

  if (asigRes.rowCount === 0 || asigRes.rows[0].id_usuario_docente !== actor.id) {
    throw new ForbiddenError({ message: 'Solo el docente evaluador asignado puede emitir el dictamen técnico.' });
  }

  const estadoActualRes = await cliente.query<{ estado_nuevo: string }>(
    `SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );
  const estadoActual = estadoActualRes.rows[0]?.estado_nuevo ?? 'EN_REVISION';

  if (estadoActual !== 'EN_REVISION' && estadoActual !== 'EN_EVALUACION') {
    throw new ConflictError({
      message: `El expediente debe encontrarse EN_REVISION para emitir dictamen (estado actual: ${estadoActual}).`,
    });
  }

  const ahora = new Date();
  const dictamenObjeto = {
    resultado: datos.resultado,
    fundamentacion: datos.fundamentacion,
    recomendaciones: datos.recomendaciones || null,
    requisitosAprobados: datos.requisitosAprobados || [],
    emitidoPor: actor.id,
    emitidoEn: ahora.toISOString(),
  };

  await cliente.query(
    `UPDATE sigd_rut.expediente_evaluador
        SET estado_evaluacion = 'CONCLUIDA',
            evaluacion_concluida_en = $1,
            resultado_evaluacion = $2,
            evidencias = COALESCE(evidencias, '[]'::jsonb) || $3::jsonb
      WHERE id_asignacion = $4::uuid`,
    [ahora, datos.resultado, JSON.stringify([dictamenObjeto]), asigRes.rows[0].id_asignacion],
  );

  const operadorId = await resolverOperadorId(cliente, actor.id);

  const datosMovimiento = {
    dictamen: datos.resultado,
    fundamentacion: datos.fundamentacion,
    areaId,
  };

  await cliente.query(
    `INSERT INTO sigd_rut.movimiento_tramite (
       expediente_id, estado_anterior, evento, estado_nuevo,
       usuario_operador_id, datos
     ) VALUES (
       $1::uuid, 'EN_REVISION', 'ATENCION_TECNICA', 'ATENDIDO',
       $2, $3::jsonb
     )`,
    [expedienteId, operadorId, JSON.stringify(datosMovimiento)],
  );

  await cliente.query(
    `UPDATE sigd_tra.expediente SET estado = 'ATENDIDO' WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );

  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'DictamenDocenteEmitido',
    payload: {
      identidad: {
        expediente_id: expedienteId,
        asignacion_id: asigRes.rows[0].id_asignacion,
        cut: codigoExpediente,
      },
      contexto: {
        usuario_actor_id: actor.id,
        area_id: areaId,
        solicitante_id: solicitanteId,
      },
      datos_especificos: {
        resultado: datos.resultado,
        fundamentacion: datos.fundamentacion,
        concluido_en: ahora.toISOString(),
      },
    },
  });

  return {
    ok: true,
    mensaje: `Dictamen técnico emitido exitosamente con resultado ${datos.resultado}.`,
    resultado: datos.resultado,
    estado: 'ATENDIDO',
    concluidoEn: ahora.toISOString(),
  };
}

/**
 * HITO 8: Herramienta de supervisión para Coordinador de Área y Jefe de Unidad Académica.
 */
export async function supervisarEvaluacionesArea(
  pool: Pool,
  actor: ActorRutaDoc,
  areaIdFiltro?: string | null,
): Promise<{
  ok: boolean;
  total: number;
  evaluaciones: Array<{
    idAsignacion: string;
    expedienteId: string;
    codigoExpediente: string;
    asunto: string;
    docenteNombre: string;
    docenteEmail: string;
    estadoEvaluacion: string;
    estadoExpediente: string;
    asignadoEn: string;
    diasTranscurridos: number;
    resultadoEvaluacion: string | null;
  }>;
}> {
  const esDocente = actor.roles?.includes('DOCENTE');
  const esCoordinador = actor.roles?.includes('COORDINADOR_AREA');
  const esJefeAcademico = actor.roles?.includes('JEFE_UNIDAD_ACADEMICA');
  const esAutoridad = actor.roles?.includes('DIRECTOR') || actor.roles?.includes('ADMINISTRADOR');

  if (esDocente && !esCoordinador && !esJefeAcademico && !esAutoridad) {
    throw new ForbiddenError({ message: 'Los docentes evaluadores deben consultar sus expedientes asignados en su bandeja de evaluaciones.' });
  }

  if (!esCoordinador && !esJefeAcademico && !esAutoridad) {
    throw new ForbiddenError({ message: 'No cuenta con facultades de supervisión académica.' });
  }

  let areaEfectiva: string | null = null;
  if (esCoordinador) {
    if (!actor.unidadOrganicaId) {
      throw new ForbiddenError({ message: 'El Coordinador de Área no tiene una unidad orgánica asignada.' });
    }
    if (areaIdFiltro && areaIdFiltro !== actor.unidadOrganicaId) {
      throw new ForbiddenError({ message: 'El Coordinador de Área solo puede supervisar su propia unidad orgánica.' });
    }
    areaEfectiva = actor.unidadOrganicaId;
  } else if (areaIdFiltro) {
    areaEfectiva = areaIdFiltro;
  }

  const params: unknown[] = [];
  let whereArea = '';
  if (areaEfectiva) {
    params.push(areaEfectiva);
    whereArea = `AND ee.area_id = $1::uuid`;
  }

  const res = await pool.query<{
    id_asignacion: string;
    expediente_id: string;
    codigo_expediente: string;
    asunto: string;
    docente_nombre: string;
    docente_email: string;
    estado_evaluacion: string;
    estado_expediente: string;
    asignado_en: Date;
    resultado_evaluacion: string | null;
  }>(
    `SELECT ee.id_asignacion,
            ee.expediente_id,
            e.codigo_expediente,
            COALESCE(t.asunto, e.asunto, 'Sin asunto') AS asunto,
            COALESCE(cu.usuario, cu.correo) AS docente_nombre,
            cu.correo AS docente_email,
            ee.estado_evaluacion,
            COALESCE(ultimo.estado_nuevo, e.estado) AS estado_expediente,
            ee.asignado_en,
            ee.resultado_evaluacion
       FROM sigd_rut.expediente_evaluador ee
       JOIN sigd_tra.expediente e ON e.expediente_id = ee.expediente_id
       LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
       LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
       JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = ee.id_usuario_docente
      WHERE ee.activo = TRUE
        ${whereArea}
      ORDER BY ee.asignado_en DESC`,
    params,
  );

  const ahoraMs = Date.now();
  const evaluaciones = res.rows.map((f) => {
    const asignadoMs = f.asignado_en.getTime();
    const diasTranscurridos = Math.max(0, Math.floor((ahoraMs - asignadoMs) / (1000 * 60 * 60 * 24)));
    return {
      idAsignacion: f.id_asignacion,
      expedienteId: f.expediente_id,
      codigoExpediente: f.codigo_expediente,
      asunto: f.asunto,
      docenteNombre: f.docente_nombre,
      docenteEmail: f.docente_email,
      estadoEvaluacion: f.estado_evaluacion,
      estadoExpediente: f.estado_expediente,
      asignadoEn: f.asignado_en.toISOString(),
      diasTranscurridos,
      resultadoEvaluacion: f.resultado_evaluacion,
    };
  });

  return {
    ok: true,
    total: res.rowCount ?? 0,
    evaluaciones,
  };
}
