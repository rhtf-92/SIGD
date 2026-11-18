import { z } from 'zod';

const aliases: Record<string, string> = {
  tipo_persona: 'tipoPersona',
  apellido_paterno: 'apellidoPaterno',
  apellido_materno: 'apellidoMaterno',
  ubigeo_distrito: 'ubigeoDistrito',
  consentimiento_datos: 'consentimientoDatos',
  acepta_notificaciones: 'aceptaNotificaciones',
  razon_social: 'razonSocial',
  partida_registral: 'partidaRegistral',
  dni_representante: 'dniRepresentante',
  nombre_representante: 'nombreRepresentante',
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
  ubigeoDistrito: z.string().regex(/^25[0-9]{4}$/),
  direccion: z.string().trim().min(5).max(250),
  password: z.string().min(8).max(128),
  consentimientoDatos: z.literal(true),
  aceptaNotificaciones: z.boolean().optional().default(false),
};

const ciudadanoSchema = z.object({
  ...camposComunes,
  tipoPersona: z.literal('NATURAL'),
  dni: z.string().regex(/^[0-9]{8}$/),
  nombres: z.string().trim().min(2).max(120),
  apellidoPaterno: z.string().trim().min(2).max(120),
  apellidoMaterno: z.string().trim().min(2).max(120),
}).strict();

const personaJuridicaSchema = z.object({
  ...camposComunes,
  tipoPersona: z.literal('JURIDICA'),
  ruc: z.string().regex(/^[0-9]{11}$/),
  razonSocial: z.string().trim().min(3).max(200),
  partidaRegistral: z.string().regex(/^[0-9]{1,18}$/).optional(),
  dniRepresentante: z.string().regex(/^[0-9]{8}$/),
  nombreRepresentante: z.string().trim().min(3).max(200),
}).strict();

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