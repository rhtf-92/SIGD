import { describe, it, expect } from 'vitest';
import { UCAYALI_PROVINCIAS } from '../../components/common/UbigeoSelector';

describe('Catálogo UCAYALI_PROVINCIAS', () => {
  describe('Estructura general', () => {
    it('debe contener exactamente 4 provincias', () => {
      expect(UCAYALI_PROVINCIAS).toHaveLength(4);
    });

    it('las provincias deben ser: Coronel Portillo, Padre Abad, Atalaya, Purús', () => {
      const nombres = UCAYALI_PROVINCIAS.map((prov) => prov.nombre);
      expect(nombres).toEqual([
        'Coronel Portillo',
        'Padre Abad',
        'Atalaya',
        'Purús',
      ]);
    });

    it('la suma total de distritos entre todas las provincias debe ser 19', () => {
      const sumaCalculada = UCAYALI_PROVINCIAS.reduce(
        (acum, prov) => acum + prov.distritos.length,
        0
      );
      expect(sumaCalculada).toBe(19);
    });

    it('cada provincia debe tener al menos 1 distrito (ninguna vacía)', () => {
      UCAYALI_PROVINCIAS.forEach((prov) => {
        expect(prov.distritos.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Unicidad de códigos', () => {
    it('los códigos de provincia deben ser únicos', () => {
      const codigosProvincia = UCAYALI_PROVINCIAS.map((prov) => prov.codigo);
      const unicos = new Set(codigosProvincia);
      expect(unicos.size).toBe(codigosProvincia.length);
    });

    it('los códigos de distrito deben ser únicos globalmente entre todas las provincias', () => {
      const todosLosCodigos: string[] = [];
      UCAYALI_PROVINCIAS.forEach((prov) => {
        prov.distritos.forEach((distrito) => {
          todosLosCodigos.push(distrito.codigo);
        });
      });
      const unicos = new Set(todosLosCodigos);
      expect(unicos.size).toBe(todosLosCodigos.length);
    });
  });

  describe('Pruebas específicas', () => {
    it('la provincia "Coronel Portillo" (código "2501") debe contener exactamente el distrito "Callería" con código "250101"', () => {
      const coronelPortillo = UCAYALI_PROVINCIAS.find(
        (prov) => prov.codigo === '2501'
      );
      expect(coronelPortillo).toBeDefined();
      if (coronelPortillo) {
        expect(coronelPortillo.nombre).toBe('Coronel Portillo');
        const calleria = coronelPortillo.distritos.find(
          (d) => d.codigo === '250101'
        );
        expect(calleria).toBeDefined();
        if (calleria) {
          expect(calleria.nombre).toBe('Callería');
        }
      }
    });

    it('la provincia "Purús" debe tener exactamente 1 distrito', () => {
      const purus = UCAYALI_PROVINCIAS.find(
        (prov) => prov.codigo === '2504'
      );
      expect(purus).toBeDefined();
      if (purus) {
        expect(purus.nombre).toBe('Purús');
        expect(purus.distritos).toHaveLength(1);
      }
    });
  });
});