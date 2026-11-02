import { z } from 'zod';

export const generarOrdenPagoSchema = z.object({
  expedienteId: z.string().trim().uuid('expedienteId debe ser un UUID válido.'),
  confirmarPagoAdicional: z.boolean().optional().default(false),
  motivoAdicional: z.string().trim().min(5, 'El motivo del pago adicional debe contener al menos 5 caracteres.').max(500).optional(),
}).strict();

export const confirmarPagoSchema = z.object({
  metodoPago: z.enum(['EFECTIVO', 'YAPE', 'QR_AUTOMATICO_SANDBOX'], {
    message: 'El método de pago debe ser EFECTIVO, YAPE o QR_AUTOMATICO_SANDBOX.',
  }),
  montoRecibido: z.number().positive('El monto recibido debe ser mayor a 0.').optional().nullable(),
  referenciaOperacion: z.string().trim().min(4, 'La referencia de operación debe tener al menos 4 caracteres.').max(100).optional().nullable(),
}).refine((data) => {
  if (data.metodoPago === 'YAPE' && (!data.referenciaOperacion || data.referenciaOperacion.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Para pagos con Yape es obligatorio ingresar el número o referencia de operación.',
  path: ['referenciaOperacion'],
});

export const rechazarPagoSchema = z.object({
  motivo: z.string().trim().min(5, 'El motivo de rechazo debe contener al menos 5 caracteres descriptivos.').max(500),
}).strict();

export const buscarOrdenesQuerySchema = z.object({
  estado: z.enum(['PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'VENCIDO', 'ANULADO', 'TODOS']).optional(),
  buscar: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const buscarPersonaQuerySchema = z.object({
  tipoDocumento: z.enum(['DNI', 'CE', 'RUC']).default('DNI'),
  numeroDocumento: z.string().trim().min(6).max(20),
});

export const registrarPersonaPresencialSchema = z.object({
  tipoPersona: z.enum(['NATURAL', 'JURIDICA']).default('NATURAL'),
  tipoDocumento: z.enum(['DNI', 'CE', 'RUC']).default('DNI'),
  numeroDocumento: z.string().trim().min(6).max(20),
  nombres: z.string().trim().min(2).max(150).optional(),
  apellidos: z.string().trim().min(2).max(150).optional(),
  razonSocial: z.string().trim().min(3).max(255).optional(),
  correo: z.string().trim().email().optional().nullable().or(z.literal('')),
  telefono: z.string().trim().min(6).max(20).optional().nullable().or(z.literal('')),
  direccion: z.string().trim().max(255).optional().nullable().or(z.literal('')),
}).refine((data) => {
  if (data.tipoPersona === 'NATURAL') {
    if (data.tipoDocumento === 'RUC') return false;
    if (data.tipoDocumento === 'DNI' && !/^[0-9]{8}$/.test(data.numeroDocumento)) return false;
    if (data.tipoDocumento === 'CE' && !/^[A-Za-z0-9]{9,12}$/.test(data.numeroDocumento)) return false;
    return Boolean(data.nombres && data.apellidos);
  }
  if (data.tipoPersona === 'JURIDICA') {
    if (data.tipoDocumento !== 'RUC') return false;
    if (!/^[0-9]{11}$/.test(data.numeroDocumento)) return false;
    return Boolean(data.razonSocial);
  }
  return false;
}, {
  message: 'Inconsistencia en tipo de persona y documento: NATURAL solo acepta DNI (8 dígitos) o CE (9-12 caracteres); JURIDICA solo acepta RUC (11 dígitos) y requiere razón social.',
});

// ---------------------------------------------------------------------------
// Schemas para Devoluciones de Pago (Fase 3)
// ---------------------------------------------------------------------------

export const solicitarDevolucionSchema = z.object({
  expedienteId: z.string().trim().uuid('expedienteId debe ser un UUID válido.'),
  ordenPagoId: z.string().trim().uuid('ordenPagoId debe ser un UUID válido.'),
  causal: z.enum(['SOBREPAGO', 'PAGO_DUPLICADO', 'PAGO_INDEBIDO', 'DESISTIMIENTO', 'TRAMITE_DENEGADO', 'OTRO'], {
    message: 'La causal debe ser SOBREPAGO, PAGO_DUPLICADO, PAGO_INDEBIDO, DESISTIMIENTO, TRAMITE_DENEGADO u OTRO.',
  }),
  motivo: z.string().trim().min(10, 'El motivo debe contener al menos 10 caracteres fundamentados.').max(1000),
  montoSolicitado: z.number().positive('El monto solicitado debe ser mayor a 0.'),
}).strict();

export const observarDevolucionSchema = z.object({
  motivoObservacion: z.string().trim().min(5, 'El motivo de la observación debe contener al menos 5 caracteres.').max(1000),
}).strict();

export const subsanarDevolucionSchema = z.object({
  sustentoSubsanacion: z.string().trim().min(5, 'El sustento de subsanación debe contener al menos 5 caracteres.').max(1000),
}).strict();

export const aprobarDevolucionSchema = z.object({
  montoAutorizado: z.number().positive('El monto autorizado debe ser mayor a 0.'),
  observacionResolucion: z.string().trim().max(1000).optional(),
}).strict();

export const rechazarDevolucionSchema = z.object({
  motivoRechazo: z.string().trim().min(5, 'El motivo del rechazo debe contener al menos 5 caracteres.').max(1000),
}).strict();

export const ejecutarDevolucionSchema = z.object({
  metodoDevolucion: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'YAPE', 'CHEQUE'], {
    message: 'El método de devolución debe ser EFECTIVO, TRANSFERENCIA, YAPE o CHEQUE.',
  }),
  observacion: z.string().trim().max(1000).optional(),
}).strict();

export const buscarDevolucionesQuerySchema = z.object({
  estado: z.enum([
    'SOLICITADA',
    'EN_REVISION',
    'OBSERVADA',
    'SUBSANADA',
    'APROBADA',
    'PENDIENTE_TESORERIA',
    'DEVUELTA',
    'RECHAZADA',
    'ANULADA',
    'TODAS',
  ]).optional(),
  buscar: z.string().trim().max(100).optional(),
  expedienteId: z.string().trim().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
