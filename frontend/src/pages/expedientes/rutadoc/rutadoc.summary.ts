import type { Resumen, Sla } from "./rutadoc.dto";

export type FiltroSlaLocal = "TOTAL" | "VERDE" | "AMARILLO" | "ROJO";
export type ConteosSla = Record<FiltroSlaLocal, number>;

const ESTADOS_TERMINALES_SLA = new Set(["ATENDIDO", "RESUELTO", "ARCHIVADO", "ANULADO"]);

export function esEstadoSlaTerminal(estadoActual: string): boolean {
  return ESTADOS_TERMINALES_SLA.has(estadoActual.trim().toUpperCase());
}

export function estadoSlaAplicable(
  estadoActual: string,
  estadoSla: Sla["estado"] | null | undefined,
): Sla["estado"] | null {
  return esEstadoSlaTerminal(estadoActual) ? null : estadoSla ?? null;
}

export function resolverEstadoSla(
  estadoActual: string,
  sla: Pick<Sla, "estado"> & { fechaLimite?: unknown } | null | undefined,
): Sla["estado"] | null {
  if (esEstadoSlaTerminal(estadoActual) || typeof sla?.fechaLimite !== "string" || !sla.fechaLimite.trim()) {
    return null;
  }
  return Number.isFinite(Date.parse(sla.fechaLimite)) ? sla.estado : null;
}

export function calcularConteosSla(expedientes: Resumen[], estados: ReadonlyMap<string, Sla["estado"] | null | undefined>): ConteosSla {
  const conteos: ConteosSla = { TOTAL: expedientes.length, VERDE: 0, AMARILLO: 0, ROJO: 0 };
  for (const expediente of expedientes) {
    const estado = estadoSlaAplicable(expediente.estadoActual, estados.get(expediente.idExpediente));
    if (estado) conteos[estado] += 1;
  }
  return conteos;
}

function campoCsv(valor: unknown): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

export function generarCsvExpedientes(expedientes: Resumen[]): string {
  const filas = [["CUT", "Asunto", "Estado", "Área actual", "Radicación"], ...expedientes.map(e =>
    [e.cut, e.asunto, e.estadoActual, e.areaActualNombre ?? e.areaActualCodigo ?? e.areaActualId ?? "", e.fechaRadicacion])];
  return "\uFEFF" + filas.map(fila => fila.map(campoCsv).join(",")).join("\r\n");
}
