import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerPool, cerrarPool } from '../helpers/database.helper.js';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

class DespachadorContador {
  public invocaciones = 0;
  public idsDespachados: string[] = [];
  public timestamps: number[] = [];

  async despachar(evento: { id_evento: string }): Promise<void> {
    this.invocaciones += 1;
    this.idsDespachados.push(evento.id_evento);
    this.timestamps.push(Date.now());
    await new Promise((r) => setTimeout(r, 5));
  }
}

class DespachadorLento {
  public invocaciones = 0;
  public idsDespachados: string[] = [];

  async despachar(evento: { id_evento: string }): Promise<void> {
    this.invocaciones += 1;
    this.idsDespachados.push(evento.id_evento);
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe('Concurrencia · OutboxWorker', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = obtenerPool();
    await pool.query('DELETE FROM sigd_audit.evento_outbox');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM sigd_audit.evento_outbox');
    await cerrarPool();
  });

  it('dos workers concurrentes no despachan el mismo evento', async () => {
    const poolA = obtenerPool();
    const poolB = obtenerPool();

    for (let i = 0; i < 6; i++) {
      await poolA.query(
        `INSERT INTO sigd_audit.evento_outbox
           (correlation_id, agregado, tipo_evento, payload, estado)
         VALUES ($1, 'expediente', 'TestEvento', '{}'::jsonb, 'PENDIENTE')`,
        [randomUUID()],
      );
    }

    const Mod = await import('../../src/audit/outbox-worker.js');
    const Worker = Mod.OutboxWorker;

    const despA = new DespachadorContador();
    const despB = new DespachadorContador();

    const workerA = new Worker(poolA, despA, { lote: 3, intervaloPollMs: 0 });
    const workerB = new Worker(poolB, despB, { lote: 3, intervaloPollMs: 0 });

    const [procesadosA, procesadosB] = await Promise.all([
      workerA.ciclo(),
      workerB.ciclo(),
    ]);

    const totalProcesados = procesadosA + procesadosB;
    expect(totalProcesados).toBe(6);

    const todosIds = [...despA.idsDespachados, ...despB.idsDespachados];
    const idsUnicos = new Set(todosIds);
    expect(idsUnicos.size).toBe(todosIds.length);

    const estadoFinal = await poolA.query(
      "SELECT count(*)::int AS pendientes FROM sigd_audit.evento_outbox WHERE estado = 'PENDIENTE'",
    );
    expect(estadoFinal.rows[0].pendientes).toBe(0);
  });

  it('reserva transaccional: despacho lento no libera lock para otro worker', async () => {
    const poolA = obtenerPool();
    const poolB = obtenerPool();

    for (let i = 0; i < 3; i++) {
      await poolA.query(
        `INSERT INTO sigd_audit.evento_outbox
           (correlation_id, agregado, tipo_evento, payload, estado)
         VALUES ($1, 'expediente', 'TestLento', '{}'::jsonb, 'PENDIENTE')`,
        [randomUUID()],
      );
    }

    const Mod = await import('../../src/audit/outbox-worker.js');
    const Worker = Mod.OutboxWorker;

    const despA = new DespachadorLento();
    const despB = new DespachadorContador();

    const workerA = new Worker(poolA, despA, { lote: 3, intervaloPollMs: 0 });
    const workerB = new Worker(poolB, despB, { lote: 3, intervaloPollMs: 0 });

    const [procesadosA, procesadosB] = await Promise.all([
      workerA.ciclo(),
      workerB.ciclo(),
    ]);

    expect(procesadosA + procesadosB).toBe(3);

    const todosIds = [...despA.idsDespachados, ...despB.idsDespachados];
    expect(new Set(todosIds).size).toBe(todosIds.length);
  });

  it('reintentos maximos marcan evento como FALLIDO', async () => {
    const poolLocal = obtenerPool();
    const correlationTest = randomUUID();

    await poolLocal.query(
      `INSERT INTO sigd_audit.evento_outbox
         (correlation_id, agregado, tipo_evento, payload, estado, intentos)
       VALUES ($1, 'expediente', 'TestFallo', '{}'::jsonb, 'PENDIENTE', 0)`,
      [correlationTest],
    );

    const Mod = await import('../../src/audit/outbox-worker.js');
    const Worker = Mod.OutboxWorker;

    class DespachadorSiempreFalla {
      async despachar(): Promise<void> {
        throw new Error('Fallo inducido');
      }
    }

    const worker = new Worker(poolLocal, new DespachadorSiempreFalla(), {
      lote: 1,
      maxIntentos: 1,
      intervaloPollMs: 0,
    });

    await worker.ciclo();

    const resultado = await poolLocal.query(
      'SELECT estado, intentos FROM sigd_audit.evento_outbox WHERE correlation_id = $1',
      [correlationTest],
    );
    expect(resultado.rows[0].estado).toBe('FALLIDO');
    expect(resultado.rows[0].intentos).toBe(1);
  });
});
