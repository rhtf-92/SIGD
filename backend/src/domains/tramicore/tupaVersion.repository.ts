import type { Pool, PoolClient } from 'pg';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

export type EstadoTupaVersion = 'BORRADOR' | 'PENDIENTE_VALIDACION' | 'VIGENTE' | 'HISTORICO' | 'ANULADO';

export interface FilaTupaVersion {
  id_version: string;
  codigo: string;
  denominacion: string;
  anio: number;
  estado: EstadoTupaVersion;
  resolucion_aprobacion: string | null;
  fecha_aprobacion: string | null;
  total_procedimientos: number;
  periodo_documento: string | null;
  uit_vigente: number | string | null;
  fuente_documental: string | null;
  documento_oficial_key?: string | null;
  documento_oficial_nombre?: string | null;
  documento_oficial_sha256?: string | null;
  documento_oficial_mime?: string | null;
  documento_oficial_tamano?: number | string | null;
  documento_oficial_fecha_carga?: string | null;
  documento_oficial_cargado_por?: string | null;
  cargado_por_nombre?: string | null;
  cargado_por_usuario?: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface FilaHistorialDocumentoOficial {
  id_historial: string;
  upload_id: string | null;
  id_version: string;
  storage_key: string;
  nombre_archivo: string;
  sha256: string;
  mime_type: string;
  tamano_bytes: number | string;
  cargado_por: string | null;
  cargado_por_nombre?: string | null;
  cargado_por_usuario?: string | null;
  motivo_cambio: string | null;
  creado_en: string;
}

export interface AsociarDocumentoOficialDTO {
  uploadId: string;
  storageKey: string;
  nombreArchivo: string;
  sha256: string;
  mimeType?: string;
  tamanoBytes: number;
  cargadoPor?: string | null;
  motivoCambio?: string | null;
}

export interface CargaDocumentoOficial {
  upload_id: string;
  id_version: string;
  storage_key: string;
  nombre_archivo: string;
  emitido_por: string;
  estado: 'PENDIENTE' | 'CONFIRMADO';
}

export type TipoOrigenCampo = 'OFICIAL' | 'DEFAULT' | 'PROPUESTA' | 'REFERENCIA';

export interface FilaTupaProcedimiento {
  id_procedimiento: string;
  id_version: string;
  codigo_ref: string;
  codigo_externo: string | null;
  denominacion: string;
  categoria: string;
  tipo_formulario: string;
  monto: string | number;
  unidad_cobro: string;
  plazo_dias: number;
  plazo_fuente: TipoOrigenCampo | null;
  requisitos: string[] | unknown[];
  genera_expediente: boolean;
  calificacion: string;
  calificacion_fuente: TipoOrigenCampo | null;
  canal_presentacion: string | null;
  unidad_receptora_id: string | null;
  unidad_responsable_id: string | null;
  unidad_resolutiva_id: string | null;
  unidad_financiera_id: string | null;
  intervencion_financiera: string | null;
  registro_version_id: string | null;
  activo: boolean;
  orden: number;
  creado_en: string;
  actualizado_en: string;
}

export interface CrearVersionDTO {
  anio: number;
  denominacion: string;
  resolucionAprobacion?: string;
  clonarDeIdVersion?: string;
}

export interface ActualizarProcedimientoDTO {
  denominacion?: string;
  monto?: number;
  plazoDias?: number;
  requisitos?: string[];
  categoria?: string;
  tipoFormulario?: string;
  plazoFuente?: TipoOrigenCampo;
  calificacionFuente?: TipoOrigenCampo;
  canalPresentacion?: string | null;
  unidadReceptoraId?: string | null;
  unidadResponsableId?: string | null;
  unidadResolutivaId?: string | null;
  unidadFinancieraId?: string | null;
  intervencionFinanciera?: string | null;
}

export interface FilaTarifaVariante {
  id_tarifa_variante: string;
  id_procedimiento: string;
  id_registro_version: string;
  codigo_variante: string;
  nombre_variante: string;
  descripcion: string | null;
  monto: number | string;
  moneda: string;
  orden: number;
  fuente: TipoOrigenCampo;
  creado_en: string;
  actualizado_en: string;
}

export interface InsertarTarifaVarianteDTO {
  id_procedimiento: string;
  id_registro_version: string;
  codigo_variante: string;
  nombre_variante: string;
  descripcion?: string | null;
  monto: number;
  moneda?: string;
  orden?: number;
  fuente: TipoOrigenCampo;
}

export interface FilaCampoProcedencia {
  id_procedencia: string;
  id_procedimiento: string;
  id_registro_version: string;
  campo_nombre: string;
  valor: string | null;
  fuente: TipoOrigenCampo;
  evidencia: string | null;
  creado_en: string;
}

export interface InsertarCampoProcedenciaDTO {
  id_procedimiento: string;
  id_registro_version: string;
  campo_nombre: string;
  valor?: string | null;
  fuente: TipoOrigenCampo;
  evidencia?: string | null;
}

export interface FilaVinculoConSnapshot {
  vinculo_id: string;
  expediente_id: string;
  registro_version_id: string;
  vinculado_en: string;
  reemplaza_vinculo_id: string | null;
  motivo: string | null;
  tupa_codigo: string | null;
  tupa_anio: number | null;
  codigo_ref: string | null;
  denominacion_snapshot: string | null;
  monto_efectivo: number | string | null;
  tarifa_variante_codigo: string | null;
  tarifa_variante_nombre: string | null;
  plazo_dias_snapshot: number | null;
  calificacion_snapshot: string | null;
  canal_presentacion: string | null;
  unidad_receptora_id: string | null;
  unidad_receptora_codigo: string | null;
  unidad_receptora_nombre: string | null;
  unidad_responsable_id: string | null;
  unidad_responsable_codigo: string | null;
  unidad_responsable_nombre: string | null;
  unidad_resolutiva_id: string | null;
  unidad_resolutiva_codigo: string | null;
  unidad_resolutiva_nombre: string | null;
  fuente_datos: unknown | null;
}

export interface FilaHistorialDocumentoOficial {
  id_historial: string;
  upload_id: string | null;
  id_version: string;
  storage_key: string;
  nombre_archivo: string;
  sha256: string;
  mime_type: string;
  tamano_bytes: number | string;
  cargado_por: string | null;
  cargado_por_nombre?: string | null;
  cargado_por_usuario?: string | null;
  motivo_cambio: string | null;
  creado_en: string;
}

export interface AsociarDocumentoOficialDTO {
  uploadId: string;
  storageKey: string;
  nombreArchivo: string;
  sha256: string;
  mimeType?: string;
  tamanoBytes: number;
  cargadoPor?: string | null;
  motivoCambio?: string | null;
}

export interface CargaDocumentoOficial {
  upload_id: string;
  id_version: string;
  storage_key: string;
  nombre_archivo: string;
  emitido_por: string;
  estado: 'PENDIENTE' | 'CONFIRMADO';
}

export interface FilaTupaProcedimiento {
  id_procedimiento: string;
  id_version: string;
  codigo_ref: string;
  codigo_externo: string | null;
  denominacion: string;
  categoria: string;
  tipo_formulario: string;
  monto: string | number;
  unidad_cobro: string;
  plazo_dias: number;
  requisitos: string[] | unknown[];
  genera_expediente: boolean;
  calificacion: string;
  registro_version_id: string | null;
  activo: boolean;
  orden: number;
  creado_en: string;
  actualizado_en: string;
}

export interface CrearVersionDTO {
  anio: number;
  denominacion: string;
  resolucionAprobacion?: string;
  clonarDeIdVersion?: string;
}

export interface ActualizarProcedimientoDTO {
  denominacion?: string;
  monto?: number;
  plazoDias?: number;
  requisitos?: string[];
  categoria?: string;
  tipoFormulario?: string;
}

export class TupaVersionRepository {
  constructor(private readonly pool: Pool) {}

  async listarVersiones(): Promise<FilaTupaVersion[]> {
    const res = await this.pool.query<FilaTupaVersion>(
      `SELECT v.id_version, v.codigo, v.denominacion, v.anio, v.estado,
              v.resolucion_aprobacion, v.fecha_aprobacion, v.total_procedimientos,
              v.periodo_documento, v.uit_vigente, v.fuente_documental,
              v.documento_oficial_key, v.documento_oficial_nombre, v.documento_oficial_sha256,
              v.documento_oficial_mime, v.documento_oficial_tamano, v.documento_oficial_fecha_carga,
              v.documento_oficial_cargado_por,
              u.usuario AS cargado_por_usuario,
              COALESCE(pn.nombre_completo, pj.razon_social, u.usuario) AS cargado_por_nombre,
              v.creado_en, v.actualizado_en
         FROM sigd_doc.tupa_version v
    LEFT JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = v.documento_oficial_cargado_por
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = u.id_persona
    LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = u.id_persona
        ORDER BY v.anio DESC`,
    );
    return res.rows;
  }

  async obtenerVersionVigente(): Promise<FilaTupaVersion | null> {
    const res = await this.pool.query<FilaTupaVersion>(
      `SELECT v.id_version, v.codigo, v.denominacion, v.anio, v.estado,
              v.resolucion_aprobacion, v.fecha_aprobacion, v.total_procedimientos,
              v.periodo_documento, v.uit_vigente, v.fuente_documental,
              v.documento_oficial_key, v.documento_oficial_nombre, v.documento_oficial_sha256,
              v.documento_oficial_mime, v.documento_oficial_tamano, v.documento_oficial_fecha_carga,
              v.documento_oficial_cargado_por,
              u.usuario AS cargado_por_usuario,
              COALESCE(pn.nombre_completo, pj.razon_social, u.usuario) AS cargado_por_nombre,
              v.creado_en, v.actualizado_en
         FROM sigd_doc.tupa_version v
    LEFT JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = v.documento_oficial_cargado_por
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = u.id_persona
    LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = u.id_persona
        WHERE v.estado = 'VIGENTE'
        LIMIT 1`,
    );
    return res.rows[0] ?? null;
  }

  async obtenerVersionPorId(idVersion: string): Promise<FilaTupaVersion | null> {
    const res = await this.pool.query<FilaTupaVersion>(
      `SELECT v.id_version, v.codigo, v.denominacion, v.anio, v.estado,
              v.resolucion_aprobacion, v.fecha_aprobacion, v.total_procedimientos,
              v.periodo_documento, v.uit_vigente, v.fuente_documental,
              v.documento_oficial_key, v.documento_oficial_nombre, v.documento_oficial_sha256,
              v.documento_oficial_mime, v.documento_oficial_tamano, v.documento_oficial_fecha_carga,
              v.documento_oficial_cargado_por,
              u.usuario AS cargado_por_usuario,
              COALESCE(pn.nombre_completo, pj.razon_social, u.usuario) AS cargado_por_nombre,
              v.creado_en, v.actualizado_en
         FROM sigd_doc.tupa_version v
    LEFT JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = v.documento_oficial_cargado_por
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = u.id_persona
    LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = u.id_persona
        WHERE v.id_version = $1::uuid`,
      [idVersion],
    );
    return res.rows[0] ?? null;
  }

  async listarProcedimientosPorVersion(idVersion: string): Promise<FilaTupaProcedimiento[]> {
    const res = await this.pool.query<FilaTupaProcedimiento>(
      `SELECT id_procedimiento, id_version, codigo_ref, codigo_externo,
              denominacion, categoria, tipo_formulario, monto, unidad_cobro,
              plazo_dias, plazo_fuente, requisitos, genera_expediente, calificacion,
              calificacion_fuente, canal_presentacion,
              unidad_receptora_id, unidad_responsable_id, unidad_resolutiva_id,
              unidad_financiera_id, intervencion_financiera,
              registro_version_id, activo, orden, creado_en, actualizado_en
         FROM sigd_doc.tupa_procedimiento
        WHERE id_version = $1::uuid AND activo = true
        ORDER BY orden ASC, codigo_ref ASC`,
      [idVersion],
    );
    return res.rows;
  }

  async listarProcedimientosVigentes(aprobadosSolo: boolean = false): Promise<FilaTupaProcedimiento[]> {
    const vigente = await this.obtenerVersionVigente();
    if (!vigente) return [];

    let query = `
      SELECT id_procedimiento, id_version, codigo_ref, codigo_externo,
             denominacion, categoria, tipo_formulario, monto, unidad_cobro,
             plazo_dias, plazo_fuente, requisitos, genera_expediente, calificacion,
             calificacion_fuente, canal_presentacion,
             unidad_receptora_id, unidad_responsable_id, unidad_resolutiva_id,
             unidad_financiera_id, intervencion_financiera,
             registro_version_id, activo, orden, creado_en, actualizado_en
        FROM sigd_doc.tupa_procedimiento
       WHERE id_version = $1::uuid AND activo = true
    `;
    const params: unknown[] = [vigente.id_version];

    if (aprobadosSolo) {
      query += ` AND genera_expediente = true`;
    }

    query += ` ORDER BY orden ASC, codigo_ref ASC`;

    const res = await this.pool.query<FilaTupaProcedimiento>(query, params);
    return res.rows;
  }

  async crearVersionBorrador(dto: CrearVersionDTO): Promise<FilaTupaVersion> {
    if (!dto.anio || dto.anio < 2026 || dto.anio > 2050) {
      throw new ValidationError({
        invalidParams: [{ name: 'anio', reason: 'El año del TUPA debe ser válido (>= 2026).' }],
      });
    }

    const codigo = `TUPA-${dto.anio}`;

    const existente = await this.pool.query(
      `SELECT id_version FROM sigd_doc.tupa_version WHERE anio = $1 OR codigo = $2`,
      [dto.anio, codigo],
    );
    if (existente.rowCount && existente.rowCount > 0) {
      throw new ConflictError({
        message: `Ya existe una versión registrada para el año ${dto.anio}.`,
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const resVersion = await cliente.query<FilaTupaVersion>(
        `INSERT INTO sigd_doc.tupa_version (codigo, denominacion, anio, estado, resolucion_aprobacion, periodo_documento, uit_vigente, fuente_documental)
         VALUES ($1, $2, $3, 'BORRADOR', $4, NULL, NULL, NULL)
         RETURNING *`,
        [codigo, dto.denominacion, dto.anio, dto.resolucionAprobacion ?? null],
      );
      const nuevaVersion = resVersion.rows[0];

      // Si se solicita clonar de una versión previa
      let total = 0;
      if (dto.clonarDeIdVersion) {
        const procClonar = await cliente.query<FilaTupaProcedimiento>(
          `SELECT codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
                  monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
                  registro_version_id, activo, orden
             FROM sigd_doc.tupa_procedimiento
            WHERE id_version = $1::uuid
            ORDER BY orden ASC`,
          [dto.clonarDeIdVersion],
        );

        for (const p of procClonar.rows) {
          await cliente.query(
            `INSERT INTO sigd_doc.tupa_procedimiento (
                id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
                monto, unidad_cobro, plazo_dias, requisitos, genera_expediente, calificacion,
                registro_version_id, activo, orden
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              nuevaVersion.id_version,
              p.codigo_ref,
              p.codigo_externo,
              p.denominacion,
              p.categoria,
              p.tipo_formulario,
              p.monto,
              p.unidad_cobro,
              p.plazo_dias,
              JSON.stringify(p.requisitos || []),
              p.genera_expediente,
              p.calificacion,
              p.registro_version_id,
              p.activo,
              p.orden,
            ],
          );
        }
        total = procClonar.rowCount ?? 0;

        await cliente.query(
          `UPDATE sigd_doc.tupa_version SET total_procedimientos = $1 WHERE id_version = $2::uuid`,
          [total, nuevaVersion.id_version],
        );
        nuevaVersion.total_procedimientos = total;
      }

      await cliente.query('COMMIT');
      return nuevaVersion;
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally {
      cliente.release();
    }
  }

  async actualizarProcedimiento(
    idProcedimiento: string,
    datos: ActualizarProcedimientoDTO,
  ): Promise<FilaTupaProcedimiento> {
    const proc = await this.pool.query<FilaTupaProcedimiento & { estado_version: string }>(
      `SELECT p.*, v.estado as estado_version
         FROM sigd_doc.tupa_procedimiento p
         JOIN sigd_doc.tupa_version v ON v.id_version = p.id_version
        WHERE p.id_procedimiento = $1::uuid`,
      [idProcedimiento],
    );

    if (!proc.rows[0]) {
      throw new NotFoundError({ message: 'Procedimiento no encontrado.' });
    }

    if (proc.rows[0].estado_version === 'HISTORICO') {
      throw new ConflictError({ message: 'No se pueden modificar procedimientos de una versión histórica archivada.' });
    }

    const updates: string[] = [];
    const params: unknown[] = [idProcedimiento];

    if (datos.denominacion !== undefined) {
      params.push(datos.denominacion);
      updates.push(`denominacion = $${params.length}`);
    }
    if (datos.monto !== undefined) {
      params.push(datos.monto);
      updates.push(`monto = $${params.length}`);
    }
    if (datos.plazoDias !== undefined) {
      params.push(datos.plazoDias);
      updates.push(`plazo_dias = $${params.length}`);
    }
    if (datos.plazoFuente !== undefined) {
      params.push(datos.plazoFuente);
      updates.push(`plazo_fuente = $${params.length}`);
    }
    if (datos.requisitos !== undefined) {
      params.push(JSON.stringify(datos.requisitos));
      updates.push(`requisitos = $${params.length}::jsonb`);
    }
    if (datos.calificacionFuente !== undefined) {
      params.push(datos.calificacionFuente);
      updates.push(`calificacion_fuente = $${params.length}`);
    }
    if (datos.categoria !== undefined) {
      params.push(datos.categoria);
      updates.push(`categoria = $${params.length}`);
    }
    if (datos.tipoFormulario !== undefined) {
      params.push(datos.tipoFormulario);
      updates.push(`tipo_formulario = $${params.length}`);
    }
    if (datos.canalPresentacion !== undefined) {
      params.push(datos.canalPresentacion);
      updates.push(`canal_presentacion = $${params.length}`);
    }
    if (datos.unidadReceptoraId !== undefined) {
      params.push(datos.unidadReceptoraId);
      updates.push(`unidad_receptora_id = $${params.length}`);
    }
    if (datos.unidadResponsableId !== undefined) {
      params.push(datos.unidadResponsableId);
      updates.push(`unidad_responsable_id = $${params.length}`);
    }
    if (datos.unidadResolutivaId !== undefined) {
      params.push(datos.unidadResolutivaId);
      updates.push(`unidad_resolutiva_id = $${params.length}`);
    }
    if (datos.unidadFinancieraId !== undefined) {
      params.push(datos.unidadFinancieraId);
      updates.push(`unidad_financiera_id = $${params.length}`);
    }
    if (datos.intervencionFinanciera !== undefined) {
      params.push(datos.intervencionFinanciera);
      updates.push(`intervencion_financiera = $${params.length}`);
    }

    if (updates.length === 0) {
      return proc.rows[0];
    }

    updates.push(`actualizado_en = now()`);

    const res = await this.pool.query<FilaTupaProcedimiento>(
      `UPDATE sigd_doc.tupa_procedimiento
          SET ${updates.join(', ')}
        WHERE id_procedimiento = $1::uuid
        RETURNING *`,
      params,
    );
    return res.rows[0];
  }

  async publicarVersion(idVersion: string): Promise<FilaTupaVersion> {
    const version = await this.obtenerVersionPorId(idVersion);
    if (!version) {
      throw new NotFoundError({ message: 'Versión TUPA no encontrada.' });
    }
    if (version.estado === 'VIGENTE') {
      return version;
    }
    if (version.estado === 'HISTORICO' || version.estado === 'ANULADO') {
      throw new ConflictError({
        message: `No se puede activar una versión en estado ${version.estado}.`,
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      // Advisory lock para evitar doble activación concurrente
      await cliente.query('SELECT pg_advisory_xact_lock($1)', [987654330]);

      // 1. Archivar la versión vigente actual
      await cliente.query(
        `UPDATE sigd_doc.tupa_version
            SET estado = 'HISTORICO', actualizado_en = now()
          WHERE estado = 'VIGENTE'`,
      );

      // 2. Activar la versión seleccionada (misma fila, ya validada por obtenerVersionPorId)
      const res = await cliente.query<FilaTupaVersion>(
        `UPDATE sigd_doc.tupa_version
            SET estado = 'VIGENTE',
                fecha_aprobacion = COALESCE(fecha_aprobacion, CURRENT_DATE),
                actualizado_en = now()
          WHERE id_version = $1::uuid
          RETURNING *`,
        [idVersion],
      );

      if (!res.rows[0]) {
        throw new ConflictError({
          message: `La versión candidato no se pudo activar. Verifique que su estado sea BORRADOR o PENDIENTE_VALIDACION.`,
        });
      }

      await cliente.query('COMMIT');
      return res.rows[0];
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally {
      cliente.release();
    }
  }

  async asociarDocumentoOficial(
    idVersion: string,
    dto: AsociarDocumentoOficialDTO,
  ): Promise<FilaTupaVersion> {
    const version = await this.obtenerVersionPorId(idVersion);
    if (!version) {
      throw new NotFoundError({ message: 'Versión TUPA no encontrada.' });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const consumida = await cliente.query(
        `UPDATE sigd_doc.tupa_documento_oficial_upload
            SET estado = 'CONFIRMADO', confirmado_en = now()
          WHERE upload_id = $1::uuid AND id_version = $2::uuid
            AND storage_key = $3 AND nombre_archivo = $4
            AND emitido_por = $5::uuid AND estado = 'PENDIENTE'
          RETURNING upload_id`,
        [dto.uploadId, idVersion, dto.storageKey, dto.nombreArchivo, dto.cargadoPor],
      );
      if (consumida.rowCount !== 1) {
        throw new ConflictError({ message: 'Carga oficial no emitida, ya confirmada o no correspondiente a esta versión y usuario.' });
      }

      // 1. Registrar entrada en historial de auditoría
      await cliente.query(
        `INSERT INTO sigd_doc.tupa_documento_oficial_historial (
            id_version, storage_key, nombre_archivo, sha256, mime_type, tamano_bytes, cargado_por, motivo_cambio, upload_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          idVersion,
          dto.storageKey,
          dto.nombreArchivo,
          dto.sha256.toLowerCase(),
          dto.mimeType ?? 'application/pdf',
          dto.tamanoBytes,
          dto.cargadoPor ?? null,
          dto.motivoCambio ?? 'Asociación de copia oficial escaneada',
          dto.uploadId,
        ],
      );

      // 2. Actualizar metadatos de documento oficial en la versión
      await cliente.query(
        `UPDATE sigd_doc.tupa_version
            SET documento_oficial_key = $1,
                documento_oficial_nombre = $2,
                documento_oficial_sha256 = $3,
                documento_oficial_mime = $4,
                documento_oficial_tamano = $5,
                documento_oficial_fecha_carga = now(),
                documento_oficial_cargado_por = $6,
                actualizado_en = now()
          WHERE id_version = $7::uuid`,
        [
          dto.storageKey,
          dto.nombreArchivo,
          dto.sha256.toLowerCase(),
          dto.mimeType ?? 'application/pdf',
          dto.tamanoBytes,
          dto.cargadoPor ?? null,
          idVersion,
        ],
      );

      await cliente.query('COMMIT');
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally {
      cliente.release();
    }

    const versionActualizada = await this.obtenerVersionPorId(idVersion);
    return versionActualizada!;
  }

  async obtenerHistorialDocumentoOficial(idVersion: string): Promise<FilaHistorialDocumentoOficial[]> {
    const res = await this.pool.query<FilaHistorialDocumentoOficial>(
      `SELECT h.id_historial, h.upload_id, h.id_version, h.storage_key, h.nombre_archivo,
              h.sha256, h.mime_type, h.tamano_bytes, h.cargado_por,
              u.usuario AS cargado_por_usuario,
              COALESCE(pn.nombre_completo, pj.razon_social, u.usuario) AS cargado_por_nombre,
              h.motivo_cambio, h.creado_en
         FROM sigd_doc.tupa_documento_oficial_historial h
    LEFT JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = h.cargado_por
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = u.id_persona
    LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = u.id_persona
        WHERE h.id_version = $1::uuid
        ORDER BY h.creado_en DESC`,
      [idVersion],
    );
    return res.rows;
  }

  async emitirCargaDocumentoOficial(carga: Omit<CargaDocumentoOficial, 'estado'>): Promise<void> {
    await this.pool.query(
      `INSERT INTO sigd_doc.tupa_documento_oficial_upload
        (upload_id, id_version, storage_key, nombre_archivo, emitido_por)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid)`,
      [carga.upload_id, carga.id_version, carga.storage_key, carga.nombre_archivo, carga.emitido_por],
    );
  }

  async obtenerCargaDocumentoOficial(uploadId: string): Promise<CargaDocumentoOficial | null> {
    const res = await this.pool.query<CargaDocumentoOficial>(
      `SELECT upload_id, id_version, storage_key, nombre_archivo, emitido_por, estado
         FROM sigd_doc.tupa_documento_oficial_upload WHERE upload_id = $1::uuid`,
      [uploadId],
    );
    return res.rows[0] ?? null;
  }

  async obtenerDocumentoHistorico(idVersion: string, idHistorial: string): Promise<FilaHistorialDocumentoOficial | null> {
    const res = await this.pool.query<FilaHistorialDocumentoOficial>(
      `SELECT id_historial, upload_id, id_version, storage_key, nombre_archivo,
              sha256, mime_type, tamano_bytes, cargado_por, motivo_cambio, creado_en
         FROM sigd_doc.tupa_documento_oficial_historial
        WHERE id_version = $1::uuid AND id_historial = $2::uuid`,
      [idVersion, idHistorial],
    );
    return res.rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Tarifas variantes
  // ---------------------------------------------------------------------------

  async listarTarifasVariante(idProcedimiento: string): Promise<FilaTarifaVariante[]> {
    const res = await this.pool.query<FilaTarifaVariante>(
      `SELECT tarifa.id_tarifa_variante, tarifa.id_procedimiento, tarifa.id_registro_version,
              tarifa.codigo_variante, tarifa.nombre_variante, tarifa.descripcion, tarifa.monto, tarifa.moneda,
              tarifa.orden, tarifa.fuente, tarifa.creado_en, tarifa.actualizado_en
         FROM sigd_doc.tupa_tarifa_variante tarifa
         JOIN sigd_doc.tupa_procedimiento procedimiento
           ON procedimiento.id_procedimiento = tarifa.id_procedimiento
          AND procedimiento.registro_version_id = tarifa.id_registro_version
         JOIN sigd_doc.tupa_version version ON version.id_version = procedimiento.id_version
        WHERE tarifa.id_procedimiento = $1::uuid
          AND procedimiento.activo = TRUE
          AND version.estado = 'VIGENTE'
        ORDER BY tarifa.orden ASC, tarifa.codigo_variante ASC`,
      [idProcedimiento],
    );
    return res.rows;
  }

  async insertarTarifaVariante(datos: InsertarTarifaVarianteDTO): Promise<FilaTarifaVariante> {
    return this.ejecutarEnVersionBorrador(
      datos.id_procedimiento,
      datos.id_registro_version,
      async (cliente) => {
        const res = await cliente.query<FilaTarifaVariante>(
          `INSERT INTO sigd_doc.tupa_tarifa_variante (
                id_procedimiento, id_registro_version, codigo_variante, nombre_variante,
                descripcion, monto, moneda, orden, fuente
             ) VALUES (
                $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9
             )
             RETURNING *`,
          [
            datos.id_procedimiento,
            datos.id_registro_version,
            datos.codigo_variante,
            datos.nombre_variante,
            datos.descripcion ?? null,
            datos.monto,
            datos.moneda ?? 'PEN',
            datos.orden ?? 0,
            datos.fuente,
          ],
        );
        const tarifa = res.rows[0];
        if (!tarifa) {
          throw new ConflictError({ message: 'No se pudo registrar la tarifa variante.' });
        }
        return tarifa;
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Procedencia de campos
  // ---------------------------------------------------------------------------

  async insertarCampoProcedencia(datos: InsertarCampoProcedenciaDTO): Promise<FilaCampoProcedencia> {
    return this.ejecutarEnVersionBorrador(
      datos.id_procedimiento,
      datos.id_registro_version,
      async (cliente) => {
        const res = await cliente.query<FilaCampoProcedencia>(
          `INSERT INTO sigd_doc.tupa_campo_procedencia (
                id_procedimiento, id_registro_version, campo_nombre, valor, fuente, evidencia
             ) VALUES (
                $1::uuid, $2::uuid, $3, $4, $5, $6
             )
             RETURNING *`,
          [
            datos.id_procedimiento,
            datos.id_registro_version,
            datos.campo_nombre,
            datos.valor ?? null,
            datos.fuente,
            datos.evidencia ?? null,
          ],
        );
        const procedencia = res.rows[0];
        if (!procedencia) {
          throw new ConflictError({ message: 'No se pudo registrar la procedencia del campo TUPA.' });
        }
        return procedencia;
      },
    );
  }

  private async ejecutarEnVersionBorrador<T>(
    idProcedimiento: string,
    idRegistroVersion: string,
    insertar: (cliente: PoolClient) => Promise<T>,
  ): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const vinculacion = await cliente.query<{ estado_version: string }>(
        `SELECT v.estado AS estado_version
           FROM sigd_doc.tupa_procedimiento p
           JOIN sigd_doc.tupa_version v ON v.id_version = p.id_version
          WHERE p.id_procedimiento = $1::uuid
            AND p.registro_version_id = $2::uuid
          FOR UPDATE OF v`,
        [idProcedimiento, idRegistroVersion],
      );
      const version = vinculacion.rows[0];
      if (!version) {
        throw new ValidationError({
          message: 'El procedimiento no pertenece a la versión de registro indicada.',
          invalidParams: [
            { name: 'id_procedimiento', reason: 'Procedimiento no asociado a este registro_version.' },
            { name: 'id_registro_version', reason: 'Registro de versión no coincide con el procedimiento.' },
          ],
        });
      }
      if (version.estado_version !== 'BORRADOR') {
        throw new ConflictError({
          message: 'Solo se pueden registrar tarifas o procedencias en una versión TUPA en borrador.',
        });
      }

      const resultado = await insertar(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async listarCamposProcedencia(idProcedimiento: string, idRegistroVersion?: string): Promise<FilaCampoProcedencia[]> {
    if (idRegistroVersion) {
      const res = await this.pool.query<FilaCampoProcedencia>(
        `SELECT id_procedencia, id_procedimiento, id_registro_version,
                campo_nombre, valor, fuente, evidencia, creado_en
           FROM sigd_doc.tupa_campo_procedencia
          WHERE id_procedimiento = $1::uuid AND id_registro_version = $2::uuid
          ORDER BY campo_nombre ASC`,
        [idProcedimiento, idRegistroVersion],
      );
      return res.rows;
    }
    const res = await this.pool.query<FilaCampoProcedencia>(
      `SELECT id_procedencia, id_procedimiento, id_registro_version,
              campo_nombre, valor, fuente, evidencia, creado_en
         FROM sigd_doc.tupa_campo_procedencia
        WHERE id_procedimiento = $1::uuid
        ORDER BY campo_nombre ASC`,
      [idProcedimiento],
    );
    return res.rows;
  }

  // ---------------------------------------------------------------------------
  // Vínculos con snapshot histórico
  // ---------------------------------------------------------------------------

  async crearVinculoConSnapshot(
    expedienteId: string,
    registroVersionId: string,
    datos: {
      motivo?: string | null;
      tupa_codigo?: string | null;
      tupa_anio?: number | null;
      codigo_ref?: string | null;
      denominacion_snapshot?: string | null;
      monto_efectivo?: number | null;
      tarifa_variante_codigo?: string | null;
      tarifa_variante_nombre?: string | null;
      plazo_dias_snapshot?: number | null;
      calificacion_snapshot?: string | null;
      canal_presentacion?: string | null;
      unidad_receptora_id?: string | null;
      unidad_receptora_codigo?: string | null;
      unidad_receptora_nombre?: string | null;
      unidad_responsable_id?: string | null;
      unidad_responsable_codigo?: string | null;
      unidad_responsable_nombre?: string | null;
      unidad_resolutiva_id?: string | null;
      unidad_resolutiva_codigo?: string | null;
      unidad_resolutiva_nombre?: string | null;
      fuente_datos?: unknown | null;
    },
    executor: Pool | PoolClient = this.pool,
  ): Promise<FilaVinculoConSnapshot> {
    const res = await executor.query<FilaVinculoConSnapshot>(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (
            expediente_id, registro_version_id, motivo,
            tupa_codigo, tupa_anio, codigo_ref,
            denominacion_snapshot, monto_efectivo,
            tarifa_variante_codigo, tarifa_variante_nombre,
            plazo_dias_snapshot, calificacion_snapshot, canal_presentacion,
            unidad_receptora_id, unidad_receptora_codigo, unidad_receptora_nombre,
            unidad_responsable_id, unidad_responsable_codigo, unidad_responsable_nombre,
            unidad_resolutiva_id, unidad_resolutiva_codigo, unidad_resolutiva_nombre,
            fuente_datos
         )
         SELECT
            $1::uuid, rv.registro_version_id, $3,
            COALESCE($4, tv.codigo), COALESCE($5, tv.anio), COALESCE($6, p.codigo_ref),
            COALESCE($7, p.denominacion), COALESCE($8, p.monto),
            $9, $10,
            COALESCE($11, p.plazo_dias), COALESCE($12, p.calificacion), COALESCE($13, p.canal_presentacion),
            COALESCE($14::uuid, p.unidad_receptora_id), COALESCE($15, receptor.codigo), COALESCE($16, receptor.nombre),
            COALESCE($17::uuid, p.unidad_responsable_id), COALESCE($18, responsable.codigo), COALESCE($19, responsable.nombre),
            COALESCE($20::uuid, p.unidad_resolutiva_id), COALESCE($21, resolutiva.codigo), COALESCE($22, resolutiva.nombre),
            COALESCE(
              $23::jsonb,
              jsonb_build_object(
                'documentoSha256', rv.documento_sha256,
                'fuenteNombre', rv.fuente_nombre,
                'pagina', rv.pagina,
                'referenciaFila', rv.referencia_fila,
                'revision', rv.revision,
                'referenciaAprobacion', rv.referencia_aprobacion
              )
            )
         FROM sigd_doc.tupa_registro_version rv
         LEFT JOIN LATERAL (
           SELECT procedimiento.*
             FROM sigd_doc.tupa_procedimiento procedimiento
            WHERE procedimiento.registro_version_id = rv.registro_version_id
            ORDER BY procedimiento.activo DESC, procedimiento.orden, procedimiento.id_procedimiento
            LIMIT 1
         ) p ON TRUE
         LEFT JOIN sigd_doc.tupa_version tv ON tv.id_version = p.id_version
         LEFT JOIN sigd_org.area receptor ON receptor.area_id = p.unidad_receptora_id
         LEFT JOIN sigd_org.area responsable ON responsable.area_id = p.unidad_responsable_id
         LEFT JOIN sigd_org.area resolutiva ON resolutiva.area_id = p.unidad_resolutiva_id
        WHERE rv.registro_version_id = $2::uuid
        RETURNING *`,
      [
        expedienteId,
        registroVersionId,
        datos.motivo ?? null,
        datos.tupa_codigo ?? null,
        datos.tupa_anio ?? null,
        datos.codigo_ref ?? null,
        datos.denominacion_snapshot ?? null,
        datos.monto_efectivo ?? null,
        datos.tarifa_variante_codigo ?? null,
        datos.tarifa_variante_nombre ?? null,
        datos.plazo_dias_snapshot ?? null,
        datos.calificacion_snapshot ?? null,
        datos.canal_presentacion ?? null,
        datos.unidad_receptora_id ?? null,
        datos.unidad_receptora_codigo ?? null,
        datos.unidad_receptora_nombre ?? null,
        datos.unidad_responsable_id ?? null,
        datos.unidad_responsable_codigo ?? null,
        datos.unidad_responsable_nombre ?? null,
        datos.unidad_resolutiva_id ?? null,
        datos.unidad_resolutiva_codigo ?? null,
        datos.unidad_resolutiva_nombre ?? null,
        datos.fuente_datos ?? null,
      ],
    );
    const vinculo = res.rows[0];
    if (!vinculo) {
      throw new NotFoundError({
        message: 'No se encontró el registro de versión TUPA para crear el vínculo.',
      });
    }
    return vinculo;
  }
}
