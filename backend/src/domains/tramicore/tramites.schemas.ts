
import { z } from 'zod';
import { REGEX_CUT } from './cut.service.js';

/**
 * T-BE-TC-02 - Contratos de entrada de Tramites.
 *
 * El esquema es deliberadamente estricto (.strict()):
 * un campo obligatorio ausente, un correo invalido o
 * un adjunto sin hash deben fallar ANTES de abrir la
 * transaccion, evitando expedientes incompletos.
 */

/** Tipos MIME aceptados para la radicacion virtual. */
export const TIPOS_ARCHIVO_ACEPTADOS = ['application/pdf'] as const;

/** Tope por archivo: 20 MiB. */
export const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024;

/** Longitud de una huella SHA-256 hexadecimal. */
const LONGITUD_HASH = 64;

const hashSha256 = z
  .string()
  .trim()
  .regex(
    new RegExp(`^[0-9a-f]{${LONGITUD_HASH}}$`, 'i'),
    'El hash debe ser SHA-256 en 64 digitos hexadecimales.',
  );

/**
 * Evita nombres con rutas y valida la extension del archivo.
 */
const nombreArchivo = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .refine(
    (valor) => !/[\\/]/.test(valor),
    'El nombre del archivo no puede contener rutas.',
  )
  .refine(
    (valor) => !valor.includes('..'),
    'El nombre del archivo no puede contener "..".',
  )
  .refine(
    (valor) => /\.[A-Za-z0-9]{1,10}$/.test(valor),
    'El archivo debe tener extension.',
  );

/**
 * Documento adjunto validado antes de radicar.
 */
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

    tamanoBytes: z
      .number()
      .int()
      .positive()
      .max(TAMANO_MAXIMO_BYTES, {
        message: 'El archivo supera el maximo permitido de 20 MiB.',
      }),

    hashSha256,

    storagePath: z
      .string()
      .trim()
      .min(3)
      .max(512),
  })
  .strict();

/**
 * Radicacion virtual.
 *
 * Correccion:
 * El catalogo TUPA academico utiliza identificadores
 * como 00000000-0000-0000-0000-000000000001.
 *
 * La validacion z.uuid() los rechazaba porque comprueba
 * tambien la version y variante del UUID.
 *
 * Esta validacion mantiene la estructura hexadecimal
 * de 36 caracteres y rechaza el identificador nulo.
 *
 * El Backend verifica posteriormente que el tramite
 * exista y este vigente en PostgreSQL.
 */
export const radicacionVirtualSchema = z
  .object({
    asunto: z
      .string()
      .trim()
      .min(
        10,
        'El asunto debe tener al menos 10 caracteres.',
      )
      .max(
        500,
        'El asunto no puede superar los 500 caracteres.',
      )
      .refine(
        (valor) => valor.trim().length >= 10,
        'El asunto no puede estar compuesto solo de espacios.',
      ),

    idTipoTramiteTupa: z
      .string()
      .trim()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        'El tipo de tramite TUPA debe tener formato UUID.',
      )
      .refine(
        (valor) =>
          valor.toLowerCase() !==
          '00000000-0000-0000-0000-000000000000',
        'El tipo de tramite no puede ser el UUID nulo.',
      ),

    // Identidad UUID del padron autenticado.
    idPersona: z
      .string()
      .uuid(),

    nombreSolicitante: z
      .string()
      .trim()
      .min(
        2,
        'El nombre del solicitante debe tener al menos 2 caracteres.',
      )
      .max(
        120,
        'El nombre del solicitante no puede superar los 120 caracteres.',
      )
      .refine(
        (valor) => valor.trim().length >= 2,
        'El nombre del solicitante no puede estar compuesto solo de espacios.',
      ),

    correo: z
      .string()
      .trim()
      .toLowerCase()
      .email(
        'El correo electronico no tiene un formato valido.',
      )
      .max(
        150,
        'El correo electronico no puede superar los 150 caracteres.',
      ),

    totalFolios: z
      .number()
      .int()
      .min(1)
      .max(5000),

    documentos: z
      .array(adjuntoRadicacionSchema)
      .min(
        1,
        'La radicacion exige al menos un archivo cargado.',
      )
      .max(
        30,
        'Se admiten hasta 30 archivos por radicacion.',
      ),
  })
  .strict()
  .superRefine((valor, ctx) => {
    const nombres = new Set(
      valor.documentos.map((doc) =>
        doc.nombreArchivo.toLowerCase(),
      ),
    );

    if (nombres.size !== valor.documentos.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentos'],
        message:
          'No se admiten archivos con nombres duplicados en la misma radicacion.',
      });
    }

    const hashes = new Set(
      valor.documentos.map((doc) =>
        doc.hashSha256.toLowerCase(),
      ),
    );

    if (hashes.size !== valor.documentos.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentos'],
        message:
          'No se admiten archivos con el mismo hash SHA-256 en la misma radicacion.',
      });
    }
  });

/**
 * Consulta publica de expedientes mediante CUT.
 */
export const consultaPublicaParamsSchema = z
  .object({
    cut: z
      .string()
      .trim()
      .transform((valor) =>
        valor.toUpperCase(),
      )
      .refine(
        (valor) => REGEX_CUT.test(valor),
        {
          message:
            'El CUT debe cumplir la mascara EXP-YYYY-XXXXXX.',
        },
      ),
  })
  .strict();

/**
 * Tipos TypeScript derivados de los esquemas.
 */
export type AdjuntoRadicacionInput =
  z.infer<typeof adjuntoRadicacionSchema>;

export type RadicacionVirtualInput =
  z.infer<typeof radicacionVirtualSchema>;

export type ConsultaPublicaParams =
  z.infer<typeof consultaPublicaParamsSchema>;
