import { z } from "zod";

export const PESTANAS = ["PENDIENTES", "EN_TRAMITE", "DERIVADOS", "POR_FIRMAR", "ATENDIDOS", "ARCHIVADOS"] as const;
export type Pestana = typeof PESTANAS[number];
export const ETIQUETAS: Record<Pestana, string> = {
  PENDIENTES: "Pendientes", EN_TRAMITE: "En trámite", DERIVADOS: "Derivados",
  POR_FIRMAR: "Por firmar", ATENDIDOS: "Atendidos", ARCHIVADOS: "Archivados",
};
export const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const fecha = z.string().refine(v => Number.isFinite(Date.parse(v)), "Fecha inválida");
const entero = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const decimal = z.string().max(19).refine(v =>
  /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n, "Secuencia u operador inválido");
const estado = z.enum(["REGISTRADO", "RECEPCIONADO", "EN_CALIFICACION", "EN_REVISION", "OBSERVADO", "SUBSANADO", "DERIVADO", "EN_FIRMA", "RESUELTO", "ARCHIVADO"]);
export const resumenSchema = z.object({
  idExpediente: uuid, cut: z.string(), asunto: z.string(), fechaRadicacion: fecha,
  estadoActual: estado, areaActualId: z.string().nullable(),
});
export const detalleSchema = resumenSchema.extend({
  solicitanteId: uuid.nullable(),
  resumenDocumentos: z.object({
    cantidadDocumentos: entero,
    totalFolios: entero,
    cantidadFoliados: entero.optional(),
  }).nullable(),
  ultimoMovimiento: z.object({ idMovimiento: uuid, evento: z.string(), estadoNuevo: estado,
    fechaHora: fecha, usuarioOperadorId: decimal }).nullable(), sla: z.null(),
});
export const bandejaSchema = z.object({
  elementos: z.array(resumenSchema), siguienteCursor: z.string().min(1).nullable(), tieneMas: z.boolean(),
  contadores: z.object({ PENDIENTES: entero, EN_TRAMITE: entero, DERIVADOS: entero,
    POR_FIRMAR: entero, ATENDIDOS: entero, ARCHIVADOS: entero }),
}).refine(v => v.tieneMas === (v.siguienteCursor !== null), "Paginación inválida");
export const trazabilidadSchema = z.object({
  expedienteId: uuid,
  eventos: z.array(z.object({
    id: z.string().min(1),
    tipo: z.enum(["RADICACION", "ORDEN_PAGO", "PAGO_CONFIRMADO", "MOVIMIENTO"]),
    fechaHora: fecha,
    titulo: z.string().min(1),
    detalle: z.string().nullable(),
  })).default([]),
  actuaciones: z.array(z.object({
    movimientoId: uuid, secuencia: decimal, fechaHora: fecha,
    estadoAnterior: estado, evento: z.string(), estadoNuevo: estado, usuarioOperadorId: decimal,
    areaAnteriorId: z.string().nullable(), areaDestinoId: z.string().nullable(),
    remitente: z.string().nullable(), destinatario: z.string().nullable(),
    proveido: z.unknown(), datosAsociados: z.record(z.string(), z.unknown()),
    duracionMs: z.number().nonnegative().nullable(), duracionMinutos: z.number().nonnegative().nullable(),
    tipoActuacion: z.enum(["NORMAL", "COMPENSATORIA"]),
  })),
});
export const foliacionSchema = z.array(z.object({
  idDocumento: uuid, nombre: z.string().nullable(), tipo: z.string().nullable(),
  folioInicio: entero.positive(), folioFin: entero.positive(), cantidadFolios: entero.positive(),
  rango: z.string(), checksumSha256: z.string().nullable(),
}).refine(v => v.folioFin >= v.folioInicio && v.cantidadFolios === v.folioFin - v.folioInicio + 1, "Rango inválido"));
export const slaSchema = z.object({
  fechaInicio: fecha, fechaCalculo: fecha, fechaLimite: fecha,
  diasHabilesLimite: entero.positive(), diasHabilesTranscurridos: entero,
  diasHabilesRestantes: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  porcentaje: z.number().finite(), estado: z.enum(["VERDE", "AMARILLO", "ROJO"]),
});
export type Resumen = z.infer<typeof resumenSchema>;
export type Detalle = z.infer<typeof detalleSchema>;
export type Bandeja = z.infer<typeof bandejaSchema>;
export type Trazabilidad = z.infer<typeof trazabilidadSchema>;
export type Folios = z.infer<typeof foliacionSchema>;
export type Sla = z.infer<typeof slaSchema>;
export const documentoAdjuntoSchema = z.object({
  idDocumento: uuid,
  nombreArchivo: z.string(),
  tamanoBytes: z.number().int().nonnegative(),
  mimeType: z.string(),
  sha256: z.string().nullable(),
  tipoDocumental: z.string(),
  creadoEn: z.string(),
  foliado: z.boolean(),
  folios: z.string().nullable(),
});
export type DocumentoAdjuntoDto = z.infer<typeof documentoAdjuntoSchema>;

export const solicitanteResumenSchema = z.object({
  idPersona: uuid,
  nombreCompleto: z.string(),
  tipoDocumento: z.string(),
  numeroDocumento: z.string(),
  documentoEnmascarado: z.string(),
  correo: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
});
export type SolicitanteResumenDto = z.infer<typeof solicitanteResumenSchema>;
export interface Filtros {
  pestana: Pestana; limite: number; terminoBusqueda?: string;
  areaId?: string; fechaDesde?: string; fechaHasta?: string; cursor?: string;
}
