import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import FileUploadDropzone from "../common/FileUploadDropzone";
import type { UploadedFile, UploadStatus } from "../../hooks/usePresignedUpload";
import {
  adjuntarDocumentoDigitalizado,
  type DigitalizacionResponse,
} from "../../api/digitalizacionApi";
import type {
  ExpedienteDetalleRutaDoc,
  ExpedienteSGD,
} from "../../types/expediente";
import { ApiHttpError } from "../../types/api";

export interface DigitalizacionModalProps {
  expediente: ExpedienteDetalleRutaDoc | ExpedienteSGD;
  abierto: boolean;
  onCerrar: () => void;
  onExito?: (resultado: DigitalizacionResponse) => void;
}

export default function DigitalizacionModal({
  expediente,
  abierto,
  onCerrar,
  onExito,
}: DigitalizacionModalProps) {
  if (!abierto) return null;
  return (
    <FormularioDigitalizacion
      expediente={expediente}
      onCerrar={onCerrar}
      onExito={onExito}
    />
  );
}

function FormularioDigitalizacion({
  expediente,
  onCerrar,
  onExito,
}: Omit<DigitalizacionModalProps, "abierto">) {
  const id = useId();
  const queryClient = useQueryClient();

  const idExpediente =
    "idExpediente" in expediente ? expediente.idExpediente : expediente.id;
  const codigoCut =
    "cut" in expediente ? expediente.cut : expediente.codigoExpediente;
  const asunto = expediente.asunto;

  const [folios, setFolios] = useState<number>(1);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [procesando, setProcesando] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);
  const [resultadoExitoso, setResultadoExitoso] =
    useState<DigitalizacionResponse | null>(null);

  const puedeConfirmar =
    Boolean(uploadedFile) &&
    uploadStatus === "success" &&
    folios > 0 &&
    !procesando &&
    !resultadoExitoso;

  async function handleConfirmar() {
    if (!uploadedFile || folios <= 0 || procesando) return;

    setProcesando(true);
    setErrorOperacion(null);

    try {
      const res = await adjuntarDocumentoDigitalizado(idExpediente, {
        nombreArchivo: uploadedFile.file.name,
        tamanoBytes: uploadedFile.file.size,
        mimeType: "application/pdf",
        sha256Hash: uploadedFile.sha256,
        storagePath: uploadedFile.s3Key,
        folios,
      });

      setResultadoExitoso(res);

      // Invalidar caché del expediente para refrescar Visor y Secciones
      await queryClient.invalidateQueries({
        queryKey: ["expediente", idExpediente],
      });

      onExito?.(res);
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        setErrorOperacion(
          err.problemDetails?.detail ||
            err.message ||
            "Error al vincular el documento al expediente.",
        );
      } else if (err instanceof Error) {
        setErrorOperacion(err.message);
      } else {
        setErrorOperacion(
          "Ocurrió un error inesperado al procesar la digitalización.",
        );
      }
    } finally {
      setProcesando(false);
    }
  }

  function handleCerrar() {
    if (procesando) return;
    onCerrar();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-descripcion`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl transition-all sm:p-8">
        {/* Cabecera */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                Mesa de Partes
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Fase Posterior a Recepción
              </span>
            </div>
            <h2
              id={`${id}-titulo`}
              className="mt-1 text-xl font-bold text-slate-900"
            >
              Digitalización y Foliación Documental
            </h2>
            <p id={`${id}-descripcion`} className="mt-1 text-sm text-slate-600">
              Vincule el documento PDF escaneado al expediente físico existente{" "}
              <strong className="text-slate-900">{codigoCut}</strong> sin
              duplicar el CUT.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            disabled={procesando}
            aria-label="Cerrar modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Resumen del Expediente */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
          <div className="flex justify-between gap-2">
            <span className="font-semibold text-slate-500">EXPEDIENTE:</span>
            <span className="font-bold text-blue-800">{codigoCut}</span>
          </div>
          <div className="mt-1 flex justify-between gap-2">
            <span className="font-semibold text-slate-500">ASUNTO:</span>
            <span className="truncate text-slate-800" title={asunto}>
              {asunto}
            </span>
          </div>
        </div>

        {/* Éxito */}
        {resultadoExitoso ? (
          <div className="mt-6 space-y-4">
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">✓</span>
                <h3 className="font-bold text-emerald-950">
                  ¡Digitalización e incorporación completada!
                </h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-emerald-800">
                El documento PDF se vinculó legalmente al expediente{" "}
                <strong>{codigoCut}</strong> y se le asignaron folios
                electrónicos correlativos.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-white/70 p-3 text-xs">
                <div>
                  <dt className="text-slate-500">Archivo:</dt>
                  <dd className="font-semibold text-slate-800 truncate">
                    {resultadoExitoso.nombreArchivo}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Folios asignados:</dt>
                  <dd className="font-bold text-emerald-800">
                    F. {String(resultadoExitoso.folios.folioInicio).padStart(4, "0")} a F. {String(resultadoExitoso.folios.folioFin).padStart(4, "0")} ({resultadoExitoso.folios.cantidad} {resultadoExitoso.folios.cantidad === 1 ? "folio" : "folios"})
                  </dd>
                </div>
                <div className="col-span-2 mt-1">
                  <dt className="text-slate-500">Huella SHA-256:</dt>
                  <dd className="font-mono text-[10px] text-slate-600 break-all">
                    {resultadoExitoso.sha256}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCerrar}
                className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
              >
                Ver Expediente con PDF
              </button>
            </div>
          </div>
        ) : (
          /* Formulario de Carga */
          <div className="mt-5 space-y-4">
            {errorOperacion && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800"
              >
                {errorOperacion}
              </div>
            )}

            {/* Selector de Folios Físicos */}
            <div>
              <label
                htmlFor={`${id}-folios`}
                className="block text-xs font-bold text-slate-700 uppercase"
              >
                Cantidad de folios del documento a digitalizar
              </label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  id={`${id}-folios`}
                  type="number"
                  min={1}
                  max={500}
                  value={folios}
                  onChange={(e) => setFolios(Math.max(1, parseInt(e.target.value || "1", 10)))}
                  disabled={procesando}
                  className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 shadow-xs focus:border-blue-600 focus:outline-hidden"
                />
                <span className="text-xs text-slate-500">
                  Total de hojas o caras que componen el documento físico escaneado.
                </span>
              </div>
            </div>

            {/* Dropzone de Carga PDF */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Documento escaneado (Formato PDF)
              </label>
              <FileUploadDropzone
                categoria="expedientes"
                onStatusChange={setUploadStatus}
                onUploaded={(f) => setUploadedFile(f)}
              />
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleCerrar}
                disabled={procesando}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={!puedeConfirmar}
                className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {procesando
                  ? "Registrando y foliando..."
                  : "✓ Confirmar e Incorporar al Expediente"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
