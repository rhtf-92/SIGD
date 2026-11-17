/**
 * Hook Centralizado de Consulta TUPA Suiza 2026 (TanStack Query)
 * Garantiza que PostgreSQL sea la única fuente de verdad institucional.
 * Sin dependencias de catálogos estáticos ni fallbacks hardcodeados en cliente.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface ConceptoTupaItem {
  codigoInterno: string;
  codigoVisible: string;
  numeroVisible: string;
  referenciasInternas: readonly string[];
  nombre: string;
  rubro: string;
  paginaFuente: number;
  costoFuente: string;
  detallesTarifa: readonly string[];
}

export interface TipoDocumentalRequisito {
  tipo_documental_id?: string;
  codigo: string;
  nombre: string;
  obligatorio?: boolean;
}

export interface TipoTramiteApiItem {
  id: string;
  id_tipo_tramite?: string;
  codigo: string;
  codigoInterno?: string;
  codigoVisible?: string;
  numeroVisible?: string;
  costoFuente?: string;
  denominacion: string;
  descripcion?: string | null;
  unidad_organica?: string | null;
  plazo_dias?: number | null;
  plazo_dias_habiles?: number | null;
  silencio_administrativo?: string | null;
  calificacion?: string | null;
  base_legal?: string | null;
  vigente: boolean;
  tipos_documentales?: TipoDocumentalRequisito[];
}

export const TUPA_QUERY_KEYS = {
  all: ['tupa'] as const,
  catalogo2026: () => ['tupa', 'catalogo-2026'] as const,
  tipos: () => ['tupa', 'tipos'] as const,
};

/**
 * Consulta el Catálogo Oficial TUPA 2026 (72 procedimientos) directamente desde PostgreSQL vía API.
 */
export function useCatalogoTupa2026() {
  return useQuery<ConceptoTupaItem[], Error>({
    queryKey: TUPA_QUERY_KEYS.catalogo2026(),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ConceptoTupaItem[]>(
        '/api/v1/tramites/catalogo-tupa-2026',
        { signal }
      );
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('El catálogo institucional TUPA devolvió un conjunto de datos vacío o no válido.');
      }
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de validez en caché
    gcTime: 30 * 60 * 1000,    // 30 minutos de persistencia en memoria
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Consulta los Tipos de Trámite TUPA y sus requisitos documentales vigentes para radicación.
 */
export function useTiposTramite() {
  return useQuery<TipoTramiteApiItem[], Error>({
    queryKey: TUPA_QUERY_KEYS.tipos(),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<TipoTramiteApiItem[]>(
        '/api/v1/tramites/tipos',
        { signal }
      );
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No se pudieron obtener los tipos de trámites institucionales vigentes.');
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}
