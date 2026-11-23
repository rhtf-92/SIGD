import type { Pool, PoolClient } from 'pg';
import { NotFoundError } from '../../shared/domain/errors/index.js';
import type { ConsultaPublicaParams } from './tramites.schemas.js';

/**
 * T-BE-TC-04 · Consulta pública de expediente por CUT con minimización de datos.
 *
 * Principio rector: el endpoint #16 no debe proyectar datos de contacto del administrado
 * conforme a la Ley N° 29733 (Ley de Protección de Datos Personales).
 * Este servicio devuelve un DTO cerrado con datos enmascarados, estado económico,
 * documentos adjuntos y la línea de tiempo cronológica institucional de movimientos públicos.
 */

export interface DtoDocumentoPublico {
  nombreArchivo: string;
  contentType: string;
  hashSha256: string;
}

export interface DtoProveidoPublico {
  numero: string;
  fechaEmision: string;
  resumen: string;
}

export interface DtoOrdenPagoPublica {
  codigo: string;
  importe: string;
  moneda: string;
  fechaEmision: string;
  indicaciones: string;
  estado: string;
}

export interface DtoMovimientoPublico {
  secuencia: number;
  fechaHora: string;
  etapa: string;
  descripcion: string;
  unidadOrganica: string;
  estado: string;
  detallesPublicos?: {
    codigoVerificacion?: string;
    custodiaFisica?: boolean;
    observado?: boolean;
    subsanado?: boolean;
  };
}

export interface DtoConsultaPublica {
  cut: string;
  anioFiscal: number;
  estadoTramite: string;
  tipoTramite: string | null;
  asunto: string;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  fueraDeHorario: boolean;
  canalRecepcion: string;
  totalFolios: number;
  /** Datos del administrado enmascarados; nunca el valor íntegro. */
  administrado: {
    documentoEnmascarado: string | null;
    nombreEnmascarado: string | null;
  };
  documentos: DtoDocumentoPublico[];
  proveidos: DtoProveidoPublico[];
  movimientos?: DtoMovimientoPublico[];
  mensajeLegal: string;
  condicionEconomica?: 'PENDIENTE DE PAGO' | 'PAGO VERIFICADO' | 'GRATUITO' | null;
  ordenPago?: DtoOrdenPagoPublica | null;
}

interface FilaConsulta {
  cut: string;
  anio_fiscal: number;
  estado_tramite: string;
  tipo_tramite: string | null;
  asunto: string;
  fecha_envio_real: Date;
  fecha_radicacion_legal: Date;
  fuera_de_horario: boolean;
  canal_recepcion: string;
  total_folios: number;
  tipo_documento: string | null;
  numero_documento: string | null;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  orden_id?: string | null;
  orden_codigo?: string | null;
  orden_importe?: string | null;
  orden_moneda?: string | null;
  orden_fecha?: Date | null;
  pago_verificado?: boolean | null;
  estado_pago?: string | null;
  tarifa_importe?: number | null;
}

interface FilaDocumento {
  nombre_archivo: string;
  content_type: string;
  hash_sha256: string;
}

interface FilaMovimientoBD {
  secuencia: number | string;
  fecha_hora: Date | string;
  evento: string;
  estado_anterior: string;
  estado_nuevo: string;
  datos: Record<string, unknown> | null;
}

export class ConsultaPublicaService {
  constructor(private readonly pool: Pool) {}

  async consultarPorCut(params: ConsultaPublicaParams): Promise<DtoConsultaPublica> {
    const cliente = await this.pool.connect();
    try {
      const expediente = await this.leerExpediente(cliente, params.cut);
      if (!expediente) {
        // Se responde 404 también cuando el expediente existe pero está anulado
        // lógicamente, para no confirmar la existencia de un CUT cancelado.
        throw new NotFoundError({
          message: 'No existe un expediente con el CUT consultado.',
          detail:
            'No se encontró ningún expediente vigente con ese CUT. Si el expediente fue ' +
            'anulado se responde igual, para no confirmar la existencia de un CUT cancelado.',
        });
      }

      const [documentos, proveidos, movimientos] = await Promise.all([
        this.leerDocumentos(cliente, params.cut),
        this.leerProveidosPublicos(cliente, params.cut),
        this.leerMovimientosPublicos(cliente, params.cut, expediente),
      ]);

      let condicionEconomica: 'PENDIENTE DE PAGO' | 'PAGO VERIFICADO' | 'GRATUITO' | null = null;
      let ordenPago: DtoOrdenPagoPublica | null = null;

      if (expediente.orden_id) {
        if (expediente.pago_verificado) {
          condicionEconomica = 'PAGO VERIFICADO';
        } else {
          condicionEconomica = 'PENDIENTE DE PAGO';
        }
        ordenPago = {
          codigo: expediente.orden_codigo ?? '',
          importe: expediente.orden_importe ?? '0.00',
          moneda: expediente.orden_moneda ?? 'PEN',
          fechaEmision: expediente.orden_fecha
            ? expediente.orden_fecha instanceof Date
              ? expediente.orden_fecha.toISOString()
              : String(expediente.orden_fecha)
            : new Date().toISOString(),
          indicaciones:
            'Pague en efectivo en la caja de Tesorería del Instituto indicando su CUT o código de orden. La orden no acredita pago hasta su recepción en caja.',
          estado: expediente.pago_verificado ? 'VERIFICADO' : (expediente.estado_pago ?? 'PENDIENTE'),
        };
      } else if (expediente.tarifa_importe !== undefined && expediente.tarifa_importe !== null) {
        if (Number(expediente.tarifa_importe) === 0) {
          condicionEconomica = 'GRATUITO';
        } else {
          condicionEconomica = 'PENDIENTE DE PAGO';
        }
      }

      return {
        cut: expediente.cut,
        anioFiscal: expediente.anio_fiscal,
        estadoTramite: expediente.estado_tramite,
        tipoTramite: expediente.tipo_tramite,
        asunto: expediente.asunto,
        fechaEnvioReal: expediente.fecha_envio_real.toISOString(),
        fechaRadicacionLegal: expediente.fecha_radicacion_legal.toISOString(),
        fueraDeHorario: expediente.fuera_de_horario,
        canalRecepcion: expediente.canal_recepcion,
        totalFolios: expediente.total_folios,
        administrado: {
          documentoEnmascarado: enmascararDocumento(expediente.numero_documento),
          nombreEnmascarado: enmascararNombre(
            expediente.nombres,
            expediente.apellido_paterno,
            expediente.apellido_materno
          ),
        },
        documentos,
        proveidos,
        movimientos,
        mensajeLegal:
          'Información pública conforme a la Ley N° 29733 y Ley N° 27444. Los datos personales han sido ' +
          'enmascarados conforme al principio de minimización.' +
          (condicionEconomica === 'PENDIENTE DE PAGO'
            ? ' Estado económico: PENDIENTE DE PAGO en Tesorería. Debe abonar la tasa en la caja institucional para que Mesa de Partes proceda con la calificación y derivación del expediente.'
            : condicionEconomica === 'PAGO VERIFICADO'
            ? ' Estado económico: PAGO VERIFICADO. Su expediente continúa su curso institucional.'
            : ''),
        condicionEconomica,
        ordenPago,
      };
    } finally {
      cliente.release();
    }
  }

  private async leerExpediente(cliente: PoolClient, cut: string): Promise<FilaConsulta | undefined> {
    const resultado = await cliente.query<FilaConsulta>(
      `SELECT te.codigo_expediente AS cut,
              EXTRACT(YEAR FROM COALESCE(e.fecha_registro, te.fecha_radicacion))::integer AS anio_fiscal,
              te.estado AS estado_tramite,
              tt.denominacion   AS tipo_tramite,
              COALESCE(e.asunto, a.asunto, '') AS asunto,
              COALESCE(e.fecha_registro, a.fecha_ingreso, te.fecha_radicacion) AS fecha_envio_real,
              te.fecha_radicacion AS fecha_radicacion_legal,
              COALESCE((te.fecha_radicacion::date > e.fecha_registro::date), false) AS fuera_de_horario,
              COALESCE(a.canal_ingreso, 'MESA_VIRTUAL') AS canal_recepcion,
              COALESCE(f.total_folios, 0)::integer AS total_folios,
              COALESCE(td.nombre, td_te.nombre) AS tipo_documento,
              p.id_documento AS numero_documento,
              COALESCE(pn.nombres, pj.razon_social) AS nombres,
              pn.apellidos AS apellido_paterno,
              NULL::text AS apellido_materno,
              op.orden_id,
              op.orden_codigo,
              op.orden_importe,
              op.orden_moneda,
              op.orden_fecha,
              op.pago_verificado,
              op.estado_pago,
              tf.tarifa_importe
         FROM sigd_tra.expediente te
         LEFT JOIN sigd_doc.expediente e
           ON e.expediente_id = te.expediente_id
         LEFT JOIN sigd_doc.tipo_documento td_te
           ON td_te.tipo_documental_id = te.tipo_documental_id
         LEFT JOIN sigd_doc.expediente_tipo_tramite tt
                ON tt.expediente_id = e.expediente_id
         LEFT JOIN sigd_auth.persona p
                ON p.id_persona = COALESCE(te.solicitante_id, e.solicitante_id)
         LEFT JOIN sigd_auth.persona_natural pn
                ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj
                ON pj.id_persona = p.id_persona
         LEFT JOIN LATERAL (
              SELECT da.tipo_documental_id
                FROM sigd_doc.documento_adjunto da
               WHERE da.expediente_id = e.expediente_id
               ORDER BY da.creado_en, da.documento_adjunto_id
               LIMIT 1
         ) primer_documento ON TRUE
         LEFT JOIN sigd_doc.tipo_documento td
                ON td.tipo_documental_id = primer_documento.tipo_documental_id
         LEFT JOIN LATERAL (
              SELECT MAX(df.folio_fin) AS total_folios
                FROM sigd_tra.expediente_documento_folio df
               WHERE df.expediente_id = te.expediente_id
         ) f ON TRUE
         LEFT JOIN LATERAL (
              SELECT ar.canal_ingreso, ar.asunto, ar.fecha_ingreso
                FROM sigd_tra.asiento_registro ar
               WHERE ar.expediente_id = te.expediente_id
                 AND ar.anulado = FALSE
               ORDER BY ar.fecha_ingreso DESC, ar.numero_registro DESC
               LIMIT 1
         ) a ON TRUE
         LEFT JOIN LATERAL (
              SELECT
                o.id AS orden_id,
                o.codigo AS orden_codigo,
                o.importe::text AS orden_importe,
                o.moneda AS orden_moneda,
                o.creado_en AS orden_fecha,
                EXISTS(
                  SELECT 1 FROM sigd_tes.pago p
                  WHERE p.orden_id = o.id AND p.estado = 'VERIFICADO'
                    AND NOT EXISTS (SELECT 1 FROM sigd_tes.devolucion d WHERE d.pago_id = p.id AND d.estado <> 'RECHAZADA')
                ) AS pago_verificado,
                COALESCE(
                  (SELECT p.estado FROM sigd_tes.pago p WHERE p.orden_id = o.id ORDER BY p.creado_en DESC, p.id DESC LIMIT 1),
                  'PENDIENTE'
                ) AS estado_pago
              FROM sigd_tes.aplicacion_pago ap
              JOIN sigd_tes.orden_pago o ON o.id = ap.orden_id
              WHERE ap.expediente_id = te.expediente_id
              ORDER BY o.creado_en DESC, o.id DESC
              LIMIT 1
         ) op ON TRUE
         LEFT JOIN LATERAL (
              SELECT f.importe::numeric(14,2) AS tarifa_importe
              FROM sigd_tes.tarifa f
              WHERE f.tipo_tramite_id = e.tipo_tramite_id
                AND f.estado = 'VALIDADA'
                AND f.vigente_desde <= (now() AT TIME ZONE 'America/Lima')::date
                AND (f.vigente_hasta IS NULL OR f.vigente_hasta >= (now() AT TIME ZONE 'America/Lima')::date)
              LIMIT 1
         ) tf ON TRUE
        WHERE te.codigo_expediente = $1
          AND te.estado <> 'ANULADO'`,
      [cut]
    );
    return resultado.rows[0];
  }

  private async leerDocumentos(cliente: PoolClient, cut: string): Promise<DtoDocumentoPublico[]> {
    const resultado = await cliente.query<FilaDocumento>(
      `SELECT da.nombre_archivo,
              da.mime_type AS content_type,
              da.sha256 AS hash_sha256
         FROM sigd_doc.documento_adjunto da
         JOIN sigd_doc.expediente e ON e.expediente_id = da.expediente_id
        WHERE e.codigo_expediente = $1
        ORDER BY da.nombre_archivo, da.documento_adjunto_id`,
      [cut]
    );
    return resultado.rows.map((fila) => ({
      nombreArchivo: fila.nombre_archivo,
      contentType: fila.content_type,
      hashSha256: fila.hash_sha256,
    }));
  }

  private async leerProveidosPublicos(cliente: PoolClient, cut: string): Promise<DtoProveidoPublico[]> {
    void cliente;
    void cut;
    return [];
  }

  private async leerMovimientosPublicos(
    cliente: PoolClient,
    cut: string,
    expediente: FilaConsulta
  ): Promise<DtoMovimientoPublico[]> {
    try {
      const resultado = await cliente.query<FilaMovimientoBD>(
        `SELECT m.secuencia,
                m.fecha_hora,
                m.evento,
                m.estado_anterior,
                m.estado_nuevo,
                m.datos
           FROM sigd_rut.movimiento_tramite m
           JOIN sigd_tra.expediente te ON te.expediente_id = m.expediente_id
          WHERE te.codigo_expediente = $1
          ORDER BY m.secuencia ASC, m.fecha_hora ASC`,
        [cut]
      );

      if (resultado.rows.length === 0) {
        return [
          {
            secuencia: 1,
            fechaHora:
              expediente.fecha_envio_real instanceof Date
                ? expediente.fecha_envio_real.toISOString()
                : String(expediente.fecha_envio_real),
            etapa: 'RADICACION',
            descripcion: 'Trámite presentado formalmente en Sede Digital — Mesa de Partes Virtual',
            unidadOrganica: 'Mesa de Partes Virtual',
            estado: expediente.estado_tramite,
            detallesPublicos: {},
          },
        ];
      }

      return resultado.rows.map((row) => {
        const datos = row.datos && typeof row.datos === 'object' ? row.datos : {};
        const etapa = mapearEtapaPublica(row.evento, row.estado_nuevo);
        const descripcion = generarDescripcionHito(row.evento, row.estado_nuevo, datos);
        const unidadOrganica = sanitizarUnidadPublica(
          (datos.destinatario as string) || (datos.remitente as string) || (datos.rol as string) || 'Mesa de Partes'
        );

        return {
          secuencia: Number(row.secuencia),
          fechaHora:
            row.fecha_hora instanceof Date ? row.fecha_hora.toISOString() : String(row.fecha_hora),
          etapa,
          descripcion,
          unidadOrganica,
          estado: row.estado_nuevo,
          detallesPublicos: {
            codigoVerificacion: typeof datos.cvd === 'string' ? datos.cvd : undefined,
            custodiaFisica: Boolean(datos.custodia),
            observado: row.estado_nuevo === 'OBSERVADO' || row.evento === 'OBSERVACION',
            subsanado: row.evento === 'SUBSANACION',
          },
        };
      });
    } catch {
      return [
        {
          secuencia: 1,
          fechaHora:
            expediente.fecha_envio_real instanceof Date
              ? expediente.fecha_envio_real.toISOString()
              : String(expediente.fecha_envio_real),
          etapa: 'RADICACION',
          descripcion: 'Trámite radicado formalmente en Sede Digital',
          unidadOrganica: 'Mesa de Partes',
          estado: expediente.estado_tramite,
          detallesPublicos: {},
        },
      ];
    }
  }
}

export function mapearEtapaPublica(evento: string, estadoNuevo: string): string {
  const ev = (evento || '').toUpperCase();
  const st = (estadoNuevo || '').toUpperCase();
  if (ev === 'CIERRE' || st === 'ARCHIVADO') return 'ARCHIVO_CENTRAL';
  if (ev === 'FIRMA' || st === 'RESUELTO') return 'RESOLUCION_FIRMA';
  if (ev === 'ENVIAR_A_FIRMA' || st === 'EN_FIRMA') return 'DESPACHO_DIRECCION';
  if (ev === 'ATENCION_TECNICA' || st === 'ATENDIDO') return 'DICTAMEN_TECNICO';
  if (ev === 'ASIGNACION' || st === 'EN_REVISION') return 'EVALUACION_ACADEMICA';
  if (ev === 'DERIVACION' || st === 'DERIVADO') return 'DERIVACION_INSTITUCIONAL';
  if (ev === 'RECEPCION') return 'RECEPCION_DOCUMENTAL';
  if (ev === 'OBSERVACION' || st === 'OBSERVADO') return 'OBSERVACION_NOTIFICADA';
  if (ev === 'SUBSANACION') return 'SUBSANACION_RECIBIDA';
  if (ev === 'PAGO' || st === 'HABILITADO') return 'TESORERIA';
  return 'RADICACION';
}

export function generarDescripcionHito(
  evento: string,
  estadoNuevo: string,
  datos: Record<string, unknown>
): string {
  if (typeof datos.proveido === 'string' && datos.proveido.trim()) {
    return datos.proveido.trim();
  }
  const ev = (evento || '').toUpperCase();
  const st = (estadoNuevo || '').toUpperCase();
  if (ev === 'CIERRE' || st === 'ARCHIVADO') {
    return 'Procedimiento administrativo concluido y custodiado en Archivo Central.';
  }
  if (ev === 'FIRMA' || st === 'RESUELTO') {
    const cvd = typeof datos.cvd === 'string' ? ` (CVD: ${datos.cvd})` : '';
    return `Resolución Directoral suscrita formalmente con firma digital PAdES${cvd}.`;
  }
  if (ev === 'ENVIAR_A_FIRMA' || st === 'EN_FIRMA') {
    return 'Expediente elevado a Dirección General para firma de Resolución Directoral.';
  }
  if (ev === 'ATENCION_TECNICA' || st === 'ATENDIDO') {
    return 'Evaluación y verificación documental concluida con dictamen favorable.';
  }
  if (ev === 'ASIGNACION' || st === 'EN_REVISION') {
    return 'Expediente asignado a coordinación académica para evaluación técnica y revisión de requisitos.';
  }
  if (ev === 'RECEPCION') {
    return 'Recepción formal del expediente físico y digital en unidad de destino.';
  }
  if (ev === 'DERIVACION' || st === 'DERIVADO') {
    return 'Expediente calificado y derivado a la unidad orgánica competente.';
  }
  if (ev === 'OBSERVACION' || st === 'OBSERVADO') {
    return 'Expediente observado: se requiere subsanación de requisitos documentales.';
  }
  if (ev === 'SUBSANACION') {
    return 'Subsanación documental presentada formalmente por el administrado.';
  }
  if (ev === 'PAGO') {
    return 'Abono de tasa TUPA verificado en Tesorería. Trámite habilitado para Mesa de Partes.';
  }
  return 'Trámite presentado formalmente en Sede Digital — Mesa de Partes Virtual.';
}

export function sanitizarUnidadPublica(unidad: string): string {
  const u = (unidad || '').trim();
  const lower = u.toLowerCase();
  if (lower.includes('direct') || lower.includes('director')) return 'Dirección General';
  if (lower.includes('secretar')) return 'Secretaría Académica';
  if (lower.includes('tesorer') || lower.includes('caja')) return 'Unidad de Tesorería';
  if (lower.includes('archiv')) return 'Archivo Central';
  if (lower.includes('mesa') || lower.includes('partes')) return 'Mesa de Partes';
  if (lower.includes('docente') || lower.includes('evaluad') || lower.includes('area'))
    return 'Coordinación de Área Académica';
  return u.replace(/[0-9]{8}/g, '').trim() || 'Unidad Orgánica Institucional';
}

/** Dígitos iniciales que se conservan al enmascarar un documento. */
const VENTANA_INICIAL = 2;

/** Dígitos finales que se conservan al enmascarar un documento. */
const VENTANA_FINAL = 3;

/**
 * Enmascara un documento de identidad conservando solo los extremos (`45***123`).
 */
export function enmascararDocumento(documento: string | null): string | null {
  if (!documento) return null;
  const limpio = documento.trim();
  const longitud = limpio.length;
  if (longitud <= VENTANA_INICIAL + VENTANA_FINAL) {
    return '*'.repeat(longitud);
  }
  const cabeza = limpio.slice(0, VENTANA_INICIAL);
  const cola = limpio.slice(-VENTANA_FINAL);
  const ocultos = '*'.repeat(longitud - VENTANA_INICIAL - VENTANA_FINAL);
  return `${cabeza}${ocultos}${cola}`;
}

/** Conserva la primera letra de cada componente y oculta el resto. */
export function enmascararNombre(
  nombres: string | null,
  apellidoPaterno: string | null,
  apellidoMaterno: string | null
): string | null {
  const componentes = [nombres, apellidoPaterno, apellidoMaterno]
    .filter((valor): valor is string => Boolean(valor && valor.trim()))
    .map((valor) => valor.trim().split(/\s+/)[0]);

  if (componentes.length === 0) return null;

  return componentes
    .map((componente) => {
      const inicial = componente.charAt(0).toUpperCase();
      const ocultos = '*'.repeat(Math.max(componente.length - 1, 1));
      return `${inicial}${ocultos}`;
    })
    .join(' ');
}
