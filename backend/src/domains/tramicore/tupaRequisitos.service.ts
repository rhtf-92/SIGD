import type { Pool, PoolClient } from 'pg';
import { NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

export type TipoRequisitoTupa = 'DOCUMENTAL' | 'FINANCIERO' | 'DECLARATIVO' | 'INTERNO' | 'AMBIGUO';

export interface DtoRequisitoTupa {
  idRequisito: string;
  idProcedimiento: string;
  registroVersionId: string | null;
  nombre: string;
  descripcion: string | null;
  tipoRequisito: TipoRequisitoTupa;
  esAnexoDigital: boolean;
  obligatorio: boolean;
  orden: number;
  formatosPermitidos: string;
  activo: boolean;
  fuenteOriginal: string;
}

export interface DtoRequisitosProcedimiento {
  procedimientoId: string;
  codigoRef: string;
  denominacion: string;
  generaExpediente: boolean;
  totalRequisitos: number;
  totalAnexosDigitales: number;
  totalAnexosObligatorios: number;
  requisitos: DtoRequisitoTupa[];
  anexosDigitales: DtoRequisitoTupa[];
}

export interface DocumentoAValidar {
  idRequisito?: string;
  nombreArchivo: string;
}

export class TupaRequisitosService {
  constructor(private readonly pool: Pool) {}

  /**
   * Obtiene los requisitos estructurados de un procedimiento TUPA por su ID de procedimiento,
   * su registro_version_id (snapshot) o su codigo_ref.
   */
  async obtenerRequisitosPorProcedimiento(
    identificador: string,
    clienteParam?: PoolClient | Pool,
    throwIfNotFound = true,
  ): Promise<DtoRequisitosProcedimiento> {
    const db = clienteParam ?? this.pool;
    if (!db || typeof db.query !== 'function') {
      return {
        procedimientoId: identificador,
        codigoRef: 'TUPA',
        denominacion: 'Procedimiento TUPA',
        generaExpediente: true,
        totalRequisitos: 0,
        totalAnexosDigitales: 0,
        totalAnexosObligatorios: 0,
        requisitos: [],
        anexosDigitales: [],
      };
    }

    const procRes = await db.query<{
      id_procedimiento: string;
      codigo_ref: string;
      denominacion: string;
      genera_expediente: boolean;
      registro_version_id: string | null;
    }>(
      `SELECT p.id_procedimiento, p.codigo_ref, p.denominacion, p.genera_expediente, p.registro_version_id
         FROM sigd_doc.tupa_procedimiento p
        WHERE p.id_procedimiento::text = $1
           OR p.registro_version_id::text = $1
           OR p.codigo_ref = $1
        LIMIT 1`,
      [identificador],
    );

    let proc = procRes?.rows?.[0];
    if (!proc) {
      let regRes: { rows: Array<{ registro_version_id: string; codigo_externo: string | null; denominacion_original: string }> } = { rows: [] };
      try {
        const queryPromise = db.query<{
          registro_version_id: string;
          codigo_externo: string | null;
          denominacion_original: string;
        }>(
          `SELECT registro_version_id, codigo_externo, denominacion_original
             FROM sigd_doc.tupa_registro_version
            WHERE registro_version_id::text = $1
            LIMIT 1`,
          [identificador],
        );
        if (queryPromise && typeof (queryPromise as any).then === 'function') {
          regRes = await queryPromise;
        }
      } catch {
        regRes = { rows: [] };
      }

      if (regRes?.rows?.[0]) {
        proc = {
          id_procedimiento: regRes.rows[0].registro_version_id,
          codigo_ref: regRes.rows[0].codigo_externo || 'TUPA',
          denominacion: regRes.rows[0].denominacion_original,
          genera_expediente: true,
          registro_version_id: regRes.rows[0].registro_version_id,
        };
      }
    }

    if (!proc) {
      if (throwIfNotFound) {
        throw new NotFoundError({
          message: 'Procedimiento TUPA no encontrado.',
          detail: `No se encontró procedimiento TUPA con identificador '${identificador}'.`,
        });
      }
      return {
        procedimientoId: identificador,
        codigoRef: 'TUPA',
        denominacion: 'Procedimiento TUPA',
        generaExpediente: true,
        totalRequisitos: 0,
        totalAnexosDigitales: 0,
        totalAnexosObligatorios: 0,
        requisitos: [],
        anexosDigitales: [],
      };
    }

    const reqRes = await db.query<{
      id_requisito: string;
      id_procedimiento: string;
      registro_version_id: string | null;
      nombre: string;
      descripcion: string | null;
      tipo_requisito: TipoRequisitoTupa;
      es_anexo_digital: boolean;
      obligatorio: boolean;
      orden: number;
      formatos_permitidos: string;
      activo: boolean;
      fuente_original: string;
    }>(
      `SELECT id_requisito, id_procedimiento, registro_version_id, nombre, descripcion,
              tipo_requisito, es_anexo_digital, obligatorio, orden, formatos_permitidos,
              activo, fuente_original
         FROM sigd_doc.tupa_requisito_documental
        WHERE id_procedimiento = $1::uuid
          AND activo = true
        ORDER BY orden ASC, creado_en ASC`,
      [proc.id_procedimiento],
    );

    const requisitos: DtoRequisitoTupa[] = reqRes.rows.map((r) => ({
      idRequisito: r.id_requisito,
      idProcedimiento: r.id_procedimiento,
      registroVersionId: r.registro_version_id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      tipoRequisito: r.tipo_requisito,
      esAnexoDigital: r.es_anexo_digital,
      obligatorio: r.obligatorio,
      orden: r.orden,
      formatosPermitidos: r.formatos_permitidos,
      activo: r.activo,
      fuenteOriginal: r.fuente_original,
    }));

    const anexosDigitales = requisitos.filter((r) => r.esAnexoDigital);
    const anexosObligatorios = anexosDigitales.filter((r) => r.obligatorio);

    return {
      procedimientoId: proc.id_procedimiento,
      codigoRef: proc.codigo_ref,
      denominacion: proc.denominacion,
      generaExpediente: proc.genera_expediente,
      totalRequisitos: requisitos.length,
      totalAnexosDigitales: anexosDigitales.length,
      totalAnexosObligatorios: anexosObligatorios.length,
      requisitos,
      anexosDigitales,
    };
  }

  /**
   * Valida en servidor que todos los requisitos documentales obligatorios del procedimiento
   * estén presentes entre los documentos adjuntos enviados por el solicitante u operador.
   */
  async validarRequisitosObligatorios(
    identificadorProcedimiento: string,
    documentos: DocumentoAValidar[],
    clienteParam?: PoolClient | Pool,
  ): Promise<void> {
    const info = await this.obtenerRequisitosPorProcedimiento(identificadorProcedimiento, clienteParam, false);

    const requisitosObligatorios = info.anexosDigitales.filter((r) => r.obligatorio);
    if (requisitosObligatorios.length === 0) {
      // El procedimiento no tiene requisitos documentales obligatorios específicos en el TUPA oficial
      return;
    }

    const idsRequisitosPresentados = new Set(
      documentos.map((d) => d.idRequisito).filter((id): id is string => Boolean(id)),
    );

    // Comprobar que ningún documento adjunte un requisito ajeno al procedimiento
    const idsRequisitosPermitidos = new Set(info.requisitos.map((r) => r.idRequisito));
    for (const doc of documentos) {
      if (doc.idRequisito && !idsRequisitosPermitidos.has(doc.idRequisito)) {
        throw new ValidationError({
          code: 'REQUISITO_AJENO_PROCEDIMIENTO',
          message: 'REQUISITO_AJENO_PROCEDIMIENTO: Se adjuntó un requisito que no pertenece al procedimiento TUPA seleccionado.',
          invalidParams: [
            {
              name: 'idRequisito',
              reason: `El requisito ${doc.idRequisito} no pertenece al procedimiento ${info.codigoRef} (${info.denominacion}).`,
            },
          ],
        });
      }
    }

    const faltantes = requisitosObligatorios.filter(
      (req) => !idsRequisitosPresentados.has(req.idRequisito),
    );

    if (faltantes.length > 0) {
      const nombresFaltantes = faltantes.map((f) => `"${f.nombre}"`).join(', ');
      throw new ValidationError({
        code: 'REQUISITO_DOCUMENTAL_FALTANTE',
        message: `REQUISITO_DOCUMENTAL_FALTANTE: Faltan los siguientes documentos obligatorios: ${nombresFaltantes}.`,
        invalidParams: faltantes.map((f) => ({
          name: f.idRequisito,
          reason: `Requisito documental obligatorio faltante: ${f.nombre}`,
        })),
      });
    }
  }
}
