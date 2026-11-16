import type { Pool, PoolClient } from 'pg';
import { NotFoundError } from '../../shared/domain/errors/index.js';
import type { ConsultaPublicaParams } from './tramites.schemas.js';

/**
 * T-BE-TC-04 · Consulta publica de expediente por CUT con minimizacion de datos.
 *
 * Principio rector: el endpoint #16 se invoca sin credenciales, por lo que jamas
 * debe projectar datos de contacto del administrado. La Ley N. 29733 obliga a
 * restringir el tratamiento a la finalidad para la que se recolecto, y una
 * consulta de expediente no incluye el telefono particular ni el correo
 * personal del estudiante. Este servicio devuelve un DTO cerrado: si un campo
 * sensible no esta en la lista, no sale.
 *
 * Se expone el estado procesal y unicamente los proveidos marcados como
 * publicos por el area correspondiente.
 *
 * Desviacion consciente respecto del plan: la especificacion ilustra el
 * enmascarado del telefono como `961***456`. Aqui el telefono se OMITE en lugar
 * de enmascararse, porque publicar que el dato existe y unveil su forma
 * contradice el principio de minimizacion que la propia tarea invoca. El
 * documento de identidad si se enmascara, con la forma `45***123` que el plan
 * fija. `direccion` no se contempla porque `sigd_auth.persona` no tiene esa
 * columna en el esquema vigente.
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
  /** Datos del administrado enmascarados; nunca el valor integro. */
  administrado: {
    documentoEnmascarado: string | null;
    nombreEnmascarado: string | null;
  };
  documentos: DtoDocumentoPublico[];
  proveidos: DtoProveidoPublico[];
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

/** Ancho de la ventana visible al_redondear. */
const VENTANA_ENMASCARADO = 2;

export class ConsultaPublicaService {
  constructor(private readonly pool: Pool) {}

  async consultarPorCut(params: ConsultaPublicaParams): Promise<DtoConsultaPublica> {
    const cliente = await this.pool.connect();
    try {
      const expediente = await this.leerExpediente(cliente, params.cut);
      if (!expediente) {
        // Se responde 404 tambien cuando el expediente existe pero esta anulado
        // logicamente, para no confirmar la existencia de un CUT cancelado.
        throw new NotFoundError({
          message: 'No existe un expediente con el CUT consultado.',
          detail:
            'No se encontro ningun expediente vigente con ese CUT. Si el expediente fue ' +
            'anulado se responde igual, para no confirmar la existencia de un CUT cancelado.',
        });
      }

      const [documentos, proveidos] = await Promise.all([
        this.leerDocumentos(cliente, params.cut),
        this.leerProveidosPublicos(cliente, params.cut),
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
          fechaEmision: expediente.orden_fecha ? (expediente.orden_fecha instanceof Date ? expediente.orden_fecha.toISOString() : String(expediente.orden_fecha)) : new Date().toISOString(),
          indicaciones: 'Pague en efectivo en la caja de Tesorería del Instituto indicando su CUT o código de orden. La orden no acredita pago hasta su recepción en caja.',
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
            expediente.apellido_materno,
          ),
        },
        documentos,
        proveidos,
        mensajeLegal:
          'Informacion publica pursuant a la Ley N° 29733. Los datos personales han sido ' +
          'enmascarados conforme al principio de minimizacion.' +
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
      [cut],
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
      [cut],
    );
    return resultado.rows.map((fila) => ({
      nombreArchivo: fila.nombre_archivo,
      contentType: fila.content_type,
      hashSha256: fila.hash_sha256,
    }));
  }

  private async leerProveidosPublicos(cliente: PoolClient, cut: string): Promise<DtoProveidoPublico[]> {
    // El esquema vigente no define una tabla de proveídos ni un indicador de
    // publicación. No se infieren proveídos públicos desde movimientos internos.
    void cliente;
    void cut;
    return [];
  }
}

/** Digitos iniciales que se conservan al enmascarar un documento. */
const VENTANA_INICIAL = 2;

/** Digitos finales que se conservan al enmascarar un documento. */
const VENTANA_FINAL = 3;

/**
 * Enmascara un documento de identidad conservando solo los extremos, con la
 * forma `45***123` que fija la especificacion de T-BE-TC-04. Un valor demasiado
 * corto para admitir ambas ventanas se enmascara por completo, porque en ese
 * rango cualquier digito conservado revelaria el documento entero.
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
  apellidoMaterno: string | null,
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
