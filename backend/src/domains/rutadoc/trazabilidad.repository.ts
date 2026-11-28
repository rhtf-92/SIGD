import type { Pool } from 'pg';
import type { RepositorioTrazabilidadRutaDoc } from './trazabilidad.types.js';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FilaActuacion {
  movimiento_id: string;
  secuencia: string;
  fecha_hora: Date;
  estado_anterior: EstadoRutaDoc;
  evento: string;
  estadoNuevo?: EstadoRutaDoc;
  estado_nuevo: EstadoRutaDoc;
  usuario_operador_id: string;
  usuario_nombre: string | null;
  area_anterior_id: string | null;
  area_destino_id: string | null;
  area_nombre: string | null;
  remitente: string | null;
  destinatario: string | null;
  proveido: unknown | null;
  datos_asociados: Record<string, unknown>;
  tipo_actuacion: 'NORMAL' | 'COMPENSATORIA';
}

export class RepositorioPostgresTrazabilidadRutaDoc implements RepositorioTrazabilidadRutaDoc {
  constructor(private readonly pool: Pool) {}

  async existeExpediente(idExpediente: string): Promise<boolean> {
    const esUuid = UUID_REGEX.test(idExpediente);
    const sql = esUuid
      ? 'SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE expediente_id = $1::uuid) AS existe'
      : 'SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE expediente_id::text = $1 OR codigo_expediente = $1) AS existe';
    const r = await this.pool.query<{ existe: boolean }>(sql, [idExpediente]);
    return r.rows[0]?.existe ?? false;
  }

  async listar(idExpediente: string) {
    const esUuid = UUID_REGEX.test(idExpediente);
    const filtroWhere = esUuid
      ? 'expediente_id = $1::uuid'
      : 'expediente_id::text = $1';

    const r = await this.pool.query<FilaActuacion>(`
      WITH historial AS (
        SELECT id_movimiento, secuencia, fecha_hora, estado_anterior, evento, estado_nuevo,
               usuario_operador_id, datos, 'NORMAL'::text AS tipo_actuacion
          FROM sigd_rut.movimiento_tramite WHERE ${filtroWhere}
        UNION ALL
        SELECT id_movimiento, secuencia, fecha_hora, estado_anterior, evento, estado_nuevo,
               usuario_operador_id, datos, 'COMPENSATORIA'::text AS tipo_actuacion
          FROM sigd_rut.movimiento_compensatorio WHERE ${filtroWhere}
      ), enriquecido AS (
        SELECT h.*,
          lag(h.datos->>'areaId') OVER (ORDER BY h.secuencia, h.fecha_hora, h.id_movimiento) AS area_anterior_id,
          COALESCE(h.datos->>'areaNombre', a.nombre) AS area_nombre,
          COALESCE(h.datos->>'usuarioNombre', cu.usuario) AS usuario_nombre
        FROM historial h
        LEFT JOIN sigd_org.area a ON a.area_id::text = (h.datos->>'areaId') OR a.codigo = (h.datos->>'areaId')
        LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = h.usuario_operador_id
      )
      SELECT id_movimiento::text AS movimiento_id, secuencia::text, fecha_hora,
             estado_anterior, evento, estado_nuevo, usuario_operador_id::text,
             area_anterior_id, datos->>'areaId' AS area_destino_id,
             area_nombre, usuario_nombre,
             datos->>'remitente' AS remitente, datos->>'destinatario' AS destinatario,
             datos->'proveido' AS proveido, datos AS datos_asociados,
             tipo_actuacion
        FROM enriquecido
       ORDER BY secuencia ASC, fecha_hora ASC, id_movimiento ASC`, [idExpediente]);
    return r.rows.map((fila) => ({
      movimientoId: fila.movimiento_id, secuencia: fila.secuencia,
      fechaHora: fila.fecha_hora.toISOString(), estadoAnterior: fila.estado_anterior,
      evento: fila.evento, estadoNuevo: fila.estado_nuevo,
      usuarioOperadorId: fila.usuario_operador_id,
      usuarioNombre: fila.usuario_nombre,
      areaAnteriorId: fila.area_anterior_id, areaDestinoId: fila.area_destino_id,
      areaNombre: fila.area_nombre,
      remitente: fila.remitente, destinatario: fila.destinatario,
      proveido: fila.proveido, datosAsociados: fila.datos_asociados,
      tipoActuacion: fila.tipo_actuacion,
    }));
  }
}
