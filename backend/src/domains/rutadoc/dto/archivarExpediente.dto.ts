import { z } from 'zod';

export const ArchivarExpedienteSchema = z.object({
  estante: z.string().min(1, 'El estante es obligatorio'),
  balda: z.string().min(1, 'La balda es obligatoria'),
  caja: z.string().min(1, 'La caja es obligatoria'),
  observaciones: z.string().optional()
});

export type ArchivarExpedienteDTO = z.infer<typeof ArchivarExpedienteSchema>;
