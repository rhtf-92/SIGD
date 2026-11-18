// src/services/ubigeoService.ts

import { apiClient } from '../api/client';
import {
  DEPARTAMENTO_UCAYALI,
  PROVINCIAS_UCAYALI,
  DISTRITOS_UCAYALI,
  type UbigeoItem,
} from '../data/ucayali';

export const ubigeoKeys = {
  all: ['ubigeo'] as const,
  departamentos: () => [...ubigeoKeys.all, 'departamentos'] as const,
  provincias: (deptId?: string) => [...ubigeoKeys.all, 'provincias', deptId] as const,
  distritos: (provId?: string) => [...ubigeoKeys.all, 'distritos', provId] as const,
};

export const fetchDepartamentos = async (): Promise<UbigeoItem[]> => {
  return [DEPARTAMENTO_UCAYALI];
};

export const fetchProvincias = async (departamentoId: string): Promise<UbigeoItem[]> => {
  return PROVINCIAS_UCAYALI.filter((p) => p.padreId === departamentoId);
};

export const fetchDistritos = async (provinciaId: string): Promise<UbigeoItem[]> => {
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
    // Fallback al catálogo oficial de Ucayali
  }
  return DISTRITOS_UCAYALI.filter((d) => d.padreId === provinciaId);
};