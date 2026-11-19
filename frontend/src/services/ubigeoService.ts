/**
 * ENT-M01-02 / M01-UBIGEO: Servicio Frontend de Catálogo Geográfico Nacional
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * 
 * Consume la API REST de Identicore respaldada por PostgreSQL como única fuente de verdad:
 * - /api/v1/ubigeo/departamentos
 * - /api/v1/ubigeo/provincias?departamentoCodigo=...
 * - /api/v1/ubigeo/distritos?provinciaCodigo=...
 * - /api/v1/ubigeo/detalle/:codigo
 * 
 * Implementa caché en memoria de sesión para minimizar latencia y consumo de red.
 * Lanza errores descriptivos en caso de fallo sin recurrir a datos estáticos desactualizados.
 */

import { apiClient } from '../api/client';
import type {
  UbigeoItem,
  UbigeoDTO,
  DepartamentoDTO,
  ProvinciaDTO,
  DistritoDTO,
  DetalleUbigeoDTO,
} from '../types/ubigeo';

export type { UbigeoItem, UbigeoDTO, DepartamentoDTO, ProvinciaDTO, DistritoDTO, DetalleUbigeoDTO };

export const ubigeoKeys = {
  all: ['ubigeo'] as const,
  departamentos: () => [...ubigeoKeys.all, 'departamentos'] as const,
  provincias: (deptId?: string) => [...ubigeoKeys.all, 'provincias', deptId] as const,
  distritos: (provId?: string, deptId?: string) => [...ubigeoKeys.all, 'distritos', provId, deptId] as const,
  detalle: (codigo: string) => [...ubigeoKeys.all, 'detalle', codigo] as const,
};

// Caché de sesión en memoria
const cache = {
  departamentos: null as UbigeoItem[] | null,
  provincias: new Map<string, UbigeoItem[]>(),
  distritos: new Map<string, UbigeoItem[]>(),
  detalles: new Map<string, DetalleUbigeoDTO>(),
};

/**
 * Limpia la caché en memoria del servicio de Ubigeo (útil para pruebas o recargas forzadas).
 */
export const clearUbigeoCache = (): void => {
  cache.departamentos = null;
  cache.provincias.clear();
  cache.distritos.clear();
  cache.detalles.clear();
};

/**
 * Obtiene los departamentos del Perú desde el servicio centralizado en PostgreSQL.
 */
export const fetchDepartamentos = async (): Promise<UbigeoItem[]> => {
  if (cache.departamentos && cache.departamentos.length > 0) {
    return cache.departamentos;
  }

  try {
    const res = await apiClient.get<DepartamentoDTO[]>('/api/v1/ubigeo/departamentos');
    if (Array.isArray(res.data) && res.data.length > 0) {
      const items: UbigeoItem[] = res.data.map((d) => ({
        id: d.codigo,
        nombre: d.codigo === '07' ? 'CALLAO (PROVINCIA CONSTITUCIONAL)' : d.nombre,
      }));
      cache.departamentos = items;
      return items;
    }
    throw new Error('La respuesta de departamentos no contiene elementos válidos.');
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido al consultar departamentos';
    throw new Error(`Error al cargar departamentos del catálogo UBIGEO: ${mensaje}`);
  }
};

/**
 * Obtiene las provincias pertenecientes a un departamento dado.
 */
export const fetchProvincias = async (departamentoId: string): Promise<UbigeoItem[]> => {
  if (!departamentoId) return [];

  const cacheKey = departamentoId.trim();
  if (cache.provincias.has(cacheKey)) {
    return cache.provincias.get(cacheKey)!;
  }

  try {
    const res = await apiClient.get<ProvinciaDTO[]>(
      `/api/v1/ubigeo/provincias?departamentoCodigo=${encodeURIComponent(cacheKey)}`
    );
    if (Array.isArray(res.data)) {
      const items: UbigeoItem[] = res.data.map((p) => ({
        id: p.codigo,
        nombre: p.nombre,
        padreId: p.departamentoCodigo,
      }));
      cache.provincias.set(cacheKey, items);
      return items;
    }
    throw new Error(`La respuesta de provincias para el departamento ${cacheKey} es inválida.`);
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido al consultar provincias';
    throw new Error(`Error al cargar provincias del departamento ${cacheKey}: ${mensaje}`);
  }
};

/**
 * Obtiene los distritos pertenecientes a una provincia dada.
 */
export const fetchDistritos = async (provinciaId: string): Promise<UbigeoItem[]> => {
  if (!provinciaId) return [];

  const cacheKey = provinciaId.trim();
  if (cache.distritos.has(cacheKey)) {
    return cache.distritos.get(cacheKey)!;
  }

  try {
    const res = await apiClient.get<
      | {
          provincias?: Array<{
            codigo: string;
            nombre: string;
            distritos: Array<{ codigo: string; nombre: string }>;
          }>;
        }
      | DistritoDTO[]
    >(`/api/v1/ubigeo/distritos?provinciaCodigo=${encodeURIComponent(cacheKey)}`);

    if (res.data) {
      if (Array.isArray(res.data)) {
        const items: UbigeoItem[] = res.data.map((d) => ({
          id: d.codigo,
          nombre: d.nombre,
          padreId: d.provinciaCodigo,
        }));
        cache.distritos.set(cacheKey, items);
        return items;
      }
      if ('provincias' in res.data && Array.isArray(res.data.provincias)) {
        const distritos = res.data.provincias.flatMap((p) =>
          p.distritos.map((d) => ({
            id: d.codigo,
            nombre: d.nombre,
            padreId: p.codigo,
          }))
        );
        cache.distritos.set(cacheKey, distritos);
        return distritos;
      }
    }
    throw new Error(`La respuesta de distritos para la provincia ${cacheKey} es inválida.`);
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido al consultar distritos';
    throw new Error(`Error al cargar distritos de la provincia ${cacheKey}: ${mensaje}`);
  }
};

/**
 * Obtiene el detalle jerárquico completo de un código UBIGEO de 6 dígitos.
 */
export const fetchDetalleUbigeo = async (codigo: string): Promise<DetalleUbigeoDTO> => {
  if (!codigo || codigo.length !== 6) {
    throw new Error('El código UBIGEO debe contener exactamente 6 dígitos.');
  }

  if (cache.detalles.has(codigo)) {
    return cache.detalles.get(codigo)!;
  }

  try {
    const res = await apiClient.get<DetalleUbigeoDTO>(
      `/api/v1/ubigeo/detalle/${encodeURIComponent(codigo)}`
    );
    if (res.data && res.data.codigo) {
      cache.detalles.set(codigo, res.data);
      return res.data;
    }
    throw new Error(`No se encontró información para el UBIGEO ${codigo}.`);
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : 'Error al consultar detalle de UBIGEO';
    throw new Error(`Error al consultar detalle del UBIGEO ${codigo}: ${mensaje}`);
  }
};
