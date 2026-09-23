import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

import { apiClient } from "../api/client";
import { env } from "../config/env";
import type { ErrorValidacionCvd, ValidacionCVDResult } from "../types/validadorCvd";

export const CVD_VALIDO = "CVD-2026-RD-000412-892F";
export const CVD_ALTERADO = "CVD-2026-RD-000413-ALTE";
const USAR_MOCKS = env.enableMocks || env.isDevelopment;

interface ApiProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
}

export class CvdError extends Error implements ErrorValidacionCvd {
  readonly titulo: string;
  readonly detalle: string;
  readonly codigoEstado: number;

  constructor(titulo: string, detalle: string, codigoEstado: number) {
    super(detalle);
    this.name = "CvdError";
    this.titulo = titulo;
    this.detalle = detalle;
    this.codigoEstado = codigoEstado;
  }
}

function convertirError(origen: unknown): CvdError {
  if (origen instanceof CvdError) return origen;

  if (axios.isAxiosError<ApiProblemDetails>(origen)) {
    const problema = origen.response?.data;
    return new CvdError(
      problema?.title ?? "Error de validación",
      problema?.detail ?? origen.message,
      origen.response?.status ?? 500,
    );
  }

  return new CvdError(
    "Error inesperado",
    "Ocurrió un error al consultar el validador público de CVD.",
    500,
  );
}

function crearResultadoValido(): ValidacionCVDResult {
  return {
    esValido: true,
    cvd: CVD_VALIDO,
    documento: {
      numeroDocumento: "RD N.° 0412-2026-DG-IESTP-SUIZA",
      tipo: "RD",
      asunto:
        "Confiere Título Profesional Técnico en Desarrollo de Sistemas de Información al administrado Carlos Mendoza Ríos.",
      fechaEmision: "2026-09-05T11:42:15-05:00",
      firmantes: [
        {
          nombre: "Lic. Julio César Mori Paredes",
          cargo: "Director General",
          fechaFirma: "2026-09-05T11:42:15-05:00",
          entidadCertificadora: "RENIEC / IOFE INDECOPI",
        },
        {
          nombre: "Dra. Rosa Luz Cárdenas Vela",
          cargo: "Secretaria Académica",
          fechaFirma: "2026-09-05T11:42:13-05:00",
          entidadCertificadora: "RENIEC / IOFE INDECOPI",
        },
      ],
      hashIntegridadSha256:
        "c1f2a3b4d5e6f708192a3b4c5d6e7f80a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
      urlDescargaAutentica:
        "https://tramite.institutosuiza.edu.pe/expedientes/rd-0412-2026.pdf",
    },
    selloTiempoTsa: "2026-09-05T11:42:16-05:00",
    mensajeSeguridad:
      "Documento oficial emitido por el IESTP Suiza. La integridad criptográfica y las firmas digitales son plenamente válidas.",
  };
}

function crearResultadoAlterado(codigoCvd: string): ValidacionCVDResult {
  return {
    esValido: false,
    cvd: codigoCvd,
    documento: null,
    selloTiempoTsa: null,
    mensajeSeguridad:
      "El documento ingresado no coincide con ningún registro institucional legítimo o su contenido ha sido alterado tras la emisión.",
  };
}

async function consultarMock(codigoCvd: string): Promise<ValidacionCVDResult> {
  await new Promise((resolver) => setTimeout(resolver, 800));
  const normalizado = codigoCvd.trim().toUpperCase();

  if (normalizado === CVD_VALIDO) return crearResultadoValido();
  if (normalizado === CVD_ALTERADO) return crearResultadoAlterado(normalizado);

  throw new CvdError(
    "CVD no encontrado",
    `El código ${normalizado} no corresponde a ningún documento oficial emitido por el IESTP Suiza.`,
    404,
  );
}

async function consultarApi(codigoCvd: string): Promise<ValidacionCVDResult> {
  const normalizado = codigoCvd.trim().toUpperCase();
  const { data } = await apiClient.get<ValidacionCVDResult>(
    `/validador/cvd/${encodeURIComponent(normalizado)}`,
  );
  return data;
}

async function consultarCvd(codigoCvd: string): Promise<ValidacionCVDResult> {
  try {
    if (USAR_MOCKS) return await consultarMock(codigoCvd);
    return await consultarApi(codigoCvd);
  } catch (origen) {
    throw convertirError(origen);
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
  const mutation = useMutation<ValidacionCVDResult, CvdError, string>({
    mutationFn: consultarCvd,
  });

  const verificar = useCallback(
    (codigoCvd: string) => {
      mutation.reset();
      mutation.mutate(codigoCvd);
    },
    [mutation],
  );

  return {
    resultado: mutation.data ?? null,
    error: mutation.error,
    isValidando: mutation.isPending,
    verificar,
    limpiar: mutation.reset,
  };
}