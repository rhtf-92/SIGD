import { z } from 'zod';

const aliases: Record<string, string> = {
  tipo_persona: 'tipoPersona',
  tipo_documento: 'tipoDocumento',
  numero_documento: 'dni',
  apellido_paterno: 'apellidoPaterno',
  apellido_materno: 'apellidoMaterno',
  ubigeo_distrito: 'ubigeoDistrito',
  referencia_domicilio: 'referenciaDomicilio',
  fecha_nacimiento: 'fechaNacimiento',
  declaracion_jurada: 'declaracionJurada',
  consentimiento_datos: 'consentimientoDatos',
  acepta_notificaciones: 'aceptaNotificaciones',
  razon_social: 'razonSocial',
  partida_registral: 'partidaRegistral',
  dni_representante: 'dniRepresentante',
  tipo_documento_representante: 'tipoDocumentoRepresentante',
  nombre_representante: 'nombreRepresentante',
  cargo_representante: 'cargoRepresentante',
};

export function aceptarCasingDual(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;

  const normalizado: Record<string, unknown> = { ...value };
  if ('numeroDocumento' in normalizado) {
    if (!('dni' in normalizado)) normalizado.dni = normalizado.numeroDocumento;
    delete normalizado.numeroDocumento;
  }
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
  ubigeoDistrito: z.string().regex(/^25[0-9]{4}$/),
  direccion: z.string().trim().min(5).max(250),
  password: z.string().min(8).max(128),
  consentimientoDatos: z.literal(true),
  aceptaNotificaciones: z.boolean().optional().default(false),
};

const ciudadanoSchema = z.object({
  ...camposComunes,
  tipoPersona: z.literal('NATURAL'),
  tipoDocumento: z.enum(['DNI', 'CE']).default('DNI'),
  dni: z.string().trim().transform((documento) => documento.toUpperCase())
    .refine((documento) => /^[0-9]{8}$/.test(documento) || /^[A-Z0-9]{9,12}$/.test(documento)),
  nombres: z.string().trim().min(2).max(120),
  apellidoPaterno: z.string().trim().min(2).max(120),
  apellidoMaterno: z.string().trim().min(2).max(120),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referenciaDomicilio: z.string().trim().max(200).optional(),
  declaracionJurada: z.literal(true),
  fechaAceptacion: z.string().datetime().optional(),
}).strict().superRefine((datos, ctx) => {
  const documentoValido = datos.tipoDocumento === 'DNI'
    ? /^[0-9]{8}$/.test(datos.dni)
    : /^[A-Z0-9]{9,12}$/.test(datos.dni);
  if (!documentoValido) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dni'],
      message: datos.tipoDocumento === 'DNI'
        ? 'El DNI debe contener exactamente 8 dígitos.'
        : 'El CE debe contener entre 9 y 12 caracteres alfanuméricos.',
    });
  }
});

const personaJuridicaSchema = z.object({
  ...camposComunes,
  tipoPersona: z.literal('JURIDICA'),
  ruc: z.string().regex(/^[0-9]{11}$/),
  razonSocial: z.string().trim().min(3).max(200),
  partidaRegistral: z.string().regex(/^[0-9]{1,18}$/).optional(),
  tipoDocumentoRepresentante: z.enum(['DNI', 'CE']).default('DNI'),
  dniRepresentante: z.string().trim().transform((documento) => documento.toUpperCase())
    .refine((documento) => /^[0-9]{8}$/.test(documento) || /^[A-Z0-9]{9,12}$/.test(documento)),
  nombreRepresentante: z.string().trim().min(3).max(200),
  cargoRepresentante: z.string().trim().min(2).max(120).optional(),
  referenciaDomicilio: z.string().trim().max(200).optional(),
  declaracionJurada: z.literal(true),
  fechaAceptacion: z.string().datetime().optional(),
}).strict().superRefine((datos, ctx) => {
  const documentoValido = datos.tipoDocumentoRepresentante === 'DNI'
    ? /^[0-9]{8}$/.test(datos.dniRepresentante)
    : /^[A-Z0-9]{9,12}$/.test(datos.dniRepresentante);
  if (!documentoValido) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dniRepresentante'],
      message: 'El documento del representante no corresponde al tipo seleccionado.',
    });
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