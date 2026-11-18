import { z } from 'zod';

const REGEX_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const MSG_ASIGNACION_EMBEBIDA_NO_PERMITIDA =
  'ASIGNACION_EMBEBIDA_NO_PERMITIDA: La asignación individual de un expediente debe realizarse a través del servicio formal POST /api/v1/expedientes/:id/asignar.';

/**
 * Esquema de validación para un destino individual dentro de una derivación.
 * Representa los requerimientos funcionales canónicos de RutaDoc.
 *
 * REGLA DE SEGURIDAD (POST-CIERRE):
 * La asignación embebida (usuario_asignado_id / persona_asignada_id) queda ESTRICTAMENTE PROHIBIDA
 * en la derivación documental. Toda asignación individual debe canalizarse exclusivamente por
 * el endpoint formal POST /api/v1/expedientes/:id/asignar.
 */
const DestinoDerivacionSchema = z
  .object({
    area_destino_id: z.string().trim().regex(REGEX_UUID, { message: 'El ID del área de destino debe ser un UUID válido.' }),
    // Requerido funcionalmente para "Copias Informativas" (T-BE-RD-06)
    es_copia: z.boolean().default(false),
    // Campos legados explicitamente capturados para rechazo inmediato con código canónico
    usuario_asignado_id: z.unknown().optional(),
    persona_asignada_id: z.unknown().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.usuario_asignado_id !== undefined || val.persona_asignada_id !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG_ASIGNACION_EMBEBIDA_NO_PERMITIDA,
      });
    }
  });

/**
 * Contrato funcional (DTO) para el endpoint POST /api/v1/expedientes/:id/derivar
 */
export const DerivarExpedienteSchema = z
  .object({
    // Soporta derivación simple (1 elemento) y múltiple (>1 elemento).
    destinos: z.array(DestinoDerivacionSchema).min(1, { message: 'Debe especificar al menos un área de destino.' }),
    // Representa el requerimiento de "Proveído de atención" (T-BE-RD-06).
    // Se mapeará funcionalmente a la columna 'motivo' de la tabla derivacion_tramite.
    proveido: z.string().min(1, { message: 'El proveído o motivo de la derivación es obligatorio.' }),
    clave_idempotencia: z.string().trim().optional(),
    es_correccion: z.boolean().default(false).optional(),
    motivo: z.string().optional(),
    justificacion_desviacion: z.string().trim().optional(),
    // Captura de asignación embebida a nivel raíz para rechazo canónico
    usuario_asignado_id: z.unknown().optional(),
    persona_asignada_id: z.unknown().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.usuario_asignado_id !== undefined || val.persona_asignada_id !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG_ASIGNACION_EMBEBIDA_NO_PERMITIDA,
      });
    }
  });

// Tipos estáticos inferidos para utilizarlos de forma fuertemente tipada en Controller y Service
export type DestinoDerivacionDTO = z.infer<typeof DestinoDerivacionSchema>;
export type DerivarExpedienteDTO = z.infer<typeof DerivarExpedienteSchema>;
