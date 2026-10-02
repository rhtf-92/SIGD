import { z } from 'zod';
import { REGEX_CUT } from './cut.service.js';

/**
 * T-BE-TC-02 · Contratos de entrada de Tramites.
 *
 * El esquema es deliberadamente estricto (`.strict()`): el problema que se
 * corrige son las insertions parciales que dejaban expedientes "zombie" sin
 * administrado asociado ni documento adjunto. Un campo obligatorio ausente, un
 * correo invalido o un adjunto sin hash deben fallar ANTES de abrir la
 * transaccion, no después de haber escrito la cabecera.
 */

/** Tipos MIME aceptados para la radicacion virtual. */
export const TIPOS_ARCHIVO_ACEPTADOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
] as const;

/** Tope por archivo: 20 MiB. El limite lo aplica el gateway S3 (B_RIQUELMER). */
export const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024;

/** Longitudes de la mascara de un hash SHA-256 en hexadecimal. */
const LONGITUD_HASH = 64;

const hashSha256 = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/i, 'El hash debe ser SHA-256 en 64 digitos hexadecimales.');

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
  .refine((valor) => /\.[A-Za-z0-9]{1,10}$/.test(valor), 'El archivo debe tener extension.');

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
          (TIPOS_ARCHIVO_ACEPTADOS as readonly string[]).includes(valor),
        {
          message: `Tipo de archivo no admitido. Se aceptan: ${TIPOS_ARCHIVO_ACEPTADOS.join(', ')}.`,
        },
      ),
    tamanoBytes: z.number().int().positive().max(TAMANO_MAXIMO_BYTES, {
      message: 'El archivo supera el maximo permitido de 20 MiB.',
    }),
    hashSha256,
    storagePath: z.string().trim().max(512).optional(),
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
      .uuid('El tipo de tramite TUPA debe ser un UUID valido.')
      .refine(
        (valor) => valor !== '00000000-0000-0000-0000-000000000000',
        'El tipo de tramite no puede ser el UUID nulo.',
      ),
    // `sigd_auth.persona.id` es BIGSERIAL en el DDL canonico de IdentiCore, de
    // modo que el identificador del solicitante llega como entero. Se acepta
    // tambien string porque las variables de ruta y los formularios del
    // frontend serializan todo como texto.
    idPersona: z.coerce
      .number()
      .int('El administrado debe ser un identificador entero.')
      .positive('El administrado debe ser un identificador entero positivo.'),
    // T-BE-TC-02 exige certificar los datos completos del solicitante y
    // rechazar los correos invalidos. Se capturan en el acto de la radicacion
    // porque el cargo digital y las notificaciones de seguimiento se dirigen a
    // esta direccion; no se toma del padron porque el ciudadano puede radicar
    // con un correo de contacto distinto al registrado.
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
