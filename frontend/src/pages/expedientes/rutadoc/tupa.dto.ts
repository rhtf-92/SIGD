import { z } from "zod";

import { uuid } from "./rutadoc.dto";

/**
 * Contexto TUPA persistido de un expediente, leído del endpoint
 * `GET /api/v1/tramites/expedientes/:expedienteId/tupa`.
 *
 * El backend responde `{ tupa: null }` cuando el expediente no tiene un
 * procedimiento TUPA vinculado; nunca infiere el vínculo desde el CUT.
 */
export const contextoTupaSchema = z.object({
  tupa: z.object({
    registroVersionId: uuid,
    codigoExterno: z.string().nullable(),
    codigo: z.string().nullable(),
    denominacion: z.string(),
    requisitos: z.array(z.unknown()).nullable(),
    monto: z.string().nullable(),
    fuente: z.string(),
    pagina: z.number().int().positive(),
    revision: z.number().int().nonnegative(),
    version: z.string().nullable(),
    estadoValidacion: z.string(),
    vinculadoEn: z.string().refine((v) => Number.isFinite(Date.parse(v)), "Fecha inválida"),
  }).nullable(),
});

export type ContextoTupaExpediente = z.infer<typeof contextoTupaSchema>;
export type ContextoTupa = NonNullable<ContextoTupaExpediente["tupa"]>;
