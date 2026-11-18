import type { Pool, PoolClient } from 'pg';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';
import type { AlcanceBandejaRutaDoc, ContadoresRutaDoc, ExpedienteDetalle, ExpedienteResumen, FiltrosRutaDoc, PosicionCursor, UltimoMovimiento } from './rutadoc.types.js';

interface FilaBandeja {
  id_expediente: string;
  cut: string;
  asunto: string;
  fecha_radicacion: Date;
  fecha_ingreso?: Date | string | null;
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
  listar(filtros: FiltrosRutaDoc, estados: readonly EstadoRutaDoc[], posicion: PosicionCursor | null,
    alcance: AlcanceBandejaRutaDoc): Promise<{
    elementos: ExpedienteResumen[];
    porEstado: Partial<Record<EstadoRutaDoc, number>>;
    porPestana?: ContadoresRutaDoc;
  }>;
  obtener(idExpediente: string): Promise<ExpedienteDetalle | null>;
}

/** Lectura del DDL ejecutable 05: UUID, CUT y fecha_radicacion. */
const BASE = `
  FROM sigd_tra.expediente e
  LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
  LEFT JOIN sigd_rut.estado_actual_expediente ultimo
    ON ultimo.expediente_id = e.expediente_id
  LEFT JOIN sigd_doc.expediente recibido
    ON recibido.expediente_id = e.expediente_id
   AND recibido.codigo_expediente = e.codigo_expediente
  LEFT JOIN (
    SELECT DISTINCT ON (expediente_id)
           expediente_id, canal_ingreso, anulado, asunto, fecha_ingreso
      FROM sigd_tra.asiento_registro
     WHERE anulado = FALSE
     ORDER BY expediente_id, numero_registro ASC
  ) ar ON ar.expediente_id = e.expediente_id`;

// Physical reception is distinct from the projected legal start of deadlines.
// No fallback to now(), a placeholder, or the legal date for missing receipts.
const FECHA_INGRESO_SQL = 'COALESCE(ar.fecha_ingreso, recibido.fecha_registro)';

const AREA_EFECTIVA_SQL = `
  CASE
    WHEN ultimo.expediente_id IS NOT NULL THEN NULLIF(ultimo.area_actual_id, '')
    WHEN ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')
      THEN (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
    ELSE NULL
  END`;

const FILTROS = `
  WHERE ($1::text IS NULL OR position(lower($1::text) in lower(e.codigo_expediente || ' ' || COALESCE(t.asunto, ar.asunto, ''))) > 0)
    AND ($2::text IS NULL OR (${AREA_EFECTIVA_SQL}) = $2::text)
    AND ($3::date IS NULL OR ${FECHA_INGRESO_SQL} >= ($3::date::timestamp AT TIME ZONE 'America/Lima'))
    AND ($4::date IS NULL OR ${FECHA_INGRESO_SQL} < (($4::date + 1)::timestamp AT TIME ZONE 'America/Lima'))
    AND ($5::boolean OR e.solicitante_id = $6::uuid)`;

export const SQL_LISTAR_RUTADOC = `
  SELECT e.expediente_id::text AS id_expediente, e.codigo_expediente AS cut,
         COALESCE(t.asunto, ar.asunto, '') AS asunto, e.fecha_radicacion,
         ${FECHA_INGRESO_SQL} AS fecha_ingreso,
         COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
         (${AREA_EFECTIVA_SQL}) AS area_actual_id
  ${BASE} ${FILTROS}
    AND COALESCE(ultimo.estado_nuevo, 'REGISTRADO') = ANY($7::text[])
    AND ($8::timestamptz IS NULL OR
         (e.fecha_radicacion, e.expediente_id) < ($8::timestamptz, $9::uuid))
  ORDER BY e.fecha_radicacion DESC, e.expediente_id DESC
  LIMIT $10`;

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
  LEFT JOIN sigd_doc.expediente recibido
    ON recibido.expediente_id = e.expediente_id
   AND recibido.codigo_expediente = e.codigo_expediente
  LEFT JOIN (
    SELECT DISTINCT ON (expediente_id)
           expediente_id, canal_ingreso, anulado, fecha_ingreso
      FROM sigd_tra.asiento_registro
     WHERE anulado = FALSE
     ORDER BY expediente_id, numero_registro ASC
  ) ar ON ar.expediente_id = e.expediente_id
  WHERE $1::text IS NULL
    AND ($2::text IS NULL OR (${AREA_EFECTIVA_SQL}) = $2::text)
    AND ($3::date IS NULL OR ${FECHA_INGRESO_SQL} >= ($3::date::timestamp AT TIME ZONE 'America/Lima'))
    AND ($4::date IS NULL OR ${FECHA_INGRESO_SQL} < (($4::date + 1)::timestamp AT TIME ZONE 'America/Lima'))
    AND ($5::boolean OR e.solicitante_id = $6::uuid)`;

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
         CASE WHEN $5::boolean AND EXISTS (
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
    fechaIngreso: fila.fecha_ingreso == null ? null : new Date(fila.fecha_ingreso).toISOString(),
    estadoActual: fila.estado_actual,
    areaActualId: fila.area_actual_id,
  };
}

export class RepositorioPostgresRutaDoc implements RepositorioRutaDoc {
  constructor(private readonly pool: Pool) {}

  async listar(filtros: FiltrosRutaDoc, estados: readonly EstadoRutaDoc[], posicion: PosicionCursor | null,
    alcance: AlcanceBandejaRutaDoc) {
    const exentoSolicitante = alcance.accesoGlobal || Boolean(alcance.esOperadorArea && filtros.areaId);
    const comunes = [filtros.terminoBusqueda ?? null, filtros.areaId ?? null,
      filtros.fechaDesde ?? null, filtros.fechaHasta ?? null, exentoSolicitante, alcance.solicitanteId];
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
             COALESCE(t.asunto, ar.asunto, '') AS asunto, e.fecha_radicacion,
             ${FECHA_INGRESO_SQL} AS fecha_ingreso,
             COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
             (${AREA_EFECTIVA_SQL}) AS area_actual_id,
             e.solicitante_id::text,
             documentado.id_movimiento::text, documentado.evento, documentado.fecha_hora,
             documentado.usuario_operador_id::text
      ${BASE}
      LEFT JOIN sigd_rut.movimiento_tramite documentado
        ON documentado.expediente_id = e.expediente_id
       AND documentado.id_movimiento = ultimo.id_movimiento
       AND documentado.secuencia = ultimo.secuencia AND documentado.estado_nuevo = ultimo.estado_nuevo
      WHERE e.expediente_id = $1::uuid`, [idExpediente]);
    if (fila.rowCount === 0) return null;

    const dato = fila.rows[0];
    let resumenDocumentos: ExpedienteDetalle['resumenDocumentos'] = null;
    let documentos: NonNullable<ExpedienteDetalle['documentos']> = [];
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
      const adjuntos = await this.pool.query<{
        id_documento: string; nombre: string; mime_type: string; folio_inicio: number; folio_fin: number; tiene_firma_digital: boolean;
        desglosado: boolean;
      }>(`
        SELECT f.id_documento::text, a.nombre_archivo AS nombre, a.mime_type,
               f.folio_inicio, f.folio_fin,
               EXISTS (
                 SELECT 1 FROM sigd_doc.firma_digital_documento fd
                  WHERE fd.documento_id = a.documento_adjunto_id
                    AND fd.estado = 'FIRMADO_DIGITALMENTE'
               ) AS tiene_firma_digital,
               COALESCE(a.desglosado, FALSE) AS desglosado
          FROM sigd_tra.expediente_documento_folio f
          JOIN sigd_doc.documento_adjunto a
            ON a.documento_adjunto_id = f.id_documento AND a.expediente_id = f.expediente_id
         WHERE f.expediente_id = $1::uuid
         ORDER BY f.folio_inicio ASC`, [idExpediente]);
      documentos = adjuntos.rows.map((adjunto) => ({
        idDocumento: adjunto.id_documento, nombre: adjunto.nombre,
        mimeType: adjunto.mime_type, folioInicio: adjunto.folio_inicio, folioFin: adjunto.folio_fin,
        tieneFirmaDigital: Boolean(adjunto.tiene_firma_digital),
        desglosado: Boolean(adjunto.desglosado),
      }));
    }

    const infoAcumulacion = await this.pool.query<{
      id_acumulacion: string;
      expediente_principal_id: string;
      principal_codigo: string;
      expediente_accesorio_id: string;
      accesorio_codigo: string;
      acto_resolutivo: string;
      fecha_acumulacion: Date;
      rol: 'PRINCIPAL' | 'ACCESORIO';
    }>(`
      SELECT a.id_acumulacion::text,
             a.expediente_principal::text AS expediente_principal_id,
             ep.codigo_expediente AS principal_codigo,
             a.expediente_accesorio::text AS expediente_accesorio_id,
             ea.codigo_expediente AS accesorio_codigo,
             a.acto_resolutivo,
             a.fecha_acumulacion,
             CASE WHEN a.expediente_principal = $1::uuid THEN 'PRINCIPAL' ELSE 'ACCESORIO' END AS rol
        FROM sigd_tra.expediente_acumulacion a
        JOIN sigd_tra.expediente ep ON ep.expediente_id = a.expediente_principal
        JOIN sigd_tra.expediente ea ON ea.expediente_id = a.expediente_accesorio
       WHERE (a.expediente_principal = $1::uuid OR a.expediente_accesorio = $1::uuid)
         AND a.estado = 'ACUMULADO'
       ORDER BY a.fecha_acumulacion DESC
       LIMIT 1`, [idExpediente]);

    const acumulacionFila = infoAcumulacion.rows[0];
    const acumulacionInfo = acumulacionFila ? {
      idAcumulacion: acumulacionFila.id_acumulacion,
      esAccesorio: acumulacionFila.rol === 'ACCESORIO',
      esPrincipal: acumulacionFila.rol === 'PRINCIPAL',
      expedientePrincipalId: acumulacionFila.expediente_principal_id,
      expedientePrincipalCodigo: acumulacionFila.principal_codigo,
      expedienteAccesorioId: acumulacionFila.expediente_accesorio_id,
      expedienteAccesorioCodigo: acumulacionFila.accesorio_codigo,
      actoResolutivo: acumulacionFila.acto_resolutivo,
      fechaAcumulacion: acumulacionFila.fecha_acumulacion.toISOString(),
    } : null;

    const ultimoMovimiento: UltimoMovimiento | null = dato.id_movimiento && dato.evento && dato.fecha_hora && dato.usuario_operador_id
      ? { idMovimiento: dato.id_movimiento, evento: dato.evento,
          estadoNuevo: dato.estado_actual, fechaHora: dato.fecha_hora.toISOString(),
          usuarioOperadorId: dato.usuario_operador_id }
      : null;
    return {
      ...mapearResumen(dato), solicitanteId: dato.solicitante_id,
      resumenDocumentos, documentos, acumulacionInfo, ultimoMovimiento, sla: null,
    };
  }
}
