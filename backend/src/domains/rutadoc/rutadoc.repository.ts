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
  listarBandejaFrontend?(): Promise<unknown[]>;
}

/**
 * Contrato de lectura alineado al esquema real sigd_tra.expediente y sigd_tra.tramite.
 */
const BASE = `
  FROM sigd_tra.expediente e
  LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
  LEFT JOIN sigd_rut.estado_actual_expediente ultimo
    ON ultimo.expediente_id = e.expediente_id`;

const FILTROS = `
  WHERE ($1::text IS NULL OR position(lower($1::text) in lower(e.codigo_expediente || ' ' || COALESCE(t.asunto, ''))) > 0)
    AND ($2::text IS NULL OR COALESCE(ultimo.area_actual_id::text, e.area_destino_id::text) = $2::text)
    AND ($3::date IS NULL OR e.fecha_radicacion >= ($3::date::timestamp AT TIME ZONE 'UTC'))
    AND ($4::date IS NULL OR e.fecha_radicacion < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))`;

export const SQL_LISTAR_RUTADOC = `
  SELECT e.expediente_id::text AS id_expediente, e.codigo_expediente AS cut,
         COALESCE(t.asunto, 'Trámite ' || e.codigo_expediente) AS asunto,
         e.fecha_radicacion,
         COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual,
         COALESCE(ultimo.area_actual_id::text, e.area_destino_id::text) AS area_actual_id
  ${BASE} ${FILTROS}
    AND COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO') = ANY($5::text[])
    AND ($6::timestamptz IS NULL OR
         (e.fecha_radicacion, e.expediente_id) < ($6::timestamptz, $7::uuid))
  ORDER BY e.fecha_radicacion DESC, e.expediente_id DESC
  LIMIT $8`;

const COLUMNAS_CONTEO = `
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO') = 'REGISTRADO')::integer AS "REGISTRADO",
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'RECEPCIONADO')::integer AS "RECEPCIONADO",
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'EN_CALIFICACION')::integer AS "EN_CALIFICACION",
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'DERIVADO')::integer AS "DERIVADO",
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'EN_REVISION')::integer AS "EN_REVISION",
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'OBSERVADO')::integer AS "OBSERVADO",
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'SUBSANADO')::integer AS "SUBSANADO",
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'EN_FIRMA')::integer AS "EN_FIRMA",
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'RESUELTO')::integer AS "RESUELTO",
  count(*) FILTER (WHERE COALESCE(ultimo.estado_nuevo, e.estado) = 'ARCHIVADO')::integer AS "ARCHIVADO"`;

export const SQL_CONTADORES_RUTADOC = `SELECT ${COLUMNAS_CONTEO} ${BASE} ${FILTROS}`;

// Sin término no se necesita unir filas de trámite sólo para contar.
export const SQL_CONTADORES_SIN_TERMINO_RUTADOC = `
  SELECT ${COLUMNAS_CONTEO}
  FROM sigd_tra.expediente e
  LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
  WHERE $1::text IS NULL
    AND ($2::text IS NULL OR COALESCE(ultimo.area_actual_id::text, e.area_destino_id::text) = $2::text)
    AND ($3::date IS NULL OR e.fecha_radicacion >= ($3::date::timestamp AT TIME ZONE 'UTC'))
    AND ($4::date IS NULL OR e.fecha_radicacion < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))`;

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
                        p.id_expediente DESC) FROM elementos p), '[]'::jsonb) AS elementos,
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

  async listarBandejaFrontend(): Promise<unknown[]> {
    const { rows } = await this.pool.query<{
      id: string;
      codigoExpediente: string;
      asunto: string;
      solicitante: unknown;
      clasificacionCCD: unknown;
      metadatos: unknown;
      areaOrigen: string;
      areaActual: string;
      estadoFlujo: string;
      prioridad: string;
      fechaIngreso: Date;
      fechaUltimoMovimiento: Date;
      fechaLimiteAtencion: Date;
      versionesDocumentos: unknown;
      cantidadFolios: number;
    }>(`
      SELECT
        e.expediente_id::text AS id,
        e.codigo_expediente AS "codigoExpediente",
        COALESCE(t.asunto, 'Trámite ' || e.codigo_expediente) AS asunto,
        jsonb_build_object(
          'tipoPersona', COALESCE(p.tipo, 'NATURAL'),
          'numeroDocumento', COALESCE(e.dni_solicitante, p.id_documento, '00000000'),
          'nombreOrazonSocial', COALESCE(
            NULLIF(pn.nombre_completo, ''),
            pj.razon_social,
            'Administrado'
          )
        ) AS solicitante,
        jsonb_build_object(
          'codigoSerie', 'CCD-SA-01',
          'serieDocumental', 'Expedientes de Trámite Documentario',
          'seccion', COALESCE(a.nombre, 'Mesa de Partes y Ventanilla'),
          'fondo', 'IESTP_SUIZA'
        ) AS "clasificacionCCD",
        jsonb_build_object(
          'palabrasClave', jsonb_build_array(e.codigo_expediente, COALESCE(a.codigo, 'ARE_MPV')),
          'numeroFolios', 1
        ) AS metadatos,
        COALESCE(
          CASE WHEN ultimo.area_actual_id ~ '^[0-9a-f-]{36}$' THEN ultimo.area_actual_id ELSE NULL END,
          e.area_destino_id::text,
          '2720dcef-cc8b-440a-a43e-ff83a93266f1'
        ) AS "areaOrigen",
        COALESCE(a.nombre, 'Mesa de Partes y Ventanilla') AS "areaActual",
        CASE COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO')
          WHEN 'REGISTRADO' THEN 'PENDIENTE'
          WHEN 'RECEPCIONADO' THEN 'PENDIENTE'
          WHEN 'EN_CALIFICACION' THEN 'PENDIENTE'
          WHEN 'EN_REVISION' THEN 'EN_PROCESO'
          WHEN 'SUBSANADO' THEN 'EN_PROCESO'
          WHEN 'EN_FIRMA' THEN 'EN_PROCESO'
          WHEN 'OBSERVADO' THEN 'OBSERVADO'
          WHEN 'DERIVADO' THEN 'DERIVADO'
          WHEN 'RESUELTO' THEN 'NOTIFICADO'
          WHEN 'ARCHIVADO' THEN 'ARCHIVADO'
          ELSE 'PENDIENTE'
        END AS "estadoFlujo",
        'NORMAL' AS prioridad,
        e.fecha_radicacion AS "fechaIngreso",
        COALESCE(ultimo.fecha_hora, e.actualizado_en, e.fecha_radicacion) AS "fechaUltimoMovimiento",
        COALESCE(e.fecha_limite, e.fecha_radicacion + interval '30 days') AS "fechaLimiteAtencion",
        '[]'::jsonb AS "versionesDocumentos",
        1 AS "cantidadFolios"
      FROM sigd_tra.expediente e
      LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
      LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
      LEFT JOIN sigd_org.area a ON a.area_id = COALESCE(
        CASE WHEN ultimo.area_actual_id ~ '^[0-9a-f-]{36}$' THEN ultimo.area_actual_id::uuid ELSE NULL END,
        e.area_destino_id
      )
      LEFT JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id
      LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
      LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
      ORDER BY e.fecha_radicacion DESC, e.expediente_id DESC
      LIMIT 100
    `);

    return rows.map((r) => ({
      ...r,
      fechaIngreso: new Date(r.fechaIngreso).toISOString(),
      fechaUltimoMovimiento: new Date(r.fechaUltimoMovimiento).toISOString(),
      fechaLimiteAtencion: new Date(r.fechaLimiteAtencion).toISOString(),
    }));
  }

  async obtener(idExpediente: string): Promise<ExpedienteDetalle | null> {
    const fila = await this.pool.query<FilaDetalle>(`
      SELECT e.expediente_id::text AS id_expediente, e.codigo_expediente AS cut,
             COALESCE(t.asunto, 'Trámite ' || e.codigo_expediente) AS asunto,
             e.fecha_radicacion,
             COALESCE(ultimo.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual,
             COALESCE(ultimo.area_actual_id::text, e.area_destino_id::text) AS area_actual_id,
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
        SELECT count(DISTINCT documento_id)::integer AS cantidad,
               COALESCE(sum(folio_hasta - folio_desde + 1), 0)::integer AS total
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
