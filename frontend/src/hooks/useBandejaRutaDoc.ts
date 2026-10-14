import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/authStore';

export const PESTANAS_RUTADOC = {
  PENDIENTES: 'Pendientes', EN_TRAMITE: 'En trámite', DERIVADOS: 'Derivados',
  POR_FIRMAR: 'Por firmar', ATENDIDOS: 'Atendidos', ARCHIVADOS: 'Archivados',
} as const;
export type PestanaRutaDoc = keyof typeof PESTANAS_RUTADOC;
export interface ExpedienteRutaDoc {
  idExpediente: string;
  cut: string;
  asunto: string;
  fechaRadicacion: string;
  estadoActual: string;
  areaActualId: string | null;
}
export interface PaginaRutaDoc {
  elementos: ExpedienteRutaDoc[];
  contadores: Record<PestanaRutaDoc, number>;
  siguienteCursor: string | null;
  tieneMas: boolean;
}
export interface FiltrosBandejaRutaDoc {
  pestana: PestanaRutaDoc;
  terminoBusqueda?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  cursor?: string;
}
export function useBandejaRutaDoc(filtros: FiltrosBandejaRutaDoc) {
  const usuarioId = useAuthStore(s => s.usuario?.id);
  return useQuery({
    queryKey: ['bandeja-rutadoc', usuarioId, filtros],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<PaginaRutaDoc>('/api/v1/expedientes', {
        params: { ...filtros, limite: 20 }, signal,
      });
      if (!Array.isArray(data.elementos) || !data.contadores) {
        throw new Error('La respuesta de la bandeja no cumple el contrato RutaDoc.');
      }
      return data;
    },
    enabled: Boolean(usuarioId),
    staleTime: 30_000,
    retry: false,
  });
}
