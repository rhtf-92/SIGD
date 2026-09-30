import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { OutboxWorker, type EventoPendiente, type DespachadorEvento } from '../../../../src/audit/outbox-worker.js';

const URL_BASE = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

class DespachadorMemoria implements DespachadorEvento {
  public readonly recibidos: EventoPendiente[] = [];

  async despachar(evento: EventoPendiente): Promise<void> {
    this.recibidos.push(evento);
  }
}

class DespachadorFallo implements DespachadorEvento {
  public readonly recibidos: EventoPendiente[] = [];

  async despachar(evento: EventoPendiente): Promise<void> {
    this.recibidos.push(evento);
    throw new Error('Fallo inducido del transporte externo');
  }
}

const suiteDb = URL_BASE ? describe : describe.skip;

suiteDb('OutboxWorker · Entrega at-least-once y concurrencia', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: URL_BASE, max: 10 });
  });

  afterEach(async () => {
    await pool.query('DELETE FROM sigd_audit.evento_outbox');
  });

  afterAll(async () => {
    await pool.end();
  });

  async function sembrar(cantidad: number, tipoEvento = 'TestEvento'): Promise<string[]> {
    const correlaciones: string[] = [];
    for (let i = 0; i < cantidad; i++) {
      const correlationId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_audit.evento_outbox (correlation_id, agregado, tipo_evento, payload, estado)
         VALUES ($1, 'expediente', $2, $3::jsonb, 'PENDIENTE')`,
        [correlationId, tipoEvento, JSON.stringify({ indice: i, correlation_id: correlationId })],
      );
      correlaciones.push(correlationId);
    }
    return correlaciones;
  }

  it('entrega los eventos del lote y los marca PROCESADO', async () => {
    await sembrar(4);

    const despachador = new DespachadorMemoria();
    const worker = new OutboxWorker(pool, despachador, { lote: 10 });

    const procesados = await worker.ciclo();

    expect(procesados).toBe(4);
    expect(despachador.recibidos).toHaveLength(4);

    const resumen = await pool.query<{ estado: string; total: number }>(
      `SELECT estado, COUNT(*)::int AS total FROM sigd_audit.evento_outbox GROUP BY estado`,
    );
    expect(resumen.rows).toEqual([{ estado: 'PROCESADO', total: 4 }]);

    const sinFecha = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM sigd_audit.evento_outbox WHERE procesado_en IS NULL`,
    );
    expect(sinFecha.rows[0].n).toBe(0);
  });

  it('no reentrega eventos ya procesados en el siguiente ciclo', async () => {
    await sembrar(3);

    const despachador = new DespachadorMemoria();
    const worker = new OutboxWorker(pool, despachador, { lote: 10 });

    const primero = await worker.ciclo();
    const segundo = await worker.ciclo();

    expect(primero).toBe(3);
    expect(segundo).toBe(0);
    expect(despachador.recibidos).toHaveLength(3);
  });

  it('respeta el limite de lote configurado', async () => {
    await sembrar(5);

    const despachador = new DespachadorMemoria();
    const worker = new OutboxWorker(pool, despachador, { lote: 2 });

    const procesados = await worker.ciclo();

    expect(procesados).toBe(2);
    expect(despachador.recibidos).toHaveLength(2);

    const pendientes = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM sigd_audit.evento_outbox WHERE estado = 'PENDIENTE'`,
    );
    expect(pendientes.rows[0].n).toBe(3);
  });

  it('incremente intentos y conserva PENDIENTE cuando el despacho falla', async () => {
    await sembrar(1, 'TestFalloReintentable');

    const despachador = new DespachadorFallo();
    const worker = new OutboxWorker(pool, despachador, {
      lote: 5,
      maxIntentos: 3,
      backoffBaseMs: 1,
    });

    const procesados = await worker.ciclo();

    expect(procesados).toBe(0);

    const fila = await pool.query<{ estado: string; intentos: number }>(
      `SELECT estado, intentos FROM sigd_audit.evento_outbox`,
    );
    expect(fila.rows[0].estado).toBe('PENDIENTE');
    expect(fila.rows[0].intentos).toBe(1);
  });

  it('encola el evento en FALLIDO al agotar los reintentos', async () => {
    await sembrar(1, 'TestDeadLetter');

    const despachador = new DespachadorFallo();
    const worker = new OutboxWorker(pool, despachador, {
      lote: 5,
      maxIntentos: 1,
      backoffBaseMs: 1,
    });

    await worker.ciclo();

    const fila = await pool.query<{ estado: string; intentos: number }>(
      `SELECT estado, intentos FROM sigd_audit.evento_outbox`,
    );
    expect(fila.rows[0].estado).toBe('FALLIDO');
    expect(fila.rows[0].intentos).toBe(1);
  });

  it('dos workers concurrentes nunca despachan el mismo evento', async () => {
    const total = 12;
    await sembrar(total);

    const despachadorA = new DespachadorMemoria();
    const despachadorB = new DespachadorMemoria();
    const workerA = new OutboxWorker(pool, despachadorA, { lote: 6 });
    const workerB = new OutboxWorker(pool, despachadorB, { lote: 6 });

    const [procesadosA, procesadosB] = await Promise.all([workerA.ciclo(), workerB.ciclo()]);

    expect(procesadosA + procesadosB).toBe(total);

    const todos = [...despachadorA.recibidos, ...despachadorB.recibidos];
    const idsUnicos = new Set(todos.map((e) => e.id_evento));
    expect(idsUnicos.size).toBe(total);

    const pendientes = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM sigd_audit.evento_outbox WHERE estado = 'PENDIENTE'`,
    );
    expect(pendientes.rows[0].n).toBe(0);
  });

  it('la bitácora forense rechaza UPDATE y DELETE con SQLSTATE 23001', async () => {
    const correlationId = randomUUID();

    await pool.query(
      `INSERT INTO sigd_audit.bitacora_auditoria
         (correlation_id, esquema, tabla, operacion, datos_despues)
       VALUES ($1, 'sigd_tra', 'expediente', 'INSERT', $2::jsonb)`,
      [correlationId, JSON.stringify({ numero: 'EXP-TEST' })],
    );

    await expect(
      pool.query(`UPDATE sigd_audit.bitacora_auditoria SET tabla = 'alterada' WHERE correlation_id = $1`, [
        correlationId,
      ]),
    ).rejects.toMatchObject({ code: '23001' });

    await expect(
      pool.query(`DELETE FROM sigd_audit.bitacora_auditoria WHERE correlation_id = $1`, [correlationId]),
    ).rejects.toMatchObject({ code: '23001' });

    const verificacion = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM sigd_audit.bitacora_auditoria WHERE correlation_id = $1`,
      [correlationId],
    );
    expect(verificacion.rows[0].n).toBe(1);
  });
});
