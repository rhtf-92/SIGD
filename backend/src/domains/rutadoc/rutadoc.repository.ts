import type { Pool, PoolClient } from 'pg';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';
import type { ContadoresRutaDoc, ExpedienteDetalle, ExpedienteResumen, FiltrosRutaDoc, PosicionCursor, UltimoMovimiento } from './rutadoc.types.js';

interface FilaBandeja {
  id_expediente: string;
  cut: string;
  asunto: string;
  fecha_radicacion: Date;
  estado_actual: EstadoRutaDoc;
  area_actual_id: string | null;
}

interface FilaBandejaConContadores {
  elementos: Array<Omit<FilaBandeja, 'fecha_radicacion'> & { fecha_radicacion: string }>;
  contadores: ContadoresRutaDoc;
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
    porPestana?: ContadoresRutaDoc;
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
  LEFT JOIN sigd_rut.estado_actual_expediente ultimo
    ON ultimo.expediente_id = e.id_expediente`;

const FILTROS = `
  WHERE ($1::text IS NULL OR position(lower($1::text) in lower(e.codigo_expediente || ' ' || t.asunto)) > 0)
    AND ($2::text IS NULL OR ultimo.area_actual_id = $2::text)
    AND ($3::date IS NULL OR e.creado_en >= ($3::date::timestamp AT TIME ZONE 'UTC'))
    AND ($4::date IS NULL OR e.creado_en < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))`;

export const SQL_LISTAR_RUTADOC = `
  SELECT e.id_expediente::text, e.codigo_expediente AS cut, t.asunto,
         e.creado_en AS fecha_radicacion,
         COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
         ultimo.area_actual_id
  ${BASE} ${FILTROS}
    AND COALESCE(ultimo.estado_nuevo, 'REGISTRADO') = ANY($5::text[])
    AND ($6::timestamptz IS NULL OR
         (e.creado_en, e.id_expediente) < ($6::timestamptz, $7::bigint))
  ORDER BY e.creado_en DESC, e.id_expediente DESC
  LIMIT $8`;

const COLUMNAS_CONTEO = `
  count(*) FILTER (WHERE ultimo.estado_nuevo IS NULL OR ultimo.estado_nuevo = 'REGISTRADO')::integer AS "REGISTRADO",
  count(*) FILTER (WHERE ultimo.estado_nuevo = 'RECEPCIONADO')::integer AS "RECEPCIONADO",
  count(*) FILTER (WHERE ultimo.estado_nuevo = 'EN_CALIFICACION')::integer AS "EN_CALIFICACION",
  count(*) FILTER (WHERE ultimo.estado_nuevo = 'DERIVADO')::integer AS "DERIVADO",
  count(*) FILTER (WHERE ultimo.estado_nuevo = 'EN_REVISION')::integer AS "EN_REVISION",
  count(*) FILTER (WHERE ultimo.estado_nuevo = 'OBSERVADO')::integer AS "OBSERVADO",
  count(*) FILTER (WHERE ultimo.estado_nuevo = 'SUBSANADO')::integer AS "SUBSANADO",
  count(*) FILTER (WHERE ultimo.estado_nuevo = 'EN_FIRMA')::integer AS "EN_FIRMA",
  count(*) FILTER (WHERE ultimo.estado_nuevo = 'RESUELTO')::integer AS "RESUELTO",
  count(*) FILTER (WHERE ultimo.estado_nuevo = 'ARCHIVADO')::integer AS "ARCHIVADO"`;

export const SQL_CONTADORES_RUTADOC = `SELECT ${COLUMNAS_CONTEO} ${BASE} ${FILTROS}`;

// Sin término no se necesita unir 50 000 filas de trámite sólo para contar.
export const SQL_CONTADORES_SIN_TERMINO_RUTADOC = `
  SELECT ${COLUMNAS_CONTEO}
  FROM sigd_tra.expediente e
  LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.id_expediente
  WHERE $1::text IS NULL
    AND ($2::text IS NULL OR ultimo.area_actual_id = $2::text)
    AND ($3::date IS NULL OR e.creado_en >= ($3::date::timestamp AT TIME ZONE 'UTC'))
    AND ($4::date IS NULL OR e.creado_en < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))`;

/** Seis contadores exactos mantenidos por triggers transaccionales en ambos
 * lados del contrato expediente/proyección. La lectura no toca las tablas base.
 */
export const SQL_CONTADORES_LOCALES_RUTADOC = `
  SELECT pestana, cantidad::integer AS total
  FROM sigd_rut.contador_pestana_local`;

/** Una sentencia da snapshot único a la página y a las seis filas transaccionales. */
export const SQL_BANDEJA_LOCAL_RUTADOC = `
  WITH elementos AS MATERIALIZED (${SQL_LISTAR_RUTADOC})
  SELECT COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.fecha_radicacion DESC,
                        p.id_expediente::bigint DESC) FROM elementos p), '[]'::jsonb) AS elementos,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_catalog.pg_trigger
            WHERE tgrelid = to_regclass('sigd_tra.expediente')
              AND tgname = 'tr_rutadoc_contador_expediente'
              AND tgenabled IN ('O', 'A')
         ) AND EXISTS (
           SELECT 1 FROM pg_catalog.pg_trigger
            WHERE tgrelid = to_regclass('sigd_rut.estado_actual_expediente')
              AND tgname = 'tr_contador_pestana_local'
              AND tgenabled IN ('O', 'A')
         ) THEN (SELECT jsonb_object_agg(pestana, cantidad::integer)
                   FROM sigd_rut.contador_pestana_local)
           ELSE (SELECT jsonb_build_object(
             'PENDIENTES', q."REGISTRADO" + q."RECEPCIONADO" + q."EN_CALIFICACION",
             'EN_TRAMITE', q."EN_REVISION" + q."OBSERVADO" + q."SUBSANADO",
             'DERIVADOS', q."DERIVADO", 'POR_FIRMAR', q."EN_FIRMA",
             'ATENDIDOS', q."RESUELTO", 'ARCHIVADOS', q."ARCHIVADO")
             FROM (${SQL_CONTADORES_SIN_TERMINO_RUTADOC}) q)
         END AS contadores`;

function mapearResumen(fila: FilaBandeja): ExpedienteResumen {
  return {
    idExpediente: fila.id_expediente,
    cut: fila.cut,
    asunto: fila.asunto,
    fechaRadicacion: new Date(fila.fecha_radicacion).toISOString(),
    estadoActual: fila.estado_actual,
    areaActualId: fila.area_actual_id,
  };
}

export class RepositorioPostgresRutaDoc implements RepositorioRutaDoc {
  constructor(private readonly pool: Pool) {}

  async listar(filtros: FiltrosRutaDoc, estados: readonly EstadoRutaDoc[], posicion: PosicionCursor | null) {
    const comunes = [filtros.terminoBusqueda ?? null, filtros.areaId ?? null,
      filtros.fechaDesde ?? null, filtros.fechaHasta ?? null];
    const parametros = [...comunes, [...estados], posicion?.fechaRadicacion ?? null,
      posicion?.idExpediente ?? null, filtros.limite + 1];
    const sinFiltros = !filtros.terminoBusqueda && !filtros.areaId &&
      !filtros.fechaDesde && !filtros.fechaHasta;
    if (sinFiltros) {
      const consulta = await this.pool.query<FilaBandejaConContadores>(SQL_BANDEJA_LOCAL_RUTADOC, parametros);
      const fila = consulta.rows[0];
      return { elementos: fila.elementos.map((elemento) => mapearResumen({
        ...elemento, fecha_radicacion: new Date(elemento.fecha_radicacion),
      })), porEstado: {}, porPestana: fila.contadores };
    }
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const listado = await cliente.query<FilaBandeja>(SQL_LISTAR_RUTADOC, parametros);
      const conteos = await cliente.query<Partial<Record<EstadoRutaDoc, number>>>(
        filtros.terminoBusqueda ? SQL_CONTADORES_RUTADOC : SQL_CONTADORES_SIN_TERMINO_RUTADOC, comunes);
      await cliente.query('COMMIT');
      return {
        elementos: listado.rows.map(mapearResumen),
        porEstado: conteos.rows[0] ?? {},
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
             ultimo.area_actual_id,
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
