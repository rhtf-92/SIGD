import { z } from 'zod';

export const ObservarEvaluacionSchema = z.object({
  motivo: z
    .string()
    .min(10, { message: 'El motivo de la observación debe tener al menos 10 caracteres.' })
    .max(2000, { message: 'El motivo de la observación no puede exceder 2000 caracteres.' }),
  sustentoTecnico: z.string().max(2000).optional().nullable(),
  plazoDias: z
    .number()
    .int()
    .min(1, { message: 'El plazo mínimo de subsanación es de 1 día hábil.' })
    .max(30, { message: 'El plazo máximo de subsanación no puede exceder 30 días hábiles.' })
    .default(5),
  requisitosObservados: z.array(z.string()).optional().default([]),
});

export type ObservarEvaluacionDTO = z.infer<typeof ObservarEvaluacionSchema>;

export const SubsanarExpedienteSchema = z.object({
  motivo: z
    .string()
    .min(5, { message: 'El motivo o sustento de subsanación debe tener al menos 5 caracteres.' })
    .max(2000, { message: 'El motivo no puede exceder 2000 caracteres.' }),
  sustentoSubsanacion: z.string().max(3000).optional().nullable(),
  documentosAdjuntos: z.array(z.string()).optional().default([]),
});

export type SubsanarExpedienteDTO = z.infer<typeof SubsanarExpedienteSchema>;

export const EmitirDictamenSchema = z.object({
  resultado: z.enum(['FAVORABLE', 'DESFAVORABLE'], {
    message: 'El resultado del dictamen técnico debe ser FAVORABLE o DESFAVORABLE.',
  }),
  fundamentacion: z
    .string()
    .min(10, { message: 'La fundamentación técnica del dictamen debe tener al menos 10 caracteres.' })
    .max(4000, { message: 'La fundamentación no puede exceder 4000 caracteres.' }),
  recomendaciones: z.string().max(2000).optional().nullable(),
  requisitosAprobados: z.array(z.string()).optional().default([]),
});

export type EmitirDictamenDTO = z.infer<typeof EmitirDictamenSchema>;
export type EmitirDictamenPayload = z.infer<typeof EmitirDictamenSchema>;

export const FiltrosBandejaDocenteSchema = z.object({
  estadoEvaluacion: z.string().optional(),
  estadoExpediente: z.string().optional(),
  codigoExpediente: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  limite: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type FiltrosBandejaDocenteDTO = z.infer<typeof FiltrosBandejaDocenteSchema>;
