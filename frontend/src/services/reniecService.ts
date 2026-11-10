import { apiClient } from "../api/client";
import { ApiHttpError } from "../types/api";
import { normalizarDni, type PersonaDni } from "../data/personaDni";

interface RespuestaReniec {
  success?: boolean;
  message?: string;
  detail?: string;
  code?: string;
  data?: PersonaDni;
}

export class ReniecConsultaError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "ReniecConsultaError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, ReniecConsultaError.prototype);
  }
}

export async function consultarDniReniec(dniCrudo: string): Promise<PersonaDni> {
  const dni = normalizarDni(dniCrudo);
  if (dni.length !== 8) {
    throw new ReniecConsultaError(
      "El DNI debe contener exactamente 8 dígitos numéricos.",
      "DNI_INVALIDO",
    );
  }

  try {
    const respuesta = await apiClient.get<RespuestaReniec>(`/api/v1/reniec/dni/${dni}`);
    const cuerpo = respuesta.data;
    if (!cuerpo?.data) {
      throw new ReniecConsultaError(
        cuerpo?.message || "RENIEC no devolvió datos para el DNI consultado.",
        cuerpo?.code || "RENIEC_SIN_DATOS",
        respuesta.status,
      );
    }
    return { ...cuerpo.data, dni, fuente: "RENIEC" };
  } catch (error) {
    if (error instanceof ReniecConsultaError) throw error;

    if (error instanceof ApiHttpError) {
      throw new ReniecConsultaError(
        error.problemDetails.detail || "No fue posible consultar RENIEC.",
        error.problemDetails.code,
        error.status,
      );
    }

    if (error instanceof Error && error.message) {
      throw new ReniecConsultaError(
        error.message,
        "RENIEC_UNAVAILABLE",
      );
    }

    throw new ReniecConsultaError(
      "No fue posible conectar con el servicio de consulta RENIEC.",
      "RENIEC_UNAVAILABLE",
    );
  }
}
