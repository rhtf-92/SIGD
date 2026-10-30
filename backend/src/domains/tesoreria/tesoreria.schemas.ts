import { z } from 'zod';

export const generarOrdenPagoSchema = z.object({
  expedienteId: z.string().trim().uuid('expedienteId debe ser un UUID válido.'),
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
