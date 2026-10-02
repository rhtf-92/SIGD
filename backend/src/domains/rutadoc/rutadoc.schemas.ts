import { z } from 'zod';
import { esIdExpediente } from './rutadoc.cursor.js';
import { ESTADOS_POR_PESTANA } from './rutadoc.types.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (valor) => !Number.isNaN(Date.parse(`${valor}T00:00:00.000Z`)) &&
    new Date(`${valor}T00:00:00.000Z`).toISOString().slice(0, 10) === valor,
  'Fecha calendario inválida.',
);

export const filtrosSchema = z.object({
  pestana: z.enum(Object.keys(ESTADOS_POR_PESTANA) as [keyof typeof ESTADOS_POR_PESTANA, ...Array<keyof typeof ESTADOS_POR_PESTANA>]),
  cursor: z.string().min(1).max(1024).optional(),
  limite: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
  terminoBusqueda: z.string().trim().min(1).max(100).optional(),
  areaId: z.string().uuid().optional(),
  fechaDesde: fecha.optional(),
  fechaHasta: fecha.optional(),
}).strict().superRefine((valor, ctx) => {
  if (valor.fechaDesde && valor.fechaHasta && valor.fechaDesde > valor.fechaHasta) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fechaHasta'], message: 'Debe ser igual o posterior a fechaDesde.' });
  }
});

export const idSchema = z.string().refine(esIdExpediente, 'ID de expediente inválido.');
