import { useCallback, useRef, useState } from "react";

import axios, { type AxiosRequestConfig } from "axios";

import { apiClient } from "../api/client";
import { computeFileSha256 } from "../utils/cryptoSha256";
import { validatePdfMagicBytes } from "../utils/magicBytesValidator";

export interface PresignedUrlRequest {
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  checksumSha256: string;
  categoria: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
  requiredHeaders?: Record<string, string>;
}

export interface UploadedFile {
  file: File;
  sha256: string;
  s3Key: string;
}

export type UploadStatus =
  | "idle"
  | "validating"
  | "requesting-url"
  | "uploading"
  | "success"
  | "cancelled"
  | "error";

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "invalid-file"
      | "invalid-magic-bytes"
      | "hash"
      | "presigned-url"
      | "upload"
      | "cancelled",
  ) {
    super(message);
    this.name = "UploadError";
  }
}

interface UsePresignedUploadOptions {
  categoria?: string;
  demoMode?: boolean;
}

interface UploadResult {
  file: File;
  sha256: string;
  s3Key: string;
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
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<UploadError | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const cancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  }, []);

  const upload = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setStatus("validating");
      setProgress(0);
      setError(null);
      setResult(null);

      try {
        if (file.size === 0 || !file.name.toLowerCase().endsWith(".pdf")) {
          throw new UploadError(
            "Seleccione un archivo PDF no vacío.",
            "invalid-file",
          );
        }

        if (!(await validatePdfMagicBytes(file))) {
          throw new UploadError(
            "El archivo no contiene la firma binaria PDF válida.",
            "invalid-magic-bytes",
          );
        }

        let sha256: string;
        try {
          sha256 = await computeFileSha256(file);
        } catch (cause) {
          throw new UploadError(
            cause instanceof Error
              ? cause.message
              : "No fue posible calcular el hash SHA-256.",
            "hash",
          );
        }

        setStatus("requesting-url");
        let presigned: PresignedUrlResponse;
        if (options.demoMode) {
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(resolve, 350);
            controller.signal.addEventListener(
              "abort",
              () => {
                window.clearTimeout(timeout);
                reject(new UploadError("La carga fue cancelada.", "cancelled"));
              },
              { once: true },
            );
          });
          presigned = {
            uploadUrl: "demo://minio/presigned-upload",
            s3Key: `demo/${file.name}`,
            expiresIn: 900,
            requiredHeaders: { "Content-Type": "application/pdf" },
          };
        } else {
          try {
            const response = await apiClient.post<PresignedUrlResponse>(
              "/v1/storage/presigned-url",
              {
                nombreArchivo: file.name,
                mimeType: "application/pdf",
                tamanoBytes: file.size,
                checksumSha256: sha256,
                categoria: options.categoria ?? "EXPEDIENTE_INGRESO",
              } satisfies PresignedUrlRequest,
              { signal: controller.signal },
            );
            presigned = response.data;
          } catch (cause) {
            if (controller.signal.aborted) {
              throw new UploadError("La carga fue cancelada.", "cancelled");
            }
            throw new UploadError(
              cause instanceof Error
                ? cause.message
                : "No fue posible solicitar la URL prefirmada.",
              "presigned-url",
            );
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
                  reject(new UploadError("La carga fue cancelada.", "cancelled"));
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
                "Content-Type": "application/pdf",
                ...presigned.requiredHeaders,
              },
              controller.signal,
              setProgress,
            );
          }
        } catch (cause) {
          if (controller.signal.aborted) {
            throw new UploadError("La carga fue cancelada.", "cancelled");
          }
          throw new UploadError(
            cause instanceof Error
              ? cause.message
              : "La carga directa al almacenamiento falló.",
            "upload",
          );
        }

        const uploaded: UploadResult = { file, sha256, s3Key: presigned.s3Key };
        setProgress(100);
        setResult(uploaded);
        setStatus("success");
        return uploaded;
      } catch (cause) {
        const uploadError =
          cause instanceof UploadError
            ? cause
            : new UploadError("La operación de carga falló.", "upload");
        setError(uploadError);
        setStatus(uploadError.kind === "cancelled" ? "cancelled" : "error");
        return null;
      } finally {
        controllerRef.current = null;
      }
    },
    [options.categoria, options.demoMode],
  );

  return { upload, cancel, status, progress, error, result };
}
