import { describe, it, expect } from 'vitest';
import { PROVINCIAS_UCAYALI, DISTRITOS_UCAYALI } from '../../data/ucayali';
import type { UbigeoItem } from '../../data/ucayali';

describe('Catálogo PROVINCIAS_UCAYALI y DISTRITOS_UCAYALI', () => {
  describe('Estructura general', () => {
    it('debe contener exactamente 4 provincias', () => {
      expect(PROVINCIAS_UCAYALI).toHaveLength(4);
    });

    it('las provincias deben ser: CORONEL PORTILLO, ATALAYA, PADRE ABAD, PURUS', () => {
      const nombres = PROVINCIAS_UCAYALI.map((prov: UbigeoItem) => prov.nombre);
      expect(nombres).toEqual([
        'CORONEL PORTILLO',
        'ATALAYA',
        'PADRE ABAD',
        'PURUS',
      ]);
    });

    it('la suma total de distritos entre todas las provincias debe ser 17', () => {
      const sumaCalculada = PROVINCIAS_UCAYALI.reduce(
        (acum: number, prov: UbigeoItem) => {
          const distritos = DISTRITOS_UCAYALI.filter(
            (dist: UbigeoItem) => dist.padreId === prov.id
          );
          return acum + distritos.length;
        },
        0
      );
      expect(sumaCalculada).toBe(17);
    });

    it('cada provincia debe tener al menos 1 distrito (ninguna vacía)', () => {
      PROVINCIAS_UCAYALI.forEach((prov: UbigeoItem) => {
        const distritos = DISTRITOS_UCAYALI.filter(
          (dist: UbigeoItem) => dist.padreId === prov.id
        );
        expect(distritos.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Unicidad de códigos', () => {
    it('los códigos de provincia deben ser únicos', () => {
      const codigosProvincia = PROVINCIAS_UCAYALI.map((prov: UbigeoItem) => prov.id);
      const unicos = new Set(codigosProvincia);
      expect(unicos.size).toBe(codigosProvincia.length);
    });

    it('los códigos de distrito deben ser únicos globalmente entre todas las provincias', () => {
      const todosLosCodigos: string[] = [];
      PROVINCIAS_UCAYALI.forEach((prov: UbigeoItem) => {
        const distritos = DISTRITOS_UCAYALI.filter(
          (dist: UbigeoItem) => dist.padreId === prov.id
        );
        distritos.forEach((distrito: UbigeoItem) => {
          todosLosCodigos.push(distrito.id);
        });
      });
      const unicos = new Set(todosLosCodigos);
      expect(unicos.size).toBe(todosLosCodigos.length);
    });
  });

  describe('Pruebas específicas', () => {
    it('la provincia "CORONEL PORTILLO" (código "2501") debe contener exactamente el distrito "CALLERIA" con código "250101"', () => {
      const coronelPortillo = PROVINCIAS_UCAYALI.find(
        (prov: UbigeoItem) => prov.id === '2501'
      );
      expect(coronelPortillo).toBeDefined();
      if (coronelPortillo) {
        expect(coronelPortillo.nombre).toBe('CORONEL PORTILLO');
        const distritosPortillo = DISTRITOS_UCAYALI.filter(
          (d: UbigeoItem) => d.padreId === coronelPortillo.id
        );
        const calleria = distritosPortillo.find(
          (d: UbigeoItem) => d.id === '250101'
        );
        expect(calleria).toBeDefined();
        if (calleria) {
          expect(calleria.nombre).toBe('CALLERIA');
        }
      }
    });

    it('la provincia "PURUS" debe tener exactamente 1 distrito', () => {
      const purus = PROVINCIAS_UCAYALI.find(
        (prov: UbigeoItem) => prov.id === '2504'
      );
      expect(purus).toBeDefined();
      if (purus) {
        expect(purus.nombre).toBe('PURUS');
        const distritosPurus = DISTRITOS_UCAYALI.filter(
          (d: UbigeoItem) => d.padreId === purus.id
        );
        expect(distritosPurus).toHaveLength(1);
      }
    });
  });
});