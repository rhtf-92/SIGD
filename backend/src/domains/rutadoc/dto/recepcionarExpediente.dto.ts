import { z } from 'zod';

/**
 * Contrato funcional (DTO) para el endpoint POST /api/v1/expedientes/:id/recepcionar
 * (T-BE-RD-12 / FASE 7B).
 *
 * NOTA DE ARQUITECTURA: No incluye unidad_organica_id ni usuario_id.
 * Por orden institucional (B_JACOBO), se rechaza inyectar el área o el operador
 * desde el payload del cliente para evitar riesgos de escalación de privilegios (Broken Access Control).
 * La identidad y el área se resuelven exclusivamente desde el token institucional verificado y la base de datos.
 */
export const RecepcionarExpedienteSchema = z
  .object({
    observaciones: z
      .string()
      .trim()
      .max(1000, { message: 'Las observaciones no pueden exceder los 1000 caracteres.' })
      .optional(),
    canalRecepcion: z
      .enum(['MESA_PRESENCIAL', 'MESA_VIRTUAL'])
      .optional(),
    cantidadFolios: z
      .number()
      .int()
      .positive({ message: 'La cantidad de folios debe ser un número entero positivo.' })
      .optional(),
    cantidadDocumentos: z
      .number()
      .int()
      .positive({ message: 'La cantidad de documentos debe ser un número entero positivo.' })
      .optional(),
    generarCargo: z
      .boolean()
      .optional(),
  })
  .strict();

export type RecepcionarExpedienteDTO = z.infer<typeof RecepcionarExpedienteSchema>;
