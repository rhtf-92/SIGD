/**
 * Servicio unificado de tablas maestras institucionales (T-BE-OC-15).
 *
 * Sustituye los múltiples endpoints pequeños y fragmentados de catálogos por
 * una única carga consolidada. Reduce la presión sobre PostgreSQL memorizando la
 * respuesta en memoria durante 24 horas (criterio de aceptación 2), TTL
 * declarado en una constante y no escondido en un número mágico.
 *
 * No depende de `req`/`res` de Express: expone `listarMaestras()` y deja la
 * escritura de cabeceras HTTP al controller.
 */

import type { Pool } from 'pg';
import { CacheMemoria } from '../../shared/cache/cache-memoria.js';
import {
  CATALOGOS,
  consultarCatalogos,
  type CatalogoMaestro,
} from './tablasMaestras.repository.js';

/** TTL exigido por la especificación: 24 horas. */
export const TTL_TABLAS_MAESTRAS_MS = 24 * 60 * 60 * 1000;

/** Valor de la cabecera `Cache-Control` para respuestas HTTP del recurso. */
export const CACHE_CONTROL_TABLAS_MAESTRAS = 'public, max-age=86400';

/** Claves de caché: una por variante de filtrado de inactivos. */
export const CLAVE_CACHE_MAESTRAS_ACTIVOS = 'organicore:tablas-maestras:v1:activos';
export const CLAVE_CACHE_MAESTRAS_TODOS = 'organicore:tablas-maestras:v1:todos';

export interface TablasMaestras {
  generado_en: string;
  solo_activos: boolean;
  ttl_segundos: number;
  total_catalogos: number;
  catalogos_disponibles: number;
  catalogos: CatalogoMaestro[];
}

export interface TablasMaestrasServiceOpciones {
  cache?: CacheMemoria<TablasMaestras>;
  ttlMs?: number;
  /** Reloj inyectable que devuelve la marca de tiempo ISO (para pruebas). */
  ahora?: () => string;
}

export class TablasMaestrasService {
  private readonly pool: Pool;
  private readonly cache: CacheMemoria<TablasMaestras>;
  private readonly ahora: () => string;

  constructor(pool: Pool, opciones: TablasMaestrasServiceOpciones = {}) {
    this.pool = pool;
    this.cache =
      opciones.cache ?? new CacheMemoria<TablasMaestras>(opciones.ttlMs ?? TTL_TABLAS_MAESTRAS_MS);
    this.ahora = opciones.ahora ?? (() => new Date().toISOString());
  }

  /**
   * Devuelve la carga consolidada de catálogos maestros. Cachea 24 h; con
   * `forzarRecarga` se salta la lectura de caché (útil tras un alta).
   */
  public async listarMaestras(
    soloActivos = true,
    forzarRecarga = false,
  ): Promise<TablasMaestras> {
    const clave = soloActivos ? CLAVE_CACHE_MAESTRAS_ACTIVOS : CLAVE_CACHE_MAESTRAS_TODOS;

    if (forzarRecarga) {
      this.cache.invalidar(clave);
    }

    return this.cache.obtenerOCargar(clave, async () => {
      const catalogos = await consultarCatalogos(this.pool, soloActivos);
      return {
        generado_en: this.ahora(),
        solo_activos: soloActivos,
        ttl_segundos: TTL_TABLAS_MAESTRAS_MS / 1000,
        total_catalogos: CATALOGOS.length,
        catalogos_disponibles: catalogos.filter((catalogo) => catalogo.disponible).length,
        catalogos,
      };
    });
  }

  /** Invalida la carga consolidada completa. */
  public invalidarCache(): void {
    this.cache.invalidar();
  }
}

export function crearTablasMaestrasService(
  pool: Pool,
  opciones: TablasMaestrasServiceOpciones = {},
): TablasMaestrasService {
  return new TablasMaestrasService(pool, opciones);
}
