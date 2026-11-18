import axios from "axios";
import { ErrorAccionExpediente } from "../types/expedienteActions";
import { ApiHttpError } from "../types/api";
import type { ExpedienteAccionReferencia, UnidadDestino } from "../types/expedienteActions";

/** Conserva párrafos y saltos de línea del proveído o pliego. */
export function normalizarMotivo(valor: string): string {
  return valor.replace(/\r\n?/g, "\n").split("\n").map((linea) => linea.replace(/[^\S\n]+/gu, " ").trim()).join("\n").trim();
}

export function validarDerivacion(
  destino: string,
  proveido: string,
  expediente: ExpedienteAccionReferencia,
  unidades: readonly UnidadDestino[],
  destinoSugeridoId?: string,
  justificacionDesviacion?: string
) {
  const unidad = unidades.find((item) => item.id === destino && item.habilitada && item.id.trim());
  let errorUnidad = "";
  if (!unidad) {
    errorUnidad = "Seleccione una unidad de destino válida.";
  } else if (unidad.enrutable === false) {
    errorUnidad = unidad.motivo_no_enrutable || "El área seleccionada no cuenta actualmente con personal habilitado para recibir y gestionar expedientes.";
  } else if (destino === expediente.unidadOrigenId) {
    errorUnidad = "El destino debe ser distinto de la unidad de origen.";
  }

  const esDesviacion = Boolean(destinoSugeridoId && destino && destino !== destinoSugeridoId);
  const errorDesviacion = esDesviacion && (!justificacionDesviacion || normalizarMotivo(justificacionDesviacion).length < 10)
    ? "La justificación de desviación del destino TUPA debe tener al menos 10 caracteres."
    : "";

  const resultado: {
    unidadDestinoId: string;
    proveido: string;
    justificacionDesviacion?: string;
  } = {
    unidadDestinoId: errorUnidad,
    proveido: normalizarMotivo(proveido) ? "" : "El proveído motivado es obligatorio.",
  };

  if (esDesviacion || justificacionDesviacion !== undefined) {
    resultado.justificacionDesviacion = errorDesviacion;
  }

  return resultado;
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
  if (!(error instanceof ApiHttpError) && (!axios.isAxiosError<unknown>(error) || !error.response)) {
    return new ErrorAccionExpediente("No se pudo confirmar la operación. Compruebe su conexión y el estado del expediente antes de reintentar.", "red");
  }
  const problema = error instanceof ApiHttpError ? error.problemDetails : error.response?.data;
  const statusHttp = error instanceof ApiHttpError ? error.status : error.response?.status;
  const status = statusHttp || (esObjeto(problema) && typeof problema.status === "number" ? problema.status : 0);

  if (esObjeto(problema)) {
    const code = String(problema.code || problema.error || problema.codigo || problema.title || "");
    if (code === "AREA_NO_ENRUTABLE") {
      return new ErrorAccionExpediente("El área seleccionada no cuenta actualmente con personal habilitado para recibir y gestionar expedientes.", "http", 400);
    }
    if (code === "ASIGNACION_EMBEBIDA_NO_PERMITIDA") {
      return new ErrorAccionExpediente("La asignación individual de un expediente debe realizarse a través del servicio formal POST /api/v1/expedientes/:id/asignar.", "http", 400);
    }
    if (code === "DESTINO_INACTIVO") {
      return new ErrorAccionExpediente("El área de destino se encuentra inactiva o dada de baja.", "http", 400);
    }
    if (code === "DESTINO_INVALIDO") {
      return new ErrorAccionExpediente("El área de destino no existe en la estructura orgánica.", "http", 404);
    }
    if (code === "JUSTIFICACION_DESVIACION_REQUERIDA") {
      return new ErrorAccionExpediente("Debe ingresar una justificación motivada para desviar el expediente del destino institucional sugerido por el TUPA.", "http", 400);
    }
    if (code === "DERIVACION_PREMATURA_EVALUACION_PENDIENTE" || code === "ATENCION_TECNICA_REQUERIDA") {
      return new ErrorAccionExpediente(
        String(problema.message || "El expediente requiere asignación formal y dictamen técnico válido en la unidad responsable (SDA) antes de continuar hacia Dirección."),
        "http",
        status || 422
      );
    }
    if (code === "USAR_ENVIO_A_FIRMA") {
      return new ErrorAccionExpediente("El expediente ya cuenta con evaluación técnica completada. Debe elevarse a Dirección mediante 'Enviar a Firma'.", "http", status || 422);
    }
    if (code === "AREA_TECNICA_REQUERIDA") {
      return new ErrorAccionExpediente(
        String(problema.message || "El dictamen técnico debe registrarse en la unidad técnica responsable (SDA)."),
        "http",
        status || 422
      );
    }
    if (code === "SIN_FACULTAD_CORRECCION_DERIVACION") {
      return new ErrorAccionExpediente("Solo la Secretaría del área o jefatura autorizada puede ejecutar una derivación correctiva.", "http", 403);
    }
  }
  if (status === 409 && esObjeto(problema)) {
    const code = String(problema.code || problema.error || problema.codigo || problema.title || "");
    if (code === "REQUISITOS_DOCUMENTALES_PENDIENTES") {
      return new ErrorAccionExpediente("El expediente cuenta con requisitos documentales obligatorios pendientes de validación o no conformes.", "http", 409);
    }
    if (code === "PAGO_PENDIENTE") {
      return new ErrorAccionExpediente("El expediente requiere pago confirmado en Tesorería antes de ser derivado.", "http", 409);
    }
    if (code === "EVIDENCIA_FIRMA_REQUERIDA") {
      return new ErrorAccionExpediente("El expediente todavía no cuenta con una firma válida.", "http", 409);
    }
    if (code === "CONFLICTO_CONCURRENCIA") {
      return new ErrorAccionExpediente("El expediente cambió mientras trabajabas. Actualiza la información.", "concurrencia", 409);
    }
  }
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
