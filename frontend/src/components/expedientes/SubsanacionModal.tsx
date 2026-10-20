import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { ModalAccionProps, ResultadoSubsanacion, SolicitudSubsanacion } from "../../types/expedienteActions";
import { normalizarMotivo } from "../../utils/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import AccionModal from "./AccionModal";

export type SubsanacionModalProps = ModalAccionProps<SolicitudSubsanacion, ResultadoSubsanacion>;

export default function SubsanacionModal(props: SubsanacionModalProps) {
  return props.open ? <FormularioSubsanacion key={props.expediente.id} {...props} /> : null;
}

function FormularioSubsanacion({ expediente, accion, onClose }: SubsanacionModalProps) {
  const id = useId();
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [intento, setIntento] = useState(false);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const confirmacionRef = useRef<HTMLInputElement>(null);
  const formulario = useFormularioExpediente(accion);
  const motivoValido = Boolean(normalizarMotivo(motivo));

  function cerrar() {
    if (!formulario.pending) { accion.restablecer(); onClose(); }
  }
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formulario.pending) return;
    setIntento(true);
    if (!motivoValido) { motivoRef.current?.focus(); return; }
    if (!confirmado) { confirmacionRef.current?.focus(); return; }
    void formulario.enviar({ expediente, motivo: normalizarMotivo(motivo) }, () => {
      setMotivo(""); setConfirmado(false); setIntento(false); onClose();
    });
  }

  return <AccionModal titulo="Subsanar expediente" descripcion={`Expediente ${expediente.codigo}. Registre el motivo de subsanación de las observaciones.`} pending={formulario.pending} onClose={cerrar}>
    <form noValidate onSubmit={enviar}>
      <div className="m03-field"><label htmlFor={`${id}-motivo`}>Motivo de subsanación (obligatorio)</label>
        <textarea id={`${id}-motivo`} ref={motivoRef} data-foco-inicial className="input-sigd" required value={motivo} onChange={(event) => setMotivo(event.target.value)} disabled={formulario.pending} aria-invalid={intento && !motivoValido} aria-describedby={intento && !motivoValido ? `${id}-motivo-error` : undefined} />
        {intento && !motivoValido ? <p className="m03-error" id={`${id}-motivo-error`}>El motivo de subsanación es obligatorio.</p> : null}
      </div>
      <div className="m03-field"><label className="flex items-start gap-3" htmlFor={`${id}-confirmacion`}><input ref={confirmacionRef} id={`${id}-confirmacion`} type="checkbox" checked={confirmado} onChange={(event) => setConfirmado(event.target.checked)} disabled={formulario.pending} aria-invalid={intento && !confirmado} aria-describedby={intento && !confirmado ? `${id}-confirmacion-error` : undefined} />Confirmo el registro de la subsanación para este expediente.</label>
        {intento && !confirmado ? <p className="m03-error" id={`${id}-confirmacion-error`}>Confirme esta acción antes de continuar.</p> : null}
      </div>
      {!accion.disponible ? <p className="m03-notice" role="status">Subsanación no disponible: pendiente de integración con el servidor.</p> : null}
      {formulario.error ? <p role="alert" className="m03-alert">{formulario.error}</p> : null}
      <div className="m03-actions"><button type="button" className="btn-secondary" disabled={formulario.pending} onClick={cerrar}>Cancelar</button><button type="submit" className="btn-primary" disabled={formulario.pending || !accion.disponible}>{formulario.pending ? "Procesando…" : "Confirmar subsanación"}</button></div>
    </form>
  </AccionModal>;
}
