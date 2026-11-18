import { z } from "zod";

const tipoDocumentoIdentidadSchema = z.enum(["DNI", "RUC", "CE", "PASAPORTE"]);
const tipoDocumentoPresentadoSchema = z.enum([
  "SOLICITUD",
  "OFICIO",
  "CARTA",
  "MEMORANDUM",
  "INFORME",
  "EXPEDIENTE_EXTERNO",
]);
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const paso1DatosSolicitanteSchema = z
  .object({
    tipoDocumento: tipoDocumentoIdentidadSchema,
    numeroDocumento: z.string().trim().min(1, "Ingrese el número de documento."),
    nombres: z.string().trim().optional(),
    razonSocial: z.string().trim().optional(),
    email: z.email("Ingrese un correo electrónico válido."),
    telefono: z.string().trim().min(6, "Ingrese un teléfono válido."),
  })
  .superRefine((solicitante, context) => {
    if (!solicitante.nombres && !solicitante.razonSocial) {
      context.addIssue({
        code: "custom",
        path: ["nombres"],
        message: "Ingrese los nombres o la razón social.",
      });
    }
  });

export const paso2DatosDocumentoSchema = z.object({
  tipoDocumento: tipoDocumentoPresentadoSchema,
  numeroFolios: z.number().int().positive("Los folios deben ser un número positivo."),
  asunto: z
    .string()
    .trim()
    .min(10, "El asunto debe tener al menos 10 caracteres.")
    .max(500, "El asunto no puede exceder los 500 caracteres."),
});

const archivoAdjuntoSchema = z
  .file()
  .max(MAX_FILE_SIZE_BYTES, "Cada archivo debe pesar como máximo 25 MB.")
  .refine((file) => file.name.toLowerCase().endsWith(".pdf"), {
    message: "Los archivos adjuntos deben tener extensión PDF.",
  });

export const paso3AnexosSchema = z.object({
  anexos: z.array(archivoAdjuntoSchema).min(1, "Adjunte al menos un archivo PDF."),
});

export const paso4ConfirmacionSchema = z.object({
  declaracionJurada: z.literal(true, {
    error: "Debe aceptar la declaración jurada.",
  }),
  aceptacionTerminos: z.literal(true, {
    error: "Debe aceptar los términos y condiciones.",
  }),
});

export const pasosWizardSchemas = [
  paso1DatosSolicitanteSchema,
  paso2DatosDocumentoSchema,
  paso3AnexosSchema,
  paso4ConfirmacionSchema,
] as const;

export const tramiteWizardFormSchema = z.object({
  solicitante: paso1DatosSolicitanteSchema,
  documento: paso2DatosDocumentoSchema,
  anexos: paso3AnexosSchema,
  confirmacion: paso4ConfirmacionSchema,
});

export type TramiteWizardFormData = z.infer<typeof tramiteWizardFormSchema>;
