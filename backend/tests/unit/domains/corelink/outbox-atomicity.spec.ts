import { describe, it, expect, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { insertarEvento } from '../../../../src/audit/evento-outbox.repository.js';

describe('AF11-R1: Transactional Outbox Atomicity & Persistence Guarantees', () => {
  it('1. Inserción exitosa en sigd_audit.evento_outbox retorna el id_evento dentro de la transacción', async () => {
    const mockQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
        return {
          rows: [{ id_evento: 'e0000000-0000-4000-8000-000000000001' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const mockCliente = {
      query: mockQuery,
    } as unknown as PoolClient;

    const idEvento = await insertarEvento(mockCliente, {
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteDerivado',
      payload: { expediente_id: 'exp-1', cut: 'EXP-2026-000001' },
    });

    expect(idEvento).toBe('e0000000-0000-4000-8000-000000000001');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sigd_audit.evento_outbox'),
      expect.arrayContaining(['Expediente', 'ExpedienteDerivado']),
    );
  });

  it('2. Si insertarEvento falla, la excepción se propaga y fuerza ROLLBACK sin confirmar la transacción', async () => {
    const mockQuery = vi.fn(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('UPDATE sigd_tra.expediente')) return { rows: [{ id: 'exp-1' }], rowCount: 1 };
      if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
        throw new Error('Fallo simulado de disco o restricción en sigd_audit.evento_outbox');
      }
      if (sql === 'COMMIT') return { rows: [] };
      return { rows: [] };
    });

    const mockCliente = {
      query: mockQuery,
      release: vi.fn(),
    } as unknown as PoolClient;

    let errorCapturado: Error | null = null;
    try {
      await mockCliente.query('BEGIN');
      await mockCliente.query('UPDATE sigd_tra.expediente SET estado = $1 WHERE id = $2', ['EN_TRAMITE', 'exp-1']);
      await insertarEvento(mockCliente, {
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteActualizado',
        payload: { id: 'exp-1' },
      });
      await mockCliente.query('COMMIT');
    } catch (error: any) {
      errorCapturado = error;
      await mockCliente.query('ROLLBACK');
    }

    expect(errorCapturado).not.toBeNull();
    expect(errorCapturado?.message).toContain('Fallo simulado de disco o restricción');
    expect(mockQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mockQuery).not.toHaveBeenCalledWith('COMMIT');
  });

  it('3. Demuestra que silenciar insertarEvento con .catch(() => {}) rompería la atomicidad (Antipatrón evitado)', async () => {
    const mockQuery = vi.fn(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE sigd_tra.expediente')) return { rows: [{ id: 'exp-1' }], rowCount: 1 };
      if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
        throw new Error('Error crítico en tabla outbox');
      }
      return { rows: [] };
    });

    const mockCliente = { query: mockQuery } as unknown as PoolClient;

    // Ejecución con patrón canónico correcto: NO silenciar con .catch()
    let transaccionConfirmada = false;
    try {
      await mockCliente.query('BEGIN');
      await mockCliente.query('UPDATE sigd_tra.expediente SET estado = $1', ['RESUELTO']);
      await insertarEvento(mockCliente, {
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteResuelto',
        payload: { cut: 'EXP-1' },
      });
      await mockCliente.query('COMMIT');
      transaccionConfirmada = true;
    } catch {
      await mockCliente.query('ROLLBACK');
      transaccionConfirmada = false;
    }

    // La transacción NO debe haberse confirmado
    expect(transaccionConfirmada).toBe(false);
    expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
  });
});
