import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { EstadoRecurso } from "../../types/ccdArchivistica";
import type { BusquedaExpedientes, ExpedienteAccionReferencia, ModalAccionProps, SolicitudAcumulacion } from "../../types/expedienteActions";
import { normalizarMotivo, validarAcumulacion } from "../../utils/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import AccionModal from "./AccionModal";

export interface AcumulacionModalProps extends ModalAccionProps<SolicitudAcumulacion, void> {
  busqueda?: BusquedaExpedientes;
}

export default function AcumulacionModal(props: AcumulacionModalProps) {
  return props.open ? <FormularioAcumulacion key={props.expediente.id} {...props} /> : null;
}

function FormularioAcumulacion({ expediente, accion, onClose, busqueda }: AcumulacionModalProps) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<{ texto: string; recurso: EstadoRecurso<readonly ExpedienteAccionReferencia[]> } | null>(null);
  const [seleccionados, setSeleccionados] = useState<readonly ExpedienteAccionReferencia[]>([]);
  const [motivo, setMotivo] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [errores, setErrores] = useState({ conexos: "", motivo: "" });
  const busquedaRef = useRef<HTMLInputElement>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const resumenRef = useRef<HTMLHeadingElement>(null);
  const formulario = useFormularioExpediente(accion);
  const termino = texto.trim();
  const buscar = busqueda?.buscar;

  useEffect(() => {
    if (!buscar || termino.length < 3 || revisando) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => {
      void (async () => {
        try {
          const datos = await buscar(termino, controlador.signal);
          if (!controlador.signal.aborted) setResultado({ texto: termino, recurso: { estado: "listo", datos } });
        } catch {
          if (!controlador.signal.aborted) setResultado({ texto: termino, recurso: { estado: "error", mensaje: "No se pudo buscar expedientes. Intente nuevamente." } });
        }
      })();
    }, 300);
    return () => { window.clearTimeout(temporizador); controlador.abort(); };
  }, [buscar, termino, revisando]);

  useEffect(() => { if (revisando) resumenRef.current?.focus(); }, [revisando]);

  const recurso = resultado?.texto === termino ? resultado.recurso : null;
  const encontrados = recurso?.estado === "listo" ? [...new Map(recurso.datos.filter((item) => item.id.trim() && item.id !== expediente.id).map((item) => [item.id, item])).values()] : [];
  function agregar(item: ExpedienteAccionReferencia) {
    if (item.id === expediente.id || revisando || formulario.pending) return;
    setSeleccionados((previos) => previos.some((previo) => previo.id === item.id) ? previos : [...previos, item]);
  }
  function cerrar() { if (!formulario.pending) { accion.restablecer(); onClose(); } }
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formulario.pending) return;
    const validacion = validarAcumulacion(expediente, seleccionados, motivo);
    setErrores(validacion);
    if (validacion.conexos) { busquedaRef.current?.focus(); return; }
    if (validacion.motivo) { motivoRef.current?.focus(); return; }
    if (!revisando) { setRevisando(true); return; }
    void formulario.enviar({ principal: expediente, conexos: seleccionados, motivo: normalizarMotivo(motivo) }, () => { setSeleccionados([]); setMotivo(""); setRevisando(false); onClose(); });
  }
  return <AccionModal titulo="Acumular expedientes" descripcion={`Expediente principal / CUT matriz: ${expediente.codigo}. Los expedientes conexos se vincularán bajo este principal.`} pending={formulario.pending} onClose={cerrar}>
    <p className="m03-notice">La acumulación requiere conexión entre los asuntos y una justificación motivada, conforme al alcance del Art. 160 de la Ley 27444 indicado en el plan docente.</p>
    <form noValidate onSubmit={enviar}>
      {!revisando ? <>
        <div className="m03-field"><label htmlFor={`${id}-buscar`}>Buscar expedientes conexos por CUT o asunto</label>
          <input id={`${id}-buscar`} type="search" ref={busquedaRef} data-foco-inicial className="input-sigd" value={texto} onChange={(event) => { setTexto(event.target.value); setResultado(null); }} disabled={!buscar || formulario.pending} aria-describedby={`${id}-busqueda-ayuda${errores.conexos ? ` ${id}-conexos-error` : ""}`} aria-invalid={Boolean(errores.conexos)} />
          <p className="m03-help" id={`${id}-busqueda-ayuda`}>{buscar ? "Ingrese al menos 3 caracteres. El principal no aparecerá en los resultados." : "La búsqueda de expedientes aún no está disponible en el servidor."}</p>
        </div>
        {buscar && termino.length >= 3 ? <section aria-label="Resultados de búsqueda">
          {!recurso ? <p role="status">Buscando expedientes…</p> : recurso.estado === "error" ? <p role="alert" className="m03-alert">{recurso.mensaje} Cambie el texto para repetir la búsqueda.</p> : encontrados.length === 0 ? <p role="status">No hay expedientes conexos disponibles para esta búsqueda.</p> :
            <ul className="m03-results">{encontrados.map((item) => <li key={item.id} className="m03-result"><span>{item.codigo}</span><button type="button" className="btn-secondary" disabled={formulario.pending || seleccionados.some((seleccionado) => seleccionado.id === item.id)} onClick={() => agregar(item)} aria-label={`Agregar ${item.codigo}`}>{seleccionados.some((seleccionado) => seleccionado.id === item.id) ? "Seleccionado" : "Agregar"}</button></li>)}</ul>}
        </section> : null}
        <p className="m03-help" role="status">{seleccionados.length} expediente(s) seleccionado(s).</p>
        <ul aria-label="Expedientes seleccionados">{seleccionados.map((item) => <li key={item.id} className="m03-result"><span>{item.codigo}</span><button type="button" className="btn-secondary" disabled={formulario.pending} onClick={() => setSeleccionados((previos) => previos.filter((previo) => previo.id !== item.id))} aria-label={`Retirar ${item.codigo}`}>Retirar</button></li>)}</ul>
        {errores.conexos ? <p id={`${id}-conexos-error`} className="m03-error" role="alert">{errores.conexos}</p> : null}
        <div className="m03-field"><label htmlFor={`${id}-motivo`}>Justificación de acumulación (obligatoria)</label>
          <textarea id={`${id}-motivo`} ref={motivoRef} className="input-sigd" value={motivo} onChange={(event) => setMotivo(event.target.value)} required disabled={formulario.pending} aria-invalid={Boolean(errores.motivo)} aria-describedby={errores.motivo ? `${id}-motivo-error` : undefined} />
          {errores.motivo ? <p id={`${id}-motivo-error`} className="m03-error">{errores.motivo}</p> : null}
        </div>
      </> : <section className="m03-notice my-4" aria-labelledby={`${id}-resumen`}>
        <h3 id={`${id}-resumen`} ref={resumenRef} tabIndex={-1} className="m03-heading">Resumen de acumulación</h3>
        <p><strong>CUT matriz:</strong> {expediente.codigo}</p>
        <p><strong>Expedientes conexos:</strong></p><ul>{seleccionados.map((item) => <li key={item.id}>{item.codigo}</li>)}</ul>
        <p className="whitespace-pre-wrap"><strong>Justificación:</strong> {normalizarMotivo(motivo)}</p>
        <p className="m03-help">Revise el principal y los conexos antes de confirmar.</p>
      </section>}
      {!accion.disponible ? <p className="m03-notice" role="status">Acumulación no disponible: pendiente de integración con el servidor. Puede revisar la selección; no se enviará ninguna operación.</p> : null}
      {formulario.error ? <p role="alert" className="m03-alert">{formulario.error}</p> : null}
      <div className="m03-actions"><button type="button" className="btn-secondary" disabled={formulario.pending} onClick={cerrar}>Cancelar</button>
        {revisando ? <button type="button" className="btn-secondary" disabled={formulario.pending} onClick={() => setRevisando(false)}>Volver a editar</button> : null}
        <button type="submit" className="btn-primary" disabled={formulario.pending || (revisando && !accion.disponible)}>{formulario.pending ? "Procesando…" : revisando ? "Confirmar acumulación" : "Revisar acumulación"}</button>
      </div>
    </form>
  </AccionModal>;
}
