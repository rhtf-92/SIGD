import type { Pool, PoolClient } from 'pg';
import { NotFoundError } from '../../shared/domain/errors/index.js';
import type { ConsultaPublicaParams } from './tramites.schemas.js';

/**
 * T-BE-TC-04 · Consulta publica de expediente por CUT con minimizacion de datos.
 *
 * Esquema real: sigd_tra.expediente (codigo_expediente = CUT, estado,
 * fecha_radicacion, tipo_documental_id, solicitante_id) y
 * sigd_tra.asiento_registro (fecha_ingreso, canal_ingreso, asunto, anulado).
 * No existen columnas fecha_envio_real, fecha_radicacion_legal,
 * fuera_de_horario, canal_recepcion ni total_folios en expediente; se derivan
 * del asiento o se devuelven en cero/vacío. sigd_tra.documento_adjunto y
 * sigd_tra.proveido no existen, por lo que documentos y proveidos van vacíos
 * en esta etapa.
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

export interface DtoConsultaPublica {
  cut: string;
  anioFiscal: number;
  estadoTramite: string;
  tipoTramite: string | null;
  unidadOrganica: string | null;
  asunto: string;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  fueraDeHorario: boolean;
  canalRecepcion: string;
  totalFolios: number;
  administrado: {
    documentoEnmascarado: string | null;
    nombreEnmascarado: string | null;
  };
  documentos: DtoDocumentoPublico[];
  proveidos: DtoProveidoPublico[];
  mensajeLegal: string;
}

interface FilaConsulta {
  cut: string;
  estado_tramite: string;
  tipo_tramite: string | null;
  unidad_organica: string | null;
  asunto: string | null;
  fecha_ingreso: Date | null;
  fecha_radicacion: Date;
  canal_ingreso: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
              nombres: string | null;
              apellidos: string | null;
              razon_social: string | null;
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

const VENTANA_ENMASCARADO = 2;
const VENTANA_INICIAL = 2;
const VENTANA_FINAL = 3;

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

      const fechaEnvioReal = expediente.fecha_ingreso ?? expediente.fecha_radicacion;
      const fueraDeHorario = fechaCivilLima(expediente.fecha_radicacion) !== fechaCivilLima(expediente.fecha_ingreso ?? expediente.fecha_radicacion);

      return {
        cut: expediente.cut,
        anioFiscal: Number(expediente.cut.slice(4, 8)) || 0,
        estadoTramite: expediente.estado_tramite,
        tipoTramite: expediente.tipo_tramite,
        unidadOrganica: expediente.unidad_organica,
        asunto: expediente.asunto ?? '',
        fechaEnvioReal: fechaEnvioReal.toISOString(),
        fechaRadicacionLegal: expediente.fecha_radicacion.toISOString(),
        fueraDeHorario,
        canalRecepcion: expediente.canal_ingreso ?? '',
        totalFolios: 0,
        administrado: {
          documentoEnmascarado: enmascararDocumento(expediente.numero_documento),
          nombreEnmascarado: enmascararNombre(
            expediente.nombres,
            expediente.apellidos,
            null,
            expediente.razon_social,
          ),
        },
        documentos,
        proveidos,
        mensajeLegal:
          'Informacion publica pursuant a la Ley N° 29733. Los datos personales han sido ' +
          'enmascarados conforme al principio de minimizacion.',
      };
    } finally {
      cliente.release();
    }
  }

  private async leerExpediente(cliente: PoolClient, cut: string): Promise<FilaConsulta | undefined> {
    const resultado = await cliente.query<FilaConsulta>(
      `SELECT e.codigo_expediente AS cut,
              e.estado AS estado_tramite,
              t.denominacion   AS tipo_tramite,
              t.unidad_organica AS unidad_organica,
              a.asunto,
              a.fecha_ingreso,
              e.fecha_radicacion,
              a.canal_ingreso,
              td.nombre         AS tipo_documento,
              p.id_documento    AS numero_documento,
              pn.nombres,
              pn.apellidos,
              pj.razon_social
         FROM sigd_tra.expediente e
         LEFT JOIN sigd_doc.tipo_documento td
                ON td.tipo_documental_id = e.tipo_documental_id
         LEFT JOIN sigd_doc.tipo_tramite_tupa t
                ON t.codigo = td.codigo
         LEFT JOIN sigd_auth.persona p
                ON p.id_persona = e.solicitante_id
         LEFT JOIN sigd_auth.persona_natural pn
                ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj
                ON pj.id_persona = p.id_persona
         LEFT JOIN sigd_tra.asiento_registro a
                ON a.expediente_id = e.expediente_id
               AND a.anulado = FALSE
        WHERE e.codigo_expediente = $1
        LIMIT 1`,
      [cut],
    );
    return resultado.rows[0];
  }

  private async leerDocumentos(cliente: PoolClient, cut: string): Promise<DtoDocumentoPublico[]> {
    // sigd_doc.documento_adjunto referencia a sigd_doc.expediente, no a
    // sigd_tra.expediente; no hay vinculacion directa en esta etapa.
    return [];
  }

  private async leerProveidosPublicos(cliente: PoolClient, cut: string): Promise<DtoProveidoPublico[]> {
    // sigd_tra.proveido no existe en el esquema real.
    return [];
  }
}

/** Digitos iniciales que se conservan al enmascarar un documento. */
const VENTANA_ENMASCARADO_DOC = 2;

/** Digitos finales que se conservan al enmascarar un documento. */
const VENTANA_FINAL_DOC = 3;

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
  razonSocial: string | null,
): string | null {
  if (razonSocial && razonSocial.trim()) {
    const inicial = razonSocial.trim().charAt(0).toUpperCase();
    const ocultos = '*'.repeat(Math.max(razonSocial.trim().length - 1, 1));
    return `${inicial}${ocultos}`;
  }
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

function aIsoFecha(fecha: Date | string): string {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10);
  return String(fecha).slice(0, 10);
}

/** Fecha civil (YYYY-MM-DD) en zona horaria de America/Lima. */
function fechaCivilLima(fecha: Date | null): string {
  if (!fecha) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}
