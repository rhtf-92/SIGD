import axios from "axios";
import { ErrorAccionExpediente } from "../types/expedienteActions";
import type { ExpedienteAccionReferencia, UnidadDestino } from "../types/expedienteActions";

/** Conserva párrafos y saltos de línea del proveído o pliego. */
export function normalizarMotivo(valor: string): string {
  return valor.replace(/\r\n?/g, "\n").split("\n").map((linea) => linea.replace(/[^\S\n]+/gu, " ").trim()).join("\n").trim();
}

export function validarDerivacion(destino: string, proveido: string, expediente: ExpedienteAccionReferencia, unidades: readonly UnidadDestino[]) {
  const unidad = unidades.find((item) => item.id === destino && item.habilitada && item.id.trim());
  return {
    unidadDestinoId: !unidad ? "Seleccione una unidad de destino válida." : destino === expediente.unidadOrigenId ? "El destino debe ser distinto de la unidad de origen." : "",
    proveido: normalizarMotivo(proveido) ? "" : "El proveído motivado es obligatorio.",
  };
}

export function validarAcumulacion(principal: ExpedienteAccionReferencia, conexos: readonly ExpedienteAccionReferencia[], motivo: string) {
  return {
    conexos: conexos.length === 0 ? "Seleccione al menos un expediente conexo." : conexos.some((item) => item.id === principal.id || !item.id.trim()) ? "El expediente principal no puede acumularse consigo mismo ni con una referencia inválida." : new Set(conexos.map((item) => item.id)).size !== conexos.length ? "No se permiten expedientes duplicados." : "",
    motivo: normalizarMotivo(motivo) ? "" : "La justificación de acumulación es obligatoria.",
  };
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

/** Adapta RFC 7807 sin mostrar detail, title ni invalid_params del servidor. */
export function adaptarErrorAccion(error: unknown): ErrorAccionExpediente {
  if (error instanceof ErrorAccionExpediente) return error;
  if (!axios.isAxiosError<unknown>(error) || !error.response) {
    return new ErrorAccionExpediente("No se pudo confirmar la operación. Compruebe su conexión y el estado del expediente antes de reintentar.", "red");
  }
  const problema = error.response.data;
  const statusHttp = error.response.status;
  const status = statusHttp || (esObjeto(problema) && typeof problema.status === "number" ? problema.status : 0);
  const mensajes: Readonly<Record<number, string>> = {
    400: "Revise los datos ingresados. La solicitud no es válida.",
    401: "La sesión no es válida o ha caducado. Inicie sesión nuevamente.",
    403: "No tiene permisos para realizar esta acción.",
    404: "El expediente o el recurso solicitado ya no está disponible.",
    409: "El expediente cambió o la acción no corresponde a su estado actual. Actualice sus datos antes de reintentar.",
    422: "Revise los campos obligatorios y las reglas de la operación.",
  };
  return new ErrorAccionExpediente(mensajes[status] ?? "El servidor no pudo confirmar la operación. Consulte el estado del expediente antes de reintentar.", "http", status);
}
