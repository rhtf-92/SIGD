import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerPool, cerrarPool } from '../helpers/database.helper.js';
import { Pool } from 'pg';

class DespachadorContador {
  public invocaciones = 0;
  public idsDespachados: string[] = [];

  async despachar(evento: { id_evento: string }): Promise<void> {
    this.invocaciones += 1;
    this.idsDespachados.push(evento.id_evento);
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
        [String(i)],
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
});
