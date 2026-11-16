import { useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "../api/client";
import { ApiHttpError, type ApiProblemDetails } from "../types/api";
import type { ErrorValidacionCvd, ValidacionCVDResult } from "../types/validadorCvd";
import { validarCvd } from "../utils/cvdValidator";

export class CvdError extends Error implements ErrorValidacionCvd {
  constructor(readonly titulo: string, readonly detalle: string, readonly codigoEstado: number) {
    super(detalle);
    this.name = "CvdError";
  }
}

function convertirError(error: unknown): CvdError {
  if (error instanceof CvdError) return error;
  const status = error instanceof ApiHttpError ? error.status
    : axios.isAxiosError<ApiProblemDetails>(error) ? error.response?.status ?? 503 : 503;
  if (status === 404) return new CvdError("CVD no encontrado", "No existe un documento registrado para ese código CVD.", 404);
  if (status === 400 || status === 422) return new CvdError("Código CVD inválido", "Revise el formato del código ingresado.", status);
  return new CvdError("Verificación no disponible", "No se pudo completar la consulta. Intente nuevamente.", status);
}

async function consultarCvd(codigo: string): Promise<ValidacionCVDResult> {
  const chequeo = validarCvd(codigo);
  if (!chequeo.valido) throw new CvdError("Código CVD inválido", chequeo.motivo ?? "Revise el código.", 400);
  try {
    const { data } = await apiClient.get<ValidacionCVDResult>(
      `/api/v1/validador/cvd/${encodeURIComponent(chequeo.normalizado)}`,
    );
    if (!data || typeof data.esValido !== "boolean" || data.cvd !== chequeo.normalizado
      || typeof data.mensajeSeguridad !== "string") {
      throw new CvdError("Respuesta no verificable", "El servidor no devolvió un resultado de verificación válido.", 502);
    }
    if (data.esValido && (!data.documento || !/^[a-f0-9]{64}$/i.test(data.documento.hashIntegridadSha256)
      || !Array.isArray(data.documento.firmantes) || data.documento.firmantes.length === 0)) {
      throw new CvdError("Respuesta no verificable", "Falta evidencia documental en la respuesta del servidor.", 502);
    }
    return { ...data, documento: data.esValido ? data.documento : null };
  } catch (error) {
    throw convertirError(error);
  }
}

export interface UseCvdPublicVerificationResultado {
  resultado: ValidacionCVDResult | null;
  error: CvdError | null;
  isValidando: boolean;
  verificar: (codigoCvd: string) => void;
  limpiar: () => void;
}

export function useCvdPublicVerification(): UseCvdPublicVerificationResultado {
  const enviando = useRef(false);
  const mutation = useMutation<ValidacionCVDResult, CvdError, string>({
    mutationFn: async (codigo) => {
      try { return await consultarCvd(codigo); }
      finally { enviando.current = false; }
    },
    retry: false,
  });
  const verificar = useCallback((codigo: string) => {
    if (enviando.current) return;
    enviando.current = true;
    mutation.reset();
    mutation.mutate(codigo);
  }, [mutation]);
  return { resultado: mutation.data ?? null, error: mutation.error,
    isValidando: mutation.isPending, verificar, limpiar: mutation.reset };
}
