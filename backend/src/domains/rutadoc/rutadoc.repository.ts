import type { Pool, PoolClient } from 'pg';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';
import type { ContadoresRutaDoc, DocumentoAdjuntoResumen, ExpedienteDetalle, ExpedienteResumen, FiltrosRutaDoc, PosicionCursor, UltimoMovimiento } from './rutadoc.types.js';

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
  listarDocumentosAdjuntos?(idExpediente: string): Promise<DocumentoAdjuntoResumen[]>;
}

/** Lectura del DDL ejecutable 05: UUID, CUT y fecha_radicacion. */
const BASE = `
  FROM sigd_tra.expediente e
  LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
  LEFT JOIN sigd_rut.estado_actual_expediente ultimo
    ON ultimo.expediente_id = e.expediente_id`;

const FILTROS = `
  WHERE ($1::text IS NULL OR position(lower($1::text) in lower(e.codigo_expediente || ' ' || COALESCE(t.asunto, ''))) > 0)
    AND ($2::text IS NULL OR ultimo.area_actual_id = $2::text)
    AND ($3::date IS NULL OR e.fecha_radicacion >= ($3::date::timestamp AT TIME ZONE 'UTC'))
    AND ($4::date IS NULL OR e.fecha_radicacion < (($4::date + 1)::timestamp AT TIME ZONE 'UTC'))`;

export const SQL_LISTAR_RUTADOC = `
  SELECT e.expediente_id::text AS id_expediente, e.codigo_expediente AS cut,
         COALESCE(t.asunto, '') AS asunto, e.fecha_radicacion,
         COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
         ultimo.area_actual_id
  ${BASE} ${FILTROS}
    AND COALESCE(ultimo.estado_nuevo, 'REGISTRADO') = ANY($5::text[])
    AND ($6::timestamptz IS NULL OR
         (e.fecha_radicacion, e.expediente_id) < ($6::timestamptz, $7::uuid))
  ORDER BY e.fecha_radicacion DESC, e.expediente_id DESC
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
  LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
  WHERE $1::text IS NULL
    AND ($2::text IS NULL OR ultimo.area_actual_id = $2::text)
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
                        p.id_expediente::uuid DESC) FROM elementos p), '[]'::jsonb) AS elementos,
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
      SELECT e.expediente_id::text AS id_expediente, e.codigo_expediente AS cut,
             COALESCE(t.asunto, '') AS asunto, e.fecha_radicacion,
             COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
             ultimo.area_actual_id,
             e.solicitante_id::text,
             ultimo.id_movimiento::text, ultimo.evento, ultimo.fecha_hora,
             ultimo.usuario_operador_id::text
      ${BASE}
      WHERE e.expediente_id = $1::uuid`, [idExpediente]);
    if (fila.rowCount === 0) return null;

    const dato = fila.rows[0];
    let resumenDocumentos: ExpedienteDetalle['resumenDocumentos'] = null;

    // 1. Consultar cantidad real de documentos adjuntos persistidos en sigd_doc.documento_adjunto
    let cantAdjuntos = 0;
    try {
      const existeAdjuntos = await this.pool.query<{ existe: string | null }>(
        `SELECT to_regclass('sigd_doc.documento_adjunto')::text AS existe`);
      if (existeAdjuntos.rows[0]?.existe) {
        const docsAdjuntos = await this.pool.query<{ cantidad: number }>(`
          SELECT count(*)::integer AS cantidad
            FROM sigd_doc.documento_adjunto
           WHERE expediente_tra_id = $1::uuid OR expediente_id = $1::uuid`, [idExpediente]);
        cantAdjuntos = docsAdjuntos.rows[0]?.cantidad ?? 0;
      }
    } catch {
      cantAdjuntos = 0;
    }

    // 2. Consultar folios asignados en sigd_tra.expediente_documento_folio si la tabla existe
    let cantFoliados = 0;
    let totalFolios = 0;
    const existeFoliacion = await this.pool.query<{ existe: string | null }>(
      `SELECT to_regclass('sigd_tra.expediente_documento_folio')::text AS existe`);
    if (existeFoliacion.rows[0]?.existe) {
      const folios = await this.pool.query<{ cantidad: number; total: number }>(`
        SELECT count(DISTINCT id_documento)::integer AS cantidad,
               COALESCE(sum(folio_fin - folio_inicio + 1), 0)::integer AS total
          FROM sigd_tra.expediente_documento_folio
         WHERE expediente_id = $1::uuid`, [idExpediente]);
      cantFoliados = folios.rows[0]?.cantidad ?? 0;
      totalFolios = folios.rows[0]?.total ?? 0;
    }

    const cantidadDocumentos = Math.max(cantAdjuntos, cantFoliados);
    resumenDocumentos = {
      cantidadDocumentos,
      totalFolios,
      cantidadFoliados: cantFoliados,
    };
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
  async listarDocumentosAdjuntos(idExpediente: string): Promise<DocumentoAdjuntoResumen[]> {
    try {
      const existeAdjuntos = await this.pool.query<{ existe: string | null }>(
        `SELECT to_regclass('sigd_doc.documento_adjunto')::text AS existe`);
      if (!existeAdjuntos.rows[0]?.existe) {
        return [];
      }

      const res = await this.pool.query<{
        id_documento: string;
        nombre_archivo: string;
        tamano_bytes: string;
        mime_type: string;
        sha256: string | null;
        creado_en: Date;
        tipo_documental: string | null;
        folio_inicio: number | null;
        folio_fin: number | null;
      }>(
        `SELECT da.documento_adjunto_id::text AS id_documento,
                da.nombre_archivo,
                da.tamano_bytes::text,
                da.mime_type,
                da.sha256,
                da.creado_en,
                td.nombre AS tipo_documental,
                f.folio_inicio,
                f.folio_fin
           FROM sigd_doc.documento_adjunto da
      LEFT JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = da.tipo_documental_id
      LEFT JOIN sigd_tra.expediente_documento_folio f ON f.id_documento = da.documento_adjunto_id AND f.expediente_id = $1::uuid
          WHERE da.expediente_tra_id = $1::uuid OR da.expediente_id = $1::uuid
          ORDER BY da.creado_en ASC`,
        [idExpediente],
      );

      return res.rows.map((d) => ({
        idDocumento: d.id_documento,
        nombreArchivo: d.nombre_archivo,
        tamanoBytes: Number(d.tamano_bytes),
        mimeType: d.mime_type,
        sha256: d.sha256 ? d.sha256.trim() : null,
        tipoDocumental: d.tipo_documental ?? 'Documento Principal',
        creadoEn: d.creado_en instanceof Date ? d.creado_en.toISOString() : String(d.creado_en),
        foliado: d.folio_inicio !== null && d.folio_inicio !== undefined,
        folios:
          d.folio_inicio !== null && d.folio_inicio !== undefined
            ? `F. ${String(d.folio_inicio).padStart(4, '0')} - F. ${String(d.folio_fin).padStart(4, '0')}`
            : null,
      }));
    } catch {
      return [];
    }
  }
}
