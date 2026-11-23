import { z } from 'zod';

export const TipoAnotacionInternaSchema = z.enum(['SEGUIMIENTO', 'SUPERVISION', 'INCIDENCIA']);
export type TipoAnotacionInterna = z.infer<typeof TipoAnotacionInternaSchema>;

export const CrearAnotacionInternaSchema = z.object({
  tipoAnotacion: TipoAnotacionInternaSchema.default('SEGUIMIENTO'),
  contenido: z
    .string({ required_error: 'El contenido de la anotación es obligatorio.' })
    .trim()
    .min(10, 'El contenido de la anotación debe tener al menos 10 caracteres.')
    .max(2000, 'El contenido de la anotación no puede exceder los 2,000 caracteres.'),
  anotacionPadreId: z
    .string()
    .uuid('El identificador de anotación padre debe ser un UUID válido.')
    .nullable()
    .optional(),
}).strict();

export type CrearAnotacionInternaDTO = z.infer<typeof CrearAnotacionInternaSchema>;

export interface AnotacionInternaItem {
  idAnotacion: string;
  expedienteId: string;
  idAsignacion?: string | null;
  usuarioId: string;
  autorNombreCompleto: string;
  autorUsuario: string;
  autorCorreo: string;
  rolCodigo: string;
  rolNombre?: string;
  areaId: string;
  areaCodigo?: string;
  areaNombre?: string;
  tipoAnotacion: TipoAnotacionInterna;
  contenido: string;
  anotacionPadreId?: string | null;
  creadoEn: string;
}

export interface RespuestaListarAnotaciones {
  ok: boolean;
  total: number;
  anotaciones: AnotacionInternaItem[];
}
