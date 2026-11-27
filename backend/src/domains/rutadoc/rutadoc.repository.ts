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
  solicitante_nombre: string | null;
  total_folios: number;
  codigo_serie: string | null;
  nombre_serie: string | null;
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
 * Contrato de lectura externo: sigd_tra.expediente y tramite del DDL canónico
 * (expediente_id UUID). fecha_radicacion es la columna real. El área sólo está
 * disponible si el escritor del último movimiento aporta datos.areaId.
 * Solicitante legible y SLA no están disponibles en los contratos actuales.
 */
const BASE = `
  FROM sigd_tra.expediente e
  JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
  LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
  LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = e.solicitante_id
  LEFT JOIN sigd_rut.expediente_clasificacion_ccd ccd ON ccd.expediente_id = e.expediente_id
  LEFT JOIN sigd_rut.estado_actual_expediente ultimo
    ON ultimo.expediente_id = e.expediente_id`;

const FILTROS = `
  WHERE ($1::text IS NULL OR position(lower($1::text) in lower(e.codigo_expediente || ' ' || t.asunto || ' ' || COALESCE(pn.nombre_completo, pj.razon_social, ''))) > 0)
    AND ($2::uuid IS NULL OR COALESCE(ultimo.area_actual_id, e.area_destino_id) = $2::uuid)
    AND ($3::date IS NULL OR e.fecha_radicacion >= ($3::date::timestamp AT TIME ZONE 'UTC'))
    AND ($4::date IS NULL OR e.fecha_radicacion < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))
    AND ($5::text IS NULL OR ccd.codigo_serie = $5::text)`;

export const SQL_LISTAR_RUTADOC = `
    SELECT e.expediente_id::text AS id_expediente, e.codigo_expediente AS cut, t.asunto,
         e.fecha_radicacion AS fecha_radicacion,
         COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
      COALESCE(ultimo.area_actual_id, e.area_destino_id)::text AS area_actual_id,
      COALESCE(pn.nombre_completo, pj.razon_social) AS solicitante_nombre,
      COALESCE((SELECT sum(f.folio_fin - f.folio_inicio + 1)::integer
        FROM sigd_tra.expediente_documento_folio f
            WHERE f.expediente_id = e.expediente_id), 0)::integer AS total_folios,
      ccd.codigo_serie, ccd.nombre_serie
  ${BASE} ${FILTROS}
    AND COALESCE(ultimo.estado_nuevo, 'REGISTRADO') = ANY($6::text[])
    AND ($7::timestamptz IS NULL OR
         (e.fecha_radicacion, e.expediente_id) < ($7::timestamptz, $8::uuid))
  ORDER BY e.fecha_radicacion DESC, e.expediente_id DESC
  LIMIT $9`;

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
  LEFT JOIN sigd_rut.expediente_clasificacion_ccd ccd ON ccd.expediente_id = e.expediente_id
  LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
  WHERE $1::text IS NULL
    AND ($2::uuid IS NULL OR COALESCE(ultimo.area_actual_id, e.area_destino_id) = $2::uuid)
    AND ($3::date IS NULL OR e.fecha_radicacion >= ($3::date::timestamp AT TIME ZONE 'UTC'))
    AND ($4::date IS NULL OR e.fecha_radicacion < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))
    AND ($5::text IS NULL OR ccd.codigo_serie = $5::text)`;

export const SQL_CONTADORES_LOCALES_RUTADOC = `
  SELECT pestana, cantidad::integer AS total
  FROM sigd_rut.contador_pestana_local`;

export const SQL_BANDEJA_LOCAL_RUTADOC = `
  WITH elementos AS MATERIALIZED (${SQL_LISTAR_RUTADOC}),
  conteos AS (${SQL_CONTADORES_SIN_TERMINO_RUTADOC})
  SELECT COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.fecha_radicacion DESC,
                        p.id_expediente DESC) FROM elementos p), '[]'::jsonb) AS elementos,
         (SELECT jsonb_build_object(
           'PENDIENTES', q."REGISTRADO" + q."RECEPCIONADO" + q."EN_CALIFICACION",
           'EN_TRAMITE', q."EN_REVISION" + q."OBSERVADO" + q."SUBSANADO",
           'DERIVADOS', q."DERIVADO", 'POR_FIRMAR', q."EN_FIRMA",
           'ATENDIDOS', q."RESUELTO", 'ARCHIVADOS', q."ARCHIVADO")
          FROM conteos q) AS contadores`;

function mapearResumen(fila: FilaBandeja): ExpedienteResumen {
  return {
    idExpediente: fila.id_expediente,
    cut: fila.cut,
    asunto: fila.asunto,
    fechaRadicacion: new Date(fila.fecha_radicacion).toISOString(),
    estadoActual: fila.estado_actual,
    areaActualId: fila.area_actual_id,
    solicitanteNombre: fila.solicitante_nombre,
    totalFolios: Number(fila.total_folios ?? 0),
    codigoSerie: fila.codigo_serie,
    nombreSerie: fila.nombre_serie,
  };
}

export class RepositorioPostgresRutaDoc implements RepositorioRutaDoc {
  constructor(private readonly pool: Pool) {}

  async listar(filtros: FiltrosRutaDoc, estados: readonly EstadoRutaDoc[], posicion: PosicionCursor | null) {
    const comunes = [filtros.terminoBusqueda ?? null, filtros.areaId ?? null,
      filtros.fechaDesde ?? null, filtros.fechaHasta ?? null, filtros.codigoSerie ?? null];
    const parametros = [...comunes, [...estados], posicion?.fechaRadicacion ?? null,
      posicion?.idExpediente ?? null, filtros.limite + 1];
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
      SELECT e.expediente_id::text AS id_expediente, e.codigo_expediente AS cut, t.asunto,
             e.fecha_radicacion AS fecha_radicacion,
             COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
             COALESCE(ultimo.area_actual_id, e.area_destino_id)::text AS area_actual_id,
              COALESCE(pn.nombre_completo, pj.razon_social) AS solicitante_nombre,
              COALESCE((SELECT sum(f.folio_fin - f.folio_inicio + 1)::integer
                FROM sigd_tra.expediente_documento_folio f
               WHERE f.expediente_id = e.expediente_id), 0)::integer AS total_folios,
               ccd.codigo_serie, ccd.nombre_serie,
             e.solicitante_id::text AS solicitante_id,
             ultimo.id_movimiento::text, ultimo.evento, ultimo.fecha_hora,
             ultimo.usuario_operador_id::text
      ${BASE}
      WHERE e.expediente_id = $1::uuid`, [idExpediente]);
    if (fila.rowCount === 0) return null;

    const dato = fila.rows[0];
    let resumenDocumentos: ExpedienteDetalle['resumenDocumentos'] = null;
    const existeFoliacion = await this.pool.query<{ existe: string | null }>(
      `SELECT to_regclass('sigd_tra.expediente_documento_folio')::text AS existe`);
    if (existeFoliacion.rows[0].existe) {
      const folios = await this.pool.query<{ cantidad: number; total: number }>(`
        SELECT count(DISTINCT id_documento)::integer AS cantidad,
               COALESCE(sum(folio_fin - folio_inicio + 1), 0)::integer AS total
          FROM sigd_tra.expediente_documento_folio
         WHERE expediente_id = $1::uuid`, [idExpediente]);
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
