import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import type { Response } from 'express';
import { insertarEvento } from '../../../../src/audit/evento-outbox.repository.js';
import { OutboxWorker, type EventoPendiente } from '../../../../src/audit/outbox-worker.js';
import { BusSse } from '../../../../src/modules/corelink/sseStream.service.js';
import { DestinoSse, DestinoCasilla } from '../../../../src/audit/despachador-notificaciones.js';
import { BridgeNotificacion, CANAL_NOTIFY } from '../../../../src/core/realtime/bridge-notificacion.js';

describe('AF-24 — Sección 6: CoreLink Pipeline E2E & Evidencia de Integración Transaccional', () => {
  let mockClient: {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  let mockPool: {
    connect: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };

  const eventoPrueba: EventoPendiente = {
    id_evento: '11111111-2222-4333-8444-555555555555',
    correlation_id: '22222222-3333-4444-8555-666666666666',
    agregado: 'Expediente',
    tipo_evento: 'expediente_resuelto',
    payload: {
      usuario_id: '33333333-4444-4555-8666-777777777777',
      expediente_id: '44444444-5555-4666-8777-888888888888',
      cut: 'EXP-2026-000001',
      asunto: 'Resolución Directoral Emitida',
    },
    intentos: 0,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockPool = {
      connect: vi.fn().mockImplementation(async () => mockClient as unknown as PoolClient),
      query: vi.fn(),
    };
  });

  describe('1. Inserción Transaccional de Evento en Outbox (ACID)', () => {
    it('1.1 Inserción exitosa registra el evento en sigd_audit.evento_outbox dentro de la transacción de negocio', async () => {
      mockClient.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id_evento: eventoPrueba.id_evento }],
      });

      const idGenerado = await insertarEvento(mockClient as unknown as PoolClient, {
        agregado: eventoPrueba.agregado,
        tipo_evento: eventoPrueba.tipo_evento,
        payload: eventoPrueba.payload,
      });

      expect(idGenerado).toBe(eventoPrueba.id_evento);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sigd_audit.evento_outbox'),
        expect.arrayContaining([eventoPrueba.agregado, eventoPrueba.tipo_evento]),
      );
    });

    it('1.2 Si la inserción en outbox falla, se propaga el error para abortar el COMMIT del negocio', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Fallo de disco en tablespace de auditoría'));

      await expect(
        insertarEvento(mockClient as unknown as PoolClient, {
          agregado: 'Expediente',
          tipo_evento: 'expediente_derivado',
          payload: { cut: 'EXP-2026-000001' },
        }),
      ).rejects.toThrow('Fallo de disco en tablespace de auditoría');
    });
  });

  describe('2. Captura por el Worker y Despacho a BusSse / Clientes SSE', () => {
    it('2.1 Worker extrae eventos con SELECT FOR UPDATE SKIP LOCKED y los entrega al bus SSE', async () => {
      const busSse = new BusSse();
      const tramasRecibidas: string[] = [];
      const mockRes = {
        write: vi.fn((chunk: string) => {
          tramasRecibidas.push(chunk);
          return true;
        }),
        writableEnded: false,
      } as unknown as Response;

      busSse.suscribir(mockRes, ['casilla', 'expedientes', 'sla']);

      const destinoSse = new DestinoSse(busSse);

      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql.includes('SELECT id_evento') && sql.includes('FOR UPDATE SKIP LOCKED')) {
          return { rows: [eventoPrueba] };
        }
        if (sql.includes("SET estado = 'PROCESADO'")) {
          return { rowCount: 1, rows: [] };
        }
        return { rows: [] };
      });

      const worker = new OutboxWorker(mockPool as unknown as Pool, destinoSse, { lote: 10 });
      const procesados = await worker.ciclo();

      expect(procesados).toBe(1);
      expect(tramasRecibidas.length).toBe(1);
      expect(tramasRecibidas[0]).toContain('event: expediente_resuelto');
      expect(tramasRecibidas[0]).toContain('EXP-2026-000001');
      expect(tramasRecibidas[0]).toContain(eventoPrueba.id_evento);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET estado = 'PROCESADO'"),
        [eventoPrueba.id_evento],
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('3. Distribución inter-réplicas con BridgeNotificacion (PostgreSQL LISTEN/NOTIFY)', () => {
    it('3.1 Publica el evento despachado mediante pg_notify para difusión a réplicas', async () => {
      const mockClientBridge = {
        query: vi.fn().mockResolvedValue({}),
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const busSse = new BusSse();
      const bridge = new BridgeNotificacion('postgres://test/db', busSse, {
        nombreInstancia: 'backend-test-replica-1',
      });

      (bridge as any).cliente = mockClientBridge;
      (bridge as any).conectado = true;

      await bridge.publicar('expediente_derivado', { cut: 'EXP-2026-000001' });

      expect(mockClientBridge.query).toHaveBeenCalledWith(
        'SELECT pg_notify($1, $2)',
        [CANAL_NOTIFY, expect.stringContaining('"evento":"expediente_derivado"')],
      );
    });
  });

  describe('4. Tolerancia a Fallos, Reintentos y Dead-Letter (FALLIDO)', () => {
    it('4.1 Ante fallo transitorio en destino, incrementa contador de intentos y mantiene estado PENDIENTE', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql.includes('SELECT id_evento')) {
          return { rows: [{ ...eventoPrueba, intentos: 1 }] };
        }
        if (sql.includes('UPDATE sigd_audit.evento_outbox') && sql.includes('SET intentos = $2')) {
          return { rowCount: 1, rows: [] };
        }
        return { rows: [] };
      });

      const mockDespachadorFalla = {
        despachar: vi.fn().mockRejectedValueOnce(new Error('Fallo de red transitorio')),
      };

      const worker = new OutboxWorker(mockPool as unknown as Pool, mockDespachadorFalla, {
        maxIntentos: 5,
        backoffBaseMs: 1,
      });

      const procesados = await worker.ciclo();

      expect(procesados).toBe(0);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SET intentos = $2'),
        [eventoPrueba.id_evento, 2],
      );
    });

    it('4.2 Al agotar maxIntentos, clasifica el evento como FALLIDO (dead-letter queue)', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql.includes('SELECT id_evento')) {
          return { rows: [{ ...eventoPrueba, intentos: 4 }] };
        }
        if (sql.includes("estado = 'FALLIDO'")) {
          return { rowCount: 1, rows: [] };
        }
        return { rows: [] };
      });

      const mockDespachadorFalla = {
        despachar: vi.fn().mockRejectedValueOnce(new Error('Fallo irrecuperable')),
      };

      const worker = new OutboxWorker(mockPool as unknown as Pool, mockDespachadorFalla, {
        maxIntentos: 5,
      });

      const procesados = await worker.ciclo();

      expect(procesados).toBe(0);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("estado = 'FALLIDO'"),
        [eventoPrueba.id_evento, 5],
      );
    });
  });

  describe('5. Deduplicación e Idempotencia en Destino de Casilla', () => {
    it('5.1 No re-inserta en Casilla si ya existe una notificación con la misma referencia (id_evento)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ existe: 'sigd_auth.notificacion_casilla' }] })
        .mockResolvedValueOnce({ rows: [{ usuario_id: '33333333-4444-4555-8666-777777777777', cut: 'EXP-2026-000001' }] });

      const destinoCasilla = new DestinoCasilla(mockPool as unknown as Pool);
      await destinoCasilla.despachar(eventoPrueba);

      const queries = mockPool.query.mock.calls.map(([sql]) => String(sql));
      expect(queries.some((sql) => sql.includes('INSERT INTO sigd_auth.notificacion_casilla'))).toBe(false);
    });

    it('5.2 Inserta en Casilla cuando la referencia es nueva y el titular es válido', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ existe: 'sigd_auth.notificacion_casilla' }] }) // to_regclass
        .mockResolvedValueOnce({ rows: [] }) // referencia no duplicada
        .mockResolvedValueOnce({ rows: [{ existe: true }] }) // titular activo verificado
        .mockResolvedValueOnce({ rows: [{ id: 'notif-uuid-001' }] }); // INSERT

      const destinoCasilla = new DestinoCasilla(mockPool as unknown as Pool);
      await destinoCasilla.despachar(eventoPrueba);

      const queries = mockPool.query.mock.calls.map(([sql]) => String(sql));
      expect(queries.some((sql) => sql.includes('INSERT INTO sigd_auth.notificacion_casilla'))).toBe(true);
    });
  });
});
