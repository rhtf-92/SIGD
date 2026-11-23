import { apiClient } from './client';

export type TipoAnotacionInterna = 'SEGUIMIENTO' | 'SUPERVISION' | 'INCIDENCIA';

export interface AnotacionInternaItem {
  idAnotacion: string;
  expedienteId: string;
  idAsignacion?: string | null;
  usuarioId: string;
  autorNombreCompleto: string;
  autorUsuario: string;
  autorCorreo: string;
  rolCodigo: string;
  rolNombre?: string;
  areaId: string;
  areaCodigo?: string;
  areaNombre?: string;
  tipoAnotacion: TipoAnotacionInterna;
  contenido: string;
  anotacionPadreId?: string | null;
  creadoEn: string;
}

export interface RespuestaListarAnotaciones {
  ok: boolean;
  total: number;
  anotaciones: AnotacionInternaItem[];
}

export interface RegistrarAnotacionPayload {
  tipoAnotacion: TipoAnotacionInterna;
  contenido: string;
  anotacionPadreId?: string | null;
}

export interface RespuestaRegistrarAnotacion {
  ok: boolean;
  mensaje: string;
  anotacion: AnotacionInternaItem;
}

/**
 * Consulta el historial cronológico de anotaciones internas del expediente.
 */
export async function obtenerAnotacionesInternas(expedienteId: string): Promise<AnotacionInternaItem[]> {
  const res = await apiClient.get<RespuestaListarAnotaciones>(
    `/api/v1/expedientes/${expedienteId}/anotaciones-internas`,
  );
  return res.data.anotaciones ?? [];
}

/**
 * Registra una nueva anotación interna inmutable de seguimiento o supervisión.
 */
export async function registrarAnotacionInterna(
  expedienteId: string,
  payload: RegistrarAnotacionPayload,
): Promise<AnotacionInternaItem> {
  const res = await apiClient.post<RespuestaRegistrarAnotacion>(
    `/api/v1/expedientes/${expedienteId}/anotaciones-internas`,
    payload,
  );
  return res.data.anotacion;
}
