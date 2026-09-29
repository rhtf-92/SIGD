/**
 * Suite unitaria de las tablas maestras consolidadas (T-BE-OC-15 y T-BE-OC-16).
 *
 * Verifica el requisito de caché en memoria con TTL de 24 horas y la
 * degradación segura del endpoint consolidado cuando un dominio todavía no ha
 * desplegado su esquema.
 */

import { describe, it, expect } from 'vitest';
import type { Pool } from 'pg';
import { CacheMemoria } from '../../../../src/shared/cache/cache-memoria.js';
import {
  CATALOGOS,
  consultarCatalogo,
  consultarCatalogos,
} from '../../../../src/domains/organicore/tablasMaestras.repository.js';
import {
  CACHE_CONTROL_TABLAS_MAESTRAS,
  TablasMaestrasService,
  TTL_TABLAS_MAESTRAS_MS,
  type TablasMaestras,
} from '../../../../src/domains/organicore/tablasMaestras.service.js';
import { esquemaConsultaTablasMaestras } from '../../../../src/domains/organicore/calendario.schemas.js';

function errorPostgres(codigo: string): Error {
  return Object.assign(new Error('error de postgres simulado'), { code: codigo });
}

/** Pool falso: resuelve los catálogos declarados y falla en los no desplegados. */
function crearPoolFalso(esquemasDesplegados: readonly string[]): { pool: Pool; consultas: () => string[] } {
  const registro: string[] = [];
  const pool = {
    async query(sql: string) {
      const esquema = sql.match(/FROM\s+(\w+)\./)?.[1] ?? 'desconocido';
      registro.push(esquema);
      if (!esquemasDesplegados.includes(esquema)) {
        throw errorPostgres('42P01');
      }
      return {
        rows: [
          {
            codigo: 'DNI',
            nombre: 'Documento Nacional de Identidad',
            descripcion: null,
            extra: {},
          },
        ],
        rowCount: 1,
      };
    },
  } as unknown as Pool;
  return { pool, consultas: () => registro };
}

describe('tablas maestras · caché en memoria con TTL de 24 horas', () => {
  it('expone el TTL de 86400 segundos exigido por la especificación', () => {
    expect(TTL_TABLAS_MAESTRAS_MS).toBe(86_400_000);
    expect(CACHE_CONTROL_TABLAS_MAESTRAS).toBe('public, max-age=86400');
  });

  it('no ejecuta el cargador mientras la entrada no expira', async () => {
    let ahora = 0;
    const cache = new CacheMemoria<number>(1000, { ahora: () => ahora });
    let llamadas = 0;

    await cache.obtenerOCargar('k', async () => ++llamadas);
    await cache.obtenerOCargar('k', async () => ++llamadas);
    expect(llamadas).toBe(1);

    ahora = 999;
    expect(await cache.obtenerOCargar('k', async () => ++llamadas)).toBe(1);
    expect(llamadas).toBe(1);

    ahora = 1000;
    expect(await cache.obtenerOCargar('k', async () => ++llamadas)).toBe(2);
    expect(llamadas).toBe(2);
  });

  it('invalida por clave y en bloque', async () => {
    const cache = new CacheMemoria<string>(1000);
    cache.guardar('a', 'uno');
    cache.guardar('b', 'dos');

    cache.invalidar('a');
    expect(cache.obtener('a')).toBeUndefined();
    expect(cache.obtener('b')).toBe('dos');

    cache.invalidar();
    expect(cache.tamano).toBe(0);
  });

  it('rechaza un TTL no positivo', () => {
    expect(() => new CacheMemoria<number>(0)).toThrow(RangeError);
    expect(() => new CacheMemoria<number>(-1)).toThrow(RangeError);
  });

  it('el servicio consulta PostgreSQL una sola vez dentro del TTL y reutiliza la carga', async () => {
    let ahora = 0;
    const { pool, consultas } = crearPoolFalso(['sigd_auth', 'sigd_org', 'sigd_rut', 'sigd_doc']);
    const cache = new CacheMemoria<TablasMaestras>(TTL_TABLAS_MAESTRAS_MS, { ahora: () => ahora });
    const servicio = new TablasMaestrasService(pool, {
      cache,
      ahora: () => new Date(ahora).toISOString(),
    });

    const primera = await servicio.listarMaestras();
    const segunda = await servicio.listarMaestras();
    expect(segunda).toBe(primera);
    expect(consultas()).toHaveLength(CATALOGOS.length);

    ahora = TTL_TABLAS_MAESTRAS_MS + 1;
    const tercera = await servicio.listarMaestras();
    expect(tercera).not.toBe(primera);
    expect(consultas()).toHaveLength(CATALOGOS.length * 2);
  });

  it('usa claves de caché distintas para la variante con inactivos', async () => {
    const { pool } = crearPoolFalso(['sigd_auth', 'sigd_org', 'sigd_rut', 'sigd_doc']);
    const servicio = new TablasMaestrasService(pool, { ttlMs: TTL_TABLAS_MAESTRAS_MS });

    const activos = await servicio.listarMaestras(true);
    const todos = await servicio.listarMaestras(false);
    expect(activos).not.toBe(todos);
    expect(activos.solo_activos).toBe(true);
    expect(todos.solo_activos).toBe(false);
  });

  it('forzar la recarga ignora la entrada cacheada', async () => {
    const { pool, consultas } = crearPoolFalso(['sigd_auth', 'sigd_org', 'sigd_rut', 'sigd_doc']);
    const servicio = new TablasMaestrasService(pool, { ttlMs: TTL_TABLAS_MAESTRAS_MS });

    await servicio.listarMaestras();
    const antes = consultas().length;
    await servicio.listarMaestras(true, true);
    expect(consultas().length).toBe(antes * 2);
  });
});

describe('tablas maestras · inventario consolidado', () => {
  it('reutiliza únicamente catálogos ya existentes en los DDL del proyecto', () => {
    const pares = new Set(CATALOGOS.map((c) => `${c.esquema}.${c.tabla}`));
    expect(pares).toEqual(
      new Set([
        'sigd_auth.tipos_documento',
        'sigd_doc.tipo_documento',
        'sigd_doc.tipo_tramite_tupa',
        'sigd_rut.estado_tramite',
        'sigd_rut.accion_tramite',
        'sigd_rut.tipo_relacion_movimiento',
        'sigd_org.area',
        'sigd_org.cargo',
        'sigd_org.permiso_sistema',
        'sigd_org.calendario_laboral',
      ]),
    );
  });

  it('marca como no disponible el catálogo cuyo esquema aún no está desplegado', async () => {
    const { pool } = crearPoolFalso(['sigd_auth', 'sigd_org', 'sigd_rut', 'sigd_doc']);
    const definicion = CATALOGOS.find((c) => c.clave === 'tipos_documento_identidad');
    expect(definicion).toBeDefined();

    const disponible = await consultarCatalogo(pool, definicion!, true);
    expect(disponible.disponible).toBe(true);
    expect(disponible.total).toBe(1);

    const { pool: poolParcial } = crearPoolFalso([]);
    const ausente = await consultarCatalogo(poolParcial, definicion!, true);
    expect(ausente.disponible).toBe(false);
    expect(ausente.total).toBe(0);
    expect(ausente.items).toEqual([]);
  });

  it('degrada un catálogo con columnas distintas sin tumbar la respuesta consolidada', async () => {
    const definicion = CATALOGOS.find((c) => c.clave === 'unidades_organicas');
    expect(definicion).toBeDefined();

    const poolColumnaAusente = {
      async query() {
        throw errorPostgres('42703');
      },
    } as unknown as Pool;

    const catalogo = await consultarCatalogo(poolColumnaAusente, definicion!, true);
    expect(catalogo.disponible).toBe(false);
  });

  it('propaga los errores de PostgreSQL que no son de despliegue ausente', async () => {
    const definicion = CATALOGOS.find((c) => c.clave === 'cargos');
    expect(definicion).toBeDefined();

    const poolConFalla = {
      async query() {
        throw errorPostgres('08006');
      },
    } as unknown as Pool;

    await expect(consultarCatalogo(poolConFalla, definicion!, true)).rejects.toMatchObject({
      code: '08006',
    });
  });

  it('consulta todos los catálogos y reporta cuántos están disponibles', async () => {
    const { pool } = crearPoolFalso(['sigd_auth', 'sigd_rut']);
    const catalogos = await consultarCatalogos(pool, true);
    expect(catalogos).toHaveLength(CATALOGOS.length);
    expect(catalogos.filter((c) => c.disponible).map((c) => c.clave)).toEqual([
      'tipos_documento_identidad',
      'estados_tramite',
      'acciones_tramite',
      'tipos_relacion_movimiento',
    ]);
  });
});

describe('tablas maestras · validación Zod de la consulta', () => {
  it('aplica los valores por defecto solo_activos=true y recargar=false', () => {
    const consulta = esquemaConsultaTablasMaestras.parse({});
    expect(consulta.solo_activos).toBe(true);
    expect(consulta.recargar).toBe(false);
  });

  it('interpreta los flags booleanos como texto', () => {
    expect(esquemaConsultaTablasMaestras.parse({ solo_activos: 'false' }).solo_activos).toBe(false);
    expect(esquemaConsultaTablasMaestras.parse({ recargar: 'true' }).recargar).toBe(true);
  });

  it('rechaza valores no booleanos y parámetros desconocidos', () => {
    expect(() => esquemaConsultaTablasMaestras.parse({ solo_activos: 'si' })).toThrow();
    expect(() => esquemaConsultaTablasMaestras.parse({ catalogo: 'tipos_tramite' })).toThrow();
  });
});
