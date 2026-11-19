import type { Pool, PoolClient } from 'pg';
import { NotFoundError } from '../../shared/domain/errors/index.js';
import type { ConsultaPublicaParams } from './tramites.schemas.js';

/**
 * T-BE-TC-04 · Consulta publica de expediente por CUT con minimizacion de datos.
 *
 * ALINEACION CON MIGRACIONES REALES (02_sigd_auth.sql, 04_sigd_doc.sql, 05_sigd_tra.sql):
 *   * `sigd_tra.expediente` (`codigo_expediente`, `solicitante_id`, `estado`, `fecha_radicacion`)
 *   * `sigd_doc.expediente` (`tipo_tramite_id`, `asunto`, `codigo_expediente`)
 *   * `sigd_doc.tipo_tramite_tupa` (`tipo_tramite_id`, `denominacion`)
 *   * `sigd_auth.persona` (`id_persona`, `id_documento`, `tipo`)
 *   * `sigd_auth.persona_natural` (`id_persona`, `nombres`, `apellidos`, `nombre_completo`)
 *   * `sigd_auth.persona_juridica` (`id_persona`, `razon_social`)
 *   * `sigd_doc.documento_adjunto` (`expediente_id`, `nombre_archivo`, `mime_type`, `sha256`)
 *   * `sigd_tra.asiento_registro` (`expediente_id`, `fecha_ingreso`, `canal_ingreso`)
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

interface FilaProveido {
  numero: string;
  fecha_emision: Date;
  resumen: string;
}

export class ConsultaPublicaService {
  constructor(private readonly pool: Pool) {}

  async consultarPorCut(params: ConsultaPublicaParams): Promise<DtoConsultaPublica> {
    const cliente = await this.pool.connect();
    try {
      const expediente = await this.leerExpediente(cliente, params.cut);
      if (!expediente) {
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
        anioFiscal: Number(expediente.anio_fiscal),
        estadoTramite: expediente.estado_tramite,
        tipoTramite: expediente.tipo_tramite,
        asunto: expediente.asunto,
        fechaEnvioReal: new Date(expediente.fecha_envio_real).toISOString(),
        fechaRadicacionLegal: new Date(expediente.fecha_radicacion_legal).toISOString(),
        fueraDeHorario: Boolean(expediente.fuera_de_horario),
        canalRecepcion: expediente.canal_recepcion,
        totalFolios: Number(expediente.total_folios),
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
          'Informacion publica conforme a la Ley N° 29733. Los datos personales han sido ' +
          'enmascarados conforme al principio de minimizacion.',
      };
    } finally {
      cliente.release();
    }
  }

  private async leerExpediente(cliente: PoolClient, cut: string): Promise<FilaConsulta | undefined> {
    const resultado = await cliente.query<FilaConsulta>(
      `SELECT e.codigo_expediente AS cut,
              EXTRACT(YEAR FROM e.fecha_radicacion)::int AS anio_fiscal,
              e.estado AS estado_tramite,
              tt.denominacion AS tipo_tramite,
              COALESCE(de.asunto, tr.asunto, ar.asunto, 'Sin asunto') AS asunto,
              COALESCE(ar.fecha_ingreso, tr.creado_en, e.fecha_radicacion) AS fecha_envio_real,
              e.fecha_radicacion AS fecha_radicacion_legal,
              (COALESCE(ar.fecha_ingreso, e.fecha_radicacion) < e.fecha_radicacion) AS fuera_de_horario,
              COALESCE(ar.canal_ingreso, 'MESA_VIRTUAL') AS canal_recepcion,
              COALESCE(
                (SELECT MAX(f.folio_fin)
                   FROM sigd_tra.expediente_documento_folio f
                  WHERE f.expediente_id = e.expediente_id),
                (SELECT (nc.cuerpo->>'totalFolios')::int
                   FROM sigd_auth.notificacion_casilla nc
                  WHERE nc.cut = e.codigo_expediente
                  ORDER BY nc.creado_en DESC
                  LIMIT 1),
                1
              ) AS total_folios,
              p.tipo AS tipo_documento,
              COALESCE(p.id_documento, e.dni_solicitante) AS numero_documento,
              COALESCE(pn.nombres, pj.razon_social) AS nombres,
              split_part(COALESCE(pn.apellidos, ''), ' ', 1) AS apellido_paterno,
              NULLIF(btrim(substr(COALESCE(pn.apellidos, ''), length(split_part(COALESCE(pn.apellidos, ''), ' ', 1)) + 1)), '') AS apellido_materno
         FROM sigd_tra.expediente e
         LEFT JOIN sigd_doc.expediente de
                ON de.codigo_expediente = e.codigo_expediente
         LEFT JOIN sigd_doc.tipo_tramite_tupa tt
                ON tt.tipo_tramite_id = de.tipo_tramite_id
         LEFT JOIN sigd_tra.tramite tr
                ON tr.expediente_id = e.expediente_id
         LEFT JOIN sigd_tra.asiento_registro ar
                ON ar.expediente_id = e.expediente_id AND ar.anulado = FALSE
         LEFT JOIN sigd_auth.persona p
                ON p.id_persona = COALESCE(te.solicitante_id, e.solicitante_id)
         LEFT JOIN sigd_auth.persona_natural pn
                ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj
                ON pj.id_persona = p.id_persona
        WHERE e.codigo_expediente = $1
          AND e.estado <> 'ANULADO'
        LIMIT 1`,
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
         JOIN sigd_doc.expediente de ON de.expediente_id = da.expediente_id
        WHERE de.codigo_expediente = $1
        ORDER BY da.nombre_archivo`,
      [cut],
    );
    return resultado.rows.map((fila) => ({
      nombreArchivo: fila.nombre_archivo,
      contentType: fila.content_type,
      hashSha256: fila.hash_sha256,
    }));
  }

  private async leerProveidosPublicos(cliente: PoolClient, cut: string): Promise<DtoProveidoPublico[]> {
    const resultado = await cliente.query<FilaProveido>(
      `SELECT COALESCE(r.numero_resolucion, r.numero_borrador) AS numero,
              COALESCE(r.firmado_en, r.creado_en) AS fecha_emision,
              r.asunto AS resumen
         FROM sigd_doc.resolucion r
         JOIN sigd_doc.expediente de ON de.expediente_id = r.expediente_id
        WHERE de.codigo_expediente = $1
          AND r.estado IN ('FIRMADA', 'NOTIFICADA')
        ORDER BY COALESCE(r.firmado_en, r.creado_en) DESC`,
      [cut],
    );
    return resultado.rows.map((fila) => ({
      numero: fila.numero,
      fechaEmision: aIsoFecha(fila.fecha_emision),
      resumen: fila.resumen,
    }));
  }
}

/** Digitos iniciales que se conservan al enmascarar un documento. */
const VENTANA_INICIAL = 2;

/** Digitos finales que se conservan al enmascarar un documento. */
const VENTANA_FINAL = 3;

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
      const ocultos = '*'.repeat(Math.max(2, componente.length - 1));
      return `${inicial}${ocultos}`;
    })
    .join(' ');
}

function aIsoFecha(valor: Date | string): string {
  return valor instanceof Date ? valor.toISOString() : new Date(valor).toISOString();
}
