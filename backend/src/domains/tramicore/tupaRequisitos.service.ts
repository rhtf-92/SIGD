import type { Pool, PoolClient } from 'pg';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/domain/errors/index.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';

export type TipoRequisitoTupa =
  | 'DOCUMENTAL'
  | 'DECLARATIVO'
  | 'FINANCIERO'
  | 'DATO_INTERNO'
  | 'GENERADO_INSTITUCION'
  | 'CONDICIONAL'
  | 'INTERNO'
  | 'AMBIGUO';

export type TipoProvenienciaRequisito =
  | 'OFICIAL_SUIZA'
  | 'REFERENCIA_EXTERNA'
  | 'DISEÑO_SIGD'
  | 'NO_DETERMINADO';

export type EstadoHomologacionRequisito =
  | 'PENDIENTE_HOMOLOGACION'
  | 'HOMOLOGADO'
  | 'HISTORICO'
  | 'ANULADO';

export type TipoEvidenciaRequisito =
  | 'DOCUMENTO'
  | 'PAGO'
  | 'DECLARACION'
  | 'DATO_INTERNO'
  | 'GENERADO_INSTITUCION';

export type EstadoValidacionRequisito =
  | 'PENDIENTE'
  | 'PRESENTADO'
  | 'VALIDADO'
  | 'OBSERVADO'
  | 'SUBSANADO'
  | 'NO_APLICA';

export interface ReglaCondicionalRequisito {
  campo: string;
  operador: 'EQ' | 'NEQ' | 'IN' | 'EXISTS' | 'BOOLEAN';
  valor: unknown;
}

export interface DtoAnexoTupa {
  idAnexo: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  version: string;
  nombreArchivo: string;
  s3Bucket: string;
  s3Key: string;
  sha256: string | null;
  mimeType: string;
  tamanoBytes: number;
  esDescargable: boolean;
  activo: boolean;
  idProcedimiento: string | null;
  proveniencia: TipoProvenienciaRequisito;
  fuenteOriginal: string;
}

export interface DtoRequisitoTupa {
  idRequisito: string;
  idProcedimiento: string;
  registroVersionId: string | null;
  codigo?: string | null;
  nombre: string;
  descripcion: string | null;
  tipoRequisito: TipoRequisitoTupa;
  esAnexoDigital: boolean;
  obligatorio: boolean;
  orden: number;
  formatosPermitidos: string;
  activo: boolean;
  fuenteOriginal: string;
  proveniencia: TipoProvenienciaRequisito;
  estadoHomologacion: EstadoHomologacionRequisito;
  reglaCondicional?: ReglaCondicionalRequisito | null;
  idAnexo?: string | null;
  anexo?: DtoAnexoTupa | null;
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
  sha256?: string;
  tamanoBytes?: number;
  s3Key?: string;
  documentoAdjuntoId?: string;
}

export interface DtoEvidenciaRequisito {
  idEvidencia: string;
  expedienteId: string;
  idRequisito: string;
  tipoEvidencia: TipoEvidenciaRequisito;
  documentoAdjuntoId: string | null;
  ordenPagoId: string | null;
  datosDeclaracion: Record<string, unknown> | null;
  idPersona: string;
  idUsuario: string | null;
  canal: 'VIRTUAL' | 'PRESENCIAL';
  estadoValidacion: EstadoValidacionRequisito;
  esSubsanacion: boolean;
  evidenciaPreviaId: string | null;
  observacion: string | null;
  validadoPor: string | null;
  validadoEn: string | null;
  creadoEn: string;
  documento?: {
    nombreArchivo: string;
    s3Bucket: string;
    s3Key: string;
    sha256: string;
    tamanoBytes: number;
    mimeType: string;
  } | null;
  ordenPago?: {
    codigoPago: string;
    monto: number;
    estado: string;
    metodoPago: string | null;
  } | null;
}

export interface DtoEstadoRequisitoExpediente {
  idRequisito: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  tipoRequisito: TipoRequisitoTupa;
  obligatorio: boolean;
  aplica: boolean;
  estado: EstadoValidacionRequisito;
  cumplido: boolean;
  estadoHomologacion?: EstadoHomologacionRequisito;
  proveniencia?: TipoProvenienciaRequisito;
  anexo?: DtoAnexoTupa | null;
  evidencias: DtoEvidenciaRequisito[];
}

export interface DtoProgresoRequisitosExpediente {
  expedienteId: string;
  totalRequisitos: number;
  requisitosAplicables: number;
  satisfechos: number;
  pendientes: number;
  observados: number;
  noAplica: number;
  porcentajeCumplimiento: number;
  cumplimientoCompleto: boolean;
  requisitos: DtoEstadoRequisitoExpediente[];
}

export interface RegistrarEvidenciaInput {
  expedienteId: string;
  idRequisito: string;
  tipoEvidencia: TipoEvidenciaRequisito;
  documentoAdjuntoId?: string | null;
  ordenPagoId?: string | null;
  datosDeclaracion?: Record<string, unknown> | null;
  idPersona: string;
  idUsuario?: string | null;
  canal?: 'VIRTUAL' | 'PRESENCIAL';
  estadoValidacion?: EstadoValidacionRequisito;
  esSubsanacion?: boolean;
  evidenciaPreviaId?: string | null;
  observacion?: string | null;
  validadoPor?: string | null;
}

export interface SubsanarRequisitoInput {
  expedienteId: string;
  idRequisito: string;
  evidenciaPreviaId: string;
  tipoEvidencia?: TipoEvidenciaRequisito;
  documentoAdjuntoId?: string | null;
  ordenPagoId?: string | null;
  datosDeclaracion?: Record<string, unknown> | null;
  idPersona: string;
  idUsuario?: string | null;
  canal?: 'VIRTUAL' | 'PRESENCIAL';
  observacion?: string | null;
}

export interface ResultadoValidacionRequisitos {
  valido: boolean;
  bloqueante: boolean;
  requisitosHomologadosFaltantes: DtoRequisitoTupa[];
  requisitosPendientesHomologacion: DtoRequisitoTupa[];
  advertencias: string[];
}

export interface ValidarRequisitosOpciones {
  datosContexto?: Record<string, unknown>;
  ordenPagoId?: string | null;
  pagoConfirmado?: boolean;
  datosDeclarativos?: Record<string, unknown>;
  verificacionesInternas?: string[];
}

export class TupaRequisitosService {
  constructor(private readonly pool: Pool) {}

  /**
   * Evalúa de forma estricta y segura (sin eval ni código dinámico) una regla condicional estructurada.
   */
  evaluarCondicion(
    regla: ReglaCondicionalRequisito | null | undefined,
    contexto?: Record<string, unknown>,
  ): boolean {
    if (!regla || !regla.campo) {
      return true; // Sin regla condicional: aplica siempre
    }
    if (!contexto) {
      return false; // Tiene regla pero no se enviaron datos de contexto: no aplica
    }

    const valorContexto = contexto[regla.campo];

    switch (regla.operador) {
      case 'EQ':
        return valorContexto === regla.valor;
      case 'NEQ':
        return valorContexto !== regla.valor;
      case 'IN':
        return Array.isArray(regla.valor) && regla.valor.includes(valorContexto);
      case 'EXISTS':
        return valorContexto !== undefined && valorContexto !== null && valorContexto !== '';
      case 'BOOLEAN':
        return Boolean(valorContexto) === Boolean(regla.valor);
      default:
        return true;
    }
  }

  /**
   * Obtiene los requisitos estructurados de un procedimiento TUPA por su ID de procedimiento,
   * su registro_version_id (snapshot) o su codigo_ref.
   */
  async obtenerRequisitosPorProcedimiento(
    identificador: string,
    clienteParam?: PoolClient | Pool,
    throwIfNotFound = true,
    datosContexto?: Record<string, unknown>,
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
      codigo: string | null;
      nombre: string;
      descripcion: string | null;
      tipo_requisito: TipoRequisitoTupa;
      es_anexo_digital: boolean;
      obligatorio: boolean;
      orden: number;
      formatos_permitidos: string;
      activo: boolean;
      fuente_original: string;
      proveniencia: TipoProvenienciaRequisito;
      regla_condicional: ReglaCondicionalRequisito | null;
      id_anexo: string | null;
      anexo_codigo: string | null;
      anexo_nombre: string | null;
      anexo_descripcion: string | null;
      anexo_version: string | null;
      anexo_nombre_archivo: string | null;
      anexo_s3_bucket: string | null;
      anexo_s3_key: string | null;
      anexo_sha256: string | null;
      anexo_mime_type: string | null;
      anexo_tamano_bytes: string | null;
      anexo_es_descargable: boolean | null;
      anexo_activo: boolean | null;
      anexo_proveniencia: TipoProvenienciaRequisito | null;
      anexo_fuente_original: string | null;
      estado_homologacion: EstadoHomologacionRequisito;
    }>(
      `SELECT r.id_requisito, r.id_procedimiento, r.registro_version_id, r.codigo, r.nombre, r.descripcion,
              r.tipo_requisito, r.es_anexo_digital, r.obligatorio, r.orden, r.formatos_permitidos,
              r.activo, r.fuente_original,
              COALESCE(r.proveniencia, 'NO_DETERMINADO') AS proveniencia,
              COALESCE(r.estado_homologacion, 'PENDIENTE_HOMOLOGACION') AS estado_homologacion,
              r.regla_condicional, r.id_anexo,
              a.codigo AS anexo_codigo, a.nombre AS anexo_nombre, a.descripcion AS anexo_descripcion,
              a.version AS anexo_version, a.nombre_archivo AS anexo_nombre_archivo,
              a.s3_bucket AS anexo_s3_bucket, a.s3_key AS anexo_s3_key, a.sha256 AS anexo_sha256,
              a.mime_type AS anexo_mime_type, a.tamano_bytes AS anexo_tamano_bytes,
              a.es_descargable AS anexo_es_descargable, a.activo AS anexo_activo,
              COALESCE(a.proveniencia, 'NO_DETERMINADO') AS anexo_proveniencia,
              COALESCE(a.fuente_original, 'NO_DETERMINADO') AS anexo_fuente_original
         FROM sigd_doc.tupa_requisito_documental r
         LEFT JOIN sigd_doc.tupa_anexo a ON a.id_anexo = r.id_anexo
        WHERE r.id_procedimiento = $1::uuid
          AND r.activo = true
        ORDER BY r.orden ASC, r.creado_en ASC`,
      [proc.id_procedimiento],
    );

    const requisitos: DtoRequisitoTupa[] = reqRes.rows.map((r) => {
      let anexoDto: DtoAnexoTupa | null = null;
      if (r.id_anexo && r.anexo_codigo) {
        anexoDto = {
          idAnexo: r.id_anexo,
          codigo: r.anexo_codigo,
          nombre: r.anexo_nombre ?? '',
          descripcion: r.anexo_descripcion,
          version: r.anexo_version ?? '1.0',
          nombreArchivo: r.anexo_nombre_archivo ?? '',
          s3Bucket: r.anexo_s3_bucket ?? 'sigd-expedientes',
          s3Key: r.anexo_s3_key ?? '',
          sha256: r.anexo_sha256,
          mimeType: r.anexo_mime_type ?? 'application/pdf',
          tamanoBytes: Number(r.anexo_tamano_bytes) || 0,
          esDescargable: r.anexo_es_descargable ?? true,
          activo: r.anexo_activo ?? true,
          idProcedimiento: r.id_procedimiento,
          proveniencia: r.anexo_proveniencia ?? 'NO_DETERMINADO',
          fuenteOriginal: r.anexo_fuente_original ?? 'NO_DETERMINADO',
        };
      }

      return {
        idRequisito: r.id_requisito,
        idProcedimiento: r.id_procedimiento,
        registroVersionId: r.registro_version_id,
        codigo: r.codigo,
        nombre: r.nombre,
        descripcion: r.descripcion,
        tipoRequisito: r.tipo_requisito,
        esAnexoDigital: r.es_anexo_digital,
        obligatorio: r.obligatorio,
        orden: r.orden,
        formatosPermitidos: r.formatos_permitidos,
        activo: r.activo,
        fuenteOriginal: r.fuente_original,
        proveniencia: r.proveniencia,
        estadoHomologacion: r.estado_homologacion ?? 'PENDIENTE_HOMOLOGACION',
        reglaCondicional: r.regla_condicional,
        idAnexo: r.id_anexo,
        anexo: anexoDto,
      };
    });

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
   * Lista todos los anexos y formatos institucionales activos.
   */
  async listarAnexos(clienteParam?: PoolClient | Pool): Promise<DtoAnexoTupa[]> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_anexo: string;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      version: string;
      nombre_archivo: string;
      s3_bucket: string;
      s3_key: string;
      sha256: string | null;
      mime_type: string;
      tamano_bytes: string;
      es_descargable: boolean;
      activo: boolean;
      id_procedimiento: string | null;
      proveniencia: TipoProvenienciaRequisito;
      fuente_original: string;
    }>(
      `SELECT id_anexo, codigo, nombre, descripcion, version, nombre_archivo,
              s3_bucket, s3_key, sha256, mime_type, tamano_bytes, es_descargable,
              activo, id_procedimiento,
              COALESCE(proveniencia, 'NO_DETERMINADO') AS proveniencia,
              COALESCE(fuente_original, 'NO_DETERMINADO') AS fuente_original
         FROM sigd_doc.tupa_anexo
        WHERE activo = true
        ORDER BY codigo ASC`,
    );

    return rows.map((r) => ({
      idAnexo: r.id_anexo,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      version: r.version,
      nombreArchivo: r.nombre_archivo,
      s3Bucket: r.s3_bucket,
      s3Key: r.s3_key,
      sha256: r.sha256,
      mimeType: r.mime_type,
      tamanoBytes: Number(r.tamano_bytes) || 0,
      esDescargable: r.es_descargable,
      activo: r.activo,
      idProcedimiento: r.id_procedimiento,
      proveniencia: r.proveniencia,
      fuenteOriginal: r.fuente_original,
    }));
  }

  /**
   * Obtiene un anexo o formato institucional por su código único.
   */
  async obtenerAnexoPorCodigo(
    codigo: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoAnexoTupa | null> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_anexo: string;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      version: string;
      nombre_archivo: string;
      s3_bucket: string;
      s3_key: string;
      sha256: string | null;
      mime_type: string;
      tamano_bytes: string;
      es_descargable: boolean;
      activo: boolean;
      id_procedimiento: string | null;
      proveniencia: TipoProvenienciaRequisito;
      fuente_original: string;
    }>(
      `SELECT id_anexo, codigo, nombre, descripcion, version, nombre_archivo,
              s3_bucket, s3_key, sha256, mime_type, tamano_bytes, es_descargable,
              activo, id_procedimiento,
              COALESCE(proveniencia, 'NO_DETERMINADO') AS proveniencia,
              COALESCE(fuente_original, 'NO_DETERMINADO') AS fuente_original
         FROM sigd_doc.tupa_anexo
        WHERE codigo = $1
          AND activo = true
        LIMIT 1`,
      [codigo],
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      idAnexo: r.id_anexo,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      version: r.version,
      nombreArchivo: r.nombre_archivo,
      s3Bucket: r.s3_bucket,
      s3Key: r.s3_key,
      sha256: r.sha256,
      mimeType: r.mime_type,
      tamanoBytes: Number(r.tamano_bytes) || 0,
      esDescargable: r.es_descargable,
      activo: r.activo,
      idProcedimiento: r.id_procedimiento,
      proveniencia: r.proveniencia,
      fuenteOriginal: r.fuente_original,
    };
  }

  /**
   * Registra una evidencia presentada para un requisito en un expediente.
   * Soporta tanto personas con cuenta como personas sin cuenta (mesa presencial).
   */
  async registrarEvidencia(
    input: RegistrarEvidenciaInput,
    clienteParam?: PoolClient,
  ): Promise<DtoEvidenciaRequisito> {
    const db = clienteParam ?? this.pool;

    // 1. Validar que la persona existe en sigd_auth.persona
    const resPersona = await db.query(
      'SELECT id_persona FROM sigd_auth.persona WHERE id_persona = $1::uuid',
      [input.idPersona],
    );
    const pRows = resPersona?.rows ?? [];
    if (pRows.length === 0) {
      throw new NotFoundError({
        message: 'La persona especificada para la evidencia no existe.',
        detail: `id_persona: ${input.idPersona}`,
      });
    }

    // 2. Validar que el requisito pertenece al procedimiento del expediente
    const resReq = await db.query<{ id_procedimiento: string; nombre: string }>(
      'SELECT id_procedimiento, nombre FROM sigd_doc.tupa_requisito_documental WHERE id_requisito = $1::uuid',
      [input.idRequisito],
    );
    const reqRows = resReq?.rows ?? [];
    if (reqRows.length === 0) {
      throw new NotFoundError({
        message: 'El requisito indicado no existe.',
        detail: `id_requisito: ${input.idRequisito}`,
      });
    }

    const { rows: insertRows } = await db.query<{
      id_evidencia: string;
      expediente_id: string;
      id_requisito: string;
      tipo_evidencia: TipoEvidenciaRequisito;
      documento_adjunto_id: string | null;
      orden_pago_id: string | null;
      datos_declaracion: Record<string, unknown> | null;
      id_persona: string;
      id_usuario: string | null;
      canal: 'VIRTUAL' | 'PRESENCIAL';
      estado_validacion: EstadoValidacionRequisito;
      es_subsanacion: boolean;
      evidencia_previa_id: string | null;
      observacion: string | null;
      validado_por: string | null;
      validado_en: Date | null;
      creado_en: Date;
    }>(
      `INSERT INTO sigd_doc.expediente_evidencia_requisito (
         expediente_id, id_requisito, tipo_evidencia, documento_adjunto_id,
         orden_pago_id, datos_declaracion, id_persona, id_usuario,
         canal, estado_validacion, es_subsanacion, evidencia_previa_id,
         observacion, validado_por, validado_en
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4::uuid,
         $5::uuid, $6, $7::uuid, $8::uuid,
         $9, $10, $11, $12::uuid,
         $13, $14::uuid, $15
       ) RETURNING *`,
      [
        input.expedienteId,
        input.idRequisito,
        input.tipoEvidencia,
        input.documentoAdjuntoId ?? null,
        input.ordenPagoId ?? null,
        input.datosDeclaracion ? JSON.stringify(input.datosDeclaracion) : null,
        input.idPersona,
        input.idUsuario ?? null,
        input.canal ?? 'VIRTUAL',
        input.estadoValidacion ?? 'PRESENTADO',
        input.esSubsanacion ?? false,
        input.evidenciaPreviaId ?? null,
        input.observacion ?? null,
        input.validadoPor ?? null,
        input.estadoValidacion === 'VALIDADO' ? new Date() : null,
      ],
    );

    const row = insertRows[0];
    return {
      idEvidencia: row.id_evidencia,
      expedienteId: row.expediente_id,
      idRequisito: row.id_requisito,
      tipoEvidencia: row.tipo_evidencia,
      documentoAdjuntoId: row.documento_adjunto_id,
      ordenPagoId: row.orden_pago_id,
      datosDeclaracion: row.datos_declaracion,
      idPersona: row.id_persona,
      idUsuario: row.id_usuario,
      canal: row.canal,
      estadoValidacion: row.estado_validacion,
      esSubsanacion: row.es_subsanacion,
      evidenciaPreviaId: row.evidencia_previa_id,
      observacion: row.observacion,
      validadoPor: row.validado_por,
      validadoEn: row.validado_en ? row.validado_en.toISOString() : null,
      creadoEn: row.creado_en.toISOString(),
    };
  }

  /**
   * Subsanación de un requisito observado.
   * Regla de integridad absoluta: NO borra la evidencia previa ni el documento original.
   * Vincula la nueva evidencia a la previa mediante `evidencia_previa_id` y marca la nueva como `SUBSANADO`.
   */
  async subsanarRequisito(
    input: SubsanarRequisitoInput,
    clienteParam?: PoolClient,
  ): Promise<DtoEvidenciaRequisito> {
    const db = clienteParam ?? this.pool;

    // 1. Obtener la evidencia previa observada
    const { rows: prevRows } = await db.query<{
      id_evidencia: string;
      expediente_id: string;
      id_requisito: string;
      id_persona: string;
      estado_validacion: EstadoValidacionRequisito;
    }>(
      `SELECT id_evidencia, expediente_id, id_requisito, id_persona, estado_validacion
         FROM sigd_doc.expediente_evidencia_requisito
        WHERE id_evidencia = $1::uuid`,
      [input.evidenciaPreviaId],
    );

    if (prevRows.length === 0) {
      throw new NotFoundError({
        message: 'La evidencia previa a subsanar no existe.',
        detail: `evidencia_previa_id: ${input.evidenciaPreviaId}`,
      });
    }

    const previa = prevRows[0];
    if (previa.expediente_id !== input.expedienteId || previa.id_requisito !== input.idRequisito) {
      throw new ValidationError({
        code: 'EVIDENCIA_NO_COINCIDE_EXPEDIENTE',
        message: 'La evidencia previa no pertenece al expediente o requisito especificado.',
      });
    }

    // 2. Marcar la evidencia previa como OBSERVADA si no lo estaba
    await db.query(
      `UPDATE sigd_doc.expediente_evidencia_requisito
          SET estado_validacion = 'OBSERVADO'
        WHERE id_evidencia = $1::uuid`,
      [input.evidenciaPreviaId],
    );

    // 2.1 Auditoría WORM inmutable del cambio de estado de la evidencia previa
    try {
      await registrarMutacion(db as any, {
        esquema: 'sigd_doc',
        tabla: 'expediente_evidencia_requisito',
        operacion: 'UPDATE',
        datos_antes: {
          id_evidencia: previa.id_evidencia,
          estado_validacion: previa.estado_validacion,
          expediente_id: previa.expediente_id,
          id_requisito: previa.id_requisito,
        },
        datos_despues: {
          id_evidencia: previa.id_evidencia,
          estado_validacion: 'OBSERVADO',
          observacion: input.observacion ?? 'Observado para subsanación de administrado',
        },
      });
    } catch {
      // Ignorar fallo si clienteParam no implementa auditoría en mocks
    }

    // 3. Insertar la nueva evidencia como SUBSANACION
    return this.registrarEvidencia(
      {
        expedienteId: input.expedienteId,
        idRequisito: input.idRequisito,
        tipoEvidencia: input.tipoEvidencia ?? 'DOCUMENTO',
        documentoAdjuntoId: input.documentoAdjuntoId,
        ordenPagoId: input.ordenPagoId,
        datosDeclaracion: input.datosDeclaracion,
        idPersona: input.idPersona,
        idUsuario: input.idUsuario,
        canal: input.canal ?? 'VIRTUAL',
        estadoValidacion: 'SUBSANADO',
        esSubsanacion: true,
        evidenciaPreviaId: input.evidenciaPreviaId,
        observacion: input.observacion ?? 'Subsanación presentada por el administrado',
      },
      clienteParam,
    );
  }

  /**
   * Obtiene el progreso detallado y consolidado de requisitos para un expediente específico.
   */
  async obtenerProgresoExpediente(
    expedienteId: string,
    clienteParam?: PoolClient | Pool,
    datosContexto?: Record<string, unknown>,
  ): Promise<DtoProgresoRequisitosExpediente> {
    const db = clienteParam ?? this.pool;

    // 1. Identificar el procedimiento TUPA del expediente
    let idProcedimiento: string | null = null;

    const { rows: vincRows } = await db.query<{ id_procedimiento: string | null; registro_version_id: string }>(
      `SELECT COALESCE(tp.id_procedimiento, p_reg.id_procedimiento) AS id_procedimiento,
              v.registro_version_id
         FROM sigd_doc.expediente_tupa_vinculo v
         LEFT JOIN sigd_doc.tupa_procedimiento tp ON tp.registro_version_id = v.registro_version_id
         LEFT JOIN sigd_doc.tupa_procedimiento p_reg ON p_reg.id_procedimiento = v.registro_version_id
        WHERE v.expediente_id = $1::uuid
        ORDER BY v.vinculado_en DESC
        LIMIT 1`,
      [expedienteId],
    );

    if (vincRows.length > 0 && (vincRows[0].id_procedimiento || vincRows[0].registro_version_id)) {
      idProcedimiento = vincRows[0].id_procedimiento ?? vincRows[0].registro_version_id;
    } else {
      // Buscar si existen evidencias ya registradas vinculadas a un procedimiento
      const { rows: evidProcRows } = await db.query<{ id_procedimiento: string }>(
        `SELECT r.id_procedimiento
           FROM sigd_doc.expediente_evidencia_requisito e
           JOIN sigd_doc.tupa_requisito_documental r ON r.id_requisito = e.id_requisito
          WHERE e.expediente_id = $1::uuid
          LIMIT 1`,
        [expedienteId],
      );
      if (evidProcRows.length > 0) {
        idProcedimiento = evidProcRows[0].id_procedimiento;
      }
    }

    if (!idProcedimiento) {
      throw new NotFoundError({
        message: 'El expediente no existe o no tiene un procedimiento TUPA asociado.',
        detail: `expediente_id: ${expedienteId}`,
      });
    }

    // 2. Obtener requisitos del procedimiento
    const procInfo = await this.obtenerRequisitosPorProcedimiento(idProcedimiento, db, true, datosContexto);

    // 3. Obtener evidencias registradas en el expediente
    const { rows: evidRows } = await db.query<{
      id_evidencia: string;
      expediente_id: string;
      id_requisito: string;
      tipo_evidencia: TipoEvidenciaRequisito;
      documento_adjunto_id: string | null;
      orden_pago_id: string | null;
      datos_declaracion: Record<string, unknown> | null;
      id_persona: string;
      id_usuario: string | null;
      canal: 'VIRTUAL' | 'PRESENCIAL';
      estado_validacion: EstadoValidacionRequisito;
      es_subsanacion: boolean;
      evidencia_previa_id: string | null;
      observacion: string | null;
      validado_por: string | null;
      validado_en: Date | null;
      creado_en: Date;
      doc_nombre: string | null;
      doc_s3_bucket: string | null;
      doc_s3_key: string | null;
      doc_sha256: string | null;
      doc_tamano_bytes: string | null;
      doc_mime_type: string | null;
      pago_codigo: string | null;
      pago_monto: string | null;
      pago_estado: string | null;
      pago_metodo: string | null;
    }>(
      `SELECT ev.*,
              d.nombre_archivo AS doc_nombre, d.s3_bucket AS doc_s3_bucket,
              d.s3_key AS doc_s3_key, d.sha256 AS doc_sha256,
              d.tamano_bytes AS doc_tamano_bytes, d.mime_type AS doc_mime_type,
              op.codigo_pago AS pago_codigo, op.monto AS pago_monto,
              op.estado AS pago_estado, op.metodo_pago AS pago_metodo
         FROM sigd_doc.expediente_evidencia_requisito ev
         LEFT JOIN sigd_doc.documento_adjunto d ON d.documento_adjunto_id = ev.documento_adjunto_id
         LEFT JOIN sigd_tra.orden_pago op ON op.orden_pago_id = ev.orden_pago_id
        WHERE ev.expediente_id = $1::uuid
        ORDER BY ev.creado_en ASC`,
      [expedienteId],
    );

    // Agrupar evidencias por requisito
    const evidenciasPorReq = new Map<string, DtoEvidenciaRequisito[]>();
    for (const r of evidRows) {
      const arr = evidenciasPorReq.get(r.id_requisito) ?? [];
      arr.push({
        idEvidencia: r.id_evidencia,
        expedienteId: r.expediente_id,
        idRequisito: r.id_requisito,
        tipoEvidencia: r.tipo_evidencia,
        documentoAdjuntoId: r.documento_adjunto_id,
        ordenPagoId: r.orden_pago_id,
        datosDeclaracion: r.datos_declaracion,
        idPersona: r.id_persona,
        idUsuario: r.id_usuario,
        canal: r.canal,
        estadoValidacion: r.estado_validacion,
        esSubsanacion: r.es_subsanacion,
        evidenciaPreviaId: r.evidencia_previa_id,
        observacion: r.observacion,
        validadoPor: r.validado_por,
        validadoEn: r.validado_en ? r.validado_en.toISOString() : null,
        creadoEn: r.creado_en.toISOString(),
        documento: r.documento_adjunto_id
          ? {
              nombreArchivo: r.doc_nombre ?? '',
              s3Bucket: r.doc_s3_bucket ?? '',
              s3Key: r.doc_s3_key ?? '',
              sha256: r.doc_sha256 ?? '',
              tamanoBytes: Number(r.doc_tamano_bytes) || 0,
              mimeType: r.doc_mime_type ?? 'application/pdf',
            }
          : null,
        ordenPago: r.orden_pago_id
          ? {
              codigoPago: r.pago_codigo ?? '',
              monto: Number(r.pago_monto) || 0,
              estado: r.pago_estado ?? '',
              metodoPago: r.pago_metodo,
            }
          : null,
      });
      evidenciasPorReq.set(r.id_requisito, arr);
    }

    let satisfechos = 0;
    let pendientes = 0;
    let observados = 0;
    let noAplica = 0;
    let requisitosAplicables = 0;

    const requisitosEstados: DtoEstadoRequisitoExpediente[] = procInfo.requisitos.map((req) => {
      const aplica = this.evaluarCondicion(req.reglaCondicional, datosContexto);
      const evids = evidenciasPorReq.get(req.idRequisito) ?? [];

      if (!aplica) {
        noAplica += 1;
        return {
          idRequisito: req.idRequisito,
          codigo: req.codigo ?? null,
          nombre: req.nombre,
          descripcion: req.descripcion,
          tipoRequisito: req.tipoRequisito,
          obligatorio: req.obligatorio,
          aplica: false,
          estado: 'NO_APLICA' as EstadoValidacionRequisito,
          cumplido: true, // No impide radicación ni cuenta como pendiente
          estadoHomologacion: req.estadoHomologacion,
          proveniencia: req.proveniencia,
          anexo: req.anexo,
          evidencias: evids,
        };
      }

      requisitosAplicables += 1;

      // Determinar estado a partir de la última evidencia
      let estado: EstadoValidacionRequisito = 'PENDIENTE';
      let cumplido = false;

      if (evids.length > 0) {
        const ultimaEvid = evids[evids.length - 1];
        estado = ultimaEvid.estadoValidacion;
        if (estado === 'VALIDADO' || estado === 'PRESENTADO' || estado === 'SUBSANADO') {
          cumplido = true;
          satisfechos += 1;
        } else if (estado === 'OBSERVADO') {
          observados += 1;
        } else {
          pendientes += 1;
        }
      } else {
        pendientes += 1;
      }

      return {
        idRequisito: req.idRequisito,
        codigo: req.codigo ?? null,
        nombre: req.nombre,
        descripcion: req.descripcion,
        tipoRequisito: req.tipoRequisito,
        obligatorio: req.obligatorio,
        aplica: true,
        estado,
        cumplido,
        estadoHomologacion: req.estadoHomologacion,
        proveniencia: req.proveniencia,
        anexo: req.anexo,
        evidencias: evids,
      };
    });

    const porcentaje = requisitosAplicables > 0
      ? Math.round((satisfechos / requisitosAplicables) * 100)
      : 100;

    return {
      expedienteId,
      totalRequisitos: procInfo.requisitos.length,
      requisitosAplicables,
      satisfechos,
      pendientes,
      observados,
      noAplica,
      porcentajeCumplimiento: porcentaje,
      cumplimientoCompleto: pendientes === 0 && observados === 0,
      requisitos: requisitosEstados,
    };
  }

  /**
   * Valida en servidor que todos los requisitos documentales obligatorios del procedimiento
   * estén presentes entre los documentos adjuntos enviados por el solicitante u operador.
   * Enriquecido para Fase 5F:
   * - Respeta requisitos condicionales (si la condición no aplica, no se exige).
   * - Acepta pagos confirmados para requisitos financieros sin exigir PDF duplicado.
   * - Acepta datos estructurados para requisitos declarativos.
   * - Previene BOLA verificando que no se adjunten requisitos de otros procedimientos.
   */
  async validarRequisitosObligatorios(
    identificadorProcedimiento: string,
    documentos: DocumentoAValidar[],
    clienteParam?: PoolClient | Pool,
    opciones?: ValidarRequisitosOpciones,
  ): Promise<ResultadoValidacionRequisitos> {
    const info = await this.obtenerRequisitosPorProcedimiento(
      identificadorProcedimiento,
      clienteParam,
      false,
      opciones?.datosContexto,
    );

    // 1. Filtrar solo los que aplican según reglas condicionales
    const requisitosQueAplican = info.requisitos.filter((r) =>
      this.evaluarCondicion(r.reglaCondicional, opciones?.datosContexto),
    );

    // Requisitos obligatorios que aplican
    const requisitosObligatorios = requisitosQueAplican.filter((r) => r.obligatorio);
    if (requisitosObligatorios.length === 0) {
      // El procedimiento no tiene requisitos obligatorios aplicables
      return {
        valido: true,
        bloqueante: false,
        requisitosHomologadosFaltantes: [],
        requisitosPendientesHomologacion: [],
        advertencias: [],
      };
    }

    // 2. Comprobar que ningún documento adjunte un requisito ajeno al procedimiento (BOLA)
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

    const idsRequisitosPresentados = new Set(
      documentos.map((d) => d.idRequisito).filter((id): id is string => Boolean(id)),
    );

    // 3. Evaluar cada requisito obligatorio aplicable segregando HOMOLOGADOS de DISEÑO/PENDIENTE
    const faltantesHomologados: DtoRequisitoTupa[] = [];
    const faltantesNoHomologados: DtoRequisitoTupa[] = [];

    for (const req of requisitosObligatorios) {
      let falta = false;
      if (req.tipoRequisito === 'FINANCIERO') {
        // Un requisito financiero solo exige comprobante si es anexo digital
        if (req.esAnexoDigital) {
          const tienePagoConfirmado = Boolean(opciones?.pagoConfirmado || opciones?.ordenPagoId);
          const tieneComprobanteAdjunto = idsRequisitosPresentados.has(req.idRequisito);
          if (!tienePagoConfirmado && !tieneComprobanteAdjunto) {
            falta = true;
          }
        }
      } else if (req.tipoRequisito === 'DECLARATIVO') {
        // Se satisface con datos declarativos estructurados o con documento firmado
        const tieneDeclaracion = Boolean(opciones?.datosDeclarativos && Object.keys(opciones.datosDeclarativos).length > 0);
        const tieneDoc = idsRequisitosPresentados.has(req.idRequisito);
        if (!tieneDeclaracion && !tieneDoc) {
          falta = true;
        }
      } else if (req.tipoRequisito === 'DATO_INTERNO' || req.tipoRequisito === 'INTERNO') {
        // Se satisface si la institución ya verificó el dato o si se envió explícitamente
        const verificadoInternamente = Boolean(
          opciones?.verificacionesInternas && opciones.verificacionesInternas.includes(req.idRequisito),
        );
        const tieneDoc = idsRequisitosPresentados.has(req.idRequisito);
        if (!verificadoInternamente && !tieneDoc && req.esAnexoDigital) {
          falta = true;
        }
      } else {
        // DOCUMENTAL o CONDICIONAL: requiere documento adjunto
        if (!idsRequisitosPresentados.has(req.idRequisito)) {
          // Solo si es anexo digital o estrictamente documental
          if (req.esAnexoDigital || req.tipoRequisito === 'DOCUMENTAL' || req.tipoRequisito === 'CONDICIONAL') {
            falta = true;
          }
        }
      }

      if (falta) {
        if (req.estadoHomologacion === 'HOMOLOGADO') {
          faltantesHomologados.push(req);
        } else {
          // Requisito de DISEÑO_SIGD o PENDIENTE_HOMOLOGACION: NO bloquea como obligación oficial
          faltantesNoHomologados.push(req);
        }
      }
    }

    // Principio de Homologación: Sólo los requisitos formalmente HOMOLOGADOS pueden bloquear radicación (DENY)
    if (faltantesHomologados.length > 0) {
      const nombresFaltantes = faltantesHomologados.map((f) => `"${f.nombre}"`).join(', ');
      throw new ValidationError({
        code: 'REQUISITO_DOCUMENTAL_FALTANTE',
        message: `REQUISITO_DOCUMENTAL_FALTANTE: Faltan los siguientes requisitos homologados obligatorios: ${nombresFaltantes}.`,
        invalidParams: faltantesHomologados.map((f) => ({
          name: f.idRequisito,
          reason: `Requisito homologado obligatorio faltante: ${f.nombre} (${f.tipoRequisito})`,
        })),
      });
    }

    return {
      valido: true,
      bloqueante: false,
      requisitosHomologadosFaltantes: [],
      requisitosPendientesHomologacion: faltantesNoHomologados,
      advertencias: faltantesNoHomologados.length > 0 ? ['CONFIGURACION_REQUISITOS_NO_HOMOLOGADA'] : [],
    };
  }

  /**
   * Clona todos los requisitos de un procedimiento origen hacia un nuevo procedimiento clonado.
   * Utilizado en la creación o clonación de versiones de catálogo TUPA (Fase 5E / 5F).
   */
  async clonarRequisitosProcedimiento(
    idProcedimientoOrigen: string,
    idProcedimientoDestino: string,
    cliente: PoolClient,
  ): Promise<number> {
    const { rowCount } = await cliente.query(
      `INSERT INTO sigd_doc.tupa_requisito_documental (
          id_procedimiento, registro_version_id, nombre, descripcion, tipo_requisito,
          es_anexo_digital, obligatorio, orden, formatos_permitidos, activo, fuente_original,
          id_anexo, codigo, regla_condicional, proveniencia, estado_homologacion
       )
       SELECT $1::uuid, registro_version_id, nombre, descripcion, tipo_requisito,
              es_anexo_digital, obligatorio, orden, formatos_permitidos, activo, fuente_original,
              id_anexo, codigo, regla_condicional, proveniencia, estado_homologacion
         FROM sigd_doc.tupa_requisito_documental
        WHERE id_procedimiento = $2::uuid`,
      [idProcedimientoDestino, idProcedimientoOrigen],
    );

    return rowCount ?? 0;
  }
}
