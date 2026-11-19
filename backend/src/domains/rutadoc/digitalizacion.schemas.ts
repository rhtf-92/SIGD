import { z } from 'zod';

export const adjuntarDocumentoSchema = z.object({
  nombreArchivo: z.string().min(1, 'El nombre del archivo es requerido.').max(255),
  tamanoBytes: z.number().int().positive().max(26_214_400, 'El archivo excede el tamaño máximo permitido de 25 MB.'),
  mimeType: z.literal('application/pdf', {
    errorMap: () => ({ message: 'Únicamente se admiten documentos en formato PDF.' }),
  }),
  sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/, 'El hash SHA-256 debe contener 64 caracteres hexadecimales.'),
  storagePath: z.string().regex(/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i, 'La ruta de almacenamiento institucional no es válida.'),
  tipoDocumentalId: z.string().uuid('El identificador del tipo documental debe ser un UUID válido.').optional(),
  tipoDocumentalCodigo: z.string().optional(),
  folios: z.coerce.number().int().positive('La cantidad de folios debe ser mayor a cero.').default(1),
}).strict();

export type AdjuntarDocumentoInput = z.infer<typeof adjuntarDocumentoSchema>;

export interface ResultadoDigitalizacion {
  documentoId: string;
  expedienteId: string;
  nombreArchivo: string;
  folios: {
    folioInicio: number;
    folioFin: number;
    cantidad: number;
  };
  sha256: string;
  s3Bucket: string;
  s3Key: string;
  creadoEn: string;
}
