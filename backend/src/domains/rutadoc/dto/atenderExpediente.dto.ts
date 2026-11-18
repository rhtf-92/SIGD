import { z } from 'zod';

/**
 * Contrato funcional (DTO) para el endpoint POST /api/v1/expedientes/:id/atender
 * 
 * NOTA DE ARQUITECTURA: No incluye unidad_organica_id. 
 * Por orden directa (B_JACOBO), se rechaza inyectar el área del usuario desde el
 * cliente para evitar simulaciones de seguridad (Broken Access Control).
 */
export const AtenderExpedienteSchema = z.object({
  resultado_resumen: z.string().min(1, { message: 'El resumen de la atención es obligatorio.' }),
  observacion_interna: z.string().optional(),
  documento_respuesta_id: z.string().uuid().optional(),
  s3_key: z.string().optional(),
  sha256: z.string().optional(),
  nombre_archivo: z.string().optional(),
  tamano_bytes: z.number().optional(),
  mime_type: z.string().optional(),
});

export type AtenderExpedienteDTO = z.infer<typeof AtenderExpedienteSchema>;
