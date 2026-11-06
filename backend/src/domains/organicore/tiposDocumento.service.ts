import type { Pool } from 'pg';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

export const tipoDocumentoInputSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(30, 'El código no puede superar los 30 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'El código solo puede contener letras, números, guiones y guiones bajos'),
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(160, 'El nombre no puede superar los 160 caracteres'),
  extension: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .default('pdf'),
  mimeType: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .default('application/pdf'),
  tamanoMaximoMb: z.coerce
    .number()
    .int()
    .min(1, 'El tamaño máximo mínimo es 1 MB')
    .max(100, 'El tamaño máximo no puede exceder 100 MB')
    .default(25),
  exigeFirma: z.boolean().default(false),
  vigente: z.boolean().default(true),
});

export const tipoDocumentoActualizarSchema = tipoDocumentoInputSchema.partial();

export const tipoDocumentoEstadoSchema = z.object({
  vigente: z.boolean().optional(),
});

export type TipoDocumentoInput = z.infer<typeof tipoDocumentoInputSchema>;
export type TipoDocumentoActualizarInput = z.infer<typeof tipoDocumentoActualizarSchema>;

export interface TipoDocumentoRegistro {
  id: string;
  tipoDocumentalId: string;
  tipo_documental_id: string;
  codigo: string;
  nombre: string;
  extension: string;
  mimeType: string;
  mime_type: string;
  tamanoMaximoMb: number;
  tamano_maximo_mb: number;
  exigeFirma: boolean;
  exige_firma: boolean;
  vigente: boolean;
}

function mapearFila(row: any): TipoDocumentoRegistro {
  return {
    id: row.tipo_documental_id,
    tipoDocumentalId: row.tipo_documental_id,
    tipo_documental_id: row.tipo_documental_id,
    codigo: row.codigo,
    nombre: row.nombre,
    extension: row.extension,
    mimeType: row.mime_type,
    mime_type: row.mime_type,
    tamanoMaximoMb: Number(row.tamano_maximo_mb),
    tamano_maximo_mb: Number(row.tamano_maximo_mb),
    exigeFirma: Boolean(row.exige_firma),
    exige_firma: Boolean(row.exige_firma),
    vigente: Boolean(row.vigente),
  };
}

export class TiposDocumentoService {
  constructor(private readonly pool: Pool) {}

  async listar(soloVigentes = false): Promise<TipoDocumentoRegistro[]> {
    const query = `
      SELECT tipo_documental_id, codigo, nombre, extension, mime_type,
             tamano_maximo_mb, exige_firma, vigente
        FROM sigd_doc.tipo_documento
       WHERE ($1 = FALSE OR vigente = TRUE)
       ORDER BY nombre ASC
    `;
    const { rows } = await this.pool.query(query, [soloVigentes]);
    return rows.map(mapearFila);
  }

  async obtenerPorId(id: string): Promise<TipoDocumentoRegistro> {
    const { rows } = await this.pool.query(
      `SELECT tipo_documental_id, codigo, nombre, extension, mime_type,
              tamano_maximo_mb, exige_firma, vigente
         FROM sigd_doc.tipo_documento
        WHERE tipo_documental_id = $1`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundError({
        message: `Tipo de documento con ID ${id} no encontrado.`,
      });
    }

    return mapearFila(rows[0]);
  }

  async crear(datos: TipoDocumentoInput): Promise<TipoDocumentoRegistro> {
    const contexto = getRequestContext();
    const correlationId = contexto?.correlation_id || randomUUID();
    const usuarioId = contexto?.usuario_id || null;
    const ipOrigen = contexto?.ip_origen || null;
    const userAgent = contexto?.user_agent || null;

    const codigoNormalizado = datos.codigo.toUpperCase().trim();

    // Comprobar unicidad de código
    const { rows: existente } = await this.pool.query(
      'SELECT 1 FROM sigd_doc.tipo_documento WHERE codigo = $1',
      [codigoNormalizado],
    );
    if (existente.length > 0) {
      throw new ConflictError({
        code: 'TIPO_DOCUMENTO_CODIGO_DUPLICADO',
        message: `Ya existe un tipo de documento con el código "${codigoNormalizado}".`,
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const { rows } = await cliente.query(
        `INSERT INTO sigd_doc.tipo_documento
           (codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING tipo_documental_id, codigo, nombre, extension, mime_type,
                   tamano_maximo_mb, exige_firma, vigente`,
        [
          codigoNormalizado,
          datos.nombre.trim(),
          datos.extension.toLowerCase().trim(),
          datos.mimeType.trim(),
          datos.tamanoMaximoMb,
          datos.exigeFirma,
          datos.vigente,
        ],
      );

      const nuevoRegistro = mapearFila(rows[0]);

      // Registro en bitácora de auditoría WORM
      await cliente.query(
        `INSERT INTO sigd_audit.bitacora_auditoria
           (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_despues)
         VALUES ($1, $2, $3, $4, 'sigd_doc', 'tipo_documento', 'INSERT', $5)`,
        [
          correlationId,
          usuarioId,
          ipOrigen,
          userAgent,
          JSON.stringify(nuevoRegistro),
        ],
      );

      await cliente.query('COMMIT');
      return nuevoRegistro;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async actualizar(id: string, datos: TipoDocumentoActualizarInput): Promise<TipoDocumentoRegistro> {
    const registroPrevio = await this.obtenerPorId(id);

    const contexto = getRequestContext();
    const correlationId = contexto?.correlation_id || randomUUID();
    const usuarioId = contexto?.usuario_id || null;
    const ipOrigen = contexto?.ip_origen || null;
    const userAgent = contexto?.user_agent || null;

    if (datos.codigo) {
      const codigoNormalizado = datos.codigo.toUpperCase().trim();
      const { rows: existente } = await this.pool.query(
        'SELECT 1 FROM sigd_doc.tipo_documento WHERE codigo = $1 AND tipo_documental_id <> $2',
        [codigoNormalizado, id],
      );
      if (existente.length > 0) {
        throw new ConflictError({
          code: 'TIPO_DOCUMENTO_CODIGO_DUPLICADO',
          message: `Ya existe otro tipo de documento con el código "${codigoNormalizado}".`,
        });
      }
    }

    const setClauses: string[] = [];
    const values: any[] = [];

    if (datos.codigo !== undefined) {
      values.push(datos.codigo.toUpperCase().trim());
      setClauses.push(`codigo = $${values.length}`);
    }
    if (datos.nombre !== undefined) {
      values.push(datos.nombre.trim());
      setClauses.push(`nombre = $${values.length}`);
    }
    if (datos.extension !== undefined) {
      values.push(datos.extension.toLowerCase().trim());
      setClauses.push(`extension = $${values.length}`);
    }
    if (datos.mimeType !== undefined) {
      values.push(datos.mimeType.trim());
      setClauses.push(`mime_type = $${values.length}`);
    }
    if (datos.tamanoMaximoMb !== undefined) {
      values.push(datos.tamanoMaximoMb);
      setClauses.push(`tamano_maximo_mb = $${values.length}`);
    }
    if (datos.exigeFirma !== undefined) {
      values.push(datos.exigeFirma);
      setClauses.push(`exige_firma = $${values.length}`);
    }
    if (datos.vigente !== undefined) {
      values.push(datos.vigente);
      setClauses.push(`vigente = $${values.length}`);
    }

    if (setClauses.length === 0) {
      return registroPrevio;
    }

    values.push(id);
    const sql = `
      UPDATE sigd_doc.tipo_documento
         SET ${setClauses.join(', ')}
       WHERE tipo_documental_id = $${values.length}
       RETURNING tipo_documental_id, codigo, nombre, extension, mime_type,
                 tamano_maximo_mb, exige_firma, vigente
    `;

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const { rows } = await cliente.query(sql, values);
      const registroActualizado = mapearFila(rows[0]);

      // Registro en bitácora de auditoría WORM
      await cliente.query(
        `INSERT INTO sigd_audit.bitacora_auditoria
           (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_antes, datos_despues)
         VALUES ($1, $2, $3, $4, 'sigd_doc', 'tipo_documento', 'UPDATE', $5, $6)`,
        [
          correlationId,
          usuarioId,
          ipOrigen,
          userAgent,
          JSON.stringify(registroPrevio),
          JSON.stringify(registroActualizado),
        ],
      );

      await cliente.query('COMMIT');
      return registroActualizado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async alternarEstado(id: string, nuevoEstado?: boolean): Promise<TipoDocumentoRegistro> {
    const actual = await this.obtenerPorId(id);
    const estadoFinal = nuevoEstado !== undefined ? nuevoEstado : !actual.vigente;
    return this.actualizar(id, { vigente: estadoFinal });
  }

  async eliminar(id: string): Promise<{ eliminado: boolean; mensaje: string }> {
    const registroPrevio = await this.obtenerPorId(id);

    const contexto = getRequestContext();
    const correlationId = contexto?.correlation_id || randomUUID();
    const usuarioId = contexto?.usuario_id || null;
    const ipOrigen = contexto?.ip_origen || null;
    const userAgent = contexto?.user_agent || null;

    // Verificar si está referenciado en documento_adjunto
    const { rows: referencias } = await this.pool.query(
      'SELECT 1 FROM sigd_doc.documento_adjunto WHERE tipo_documental_id = $1 LIMIT 1',
      [id],
    );

    if (referencias.length > 0) {
      // Si tiene referencias, realizamos baja lógica para preservar integridad referencial
      await this.actualizar(id, { vigente: false });
      return {
        eliminado: true,
        mensaje: 'Tipo de documento desactivado (baja lógica por integridad documental)',
      };
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      await cliente.query(
        'DELETE FROM sigd_doc.tipo_documento WHERE tipo_documental_id = $1',
        [id],
      );

      // Bitácora WORM
      await cliente.query(
        `INSERT INTO sigd_audit.bitacora_auditoria
           (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_antes, datos_despues)
         VALUES ($1, $2, $3, $4, 'sigd_doc', 'tipo_documento', 'DELETE', $5, $6)`,
        [
          correlationId,
          usuarioId,
          ipOrigen,
          userAgent,
          JSON.stringify(registroPrevio),
          JSON.stringify({ eliminado: true, tipo_documental_id: id }),
        ],
      );

      await cliente.query('COMMIT');
      return {
        eliminado: true,
        mensaje: 'Tipo documental eliminado exitosamente',
      };
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }
}
