import type { Pool } from 'pg';
import type { RepositorioTrazabilidadRutaDoc } from './trazabilidad.types.js';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';

interface FilaActuacion {
  movimiento_id: string;
  secuencia: string;
  fecha_hora: Date;
  estado_anterior: EstadoRutaDoc;
  evento: string;
  estado_nuevo: EstadoRutaDoc;
  usuario_operador_id: string;
  area_anterior_id: string | null;
  area_destino_id: string | null;
  remitente: string | null;
  destinatario: string | null;
  proveido: unknown | null;
  datos_asociados: Record<string, unknown>;
  tipo_actuacion: 'NORMAL' | 'COMPENSATORIA';
}

export class RepositorioPostgresTrazabilidadRutaDoc implements RepositorioTrazabilidadRutaDoc {
  constructor(private readonly pool: Pool) {}

  async existeExpediente(idExpediente: string): Promise<boolean> {
    const r = await this.pool.query<{ existe: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE id_expediente = $1::bigint) AS existe', [idExpediente]);
    return r.rows[0].existe;
  }

  async listar(idExpediente: string) {
    const r = await this.pool.query<FilaActuacion>(`
      WITH historial AS (
        SELECT id_movimiento, secuencia, fecha_hora, estado_anterior, evento, estado_nuevo,
               usuario_operador_id, datos, 'NORMAL'::text AS tipo_actuacion
          FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1::bigint
        UNION ALL
        SELECT id_movimiento, secuencia, fecha_hora, estado_anterior, evento, estado_nuevo,
               usuario_operador_id, datos, 'COMPENSATORIA'::text AS tipo_actuacion
          FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = $1::bigint
      ), enriquecido AS (
        SELECT *,
          lag(datos->>'areaId') OVER (ORDER BY secuencia, fecha_hora, id_movimiento) AS area_anterior_id
        FROM historial
      )
      SELECT id_movimiento::text AS movimiento_id, secuencia::text, fecha_hora,
             estado_anterior, evento, estado_nuevo, usuario_operador_id::text,
             area_anterior_id, datos->>'areaId' AS area_destino_id,
             NULL::text AS remitente, NULL::text AS destinatario,
             NULL::jsonb AS proveido, datos AS datos_asociados,
             tipo_actuacion
        FROM enriquecido
       ORDER BY secuencia ASC, fecha_hora ASC, id_movimiento ASC`, [idExpediente]);
    return r.rows.map((fila) => ({
      movimientoId: fila.movimiento_id, secuencia: fila.secuencia,
      fechaHora: fila.fecha_hora.toISOString(), estadoAnterior: fila.estado_anterior,
      evento: fila.evento, estadoNuevo: fila.estado_nuevo,
      usuarioOperadorId: fila.usuario_operador_id,
      areaAnteriorId: fila.area_anterior_id, areaDestinoId: fila.area_destino_id,
      remitente: fila.remitente, destinatario: fila.destinatario,
      proveido: fila.proveido, datosAsociados: fila.datos_asociados,
      tipoActuacion: fila.tipo_actuacion,
    }));
  }
}
