import { z } from 'zod';
import { REGEX_CUT } from './cut.service.js';

/**
 * T-BE-TC-02 · Contratos de entrada de Tramites (Alineado con 02_sigd_auth, 04_sigd_doc, 05_sigd_tra).
 *
 * El esquema permite formatos documentales institucionales comunes:
 * PDF (.pdf), imágenes (.png, .jpg, .jpeg, .tiff) y documentos de Office (.doc, .docx, .odt).
 */

/** Tipos MIME institucionales comunes aceptados para la radicacion virtual. */
export const TIPOS_ARCHIVO_ACEPTADOS = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/octet-stream',
] as const;

/** Tope normativo por archivo: 25 MB (26,214,400 bytes, alineado con sigd_doc.tipo_documento.tamano_maximo_mb = 25). */
export const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024;

const hashSha256 = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/i, 'El código de seguridad SHA-256 del archivo no es válido.');

/**
 * Evita homoglifos y rutas: solo se admiten extension y nombre de archivo sin
 * separadores de ruta, para que el nombre persistido no pueda usarse para
 * escribir fuera del bucket.
 */
const nombreArchivo = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .refine((valor) => !/[\\/]/.test(valor), 'El nombre del archivo no puede contener rutas.')
  .refine((valor) => !valor.includes('..'), 'El nombre del archivo no puede contener "..".')
  .refine((valor) => /\.[A-Za-z0-9]{1,10}$/.test(valor), 'El archivo debe tener extensión.');

/**
 * Clave de objeto en MinIO S3 (`s3_key` en `sigd_doc.documento_adjunto`, max 500 chars).
 * Previene path traversal (`..`), barras invertidas y claves vacías.
 */
const s3KeyMetadataSchema = z
  .string()
  .trim()
  .min(3, 'La ruta de almacenamiento debe tener al menos 3 caracteres.')
  .max(500, 'La ruta de almacenamiento no puede superar los 500 caracteres.')
  .refine((valor) => !valor.includes('..') && !valor.includes('\\'), {
    message: 'La ruta de almacenamiento contiene caracteres no permitidos.',
  });

export const adjuntoRadicacionSchema = z
  .object({
    nombreArchivo,
    contentType: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine(
        (valor): valor is (typeof TIPOS_ARCHIVO_ACEPTADOS)[number] =>
          (TIPOS_ARCHIVO_ACEPTADOS as readonly string[]).includes(valor.toLowerCase()),
        {
          message:
            'Formato de archivo no compatible. Se admiten documentos PDF, Word (.doc, .docx) e imágenes (.png, .jpg).',
        },
      ),
    tamanoBytes: z.number().int().positive().max(TAMANO_MAXIMO_BYTES, {
      message: 'Tu archivo supera el tamaño máximo permitido de 25 MB.',
    }),
    hashSha256,
    storagePath: s3KeyMetadataSchema.optional(),
    s3Key: s3KeyMetadataSchema.optional(),
    s3Bucket: z.string().trim().min(3).max(120).optional(),
    idDocumentoAdjunto: z.string().trim().uuid().optional(),
  })
  .strict();

export const radicacionVirtualSchema = z
  .object({
    asunto: z
      .string()
      .trim()
      .min(10, 'El asunto debe tener al menos 10 caracteres.')
      .max(500, 'El asunto no puede superar los 500 caracteres.')
      .refine((valor) => valor.trim().length >= 10, 'El asunto no puede estar compuesto solo de espacios.'),
    idTipoTramiteTupa: z
      .string()
      .trim()
      .uuid('El tipo de tramite TUPA debe ser un UUID valido (sigd_doc.tipo_tramite_tupa.tipo_tramite_id).')
      .refine(
        (valor) => valor !== '00000000-0000-0000-0000-000000000000',
        'El tipo de tramite no puede ser el UUID nulo.',
      ),
    // `sigd_auth.persona.id_persona` es UUID en el DDL canonico desplegado (02_sigd_auth.sql).
    idPersona: z
      .string()
      .trim()
      .uuid('El administrado debe ser un UUID valido (sigd_auth.persona.id_persona).')
      .refine(
        (valor) => valor !== '00000000-0000-0000-0000-000000000000',
        'El identificador del administrado no puede ser el UUID nulo.',
      )
      .optional(),
    tipoDocumento: z.enum(['DNI', 'CE', 'RUC', 'PASAPORTE', 'OTRO']).optional(),
    numeroDocumento: z.string().trim().min(1).max(20).optional(),
    nombreSolicitante: z
      .string()
      .trim()
      .min(2, 'El nombre del solicitante debe tener al menos 2 caracteres.')
      .max(120, 'El nombre del solicitante no puede superar los 120 caracteres.')
      .refine(
        (valor) => valor.trim().length >= 2,
        'El nombre del solicitante no puede estar compuesto solo de espacios.',
      ),
    correo: z
      .string()
      .trim()
      .toLowerCase()
      .email('El correo electronico no tiene un formato valido.')
      .max(150, 'El correo electronico no puede superar los 150 caracteres.'),
    totalFolios: z.number().int().min(1).max(5000),
    documentos: z
      .array(adjuntoRadicacionSchema)
      .min(1, 'La radicacion exige al menos un archivo cargado.')
      .max(30, 'Se admiten hasta 30 archivos por radicacion.'),
  })
  .strict()
  .superRefine((valor, ctx) => {
    const nombres = new Set(valor.documentos.map((doc) => doc.nombreArchivo.toLowerCase()));
    if (nombres.size !== valor.documentos.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentos'],
        message: 'No se admiten archivos con nombres duplicados en la misma radicacion.',
      });
    }
    const hashes = new Set(valor.documentos.map((doc) => doc.hashSha256.toLowerCase()));
    if (hashes.size !== valor.documentos.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentos'],
        message: 'No se admiten archivos con el mismo hash SHA-256 en la misma radicacion.',
      });
    }
  });

export const consultaPublicaParamsSchema = z
  .object({
    cut: z
      .string()
      .trim()
      .transform((valor) => valor.toUpperCase())
      .refine((valor) => REGEX_CUT.test(valor), {
        message: 'El CUT debe cumplir la mascara EXP-YYYY-XXXXXX.',
      }),
  })
  .strict();

export type AdjuntoRadicacionInput = z.infer<typeof adjuntoRadicacionSchema>;
export type RadicacionVirtualInput = z.infer<typeof radicacionVirtualSchema>;
export type ConsultaPublicaParams = z.infer<typeof consultaPublicaParamsSchema>;
