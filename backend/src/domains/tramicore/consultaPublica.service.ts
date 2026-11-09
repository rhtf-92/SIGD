import type { Pool, PoolClient } from 'pg';
import { NotFoundError } from '../../shared/domain/errors/index.js';
import type { ConsultaPublicaParams } from './tramites.schemas.js';
import { calcularHorarioCorte } from './horarioCorte.util.js';
import { crearProveedorFeriados, type ProveedorFeriados } from './radicacionVirtual.service.js';

/**
 * T-BE-TC-04 · Consulta pública de expediente por CUT con minimización de datos.
 *
 * Principio rector: el endpoint #16 se invoca sin credenciales, por lo que jamás
 * debe proyectar datos de contacto del administrado. La Ley N.° 29733 obliga a
 * restringir el tratamiento a la finalidad para la que se recolectó, y una
 * consulta de expediente no incluye el teléfono particular ni el correo
 * personal del estudiante. Este servicio devuelve un DTO cerrado: si un campo
 * sensible no está en la lista, no sale.
 *
 * Se expone el estado procesal y únicamente los proveídos marcados como
 * públicos por el área correspondiente.
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
  /** Datos del administrado enmascarados; nunca el valor íntegro. */
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
  asunto: string;
  tipo_tramite: string | null;
  fecha_envio_real: Date;
  fecha_radicacion_legal: Date;
  canal_recepcion: string;
  total_folios: number;
  numero_documento: string | null;
  nombres: string | null;
  apellidos: string | null;
  nombre_completo: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  razon_social?: string | null;
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
  private readonly obtenerFeriados: ProveedorFeriados;

  constructor(private readonly pool: Pool, obtenerFeriados?: ProveedorFeriados) {
    this.obtenerFeriados = obtenerFeriados ?? crearProveedorFeriados(pool);
  }

  async consultarPorCut(params: ConsultaPublicaParams): Promise<DtoConsultaPublica> {
    const cliente = await this.pool.connect();
    try {
      const expediente = await this.leerExpediente(cliente, params.cut);
      if (!expediente) {
        throw new NotFoundError({
          message: 'No existe un expediente con el CUT consultado.',
          detail:
            'No se encontró ningún expediente vigente con ese CUT. Si el expediente fue ' +
            'anulado se responde igual, para no confirmar la existencia de un CUT cancelado.',
        });
      }

      const feriados = await this.obtenerFeriados().catch(() => []);
      const envioRealDate = expediente.fecha_envio_real instanceof Date
        ? expediente.fecha_envio_real
        : new Date(expediente.fecha_envio_real);
      const horario = calcularHorarioCorte(envioRealDate, feriados);

      const [documentos, proveidos] = await Promise.all([
        this.leerDocumentos(cliente, params.cut),
        this.leerProveidosPublicos(cliente, params.cut),
      ]);

      const anioFiscal = parseInt(expediente.cut.split('-')[1], 10) || horario.envioReal.getFullYear();
      const fueraDeHorario = horario.requiereProyeccion;

      let mensajeLegal = 'Radicación dentro del horario de atención presencial (Lunes a Viernes de 08:00 a 16:30 hrs). El cómputo de plazos comienza de inmediato.';
      if (horario.diaNoHabil) {
        mensajeLegal = `Recibido en día no hábil (la atención presencial es de Lunes a Viernes hasta las 4:30 pm). Por Art. 138 de la LPAG el cómputo de plazos comienza el ${horario.fechaLegal} a las 08:00.`;
      } else if (horario.despuesDelCorte) {
        mensajeLegal = `Recibido después del horario de corte de atención presencial (4:30 pm). Por Art. 138 de la LPAG el cómputo de plazos comienza el ${horario.fechaLegal} a las 08:00.`;
      }

      const fechaRadicacionLegal = expediente.fecha_radicacion_legal instanceof Date
        ? expediente.fecha_radicacion_legal.toISOString()
        : (expediente.fecha_radicacion_legal ? new Date(expediente.fecha_radicacion_legal).toISOString() : horario.radicacionLegal.toISOString());

      return {
        cut: expediente.cut,
        anioFiscal,
        estadoTramite: expediente.estado_tramite || 'REGISTRADO',
        tipoTramite: expediente.tipo_tramite || 'Trámite General',
        asunto: expediente.asunto,
        fechaEnvioReal: envioRealDate.toISOString(),
        fechaRadicacionLegal,
        fueraDeHorario,
        canalRecepcion: expediente.canal_recepcion || 'MESA_VIRTUAL',
        totalFolios: Number(expediente.total_folios) || 1,
        administrado: {
          documentoEnmascarado: enmascararDocumento(expediente.numero_documento),
          nombreEnmascarado: enmascararNombre(
            expediente.nombre_completo || expediente.nombres,
            expediente.apellidos || expediente.apellido_paterno,
            expediente.apellido_materno,
          ),
        },
        documentos,
        proveidos,
        mensajeLegal,
      };
    } finally {
      cliente.release();
    }
  }

  private async leerExpediente(cliente: PoolClient, cut: string): Promise<FilaConsulta | undefined> {
    const resultado = await cliente.query<FilaConsulta>(
      `SELECT COALESCE(e.codigo_expediente, de.codigo_expediente) AS cut,
              COALESCE(e.estado, de.estado, 'REGISTRADO')         AS estado_tramite,
              COALESCE(de.asunto, ar.asunto, 'Trámite Institucional') AS asunto,
              tt.denominacion                                      AS tipo_tramite,
              COALESCE(ar.fecha_ingreso, de.fecha_registro, e.fecha_radicacion) AS fecha_envio_real,
              COALESCE(e.fecha_radicacion, de.fecha_registro)      AS fecha_radicacion_legal,
              COALESCE(ar.canal_ingreso, 'MESA_VIRTUAL')           AS canal_recepcion,
              COALESCE(
                (SELECT MAX(folio_fin) FROM sigd_tra.expediente_documento_folio edf WHERE edf.expediente_id = COALESCE(e.expediente_id, de.expediente_id)),
                (SELECT COUNT(*)::int FROM sigd_doc.documento_adjunto da WHERE da.expediente_id = COALESCE(de.expediente_id, e.expediente_id)),
                1
              )                                                    AS total_folios,
              COALESCE(e.dni_solicitante, p.id_documento)         AS numero_documento,
              pn.nombres,
              pn.apellidos,
              pn.nombre_completo,
              pj.razon_social
         FROM sigd_tra.expediente e
         FULL OUTER JOIN sigd_doc.expediente de
                ON de.codigo_expediente = e.codigo_expediente
         LEFT JOIN sigd_doc.tipo_tramite_tupa tt
                ON tt.tipo_tramite_id = de.tipo_tramite_id
         LEFT JOIN sigd_tra.asiento_registro ar
                ON ar.expediente_id = COALESCE(e.expediente_id, de.expediente_id)
         LEFT JOIN sigd_auth.persona p
                ON p.id_persona = COALESCE(e.solicitante_id, de.solicitante_id)
         LEFT JOIN sigd_auth.persona_natural pn
                ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj
                ON pj.id_persona = p.id_persona
        WHERE (COALESCE(e.codigo_expediente, de.codigo_expediente) = $1 OR e.numero = $1)
          AND COALESCE(e.estado, de.estado) <> 'ANULADO'
        ORDER BY ar.fecha_ingreso DESC NULLS LAST
        LIMIT 1`,
      [cut],
    );
    return resultado.rows[0];
  }

  private async leerDocumentos(cliente: PoolClient, cut: string): Promise<DtoDocumentoPublico[]> {
    const resultado = await cliente.query<FilaDocumento>(
      `SELECT da.nombre_archivo,
              da.mime_type   AS content_type,
              da.sha256      AS hash_sha256
         FROM sigd_doc.documento_adjunto da
         JOIN sigd_doc.expediente de ON de.expediente_id = da.expediente_id
        WHERE de.codigo_expediente = $1
        UNION
       SELECT da.nombre_archivo,
              da.mime_type   AS content_type,
              da.sha256      AS hash_sha256
         FROM sigd_doc.documento_adjunto da
         JOIN sigd_tra.expediente e ON e.expediente_id = da.expediente_id
        WHERE e.codigo_expediente = $1
        ORDER BY nombre_archivo`,
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
      `SELECT COALESCE(r.numero_resolucion, r.numero_borrador, 'ACTO-OFICIAL') AS numero,
              COALESCE(r.firmado_en, r.creado_en) AS fecha_emision,
              r.asunto AS resumen
         FROM sigd_doc.resolucion r
         JOIN sigd_doc.expediente de ON de.expediente_id = r.expediente_id
        WHERE de.codigo_expediente = $1
          AND r.estado IN ('FIRMADA', 'NOTIFICADA')
        ORDER BY r.firmado_en DESC NULLS LAST, r.numero_resolucion DESC`,
      [cut],
    );
    return resultado.rows.map((fila) => ({
      numero: fila.numero,
      fechaEmision: aIsoFecha(fila.fecha_emision),
      resumen: fila.resumen,
    }));
  }
}

/** Dígitos iniciales que se conservan al enmascarar un documento. */
const VENTANA_INICIAL = 2;

/** Dígitos finales que se conservan al enmascarar un documento. */
const VENTANA_FINAL = 3;

/**
 * Enmascara un documento de identidad conservando solo los extremos, con la
 * forma `45***123` que fija la especificación de T-BE-TC-04.
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
  apellidoPaterno: string | null = null,
  apellidoMaterno: string | null = null,
): string | null {
  const apPaternoLimpio = apellidoPaterno && apellidoPaterno !== 'REGISTRADO' ? apellidoPaterno : null;
  const apMaternoLimpio = apellidoMaterno && apellidoMaterno !== 'REGISTRADO' ? apellidoMaterno : null;

  let componentes: string[] = [];
  if (apPaternoLimpio || apMaternoLimpio) {
    componentes = [nombres, apPaternoLimpio, apMaternoLimpio]
      .filter((valor): valor is string => Boolean(valor && valor.trim()))
      .map((valor) => valor.trim().split(/\s+/)[0]);
  } else if (nombres && nombres.trim()) {
    componentes = nombres.trim().split(/\s+/);
  }

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
