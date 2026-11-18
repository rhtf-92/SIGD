// frontend/src/services/ubigeoService.ts

import { apiClient } from '../api/client';
import {
  DEPARTAMENTOS_PERU,
  PROVINCIAS_PERU,
  DISTRITOS_PERU,
  type UbigeoItem,
} from '../data/ucayali';

export const ubigeoKeys = {
  all: ['ubigeo'] as const,
  departamentos: () => [...ubigeoKeys.all, 'departamentos'] as const,
  provincias: (deptId?: string) => [...ubigeoKeys.all, 'provincias', deptId] as const,
  distritos: (provId?: string) => [...ubigeoKeys.all, 'distritos', provId] as const,
};

export const fetchDepartamentos = async (): Promise<UbigeoItem[]> => {
  return [...DEPARTAMENTOS_PERU];
};

export const fetchProvincias = async (departamentoId: string): Promise<UbigeoItem[]> => {
  return PROVINCIAS_PERU.filter((p) => p.padreId === departamentoId);
};

export const fetchDistritos = async (provinciaId: string): Promise<UbigeoItem[]> => {
  // Si la provincia pertenece a Ucayali ('25'), intentamos consultar primero el endpoint oficial del SIGD
  if (provinciaId.startsWith('25')) {
    try {
      const res = await apiClient.get<
        | {
            provincias?: Array<{
              codigo: string;
              nombre: string;
              distritos: Array<{ codigo: string; nombre: string }>;
            }>;
          }
        | Array<{ codigo: string; nombre: string; provinciaCodigo: string }>
      >(
        `/api/v1/ubigeo/distritos-ucayali?provinciaCodigo=${encodeURIComponent(provinciaId)}`,
      );
      if (res.data) {
        if ('provincias' in res.data && Array.isArray(res.data.provincias)) {
          const distritos = res.data.provincias.flatMap((p) =>
            p.distritos.map((d) => ({
              id: d.codigo,
              nombre: d.nombre,
              padreId: p.codigo,
            })),
          );
          if (distritos.length > 0) {
            return distritos;
          }
        } else if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data.map((d) => ({
            id: d.codigo,
            nombre: d.nombre,
            padreId: d.provinciaCodigo,
          }));
        }
      }
    } catch {
      // Fallback silencioso al catálogo local
    }
  }

  // Para Cusco y el resto de las 24 regiones (y fallback de Ucayali), devuelve desde el catálogo nacional
  return DISTRITOS_PERU.filter((d) => d.padreId === provinciaId);
};