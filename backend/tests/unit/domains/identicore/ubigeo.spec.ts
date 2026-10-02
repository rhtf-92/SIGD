import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { UbigeoService, type CacheDistribuida } from '../../../../src/domains/identicore/ubigeo.service.js';

const filas = [
  { provincia_codigo: '2501', provincia_nombre: 'Coronel Portillo', distrito_codigo: '250101', distrito_nombre: 'Callería' },
  { provincia_codigo: '2501', provincia_nombre: 'Coronel Portillo', distrito_codigo: '250102', distrito_nombre: 'Campoverde' },
  { provincia_codigo: '2501', provincia_nombre: 'Coronel Portillo', distrito_codigo: '250103', distrito_nombre: 'Iparía' },
  { provincia_codigo: '2501', provincia_nombre: 'Coronel Portillo', distrito_codigo: '250104', distrito_nombre: 'Masisea' },
  { provincia_codigo: '2501', provincia_nombre: 'Coronel Portillo', distrito_codigo: '250105', distrito_nombre: 'Yarinacocha' },
  { provincia_codigo: '2501', provincia_nombre: 'Coronel Portillo', distrito_codigo: '250106', distrito_nombre: 'Nueva Requena' },
  { provincia_codigo: '2501', provincia_nombre: 'Coronel Portillo', distrito_codigo: '250107', distrito_nombre: 'Manantay' },
  { provincia_codigo: '2502', provincia_nombre: 'Atalaya', distrito_codigo: '250201', distrito_nombre: 'Raymondi' },
  { provincia_codigo: '2502', provincia_nombre: 'Atalaya', distrito_codigo: '250202', distrito_nombre: 'Sepahua' },
  { provincia_codigo: '2502', provincia_nombre: 'Atalaya', distrito_codigo: '250203', distrito_nombre: 'Tahuania' },
  { provincia_codigo: '2502', provincia_nombre: 'Atalaya', distrito_codigo: '250204', distrito_nombre: 'Yurúa' },
  { provincia_codigo: '2503', provincia_nombre: 'Padre Abad', distrito_codigo: '250301', distrito_nombre: 'Padre Abad' },
  { provincia_codigo: '2503', provincia_nombre: 'Padre Abad', distrito_codigo: '250302', distrito_nombre: 'Irazola' },
  { provincia_codigo: '2503', provincia_nombre: 'Padre Abad', distrito_codigo: '250303', distrito_nombre: 'Curimaná' },
  { provincia_codigo: '2503', provincia_nombre: 'Padre Abad', distrito_codigo: '250304', distrito_nombre: 'Neshuya' },
  { provincia_codigo: '2503', provincia_nombre: 'Padre Abad', distrito_codigo: '250305', distrito_nombre: 'Alexander von Humboldt' },
  { provincia_codigo: '2504', provincia_nombre: 'Purús', distrito_codigo: '250401', distrito_nombre: 'Purús' },
];

function construirCatalogo(): string {
  const provincias = new Map<string, { codigo: string; nombre: string; distritos: { codigo: string; nombre: string }[] }>();
  for (const fila of filas) {
    let provincia = provincias.get(fila.provincia_codigo);
    if (!provincia) {
      provincia = { codigo: fila.provincia_codigo, nombre: fila.provincia_nombre, distritos: [] };
      provincias.set(fila.provincia_codigo, provincia);
    }
    provincia.distritos.push({ codigo: fila.distrito_codigo, nombre: fila.distrito_nombre });
  }
  return JSON.stringify([...provincias.values()]);
}

describe('UbigeoService', () => {
  it('lee el catálogo normalizado una vez, publica en Redis y reutiliza la caché local', async () => {
    const query = vi.fn().mockResolvedValue({ rows: filas });
    const pool = { query } as unknown as Pool;
    const get = vi.fn().mockResolvedValue(null);
    const set = vi.fn().mockResolvedValue(undefined);
    const cache: CacheDistribuida = { get, set };
    const service = new UbigeoService(pool, cache);

    const primeraRespuesta = await service.obtenerDistritosUcayali();
    primeraRespuesta[0].distritos.pop();
    const segundaRespuesta = await service.obtenerDistritosUcayali();

    expect(segundaRespuesta).toHaveLength(4);
    expect(segundaRespuesta.reduce((total, provincia) => total + provincia.distritos.length, 0)).toBe(17);
    expect(query).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('usa el valor válido de Redis sin consultar PostgreSQL', async () => {
    const query = vi.fn();
    const pool = { query } as unknown as Pool;
    const catalogo = new Map<string, string>([['sigd:ubigeo:ucayali:v1', construirCatalogo()]]);
    const cache: CacheDistribuida = {
      get: vi.fn(async (clave) => catalogo.get(clave) ?? null),
      set: vi.fn(async (clave, valor) => { catalogo.set(clave, valor); }),
    };
    const service = new UbigeoService(pool, cache);

    await expect(service.obtenerDistritosUcayali('2504')).resolves.toEqual([{
      codigo: '2504',
      nombre: 'Purús',
      distritos: [{ codigo: '250401', nombre: 'Purús' }],
    }]);
    expect(query).not.toHaveBeenCalled();
  });
});