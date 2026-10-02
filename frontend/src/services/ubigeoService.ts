// src/services/ubigeoService.ts

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
  try {
    return await new Promise<UbigeoItem[]>((resolve) => {
      setTimeout(() => resolve([DEPARTAMENTO_UCAYALI]), 100);
    });
  } catch (error) {
    console.warn('Fallback activado para Departamentos:', error);
    return [DEPARTAMENTO_UCAYALI];
  }
};

export const fetchProvincias = async (departamentoId: string): Promise<UbigeoItem[]> => {
  try {
    return await new Promise<UbigeoItem[]>((resolve) => {
      setTimeout(() => {
        const result = PROVINCIAS_UCAYALI.filter((p) => p.padreId === departamentoId);
        resolve([...result]);
      }, 100);
    });
  } catch (error) {
    console.warn('Fallback activado para Provincias:', error);
    return PROVINCIAS_UCAYALI.filter((p) => p.padreId === departamentoId);
  }
};

export const fetchDistritos = async (provinciaId: string): Promise<UbigeoItem[]> => {
  try {
    return await new Promise<UbigeoItem[]>((resolve) => {
      setTimeout(() => {
        const result = DISTRITOS_UCAYALI.filter((d) => d.padreId === provinciaId);
        resolve([...result]);
      }, 100);
    });
  } catch (error) {
    console.warn('Fallback activado para Distritos:', error);
    return DISTRITOS_UCAYALI.filter((d) => d.padreId === provinciaId);
  }
};