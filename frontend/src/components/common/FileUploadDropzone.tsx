import { useEffect, useRef, useState } from "react";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { upload, cancel, status, progress, error, result } =
    usePresignedUpload({ categoria, demoMode });
  const isBusy =
    status === "validating" ||
    status === "hashing" ||
    status === "requesting-url" ||
    status === "uploading";

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    const uploaded = await upload(file);
    if (uploaded) onUploaded?.(uploaded);
  }

  return (
    <section aria-label="Carga de documento PDF" className="space-y-3">
      <button
        type="button"
        aria-describedby="pdf-dropzone-description pdf-dropzone-file"
        disabled={isBusy}
        className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors disabled:cursor-wait disabled:opacity-70 ${
          isDragging
            ? "border-blue-600 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-blue-500"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void handleFile(event.dataTransfer.files[0]);
        }}
      >
        <strong className="block">Arrastre un PDF o seleccione un archivo</strong>
        <span id="pdf-dropzone-description" className="mt-1 block text-sm text-slate-500">
          PDF de hasta 25 MB. Use Enter o Espacio para seleccionar un archivo.
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
        className="sr-only"
        aria-label="Seleccionar archivo PDF"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div id="pdf-dropzone-file" aria-live="polite" className="text-sm text-slate-700">
        {selectedFile && (
          <p>
            <span className="font-medium">Archivo seleccionado:</span>{" "}
            {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        )}
        {status === "validating" && <p>Validando tipo y firma del archivo...</p>}
        {status === "hashing" && <p>Calculando SHA-256 localmente...</p>}
      </div>
      {(status === "requesting-url" || status === "uploading") && (
        <div role="status" aria-live="polite" aria-atomic="true">
          <div className="mb-1 flex justify-between text-sm">
            <span>{status === "uploading" ? "Subiendo a almacenamiento..." : "Solicitando URL prefirmada..."}</span>
            <span>{progress}%</span>
          </div>
          <progress
            className="w-full"
            max="100"
            value={progress}
            aria-label="Progreso de subida"
          />
          <button
            type="button"
            className="mt-2 rounded border border-slate-300 px-3 py-1 text-sm"
            onClick={cancel}
          >
            Cancelar carga
          </button>
        </div>
      )}
      {status === "cancelled" && (
        <p role="status" className="text-sm text-slate-600">
          La carga fue cancelada.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}
      {result && status === "success" && (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <span className="block font-semibold">Carga completada</span>
          <span className="block break-all">SHA-256: <code>{result.sha256}</code></span>
        </p>
      )}
    </section>
  );
}
