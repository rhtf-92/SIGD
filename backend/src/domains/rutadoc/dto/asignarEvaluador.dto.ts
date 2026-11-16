import { z } from 'zod';

export const AsignarEvaluadorSchema = z.object({
  idUsuarioDocente: z
    .string()
    .uuid({ message: 'El identificador del docente debe ser un UUID válido.' }),
  motivoAsignacion: z
    .string()
    .min(5, { message: 'El motivo de asignación debe tener al menos 5 caracteres.' })
    .max(1000, { message: 'El motivo de asignación no puede exceder 1000 caracteres.' }),
  observaciones: z.string().max(2000).optional().nullable(),
});

export type AsignarEvaluadorDTO = z.infer<typeof AsignarEvaluadorSchema>;

export const ReasignarEvaluadorSchema = z.object({
  idNuevoDocente: z
    .string()
    .uuid({ message: 'El identificador del nuevo docente debe ser un UUID válido.' }),
  motivoAsignacion: z
    .string()
    .min(5, { message: 'El motivo de asignación debe tener al menos 5 caracteres.' })
    .max(1000, { message: 'El motivo de asignación no puede exceder 1000 caracteres.' }),
  justificacionReasignacion: z
    .string()
    .min(10, { message: 'La justificación de reasignación debe tener al menos 10 caracteres conforme a normativa.' })
    .max(2000, { message: 'La justificación de reasignación no puede exceder 2000 caracteres.' }),
  observaciones: z.string().max(2000).optional().nullable(),
});

export type ReasignarEvaluadorDTO = z.infer<typeof ReasignarEvaluadorSchema>;

export const ReasignacionMasivaSchema = z.object({
  expedienteIds: z
    .array(z.string().uuid({ message: 'Cada identificador debe ser un UUID válido.' }))
    .min(1, { message: 'Debe especificar al menos un expediente para reasignar.' })
    .max(100, { message: 'El lote no puede exceder 100 expedientes simultáneos.' }),
  idNuevoDocente: z
    .string()
    .uuid({ message: 'El identificador del nuevo docente debe ser un UUID válido.' }),
  motivoAsignacion: z
    .string()
    .min(5, { message: 'El motivo de asignación debe tener al menos 5 caracteres.' })
    .max(1000, { message: 'El motivo de asignación no puede exceder 1000 caracteres.' }),
  justificacionReasignacion: z
    .string()
    .min(10, { message: 'La justificación de reasignación debe tener al menos 10 caracteres conforme a normativa.' })
    .max(2000, { message: 'La justificación de reasignación no puede exceder 2000 caracteres.' }),
  observaciones: z.string().max(2000).optional().nullable(),
});

export type ReasignacionMasivaDTO = z.infer<typeof ReasignacionMasivaSchema>;
