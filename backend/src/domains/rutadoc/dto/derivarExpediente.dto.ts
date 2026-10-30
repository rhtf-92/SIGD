import { z } from 'zod';

const REGEX_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Esquema de validación para un destino individual dentro de una derivación.
 * Representa los requerimientos funcionales de la tarea T-BE-RD-06.
 */
const DestinoDerivacionSchema = z.object({
  area_destino_id: z.string().trim().regex(REGEX_UUID, { message: 'El ID del área de destino debe ser un UUID válido.' }),

  // Requerido funcionalmente para "Copias Informativas" (T-BE-RD-06)
  es_copia: z.boolean().default(false),

  // Requerido funcionalmente para "Asignación de Responsable" (T-BE-RD-06)
  usuario_asignado_id: z.string().trim().regex(REGEX_UUID, { message: 'El ID del usuario asignado debe ser un UUID válido.' }).optional(),
});

/**
 * Contrato funcional (DTO) para el endpoint POST /api/v1/expedientes/:id/derivar
 */
export const DerivarExpedienteSchema = z.object({
  // Soporta derivación simple (1 elemento) y múltiple (>1 elemento).
  destinos: z.array(DestinoDerivacionSchema).min(1, { message: 'Debe especificar al menos un área de destino.' }),

  // Representa el requerimiento de "Proveído de atención" (T-BE-RD-06).
  // Se mapeará funcionalmente a la columna 'motivo' de la tabla derivacion_tramite.
  proveido: z.string().min(1, { message: 'El proveído o motivo de la derivación es obligatorio.' }),
});

// Tipos estáticos inferidos para utilizarlos de forma fuertemente tipada en Controller y Service
export type DestinoDerivacionDTO = z.infer<typeof DestinoDerivacionSchema>;
export type DerivarExpedienteDTO = z.infer<typeof DerivarExpedienteSchema>;
