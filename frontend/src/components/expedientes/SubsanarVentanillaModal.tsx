import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import AccionModal from "./AccionModal";
import { apiClient } from "../../api/client";

export interface SubsanarVentanillaModalProps {
  open: boolean;
  expediente: { id: string; codigo: string };
  onClose: () => void;
  onExito?: () => void;
}

export default function SubsanarVentanillaModal(props: SubsanarVentanillaModalProps) {
  return props.open ? <FormularioSubsanarVentanilla key={props.expediente.id} {...props} /> : null;
}

function FormularioSubsanarVentanilla({ expediente, onClose, onExito }: SubsanarVentanillaModalProps) {
  const id = useId();
  const [motivo, setMotivo] = useState("");
  const [sustento, setSustento] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cargando) return;
    if (!motivo.trim()) {
      setError("El detalle o motivo de la subsanación es obligatorio.");
      motivoRef.current?.focus();
      return;
    }

    setCargando(true);
    setError(null);

    try {
      await apiClient.post(`/api/v1/expedientes/${encodeURIComponent(expediente.id)}/subsanar`, {
        motivo: motivo.trim(),
        sustentoSubsanacion: sustento.trim() || null,
        canalRecepcion: "VENTANILLA_MESA_PARTES",
      });

      if (onExito) onExito();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar la subsanación.";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }

  return (
    <AccionModal
      titulo="Registrar subsanación por ventanilla"
      descripcion={`Expediente ${expediente.codigo}. Registre los descargos o requisitos subsanados por el administrado en ventanilla presencial.`}
      pending={cargando}
      onClose={onClose}
    >
      <p className="m03-notice" id={`${id}-sla`}>
        La subsanación formal reactivará el trámite y reanudará el cómputo del plazo de SLA institucional.
      </p>
      <form noValidate onSubmit={enviar}>
        <div className="m03-field">
          <label htmlFor={`${id}-motivo`}>Descripción de la subsanación presentada (obligatorio)</label>
          <textarea
            id={`${id}-motivo`}
            ref={motivoRef}
            data-foco-inicial
            className="input-sigd"
            required
            rows={3}
            placeholder="Detalle los requisitos y descargos presentados por el administrado..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={cargando}
          />
        </div>
        <div className="m03-field">
          <label htmlFor={`${id}-sustento`}>Observaciones adicionales o folios recibidos (opcional)</label>
          <textarea
            id={`${id}-sustento`}
            className="input-sigd"
            rows={2}
            placeholder="Indicación de folios, vouchers u otros recaudos físicos..."
            value={sustento}
            onChange={(e) => setSustento(e.target.value)}
            disabled={cargando}
          />
        </div>
        {error && <p role="alert" className="m03-alert">{error}</p>}
        <div className="m03-actions">
          <button type="button" className="btn-secondary" disabled={cargando} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={cargando}>
            {cargando ? "Registrando…" : "Confirmar subsanación"}
          </button>
        </div>
      </form>
    </AccionModal>
  );
}
