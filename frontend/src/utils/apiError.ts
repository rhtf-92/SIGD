import { ApiHttpError } from "../types/api";

export interface DetalleErrorApi {
  titulo: string;
  mensaje: string;
  codigo: string;
  estado: number | null;
  correlacionId: string | null;
  endpoint: string | null;
  esErrorDeRed: boolean;
  reintentable: boolean;
}

export function obtenerDetalleErrorApi(error: unknown): DetalleErrorApi {
  if (error instanceof ApiHttpError) {
    const problema = error.problemDetails;
    return {
      titulo: problema.title,
      mensaje: problema.detail,
      codigo: problema.code,
      estado: problema.status,
      correlacionId: problema.correlationId || null,
      endpoint: problema.instance || null,
      esErrorDeRed: problema.code === "ERR_NETWORK" || problema.status === 0,
      reintentable: problema.retryable,
    };
  }

  if (error instanceof Error) {
    return {
      titulo: error.name,
      mensaje: error.message,
      codigo: "ERR_DESCONOCIDO",
      estado: null,
      correlacionId: null,
      endpoint: null,
      esErrorDeRed: false,
      reintentable: false,
    };
  }

  return {
    titulo: "Error desconocido",
    mensaje: String(error),
    codigo: "ERR_DESCONOCIDO",
    estado: null,
    correlacionId: null,
    endpoint: null,
    esErrorDeRed: false,
    reintentable: false,
  };
}

export function registrarErrorApi(
  origen: string,
  error: unknown,
  contexto: Record<string, unknown> = {},
): DetalleErrorApi {
  const detalle = obtenerDetalleErrorApi(error);
  console.error(`[SIGD][${origen}]`, {
    ...contexto,
    ...detalle,
    tipoError: error instanceof Error ? error.name : typeof error,
    pila: error instanceof Error ? error.stack : undefined,
  });
  return detalle;
}
