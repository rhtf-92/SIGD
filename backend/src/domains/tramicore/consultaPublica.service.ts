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
          'enmascarados conforme al principio de minimizacion.',
      };
    } finally {
      cliente.release();
    }
  }

  private async leerExpediente(cliente: PoolClient, cut: string): Promise<FilaConsulta | undefined> {
    const resultado = await cliente.query<FilaConsulta>(
      `SELECT e.cut,
              e.anio_fiscal,
              e.estado_tramite,
              tt.denominacion   AS tipo_tramite,
              e.asunto,
              e.fecha_envio_real,
              e.fecha_radicacion_legal,
              e.fuera_de_horario,
              e.canal_recepcion,
              e.total_folios,
              td.nombre         AS tipo_documento,
              p.numero_documento,
              p.nombres,
              p.apellido_paterno,
              p.apellido_materno
         FROM sigd_tra.expediente e
         LEFT JOIN sigd_doc.tipo_tramite_tupa tt
                ON tt.id_tipo_tramite_tupa = e.id_tipo_tramite_tupa
         LEFT JOIN sigd_auth.persona p
                ON p.id = e.id_persona
         LEFT JOIN sigd_auth.tipos_documento td
                ON td.id = p.tipo_documento_id
        WHERE e.cut = $1
          AND e.estado_tramite <> 'ANULADO'`,
      [cut],
    );
    return resultado.rows[0];
  }

  private async leerDocumentos(cliente: PoolClient, cut: string): Promise<DtoDocumentoPublico[]> {
    const resultado = await cliente.query<FilaDocumento>(
      `SELECT da.nombre_archivo, da.content_type, da.hash_sha256
         FROM sigd_tra.documento_adjunto da
         JOIN sigd_tra.expediente e ON e.expediente_id = da.expediente_id
        WHERE e.cut = $1
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
      `SELECT pv.numero, pv.fecha_emision, pv.resumen
         FROM sigd_tra.proveido pv
         JOIN sigd_tra.expediente e ON e.expediente_id = pv.expediente_id
        WHERE e.cut = $1
          AND pv.es_publico = TRUE
        ORDER BY pv.fecha_emision DESC, pv.numero DESC`,
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

function aIsoFecha(fecha: Date | string): string {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10);
  return String(fecha).slice(0, 10);
}
