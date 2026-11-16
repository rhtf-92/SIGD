import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEPARTAMENTO_UCAYALI,
  DEPARTAMENTO_UCAYALI_ID,
  DEPARTAMENTO_UCAYALI_NOMBRE,
} from '../../../src/data/ucayali';
import {
  fetchProvincias,
  fetchDistritos,
  clearUbigeoCache,
} from '../../../src/services/ubigeoService';
import { apiClient } from '../../../src/api/client';
import type { UbigeoItem } from '../../../src/types/ubigeo';

const CANONICAL_PROVINCIAS_UCAYALI = [
  { id: '2501', nombre: 'CORONEL PORTILLO', padreId: '25' },
  { id: '2502', nombre: 'ATALAYA', padreId: '25' },
  { id: '2503', nombre: 'PADRE ABAD', padreId: '25' },
  { id: '2504', nombre: 'PURUS', padreId: '25' },
];

const CANONICAL_DISTRITOS_UCAYALI: Record<string, Array<{ id: string; nombre: string; padreId: string }>> = {
  '2501': [
    { id: '250101', nombre: 'CALLERIA', padreId: '2501' },
    { id: '250102', nombre: 'CAMPOVERDE', padreId: '2501' },
    { id: '250103', nombre: 'IPARIA', padreId: '2501' },
    { id: '250104', nombre: 'MASISEA', padreId: '2501' },
    { id: '250105', nombre: 'YARINACOCHA', padreId: '2501' },
    { id: '250106', nombre: 'NUEVA REQUENA', padreId: '2501' },
    { id: '250107', nombre: 'MANANTAY', padreId: '2501' },
  ],
  '2502': [
    { id: '250201', nombre: 'RAIMONDI', padreId: '2502' },
    { id: '250202', nombre: 'SEPAHUA', padreId: '2502' },
    { id: '250203', nombre: 'TAHUANIA', padreId: '2502' },
    { id: '250204', nombre: 'YURUA', padreId: '2502' },
  ],
  '2503': [
    { id: '250301', nombre: 'PADRE ABAD', padreId: '2503' },
    { id: '250302', nombre: 'IRAZOLA', padreId: '2503' },
    { id: '250303', nombre: 'CURIMANA', padreId: '2503' },
    { id: '250304', nombre: 'NESHUYA', padreId: '2503' },
    { id: '250305', nombre: 'ALEXANDER VON HUMBOLDT', padreId: '2503' },
  ],
  '2504': [
    { id: '250401', nombre: 'PURUS', padreId: '2504' },
  ],
};

describe('Catálogo Canónico Regional Ucayali (25) vía ubigeoService y Constantes Institucionales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearUbigeoCache();

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/ubigeo/provincias')) {
        return {
          data: CANONICAL_PROVINCIAS_UCAYALI.map((p) => ({
            codigo: p.id,
            nombre: p.nombre,
            departamentoCodigo: '25',
          })),
        } as never;
      }
      if (url.includes('/api/v1/ubigeo/distritos')) {
        const match = url.match(/provinciaCodigo=([^&]+)/);
        const prov = match ? decodeURIComponent(match[1]) : '';
        const dists = CANONICAL_DISTRITOS_UCAYALI[prov] || [];
        return {
          data: dists.map((d) => ({
            codigo: d.id,
            nombre: d.nombre,
            provinciaCodigo: prov,
          })),
        } as never;
      }
      return { data: [] } as never;
    });
  });

  describe('Constantes Institucionales de la Sede Central (Pucallpa)', () => {
    it('debe tener el departamento 25 UCAYALI correctamente configurado', () => {
      expect(DEPARTAMENTO_UCAYALI_ID).toBe('25');
      expect(DEPARTAMENTO_UCAYALI_NOMBRE).toBe('UCAYALI');
      expect(DEPARTAMENTO_UCAYALI).toEqual({
        id: '25',
        nombre: 'UCAYALI',
      });
    });
  });

  describe('Estructura general de Provincias y Distritos consultados dinámicamente', () => {
    it('debe contener exactamente 4 provincias', async () => {
      const provincias = await fetchProvincias('25');
      expect(provincias).toHaveLength(4);
    });

    it('las provincias deben ser: CORONEL PORTILLO, ATALAYA, PADRE ABAD, PURUS', async () => {
      const provincias = await fetchProvincias('25');
      const nombres = provincias.map((prov: UbigeoItem) => prov.nombre);
      expect(nombres).toEqual([
        'CORONEL PORTILLO',
        'ATALAYA',
        'PADRE ABAD',
        'PURUS',
      ]);
    });

    it('la suma total de distritos entre todas las provincias debe ser exactamente 17', async () => {
      const provincias = await fetchProvincias('25');
      let sumaCalculada = 0;
      for (const prov of provincias) {
        const distritos = await fetchDistritos(prov.id);
        sumaCalculada += distritos.length;
      }
      expect(sumaCalculada).toBe(17);
    });

    it('cada provincia debe tener al menos 1 distrito (ninguna vacía)', async () => {
      const provincias = await fetchProvincias('25');
      for (const prov of provincias) {
        const distritos = await fetchDistritos(prov.id);
        expect(distritos.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Unicidad de códigos', () => {
    it('los códigos de provincia deben ser únicos', async () => {
      const provincias = await fetchProvincias('25');
      const codigosProvincia = provincias.map((prov: UbigeoItem) => prov.id);
      const unicos = new Set(codigosProvincia);
      expect(unicos.size).toBe(codigosProvincia.length);
    });

    it('los códigos de distrito deben ser únicos globalmente entre todas las provincias', async () => {
      const provincias = await fetchProvincias('25');
      const todosLosCodigos: string[] = [];
      for (const prov of provincias) {
        const distritos = await fetchDistritos(prov.id);
        distritos.forEach((distrito: UbigeoItem) => {
          todosLosCodigos.push(distrito.id);
        });
      }
      const unicos = new Set(todosLosCodigos);
      expect(unicos.size).toBe(todosLosCodigos.length);
    });
  });

  describe('Pruebas específicas por provincia', () => {
    it('la provincia "CORONEL PORTILLO" (código "2501") debe contener exactamente el distrito "CALLERIA" con código "250101"', async () => {
      const distritosPortillo = await fetchDistritos('2501');
      const calleria = distritosPortillo.find(
        (d: UbigeoItem) => d.id === '250101'
      );
      expect(calleria).toBeDefined();
      expect(calleria?.nombre).toBe('CALLERIA');
    });

    it('la provincia "PURUS" debe tener exactamente 1 distrito ("250401" PURUS)', async () => {
      const distritosPurus = await fetchDistritos('2504');
      expect(distritosPurus).toHaveLength(1);
      expect(distritosPurus[0].id).toBe('250401');
      expect(distritosPurus[0].nombre).toBe('PURUS');
    });
  });
});
