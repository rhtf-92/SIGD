import { z } from 'zod';
import { esSecuenciaMovimiento } from './rutadoc.cursor.js';

export const reversionSchema = z.object({
  movimientoObjetivoId: z.string().refine(esSecuenciaMovimiento, 'Movimiento objetivo inválido.'),
  motivo: z.string().trim().min(10).max(1000),
  claveIdempotencia: z.string().uuid(),
}).strict();
