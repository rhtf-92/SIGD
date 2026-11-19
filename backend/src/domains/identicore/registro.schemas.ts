import { z } from 'zod';

const aliases: Record<string, string> = {
  tipo_persona: 'tipoPersona',
  tipo_documento: 'tipoDocumento',
  numero_documento: 'numeroDocumento',
  apellido_paterno: 'apellidoPaterno',
  apellido_materno: 'apellidoMaterno',
  ubigeo_distrito: 'ubigeoDistrito',
  consentimiento_datos: 'consentimientoDatos',
  acepta_notificaciones: 'aceptaNotificaciones',
  razon_social: 'razonSocial',
  partida_registral: 'partidaRegistral',
  dni_representante: 'dniRepresentante',
  tipo_documento_representante: 'tipoDocumentoRepresentante',
  numero_documento_representante: 'numeroDocumentoRepresentante',
  nombre_representante: 'nombreRepresentante',
  fecha_nacimiento: 'fechaNacimiento',
  cargo_representante: 'cargoRepresentante',
  version_politica: 'versionPolitica',
  declaracion_jurada_aceptada: 'declaracionJuradaAceptada',
};

export function aceptarCasingDual(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;

  const normalizado: Record<string, unknown> = { ...value };
  for (const [snakeCase, camelCase] of Object.entries(aliases)) {
    if (!(snakeCase in normalizado)) continue;
    if (camelCase in normalizado && normalizado[camelCase] !== normalizado[snakeCase]) {
      normalizado[`__conflict_${snakeCase}`] = normalizado[snakeCase];
    } else if (!(camelCase in normalizado)) {
      normalizado[camelCase] = normalizado[snakeCase];
    }
    delete normalizado[snakeCase];
  }
  return normalizado;
}

const camposComunes = {
  correo: z.string().trim().email().max(150).transform((correo) => correo.toLowerCase()),
  celular: z.string().regex(/^9[0-9]{8}$/),
  ubigeoDistrito: z.string().regex(/^[0-9]{6}$/).optional(),
  direccion: z.string().trim().min(5).max(250).optional(),
  referencia: z.string().trim().max(200).optional(),
  password: z.string().min(8).max(128),
  consentimientoDatos: z.literal(true),
  aceptaNotificaciones: z.boolean().optional().default(false),
  versionPolitica: z.string().trim().min(1).max(20).optional(),
};

const fechaNacimientoSchema = z.string().refine((fecha) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const normalizada = new Date(`${fecha}T00:00:00.000Z`);
  return !Number.isNaN(normalizada.getTime()) && normalizada.toISOString().slice(0, 10) === fecha;
}, 'La fecha de nacimiento debe ser una fecha calendario válida.');

const ciudadanoSchema = z.object({
  ...camposComunes,
  tipoPersona: z.literal('NATURAL'),
  tipoDocumento: z.enum(['DNI', 'CE']).optional().default('DNI'),
  numeroDocumento: z.string().regex(/^(?:[0-9]{8}|[A-Z0-9]{9,12})$/).optional(),
  dni: z.string().regex(/^[0-9]{8}$/).optional(),
  nombres: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, 'Los nombres solo deben contener letras y espacios.'),
  apellidoPaterno: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, 'El apellido paterno solo debe contener letras y espacios.'),
  apellidoMaterno: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .min(2)
        .max(120)
        .regex(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, 'El apellido materno solo debe contener letras y espacios.'),
    ])
    .optional()
    .default(''),
  fechaNacimiento: fechaNacimientoSchema,
  verificacionTitularidad: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  declaracionJuradaAceptada: z.literal(true),
}).strict().superRefine((datos, contexto) => {
  const numero = datos.numeroDocumento ?? datos.dni;
  if (!numero) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['numeroDocumento'], message: 'El número de documento es obligatorio.' });
    return;
  }
  const formatoValido = datos.tipoDocumento === 'DNI' ? /^[0-9]{8}$/.test(numero) : /^[A-Z0-9]{9,12}$/.test(numero);
  if (!formatoValido) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['numeroDocumento'], message: `El documento no tiene el formato de ${datos.tipoDocumento}.` });
  if (datos.dni && datos.numeroDocumento && datos.dni !== datos.numeroDocumento) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['dni'], message: 'Los campos de documento no coinciden.' });
  }
});

const personaJuridicaSchema = z.object({
  ...camposComunes,
  tipoPersona: z.literal('JURIDICA'),
  ruc: z.string().regex(/^[0-9]{11}$/),
  razonSocial: z.string().trim().min(3).max(200),
  verificacionTitularidad: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  partidaRegistral: z.string().regex(/^[0-9]{1,18}$/).optional(),
  tipoDocumentoRepresentante: z.enum(['DNI', 'CE']).optional().default('DNI'),
  numeroDocumentoRepresentante: z.string().regex(/^(?:[0-9]{8}|[A-Z0-9]{9,12})$/).optional(),
  dniRepresentante: z.string().regex(/^[0-9]{8}$/).optional(),
  nombreRepresentante: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, 'El nombre del representante solo debe contener letras y espacios.'),
  cargoRepresentante: z.string().trim().min(2).max(120),
  declaracionJuradaAceptada: z.literal(true),
}).strict().superRefine((datos, contexto) => {
  const numero = datos.numeroDocumentoRepresentante ?? datos.dniRepresentante;
  if (!numero) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['numeroDocumentoRepresentante'], message: 'El documento del representante es obligatorio.' });
    return;
  }
  const formatoValido = datos.tipoDocumentoRepresentante === 'DNI' ? /^[0-9]{8}$/.test(numero) : /^[A-Z0-9]{9,12}$/.test(numero);
  if (!formatoValido) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['numeroDocumentoRepresentante'], message: `El documento no tiene el formato de ${datos.tipoDocumentoRepresentante}.` });
  if (datos.dniRepresentante && datos.numeroDocumentoRepresentante && datos.dniRepresentante !== datos.numeroDocumentoRepresentante) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['dniRepresentante'], message: 'Los campos de documento del representante no coinciden.' });
  }
});

export const registroCiudadanoSchema = z.preprocess(aceptarCasingDual, ciudadanoSchema);
export const registroPersonaJuridicaSchema = z.preprocess(aceptarCasingDual, personaJuridicaSchema);

export const validarDocumentoQuerySchema = z.preprocess(
  (value: unknown) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
    const query = { ...value } as Record<string, unknown>;
    const aliasesQuery: Record<string, string> = {
      tipo: 'tipoDocumento',
      tipo_documento: 'tipoDocumento',
      numero: 'numeroDocumento',
      numero_documento: 'numeroDocumento',
    };
    for (const [alias, canonical] of Object.entries(aliasesQuery)) {
      if (!(alias in query)) continue;
      if (!(canonical in query)) query[canonical] = query[alias];
      delete query[alias];
    }
    return query;
  },
  z.object({
    tipoDocumento: z.enum(['DNI', 'RUC']),
    numeroDocumento: z.string().min(1).max(20),
  }).strict(),
);

export type RegistroCiudadanoInput = z.infer<typeof registroCiudadanoSchema>;
export type RegistroPersonaJuridicaInput = z.infer<typeof registroPersonaJuridicaSchema>;
