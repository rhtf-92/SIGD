import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { EstadoRecurso } from "../../types/ccdArchivistica";
import type { ModalAccionProps, ResultadoDerivacion, SolicitudDerivacion, UnidadDestino } from "../../types/expedienteActions";
import { normalizarMotivo, validarDerivacion } from "../../utils/expedienteActions";
import { useFormularioExpediente } from "../../hooks/useFormularioExpediente";
import AccionModal from "./AccionModal";

export interface DerivacionModalProps extends ModalAccionProps<SolicitudDerivacion, ResultadoDerivacion> {
  unidades: EstadoRecurso<readonly UnidadDestino[]>;
  destinoSugeridoId?: string;
  destinoSugeridoNombre?: string;
}

export default function DerivacionModal(props: DerivacionModalProps) {
  return props.open ? <FormularioDerivacion key={props.expediente.id} {...props} /> : null;
}

function FormularioDerivacion({ expediente, unidades, accion, onClose, destinoSugeridoId, destinoSugeridoNombre }: DerivacionModalProps) {
  const id = useId();
  const [destino, setDestino] = useState(destinoSugeridoId || "");
  const [proveido, setProveido] = useState("Pase a la unidad orgánica correspondiente para su calificación, trámite y atención técnica.");
  const [justificacionDesviacion, setJustificacionDesviacion] = useState("Derivación técnica al área especializada competente para la evaluación del trámite.");
  const [errores, setErrores] = useState({ unidadDestinoId: "", proveido: "", justificacionDesviacion: "" });
  const destinoRef = useRef<HTMLSelectElement>(null);
  const proveidoRef = useRef<HTMLTextAreaElement>(null);
  const justificacionRef = useRef<HTMLTextAreaElement>(null);
  const formulario = useFormularioExpediente(accion);
  const opciones = unidades.estado === "listo" ? unidades.datos : [];
  const esDesviacion = Boolean(destinoSugeridoId && destino && destino !== destinoSugeridoId);

  const handleCambiarDestino = (nuevoDestino: string) => {
    setDestino(nuevoDestino);
    if (destinoSugeridoId && nuevoDestino && nuevoDestino !== destinoSugeridoId) {
      if (!justificacionDesviacion.trim()) {
        setJustificacionDesviacion("Derivación técnica al área especializada competente para la evaluación del trámite.");
      }
    }
  };

  const prellenarProveido = () => {
    setProveido("Pase a la unidad orgánica correspondiente para su calificación, trámite y atención técnica.");
  };

  const prellenarJustificacion = () => {
    setJustificacionDesviacion("Derivación técnica y funcional al área especializada competente para la evaluación del trámite.");
  };

  function cerrar() { if (!formulario.pending) { accion.restablecer(); onClose(); } }
  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formulario.pending) return;
    const validacion = validarDerivacion(destino, proveido, expediente, opciones, destinoSugeridoId, justificacionDesviacion);
    setErrores({
      unidadDestinoId: validacion.unidadDestinoId,
      proveido: validacion.proveido,
      justificacionDesviacion: validacion.justificacionDesviacion ?? "",
    });
    if (validacion.unidadDestinoId) { destinoRef.current?.focus(); return; }
    if (validacion.proveido) { proveidoRef.current?.focus(); return; }
    if (validacion.justificacionDesviacion) { justificacionRef.current?.focus(); return; }
    void formulario.enviar({
      expediente,
      unidadDestinoId: destino,
      proveido: normalizarMotivo(proveido),
      justificacion_desviacion: esDesviacion ? normalizarMotivo(justificacionDesviacion) : undefined,
    }, () => { setDestino(""); setProveido(""); setJustificacionDesviacion(""); onClose(); });
  }
  return <AccionModal titulo="Derivar expediente" descripcion={`Expediente ${expediente.codigo}. El proveído motivará el pase a otra unidad orgánica.`} pending={formulario.pending} onClose={cerrar}>
    <form noValidate onSubmit={enviar}>
      {destinoSugeridoNombre && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 mb-3 flex items-start gap-2">
          <span className="text-base shrink-0" aria-hidden="true">💡</span>
          <div>
            <span className="font-bold">Destino sugerido según TUPA: </span>
            <span>{destinoSugeridoNombre}</span>
            <p className="text-[11px] text-blue-700 mt-0.5">
              Puede confirmar esta unidad orgánica sugerida o seleccionar un destino diferente según corresponda.
            </p>
          </div>
        </div>
      )}
      <div className="m03-field"><label htmlFor={`${id}-destino`}>Unidad de destino (obligatoria)</label>
        <select id={`${id}-destino`} ref={destinoRef} data-foco-inicial className="input-sigd" value={destino} onChange={(event) => handleCambiarDestino(event.target.value)} required disabled={formulario.pending || unidades.estado !== "listo"} aria-invalid={Boolean(errores.unidadDestinoId)} aria-describedby={errores.unidadDestinoId ? `${id}-destino-error` : undefined}>
          <option value="">Seleccione una unidad</option>
          {opciones.map((unidad) => {
            const noHabilitada = !unidad.habilitada;
            const esOrigen = unidad.id === expediente.unidadOrigenId;
            const noEnrutable = unidad.enrutable === false;
            const disabled = noHabilitada || esOrigen || noEnrutable;
            let sufijo = "";
            if (esOrigen) sufijo = " (unidad de origen)";
            else if (noEnrutable) sufijo = " (no enrutable: sin personal habilitado)";

            return (
              <option key={unidad.id} value={unidad.id} disabled={disabled}>
                {unidad.nombre}{sufijo}
              </option>
            );
          })}
        </select>
        {errores.unidadDestinoId ? <p id={`${id}-destino-error`} className="m03-error">{errores.unidadDestinoId}</p> : null}
      </div>
      {unidades.estado === "cargando" ? <p role="status">Cargando unidades…</p> : unidades.estado === "error" ? <p role="alert" className="m03-alert">{unidades.mensaje}</p> : opciones.length === 0 ? <p role="status">No hay unidades de destino disponibles.</p> : null}
      {esDesviacion && (
        <div className="m03-field">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor={`${id}-justificacion`} className="text-xs font-semibold text-slate-700">
              Justificación de desviación TUPA (obligatoria al cambiar de unidad sugerida)
            </label>
            <button
              type="button"
              onClick={prellenarJustificacion}
              className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold underline"
            >
              Usar motivo estándar
            </button>
          </div>
          <textarea
            id={`${id}-justificacion`}
            ref={justificacionRef}
            className="input-sigd text-xs"
            rows={3}
            value={justificacionDesviacion}
            onChange={(event) => setJustificacionDesviacion(event.target.value)}
            required
            disabled={formulario.pending}
            placeholder="Indique el motivo técnico o administrativo para derivar a un área distinta a la sugerida por TUPA..."
            aria-invalid={Boolean(errores.justificacionDesviacion)}
            aria-describedby={errores.justificacionDesviacion ? `${id}-justificacion-error` : undefined}
          />
          {errores.justificacionDesviacion ? <p id={`${id}-justificacion-error`} className="m03-error">{errores.justificacionDesviacion}</p> : null}
        </div>
      )}
      <div className="m03-field">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={`${id}-proveido`} className="text-xs font-semibold text-slate-700">
            Proveído motivado (obligatorio)
          </label>
          <button
            type="button"
            onClick={prellenarProveido}
            className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold underline"
          >
            Usar proveído estándar
          </button>
        </div>
        <textarea
          id={`${id}-proveido`}
          ref={proveidoRef}
          className="input-sigd text-xs"
          rows={3}
          value={proveido}
          onChange={(event) => setProveido(event.target.value)}
          required
          disabled={formulario.pending}
          placeholder="Ingrese el proveído o indicación de pase a la unidad..."
          aria-invalid={Boolean(errores.proveido)}
          aria-describedby={errores.proveido ? `${id}-proveido-error` : undefined}
        />
        {errores.proveido ? <p id={`${id}-proveido-error`} className="m03-error">{errores.proveido}</p> : null}
      </div>
      {!accion.disponible ? <p className="m03-notice" role="status">Derivación no disponible: pendiente de integración con el servidor.</p> : null}
      {formulario.error ? <p role="alert" className="m03-alert">{formulario.error}</p> : null}
      <div className="m03-actions"><button type="button" className="btn-secondary" disabled={formulario.pending} onClick={cerrar}>Cancelar</button><button type="submit" className="btn-primary" disabled={formulario.pending || !accion.disponible || opciones.length === 0}>{formulario.pending ? "Procesando…" : "Confirmar derivación"}</button></div>
    </form>
  </AccionModal>;
}
