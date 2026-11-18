import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import AccionModal from "./AccionModal";
import { apiClient } from "../../api/client";
import { ApiHttpError } from "../../types/api";
import type { ItemAcumulacion } from "../../types/expediente";

export interface DesacumulacionModalProps {
  open: boolean;
  onClose: () => void;
  acumulacion: ItemAcumulacion | null;
  onExito: (mensaje: string) => void;
}

export default function DesacumulacionModal(props: DesacumulacionModalProps) {
  if (!props.open || !props.acumulacion) return null;
  return <FormularioDesacumulacion key={props.acumulacion.id_acumulacion} {...props} acumulacion={props.acumulacion} />;
}

function FormularioDesacumulacion({
  acumulacion,
  onClose,
  onExito,
}: Omit<DesacumulacionModalProps, "open"> & { acumulacion: ItemAcumulacion }) {
  const id = useId();
  const [actoDesacumulacion, setActoDesacumulacion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actoRef = useRef<HTMLInputElement>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (procesando) return;

    if (!actoDesacumulacion.trim()) {
      setError("Debe especificar el acto administrativo de desacumulación.");
      actoRef.current?.focus();
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 5) {
      setError("Debe ingresar una justificación motivada (mínimo 5 caracteres).");
      motivoRef.current?.focus();
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
      const { data } = await apiClient.post<{ ok: boolean; mensaje?: string }>(
        `/api/v1/rutadoc/expedientes/${encodeURIComponent(acumulacion.expediente_principal_id)}/desacumular`,
        {
          expedienteAccesorioId: acumulacion.expediente_accesorio_id,
          actoDesacumulacion: actoDesacumulacion.trim(),
          motivo: motivo.trim(),
        }
      );

      onExito(data.mensaje || "Expediente desacumulado formalmente según Art. 160 LPAG.");
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        setError(err.problemDetails?.detail || err.message || "Error al desacumular el expediente.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error inesperado al procesar la desacumulación.");
      }
      setRevisando(false);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <AccionModal
      titulo="Desacumular expediente conexo"
      descripcion={`Separación procesal de trámite. El expediente accesorio retornará a su tramitación autónoma.`}
      pending={procesando}
      onClose={() => { if (!procesando) onClose(); }}
    >
      <div className="m03-notice mb-4">
        <p className="font-semibold text-slate-800">Relación a disolver (Art. 160 LPAG):</p>
        <ul className="mt-1 list-disc pl-5 text-xs text-slate-700 space-y-0.5">
          <li><strong>Expediente principal (matriz):</strong> {acumulacion.principal_codigo}</li>
          <li><strong>Expediente accesorio a desacumular:</strong> {acumulacion.accesorio_codigo}</li>
          <li><strong>Acto de acumulación original:</strong> {acumulacion.acto_resolutivo || "No especificado"}</li>
          <li><strong>Fecha de acumulación:</strong> {new Date(acumulacion.fecha_acumulacion).toLocaleString("es-PE")}</li>
        </ul>
      </div>

      <form noValidate onSubmit={handleSubmit}>
        {!revisando ? (
          <>
            <div className="m03-field">
              <label htmlFor={`${id}-acto`}>Acto administrativo de desacumulación (obligatorio)</label>
              <input
                id={`${id}-acto`}
                ref={actoRef}
                type="text"
                data-foco-inicial
                className="input-sigd"
                placeholder="Ej: R.D. N° 088-2026-IESTP-SUIZA o Proveído N° 205"
                value={actoDesacumulacion}
                onChange={(e) => setActoDesacumulacion(e.target.value)}
                required
                disabled={procesando}
              />
              <p className="m03-help">Indique el documento oficial que autoriza la tramitación separada.</p>
            </div>

            <div className="m03-field">
              <label htmlFor={`${id}-motivo`}>Justificación y motivo de desacumulación (obligatorio)</label>
              <textarea
                id={`${id}-motivo`}
                ref={motivoRef}
                className="input-sigd"
                rows={3}
                placeholder="Indique las razones de hecho y derecho por las cuales ya no procede la tramitación conjunta..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
                disabled={procesando}
              />
              <p className="m03-help">Constancia WORM archivística que quedará asentada en el expediente.</p>
            </div>
          </>
        ) : (
          <section className="m03-notice my-4">
            <h3 className="m03-heading text-sm font-bold text-slate-900">Confirmación de desacumulación</h3>
            <p className="mt-2 text-xs">
              ¿Está seguro de formalizar la desacumulación del expediente <strong>{acumulacion.accesorio_codigo}</strong> del expediente matriz <strong>{acumulacion.principal_codigo}</strong>?
            </p>
            <div className="mt-3 rounded border border-slate-200 bg-white p-3 text-xs space-y-1">
              <p><strong>Acto administrativo:</strong> {actoDesacumulacion.trim()}</p>
              <p><strong>Motivo:</strong> {motivo.trim()}</p>
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
          <button type="submit" className="btn-primary" disabled={procesando}>
            {procesando ? "Procesando..." : revisando ? "Confirmar desacumulación" : "Revisar desacumulación"}
          </button>
        </div>
      </form>
    </AccionModal>
  );
}
