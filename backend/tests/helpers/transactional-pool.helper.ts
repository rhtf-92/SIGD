import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

export interface EstadoSecuencia {
  last_value: string;
  is_called: boolean;
}

export type HashesTablas = Record<string, string>;

export class TransactionalTestPool {
  private rawPool: Pool;
  private rawClient: PoolClient | null = null;
  private savepointStack: string[] = [];
  private savepointCounter = 0;
  private isClosed = false;

  constructor(connectionString?: string) {
    const url =
      connectionString ||
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo';

    this.rawPool = new Pool({
      connectionString: url,
      max: 1,
    });
  }

  public async init(): Promise<void> {
    if (this.rawClient) return;
    this.rawClient = await this.rawPool.connect();
    await this.rawClient.query('BEGIN');
  }

  public getRawClient(): PoolClient {
    if (!this.rawClient) {
      throw new Error('[TransactionalTestPool] No inicializado. Invoque init() antes de usar.');
    }
    return this.rawClient;
  }

  public asPool(): Pool {
    const self = this;
    const client = this.getRawClient();

    const clientProxy = {
      query: async (queryTextOrConfig: any, values?: any): Promise<QueryResult<any>> => {
        const text = typeof queryTextOrConfig === 'string'
          ? queryTextOrConfig.trim()
          : queryTextOrConfig?.text?.trim() || '';

        const normalized = text.replace(/;/g, '').trim().toUpperCase();

        if (/^BEGIN(\s+TRANSACTION)?$/i.test(normalized)) {
          const sp = `sp_e2e_${++self.savepointCounter}`;
          self.savepointStack.push(sp);
          await client.query(`SAVEPOINT ${sp}`);
          return { command: 'SAVEPOINT', rowCount: 0, rows: [], oid: 0, fields: [] };
        }

        if (/^COMMIT(\s+TRANSACTION)?$/i.test(normalized)) {
          const sp = self.savepointStack.pop();
          if (sp) {
            await client.query(`RELEASE SAVEPOINT ${sp}`);
          }
          return { command: 'RELEASE', rowCount: 0, rows: [], oid: 0, fields: [] };
        }

        if (/^ROLLBACK(\s+TRANSACTION)?$/i.test(normalized)) {
          const sp = self.savepointStack.pop();
          if (sp) {
            await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          }
          return { command: 'ROLLBACK', rowCount: 0, rows: [], oid: 0, fields: [] };
        }

        return client.query(queryTextOrConfig, values);
      },
      release: () => {
        // No-op: se preserva la conexión raíz abierta hasta el rollback final
      },
    } as unknown as PoolClient;

    const poolProxy = {
      connect: async (): Promise<PoolClient> => clientProxy,
      query: async (queryTextOrConfig: any, values?: any): Promise<QueryResult<any>> => {
        return clientProxy.query(queryTextOrConfig, values);
      },
      on: () => poolProxy,
      removeListener: () => poolProxy,
      end: async () => {
        // No-op desde el app. La suite gestiona el ciclo con rollbackAndClose()
      },
    };

    return poolProxy as unknown as Pool;
  }

  public async rollbackRootTransaction(): Promise<void> {
    if (this.rawClient) {
      await this.rawClient.query('ROLLBACK').catch(() => {});
      this.rawClient.release();
      this.rawClient = null;
    }
  }

  public async rollbackAndClose(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;

    try {
      await this.rollbackRootTransaction();
    } finally {
      await this.rawPool.end().catch(() => {});
    }
  }

  public async obtenerHashesTablasCriticas(): Promise<HashesTablas> {
    const executor = this.rawClient || this.rawPool;
    const res = await executor.query<{ tabla: string; sha256: string }>(`
      SELECT 'sigd_tra.expediente' AS tabla, encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY expediente_id), 'EMPTY')::bytea), 'hex') AS sha256 FROM sigd_tra.expediente t
      UNION ALL
      SELECT 'sigd_rut.movimiento_tramite', encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY id_movimiento), 'EMPTY')::bytea), 'hex') FROM sigd_rut.movimiento_tramite t
      UNION ALL
      SELECT 'sigd_rut.movimiento_secuencia', encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY expediente_id), 'EMPTY')::bytea), 'hex') FROM sigd_rut.movimiento_secuencia t
      UNION ALL
      SELECT 'sigd_rut.estado_actual_expediente', encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY expediente_id), 'EMPTY')::bytea), 'hex') FROM sigd_rut.estado_actual_expediente t
      UNION ALL
      SELECT 'sigd_tra.expediente_documento_folio', encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY id_folio), 'EMPTY')::bytea), 'hex') FROM sigd_tra.expediente_documento_folio t
      UNION ALL
      SELECT 'sigd_doc.documento_adjunto', encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY documento_adjunto_id), 'EMPTY')::bytea), 'hex') FROM sigd_doc.documento_adjunto t
      UNION ALL
      SELECT 'sigd_doc.expediente', encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY expediente_id), 'EMPTY')::bytea), 'hex') FROM sigd_doc.expediente t
      UNION ALL
      SELECT 'sigd_audit.evento_outbox', encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY id_evento), 'EMPTY')::bytea), 'hex') FROM sigd_audit.evento_outbox t
      UNION ALL
      SELECT 'sigd_tra.secuencia_anual_cut', encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY anio_fiscal), 'EMPTY')::bytea), 'hex') FROM sigd_tra.secuencia_anual_cut t
      UNION ALL
      SELECT 'sigd_tra.asiento_registro', encode(sha256(coalesce(string_agg(to_jsonb(t.*)::text, E'\\n' ORDER BY numero_registro), 'EMPTY')::bytea), 'hex') FROM sigd_tra.asiento_registro t;
    `);

    const resultado: HashesTablas = {};
    for (const fila of res.rows) {
      resultado[fila.tabla] = fila.sha256;
    }
    return resultado;
  }

  public async obtenerEstadoSecuenciaAsiento(): Promise<EstadoSecuencia> {
    const executor = this.rawClient || this.rawPool;
    const res = await executor.query<{ last_value: string; is_called: boolean }>(
      'SELECT last_value::text, is_called FROM sigd_tra.seq_asiento_numero_registro'
    );
    return res.rows[0];
  }
}
