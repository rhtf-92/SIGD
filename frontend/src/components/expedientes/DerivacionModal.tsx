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
  const [mostrarOpcionesDespacho, setMostrarOpcionesDespacho] = useState(false);
  const [tipoSustento, setTipoSustento] = useState<"PROVEIDO" | "MEMORANDO" | "OFICIO" | "INFORME">("PROVEIDO");
  const [numeroSustento, setNumeroSustento] = useState("");
  const [prioridad, setPrioridad] = useState<"NORMAL" | "URGENTE" | "MUY_URGENTE">("NORMAL");
  const [plazoDias, setPlazoDias] = useState<string>("");
  const [instrucciones, setInstrucciones] = useState("");

  const [errores, setErrores] = useState({ unidadDestinoId: "", proveido: "" });
  const destinoRef = useRef<HTMLSelectElement>(null);
  const proveidoRef = useRef<HTMLTextAreaElement>(null);
  const formulario = useFormularioExpediente(accion);
  const opciones = unidades.estado === "listo" ? unidades.datos : [];

  function cerrar() {
    if (!formulario.pending) {
      accion.restablecer();
      onClose();
    }
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formulario.pending) return;
    const validacion = validarDerivacion(destino, proveido, expediente, opciones);
    setErrores(validacion);
    if (validacion.unidadDestinoId) {
      destinoRef.current?.focus();
      return;
    }
    if (validacion.proveido) {
      proveidoRef.current?.focus();
      return;
    }

    const payload: SolicitudDerivacion = {
      expediente,
      unidadDestinoId: destino,
      proveido: normalizarMotivo(proveido),
      ...(tipoSustento !== "PROVEIDO" ? { tipoDocumentoSustento: tipoSustento } : {}),
      ...(numeroSustento.trim() ? { numeroDocumentoSustento: numeroSustento.trim() } : {}),
      ...(prioridad !== "NORMAL" ? { prioridad } : {}),
      ...(plazoDias ? { plazoDias: parseInt(plazoDias, 10) } : {}),
      ...(instrucciones.trim() ? { instrucciones: normalizarMotivo(instrucciones) } : {}),
    };

    void formulario.enviar(payload, () => {
      setDestino("");
      setProveido("");
      setNumeroSustento("");
      setPlazoDias("");
      setInstrucciones("");
      setMostrarOpcionesDespacho(false);
      onClose();
    });
  }

  return (
    <AccionModal
      titulo="Derivar expediente"
      descripcion={`Expediente ${expediente.codigo}. El proveído motivará el pase a otra unidad orgánica.`}
      pending={formulario.pending}
      onClose={cerrar}
    >
      <form noValidate onSubmit={enviar}>
        <div className="m03-field">
          <label htmlFor={`${id}-destino`}>Unidad de destino (obligatoria)</label>
          <select
            id={`${id}-destino`}
            ref={destinoRef}
            data-foco-inicial
            className="input-sigd"
            value={destino}
            onChange={(event) => setDestino(event.target.value)}
            required
            disabled={formulario.pending || unidades.estado !== "listo"}
            aria-invalid={Boolean(errores.unidadDestinoId)}
            aria-describedby={errores.unidadDestinoId ? `${id}-destino-error` : undefined}
          >
            <option value="">Seleccione una unidad</option>
            {opciones.map((unidad) => (
              <option
                key={unidad.id}
                value={unidad.id}
                disabled={!unidad.habilitada || unidad.id === expediente.unidadOrigenId}
              >
                {unidad.nombre}
                {unidad.id === expediente.unidadOrigenId ? " (unidad de origen)" : ""}
              </option>
            ))}
          </select>
          {errores.unidadDestinoId ? (
            <p id={`${id}-destino-error`} className="m03-error">
              {errores.unidadDestinoId}
            </p>
          ) : null}
        </div>

        {unidades.estado === "cargando" ? (
          <p role="status">Cargando unidades…</p>
        ) : unidades.estado === "error" ? (
          <p role="alert" className="m03-alert">
            {unidades.mensaje}
          </p>
        ) : opciones.length === 0 ? (
          <p role="status">No hay unidades de destino disponibles.</p>
        ) : null}

        <div className="m03-field">
          <label htmlFor={`${id}-proveido`}>Proveído motivado (obligatorio)</label>
          <textarea
            id={`${id}-proveido`}
            ref={proveidoRef}
            className="input-sigd"
            value={proveido}
            onChange={(event) => setProveido(event.target.value)}
            required
            disabled={formulario.pending}
            aria-invalid={Boolean(errores.proveido)}
            aria-describedby={errores.proveido ? `${id}-proveido-error` : undefined}
          />
          {errores.proveido ? (
            <p id={`${id}-proveido-error`} className="m03-error">
              {errores.proveido}
            </p>
          ) : null}
        </div>

        <div style={{ margin: "12px 0" }}>
          <button
            type="button"
            className="text-xs text-indigo-700 hover:text-indigo-900 font-medium underline flex items-center gap-1"
            onClick={() => setMostrarOpcionesDespacho(!mostrarOpcionesDespacho)}
            disabled={formulario.pending}
          >
            {mostrarOpcionesDespacho
              ? "▲ Ocultar especificaciones de despacho (Memorando / Prioridad)"
              : "▼ Especificaciones de despacho institucional (Memorando / Prioridad / Plazo)"}
          </button>
        </div>

        {mostrarOpcionesDespacho && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div className="m03-field" style={{ margin: 0 }}>
                <label htmlFor={`${id}-tipo-sustento`} style={{ fontSize: "12px" }}>
                  Tipo de Acto / Sustento
                </label>
                <select
                  id={`${id}-tipo-sustento`}
                  className="input-sigd text-xs"
                  value={tipoSustento}
                  onChange={(e) => setTipoSustento(e.target.value as "PROVEIDO" | "MEMORANDO" | "OFICIO" | "INFORME")}
                  disabled={formulario.pending}
                >
                  <option value="PROVEIDO">Proveído de Atención</option>
                  <option value="MEMORANDO">Memorando Institucional</option>
                  <option value="OFICIO">Oficio de Derivación</option>
                  <option value="INFORME">Informe Técnico</option>
                </select>
              </div>

              <div className="m03-field" style={{ margin: 0 }}>
                <label htmlFor={`${id}-num-sustento`} style={{ fontSize: "12px" }}>
                  N° Documento Sustento
                </label>
                <input
                  id={`${id}-num-sustento`}
                  type="text"
                  className="input-sigd text-xs"
                  placeholder="Ej: MEMO-012-2026-DG"
                  value={numeroSustento}
                  onChange={(e) => setNumeroSustento(e.target.value)}
                  disabled={formulario.pending}
                  maxLength={100}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div className="m03-field" style={{ margin: 0 }}>
                <label htmlFor={`${id}-prioridad`} style={{ fontSize: "12px" }}>
                  Prioridad del Despacho
                </label>
                <select
                  id={`${id}-prioridad`}
                  className="input-sigd text-xs"
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value as "NORMAL" | "URGENTE" | "MUY_URGENTE")}
                  disabled={formulario.pending}
                >
                  <option value="NORMAL">Normal (Ordinaria)</option>
                  <option value="URGENTE">Urgente</option>
                  <option value="MUY_URGENTE">Muy Urgente (Atención Prioritaria)</option>
                </select>
              </div>

              <div className="m03-field" style={{ margin: 0 }}>
                <label htmlFor={`${id}-plazo`} style={{ fontSize: "12px" }}>
                  Plazo de Atención (Días hábiles)
                </label>
                <input
                  id={`${id}-plazo`}
                  type="number"
                  min={1}
                  max={120}
                  className="input-sigd text-xs"
                  placeholder="Ej: 5"
                  value={plazoDias}
                  onChange={(e) => setPlazoDias(e.target.value)}
                  disabled={formulario.pending}
                />
              </div>
            </div>

            <div className="m03-field" style={{ margin: 0 }}>
              <label htmlFor={`${id}-instrucciones`} style={{ fontSize: "12px" }}>
                Instrucciones Procesales Adicionales
              </label>
              <textarea
                id={`${id}-instrucciones`}
                className="input-sigd text-xs"
                rows={2}
                placeholder="Pautas para la evaluación o actuación técnica..."
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                disabled={formulario.pending}
                maxLength={1000}
              />
            </div>
          </div>
        )}

        {!accion.disponible ? (
          <p className="m03-notice" role="status">
            Derivación no disponible: pendiente de integración con el servidor.
          </p>
        ) : null}
        {formulario.error ? (
          <p role="alert" className="m03-alert">
            {formulario.error}
          </p>
        ) : null}
        <div className="m03-actions">
          <button type="button" className="btn-secondary" disabled={formulario.pending} onClick={cerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={formulario.pending || !accion.disponible || opciones.length === 0}
          >
            {formulario.pending ? "Procesando…" : "Confirmar derivación"}
          </button>
        </div>
      </form>
    </AccionModal>
  );
}
