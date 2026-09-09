import { Pool, PoolClient } from 'pg';

export type EstadoOutbox = 'PENDIENTE' | 'EN_PROCESO' | 'PROCESADO' | 'FALLIDO';

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
  intervaloPollMs?: number;
}

export class OutboxWorker {
  private readonly pool: Pool;
  private readonly despachador: DespachadorEvento;
  private readonly lote: number;
  private readonly maxIntentos: number;
  private readonly backoffBaseMs: number;
  private readonly intervaloPollMs: number;
  private detenido = false;

  constructor(pool: Pool, despachador: DespachadorEvento, config: ConfiguracionWorker = {}) {
    this.pool = pool;
    this.despachador = despachador;
    this.lote = config.lote ?? 100;
    this.maxIntentos = config.maxIntentos ?? 5;
    this.backoffBaseMs = config.backoffBaseMs ?? 1000;
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

  async ciclo(): Promise<number> {
    const cliente = await this.pool.connect();
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

      if (origen.rows.length === 0) {
        await cliente.query('ROLLBACK');
        return 0;
      }

      const ids = origen.rows.map((r) => r.id_evento);
      await cliente.query(
        `UPDATE sigd_audit.evento_outbox
            SET estado = 'EN_PROCESO'
          WHERE id_evento = ANY($1::uuid[])`,
        [ids],
      );
      await cliente.query('COMMIT');

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
          await this.marcarProcesado(evento.id_evento);
          procesados += 1;
        } catch {
          await this.registrarFallo(evento);
        }
      }
      return procesados;
    } finally {
      cliente.release();
    }
  }

  private async marcarProcesado(idEvento: string): Promise<void> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query(
        `UPDATE sigd_audit.evento_outbox
            SET estado = 'PROCESADO', procesado_en = now()
          WHERE id_evento = $1`,
        [idEvento],
      );
    } finally {
      cliente.release();
    }
  }

  private async registrarFallo(evento: EventoPendiente): Promise<void> {
    const nuevosIntentos = evento.intentos + 1;
    const cliente = await this.pool.connect();
    try {
      if (nuevosIntentos >= this.maxIntentos) {
        await cliente.query(
          `UPDATE sigd_audit.evento_outbox
              SET intentos = $2, estado = 'FALLIDO'
            WHERE id_evento = $1`,
          [evento.id_evento, nuevosIntentos],
        );
        return;
      }
      await cliente.query(
        `UPDATE sigd_audit.evento_outbox
            SET intentos = $2, estado = 'PENDIENTE'
          WHERE id_evento = $1`,
        [evento.id_evento, nuevosIntentos],
      );
    } finally {
      cliente.release();
    }
    await this.esperar(this.backoffBaseMs * 2 ** nuevosIntentos);
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
