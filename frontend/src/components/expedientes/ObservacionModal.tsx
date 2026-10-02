import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { ModalAccionProps, ResultadoObservacion, SolicitudObservacion } from "../../types/expedienteActions";
import { normalizarMotivo } from "../../utils/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import AccionModal from "./AccionModal";

export type ObservacionModalProps = ModalAccionProps<SolicitudObservacion, ResultadoObservacion>;

export default function ObservacionModal(props: ObservacionModalProps) {
  return props.open ? <FormularioObservacion key={props.expediente.id} {...props} /> : null;
}

function FormularioObservacion({ expediente, accion, onClose }: ObservacionModalProps) {
  const id = useId();
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [intento, setIntento] = useState(false);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const confirmacionRef = useRef<HTMLInputElement>(null);
  const formulario = useFormularioExpediente(accion);
  const motivoValido = Boolean(normalizarMotivo(motivo));
  function cerrar() { if (!formulario.pending) { accion.restablecer(); onClose(); } }
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formulario.pending) return;
    setIntento(true);
    if (!motivoValido) { motivoRef.current?.focus(); return; }
    if (!confirmado) { confirmacionRef.current?.focus(); return; }
    void formulario.enviar({ expediente, motivo: normalizarMotivo(motivo) }, () => { setMotivo(""); setConfirmado(false); setIntento(false); onClose(); });
  }
  return <AccionModal titulo="Observar expediente" descripcion={`Expediente ${expediente.codigo}. Registre el pliego de observaciones que deberá subsanarse.`} pending={formulario.pending} onClose={cerrar}>
    <p className="m03-notice" id={`${id}-sla`}>La observación suspenderá temporalmente el SLA hasta su subsanación. El servidor administra los plazos y confirma el estado OBSERVADO.</p>
    <form noValidate onSubmit={enviar}>
      <div className="m03-field"><label htmlFor={`${id}-motivo`}>Pliego o motivo de observación (obligatorio)</label>
        <textarea id={`${id}-motivo`} ref={motivoRef} data-foco-inicial className="input-sigd" required value={motivo} onChange={(event) => setMotivo(event.target.value)} disabled={formulario.pending} aria-invalid={intento && !motivoValido} aria-describedby={intento && !motivoValido ? `${id}-motivo-error` : undefined} />
        {intento && !motivoValido ? <p className="m03-error" id={`${id}-motivo-error`}>El motivo de observación es obligatorio.</p> : null}
      </div>
      <div className="m03-field"><label className="flex items-start gap-3" htmlFor={`${id}-confirmacion`}><input ref={confirmacionRef} id={`${id}-confirmacion`} type="checkbox" checked={confirmado} onChange={(event) => setConfirmado(event.target.checked)} disabled={formulario.pending} aria-invalid={intento && !confirmado} aria-describedby={`${id}-sla${intento && !confirmado ? ` ${id}-confirmacion-error` : ""}`} />Confirmo la observación y la suspensión temporal del SLA.</label>
        {intento && !confirmado ? <p className="m03-error" id={`${id}-confirmacion-error`}>Confirme el efecto de esta acción antes de continuar.</p> : null}
      </div>
      {!accion.disponible ? <p className="m03-notice" role="status">Observación no disponible: pendiente de integración con el servidor.</p> : null}
      {formulario.error ? <p role="alert" className="m03-alert">{formulario.error}</p> : null}
      <div className="m03-actions"><button type="button" className="btn-secondary" disabled={formulario.pending} onClick={cerrar}>Cancelar</button><button type="submit" className="btn-primary" disabled={formulario.pending || !accion.disponible}>{formulario.pending ? "Procesando…" : "Confirmar observación"}</button></div>
    </form>
  </AccionModal>;
}
