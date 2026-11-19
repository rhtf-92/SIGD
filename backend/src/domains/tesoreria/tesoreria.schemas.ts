import { z } from 'zod';
const importe = z.string().regex(/^(?:0|[1-9]\d{0,11})\.\d{2}$/);
export const tarifaSchema = z.object({ procedimientoId: z.string().uuid(), importe,
  concepto: z.string().trim().min(5).max(300), fuente: z.string().trim().min(10).max(500), documentoId: z.string().uuid(),
  vigenteDesde: z.string().date(), vigenteHasta: z.string().date().optional() }).strict()
  .refine(v => !v.vigenteHasta || v.vigenteHasta >= v.vigenteDesde, 'Periodo inválido');
export const ordenSchema = z.object({ procedimientoId: z.string().uuid(), claveSolicitud: z.string().uuid(), expedienteId:z.string().uuid().optional(),cantidad:z.number().int().min(1).max(10000).optional() }).strict();
export const pagoSchema = z.object({ ordenId: z.string().uuid(), medio: z.enum(['CAJA','BANCO_NACION','TRANSFERENCIA']),
  entidad: z.string().trim().min(3).max(100).transform(v => v.toUpperCase()),
  referencia: z.string().trim().min(3).max(120).transform(v => v.toUpperCase()), fechaOperacion: z.string().datetime({ offset: true }), documentoId: z.string().uuid() }).strict();
export const revisionPagoSchema = z.object({ estado: z.enum(['EN_VERIFICACION','VERIFICADO','OBSERVADO','RECHAZADO','ANULADO']), motivo: z.string().trim().min(10).max(2000) }).strict();
export const devolucionSchema = z.object({ pagoId: z.string().uuid(), importe, motivo: z.enum(['TRAMITE_EQUIVOCADO','PAGO_DUPLICADO','PAGO_EXCESO','PAGO_INDEBIDO','CANCELACION','ERROR_OPERACION','OTRO']),
  sustento: z.string().trim().min(15).max(2000), documentoId: z.string().uuid().optional(), claveSolicitud: z.string().uuid() }).strict();
export const revisionDevolucionSchema = z.object({ estado: z.enum(['EN_EVALUACION','OBSERVADA','PENDIENTE_APROBACION','APROBADA','RECHAZADA','EN_PROCESO_DEVOLUCION','DEVUELTA','CERRADA']),
  motivo: z.string().trim().min(10).max(2000), entidad: z.string().trim().min(3).max(100).transform(v => v.toUpperCase()).optional(),
  referencia: z.string().trim().min(3).max(120).transform(v => v.toUpperCase()).optional(),
  fechaOperacion: z.string().datetime({ offset: true }).optional(), documentoId: z.string().uuid().optional(),
  confirmaEntregaEfectivo: z.literal(true).optional(), confirmaEjecucionExterna: z.literal(true).optional() }).strict();
export const busquedaSchema = z.object({ buscar: z.string().trim().max(120).default(''), estado: z.string().regex(/^[A-Z_]{1,30}$/).optional(),
  pagina: z.coerce.number().int().min(1).max(10000).default(1) }).strict();
export const subsanacionSchema=z.object({documentoId:z.string().uuid(),motivo:z.string().trim().min(15).max(1000),claveSolicitud:z.string().uuid(),devolucionId:z.string().uuid().optional()}).strict()
 .refine(v=>JSON.stringify({version:1,texto:v.motivo,documentoId:v.documentoId}).length<=2000,'El sustento excede el espacio documental disponible.');
export const periodoSchema = z.object({ desde: z.string().date(), hasta: z.string().date() }).strict()
  .refine(v => v.hasta >= v.desde && Date.parse(v.hasta) - Date.parse(v.desde) <= 366 * 86400000, 'Periodo máximo de 366 días');
