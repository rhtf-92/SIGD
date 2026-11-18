import { z } from 'zod';

export const TipoObservacionEnum = z.enum(['ADMINISTRATIVA', 'TECNICA']);
export type TipoObservacion = z.infer<typeof TipoObservacionEnum>;

export const CanalSubsanacionEnum = z.enum([
  'VENTANILLA_MESA_PARTES',
  'PORTAL_ESTUDIANTE',
  'CASILLA_ELECTRONICA',
]);
export type CanalSubsanacion = z.infer<typeof CanalSubsanacionEnum>;

export const RequisitoObservadoItemSchema = z.object({
  requisitoId: z.string().uuid({ message: 'El ID del requisito debe ser un UUID válido.' }),
  descripcionIncumplimiento: z
    .string()
    .min(5, { message: 'El detalle del incumplimiento debe tener al menos 5 caracteres.' })
    .max(2000, { message: 'El detalle del incumplimiento no puede exceder 2000 caracteres.' }),
});
export type RequisitoObservadoItem = z.infer<typeof RequisitoObservadoItemSchema>;

export const CrearObservacionRutaDocSchema = z.object({
  tipoObservacion: TipoObservacionEnum.default('ADMINISTRATIVA'),
  motivo: z
    .string()
    .min(10, { message: 'El motivo de la observación debe tener al menos 10 caracteres.' })
    .max(2000, { message: 'El motivo de la observación no puede exceder 2000 caracteres.' }),
  sustentoTecnico: z.string().max(2000).optional().nullable(),
  plazoDias: z
    .number()
    .int()
    .min(1, { message: 'El plazo mínimo es de 1 día hábil.' })
    .max(30, { message: 'El plazo máximo es de 30 días hábiles.' })
    .default(5),
  requisitos: z.array(RequisitoObservadoItemSchema).optional().default([]),
  justificacionExcepcionPreclusion: z.string().max(1000).optional().nullable(),
});
export type CrearObservacionRutaDocDTO = z.infer<typeof CrearObservacionRutaDocSchema>;

export const RegistrarSubsanacionRutaDocSchema = z.object({
  observacionId: z.string().uuid({ message: 'El ID de la observación debe ser un UUID válido.' }).optional(),
  motivo: z
    .string()
    .min(5, { message: 'La descripción de la subsanación debe tener al menos 5 caracteres.' })
    .max(3000, { message: 'La descripción no puede exceder 3000 caracteres.' }),
  sustentoSubsanacion: z.string().max(3000).optional().nullable(),
  documentoAdjuntoId: z.string().uuid({ message: 'El ID del documento debe ser un UUID válido.' }).optional().nullable(),
  documentosAdjuntos: z.array(z.string()).optional().default([]),
  canalRecepcion: CanalSubsanacionEnum.optional(),
});
export type RegistrarSubsanacionRutaDocDTO = z.infer<typeof RegistrarSubsanacionRutaDocSchema>;
