import { z } from 'zod';

export const CalificarRequisitoSchema = z.object({
  cumplido: z.boolean(),
  documentoAdjuntoId: z.string().uuid().optional().nullable(),
});
export type CalificarRequisitoDTO = z.infer<typeof CalificarRequisitoSchema>;

export const ObservarRequisitoSchema = z.object({
  requisitoId: z.string().uuid(),
  motivo: z.string().min(10).max(2000),
  plazoDias: z.number().int().min(1).max(30).default(5),
});
export type ObservarRequisitoDTO = z.infer<typeof ObservarRequisitoSchema>;
