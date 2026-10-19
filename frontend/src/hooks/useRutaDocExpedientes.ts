import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";

export const PESTANAS_RUTADOC = [
  "PENDIENTES", "EN_TRAMITE", "DERIVADOS", "POR_FIRMAR", "ATENDIDOS", "ARCHIVADOS",
] as const;
export type PestanaRutaDoc = (typeof PESTANAS_RUTADOC)[number];

export const NOMBRES_PESTANA: Record<PestanaRutaDoc, string> = {
  PENDIENTES: "Pendientes",
  EN_TRAMITE: "En trámite",
  DERIVADOS: "Derivados",
  POR_FIRMAR: "Por firmar",
  ATENDIDOS: "Atendidos",
  ARCHIVADOS: "Archivados",
};

export interface ResumenRutaDoc {
  idExpediente: string;
  cut: string;
  asunto: string;
  fechaRadicacion: string;
  estadoActual: string;
  areaActualId: string | null;
}

export interface DetalleRutaDoc extends ResumenRutaDoc {
  solicitanteId: string | null;
  resumenDocumentos: { cantidadDocumentos: number; totalFolios: number } | null;
  ultimoMovimiento: {
    idMovimiento: string;
    evento: string;
    estadoNuevo: string;
    fechaHora: string;
    usuarioOperadorId: string;
  } | null;
  sla: null;
}

export interface ResultadoBandejaRutaDoc {
  elementos: ResumenRutaDoc[];
  siguienteCursor: string | null;
  tieneMas: boolean;
  contadores: Record<PestanaRutaDoc, number>;
}

export interface FiltrosRutaDoc {
  pestana: PestanaRutaDoc;
  terminoBusqueda?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  cursor?: string;
  limite?: number;
}

export interface ActuacionRutaDoc {
  movimientoId: string;
  secuencia: string;
  fechaHora: string;
  evento: string;
  estadoAnterior: string;
  estadoNuevo: string;
  usuarioOperadorId: string;
  areaAnteriorId: string | null;
  areaDestinoId: string | null;
  tipoActuacion: "NORMAL" | "COMPENSATORIA";
}

export function formatearFechaRadicacion(fecha: string): string {
  return new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(fecha));
}

export function useBandejaRutaDoc(filtros: FiltrosRutaDoc, enabled = true) {
  return useQuery({
    queryKey: ["rutadoc", "bandeja", filtros],
    queryFn: async () => {
      const { data } = await apiClient.get<ResultadoBandejaRutaDoc>("/api/v1/expedientes", {
        params: filtros,
      });
      return data;
    },
    staleTime: 30_000,
    enabled,
  });
}

export function useDetalleRutaDoc(id: string | undefined) {
  return useQuery({
    queryKey: ["rutadoc", "detalle", id],
    queryFn: async () => {
      const { data } = await apiClient.get<DetalleRutaDoc>(
        `/api/v1/expedientes/${encodeURIComponent(id!)}`,
      );
      return data;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useTrazabilidadRutaDoc(id: string | undefined) {
  return useQuery({
    queryKey: ["rutadoc", "trazabilidad", id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ expedienteId: string; actuaciones: ActuacionRutaDoc[] }>(
        `/api/v1/expedientes/${encodeURIComponent(id!)}/trazabilidad`,
      );
      return data.actuaciones;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
