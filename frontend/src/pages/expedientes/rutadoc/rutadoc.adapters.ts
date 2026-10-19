import type { z } from "zod";
import { trazabilidadSchema } from "./rutadoc.dto";

export class RespuestaRutaDocInvalida extends Error {
  constructor() { super("El servidor devolvió una respuesta inválida."); }
}
export function validarRespuesta<T>(schema: z.ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success) throw new RespuestaRutaDocInvalida();
  return resultado.data;
}
export function adaptarTrazabilidad(valor: unknown, expedienteId: string) {
  const dato = validarRespuesta(trazabilidadSchema, valor);
  if (dato.expedienteId.toLowerCase() !== expedienteId.toLowerCase()) throw new RespuestaRutaDocInvalida();
  // Orden numérico sin pérdida de precisión; nunca convertir BIGINT a Number.
  return { ...dato, actuaciones: [...dato.actuaciones].sort((a, b) =>
    BigInt(a.secuencia) < BigInt(b.secuencia) ? -1 : BigInt(a.secuencia) > BigInt(b.secuencia) ? 1 : 0) };
}
