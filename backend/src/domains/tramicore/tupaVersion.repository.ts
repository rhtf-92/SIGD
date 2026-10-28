import type { Pool, PoolClient } from 'pg';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

export interface FilaTupaVersion {
  id_version: string;
  codigo: string;
  denominacion: string;
  anio: number;
  estado: 'BORRADOR' | 'VIGENTE' | 'HISTORICO';
  resolucion_aprobacion: string | null;
  fecha_aprobacion: string | null;
  total_procedimientos: number;
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
              plazo_dias, requisitos, genera_expediente, calificacion,
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
             plazo_dias, requisitos, genera_expediente, calificacion,
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
        `INSERT INTO sigd_doc.tupa_version (codigo, denominacion, anio, estado, resolucion_aprobacion)
         VALUES ($1, $2, $3, 'BORRADOR', $4)
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
    if (datos.requisitos !== undefined) {
      params.push(JSON.stringify(datos.requisitos));
      updates.push(`requisitos = $${params.length}::jsonb`);
    }
    if (datos.categoria !== undefined) {
      params.push(datos.categoria);
      updates.push(`categoria = $${params.length}`);
    }
    if (datos.tipoFormulario !== undefined) {
      params.push(datos.tipoFormulario);
      updates.push(`tipo_formulario = $${params.length}`);
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

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      // 1. Archivar la versión vigente actual
      await cliente.query(
        `UPDATE sigd_doc.tupa_version
            SET estado = 'HISTORICO', actualizado_en = now()
          WHERE estado = 'VIGENTE'`,
      );

      // 2. Activar la versión seleccionada
      const res = await cliente.query<FilaTupaVersion>(
        `UPDATE sigd_doc.tupa_version
            SET estado = 'VIGENTE',
                fecha_aprobacion = COALESCE(fecha_aprobacion, CURRENT_DATE),
                actualizado_en = now()
          WHERE id_version = $1::uuid
          RETURNING *`,
        [idVersion],
      );

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
}
