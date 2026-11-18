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
  /** La radicación registra los metadatos dentro de su transacción, cuando existe el expediente. */
  diferirRegistroAdjunto?: boolean;
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
  sha256?: string,
): Promise<{ s3Key?: string } | void> {
  if (!url) {
    // Si la URL está vacía o diferida, el archivo ya fue persistido por el fallback multipart directo
    return;
  }

  const config: AxiosRequestConfig<Blob> = {
    headers,
    signal,
    timeout: 30000,
    onUploadProgress: (event) => {
      if (event.total) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    },
  };

  try {
    await axios.put(url, file, config);
  } catch (putErr) {
    // Si la subida directa por PUT falla (ej. CORS S3, 403 firma, bucket inaccesible o red),
    // recurre inmediatamente al endpoint multipart de Express (/api/v1/storage/upload)
    console.warn(
      '[usePresignedUpload] Subida directa PUT a S3 no completada. Recurriendo a subida multipart Express (/api/v1/storage/upload):',
      putErr,
    );
    const formData = new FormData();
    formData.append('archivo', file);
    if (sha256) {
      formData.append('checksumSha256', sha256);
    }

    const resMulter = await apiClient.post<{ s3Key?: string; ruta?: string; storageUrl?: string }>(
      '/api/v1/storage/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
        timeout: 30000,
        onUploadProgress: (event) => {
          if (event.total) {
            onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
          }
        },
      },
    );
    const serverKey = resMulter.data?.s3Key ?? resMulter.data?.ruta ?? resMulter.data?.storageUrl;
    return { s3Key: serverKey };
  }
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
            // Si la emisión de URL prefirmada falla (ej. S3 no configurado o error en endpoint),
            // intenta inmediatamente la subida directa multipart en Express (/api/v1/storage/upload)
            console.warn('[usePresignedUpload] Fallo en presigned-url. Recurriendo a subida directa multipart:', cause);
            try {
              const formData = new FormData();
              formData.append('archivo', file);
              formData.append('checksumSha256', sha256);
              const resMulter = await apiClient.post<{ s3Key?: string; ruta?: string; storageUrl?: string }>(
                '/api/v1/storage/upload',
                formData,
                {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  signal: controller.signal,
                  timeout: 30000,
                  onUploadProgress: (event) => {
                    if (event.total) {
                      setProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
                    }
                  },
                },
              );
              const serverKey = resMulter.data?.s3Key ?? resMulter.data?.ruta ?? resMulter.data?.storageUrl;
              if (serverKey && /^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i.test(serverKey)) {
                presigned = {
                  uploadUrl: '',
                  s3Key: serverKey,
                };
              } else {
                throw cause;
              }
            } catch (errDirect) {
              if (controller.signal.aborted) {
                throw new UploadError("La subida del archivo fue cancelada.", "cancelled");
              }
              throw extractDetailedUploadError(errDirect || cause, "presigned-url");
            }
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
            const uploadResultado = await uploadToPresignedUrl(
              presigned.uploadUrl,
              file,
              {
                "Content-Type": resolvedMimeType,
                ...presigned.requiredHeaders,
              },
              controller.signal,
              setProgress,
              sha256,
            );
            if (uploadResultado?.s3Key) {
              presigned.s3Key = uploadResultado.s3Key;
            }
          }
        } catch (cause) {
          if (controller.signal.aborted) {
            throw new UploadError("La subida del archivo fue cancelada.", "cancelled");
          }
          throw extractDetailedUploadError(cause, "upload");
        }

        let idDocumentoAdjunto: string | undefined;
        if (!options.demoMode && !options.diferirRegistroAdjunto) {
          try {
            const confirmPayload: Record<string, unknown> = {
              s3Key: presigned.s3Key,
              sha256Hash: sha256,
            };
            if (options.idExpediente) {
              confirmPayload.idExpediente = options.idExpediente;
              confirmPayload.nombreArchivo = file.name;
              confirmPayload.tamanoBytes = file.size;
              confirmPayload.mimeType = resolvedMimeType;
            }
            const confirmResponse = await apiClient.post<ConfirmarCargaResponse>(
              "/api/v1/storage/confirmar-carga",
              confirmPayload,
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
    [options.categoria, options.demoMode, options.idExpediente, options.diferirRegistroAdjunto],
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
