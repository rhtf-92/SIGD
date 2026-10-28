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
 * Se expone el estado procesal. El esquema vigente no clasifica proveidos
 * publicos, por lo que esa coleccion permanece vacia.
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
  numero_documento: string | null;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
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
      `SELECT e.codigo_expediente AS cut,
              EXTRACT(YEAR FROM e.fecha_radicacion)::int AS anio_fiscal,
              COALESCE(rut.estado_nuevo, e.estado) AS estado_tramite,
              tv.denominacion_original AS tipo_tramite,
              tr.asunto,
              COALESCE(ar.fecha_ingreso, e.fecha_radicacion) AS fecha_envio_real,
              e.fecha_radicacion AS fecha_radicacion_legal,
              (ar.fecha_ingreso IS NOT NULL AND ar.fecha_ingreso < e.fecha_radicacion) AS fuera_de_horario,
              COALESCE(ar.canal_ingreso, 'MESA_VIRTUAL') AS canal_recepcion,
              COALESCE((SELECT MAX(f.folio_fin) FROM sigd_tra.expediente_documento_folio f
                         WHERE f.expediente_id = e.expediente_id), 0)::int AS total_folios,
              p.id_documento AS numero_documento,
              pn.nombres,
              split_part(pn.apellidos, ' ', 1) AS apellido_paterno,
              NULLIF(substring(pn.apellidos FROM position(' ' IN pn.apellidos) + 1), pn.apellidos) AS apellido_materno
         FROM sigd_tra.expediente e
         JOIN sigd_tra.tramite tr ON tr.expediente_id = e.expediente_id
         JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_rut.estado_actual_expediente rut ON rut.expediente_id = e.expediente_id
         LEFT JOIN LATERAL (
           SELECT a.fecha_ingreso, a.canal_ingreso, a.anulado
             FROM sigd_tra.asiento_registro a
            WHERE a.expediente_id = e.expediente_id
            ORDER BY a.fecha_ingreso ASC LIMIT 1
         ) ar ON TRUE
         LEFT JOIN LATERAL (
           SELECT v.denominacion_original
             FROM sigd_doc.expediente_tupa_vinculo x
             JOIN sigd_doc.tupa_registro_version v ON v.registro_version_id = x.registro_version_id
            WHERE x.expediente_id = e.expediente_id
            ORDER BY x.vinculado_en DESC LIMIT 1
         ) tv ON TRUE
        WHERE e.codigo_expediente = $1
          AND e.estado <> 'ANULADO'
          AND COALESCE(ar.anulado, FALSE) = FALSE`,
      [cut],
    );
    return resultado.rows[0];
  }

  private async leerDocumentos(cliente: PoolClient, cut: string): Promise<DtoDocumentoPublico[]> {
    void cliente;
    void cut;
    // No existe una FK documental hacia sigd_tra.expediente en el DDL vigente.
    // Un nombre/hash declarado al radicar no prueba que el binario esté persistido.
    return [];
  }

  private async leerProveidosPublicos(cliente: PoolClient, cut: string): Promise<DtoProveidoPublico[]> {
    void cliente;
    void cut;
    // El esquema vigente no tiene proveídos con clasificación pública.
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
