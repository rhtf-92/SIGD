// Servicio de atencion interna. Habla con /api/v1/atencion/*, solo roles internos.
import { apiClient } from "../api/client";

const BASE = "/api/v1/atencion";

export interface TransicionAtencion {
  evento: string;
  estadoNuevo: string;
}

export interface ExpedienteAtencion {
  expedienteId: string;
  cut: string;
  estado: string;
  transiciones: TransicionAtencion[];
}

export interface MovimientoAtencion {
  secuencia: number;
  fechaHora: string;
  estadoAnterior: string;
  evento: string;
  estadoNuevo: string;
  usuario: string | null;
  resumen: string | null;
}

export async function buscarExpediente(cut: string): Promise<ExpedienteAtencion> {
  const r = await apiClient.get<ExpedienteAtencion>(`${BASE}/expedientes`, { params: { cut } });
  return r.data;
}

export async function obtenerTrazabilidad(id: string): Promise<MovimientoAtencion[]> {
  const r = await apiClient.get<{ movimientos: MovimientoAtencion[] }>(
    `${BASE}/expedientes/${id}/trazabilidad`,
  );
  return r.data.movimientos;
}

export async function avanzarExpediente(id: string, evento: string, resumen: string): Promise<void> {
  await apiClient.post(`${BASE}/expedientes/${id}/avanzar`, { evento, resumen });
}

export function mensajeDeErrorAtencion(error: unknown): string {
  const e = error as { problemDetails?: { detail?: string; title?: string }; message?: string };
  return e?.problemDetails?.detail ?? e?.problemDetails?.title ?? e?.message ?? "No se pudo completar la operacion.";
}