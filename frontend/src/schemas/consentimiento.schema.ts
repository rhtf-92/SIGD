import { z } from "zod";

/* Schema para Consentimiento Ley N° 29733 y Declaración Jurada (ENT-M01-04) */

export const consentimientoLey29733Schema = z.object({
  consentimientoLey29733: z.boolean().refine((val) => val === true, {
    message: "Debe aceptar el consentimiento de tratamiento de datos personales conforme a la Ley N° 29733",
  }),
  version: z.literal("1.0"),
  fechaAceptacion: z.string().datetime({
    message: "fechaAceptacion debe ser un string en formato ISO 8601 válido",
  }),
});

export type ConsentimientoLey29733 = z.infer<typeof consentimientoLey29733Schema>;