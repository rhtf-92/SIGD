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

export const TipoDocumentoSustentoEnum = z.enum(['PROVEIDO', 'MEMORANDO', 'OFICIO', 'INFORME']);
export type TipoDocumentoSustento = z.infer<typeof TipoDocumentoSustentoEnum>;

export const PrioridadDerivacionEnum = z.enum(['NORMAL', 'URGENTE', 'MUY_URGENTE']);
export type PrioridadDerivacion = z.infer<typeof PrioridadDerivacionEnum>;

/**
 * Contrato funcional (DTO) para el endpoint POST /api/v1/expedientes/:id/derivar
 */
export const DerivarExpedienteSchema = z.object({
  // Soporta derivación simple (1 elemento) y múltiple (>1 elemento).
  destinos: z.array(DestinoDerivacionSchema).min(1, { message: 'Debe especificar al menos un área de destino.' }),

  // Representa el requerimiento de "Proveído de atención" (T-BE-RD-06).
  // Se mapeará funcionalmente a la columna 'motivo' de la tabla derivacion_tramite.
  proveido: z.string().min(1, { message: 'El proveído o motivo de la derivación es obligatorio.' }),

  // Enriquecimiento institucional para trámites y despachos (Dirección General, Subdirección y Jefaturas)
  tipo_documento_sustento: TipoDocumentoSustentoEnum.default('PROVEIDO'),
  numero_documento_sustento: z.string().max(100).optional(),
  prioridad: PrioridadDerivacionEnum.default('NORMAL'),
  plazo_dias: z.number().int().min(1).max(120).optional(),
  instrucciones: z.string().max(1000).optional(),
});

// Tipos estǭticos inferidos para utilizarlos de forma fuertemente tipada en Controller y Service
export type DestinoDerivacionDTO = z.infer<typeof DestinoDerivacionSchema>;
export type DerivarExpedienteDTO = z.input<typeof DerivarExpedienteSchema>;
