import type { Pool } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';

export interface DepartamentoItem {
  codigo: string;
  nombre: string;
}

export interface ProvinciaItem {
  codigo: string;
  departamentoCodigo: string;
  nombre: string;
}

export interface DistritoItem {
  codigo: string;
  provinciaCodigo: string;
  departamentoCodigo: string;
  nombre: string;
}

export interface DistritoUcayali {
  codigo: string;
  nombre: string;
}

export interface ProvinciaUcayali {
  codigo: string;
  nombre: string;
  distritos: DistritoUcayali[];
}

export interface UbigeoDetalle {
  codigoDistrito: string;
  distrito: string;
  codigoProvincia: string;
  provincia: string;
  codigoDepartamento: string;
  departamento: string;
}

export interface CacheDistribuida {
  get(clave: string): Promise<string | null>;
  set(clave: string, valor: string, ttlSegundos: number): Promise<void>;
}

const CACHE_KEY_UCAYALI = 'sigd:ubigeo:ucayali:v1';
const CACHE_TTL_SECONDS = 86_400; // 24 horas

/**
 * Servicio centralizado del Catálogo Geográfico Nacional (UBIGEO INEI).
 * Fuente única de verdad: motor PostgreSQL (esquema sigd_auth).
 * Sin copias estáticas ni catálogos duplicados en tiempo de ejecución.
 */
export class UbigeoService {
  private cacheDepartamentos: { venceEn: number; datos: DepartamentoItem[] } | null = null;
  private cacheProvincias: Map<string, { venceEn: number; datos: ProvinciaItem[] }> = new Map();
  private cacheLocalUcayali: { venceEn: number; datos: ProvinciaUcayali[] } | null = null;

  constructor(
    private readonly pool: Pool,
    private readonly cacheDistribuida?: CacheDistribuida,
  ) {}

  /**
   * Obtiene la totalidad de los 25 departamentos/regiones del Perú (incluyendo Callao).
   * Consulta directamente sigd_auth.departamento_ubigeo con caché en memoria.
   */
  async obtenerDepartamentos(): Promise<DepartamentoItem[]> {
    if (this.cacheDepartamentos && this.cacheDepartamentos.venceEn > Date.now()) {
      return this.cacheDepartamentos.datos;
    }

    try {
      const res = await this.pool.query<DepartamentoItem>(
        `SELECT codigo, nombre FROM sigd_auth.departamento_ubigeo ORDER BY nombre ASC`,
      );
      if (res.rows && res.rows.length > 0) {
        this.cacheDepartamentos = {
          datos: res.rows,
          venceEn: Date.now() + 300_000, // 5 min
        };
        return res.rows;
      }
      throw new Error('Catálogo de departamentos vacío en PostgreSQL');
    } catch (error) {
      console.error('[UBIGEO_SERVICE] Error consultando departamentos en PostgreSQL:', error);
      throw new AppError({
        status: 503,
        code: 'UBIGEO_SERVICE_UNAVAILABLE',
        message: 'El servicio de catálogo geográfico no se encuentra disponible temporalmente.',
        detail: 'El servicio de catálogo geográfico no se encuentra disponible temporalmente.',
      });
    }
  }

  /**
   * Obtiene las provincias del país, opcionalmente filtradas por departamento.
   */
  async obtenerProvincias(departamentoCodigo?: string): Promise<ProvinciaItem[]> {
    const depKey = departamentoCodigo || 'TODOS';
    const enCache = this.cacheProvincias.get(depKey);
    if (enCache && enCache.venceEn > Date.now()) {
      return enCache.datos;
    }

    try {
      const params: string[] = [];
      let sql = `SELECT codigo, departamento_codigo AS "departamentoCodigo", nombre
                   FROM sigd_auth.provincia_ubigeo`;
      if (departamentoCodigo) {
        sql += ` WHERE departamento_codigo = $1`;
        params.push(departamentoCodigo);
      }
      sql += ` ORDER BY nombre ASC`;

      const res = await this.pool.query<ProvinciaItem>(sql, params);
      if (res.rows) {
        this.cacheProvincias.set(depKey, {
          datos: res.rows,
          venceEn: Date.now() + 300_000,
        });
        return res.rows;
      }
      return [];
    } catch (error) {
      console.error('[UBIGEO_SERVICE] Error consultando provincias en PostgreSQL:', error);
      throw new AppError({
        status: 503,
        code: 'UBIGEO_SERVICE_UNAVAILABLE',
        message: 'El servicio de provincias no se encuentra disponible temporalmente.',
        detail: 'El servicio de provincias no se encuentra disponible temporalmente.',
      });
    }
  }

  /**
   * Obtiene distritos filtrados por provincia y/o departamento.
   */
  async obtenerDistritos(
    provinciaCodigo?: string,
    departamentoCodigo?: string,
  ): Promise<DistritoItem[]> {
    try {
      const params: string[] = [];
      let sql = `SELECT codigo, provincia_codigo AS "provinciaCodigo", departamento_codigo AS "departamentoCodigo", nombre
                   FROM sigd_auth.distrito_ubigeo WHERE 1=1`;
      if (provinciaCodigo) {
        params.push(provinciaCodigo);
        sql += ` AND provincia_codigo = $${params.length}`;
      }
      if (departamentoCodigo) {
        params.push(departamentoCodigo);
        sql += ` AND departamento_codigo = $${params.length}`;
      }
      sql += ` ORDER BY nombre ASC`;

      const res = await this.pool.query<DistritoItem>(sql, params);
      return res.rows || [];
    } catch (error) {
      console.error('[UBIGEO_SERVICE] Error consultando distritos en PostgreSQL:', error);
      throw new AppError({
        status: 503,
        code: 'UBIGEO_SERVICE_UNAVAILABLE',
        message: 'El servicio de distritos no se encuentra disponible temporalmente.',
        detail: 'El servicio de distritos no se encuentra disponible temporalmente.',
      });
    }
  }

  /**
   * Obtiene la información jerárquica completa de un UBIGEO distrital de 6 dígitos.
   */
  async obtenerDetalleUbigeo(codigoDistrito: string): Promise<UbigeoDetalle | null> {
    if (!codigoDistrito || !/^[0-9]{6}$/.test(codigoDistrito)) return null;

    try {
      const res = await this.pool.query<UbigeoDetalle>(
        `SELECT codigo_distrito AS "codigoDistrito", distrito,
                codigo_provincia AS "codigoProvincia", provincia,
                codigo_departamento AS "codigoDepartamento", departamento
           FROM sigd_auth.v_ubigeo_peru
          WHERE codigo_distrito = $1`,
        [codigoDistrito],
      );
      return res.rows[0] || null;
    } catch (error) {
      console.error('[UBIGEO_SERVICE] Error consultando detalle en PostgreSQL:', error);
      return null;
    }
  }

  /**
   * Comprueba si un código de distrito de 6 dígitos pertenece al catálogo oficial vigente.
   * Consulta en tiempo O(1) con índice sobre sigd_auth.distrito_ubigeo.
   */
  async contieneDistrito(codigo: string): Promise<boolean> {
    if (!codigo || !/^[0-9]{6}$/.test(codigo)) return false;

    try {
      const res = await this.pool.query<{ existe: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM sigd_auth.distrito_ubigeo WHERE codigo = $1) AS existe`,
        [codigo],
      );
      return Boolean(res.rows[0]?.existe);
    } catch (error) {
      console.error('[UBIGEO_SERVICE] Error verificando distrito en PostgreSQL:', error);
      return false;
    }
  }

  /**
   * Valida la correspondencia jerárquica departamento -> provincia -> distrito.
   */
  async validarJerarquia(
    departamentoCodigo: string,
    provinciaCodigo: string,
    distritoCodigo: string,
  ): Promise<boolean> {
    if (
      !/^[0-9]{2}$/.test(departamentoCodigo) ||
      !/^[0-9]{4}$/.test(provinciaCodigo) ||
      !/^[0-9]{6}$/.test(distritoCodigo)
    ) {
      return false;
    }

    if (!provinciaCodigo.startsWith(departamentoCodigo) || !distritoCodigo.startsWith(provinciaCodigo)) {
      return false;
    }

    try {
      const res = await this.pool.query<{ valido: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM sigd_auth.distrito_ubigeo
            WHERE codigo = $1 AND provincia_codigo = $2 AND departamento_codigo = $3
         ) AS valido`,
        [distritoCodigo, provinciaCodigo, departamentoCodigo],
      );
      return Boolean(res.rows[0]?.valido);
    } catch (error) {
      console.error('[UBIGEO_SERVICE] Error validando jerarquía en PostgreSQL:', error);
      return false;
    }
  }

  /**
   * Compatibilidad histórica con flujos de Ucayali.
   * Consulta PostgreSQL (sigd_auth.distrito_ubigeo con departamento_codigo = '25')
   * sin mantener un catálogo estático duplicado en código.
   */
  async obtenerDistritosUcayali(provinciaCodigo?: string): Promise<ProvinciaUcayali[]> {
    const provincias = await this.obtenerCatalogoUcayaliDesdeBD();
    const resultado = provinciaCodigo
      ? provincias.filter((provincia) => provincia.codigo === provinciaCodigo)
      : provincias;
    return structuredClone(resultado);
  }

  private async obtenerCatalogoUcayaliDesdeBD(): Promise<ProvinciaUcayali[]> {
    if (this.cacheLocalUcayali && this.cacheLocalUcayali.venceEn > Date.now()) {
      return this.cacheLocalUcayali.datos;
    }

    if (this.cacheDistribuida) {
      try {
        const serializado = await this.cacheDistribuida.get(CACHE_KEY_UCAYALI);
        if (serializado) {
          const datos = JSON.parse(serializado) as ProvinciaUcayali[];
          if (Array.isArray(datos) && datos.length > 0) {
            this.cacheLocalUcayali = { datos, venceEn: Date.now() + CACHE_TTL_SECONDS * 1_000 };
            return datos;
          }
        }
      } catch {
        // Tolerancia a fallas de Redis
      }
    }

    try {
      const res = await this.pool.query<{
        provincia_codigo: string;
        provincia_nombre: string;
        distrito_codigo: string;
        distrito_nombre: string;
      }>(
        `SELECT p.codigo AS provincia_codigo, p.nombre AS provincia_nombre,
                d.codigo AS distrito_codigo, d.nombre AS distrito_nombre
           FROM sigd_auth.provincia_ubigeo p
           JOIN sigd_auth.distrito_ubigeo d ON d.provincia_codigo = p.codigo
          WHERE p.departamento_codigo = '25'
          ORDER BY p.codigo, d.codigo`,
      );

      const provMap = new Map<string, ProvinciaUcayali>();
      for (const fila of res.rows) {
        let prov = provMap.get(fila.provincia_codigo);
        if (!prov) {
          prov = {
            codigo: fila.provincia_codigo,
            nombre: fila.provincia_nombre,
            distritos: [],
          };
          provMap.set(fila.provincia_codigo, prov);
        }
        prov.distritos.push({
          codigo: fila.distrito_codigo,
          nombre: fila.distrito_nombre,
        });
      }

      const datos = [...provMap.values()];
      this.cacheLocalUcayali = {
        datos,
        venceEn: Date.now() + CACHE_TTL_SECONDS * 1_000,
      };

      if (this.cacheDistribuida && datos.length > 0) {
        try {
          await this.cacheDistribuida.set(CACHE_KEY_UCAYALI, JSON.stringify(datos), CACHE_TTL_SECONDS);
        } catch {
          // Redis offline
        }
      }

      return datos;
    } catch (error) {
      console.error('[UBIGEO_SERVICE] Error consultando Ucayali en PostgreSQL:', error);
      throw new AppError({
        status: 503,
        code: 'UBIGEO_SERVICE_UNAVAILABLE',
        message: 'El servicio de ubigeo institucional no se encuentra disponible temporalmente.',
        detail: 'El servicio de ubigeo institucional no se encuentra disponible temporalmente.',
      });
    }
  }
}
