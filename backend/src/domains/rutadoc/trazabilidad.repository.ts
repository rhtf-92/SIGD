import type { Pool } from 'pg';
import type { EventoTrazabilidad, RepositorioTrazabilidadRutaDoc } from './trazabilidad.types.js';
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
  area_destino_nombre: string | null;
}

interface FilaEventoOrigen {
  tipo: 'RADICACION' | 'ORDEN_PAGO' | 'PAGO_CONFIRMADO';
  id: string;
  fecha_hora: Date;
  codigo: string;
  monto: string | null;
  metodo_pago: string | null;
  payment_provider: string | null;
}

export class RepositorioPostgresTrazabilidadRutaDoc implements RepositorioTrazabilidadRutaDoc {
  constructor(private readonly pool: Pool) {}

  async existeExpediente(idExpediente: string): Promise<boolean> {
    const r = await this.pool.query<{ existe: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE expediente_id = $1::uuid) AS existe', [idExpediente]);
    return r.rows[0].existe;
  }

  async listarEventosOrigen(idExpediente: string): Promise<readonly EventoTrazabilidad[]> {
    const resultado = await this.pool.query<FilaEventoOrigen>(`
      SELECT 'RADICACION'::text AS tipo, a.id_asiento::text AS id,
             a.fecha_ingreso AS fecha_hora, e.codigo_expediente::text AS codigo,
             NULL::text AS monto, NULL::text AS metodo_pago,
             NULL::text AS payment_provider
        FROM sigd_tra.asiento_registro a
        JOIN sigd_tra.expediente e ON e.expediente_id = a.expediente_id
       WHERE a.expediente_id = $1::uuid
      UNION ALL
      SELECT 'ORDEN_PAGO'::text, o.orden_pago_id::text, o.fecha_creacion,
             o.codigo_pago::text, o.monto::text, NULL::text, o.payment_provider::text
        FROM sigd_tra.orden_pago o WHERE o.expediente_id = $1::uuid
      UNION ALL
      SELECT 'PAGO_CONFIRMADO'::text, o.orden_pago_id::text, o.fecha_pago,
             o.codigo_recibo::text, o.monto::text, o.metodo_pago::text,
             o.payment_provider::text
        FROM sigd_tra.orden_pago o
       WHERE o.expediente_id = $1::uuid
         AND o.fecha_pago IS NOT NULL AND o.codigo_recibo IS NOT NULL
      ORDER BY fecha_hora, tipo, id`, [idExpediente]);
    return resultado.rows.map((fila) => ({
      id: `${fila.tipo}:${fila.id}`,
      tipo: fila.tipo,
      fechaHora: fila.fecha_hora.toISOString(),
      titulo: fila.tipo === 'RADICACION' ? 'Solicitud radicada'
        : fila.tipo === 'ORDEN_PAGO' ? 'Orden de pago generada' : 'Pago confirmado',
      detalle: fila.tipo === 'RADICACION' ? fila.codigo
        : fila.tipo === 'ORDEN_PAGO' ? `${fila.codigo} · S/ ${Number(fila.monto).toFixed(2)}`
          : `${fila.codigo} · S/ ${Number(fila.monto).toFixed(2)} · ${fila.payment_provider === 'DEMO_QR'
            ? 'QR automático — Simulador (sin dinero real)'
            : fila.payment_provider === 'TAYPI' ? 'QR automático — TAYPI Sandbox'
              : fila.metodo_pago === 'EFECTIVO' ? 'Efectivo'
                : fila.metodo_pago === 'YAPE' ? 'Yape asistido' : 'Pago registrado'}`,
    }));
  }

  async listar(idExpediente: string) {
    const r = await this.pool.query<FilaActuacion>(`
      WITH historial AS (
        SELECT id_movimiento, secuencia, fecha_hora, estado_anterior, evento, estado_nuevo,
               usuario_operador_id, datos, 'NORMAL'::text AS tipo_actuacion
          FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1::uuid
        UNION ALL
        SELECT id_movimiento, secuencia, fecha_hora, estado_anterior, evento, estado_nuevo,
               usuario_operador_id, datos, 'COMPENSATORIA'::text AS tipo_actuacion
          FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = $1::uuid
      ), enriquecido AS (
        SELECT *,
          lag(datos->>'areaId') OVER (ORDER BY secuencia, fecha_hora, id_movimiento) AS area_anterior_id
        FROM historial
      )
      SELECT id_movimiento::text AS movimiento_id, secuencia::text, fecha_hora,
             estado_anterior, evento, estado_nuevo, usuario_operador_id::text,
             area_anterior_id, datos->>'areaId' AS area_destino_id,
             datos->>'remitente' AS remitente, datos->>'destinatario' AS destinatario,
             datos->'proveido' AS proveido, datos AS datos_asociados,
             tipo_actuacion, area.nombre AS area_destino_nombre
        FROM enriquecido
   LEFT JOIN sigd_org.area area ON area.area_id::text = enriquecido.datos->>'areaId'
       ORDER BY secuencia ASC, fecha_hora ASC, id_movimiento ASC`, [idExpediente]);
    return r.rows.map((fila) => ({
      movimientoId: fila.movimiento_id, secuencia: fila.secuencia,
      fechaHora: fila.fecha_hora.toISOString(), estadoAnterior: fila.estado_anterior,
      evento: fila.evento, estadoNuevo: fila.estado_nuevo,
      usuarioOperadorId: fila.usuario_operador_id,
      areaAnteriorId: fila.area_anterior_id, areaDestinoId: fila.area_destino_id,
      remitente: fila.remitente, destinatario: fila.destinatario,
      proveido: fila.proveido, datosAsociados: fila.datos_asociados,
      tipoActuacion: fila.tipo_actuacion, areaDestinoNombre: fila.area_destino_nombre,
    }));
  }
}
