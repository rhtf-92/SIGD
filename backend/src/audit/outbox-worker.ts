import { Pool, PoolClient } from 'pg';
import { backoffExponencialConJitter, esperarConJitter } from '../utils/backoff.util.js';

export type EstadoOutbox = 'PENDIENTE' | 'PROCESADO' | 'FALLIDO';

export interface EventoPendiente {
  id_evento: string;
  correlation_id: string | null;
  agregado: string;
  tipo_evento: string;
  payload: Record<string, unknown>;
  intentos: number;
}

export interface DespachadorEvento {
  despachar(evento: EventoPendiente): Promise<void>;
}

export interface ConfiguracionWorker {
  lote?: number;
  maxIntentos?: number;
  backoffBaseMs?: number;
  backoffTechoMs?: number;
  intervaloPollMs?: number;
}

export class OutboxWorker {
  private readonly pool: Pool;
  private readonly despachador: DespachadorEvento;
  private readonly lote: number;
  private readonly maxIntentos: number;
  private readonly backoffBaseMs: number;
  private readonly backoffTechoMs: number;
  private readonly intervaloPollMs: number;
  private detenido = false;

  constructor(pool: Pool, despachador: DespachadorEvento, config: ConfiguracionWorker = {}) {
    this.pool = pool;
    this.despachador = despachador;
    this.lote = config.lote ?? 100;
    this.maxIntentos = config.maxIntentos ?? 5;
    this.backoffBaseMs = config.backoffBaseMs ?? 1000;
    this.backoffTechoMs = config.backoffTechoMs ?? 300_000;
    this.intervaloPollMs = config.intervaloPollMs ?? 5000;
  }

  async iniciar(): Promise<void> {
    this.detenido = false;
    while (!this.detenido) {
      try {
        const procesados = await this.ciclo();
        if (procesados === 0 && this.intervaloPollMs > 0) {
          await this.esperar(this.intervaloPollMs);
        }
      } catch (error) {
        console.error('[OUTBOX] Error en el ciclo del worker:', error);
        await this.esperar(this.intervaloPollMs);
      }
    }
  }

  detener(): void {
    this.detenido = true;
  }

  /**
   * Reserva y despacha un lote.
   *
   * La selección `FOR UPDATE SKIP LOCKED` y la actualización de estado ocurren
   * en la MISMA transacción que el despacho. Confirmar la reserva antes de
   * despachar liberaría los bloqueos de fila y dos workers podrían seleccionar
   * el mismo evento, duplicando la entrega. El trade-off es retener los locks
   * durante la llamada externa; se acepta porque el lote es acotado y el
   * transporte es rápido. Migrar a un lease con `reservado_hasta` si el despacho
   * se vuelve lento o asíncrono.
   */
  async ciclo(): Promise<number> {
    const cliente = await this.pool.connect();
    let esperaPostCiclo = 0;
    try {
      await cliente.query('BEGIN');
      const origen = await cliente.query<{
        id_evento: string;
        correlation_id: string | null;
        agregado: string;
        tipo_evento: string;
        payload: Record<string, unknown>;
        intentos: number;
      }>(
        `SELECT id_evento, correlation_id, agregado, tipo_evento, payload, intentos
           FROM sigd_audit.evento_outbox
          WHERE estado = 'PENDIENTE'
          ORDER BY creado_en
          LIMIT $1
            FOR UPDATE SKIP LOCKED`,
        [this.lote],
      );

      let procesados = 0;
      for (const fila of origen.rows) {
        const evento: EventoPendiente = {
          id_evento: fila.id_evento,
          correlation_id: fila.correlation_id,
          agregado: fila.agregado,
          tipo_evento: fila.tipo_evento,
          payload: fila.payload,
          intentos: fila.intentos,
        };

        try {
          await this.despachador.despachar(evento);
          await this.marcarProcesado(cliente, evento.id_evento);
          procesados += 1;
        } catch {
          esperaPostCiclo = Math.max(esperaPostCiclo, await this.registrarFallo(cliente, evento));
        }
      }

      await cliente.query('COMMIT');

      if (esperaPostCiclo > 0) {
        await this.esperar(esperaPostCiclo);
      }
      return procesados;
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }

  private async marcarProcesado(cliente: PoolClient, idEvento: string): Promise<void> {
    await cliente.query(
      `UPDATE sigd_audit.evento_outbox
          SET estado = 'PROCESADO', procesado_en = now()
        WHERE id_evento = $1`,
      [idEvento],
    );
  }

  private async registrarFallo(cliente: PoolClient, evento: EventoPendiente): Promise<number> {
    const nuevosIntentos = evento.intentos + 1;
    if (nuevosIntentos >= this.maxIntentos) {
      await cliente.query(
        `UPDATE sigd_audit.evento_outbox
            SET intentos = $2, estado = 'FALLIDO'
          WHERE id_evento = $1`,
        [evento.id_evento, nuevosIntentos],
      );
      return 0;
    }
    await cliente.query(
      `UPDATE sigd_audit.evento_outbox
          SET intentos = $2
        WHERE id_evento = $1`,
      [evento.id_evento, nuevosIntentos],
    );
    return backoffExponencialConJitter(this.backoffBaseMs, nuevosIntentos, this.backoffTechoMs);
  }

  private esperar(ms: number): Promise<void> {
    return esperarConJitter(ms);
  }
}