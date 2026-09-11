import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { EstadoRecurso } from "../../types/ccdArchivistica";
import type { ModalAccionProps, ResultadoDerivacion, SolicitudDerivacion, UnidadDestino } from "../../types/expedienteActions";
import { normalizarMotivo, validarDerivacion } from "../../utils/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import AccionModal from "./AccionModal";

export interface DerivacionModalProps extends ModalAccionProps<SolicitudDerivacion, ResultadoDerivacion> {
  unidades: EstadoRecurso<readonly UnidadDestino[]>;
}

export default function DerivacionModal(props: DerivacionModalProps) {
  return props.open ? <FormularioDerivacion key={props.expediente.id} {...props} /> : null;
}

function FormularioDerivacion({ expediente, unidades, accion, onClose }: DerivacionModalProps) {
  const id = useId();
  const [destino, setDestino] = useState("");
  const [proveido, setProveido] = useState("");
  const [errores, setErrores] = useState({ unidadDestinoId: "", proveido: "" });
  const destinoRef = useRef<HTMLSelectElement>(null);
  const proveidoRef = useRef<HTMLTextAreaElement>(null);
  const formulario = useFormularioExpediente(accion);
  const opciones = unidades.estado === "listo" ? unidades.datos : [];
  function cerrar() { if (!formulario.pending) { accion.restablecer(); onClose(); } }
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formulario.pending) return;
    const validacion = validarDerivacion(destino, proveido, expediente, opciones);
    setErrores(validacion);
    if (validacion.unidadDestinoId) { destinoRef.current?.focus(); return; }
    if (validacion.proveido) { proveidoRef.current?.focus(); return; }
    void formulario.enviar({ expediente, unidadDestinoId: destino, proveido: normalizarMotivo(proveido) }, () => { setDestino(""); setProveido(""); onClose(); });
  }
  return <AccionModal titulo="Derivar expediente" descripcion={`Expediente ${expediente.codigo}. El proveído motivará el pase a otra unidad orgánica.`} pending={formulario.pending} onClose={cerrar}>
    <form noValidate onSubmit={enviar}>
      <div className="m03-field"><label htmlFor={`${id}-destino`}>Unidad de destino (obligatoria)</label>
        <select id={`${id}-destino`} ref={destinoRef} data-foco-inicial className="input-sigd" value={destino} onChange={(event) => setDestino(event.target.value)} required disabled={formulario.pending || unidades.estado !== "listo"} aria-invalid={Boolean(errores.unidadDestinoId)} aria-describedby={errores.unidadDestinoId ? `${id}-destino-error` : undefined}>
          <option value="">Seleccione una unidad</option>
          {opciones.map((unidad) => <option key={unidad.id} value={unidad.id} disabled={!unidad.habilitada || unidad.id === expediente.unidadOrigenId}>{unidad.nombre}{unidad.id === expediente.unidadOrigenId ? " (unidad de origen)" : ""}</option>)}
        </select>
        {errores.unidadDestinoId ? <p id={`${id}-destino-error`} className="m03-error">{errores.unidadDestinoId}</p> : null}
      </div>
      {unidades.estado === "cargando" ? <p role="status">Cargando unidades…</p> : unidades.estado === "error" ? <p role="alert" className="m03-alert">{unidades.mensaje}</p> : opciones.length === 0 ? <p role="status">No hay unidades de destino disponibles.</p> : null}
      <div className="m03-field"><label htmlFor={`${id}-proveido`}>Proveído motivado (obligatorio)</label>
        <textarea id={`${id}-proveido`} ref={proveidoRef} className="input-sigd" value={proveido} onChange={(event) => setProveido(event.target.value)} required disabled={formulario.pending} aria-invalid={Boolean(errores.proveido)} aria-describedby={errores.proveido ? `${id}-proveido-error` : undefined} />
        {errores.proveido ? <p id={`${id}-proveido-error`} className="m03-error">{errores.proveido}</p> : null}
      </div>
      {!accion.disponible ? <p className="m03-notice" role="status">Derivación no disponible: pendiente de integración con el servidor.</p> : null}
      {formulario.error ? <p role="alert" className="m03-alert">{formulario.error}</p> : null}
      <div className="m03-actions"><button type="button" className="btn-secondary" disabled={formulario.pending} onClick={cerrar}>Cancelar</button><button type="submit" className="btn-primary" disabled={formulario.pending || !accion.disponible || opciones.length === 0}>{formulario.pending ? "Procesando…" : "Confirmar derivación"}</button></div>
    </form>
  </AccionModal>;
}
