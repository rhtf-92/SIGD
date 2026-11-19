import { apiClient } from './client';
import type {
  EvaluadorActivoInfo,
  HistorialEvaluadorItem,
  DocenteElegible,
  ReasignacionMasivaResultado,
  EvaluacionSupervisionItem,
} from '../types/expediente';

export interface AsignarEvaluadorPayload {
  idUsuarioDocente: string;
  motivoAsignacion: string;
  observaciones?: string | null;
}

export interface ReasignarEvaluadorPayload {
  idNuevoDocente: string;
  motivoAsignacion: string;
  justificacionReasignacion: string;
  observaciones?: string | null;
}

export interface ReasignacionMasivaPayload {
  expedienteIds: string[];
  idNuevoDocente: string;
  motivoAsignacion: string;
  justificacionReasignacion: string;
  observaciones?: string | null;
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

export interface DetalleEvaluacionRespuesta {
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
}

export interface ObservarEvaluacionPayload {
  motivo: string;
  sustentoTecnico?: string | null;
  plazoDias?: number;
  requisitosObservados?: string[];
}

export interface SubsanarExpedientePayload {
  motivo: string;
  sustentoSubsanacion?: string | null;
  documentosAdjuntos?: string[];
}

export interface EmitirDictamenPayload {
  resultado: 'FAVORABLE' | 'DESFAVORABLE';
  fundamentacion: string;
  recomendaciones?: string | null;
  requisitosAprobados?: string[];
}

export type { EvaluacionSupervisionItem };

/**
 * Consulta el evaluador activo actualmente asignado a un expediente.
 */
export async function obtenerEvaluadorActivo(expedienteId: string): Promise<EvaluadorActivoInfo | null> {
  const res = await apiClient.get<{ ok: boolean; evaluador: EvaluadorActivoInfo | null }>(
    `/api/v1/expedientes/${expedienteId}/evaluador-activo`,
  );
  return res.data.evaluador;
}

/**
 * Consulta el historial cronológico completo de evaluadores asignados al expediente.
 */
export async function listarHistorialEvaluadores(expedienteId: string): Promise<HistorialEvaluadorItem[]> {
  const res = await apiClient.get<{ ok: boolean; total: number; historial: HistorialEvaluadorItem[] }>(
    `/api/v1/expedientes/${expedienteId}/evaluadores`,
  );
  return res.data.historial;
}

/**
 * Lista los docentes elegibles para recibir asignaciones académicas.
 */
export async function listarDocentesElegibles(areaId?: string | null): Promise<DocenteElegible[]> {
  const params = areaId ? { areaId } : {};
  const res = await apiClient.get<{ ok: boolean; total: number; docentes: DocenteElegible[] }>(
    '/api/v1/expedientes/docentes-elegibles',
    { params },
  );
  return res.data.docentes;
}

/**
 * Asigna inicialmente un docente evaluador a un expediente.
 */
export async function asignarEvaluador(
  expedienteId: string,
  payload: AsignarEvaluadorPayload,
): Promise<{ ok: boolean; mensaje: string; idAsignacion: string; asignadoEn: string }> {
  const res = await apiClient.post<{ ok: boolean; mensaje: string; idAsignacion: string; asignadoEn: string }>(
    `/api/v1/expedientes/${expedienteId}/asignar-evaluador`,
    payload,
  );
  return res.data;
}

/**
 * Reasigna individualmente un expediente a un nuevo evaluador, exigiendo justificación obligatoria.
 */
export async function reasignarEvaluador(
  expedienteId: string,
  payload: ReasignarEvaluadorPayload,
): Promise<{
  ok: boolean;
  mensaje: string;
  idAsignacion: string;
  evaluadorAnteriorId: string;
  nuevoEvaluadorId: string;
}> {
  const res = await apiClient.post<{
    ok: boolean;
    mensaje: string;
    idAsignacion: string;
    evaluadorAnteriorId: string;
    nuevoEvaluadorId: string;
  }>(`/api/v1/expedientes/${expedienteId}/reasignar-evaluador`, payload);
  return res.data;
}

/**
 * Ejecuta una reasignación masiva en lote para múltiples expedientes del área.
 */
export async function reasignarMasivo(
  payload: ReasignacionMasivaPayload,
): Promise<ReasignacionMasivaResultado> {
  const res = await apiClient.post<ReasignacionMasivaResultado>(
    '/api/v1/expedientes/reasignar-masivo',
    payload,
  );
  return res.data;
}

/**
 * HITO 1: Bandeja del docente evaluador
 */
export async function listarMisEvaluaciones(params?: Record<string, unknown>): Promise<{
  ok: boolean;
  total: number;
  resumen: ResumenBandejaDocente;
  evaluaciones: EvaluacionBandejaDocenteItem[];
}> {
  const res = await apiClient.get<{
    ok: boolean;
    total: number;
    resumen: ResumenBandejaDocente;
    evaluaciones: EvaluacionBandejaDocenteItem[];
  }>('/api/v1/expedientes/mis-evaluaciones', { params });
  return res.data;
}

/**
 * HITO 2: Confirmar recepción e inicio de evaluación técnica
 */
export async function iniciarEvaluacion(expedienteId: string): Promise<{
  ok: boolean;
  mensaje: string;
  estadoEvaluacion: string;
  confirmadoEn: string;
}> {
  const res = await apiClient.post<{
    ok: boolean;
    mensaje: string;
    estadoEvaluacion: string;
    confirmadoEn: string;
  }>(`/api/v1/expedientes/${expedienteId}/iniciar-evaluacion`);
  return res.data;
}

/**
 * HITO 3: Consulta integral para evaluación técnica y requisitos
 */
export async function obtenerDetalleEvaluacion(expedienteId: string): Promise<DetalleEvaluacionRespuesta> {
  const res = await apiClient.get<DetalleEvaluacionRespuesta>(
    `/api/v1/expedientes/${expedienteId}/detalle-evaluacion`,
  );
  return res.data;
}

/**
 * HITO 3 (Cont.): Marcar requisito individual
 */
export async function marcarRequisitoEvaluacion(
  expedienteId: string,
  requisitoId: string,
  cumplido: boolean,
): Promise<{ ok: boolean; mensaje: string; requisitoId: string; cumplido: boolean }> {
  const res = await apiClient.post<{ ok: boolean; mensaje: string; requisitoId: string; cumplido: boolean }>(
    `/api/v1/expedientes/${expedienteId}/requisitos/${requisitoId}`,
    { cumplido },
  );
  return res.data;
}

/**
 * HITO 4: Registro formal de observaciones técnicas por docente
 */
export async function registrarObservacionEvaluacion(
  expedienteId: string,
  payload: ObservarEvaluacionPayload,
): Promise<{ ok: boolean; mensaje: string; estado: string; plazoDias: number }> {
  const res = await apiClient.post<{ ok: boolean; mensaje: string; estado: string; plazoDias: number }>(
    `/api/v1/expedientes/${expedienteId}/observar-evaluacion`,
    payload,
  );
  return res.data;
}

/**
 * HITO 5: Subsanación por el estudiante / administrado
 */
export async function registrarSubsanacionEstudiante(
  expedienteId: string,
  payload: SubsanarExpedientePayload,
): Promise<{ ok: boolean; mensaje: string; estado: string }> {
  const res = await apiClient.post<{ ok: boolean; mensaje: string; estado: string }>(
    `/api/v1/expedientes/${expedienteId}/subsanar-estudiante`,
    payload,
  );
  return res.data;
}

/**
 * HITO 6: Reanudar evaluación post-subsanación
 */
export async function reanudarEvaluacionDocente(expedienteId: string): Promise<{
  ok: boolean;
  mensaje: string;
  estado: string;
}> {
  const res = await apiClient.post<{ ok: boolean; mensaje: string; estado: string }>(
    `/api/v1/expedientes/${expedienteId}/reanudar-evaluacion`,
  );
  return res.data;
}

/**
 * HITO 7: Emisión de dictamen técnico docente
 */
export async function emitirDictamenDocente(
  expedienteId: string,
  payload: EmitirDictamenPayload,
): Promise<{ ok: boolean; mensaje: string; resultado: string; estado: string; concluidoEn: string }> {
  const res = await apiClient.post<{
    ok: boolean;
    mensaje: string;
    resultado: string;
    estado: string;
    concluidoEn: string;
  }>(`/api/v1/expedientes/${expedienteId}/emitir-dictamen`, payload);
  return res.data;
}

/**
 * HITO 8: Herramienta de supervisión para Coordinador de Área y Autoridades
 */
export async function supervisarEvaluacionesArea(areaId?: string | null): Promise<{
  ok: boolean;
  total: number;
  evaluaciones: EvaluacionSupervisionItem[];
}> {
  const params = areaId ? { areaId } : {};
  const res = await apiClient.get<{
    ok: boolean;
    total: number;
    evaluaciones: EvaluacionSupervisionItem[];
  }>('/api/v1/expedientes/supervision-area', { params });
  return res.data;
}
