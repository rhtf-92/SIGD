import { z } from 'zod';

/**
 * Contrato funcional (DTO) para el endpoint POST /api/v1/expedientes/:id/atender
 * 
 * NOTA DE ARQUITECTURA: No incluye unidad_organica_id. 
 * Por orden directa (B_JACOBO), se rechaza inyectar el área del usuario desde el
 * cliente para evitar simulaciones de seguridad (Broken Access Control).
 */
export const AtenderExpedienteSchema = z.object({
  resultado_resumen: z.string().min(1, { message: 'El resumen de la atenciǭn es obligatorio.' })
});

export type AtenderExpedienteDTO = z.infer<typeof AtenderExpedienteSchema>;
