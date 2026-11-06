import type { Pool, QueryResultRow } from 'pg';

import { AppError, ConflictError, NotFoundError } from '../../shared/domain/errors/index.js';
import { CacheMemoria } from './calendario.service.js';

export const TTL_TABLAS_MAESTRAS_MS = 24 * 60 * 60 * 1000;
export const TTL_TABLAS_MAESTRAS_SEGUNDOS = TTL_TABLAS_MAESTRAS_MS / 1000;
export const CACHE_CONTROL_TABLAS_MAESTRAS = 'private, no-cache';
export const CLAVE_CACHE_MAESTRAS_ACTIVOS = 'organicore:tablas-maestras:v2:activos';
export const CLAVE_CACHE_MAESTRAS_TODOS = 'organicore:tablas-maestras:v2:todos';

export const CLAVES_CATALOGO = ['areas', 'cargos', 'roles', 'tipos_documentales'] as const;
export type ClaveCatalogo = (typeof CLAVES_CATALOGO)[number];

export interface ItemCatalogo extends QueryResultRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  vigente: boolean;
  extra: Record<string, unknown>;
}

export interface CatalogoMaestro {
  clave: ClaveCatalogo;
  descripcion: string;
  total: number;
  items: ItemCatalogo[];
}

export interface TablasMaestras {
  generado_en: string;
  solo_activos: boolean;
  ttl_segundos: number;
  total_catalogos: number;
  catalogos_disponibles: number;
  catalogos: CatalogoMaestro[];
}

export interface GuardarItemCatalogo {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  padreId?: string | null;
}

interface DefinicionCatalogo {
  clave: ClaveCatalogo;
  descripcion: string;
  seleccionar: string;
  insertar: string;
  actualizar: string;
}

const CATALOGOS: Record<ClaveCatalogo, DefinicionCatalogo> = {
  areas: {
    clave: 'areas',
    descripcion: 'Áreas del organigrama institucional.',
    seleccionar: `SELECT area_id AS id, codigo, nombre, NULL::text AS descripcion, vigente,
      jsonb_build_object('padreId', area_padre_id, 'path', path::text, 'nivel', nivel) AS extra
      FROM sigd_org.area WHERE ($1 = FALSE OR vigente = TRUE) ORDER BY path`,
    insertar: `INSERT INTO sigd_org.area (codigo, nombre, area_padre_id, path)
      VALUES ($1, $2, $3, 'temporal'::ltree)`,
    actualizar: `UPDATE sigd_org.area SET codigo = $2, nombre = $3, area_padre_id = $4 WHERE area_id = $1`,
  },
  cargos: {
    clave: 'cargos',
    descripcion: 'Cargos institucionales.',
    seleccionar: `SELECT cargo_id AS id, codigo, nombre, descripcion, vigente, '{}'::jsonb AS extra
      FROM sigd_org.cargo WHERE ($1 = FALSE OR vigente = TRUE) ORDER BY nombre`,
    insertar: 'INSERT INTO sigd_org.cargo (codigo, nombre, descripcion) VALUES ($1, $2, $3)',
    actualizar: 'UPDATE sigd_org.cargo SET codigo = $2, nombre = $3, descripcion = $4 WHERE cargo_id = $1',
  },
  roles: {
    clave: 'roles',
    descripcion: 'Roles canónicos del sistema.',
    seleccionar: `SELECT rol_id AS id, codigo, nombre, descripcion, vigente, '{}'::jsonb AS extra
      FROM sigd_org.rol_sistema WHERE ($1 = FALSE OR vigente = TRUE) ORDER BY nombre`,
    insertar: 'INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion) VALUES ($1, $2, $3)',
    actualizar: 'UPDATE sigd_org.rol_sistema SET codigo = $2, nombre = $3, descripcion = $4 WHERE rol_id = $1',
  },
  tipos_documentales: {
    clave: 'tipos_documentales',
    descripcion: 'Tipos documentales oficiales.',
    seleccionar: `SELECT tipo_documental_id AS id, codigo, nombre, NULL::text AS descripcion, vigente,
      jsonb_build_object('extension', extension, 'mimeType', mime_type,
        'tamanoMaximoMb', tamano_maximo_mb, 'exigeFirma', exige_firma) AS extra
      FROM sigd_doc.tipo_documento WHERE ($1 = FALSE OR vigente = TRUE) ORDER BY nombre`,
    insertar: 'INSERT INTO sigd_doc.tipo_documento (codigo, nombre) VALUES ($1, $2)',
    actualizar: 'UPDATE sigd_doc.tipo_documento SET codigo = $2, nombre = $3 WHERE tipo_documental_id = $1',
  },
};

function idColumn(clave: ClaveCatalogo): string {
  return { areas: 'area_id', cargos: 'cargo_id', roles: 'rol_id', tipos_documentales: 'tipo_documental_id' }[clave];
}

function tableName(clave: ClaveCatalogo): string {
  return { areas: 'sigd_org.area', cargos: 'sigd_org.cargo', roles: 'sigd_org.rol_sistema', tipos_documentales: 'sigd_doc.tipo_documento' }[clave];
}

function traducirError(error: unknown): never {
  const postgres = error as { code?: string };
  if (postgres.code === '23505') {
    throw new ConflictError({ code: 'CODIGO_MAESTRO_DUPLICADO', message: 'El código ya existe en esta tabla maestra.' });
  }
  if (postgres.code === '23503') {
    throw new AppError({ status: 422, code: 'REFERENCIA_MAESTRA_INVALIDA', message: 'La referencia seleccionada no existe.' });
  }
  throw error;
}

export interface TablasMaestrasServiceOpciones {
  cache?: CacheMemoria<TablasMaestras>;
  ttlMs?: number;
  ahora?: () => string;
}

export class TablasMaestrasService {
  private readonly cache: CacheMemoria<TablasMaestras>;
  private readonly ahora: () => string;

  constructor(private readonly pool: Pool, opciones: TablasMaestrasServiceOpciones = {}) {
    this.cache = opciones.cache ?? new CacheMemoria<TablasMaestras>(opciones.ttlMs ?? TTL_TABLAS_MAESTRAS_MS);
    this.ahora = opciones.ahora ?? (() => new Date().toISOString());
  }

  public async listarMaestras(soloActivos = true, forzarRecarga = false): Promise<TablasMaestras> {
    const claveCache = soloActivos ? CLAVE_CACHE_MAESTRAS_ACTIVOS : CLAVE_CACHE_MAESTRAS_TODOS;
    if (forzarRecarga) this.cache.invalidar(claveCache);
    return this.cache.obtenerOCargar(claveCache, async () => {
      const catalogos = await Promise.all(Object.values(CATALOGOS).map(async (definicion) => {
        const resultado = await this.pool.query<ItemCatalogo>(definicion.seleccionar, [soloActivos]);
        return {
          clave: definicion.clave,
          descripcion: definicion.descripcion,
          total: resultado.rowCount ?? resultado.rows.length,
          items: resultado.rows,
        };
      }));
      return {
        generado_en: this.ahora(),
        solo_activos: soloActivos,
        ttl_segundos: TTL_TABLAS_MAESTRAS_SEGUNDOS,
        total_catalogos: catalogos.length,
        catalogos_disponibles: catalogos.length,
        catalogos,
      };
    });
  }

  public async crear(clave: ClaveCatalogo, datos: GuardarItemCatalogo): Promise<void> {
    try {
      const base = [datos.codigo.trim().toUpperCase(), datos.nombre.trim()];
      const valores = clave === 'areas'
        ? [...base, datos.padreId ?? null]
        : clave === 'tipos_documentales'
          ? base
          : [...base, datos.descripcion?.trim() || null];
      await this.pool.query(CATALOGOS[clave].insertar, valores);
      this.invalidarCache();
    } catch (error) { traducirError(error); }
  }

  public async actualizar(clave: ClaveCatalogo, id: string, datos: GuardarItemCatalogo): Promise<void> {
    try {
      const base = [id, datos.codigo.trim().toUpperCase(), datos.nombre.trim()];
      const valores = clave === 'areas'
        ? [...base, datos.padreId ?? null]
        : clave === 'tipos_documentales'
          ? base
          : [...base, datos.descripcion?.trim() || null];
      const resultado = await this.pool.query(CATALOGOS[clave].actualizar, valores);
      if (!resultado.rowCount) throw new NotFoundError({ message: 'El registro maestro indicado no existe.' });
      this.invalidarCache();
    } catch (error) { traducirError(error); }
  }

  public async cambiarVigencia(clave: ClaveCatalogo, id: string, vigente: boolean): Promise<void> {
    const resultado = await this.pool.query(
      `UPDATE ${tableName(clave)} SET vigente = $2 WHERE ${idColumn(clave)} = $1`, [id, vigente],
    );
    if (!resultado.rowCount) throw new NotFoundError({ message: 'El registro maestro indicado no existe.' });
    this.invalidarCache();
  }

  public invalidarCache(): void { this.cache.invalidar(); }
}

export function crearTablasMaestrasService(pool: Pool, opciones: TablasMaestrasServiceOpciones = {}): TablasMaestrasService {
  return new TablasMaestrasService(pool, opciones);
}
