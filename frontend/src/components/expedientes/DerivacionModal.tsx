import { useId, useMemo, useRef, useState } from "react";
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

  // Agrupamiento inteligente de unidades
  const opcionesAgrupadas = useMemo(() => {
    const tieneEstructuraInstitucional = opciones.some(
      (u) =>
        u.nombre.includes("ARE_") ||
        u.nombre.includes("Coordinación") ||
        u.nombre.includes("Dirección") ||
        u.nombre.includes("Sub Dirección")
    );

    if (!tieneEstructuraInstitucional) {
      return [{ label: "", items: opciones }];
    }

    const direccion: UnidadDestino[] = [];
    const apoyo: UnidadDestino[] = [];
    const coordinacionesGenerales: UnidadDestino[] = [];
    const coordinacionesCarreras: UnidadDestino[] = [];
    const otras: UnidadDestino[] = [];

    for (const u of opciones) {
      const n = u.nombre.toUpperCase();
      if (
        n.includes("ARE_DIR") ||
        n.includes("ARE_SUBDIR") ||
        n.includes("DIRECCIÓN GENERAL") ||
        n.includes("SUB DIRECCIÓN")
      ) {
        direccion.push(u);
      } else if (
        n.includes("ARE_MPV") ||
        n.includes("ARE_ABA") ||
        n.includes("ARE_SEC") ||
        n.includes("ARE_CAL") ||
        n.includes("ARE_ADM") ||
        n.includes("MESA DE PARTES") ||
        n.includes("SECRETARÍA ACADÉMICA") ||
        n.includes("ABASTECIMIENTO") ||
        n.includes("CALIDAD") ||
        n.includes("ARCHIVO CENTRAL") ||
        n.includes("SISTEMAS")
      ) {
        apoyo.push(u);
      } else if (
        n.includes("ARE_ACAD") ||
        n.includes("ARE_BIE") ||
        n.includes("ARE_INV") ||
        n.includes("COORDINACIÓN ACADÉMICA") ||
        n.includes("BIENESTAR") ||
        n.includes("INVESTIGACIÓN")
      ) {
        coordinacionesGenerales.push(u);
      } else if (n.includes("COORDINACIÓN") || n.includes("ARE_C")) {
        coordinacionesCarreras.push(u);
      } else {
        otras.push(u);
      }
    }

    const grupos = [];
    if (direccion.length > 0)
      grupos.push({ label: "— Órganos de Dirección —", items: direccion });
    if (apoyo.length > 0)
      grupos.push({ label: "— Órganos de Apoyo y Recepción —", items: apoyo });
    if (coordinacionesGenerales.length > 0)
      grupos.push({ label: "— Coordinaciones Generales —", items: coordinacionesGenerales });
    if (coordinacionesCarreras.length > 0)
      grupos.push({
        label: "— Coordinaciones de Programas de Estudio (Carreras) —",
        items: coordinacionesCarreras,
      });
    if (otras.length > 0) grupos.push({ label: "— Otras Unidades —", items: otras });
    return grupos;
  }, [opciones]);

  // Detección de unidad Sub Dirección para flujo asistido
  const subDireccionUnidad = useMemo(() => {
    return opciones.find(
      (u) =>
        u.id === "f1e2d3c4-b5a6-4789-9012-345678900001" ||
        u.nombre.includes("ARE_SUBDIR") ||
        u.nombre.toLowerCase().includes("sub dirección")
    );
  }, [opciones]);

  const esOrigenMesaPartes =
    expediente.unidadOrigenId === "2720dcef-cc8b-440a-a43e-ff83a93266f1" ||
    (typeof expediente.unidadOrigenId === "string" &&
      expediente.unidadOrigenId.toLowerCase().includes("mpv"));

  const esOrigenSubDireccion =
    expediente.unidadOrigenId === "f1e2d3c4-b5a6-4789-9012-345678900001" ||
    (typeof expediente.unidadOrigenId === "string" &&
      expediente.unidadOrigenId.toLowerCase().includes("subdir"));

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
    void formulario.enviar(
      { expediente, unidadDestinoId: destino, proveido: normalizarMotivo(proveido) },
      () => {
        setDestino("");
        setProveido("");
        onClose();
      }
    );
  }

  return (
    <AccionModal
      titulo="Derivar expediente"
      descripcion={`Expediente ${expediente.codigo}. El proveído motivará el pase a otra unidad orgánica.`}
      pending={formulario.pending}
      onClose={cerrar}
    >
      <form noValidate onSubmit={enviar}>
        {/* Sugerencia de Flujo Institucional: Mesa de Partes -> Sub Dirección */}
        {esOrigenMesaPartes && subDireccionUnidad && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900">
            <p className="font-bold flex items-center gap-1.5">
              <span>💡 Flujo Institucional Sugerido:</span>
            </p>
            <p className="mt-1 text-slate-700">
              El trámite debe pasar primero a <strong>Sub Dirección</strong> para evaluación académica y asignación a la Coordinación correspondiente.
            </p>
            {destino !== subDireccionUnidad.id && (
              <button
                type="button"
                onClick={() => {
                  setDestino(subDireccionUnidad.id);
                  if (!proveido.trim()) {
                    setProveido(
                      "Pase a Sub Dirección para evaluación pedagógica y derivación a la coordinación correspondiente."
                    );
                  }
                }}
                className="mt-2 inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-800 transition"
              >
                ➜ Seleccionar Sub Dirección
              </button>
            )}
          </div>
        )}

        {/* Orientación para Sub Dirección: Sub Dirección -> Coordinaciones */}
        {esOrigenSubDireccion && (
          <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50/80 p-3 text-xs text-purple-900">
            <p className="font-bold flex items-center gap-1.5">
              <span>🎯 Despacho desde Sub Dirección:</span>
            </p>
            <p className="mt-1 text-slate-700">
              Seleccione la <strong>Coordinación de Programa de Estudios (carrera)</strong> o área pedagógica encargada de resolver o dictaminar el expediente.
            </p>
          </div>
        )}

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
            {opcionesAgrupadas.map((grupo) =>
              grupo.label ? (
                <optgroup key={grupo.label} label={grupo.label}>
                  {grupo.items.map((unidad) => (
                    <option
                      key={unidad.id}
                      value={unidad.id}
                      disabled={!unidad.habilitada || unidad.id === expediente.unidadOrigenId}
                    >
                      {unidad.nombre}
                      {unidad.id === expediente.unidadOrigenId ? " (unidad de origen)" : ""}
                    </option>
                  ))}
                </optgroup>
              ) : (
                grupo.items.map((unidad) => (
                  <option
                    key={unidad.id}
                    value={unidad.id}
                    disabled={!unidad.habilitada || unidad.id === expediente.unidadOrigenId}
                  >
                    {unidad.nombre}
                    {unidad.id === expediente.unidadOrigenId ? " (unidad de origen)" : ""}
                  </option>
                ))
              )
            )}
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
          <button
            type="button"
            className="btn-secondary"
            disabled={formulario.pending}
            onClick={cerrar}
          >
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
