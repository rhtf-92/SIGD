import { useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import AccionModal from "./AccionModal";
import FileUploadDropzone from "../common/FileUploadDropzone";
import type { UploadedFile, UploadStatus } from "../../hooks/usePresignedUpload";
import { adjuntarDocumentoDigitalizado } from "../../api/digitalizacionApi";
import { apiClient } from "../../api/client";
import { ApiHttpError } from "../../types/api";
import type { DocumentoAdjuntoRutaDoc } from "../../types/expediente";

export interface DesgloseModalProps {
  open: boolean;
  onClose: () => void;
  expedienteId: string;
  codigoCut: string;
  documentos: DocumentoAdjuntoRutaDoc[];
  onExito: (mensaje: string) => void;
}

export default function DesgloseModal(props: DesgloseModalProps) {
  if (!props.open) return null;
  return <FormularioDesglose key={props.expedienteId} {...props} />;
}

function FormularioDesglose({
  expedienteId,
  codigoCut,
  documentos,
  onClose,
  onExito,
}: Omit<DesgloseModalProps, "open">) {
  const id = useId();

  // Documentos elegibles (no desglosados previamente)
  const documentosElegibles = useMemo(
    () => documentos.filter((d) => !d.desglosado),
    [documentos]
  );

  const [idDocumentoSeleccionado, setIdDocumentoSeleccionado] = useState<string>(
    documentosElegibles[0]?.idDocumento ?? ""
  );
  const [actoAutorizacion, setActoAutorizacion] = useState("");
  const [motivoDesglose, setMotivoDesglose] = useState("");
  const [solicitanteNombre, setSolicitanteNombre] = useState("");
  const [solicitanteDocumento, setSolicitanteDocumento] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Subida de copia certificada sustitutoria
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");

  const [revisando, setRevisando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actoRef = useRef<HTMLInputElement>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const solicitanteRef = useRef<HTMLInputElement>(null);

  const documentoSeleccionado = useMemo(
    () => documentos.find((d) => d.idDocumento === idDocumentoSeleccionado),
    [documentos, idDocumentoSeleccionado]
  );

  const cantidadFolios = documentoSeleccionado
    ? Math.max(1, documentoSeleccionado.folioFin - documentoSeleccionado.folioInicio + 1)
    : 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (procesando) return;

    if (!documentoSeleccionado) {
      setError("Debe seleccionar un documento original para el desglose.");
      return;
    }
    if (documentoSeleccionado.desglosado) {
      setError("El documento seleccionado ya ha sido desglosado formalmente con anterioridad.");
      return;
    }
    if (!actoAutorizacion.trim()) {
      setError("Debe especificar el acto de autorización de desglose.");
      actoRef.current?.focus();
      return;
    }
    if (!motivoDesglose.trim() || motivoDesglose.trim().length < 5) {
      setError("Debe detallar el motivo del desglose (mínimo 5 caracteres).");
      motivoRef.current?.focus();
      return;
    }
    if (!solicitanteNombre.trim()) {
      setError("Debe ingresar el nombre del solicitante o administrado receptor.");
      solicitanteRef.current?.focus();
      return;
    }
    if (!solicitanteDocumento.trim()) {
      setError("Debe ingresar el DNI o documento de identidad del solicitante.");
      return;
    }

    if (!revisando) {
      setError(null);
      setRevisando(true);
      return;
    }

    setProcesando(true);
    setError(null);

    try {
      let documentoSustitutorioId: string | null = null;

      // 1. Si adjuntó copia certificada, digitalizarla primero en MinIO y registrarla
      if (uploadedFile && uploadStatus === "success") {
        const resDig = await adjuntarDocumentoDigitalizado(expedienteId, {
          nombreArchivo: uploadedFile.file.name,
          tamanoBytes: uploadedFile.file.size,
          mimeType: "application/pdf",
          sha256Hash: uploadedFile.sha256,
          storagePath: uploadedFile.s3Key,
          folios: cantidadFolios,
        });
        documentoSustitutorioId = resDig.documentoId;
      }

      // 2. Registrar el desglose documental
      const { data } = await apiClient.post<{
        ok: boolean;
        mensaje: string;
        idDesglose: string;
        folioInicio: number;
        folioFin: number;
        cantidadFolios: number;
      }>(`/api/v1/rutadoc/expedientes/${encodeURIComponent(expedienteId)}/desglose`, {
        documentoAdjuntoId: documentoSeleccionado.idDocumento,
        actoAutorizacion: actoAutorizacion.trim(),
        motivoDesglose: motivoDesglose.trim(),
        solicitanteNombre: solicitanteNombre.trim(),
        solicitanteDocumento: solicitanteDocumento.trim(),
        documentoSustitutorioId,
        observaciones: observaciones.trim() || undefined,
      });

      onExito(
        data.mensaje ||
          `Desglose registrado formalmente. Foliación F. ${data.folioInicio} a ${data.folioFin} conservada intacta según Directiva AGN.`
      );
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        setError(err.problemDetails?.detail || err.message || "Error al procesar el desglose documental.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error inesperado al procesar el desglose.");
      }
      setRevisando(false);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <AccionModal
      titulo="Desglose documental (Art. 170 LPAG)"
      descripcion={`Retiro formal de pieza documental original del expediente ${codigoCut} con preservación estricta de la foliación continua.`}
      pending={procesando}
      onClose={() => {
        if (!procesando) onClose();
      }}
    >
      <div className="m03-notice mb-4">
        <p className="font-semibold text-slate-800">
          Principio archivístico de foliación inalterable (Directiva N° 001-2019-AGN/DDPA):
        </p>
        <p className="text-xs text-slate-600 mt-0.5">
          El desglose de una pieza original no altera, rectifica ni renumera los folios del expediente. En su lugar
          físico y lógico queda la copia fedateada o la constancia de desglose en el mismo rango de folios.
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit}>
        {!revisando ? (
          <>
            {/* Selección del documento original */}
            <div className="m03-field">
              <label htmlFor={`${id}-documento`}>Documento original a desglosar</label>
              {documentosElegibles.length === 0 ? (
                <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded">
                  No hay documentos disponibles para desglosar en este expediente.
                </p>
              ) : (
                <select
                  id={`${id}-documento`}
                  className="input-sigd"
                  data-foco-inicial
                  value={idDocumentoSeleccionado}
                  onChange={(e) => setIdDocumentoSeleccionado(e.target.value)}
                  disabled={procesando}
                >
                  {documentosElegibles.map((doc) => (
                    <option key={doc.idDocumento} value={doc.idDocumento}>
                      {doc.nombre} (Folios {doc.folioInicio} a {doc.folioFin} — {doc.folioFin - doc.folioInicio + 1} fojas)
                    </option>
                  ))}
                </select>
              )}
              {documentoSeleccionado && (
                <div className="mt-2 rounded bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-700 flex justify-between items-center">
                  <span><strong>Rango conservado:</strong> F. {documentoSeleccionado.folioInicio} al F. {documentoSeleccionado.folioFin}</span>
                  <span className="font-semibold text-indigo-700">{cantidadFolios} foja(s) afectada(s)</span>
                </div>
              )}
            </div>

            {/* Información administrativa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="m03-field">
                <label htmlFor={`${id}-acto`}>Acto administrativo de autorización</label>
                <input
                  id={`${id}-acto`}
                  ref={actoRef}
                  type="text"
                  className="input-sigd"
                  placeholder="Ej: Proveído N° 045-2026-DIR o R.D."
                  value={actoAutorizacion}
                  onChange={(e) => setActoAutorizacion(e.target.value)}
                  required
                  disabled={procesando}
                />
              </div>

              <div className="m03-field">
                <label htmlFor={`${id}-solicitante-doc`}>DNI / Doc. del solicitante</label>
                <input
                  id={`${id}-solicitante-doc`}
                  type="text"
                  className="input-sigd"
                  placeholder="Ej: 47895214"
                  value={solicitanteDocumento}
                  onChange={(e) => setSolicitanteDocumento(e.target.value)}
                  required
                  disabled={procesando}
                />
              </div>
            </div>

            <div className="m03-field">
              <label htmlFor={`${id}-solicitante-nom`}>Nombre completo del solicitante / administrado receptor</label>
              <input
                id={`${id}-solicitante-nom`}
                ref={solicitanteRef}
                type="text"
                className="input-sigd"
                placeholder="Ej: Juan Pérez Rodríguez"
                value={solicitanteNombre}
                onChange={(e) => setSolicitanteNombre(e.target.value)}
                required
                disabled={procesando}
              />
            </div>

            <div className="m03-field">
              <label htmlFor={`${id}-motivo`}>Motivo del desglose (obligatorio)</label>
              <textarea
                id={`${id}-motivo`}
                ref={motivoRef}
                className="input-sigd"
                rows={2}
                placeholder="Ej: Devolución de título profesional original para trámite colegiatura..."
                value={motivoDesglose}
                onChange={(e) => setMotivoDesglose(e.target.value)}
                required
                disabled={procesando}
              />
            </div>

            {/* Adjuntar copia sustitutoria */}
            <div className="m03-field">
              <label>Copia certificada o fedateada sustitutoria (PDF opcional)</label>
              <p className="m03-help mb-2">
                Conforme a la Directiva AGN, en el lugar de la pieza desglosada debe insertarse la copia autenticada que ocupe el mismo rango foliado.
              </p>
              <FileUploadDropzone
                categoria="expedientes"
                onStatusChange={setUploadStatus}
                onUploaded={(f: UploadedFile) => setUploadedFile(f)}
              />
              {uploadedFile && uploadStatus === "success" && (
                <p className="mt-1 text-xs text-emerald-700 font-medium">
                  ✓ Copia fedateada lista para incorporación: {uploadedFile.file.name} ({Math.round(uploadedFile.file.size / 1024)} KB)
                </p>
              )}
            </div>

            <div className="m03-field">
              <label htmlFor={`${id}-obs`}>Observaciones adicionales (opcional)</label>
              <input
                id={`${id}-obs`}
                type="text"
                className="input-sigd"
                placeholder="Observaciones de entrega o diligencia..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                disabled={procesando}
              />
            </div>
          </>
        ) : (
          <section className="m03-notice my-4">
            <h3 className="m03-heading text-sm font-bold text-slate-900">Resumen del desglose documental</h3>
            <p className="mt-2 text-xs">
              Revise cuidadosamente los datos del retiro material antes de formalizar la constancia archivística:
            </p>
            <div className="mt-3 rounded border border-slate-200 bg-white p-3 text-xs space-y-1.5">
              <p><strong>Documento original a desglosar:</strong> {documentoSeleccionado?.nombre}</p>
              <p><strong>Rango de folios conservado:</strong> F. {documentoSeleccionado?.folioInicio} a F. {documentoSeleccionado?.folioFin} ({cantidadFolios} foja(s))</p>
              <p><strong>Acto de autorización:</strong> {actoAutorizacion.trim()}</p>
              <p><strong>Solicitante receptor:</strong> {solicitanteNombre.trim()} (Doc: {solicitanteDocumento.trim()})</p>
              <p><strong>Motivo:</strong> {motivoDesglose.trim()}</p>
              <p>
                <strong>Copia fedateada sustitutoria:</strong>{" "}
                {uploadedFile ? uploadedFile.file.name : "Sin copia digital adjunta (se deja constancia formal en físico)"}
              </p>
              {observaciones.trim() && <p><strong>Observaciones:</strong> {observaciones.trim()}</p>}
            </div>
          </section>
        )}

        {error && <p role="alert" className="m03-alert text-xs text-red-700 bg-red-50 p-2 rounded mb-3">{error}</p>}

        <div className="m03-actions flex gap-2 justify-end mt-4">
          <button type="button" className="btn-secondary" disabled={procesando} onClick={onClose}>
            Cancelar
          </button>
          {revisando && (
            <button type="button" className="btn-secondary" disabled={procesando} onClick={() => setRevisando(false)}>
              Volver a editar
            </button>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={procesando || documentosElegibles.length === 0}
          >
            {procesando ? "Procesando..." : revisando ? "Confirmar desglose" : "Revisar desglose"}
          </button>
        </div>
      </form>
    </AccionModal>
  );
}
