import type { Pool, PoolClient } from 'pg';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

/**
 * Catálogo TUPA versionado (sigd_doc.tupa_registro_version, 08_sigd_tupa_acoplamiento.sql).
 *
 * Reglas canónicas:
 *   * La fuente única de verdad para el flujo versionado es sigd_doc.tupa_registro_version.
 *   * Solo se publican filas con estado_validacion = 'APROBADO'. PENDIENTE_VALIDACION
 *     y RECHAZADO jamás se exponen en el catálogo público.
 *   * La clave canónica es registroVersionId (UUID string).
 *   * Solo se exponen datos físicamente respaldados por la tabla real; no se inventan
 *     plazos, silencios administrativos, autoridades, recursos ni bases legales.
 *   * El vínculo con el expediente se realiza mediante sigd_doc.expediente_tupa_vinculo.
 */

export interface DtoFuenteTupa {
  nombre: string;
  documentoSha256: string;
  pagina: number;
  referenciaFila: string;
}

export interface DtoVigenciaTupa {
  desde: string | null;
  hasta: string | null;
}

export interface DtoVersionTupa {
  etiqueta: string | null;
  revision: number;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
}

export interface DtoRegistroTupaVersionado {
  registroVersionId: string;
  codigoExterno: string | null;
  codigo: string | null;
  denominacion: string;
  monto: string | null;
  requisitos: unknown[] | null;
  fuente: DtoFuenteTupa;
  pagina: number;
  revision: number;
  vigencia: DtoVigenciaTupa;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  version: DtoVersionTupa;
  estadoValidacion: 'APROBADO';
  estado: 'APROBADO';
  referenciaAprobacion: string;
  // Campos legacy para máxima compatibilidad con frontend y clientes existentes
  id: string;
  id_tipo_tramite: string;
}

interface FilaVersion {
  registro_version_id: string;
  codigo_externo: string | null;
  denominacion_original: string;
  requisitos_original: unknown | null;
  monto_original: string | null;
  fuente_nombre: string;
  documento_sha256: string;
  pagina: number;
  referencia_fila: string;
  version_fuente: string | null;
  revision: number;
  vigencia_desde: Date | string | null;
  vigencia_hasta: Date | string | null;
  estado_validacion: string;
  referencia_aprobacion: string | null;
}

export interface DtoContextoTupa {
  registroVersionId: string;
  codigoExterno: string | null;
  codigo: string | null;
  denominacion: string;
  requisitos: unknown[] | null;
  monto: string | null;
  fuente: string;
  pagina: number;
  revision: number;
  version: string | null;
  estadoValidacion: string;
  vinculadoEn: string;
}

/** Contexto TUPA persistido de un expediente (vínculo raíz, no sucesor). */
export interface DtoContextoTupaExpediente {
  tupa: DtoContextoTupa | null;
}

interface FilaVinculo {
  registro_version_id: string;
  codigo_externo: string | null;
  denominacion_original: string;
  requisitos_original: unknown | null;
  monto_original: string | null;
  fuente_nombre: string;
  pagina: number;
  revision: number;
  version_fuente: string | null;
  estado_validacion: string;
  vinculado_en: Date;
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TupaVersionadoService {
  constructor(private readonly pool: Pool) {}

  /** Publica únicamente versiones APROBADO; nunca filas pendientes o rechazadas. */
  async listarAprobados(): Promise<DtoRegistroTupaVersionado[]> {
    const resultado = await this.pool.query<FilaVersion>(
      `SELECT registro_version_id, codigo_externo, denominacion_original,
              requisitos_original, monto_original, fuente_nombre, documento_sha256,
              pagina, referencia_fila, version_fuente, revision,
              vigencia_desde, vigencia_hasta, estado_validacion, referencia_aprobacion
         FROM sigd_doc.tupa_registro_version
        WHERE estado_validacion = 'APROBADO'
        ORDER BY fuente_nombre ASC, pagina ASC, referencia_fila ASC, revision ASC`,
    );
    return resultado.rows.map(mapearVersion);
  }

  /**
   * Valida y obtiene una versión TUPA por su ID canónico.
   * Exige que el UUID tenga formato válido, exista en la BD, esté APROBADO
   * y se encuentre dentro de su período de vigencia (si aplica).
   */
  async obtenerPorId(registroVersionId: string, fechaReferencia: Date = new Date()): Promise<DtoRegistroTupaVersionado> {
    const cliente = await this.pool.connect();
    try {
      return await this.validarYObtenerVersion(cliente, registroVersionId, fechaReferencia);
    } finally {
      cliente.release();
    }
  }

  /**
   * Validación atómica utilizable dentro de una transacción ya abierta.
   */
  async validarYObtenerVersion(
    cliente: PoolClient,
    registroVersionId: string,
    fechaReferencia: Date = new Date(),
  ): Promise<DtoRegistroTupaVersionado> {
    if (!registroVersionId || !REGEX_UUID.test(registroVersionId)) {
      throw new ValidationError({
        invalidParams: [{ name: 'registroVersionId', reason: 'registroVersionId debe ser un UUID válido.' }],
      });
    }

    const resultado = await cliente.query<FilaVersion>(
      `SELECT registro_version_id, codigo_externo, denominacion_original,
              requisitos_original, monto_original, fuente_nombre, documento_sha256,
              pagina, referencia_fila, version_fuente, revision,
              vigencia_desde, vigencia_hasta, estado_validacion, referencia_aprobacion
         FROM sigd_doc.tupa_registro_version
        WHERE registro_version_id = $1::uuid`,
      [registroVersionId],
    );

    const fila = resultado.rows[0];
    if (!fila) {
      throw new NotFoundError({
        message: 'La versión TUPA indicada no existe.',
        detail: `No existe sigd_doc.tupa_registro_version con registroVersionId ${registroVersionId}.`,
      });
    }

    if (fila.estado_validacion !== 'APROBADO') {
      throw new ConflictError({
        code: 'VERSION_TUPA_NO_APROBADA',
        message: 'La versión TUPA indicada no está aprobada.',
        detail: `La versión ${registroVersionId} está en estado ${fila.estado_validacion}; solo se vinculan versiones APROBADO.`,
      });
    }

    // Validación de vigencia
    const hoyStr = fechaReferencia.toISOString().slice(0, 10);
    if (fila.vigencia_desde) {
      const desdeStr = aFechaIso(fila.vigencia_desde);
      if (desdeStr && desdeStr > hoyStr) {
        throw new ConflictError({
          code: 'VERSION_TUPA_FUERA_DE_VIGENCIA',
          message: 'La versión TUPA indicada aún no entra en vigencia.',
          detail: `La versión ${registroVersionId} entra en vigencia el ${desdeStr}.`,
        });
      }
    }

    if (fila.vigencia_hasta) {
      const hastaStr = aFechaIso(fila.vigencia_hasta);
      if (hastaStr && hastaStr < hoyStr) {
        throw new ConflictError({
          code: 'VERSION_TUPA_FUERA_DE_VIGENCIA',
          message: 'La versión TUPA indicada ya no está vigente.',
          detail: `La versión ${registroVersionId} venció el ${hastaStr}.`,
        });
      }
    }

    return mapearVersion(fila);
  }

  /**
   * Contexto TUPA del expediente: el vínculo raíz persistido (uq_vinculo_tupa_raiz_expediente).
   * No se infiere desde asunto, código ni semejanza textual; si el expediente no
   * tiene vínculo, se devuelve { tupa: null }.
   */
  async obtenerContextoExpediente(expedienteId: string): Promise<DtoContextoTupaExpediente> {
    if (!expedienteId || !REGEX_UUID.test(expedienteId)) {
      throw new ValidationError({
        invalidParams: [{ name: 'expedienteId', reason: 'El identificador del expediente debe ser un UUID válido.' }],
      });
    }

    const expediente = await this.pool.query<{ existe: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE expediente_id = $1::uuid) AS existe',
      [expedienteId],
    );
    if (!expediente.rows[0]?.existe) {
      throw new NotFoundError({
        detail: `No existe un expediente con el identificador ${expedienteId}.`,
      });
    }

    const resultado = await this.pool.query<FilaVinculo>(
      `SELECT rv.registro_version_id, rv.codigo_externo, rv.denominacion_original,
              rv.requisitos_original, rv.monto_original, rv.fuente_nombre,
              rv.pagina, rv.revision, rv.version_fuente, rv.estado_validacion,
              v.vinculado_en
         FROM sigd_doc.expediente_tupa_vinculo v
         JOIN sigd_doc.tupa_registro_version rv
           ON rv.registro_version_id = v.registro_version_id
        WHERE v.expediente_id = $1::uuid
          AND v.reemplaza_vinculo_id IS NULL
        ORDER BY v.vinculado_en DESC, v.vinculo_id DESC
        LIMIT 1`,
      [expedienteId],
    );
    const fila = resultado.rows[0];
    if (!fila) return { tupa: null };

    return {
      tupa: {
        registroVersionId: fila.registro_version_id,
        codigoExterno: fila.codigo_externo,
        codigo: fila.codigo_externo,
        denominacion: fila.denominacion_original,
        requisitos: esArreglo(fila.requisitos_original) ? fila.requisitos_original : null,
        monto: fila.monto_original,
        fuente: fila.fuente_nombre,
        pagina: fila.pagina,
        revision: fila.revision,
        version: fila.version_fuente,
        estadoValidacion: fila.estado_validacion,
        vinculadoEn: fila.vinculado_en.toISOString(),
      },
    };
  }
}

function esArreglo(valor: unknown): valor is unknown[] {
  return Array.isArray(valor);
}

function aFechaIso(fecha: Date | string | null): string | null {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10);
  return String(fecha).slice(0, 10);
}

function mapearVersion(fila: FilaVersion): DtoRegistroTupaVersionado {
  const desde = aFechaIso(fila.vigencia_desde);
  const hasta = aFechaIso(fila.vigencia_hasta);

  return {
    registroVersionId: fila.registro_version_id,
    codigoExterno: fila.codigo_externo,
    codigo: fila.codigo_externo,
    denominacion: fila.denominacion_original,
    requisitos: esArreglo(fila.requisitos_original) ? fila.requisitos_original : null,
    monto: fila.monto_original,
    fuente: {
      nombre: fila.fuente_nombre,
      documentoSha256: fila.documento_sha256,
      pagina: fila.pagina,
      referenciaFila: fila.referencia_fila,
    },
    pagina: fila.pagina,
    revision: fila.revision,
    vigencia: {
      desde,
      hasta,
    },
    vigenciaDesde: desde,
    vigenciaHasta: hasta,
    version: {
      etiqueta: fila.version_fuente,
      revision: fila.revision,
      vigenciaDesde: desde,
      vigenciaHasta: hasta,
    },
    estadoValidacion: 'APROBADO',
    estado: 'APROBADO',
    referenciaAprobacion: fila.referencia_aprobacion ?? '',
    id: fila.registro_version_id,
    id_tipo_tramite: fila.registro_version_id,
  };
}
