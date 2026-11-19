import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { RepositorioPostgresRutaDoc, SQL_BANDEJA_LOCAL_RUTADOC,
  SQL_CONTADORES_RUTADOC, SQL_LISTAR_RUTADOC } from '../../../../src/domains/rutadoc/rutadoc.repository.js';
import type { FiltrosRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const persona = '20000000-0000-4000-8000-000000000002';
const expediente = '30000000-0000-4000-8000-000000000003';
const alcance = { solicitanteId: persona, accesoGlobal: false };
const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20 };
const estados = ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION'] as const;

describe('alcance de autorización en la consulta de Bandeja RutaDoc', () => {
  it('aplica el filtro de propietario antes del límite y evita contadores locales globales', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ elementos: [], contadores: {
      PENDIENTES: 0, EN_TRAMITE: 0, DERIVADOS: 0, POR_FIRMAR: 0, ATENDIDOS: 0, ARCHIVADOS: 0,
    } }], rowCount: 1 });
    const pool = { query } as unknown as Pool;

    await new RepositorioPostgresRutaDoc(pool).listar(filtros, estados, null, alcance);

    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toBe(SQL_BANDEJA_LOCAL_RUTADOC);
    expect(sql).toContain('AND ($5::boolean OR e.solicitante_id = $6::uuid)');
    expect(sql).toContain('CASE WHEN $5::boolean AND EXISTS');
    expect(sql.split('AND ($5::boolean OR e.solicitante_id = $6::uuid)').length - 1).toBe(2);
    expect(sql.indexOf('e.solicitante_id = $6::uuid')).toBeLessThan(sql.indexOf('LIMIT $10'));
    expect(params).toEqual([null, null, null, null, false, persona, [...estados], null, null, 21]);
  });

  it('repite el alcance en listado paginado y contadores filtrados', async () => {
    const queries: Array<[string, unknown[] | undefined]> = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        queries.push([sql, params]);
        if (sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' || sql === 'COMMIT') {
          return { rows: [], rowCount: 0 };
        }
        if (sql === SQL_LISTAR_RUTADOC) return { rows: [], rowCount: 0 };
        if (sql === SQL_CONTADORES_RUTADOC) return { rows: [{}], rowCount: 1 };
        throw new Error('Consulta inesperada en prueba sintética de autorización de Bandeja.');
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await new RepositorioPostgresRutaDoc(pool).listar({ ...filtros, terminoBusqueda: 'CUT' }, estados, null, alcance);

    const consultaListado = queries.find(([sql]) => sql === SQL_LISTAR_RUTADOC)!;
    const consultaConteos = queries.find(([sql]) => sql === SQL_CONTADORES_RUTADOC)!;
    expect(consultaListado[0]).toContain('AND ($5::boolean OR e.solicitante_id = $6::uuid)');
    expect(consultaListado[0].indexOf('e.solicitante_id = $6::uuid')).toBeLessThan(consultaListado[0].indexOf('LIMIT $10'));
    expect(consultaConteos[0]).toContain('AND ($5::boolean OR e.solicitante_id = $6::uuid)');
    expect(consultaListado[1]?.slice(4, 6)).toEqual([false, persona]);
    expect(consultaConteos[1]).toEqual(['CUT', null, null, null, false, persona]);
    expect(queries[0][0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('si falla una consulta, revierte y no transforma el error en autorización', async () => {
    const cliente = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY') return { rows: [], rowCount: 0 };
        if (sql === SQL_LISTAR_RUTADOC) throw new Error('fallo SQL simulado');
        if (sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
        throw new Error('Consulta inesperada');
      }), release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(cliente as unknown as PoolClient) } as unknown as Pool;
    await expect(new RepositorioPostgresRutaDoc(pool).listar({ ...filtros, terminoBusqueda: 'CUT' }, estados, null, alcance))
      .rejects.toThrow('fallo SQL simulado');
    expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
    expect(cliente.release).toHaveBeenCalledOnce();
  });
});
