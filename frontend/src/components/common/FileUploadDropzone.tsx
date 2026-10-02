import { useEffect, useRef } from "react";

import {
  type UploadedFile,
  type UploadStatus,
  usePresignedUpload,
} from "../../hooks/usePresignedUpload";

interface FileUploadDropzoneProps {
  onUploaded?: (file: UploadedFile) => void;
  categoria?: string;
  demoMode?: boolean;
  onStatusChange?: (status: UploadStatus) => void;
}

export default function FileUploadDropzone({
  onUploaded,
  categoria,
  demoMode = false,
  onStatusChange,
}: FileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, cancel, status, progress, error, result } =
    usePresignedUpload({ categoria, demoMode });

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const uploaded = await upload(file);
    if (uploaded) onUploaded?.(uploaded);
  }

  return (
    <section aria-label="Carga de documento PDF" className="space-y-3">
      <button
        type="button"
        className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-blue-500"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void handleFile(event.dataTransfer.files[0]);
        }}
      >
        <strong className="block">Arrastre un PDF o seleccione un archivo</strong>
        <span className="mt-1 block text-sm text-slate-500">
          Se verifican los bytes mágicos y el hash SHA-256 antes de cargar.
        </span>
        {demoMode && (
          <span className="mt-3 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
            Modo demostración: almacenamiento simulado
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {(status === "requesting-url" || status === "uploading") && (
        <div role="status" aria-live="polite">
          <div className="mb-1 flex justify-between text-sm">
            <span>{status === "uploading" ? "Subiendo..." : "Preparando..."}</span>
            <span>{progress}%</span>
          </div>
          <progress className="w-full" max="100" value={progress} />
          <button
            type="button"
            className="mt-2 rounded border border-slate-300 px-3 py-1 text-sm"
            onClick={cancel}
          >
            Cancelar carga
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}
      {result && status === "success" && (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Archivo cargado. SHA-256: <code>{result.sha256}</code>
        </p>
      )}
    </section>
  );
}
