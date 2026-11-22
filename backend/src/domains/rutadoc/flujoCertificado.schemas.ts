import { z } from 'zod';

const REGEX_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const REGEX_SHA256 = /^[0-9a-fA-F]{64}$/;

export const IniciarFlujoCertificadoSchema = z.object({
  codigo_procedimiento: z.string().trim().min(2).max(60).default('p1-fila-06'),
  nombre_tramite: z.string().trim().min(3).max(250).default('Certificado de Inglés'),
  canal_entrega: z.enum(['DIGITAL', 'PRESENCIAL']).default('DIGITAL'),
  plazo_recojo_dias: z.coerce.number().int().min(1).max(365).default(30),
});
export type IniciarFlujoCertificadoDTO = z.infer<typeof IniciarFlujoCertificadoSchema>;

export const ValidarRequisitosMpSchema = z.object({
  observaciones: z.string().trim().max(1000).optional(),
});
export type ValidarRequisitosMpDTO = z.infer<typeof ValidarRequisitosMpSchema>;

export const DerivarMesaPartesSdaSchema = z.object({
  area_destino_id: z.string().trim().regex(REGEX_UUID, 'El ID de área destino debe ser un UUID válido.').optional(),
  proveido: z.string().trim().min(5, 'El proveído debe tener al menos 5 caracteres.').max(1000),
  requisitos_validados: z.boolean().default(true),
  clave_idempotencia: z.string().trim().min(4).max(120).optional(),
});
export type DerivarMesaPartesSdaDTO = z.infer<typeof DerivarMesaPartesSdaSchema>;

export const DerivarSdaEspecialistaSchema = z.object({
  especialista_usuario_id: z.string().trim().regex(REGEX_UUID, 'especialista_usuario_id debe ser un UUID válido.'),
  especialista_persona_id: z.string().trim().regex(REGEX_UUID, 'especialista_persona_id debe ser un UUID válido.').optional(),
  motivo: z.string().trim().min(5, 'El motivo de asignación/derivación es obligatorio.').max(1000),
});
export type DerivarSdaEspecialistaDTO = z.infer<typeof DerivarSdaEspecialistaSchema>;

export const EmitirMemorandumCentroIdiomasSchema = z.object({
  numero_memorandum: z.string().trim().min(3, 'El número de memorándum es obligatorio.').max(80),
  proveido: z.string().trim().min(5, 'El proveído o disposición debe tener al menos 5 caracteres.').max(1000),
  idioma: z.string().trim().min(2).max(50).default('Inglés'),
});
export type EmitirMemorandumCentroIdiomasDTO = z.infer<typeof EmitirMemorandumCentroIdiomasSchema>;

export const AsignarEspecialistaIdiomaSchema = z.object({
  especialista_usuario_id: z.string().trim().regex(REGEX_UUID, 'especialista_usuario_id debe ser un UUID válido.'),
  especialista_persona_id: z.string().trim().regex(REGEX_UUID, 'especialista_persona_id debe ser un UUID válido.').optional(),
  idioma: z.string().trim().min(2).max(50).default('Inglés'),
  motivo: z.string().trim().min(5, 'El proveído o indicación de encargo debe tener al menos 5 caracteres.').max(1000),
});
export type AsignarEspecialistaIdiomaDTO = z.infer<typeof AsignarEspecialistaIdiomaSchema>;

export const ProgramarEvaluacionSchema = z.object({
  fecha_evaluacion: z.string().trim().datetime({ message: 'fecha_evaluacion debe ser una fecha ISO 8601 válida.' }),
  modalidad: z.enum(['PRESENCIAL', 'VIRTUAL', 'MIXTA']).default('PRESENCIAL'),
  lugar_enlace: z.string().trim().min(3, 'Debe especificar el aula, sede o enlace de evaluación.').max(500),
  observaciones: z.string().trim().max(1000).optional(),
});
export type ProgramarEvaluacionDTO = z.infer<typeof ProgramarEvaluacionSchema>;

export const CalificarEvaluacionSchema = z
  .object({
    asistio: z.boolean(),
    nota: z.coerce.number().min(0).max(100).optional(),
    nivel_mcer: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
    resultado: z.enum(['APROBADO', 'DESAPROBADO', 'NSP']).optional(),
    observaciones: z.string().trim().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.asistio && val.resultado === 'NSP') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resultado'],
        message: 'Si el solicitante asistió, el resultado no puede ser NSP.',
      });
    }
    if (val.asistio && val.nota === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nota'],
        message: 'Debe registrar la calificación numérica (0 a 100) cuando el solicitante asistió.',
      });
    }
    if (!val.asistio && val.resultado && val.resultado !== 'NSP') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resultado'],
        message: 'Cuando asistio=false, el resultado debe ser NSP.',
      });
    }
  });
export type CalificarEvaluacionDTO = z.infer<typeof CalificarEvaluacionSchema>;

export const EmitirInformeEspecialistaSchema = z.object({
  numero_informe: z.string().trim().min(3, 'El número de informe es obligatorio.').max(80),
  tipo_informe: z.enum(['RESULTADOS', 'INASISTENCIA_NSP']).optional(),
  resumen: z.string().trim().min(10, 'El resumen del informe debe tener al menos 10 caracteres.').max(2000),
  documento_id: z.string().trim().regex(REGEX_UUID).optional(),
  nombre_archivo: z.string().trim().min(3).max(255).optional(),
  s3_key: z.string().trim().min(5).max(500).optional(),
  sha256: z.string().trim().regex(REGEX_SHA256).optional(),
  tamano_bytes: z.coerce.number().int().positive().optional(),
});
export type EmitirInformeEspecialistaDTO = z.infer<typeof EmitirInformeEspecialistaSchema>;

export const EmitirCertificadoSdaSchema = z.object({
  codigo_certificado: z.string().trim().min(3, 'El código del certificado es obligatorio.').max(80),
  sello_firma_sda: z.string().trim().min(3, 'La constancia o sello de firma de Subdirección Académica es obligatoria.').max(500),
  resultado_resumen: z.string().trim().min(5).max(2000).default('Certificado emitido y suscrito por Subdirección Académica'),
  observacion_interna: z.string().trim().max(1000).optional(),
  documento_certificado_id: z.string().trim().regex(REGEX_UUID).optional(),
  nombre_archivo: z.string().trim().min(3).max(255).optional(),
  s3_key: z.string().trim().min(5).max(500).optional(),
  sha256: z.string().trim().regex(REGEX_SHA256).optional(),
  tamano_bytes: z.coerce.number().int().positive().optional(),
});
export type EmitirCertificadoSdaDTO = z.infer<typeof EmitirCertificadoSdaSchema>;

export const CerrarInasistenciaSdaSchema = z.object({
  motivo_improcedencia: z.string().trim().min(10, 'Debe motivar la declaratoria de improcedencia por inasistencia (NSP).').max(2000),
  solo_improcedente: z.boolean().default(false),
  estante: z.string().trim().min(1).max(60).default('ARCH-NSP'),
  balda: z.string().trim().min(1).max(60).default('B1'),
  caja: z.string().trim().min(1).max(60).default('C-NSP'),
});
export type CerrarInasistenciaSdaDTO = z.infer<typeof CerrarInasistenciaSdaSchema>;

export const VisarFirmarDireccionSchema = z.object({
  visto_bueno: z.boolean(),
  canal_entrega: z.enum(['DIGITAL', 'PRESENCIAL']).optional(),
  plazo_recojo_dias: z.coerce.number().int().min(1).max(365).optional(),
  cvd: z.string().trim().min(6).max(60).optional(),
  sha256_firmado: z.string().trim().regex(REGEX_SHA256, 'sha256_firmado debe tener 64 caracteres hexadecimales.').optional(),
  documento_firmado_id: z.string().trim().regex(REGEX_UUID).optional(),
  s3_key: z.string().trim().min(5).max(500).optional(),
  nombre_archivo: z.string().trim().min(3).max(255).optional(),
  resultado_resumen: z.string().trim().min(5).max(2000).default('Visto Bueno (V/B) y Firma Digital completados por Dirección General'),
});
export type VisarFirmarDireccionDTO = z.infer<typeof VisarFirmarDireccionSchema>;

export const ConfirmarEntregaPresencialSchema = z.object({
  dni_receptor: z.string().trim().min(8).max(20),
  nombre_receptor: z.string().trim().min(3).max(200),
  observaciones: z.string().trim().max(1000).optional(),
});
export type ConfirmarEntregaPresencialDTO = z.infer<typeof ConfirmarEntregaPresencialSchema>;

export const ArchivarNoRecojoSchema = z.object({
  fecha_evaluacion: z.string().trim().datetime().optional(),
  estante: z.string().trim().min(1, 'El estante de custodia es obligatorio.').max(60).default('CUSTODIA-01'),
  balda: z.string().trim().min(1, 'La balda de custodia es obligatoria.').max(60).default('B1'),
  caja: z.string().trim().min(1, 'La caja de custodia es obligatoria.').max(60).default('C-NO-RECOGIDO'),
  observaciones: z.string().trim().max(1000).optional(),
});
export type ArchivarNoRecojoDTO = z.infer<typeof ArchivarNoRecojoSchema>;
