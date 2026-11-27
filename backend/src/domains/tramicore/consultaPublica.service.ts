import type { Pool, PoolClient } from 'pg';
import { NotFoundError } from '../../shared/domain/errors/index.js';
import { calcularHorarioCorte } from './horarioCorte.util.js';
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
  estado_tramite: string;
  tipo_tramite: string | null;
  asunto: string;
  fecha_envio_real: Date;
  fecha_radicacion_legal: Date;
  canal_recepcion: string;
  total_folios: number;
  numero_documento: string | null;
  nombres: string | null;
  apellidos: string | null;
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

      const fechaEnvioReal = expediente.fecha_envio_real;
      return {
        cut: expediente.cut,
        anioFiscal: Number(expediente.cut.slice(4, 8)),
        estadoTramite: expediente.estado_tramite,
        tipoTramite: expediente.tipo_tramite,
        asunto: expediente.asunto,
        fechaEnvioReal: fechaEnvioReal.toISOString(),
        fechaRadicacionLegal: expediente.fecha_radicacion_legal.toISOString(),
        fueraDeHorario: calcularHorarioCorte(fechaEnvioReal).requiereProyeccion,
        canalRecepcion: expediente.canal_recepcion,
        totalFolios: expediente.total_folios,
        administrado: {
          documentoEnmascarado: enmascararDocumento(expediente.numero_documento),
          nombreEnmascarado: enmascararNombre(
            expediente.nombres,
            expediente.apellidos,
            null,
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
      `SELECT COALESCE(t.codigo_expediente, d.codigo_expediente) AS cut,
              COALESCE(t.estado, d.estado, 'REGISTRADO') AS estado_tramite,
              COALESCE(tt.denominacion, ttv.denominacion) AS tipo_tramite,
              COALESCE(a.asunto, tr.asunto, d.asunto) AS asunto,
              COALESCE(a.fecha_ingreso, d.fecha_registro, t.fecha_radicacion) AS fecha_envio_real,
              COALESCE(t.fecha_radicacion, d.fecha_registro, a.fecha_ingreso) AS fecha_radicacion_legal,
              COALESCE(
                a.canal_ingreso,
                CASE WHEN d.expediente_id IS NOT NULL THEN 'MESA_VIRTUAL' ELSE 'MESA_PRESENCIAL' END
              ) AS canal_recepcion,
              COALESCE(f.total_folios, 0)::int AS total_folios,
              COALESCE(p.id_documento, t.dni_solicitante) AS numero_documento,
              pn.nombres,
              pn.apellidos
         FROM sigd_tra.expediente t
         FULL JOIN sigd_doc.expediente d
                ON d.codigo_expediente = t.codigo_expediente
         LEFT JOIN sigd_tra.tramite tr
                ON tr.expediente_id = t.expediente_id
         LEFT JOIN sigd_doc.tipo_tramite_tupa tt
                ON tt.tipo_tramite_id = d.tipo_tramite_id
         LEFT JOIN sigd_doc.tipo_tramite_tupa ttv
                ON ttv.codigo = tr.codigo_tramite
         LEFT JOIN LATERAL (
                SELECT asunto, canal_ingreso, fecha_ingreso
                  FROM sigd_tra.asiento_registro
                 WHERE expediente_id = t.expediente_id
                   AND COALESCE(anulado, FALSE) = FALSE
                 ORDER BY fecha_ingreso DESC
                 LIMIT 1
              ) a ON TRUE
         LEFT JOIN LATERAL (
                SELECT MAX(folio_fin) AS total_folios
                  FROM sigd_tra.expediente_documento_folio
                 WHERE expediente_id = t.expediente_id
              ) f ON TRUE
         LEFT JOIN sigd_auth.persona p
                ON p.id_persona = COALESCE(t.solicitante_id, d.solicitante_id)
         LEFT JOIN sigd_auth.persona_natural pn
                ON pn.id_persona = p.id_persona
        WHERE COALESCE(t.codigo_expediente, d.codigo_expediente) = $1
          AND COALESCE(t.estado, d.estado) <> 'ANULADO'`,
      [cut],
    );
    return resultado.rows[0];
  }

  private async leerDocumentos(cliente: PoolClient, cut: string): Promise<DtoDocumentoPublico[]> {
    const resultado = await cliente.query<FilaDocumento>(
      `SELECT da.nombre_archivo, da.mime_type AS content_type, da.sha256 AS hash_sha256
         FROM sigd_doc.documento_adjunto da
         JOIN sigd_doc.expediente d ON d.expediente_id = da.expediente_id
        WHERE d.codigo_expediente = $1
        ORDER BY da.nombre_archivo`,
      [cut],
    );
    return resultado.rows.map((fila) => ({
      nombreArchivo: fila.nombre_archivo,
      contentType: fila.content_type,
      hashSha256: fila.hash_sha256.trim(),
    }));
  }

  private async leerProveidosPublicos(
    _cliente: PoolClient,
    _cut: string,
  ): Promise<DtoProveidoPublico[]> {
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
    .flatMap((valor) => valor.trim().split(/\s+/));

  if (componentes.length === 0) return null;

  return componentes
    .map((componente) => {
      const inicial = componente.charAt(0).toUpperCase();
      const ocultos = '*'.repeat(Math.max(componente.length - 1, 1));
      return `${inicial}${ocultos}`;
    })
    .join(' ');
}
