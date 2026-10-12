import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import { OrganigramaService } from '../../../../src/domains/organicore/organigrama.service.js';
import { DomainError } from '../../../../src/shared/domain/errors/index.js';

describe('OrganigramaService · contrato sigd_org.area', () => {
  const query = vi.fn();
  const pool = { query } as unknown as Pool;
  beforeEach(() => vi.clearAllMocks());

  it('consulta la tabla real y ensambla el árbol', async () => {
    query.mockResolvedValue({ rows: [
      { id: '1', codigo: 'DIR', nombre: 'Dirección', padreId: null, path: 'a.DIR', nivel: 1, vigente: true },
      { id: '2', codigo: 'ACA', nombre: 'Académica', padreId: '1', path: 'a.DIR.a.ACA', nivel: 2, vigente: true },
    ] });
    const arbol = await new OrganigramaService(pool).obtenerOrganigrama();
    expect(String(query.mock.calls[0][0])).toContain('FROM sigd_org.area');
    expect(String(query.mock.calls[0][0])).not.toContain('unidad_organica');
    expect(arbol[0].children[0].codigo).toBe('ACA');
  });

  it('crea áreas con código normalizado y deja el path al trigger', async () => {
    query.mockResolvedValue({ rows: [{ id: '1', codigo: 'ADM' }] });
    await new OrganigramaService(pool).crearUnidad({ codigo: 'adm', nombre: 'Administración', padreId: null });
    expect(String(query.mock.calls[0][0])).toContain('INSERT INTO sigd_org.area');
    expect(query.mock.calls[0][1]).toEqual(['ADM', 'Administración', null]);
  });

  it('rechaza ciclos antes de cambiar la jerarquía', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ path: 'a.DIR' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ uno: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    } as unknown as PoolClient;
    const transactionalPool = { connect: vi.fn(async () => client) } as unknown as Pool;
    await expect(new OrganigramaService(transactionalPool).actualizarUnidad(
      '11111111-1111-4111-8111-111111111111',
      { padreId: '22222222-2222-4222-8222-222222222222' },
    )).rejects.toBeInstanceOf(DomainError);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
