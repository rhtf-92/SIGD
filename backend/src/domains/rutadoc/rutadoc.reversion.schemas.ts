import { z } from 'zod';
const MAX_BIGINT = 9223372036854775807n;

export function esIdNumericoPositivo(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[1-9]\d{0,18}$/.test(valor) && BigInt(valor) <= MAX_BIGINT;
}

export const reversionSchema = z.object({
  movimientoObjetivoId: z.string().refine(esIdNumericoPositivo, 'Movimiento objetivo inválido.'),
  motivo: z.string().trim().min(10).max(1000),
  claveIdempotencia: z.string().uuid(),
}).strict();
