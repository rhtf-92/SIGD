/**
 * Esquemas Zod del calendario laboral (T-BE-OC-13/14/16).
 *
 * Validan en el borde de entrada: las entradas inválidas se rechazan con
 * `ZodError`, que `src/errors/zod-error-mapper.ts` traduce a la respuesta
 * RFC 9457 `400 VALIDATION_ERROR` con `invalid_params[]`. Los mensajes van en
 * español y terminan en punto, igual que en `src/referencia/expediente.router.ts`.
 */

import { z } from 'zod';
import { esFechaValida, TIPOS_FERIADO, UNIDADES_TERRITORIALES } from './calendario.habiles.js';

/** `YYYY-MM-DD` con validación de calendario gregoriano (rechaza 2026-02-30). */
export const esquemaFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'El formato de la fecha debe ser YYYY-MM-DD.')
  .refine(esFechaValida, 'La fecha no existe en el calendario.');

export const esquemaAnio = z.coerce
  .number()
  .int('El año debe ser un número entero.')
  .min(1970, 'El año es fuera del rango admitido.')
  .max(2999, 'El año es fuera del rango admitido.');

export const esquemaTipoFeriado = z.enum(TIPOS_FERIADO, {
  errorMap: () => ({ message: 'El tipo de feriado no es válido.' }),
});

export const esquemaUnidadTerritorial = z.enum(UNIDADES_TERRITORIALES, {
  errorMap: () => ({ message: 'La unidad territorial no es válida.' }),
});

/**
 * Unidad territorial por defecto según el tipo de feriado. Evita que el
 * administrador haya que repetirla y mantiene la unicidad
 * (fecha, unidad_territorial) coherente con la clasificación normativa.
 */
export function unidadTerritorialPorDefecto(tipo: string): 'NACIONAL' | 'UCAYALI' | 'IESTP_SUIZA' {
  if (tipo === 'REGIONAL_UCAYALI') {
    return 'UCAYALI';
  }
  if (tipo === 'NACIONAL' || tipo === 'DUELO_NACIONAL') {
    return 'NACIONAL';
  }
  return 'IESTP_SUIZA';
}

/**
 * Body de `POST /api/v1/admin/calendario-laboral/feriado-excepcional`.
 * El plan maestro (§4.6, endpoint 49) exige registrar un día no hábil con
 * impacto en el cómputo de plazos y clasificarlo normativamente; el nombre del
 * campo sigue la columna `tipo_feriado` del DDL (`docs/02_organicore/11_...sql`)
 * y se amplía con `base_legal`, `unidad_territorial` y `es_laborable` para el
 * duelo nacional y las habilitaciones expresas.
 */
export const esquemaFeriadoExcepcional = z
  .object({
    fecha: esquemaFecha,
    descripcion: z.string().trim().min(5, 'La descripción debe tener al menos 5 caracteres.').max(200, 'La descripción no puede superar los 200 caracteres.'),
    tipo_feriado: esquemaTipoFeriado.default('INSTITUCIONAL'),
    unidad_territorial: esquemaUnidadTerritorial.optional(),
    es_laborable: z.boolean().default(false),
    base_legal: z.string().trim().max(500, 'La base legal no puede superar los 500 caracteres.').optional(),
  })
  .strict()
  .superRefine((datos, ctx) => {
    // Una habilitación laborable no es un feriado: se registra sin
    // clasificación normativa, pero sí debe citar la resolución que la autoriza.
    if (datos.es_laborable && datos.base_legal === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['base_legal'],
        message: 'Toda habilitación laborable requiere la resolución que la autoriza.',
      });
    }
  })
  .transform((datos) => ({
    ...datos,
    tipo_feriado: datos.es_laborable ? null : datos.tipo_feriado,
    unidad_territorial:
      datos.unidad_territorial ?? unidadTerritorialPorDefecto(datos.tipo_feriado),
  }));

export type FeriadoExcepcionalInput = z.infer<typeof esquemaFeriadoExcepcional>;

/** Query de `GET /api/v1/admin/calendario-laboral`. */
export const esquemaConsultaCalendario = z
  .object({
    anio: esquemaAnio.optional(),
    desde: esquemaFecha.optional(),
    hasta: esquemaFecha.optional(),
    incluir_inactivos: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  })
  .superRefine((datos, ctx) => {
    // La coherencia del rango es una regla de validación de entrada, no del
    // controller: se resuelve aquí para que el error llegue al middleware RFC.
    if (datos.desde && datos.hasta && datos.desde > datos.hasta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['desde'],
        message: 'El rango de fechas es inválido: "desde" es posterior a "hasta".',
      });
    }
  });

export type ConsultaCalendario = z.infer<typeof esquemaConsultaCalendario>;

/** Query de `GET /api/v1/admin/tablas-maestras`. */
export const esquemaConsultaTablasMaestras = z
  .object({
    solo_activos: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .default('true'),
    recargar: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .default('false'),
  })
  .strict();

export type ConsultaTablasMaestras = z.infer<typeof esquemaConsultaTablasMaestras>;
