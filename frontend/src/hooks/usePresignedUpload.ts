import { useCallback, useRef, useState } from "react";

import axios, { type AxiosRequestConfig } from "axios";

import { apiClient } from "../api/client";
import { calculateFileSha256 } from "../services/storageService";
import { ApiHttpError } from "../types/api";
import {
  inferInstitutionalMimeType,
  validateInstitutionalFile,
} from "../utils/fileValidation";

export interface PresignedUrlRequest {
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  checksumSha256: string;
  sha256Hash?: string;
  categoria: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn?: number;
  expiraEnSegundos?: number;
  requiredHeaders?: Record<string, string>;
}

export interface ConfirmarCargaResponse {
  idDocumentoAdjunto: string;
  s3Key: string;
  confirmado: boolean;
  mensaje?: string;
}

export interface UploadedFile {
  file: File;
  sha256: string;
  s3Key: string;
  idDocumentoAdjunto?: string;
}

export type UploadStatus =
  | "idle"
  | "validating"
  | "hashing"
  | "requesting-url"
  | "uploading"
  | "success"
  | "cancelled"
  | "error";

export type UploadErrorKind =
  | "invalid-file"
  | "invalid-magic-bytes"
  | "hash"
  | "presigned-url"
  | "upload"
  | "confirm"
  | "cancelled";

export class UploadError extends Error {
  public readonly statusCode?: number;
  public readonly serverCode?: string;
  public readonly technicalDetails?: string[];

  constructor(
    message: string,
    public readonly kind: UploadErrorKind,
    options?: {
      statusCode?: number;
      serverCode?: string;
      technicalDetails?: string[];
    },
  ) {
    super(message);
    this.name = "UploadError";
    this.statusCode = options?.statusCode;
    this.serverCode = options?.serverCode;
    this.technicalDetails = options?.technicalDetails;
  }
}

interface UsePresignedUploadOptions {
  categoria?: string;
  demoMode?: boolean;
  idExpediente?: string;
}

export interface UploadResult {
  file: File;
  sha256: string;
  s3Key: string;
  idDocumentoAdjunto?: string;
}

const GENERIC_TECHNICAL_MSG_REGEX =
  /^(Request failed with status code \d+|Network Error|timeout of \d+ms exceeded|Validation Error|Error en la operación del servidor|Failed to fetch)$/i;

/**
 * Devuelve un mensaje amigable, claro y orientado al ciudadano según el tipo
 * de incidencia, ocultando jerga técnica de infraestructura (S3, MinIO, códigos HTTP crudos).
 */
function formatCitizenFriendlyFallback(
  status: number | undefined,
  etapa: "presigned-url" | "upload" | "confirm",
): string {
  if (!status || status >= 500 || status === 404) {
    return "No pudimos guardar tu archivo debido a un problema temporal de comunicación. Por favor, inténtalo de nuevo en unos segundos.";
  }

  switch (status) {
    case 400:
    case 422:
      return etapa === "upload"
        ? "No pudimos completar la subida de tu documento por un inconveniente temporal en el servicio de archivos. Por favor, vuelve a seleccionarlo e inténtalo de nuevo."
        : "No pudimos procesar tu archivo. Por favor, verifica que sea un documento válido (PDF, Word o imagen de hasta 25 MB) e inténtalo nuevamente.";
    case 401:
    case 403:
      return "El tiempo de espera para adjuntar el documento expiró. Por favor, selecciona tu archivo nuevamente.";
    case 413:
      return "Tu archivo supera el tamaño máximo permitido de 25 MB. Por favor, selecciona un archivo más liviano.";
    case 415:
      return "El formato del archivo no es compatible. Puedes adjuntar documentos en PDF, Word (.doc, .docx) o imágenes (.png, .jpg).";
    default:
      return "No pudimos guardar tu archivo debido a un problema temporal de comunicación. Por favor, inténtalo de nuevo en unos segundos.";
  }
}

/**
 * Determina si un texto devuelto por el servidor contiene jerga técnica de
 * infraestructura (S3, MinIO, SQL, XML, HTTP status) que debe ser reemplazada
 * por un mensaje amigable para el ciudadano.
 */
function isTechnicalInfrastructureMessage(msg: string): boolean {
  if (!msg) return true;
  if (GENERIC_TECHNICAL_MSG_REGEX.test(msg.trim())) return true;
  return /minio|s3_key|s3key|bucket|presigned|sigv4|sqlstate|uuid|xml|axios|econnrefused|enotfound|socket hang up/i.test(
    msg,
  );
}

/**
 * Convierte cualquier excepción de red, almacenamiento o API en un `UploadError`
 * con un mensaje claro, empático y comprensible para el ciudadano.
 */
export function extractDetailedUploadError(
  cause: unknown,
  etapa: "presigned-url" | "upload" | "confirm",
): UploadError {
  if (cause instanceof UploadError) {
    return cause;
  }

  // 1. Error estructurado RFC 7807 proveniente de apiClient
  if (cause instanceof ApiHttpError) {
    const pd = cause.problemDetails;
    const status = pd.status || cause.status;
    const rawDetail = (pd.detail || pd.title || "").trim();

    const friendlyMessage = isTechnicalInfrastructureMessage(rawDetail)
      ? formatCitizenFriendlyFallback(status, etapa)
      : rawDetail;

    return new UploadError(friendlyMessage, etapa, {
      statusCode: status,
      serverCode: pd.code,
    });
  }

  // 2. Error directo de Axios (ej. fallo de red o respuesta de almacenamiento)
  if (axios.isAxiosError(cause)) {
    const status = cause.response?.status;
    const data: unknown = cause.response?.data;
    let candidateMessage = "";

    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      candidateMessage =
        (typeof record.detail === "string" && record.detail) ||
        (typeof record.message === "string" && record.message) ||
        (typeof record.mensaje === "string" && record.mensaje) ||
        "";
    }

    const friendlyMessage =
      candidateMessage && !isTechnicalInfrastructureMessage(candidateMessage)
        ? candidateMessage.trim()
        : formatCitizenFriendlyFallback(status, etapa);

    return new UploadError(friendlyMessage, etapa, {
      statusCode: status,
    });
  }

  // 3. Error estándar de navegador o de código
  if (cause instanceof Error) {
    const cleanMsg = cause.message.trim();
    const friendlyMessage = isTechnicalInfrastructureMessage(cleanMsg)
      ? formatCitizenFriendlyFallback(undefined, etapa)
      : cleanMsg;

    return new UploadError(friendlyMessage, etapa);
  }

  return new UploadError(formatCitizenFriendlyFallback(undefined, etapa), etapa);
}

export async function uploadToPresignedUrl(
  url: string,
  file: File,
  headers: Record<string, string>,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<void> {
  const config: AxiosRequestConfig<Blob> = {
    headers,
    signal,
    onUploadProgress: (event) => {
      if (event.total) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    },
  };

  await axios.put(url, file, config);
}

export function usePresignedUpload(
  options: UsePresignedUploadOptions = {},
) {
  const controllerRef = useRef<AbortController | null>(null);
  const lastErrorRef = useRef<UploadError | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<UploadError | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const cancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  }, []);

  const clearError = useCallback(() => {
    lastErrorRef.current = null;
    setError(null);
  }, []);

  const upload = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      const controller = new AbortController();
      controllerRef.current = controller;
      lastErrorRef.current = null;
      setStatus("validating");
      setProgress(0);
      setError(null);
      setResult(null);

      try {
        if (file.size === 0) {
          throw new UploadError(
            "El archivo seleccionado parece estar vacío. Por favor, elige un documento válido.",
            "invalid-file",
          );
        }

        const validation = await validateInstitutionalFile(file);
        if (!validation.valid) {
          throw new UploadError(
            validation.reason,
            "invalid-magic-bytes",
          );
        }

        if (controller.signal.aborted) {
          throw new UploadError("La subida del archivo fue cancelada.", "cancelled");
        }

        setStatus("hashing");
        let sha256: string;
        try {
          sha256 = await calculateFileSha256(file);
        } catch {
          throw new UploadError(
            "No pudimos leer tu archivo correctamente. Por favor, verifica que no esté dañado e inténtalo de nuevo.",
            "hash",
          );
        }

        if (controller.signal.aborted) {
          throw new UploadError("La subida del archivo fue cancelada.", "cancelled");
        }

        const resolvedMimeType = inferInstitutionalMimeType(file);

        setStatus("requesting-url");
        let presigned: PresignedUrlResponse;
        if (options.demoMode) {
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(resolve, 350);
            controller.signal.addEventListener(
              "abort",
              () => {
                window.clearTimeout(timeout);
                reject(new UploadError("La subida del archivo fue cancelada.", "cancelled"));
              },
              { once: true },
            );
          });
          presigned = {
            uploadUrl: "demo://minio/presigned-upload",
            s3Key: `demo/${file.name}`,
            expiresIn: 900,
            requiredHeaders: { "Content-Type": resolvedMimeType },
          };
        } else {
          try {
            const response = await apiClient.post<PresignedUrlResponse>(
              "/api/v1/storage/presigned-url",
              {
                nombreArchivo: file.name,
                mimeType: resolvedMimeType,
                tamanoBytes: file.size,
                checksumSha256: sha256,
                sha256Hash: sha256,
                categoria: options.categoria ?? "EXPEDIENTE_INGRESO",
              } satisfies PresignedUrlRequest,
              { signal: controller.signal },
            );
            presigned = response.data;
            if (!presigned || typeof presigned.uploadUrl !== 'string' ||
                typeof presigned.s3Key !== 'string' ||
                !/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i.test(presigned.s3Key)) {
              throw new Error('El almacenamiento no devolvió una referencia válida para el archivo.');
            }
          } catch (cause) {
            if (controller.signal.aborted) {
              throw new UploadError("La subida del archivo fue cancelada.", "cancelled");
            }
            throw extractDetailedUploadError(cause, "presigned-url");
          }
        }

        setStatus("uploading");
        try {
          if (options.demoMode) {
            await new Promise<void>((resolve, reject) => {
              let currentProgress = 0;
              const interval = window.setInterval(() => {
                if (controller.signal.aborted) {
                  window.clearInterval(interval);
                  reject(new UploadError("La subida del archivo fue cancelada.", "cancelled"));
                  return;
                }
                currentProgress += 10;
                setProgress(currentProgress);
                if (currentProgress >= 100) {
                  window.clearInterval(interval);
                  resolve();
                }
              }, 80);
            });
          } else {
            await uploadToPresignedUrl(
              presigned.uploadUrl,
              file,
              {
                "Content-Type": resolvedMimeType,
                ...presigned.requiredHeaders,
              },
              controller.signal,
              setProgress,
            );
          }
        } catch (cause) {
          if (controller.signal.aborted) {
            throw new UploadError("La subida del archivo fue cancelada.", "cancelled");
          }
          throw extractDetailedUploadError(cause, "upload");
        }

        let idDocumentoAdjunto: string | undefined;
        if (!options.demoMode) {
          try {
            const confirmResponse = await apiClient.post<ConfirmarCargaResponse>(
              "/api/v1/storage/confirmar-carga",
              {
                s3Key: presigned.s3Key,
                sha256Hash: sha256,
                idExpediente: options.idExpediente,
                nombreArchivo: file.name,
                tamanoBytes: file.size,
                mimeType: resolvedMimeType,
              },
              { signal: controller.signal },
            );
            idDocumentoAdjunto = confirmResponse.data.idDocumentoAdjunto;
          } catch (cause) {
            if (controller.signal.aborted) {
              throw new UploadError("La subida del archivo fue cancelada.", "cancelled");
            }
            throw extractDetailedUploadError(cause, "confirm");
          }
        }

        const uploaded: UploadResult = {
          file,
          sha256,
          s3Key: presigned.s3Key,
          idDocumentoAdjunto,
        };
        setProgress(100);
        setResult(uploaded);
        setStatus("success");
        return uploaded;
      } catch (cause) {
        const uploadError = extractDetailedUploadError(cause, "upload");
        lastErrorRef.current = uploadError;
        setError(uploadError);
        setStatus(uploadError.kind === "cancelled" ? "cancelled" : "error");
        return null;
      } finally {
        controllerRef.current = null;
      }
    },
    [options.categoria, options.demoMode, options.idExpediente],
  );

  return {
    upload,
    cancel,
    clearError,
    getLastError: () => lastErrorRef.current,
    status,
    progress,
    error,
    result,
  };
}
