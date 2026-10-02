import { z } from 'zod';

/**
 * Esquema de validación para un destino individual dentro de una derivación.
 * Representa los requerimientos funcionales de la tarea T-BE-RD-06.
 */
const DestinoDerivacionSchema = z.object({
  area_destino_id: z.string().uuid({ message: 'El ID del ǭrea de destino debe ser un UUID vǭlido.' }),

  // Requerido funcionalmente para "Copias Informativas" (T-BE-RD-06)
  es_copia: z.boolean().default(false),

  // Requerido funcionalmente para "Asignación de Responsable" (T-BE-RD-06)
  usuario_asignado_id: z.string().uuid({ message: 'El ID del usuario asignado debe ser un UUID vǭlido.' }).optional(),
});

/**
 * Contrato funcional (DTO) para el endpoint POST /api/v1/expedientes/:id/derivar
 */
export const DerivarExpedienteSchema = z.object({
  // Soporta derivacin simple (1 elemento) y mltiple (>1 elemento).
  destinos: z.array(DestinoDerivacionSchema).min(1, { message: 'Debe especificar al menos un rea de destino.' }),

  // Representa el requerimiento de "Provedo de atencin" (T-BE-RD-06).
  // Se mapearǭ funcionalmente a la columna 'motivo' de la tabla derivacion_tramite.
  proveido: z.string().min(1, { message: 'El provedo o motivo de la derivacin es obligatorio.' }),
});

// Tipos estǭticos inferidos para utilizarlos de forma fuertemente tipada en Controller y Service
export type DestinoDerivacionDTO = z.infer<typeof DestinoDerivacionSchema>;
export type DerivarExpedienteDTO = z.infer<typeof DerivarExpedienteSchema>;
