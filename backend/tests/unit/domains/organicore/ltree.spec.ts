import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { OrganigramaService } from '../../../../src/domains/organicore/organigrama.service.js';
import { DomainError } from '../../../../src/shared/domain/errors/index.js';

function crearPoolMock(rows: unknown[]): Partial<Pool> {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as Partial<Pool>;
}

describe('OrganigramaService (ltree)', () => {
  let pool: Partial<Pool>;

  beforeEach(() => {
    pool = {};
  });

  describe('ensamblado de árbol jerárquico O(N)', () => {
    it('transforma una lista plana en una estructura anidada', async () => {
      pool = crearPoolMock([
        { id: '1', sigla: 'DIR', nombre: 'Dirección', padre_id: null, path: 'DIR', estado: true },
        { id: '2', sigla: 'ACA', nombre: 'Académica', padre_id: '1', path: 'DIR.ACA', estado: true },
        { id: '3', sigla: 'ADM', nombre: 'Administración', padre_id: '1', path: 'DIR.ADM', estado: true },
        { id: '4', sigla: 'INV', nombre: 'Investigación', padre_id: '2', path: 'DIR.ACA.INV', estado: true },
      ]);

      const servicio = new OrganigramaService(pool as Pool);
      const arbol = await servicio.obtenerOrganigrama();

      expect(arbol).toHaveLength(1);
      expect(arbol[0].sigla).toBe('DIR');
      expect(arbol[0].children).toHaveLength(2);
      const academia = arbol[0].children.find((nodo) => nodo.sigla === 'ACA');
      expect(academia?.children).toHaveLength(1);
      expect(academia?.children[0].sigla).toBe('INV');
    });

    it('devolverá múltiples raíces cuando existan nodos sin padre', async () => {
      pool = crearPoolMock([
        { id: 'a', sigla: 'RAIZ1', nombre: 'Raíz 1', padre_id: null, path: 'RAIZ1', estado: true },
        { id: 'b', sigla: 'RAIZ2', nombre: 'Raíz 2', padre_id: null, path: 'RAIZ2', estado: true },
      ]);

      const servicio = new OrganigramaService(pool as Pool);
      const arbol = await servicio.obtenerOrganigrama();

      expect(arbol).toHaveLength(2);
    });
  });

  describe('intercepción de JERARQUIA_CICLO_INVALIDO', () => {
    it('relanza una excepción DomainError cuando la base rechaza un ciclo', async () => {
      const errorBase = new Error('JERARQUIA_CICLO_INVALIDO: no se puede asignar un padre descendiente');
      pool = {
        query: vi.fn().mockRejectedValue(errorBase),
      };

      const servicio = new OrganigramaService(pool as Pool);

      await expect(
        servicio.actualizarUnidad('unidad-a', { padre_id: 'unidad-b' })
      ).rejects.toBeInstanceOf(DomainError);

      await expect(
        servicio.actualizarUnidad('unidad-a', { padre_id: 'unidad-b' })
      ).rejects.toMatchObject({ code: 'JERARQUIA_CICLO_INVALIDO' });
    });

    it('permite reubicar hacia un padre válido sin lanzar error', async () => {
      pool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ id: 'x', sigla: 'NUEVA', nombre: 'Nueva', padre_id: '1', path: 'DIR.NUEVA', estado: true }],
        }),
      };

      const servicio = new OrganigramaService(pool as Pool);
      const resultado = await servicio.actualizarUnidad('x', { padre_id: '1' });

      expect(resultado.padre_id).toBe('1');
      expect(resultado.path).toBe('DIR.NUEVA');
    });
  });
});
