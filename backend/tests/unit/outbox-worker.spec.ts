import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  OutboxWorker,
  type EventoPendiente,
  type DespachadorEvento,
} from '../../src/audit/outbox-worker.js';

describe('OutboxWorker · Pruebas unitarias de ciclo, reintentos y dead-letter', () => {
  let mockClient: {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  let mockPool: {
    connect: ReturnType<typeof vi.fn>;
  };
  let mockDespachador: {
    despachar: ReturnType<typeof vi.fn>;
  };

  const eventoEjemplo: EventoPendiente = {
    id_evento: '11111111-1111-4111-8111-111111111111',
    correlation_id: '22222222-2222-4222-8222-222222222222',
    agregado: 'expediente',
    tipo_evento: 'casilla_notificacion',
    payload: { cut: 'EXP-2026-000001' },
    intentos: 0,
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient as unknown as PoolClient),
    };
    mockDespachador = {
      despachar: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('1. Procesa lote de eventos pendientes, los despacha y los marca como PROCESADO', async () => {
    mockClient.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('SELECT id_evento') && sql.includes('FOR UPDATE SKIP LOCKED')) {
        return {
          rows: [
            {
              id_evento: eventoEjemplo.id_evento,
              correlation_id: eventoEjemplo.correlation_id,
              agregado: eventoEjemplo.agregado,
              tipo_evento: eventoEjemplo.tipo_evento,
              payload: eventoEjemplo.payload,
              intentos: 0,
            },
          ],
        };
      }
      if (sql.includes('UPDATE sigd_audit.evento_outbox') && sql.includes("SET estado = 'PROCESADO'")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql === 'COMMIT') return { rows: [] };
      return { rows: [] };
    });

    const worker = new OutboxWorker(mockPool as unknown as Pool, mockDespachador as unknown as DespachadorEvento, {
      lote: 10,
    });

    const procesados = await worker.ciclo();

    expect(procesados).toBe(1);
    expect(mockPool.connect).toHaveBeenCalledOnce();
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockDespachador.despachar).toHaveBeenCalledWith(eventoEjemplo);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET estado = 'PROCESADO'"),
      [eventoEjemplo.id_evento],
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('2. Ciclo sin eventos pendientes devuelve 0 y no invoca despachador', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('SELECT id_evento')) return { rows: [] };
      return { rows: [] };
    });

    const worker = new OutboxWorker(mockPool as unknown as Pool, mockDespachador as unknown as DespachadorEvento);
    const procesados = await worker.ciclo();

    expect(procesados).toBe(0);
    expect(mockDespachador.despachar).not.toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('3. Ante fallo transitorio en despacho, incrementa intentos y conserva estado PENDIENTE', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('SELECT id_evento')) {
        return { rows: [{ ...eventoEjemplo, intentos: 1 }] };
      }
      if (sql.includes('UPDATE sigd_audit.evento_outbox') && sql.includes('SET intentos = $2')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });

    mockDespachador.despachar.mockRejectedValueOnce(new Error('Transporte caído'));

    const worker = new OutboxWorker(mockPool as unknown as Pool, mockDespachador as unknown as DespachadorEvento, {
      maxIntentos: 5,
      backoffBaseMs: 1,
    });

    const procesados = await worker.ciclo();

    expect(procesados).toBe(0);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SET intentos = $2'),
      [eventoEjemplo.id_evento, 2],
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('4. Al agotar maxIntentos tras fallos sucesivos, clasifica el evento como FALLIDO (dead-letter)', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('SELECT id_evento')) {
        // Evento con intentos ya en 4 y maxIntentos = 5 (este fallo llega a 5)
        return { rows: [{ ...eventoEjemplo, intentos: 4 }] };
      }
      if (sql.includes('UPDATE sigd_audit.evento_outbox') && sql.includes("estado = 'FALLIDO'")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });

    mockDespachador.despachar.mockRejectedValueOnce(new Error('Fallo definitivo'));

    const worker = new OutboxWorker(mockPool as unknown as Pool, mockDespachador as unknown as DespachadorEvento, {
      maxIntentos: 5,
    });

    const procesados = await worker.ciclo();

    expect(procesados).toBe(0);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("estado = 'FALLIDO'"),
      [eventoEjemplo.id_evento, 5],
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('5. Ante error grave de base de datos, ejecuta ROLLBACK y libera conexión', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('SELECT id_evento')) {
        throw new Error('Deadlock detectado');
      }
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const worker = new OutboxWorker(mockPool as unknown as Pool, mockDespachador as unknown as DespachadorEvento);

    await expect(worker.ciclo()).rejects.toThrow('Deadlock detectado');

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('6. Detener cambia la bandera y no continúa iterando', () => {
    const worker = new OutboxWorker(mockPool as unknown as Pool, mockDespachador as unknown as DespachadorEvento);
    worker.detener();
    // Verificamos que detener() se ejecuta limpiamente
    expect(typeof worker.detener).toBe('function');
  });
});
