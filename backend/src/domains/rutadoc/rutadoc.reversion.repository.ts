import type { Pool, PoolClient } from 'pg';
import { ConflictError } from '../../shared/domain/errors/conflict-error.js';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';
import type { CompensacionFolios, MovimientoObjetivo } from './rutadoc.reversion.types.js';

interface ErrorPostgres { code?: string }

export interface FilaCompensacion {
  id_movimiento: string;
  expediente_id: string;
  secuencia: string;
  estado_anterior: EstadoRutaDoc;
  estado_nuevo: EstadoRutaDoc;
  fecha_hora: Date;
  motivo: string;
  correlation_id: string;
  movimiento_objetivo_secuencia: string;
  huella_comando: string;
  compensacion_folios: CompensacionFolios;
}

interface FilaObjetivo {
  id_movimiento: string;
  expediente_id: string;
  secuencia: string;
  fecha_hora: Date;
  estado_anterior: EstadoRutaDoc;
  estado_nuevo: EstadoRutaDoc;
  evento: string;
}

export class RepositorioReversionRutaDoc {
  constructor(private readonly pool: Pool) {}

  /** Una sola conexión conserva BEGIN, advisory lock, lecturas, INSERT y COMMIT.
   * Contrato pendiente de TramiCore: Toda operación que cambie el estado o movimiento
   * de un expediente debe adquirir el mismo Advisory Lock antes de releer y modificar su estado.
   */
  async conBloqueo<T>(expedienteId: string, ejecutar: (cliente: PoolClient) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query("SELECT pg_advisory_xact_lock(hashtext('exp_' || $1::text))", [expedienteId]);
      const resultado = await ejecutar(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      if ((error as ErrorPostgres)?.code === '23505') {
        throw new ConflictError({ code: 'REVERSION_CONFLICTO', message: 'La actuación ya fue compensada o la clave está en uso.' });
      }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async existeExpediente(cliente: PoolClient, expedienteId: string): Promise<boolean> {
    const consulta = await cliente.query<{ existe: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE id_expediente = $1::bigint) AS existe',
      [expedienteId]);
    return consulta.rows[0].existe;
  }

  async porClave(cliente: PoolClient, expedienteId: string, clave: string): Promise<FilaCompensacion | null> {
    const consulta = await cliente.query<FilaCompensacion>(`
      SELECT id_movimiento::text, expediente_id::text, secuencia::text,
             estado_anterior, estado_nuevo, fecha_hora, motivo, correlation_id,
             movimiento_objetivo_secuencia::text, huella_comando, compensacion_folios
        FROM sigd_rut.movimiento_compensatorio
       WHERE expediente_id = $1::bigint AND clave_idempotencia = $2`, [expedienteId, clave]);
    return consulta.rows[0] ?? null;
  }

  async objetivo(cliente: PoolClient, expedienteId: string, secuencia: string): Promise<MovimientoObjetivo | null> {
    const consulta = await cliente.query<FilaObjetivo>(`
      SELECT id_movimiento::text, expediente_id::text, secuencia::text,
             fecha_hora, estado_anterior, estado_nuevo, evento
        FROM sigd_rut.movimiento_tramite
       WHERE expediente_id = $1::bigint AND secuencia = $2::bigint`, [expedienteId, secuencia]);
    const fila = consulta.rows[0];
    return fila ? {
      idMovimiento: fila.id_movimiento, expedienteId: fila.expediente_id,
      secuencia: fila.secuencia, fechaHora: fila.fecha_hora,
      estadoAnterior: fila.estado_anterior, estadoNuevo: fila.estado_nuevo,
      evento: fila.evento,
    } : null;
  }

  async ultimaActuacion(cliente: PoolClient, expedienteId: string): Promise<{ tipo: string; secuencia: string } | null> {
    const consulta = await cliente.query<{ tipo: string; secuencia: string }>(`
      SELECT tipo, secuencia::text FROM (
        SELECT 'NORMAL'::text AS tipo, secuencia
          FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1::bigint
        UNION ALL
        SELECT 'COMPENSATORIA'::text AS tipo, secuencia
          FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = $1::bigint
      ) actuaciones ORDER BY secuencia DESC LIMIT 1`, [expedienteId]);
    return consulta.rows[0] ?? null;
  }

  async yaCompensada(cliente: PoolClient, objetivo: MovimientoObjetivo): Promise<boolean> {
    const consulta = await cliente.query<{ existe: boolean }>(`
      SELECT EXISTS(SELECT 1 FROM sigd_rut.movimiento_compensatorio
       WHERE movimiento_objetivo_fecha_hora = $1 AND movimiento_objetivo_id = $2) AS existe`,
    [objetivo.fechaHora, objetivo.idMovimiento]);
    return consulta.rows[0].existe;
  }

  async insertar(cliente: PoolClient, entrada: {
    objetivo: MovimientoObjetivo;
    usuarioOperadorId: string;
    motivo: string;
    claveIdempotencia: string;
    huellaComando: string;
    correlationId: string;
    compensacionFolios: CompensacionFolios;
  }): Promise<FilaCompensacion> {
    const { objetivo, usuarioOperadorId, motivo, claveIdempotencia, huellaComando, correlationId, compensacionFolios } = entrada;
    const datos = {
      movimientoRelacionadoId: objetivo.idMovimiento,
      movimientoObjetivoSecuencia: objetivo.secuencia,
      motivo, estadoAntesDeReversion: objetivo.estadoNuevo,
      estadoRestaurado: objetivo.estadoAnterior,
      compensacionFolios,
    };
    const consulta = await cliente.query<FilaCompensacion>(`
      INSERT INTO sigd_rut.movimiento_compensatorio
        (expediente_id, estado_anterior, estado_nuevo, usuario_operador_id,
         correlation_id, clave_idempotencia, movimiento_objetivo_fecha_hora,
         movimiento_objetivo_id, movimiento_objetivo_secuencia, huella_comando,
         motivo, compensacion_folios, datos)
      VALUES ($1::bigint, $2, $3, $4::bigint, $5, $6, $7, $8::uuid,
              $9::bigint, $10, $11, $12::jsonb, $13::jsonb)
      RETURNING id_movimiento::text, expediente_id::text, secuencia::text,
                estado_anterior, estado_nuevo, fecha_hora, motivo, correlation_id,
                movimiento_objetivo_secuencia::text, huella_comando, compensacion_folios`,
      [objetivo.expedienteId, objetivo.estadoNuevo, objetivo.estadoAnterior,
        usuarioOperadorId, correlationId, claveIdempotencia, objetivo.fechaHora,
        objetivo.idMovimiento, objetivo.secuencia, huellaComando, motivo,
        JSON.stringify(compensacionFolios), JSON.stringify(datos)]);
    return consulta.rows[0];
  }
}
