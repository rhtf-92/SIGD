import type { Pool, PoolClient } from 'pg';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';
import type { ExpedienteDetalle, ExpedienteResumen, FiltrosRutaDoc, PosicionCursor, UltimoMovimiento } from './rutadoc.types.js';

interface FilaBandeja {
  id_expediente: string;
  cut: string;
  asunto: string;
  fecha_radicacion: Date;
  estado_actual: EstadoRutaDoc;
  area_actual_id: string | null;
}

interface FilaDetalle extends FilaBandeja {
  solicitante_id: string | null;
  id_movimiento: string | null;
  evento: string | null;
  fecha_hora: Date | null;
  usuario_operador_id: string | null;
}

export interface RepositorioRutaDoc {
  listar(filtros: FiltrosRutaDoc, estados: readonly EstadoRutaDoc[], posicion: PosicionCursor | null): Promise<{
    elementos: ExpedienteResumen[];
    porEstado: Partial<Record<EstadoRutaDoc, number>>;
  }>;
  obtener(idExpediente: string): Promise<ExpedienteDetalle | null>;
}

/**
 * Contrato de lectura externo: sigd_tra.expediente y tramite del DDL documental
 * 03_esquema_sigd_tra_cut_foliado.sql. creado_en se expone como fechaRadicacion;
 * no existe una columna fecha_radicacion en ese DDL. El área sólo está disponible
 * si el escritor del último movimiento aporta datos.areaId (decisión RD-03).
 * Solicitante legible y SLA no están disponibles en los contratos actuales.
 */
const BASE = `
  FROM sigd_tra.expediente e
  JOIN sigd_tra.tramite t ON t.id_tramite = e.fk_tramite
  LEFT JOIN LATERAL (
    SELECT m.id_movimiento, m.estado_nuevo, m.evento, m.fecha_hora,
           m.usuario_operador_id, m.datos
      FROM sigd_rut.movimiento_tramite m
     WHERE m.expediente_id = e.id_expediente
     ORDER BY m.secuencia DESC
     LIMIT 1
  ) ultimo ON TRUE`;

const FILTROS = `
  WHERE ($1::text IS NULL OR position(lower($1::text) in lower(e.codigo_expediente || ' ' || t.asunto)) > 0)
    AND ($2::text IS NULL OR ultimo.datos->>'areaId' = $2::text)
    AND ($3::date IS NULL OR e.creado_en >= ($3::date::timestamp AT TIME ZONE 'UTC'))
    AND ($4::date IS NULL OR e.creado_en < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))`;

export const SQL_LISTAR_RUTADOC = `
  SELECT e.id_expediente::text, e.codigo_expediente AS cut, t.asunto,
         e.creado_en AS fecha_radicacion,
         COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
         ultimo.datos->>'areaId' AS area_actual_id
  ${BASE} ${FILTROS}
    AND COALESCE(ultimo.estado_nuevo, 'REGISTRADO') = ANY($5::text[])
    AND ($6::timestamptz IS NULL OR
         (e.creado_en, e.id_expediente) < ($6::timestamptz, $7::bigint))
  ORDER BY e.creado_en DESC, e.id_expediente DESC
  LIMIT $8`;

function mapearResumen(fila: FilaBandeja): ExpedienteResumen {
  return {
    idExpediente: fila.id_expediente,
    cut: fila.cut,
    asunto: fila.asunto,
    fechaRadicacion: fila.fecha_radicacion.toISOString(),
    estadoActual: fila.estado_actual,
    areaActualId: fila.area_actual_id,
  };
}

export class RepositorioPostgresRutaDoc implements RepositorioRutaDoc {
  constructor(private readonly pool: Pool) {}

  async listar(filtros: FiltrosRutaDoc, estados: readonly EstadoRutaDoc[], posicion: PosicionCursor | null) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const comunes = [filtros.terminoBusqueda ?? null, filtros.areaId ?? null,
        filtros.fechaDesde ?? null, filtros.fechaHasta ?? null];
      const listado = await cliente.query<FilaBandeja>(SQL_LISTAR_RUTADOC, [...comunes, [...estados], posicion?.fechaRadicacion ?? null,
        posicion?.idExpediente ?? null, filtros.limite + 1]);

      const conteos = await cliente.query<{ estado: EstadoRutaDoc; total: number }>(`
        SELECT COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado,
               count(*)::integer AS total
        ${BASE} ${FILTROS}
        GROUP BY COALESCE(ultimo.estado_nuevo, 'REGISTRADO')`, comunes);
      await cliente.query('COMMIT');
      return {
        elementos: listado.rows.map(mapearResumen),
        porEstado: Object.fromEntries(conteos.rows.map((fila) => [fila.estado, fila.total])) as Partial<Record<EstadoRutaDoc, number>>,
      };
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async obtener(idExpediente: string): Promise<ExpedienteDetalle | null> {
    const fila = await this.pool.query<FilaDetalle>(`
      SELECT e.id_expediente::text, e.codigo_expediente AS cut, t.asunto,
             e.creado_en AS fecha_radicacion,
             COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
             ultimo.datos->>'areaId' AS area_actual_id,
             t.fk_remitente::text AS solicitante_id,
             ultimo.id_movimiento::text, ultimo.evento, ultimo.fecha_hora,
             ultimo.usuario_operador_id::text
      ${BASE}
      WHERE e.id_expediente = $1::bigint`, [idExpediente]);
    if (fila.rowCount === 0) return null;

    const dato = fila.rows[0];
    let resumenDocumentos: ExpedienteDetalle['resumenDocumentos'] = null;
    const existeFoliacion = await this.pool.query<{ existe: string | null }>(
      `SELECT to_regclass('sigd_tra.expediente_documento_folio')::text AS existe`);
    if (existeFoliacion.rows[0].existe) {
      const folios = await this.pool.query<{ cantidad: number; total: number }>(`
        SELECT count(DISTINCT id_documento)::integer AS cantidad,
               COALESCE(sum(total_folios), 0)::integer AS total
          FROM sigd_tra.expediente_documento_folio
         WHERE id_expediente = $1::bigint`, [idExpediente]);
      resumenDocumentos = {
        cantidadDocumentos: folios.rows[0].cantidad,
        totalFolios: folios.rows[0].total,
      };
    }
    const ultimoMovimiento: UltimoMovimiento | null = dato.id_movimiento && dato.evento && dato.fecha_hora && dato.usuario_operador_id
      ? { idMovimiento: dato.id_movimiento, evento: dato.evento,
          estadoNuevo: dato.estado_actual, fechaHora: dato.fecha_hora.toISOString(),
          usuarioOperadorId: dato.usuario_operador_id }
      : null;
    return {
      ...mapearResumen(dato), solicitanteId: dato.solicitante_id,
      resumenDocumentos, ultimoMovimiento, sla: null,
    };
  }
}
