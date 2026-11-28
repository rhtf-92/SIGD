import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import EditorIntegralTupa from "../components/EditorIntegralTupa";
import TupaVersionComparator from "../components/TupaVersionComparator";
import {
  mensajeError,
  tupaApi,
  type TupaBitacora,
  type TupaRequisito,
  type TupaTramite,
  type TupaVersion,
} from "../services/tupaApi";
import { useAuthStore } from "../stores/authStore";

/* =============================================================================
   MODAL: EDICIÓN INTEGRAL DE METADATOS DE LA VERSIÓN (TÍTULO, CÓDIGO, UIT, NORMA)
============================================================================= */
interface ModalEditarVersionProps {
  version: TupaVersion;
  token: string;
  onCerrar: () => void;
  onGuardado: (versionActualizada: TupaVersion) => void;
  onError: (msg: string) => void;
}

function ModalEditarVersion({
  version,
  token,
  onCerrar,
  onGuardado,
  onError,
}: ModalEditarVersionProps) {
  const [codigo, setCodigo] = useState(version.codigo);
  const [nombre, setNombre] = useState(version.nombre);
  const [uitVigente, setUitVigente] = useState(String(version.uit_vigente ?? "5500.00"));
  const [fechaVigencia, setFechaVigencia] = useState(version.fecha_vigencia ?? "");
  const [resolucionNumero, setResolucionNumero] = useState(version.resolucion_numero ?? "");
  const [resolucionFecha, setResolucionFecha] = useState(version.resolucion_fecha ?? "");
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await tupaApi.actualizarVersion(token, version.version_id, {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        uit_vigente: Number(uitVigente),
        fecha_vigencia: fechaVigencia || null,
        resolucion_numero: resolucionNumero.trim() || null,
        resolucion_fecha: resolucionFecha || null,
      });
      onGuardado(res.version);
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
              Parámetros de Versión TUPA
            </span>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Editar Título y Datos de la Versión
            </h3>
            <p className="text-xs text-slate-500">
              Modifica la denominación institucional, código y normativas asociadas.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-lg font-bold text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <label className="block text-xs font-semibold text-slate-700">
            Título / Denominación Oficial de la Versión del TUPA *
            <input
              type="text"
              required
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej: TUPA Institucional 2027 — Modificado con Nuevos Plazos"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Código de la Versión *
              <input
              type="text"
              required
              maxLength={30}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="ej: TUPA-2027-v1.1"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Valor de la UIT Vigente (S/) *
              <input
                type="number"
                step="0.01"
                min="1"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={uitVigente}
                onChange={(e) => setUitVigente(e.target.value)}
                placeholder="5500.00"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-700">
              Fecha de Vigencia
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                value={fechaVigencia}
                onChange={(e) => setFechaVigencia(e.target.value)}
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Número de Resolución
              <input
                  type="text"
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                  value={resolucionNumero}
                onChange={(e) => setResolucionNumero(e.target.value)}
                placeholder="R.D. N° 001-2027"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Fecha de Resolución
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                value={resolucionFecha}
                onChange={(e) => setResolucionFecha(e.target.value)}
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
            >
              {guardando ? "Guardando cambios…" : "Guardar Parámetros de Versión"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =============================================================================
   MODAL: EDICIÓN COMPLETA DE TODOS LOS PARÁMETROS DEL TRÁMITE Y REQUISITOS
============================================================================= */
interface ModalEditarTramiteProps {
  tramite: TupaTramite;
  versionId: string;
  uitVersion: number;
  token: string;
  esBorrador: boolean;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
  onError: (msg: string) => void;
}

function ModalEditarTramite({
  tramite,
  versionId,
  uitVersion,
  token,
  esBorrador,
  onCerrar,
  onGuardado,
  onError,
}: ModalEditarTramiteProps) {
  const [tabActiva, setTabActiva] = useState<"GENERAL" | "CALIFICACION" | "PAGOS" | "LEGAL" | "REQUISITOS">("GENERAL");

  // Form State
  const [codigo, setCodigo] = useState(tramite.codigo);
  const [denominacion, setDenominacion] = useState(tramite.denominacion);
  const [rubro, setRubro] = useState(tramite.rubro);
  const [descripcion, setDescripcion] = useState(tramite.descripcion ?? "");
  const [calificacion, setCalificacion] = useState<"EVALUACION_PREVIA" | "APROBACION_AUTOMATICA" | "NO_APLICA">(
    (tramite.calificacion as "EVALUACION_PREVIA" | "APROBACION_AUTOMATICA" | "NO_APLICA") || "EVALUACION_PREVIA"
  );
  const [silencioAdministrativo, setSilencioAdministrativo] = useState<"POSITIVO" | "NEGATIVO" | "NO_APLICA">(
    (tramite.silencio_administrativo as "POSITIVO" | "NEGATIVO" | "NO_APLICA") || "NEGATIVO"
  );
  const [plazoDiasHabiles, setPlazoDiasHabiles] = useState(
    tramite.plazo_dias_habiles ? String(tramite.plazo_dias_habiles) : ""
  );
  const [plazoTexto, setPlazoTexto] = useState(tramite.plazo_texto ?? "");
  const [derechoMonto, setDerechoMonto] = useState(
    tramite.derecho_monto === null ? "" : String(tramite.derecho_monto)
  );
  const [derechoPorcentajeUit, setDerechoPorcentajeUit] = useState(
    tramite.derecho_porcentaje_uit === null ? "" : String(tramite.derecho_porcentaje_uit)
  );
  const [derechoTexto, setDerechoTexto] = useState(tramite.derecho_texto ?? "");
  const [cuentaPago, setCuentaPago] = useState(tramite.cuenta_pago ?? "");
  const [unidadRecibe, setUnidadRecibe] = useState(tramite.unidad_recibe ?? "");
  const [autoridadResuelve, setAutoridadResuelve] = useState(tramite.autoridad_resuelve ?? "");
  const [baseLegal, setBaseLegal] = useState(tramite.base_legal ?? "");
  const [recursos, setRecursos] = useState(tramite.recursos ?? "");
  const [observaciones, setObservaciones] = useState(tramite.observaciones ?? "");

  // Requisitos State
  const [requisitosList, setRequisitosList] = useState<TupaRequisito[]>(tramite.requisitos ?? []);
  const [nuevoRequisitoTexto, setNuevoRequisitoTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Auto-cálculo de % UIT cuando cambia el monto
  function manejarCambioMonto(valor: string) {
    setDerechoMonto(valor);
    if (valor === "" || isNaN(Number(valor))) {
      setDerechoPorcentajeUit("");
      return;
    }
    const num = Number(valor);
    if (uitVersion > 0) {
      const pct = (num / uitVersion) * 100;
      setDerechoPorcentajeUit(pct.toFixed(2));
    }
    if (num === 0) {
      setDerechoTexto("Gratuito");
    }
  }

  // Auto-completar plazo texto si se ingresan días
  function manejarCambioDias(dias: string) {
    setPlazoDiasHabiles(dias);
    if (dias && Number(dias) > 0) {
      setPlazoTexto(`${dias} días hábiles`);
    }
  }

  async function handleGuardarParametros(e: FormEvent) {
    e.preventDefault();
    if (!esBorrador) return;
    setGuardando(true);
    try {
      await tupaApi.actualizarTramite(token, versionId, tramite.tramite_version_id, {
        codigo: codigo.trim(),
        denominacion: denominacion.trim(),
        rubro: rubro.trim(),
        descripcion: descripcion.trim() || null,
        calificacion,
        silencio_administrativo: silencioAdministrativo,
        plazo_dias_habiles: plazoDiasHabiles ? Number(plazoDiasHabiles) : null,
        plazo_texto: plazoTexto.trim() || (plazoDiasHabiles ? `${plazoDiasHabiles} días hábiles` : "No especificado"),
        derecho_monto: derechoMonto === "" ? null : Number(derechoMonto),
        derecho_porcentaje_uit: derechoPorcentajeUit === "" ? null : Number(derechoPorcentajeUit),
        derecho_texto: derechoTexto.trim() || (derechoMonto === "0" ? "Gratuito" : null),
        cuenta_pago: cuentaPago.trim() || null,
        unidad_recibe: unidadRecibe.trim() || null,
        autoridad_resuelve: autoridadResuelve.trim() || null,
        base_legal: baseLegal.trim() || null,
        recursos: recursos.trim() || null,
        observaciones: observaciones.trim() || null,
      });

      await onGuardado();
      onCerrar();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function agregarRequisito() {
    const texto = nuevoRequisitoTexto.trim();
    if (!texto || !esBorrador) return;
    setGuardando(true);
    try {
      const nuevoOrden = Math.max(0, ...requisitosList.map((r) => r.orden)) + 1;
      const res = await tupaApi.agregarRequisito(token, versionId, tramite.tramite_version_id, nuevoOrden, texto);
      setRequisitosList((prev) => [...prev, res.requisito]);
      setNuevoRequisitoTexto("");
      await onGuardado();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarRequisito(requisitoId: string) {
    if (!esBorrador) return;
    const confirm = window.confirm("¿Seguro que deseas eliminar este requisito del trámite?");
    if (!confirm) return;
    setGuardando(true);
    try {
      await tupaApi.eliminarRequisito(token, versionId, tramite.tramite_version_id, requisitoId);
      setRequisitosList((prev) => prev.filter((r) => r.requisito_id !== requisitoId));
      await onGuardado();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function actualizarTextoRequisito(req: TupaRequisito, nuevoTexto: string) {
    if (!esBorrador || nuevoTexto.trim() === req.texto) return;
    setGuardando(true);
    try {
      await tupaApi.actualizarRequisito(token, versionId, tramite.tramite_version_id, req.requisito_id, {
        texto: nuevoTexto.trim(),
      });
      setRequisitosList((prev) =>
        prev.map((r) => (r.requisito_id === req.requisito_id ? { ...r, texto: nuevoTexto.trim() } : r))
      );
      await onGuardado();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-full max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Cabecera Modal */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded">
                {tramite.codigo}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {tramite.rubro}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${esBorrador ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                {esBorrador ? "Edición Habilitada (Borrador)" : "Solo Lectura (Oficial)"}
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-bold text-slate-900 line-clamp-1">
              {denominacion}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-xl font-bold text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        {/* Pestañas de Navegación del Trámite */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setTabActiva("GENERAL")}
            className={`border-b-2 py-3 px-3 transition ${tabActiva === "GENERAL" ? "border-blue-600 text-blue-700 font-bold" : "border-transparent hover:text-slate-900"}`}
          >
            1. Datos Generales
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("CALIFICACION")}
            className={`border-b-2 py-3 px-3 transition ${tabActiva === "CALIFICACION" ? "border-blue-600 text-blue-700 font-bold" : "border-transparent hover:text-slate-900"}`}
          >
            2. Calificación y Plazos
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("PAGOS")}
            className={`border-b-2 py-3 px-3 transition ${tabActiva === "PAGOS" ? "border-blue-600 text-blue-700 font-bold" : "border-transparent hover:text-slate-900"}`}
          >
            3. Derechos de Tramitación
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("LEGAL")}
            className={`border-b-2 py-3 px-3 transition ${tabActiva === "LEGAL" ? "border-blue-600 text-blue-700 font-bold" : "border-transparent hover:text-slate-900"}`}
          >
            4. Autoridades y Base Legal
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("REQUISITOS")}
            className={`border-b-2 py-3 px-3 transition ${tabActiva === "REQUISITOS" ? "border-blue-600 text-blue-700 font-bold" : "border-transparent hover:text-slate-900"}`}
          >
            5. Requisitos ({requisitosList.length})
          </button>
        </div>

        {/* Contenido Scrolleable */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="form-editar-tramite" onSubmit={(e) => void handleGuardarParametros(e)}>
            {/* TAB 1: DATOS GENERALES */}
            {tabActiva === "GENERAL" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Código del Trámite *
                    <input
                      type="text"
                      required
                      disabled={!esBorrador}
                      maxLength={30}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="ej: TRA-001 o TUP-01"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Rubro / Área Responsable *
                    <input
                      type="text"
                      required
                      disabled={!esBorrador}
                      maxLength={200}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={rubro}
                      onChange={(e) => setRubro(e.target.value)}
                      placeholder="ej: Secretaría Académica, Tesorería, Dirección"
                    />
                  </label>
                </div>

                <label className="block text-xs font-semibold text-slate-700">
                  Denominación Oficial del Trámite *
                  <textarea
                    rows={2}
                    required
                    disabled={!esBorrador}
                    maxLength={300}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                    value={denominacion}
                    onChange={(e) => setDenominacion(e.target.value)}
                    placeholder="Título completo según normativa..."
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Descripción y Alcance del Procedimiento
                  <textarea
                    rows={3}
                    disabled={!esBorrador}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Describe en qué consiste el procedimiento y a quién está dirigido..."
                  />
                </label>
              </div>
            )}

            {/* TAB 2: CALIFICACIÓN Y PLAZOS */}
            {tabActiva === "CALIFICACION" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Calificación del Procedimiento *
                    <select
                      disabled={!esBorrador}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={calificacion}
                      onChange={(e) =>
                        setCalificacion(
                          e.target.value as "EVALUACION_PREVIA" | "APROBACION_AUTOMATICA" | "NO_APLICA"
                        )
                      }
                    >
                      <option value="EVALUACION_PREVIA">Evaluación Previa</option>
                      <option value="APROBACION_AUTOMATICA">Aprobación Automática</option>
                      <option value="NO_APLICA">No Aplica</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Silencio Administrativo *
                    <select
                      disabled={!esBorrador}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={silencioAdministrativo}
                      onChange={(e) =>
                        setSilencioAdministrativo(
                          e.target.value as "POSITIVO" | "NEGATIVO" | "NO_APLICA"
                        )
                      }
                    >
                      <option value="NEGATIVO">Silencio Negativo (Desestimatorio)</option>
                      <option value="POSITIVO">Silencio Positivo (Aprobatorio)</option>
                      <option value="NO_APLICA">No Aplica</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Plazo en Días Hábiles
                    <input
                      type="number"
                      min="1"
                      max="32767"
                      disabled={!esBorrador}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={plazoDiasHabiles}
                      onChange={(e) => manejarCambioDias(e.target.value)}
                      placeholder="ej: 30"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Plazo Descriptivo (Texto para Ciudadano) *
                    <input
                      type="text"
                      required
                      disabled={!esBorrador}
                      maxLength={300}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={plazoTexto}
                      onChange={(e) => setPlazoTexto(e.target.value)}
                      placeholder="ej: 30 días hábiles o Inmediato"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 3: DERECHOS DE TRAMITACIÓN Y PAGOS */}
            {tabActiva === "PAGOS" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Costo en Soles (S/)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="99999999.99"
                      disabled={!esBorrador}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={derechoMonto}
                      onChange={(e) => manejarCambioMonto(e.target.value)}
                      placeholder="0.00 o vacío si gratuito"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    % de la UIT (Ref: S/ {uitVersion.toFixed(2)})
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="9999.99"
                      disabled={!esBorrador}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={derechoPorcentajeUit}
                      onChange={(e) => setDerechoPorcentajeUit(e.target.value)}
                      placeholder="ej: 1.50"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Texto del Derecho de Pago
                    <input
                      type="text"
                      disabled={!esBorrador}
                      maxLength={2000}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={derechoTexto}
                      onChange={(e) => setDerechoTexto(e.target.value)}
                      placeholder="ej: Gratuito o Según arancel"
                    />
                  </label>
                </div>

                <label className="block text-xs font-semibold text-slate-700">
                  Lugar o Cuenta de Pago
                  <input
                    type="text"
                    disabled={!esBorrador}
                    maxLength={60}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                    value={cuentaPago}
                    onChange={(e) => setCuentaPago(e.target.value)}
                    placeholder="ej: Banco de la Nación Cta. Cte. N° 00-000-000000 o Caja de la Institución"
                  />
                </label>
              </div>
            )}

            {/* TAB 4: AUTORIDADES Y BASE LEGAL */}
            {tabActiva === "LEGAL" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Unidad que Recibe el Trámite
                    <input
                      type="text"
                      disabled={!esBorrador}
                      maxLength={200}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={unidadRecibe}
                      onChange={(e) => setUnidadRecibe(e.target.value)}
                      placeholder="ej: Mesa de Partes / Ventanilla Virtual"
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Autoridad que Resuelve
                    <input
                      type="text"
                      disabled={!esBorrador}
                      maxLength={200}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={autoridadResuelve}
                      onChange={(e) => setAutoridadResuelve(e.target.value)}
                      placeholder="ej: Dirección General / Secretaría Académica"
                    />
                  </label>
                </div>

                <label className="block text-xs font-semibold text-slate-700">
                  Base Legal
                  <textarea
                    rows={2}
                    disabled={!esBorrador}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                    value={baseLegal}
                    onChange={(e) => setBaseLegal(e.target.value)}
                    placeholder="ej: Ley N° 30512, D.S. N° 004-2019-JUS, R.M. N° 001-2023-MINEDU..."
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Recursos Impugnatorios
                    <textarea
                      rows={2}
                      disabled={!esBorrador}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={recursos}
                      onChange={(e) => setRecursos(e.target.value)}
                      placeholder="ej: Reconsideración: 15 días ante la Dirección..."
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-700">
                    Observaciones Adicionales
                    <textarea
                      rows={2}
                      disabled={!esBorrador}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Notas especiales, excepciones o vigencia de requisitos..."
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 5: GESTIÓN DE REQUISITOS */}
            {tabActiva === "REQUISITOS" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Requisitos Obligatorios del Trámite
                  </h4>
                  <span className="text-xs text-slate-500">
                    Total: {requisitosList.length} requisitos
                  </span>
                </div>

                {requisitosList.length === 0 ? (
                  <p className="py-6 text-center text-xs italic text-slate-400">
                    Sin requisitos registrados para este procedimiento.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {requisitosList.map((req, idx) => (
                      <li
                        key={req.requisito_id}
                        className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 font-mono text-[10px] font-bold text-blue-800">
                          {req.orden ?? idx + 1}
                        </span>
                        {esBorrador ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              type="text"
                              className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs focus:border-blue-500 focus:outline-none"
                              defaultValue={req.texto}
                              onBlur={(e) => void actualizarTextoRequisito(req, e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => void eliminarRequisito(req.requisito_id)}
                              className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                              title="Eliminar requisito"
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <span className="flex-1 text-slate-800">{req.texto}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {esBorrador && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                    <label className="block text-xs font-semibold text-blue-900">
                      + Agregar Nuevo Requisito
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                        value={nuevoRequisitoTexto}
                        onChange={(e) => setNuevoRequisitoTexto(e.target.value)}
                        placeholder="Escribe el texto del nuevo requisito..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void agregarRequisito();
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={guardando || !nuevoRequisitoTexto.trim()}
                        onClick={() => void agregarRequisito()}
                        className="rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Footer del Modal */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {esBorrador ? "Cancelar" : "Cerrar Ficha"}
          </button>
          {esBorrador && (
            <button
              type="submit"
              form="form-editar-tramite"
              disabled={guardando}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar Todos los Parámetros del Trámite"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   MODAL: AGREGAR NUEVO TRÁMITE AL TUPA BORRADOR
============================================================================= */
interface ModalNuevoTramiteProps {
  versionId: string;
  uitVersion: number;
  token: string;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
  onError: (msg: string) => void;
}

function ModalNuevoTramite({
  versionId,
  uitVersion,
  token,
  onCerrar,
  onGuardado,
  onError,
}: ModalNuevoTramiteProps) {
  const [codigo, setCodigo] = useState("");
  const [denominacion, setDenominacion] = useState("");
  const [rubro, setRubro] = useState("Secretaría Académica");
  const [descripcion, setDescripcion] = useState("");
  const [calificacion, setCalificacion] = useState<"EVALUACION_PREVIA" | "APROBACION_AUTOMATICA" | "NO_APLICA">(
    "EVALUACION_PREVIA"
  );
  const [silencioAdministrativo, setSilencioAdministrativo] = useState<"POSITIVO" | "NEGATIVO" | "NO_APLICA">(
    "NEGATIVO"
  );
  const [plazoDiasHabiles, setPlazoDiasHabiles] = useState("30");
  const [plazoTexto, setPlazoTexto] = useState("30 días hábiles");
  const [derechoMonto, setDerechoMonto] = useState("");
  const [derechoPorcentajeUit, setDerechoPorcentajeUit] = useState("");
  const [derechoTexto, setDerechoTexto] = useState("Gratuito");
  const [cuentaPago, setCuentaPago] = useState("");
  const [unidadRecibe, setUnidadRecibe] = useState("Mesa de Partes / Ventanilla Presencial");
  const [autoridadResuelve, setAutoridadResuelve] = useState("Dirección General");
  const [baseLegal, setBaseLegal] = useState("");
  const [recursos, setRecursos] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  function manejarCambioMonto(valor: string) {
    setDerechoMonto(valor);
    if (valor === "" || isNaN(Number(valor))) {
      setDerechoPorcentajeUit("");
      setDerechoTexto("Gratuito");
      return;
    }
    const num = Number(valor);
    if (uitVersion > 0) {
      setDerechoPorcentajeUit(((num / uitVersion) * 100).toFixed(2));
    }
    setDerechoTexto(num === 0 ? "Gratuito" : `S/ ${num.toFixed(2)}`);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await tupaApi.crearTramite(token, versionId, {
        codigo: codigo.trim(),
        denominacion: denominacion.trim(),
        rubro: rubro.trim(),
        descripcion: descripcion.trim() || null,
        calificacion,
        silencio_administrativo: silencioAdministrativo,
        plazo_dias_habiles: plazoDiasHabiles ? Number(plazoDiasHabiles) : null,
        plazo_texto: plazoTexto.trim() || "30 días hábiles",
        derecho_monto: derechoMonto === "" ? null : Number(derechoMonto),
        derecho_porcentaje_uit: derechoPorcentajeUit === "" ? null : Number(derechoPorcentajeUit),
        derecho_texto: derechoTexto.trim() || null,
        cuenta_pago: cuentaPago.trim() || null,
        unidad_recibe: unidadRecibe.trim() || null,
        autoridad_resuelve: autoridadResuelve.trim() || null,
        base_legal: baseLegal.trim() || null,
        recursos: recursos.trim() || null,
        observaciones: observaciones.trim() || null,
      });

      await onGuardado();
      onCerrar();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Nuevo Trámite
            </span>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Agregar Trámite a la Versión Borrador
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-lg font-bold text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Código del Trámite *
              <input
                  type="text"
                  required
                  maxLength={30}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="ej: TRA-049"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Rubro / Área *
              <input
                  type="text"
                  required
                  maxLength={200}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={rubro}
                  onChange={(e) => setRubro(e.target.value)}
                placeholder="ej: Secretaría Académica"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            Denominación Oficial del Trámite *
            <input
              type="text"
              required
              maxLength={300}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={denominacion}
              onChange={(e) => setDenominacion(e.target.value)}
              placeholder="ej: Expedición de Constancia de Egresado"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700">
            Descripción
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Finalidad del trámite..."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Calificación
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={calificacion}
                onChange={(e) =>
                  setCalificacion(
                    e.target.value as "EVALUACION_PREVIA" | "APROBACION_AUTOMATICA" | "NO_APLICA"
                  )
                }
              >
                <option value="EVALUACION_PREVIA">Evaluación Previa</option>
                <option value="APROBACION_AUTOMATICA">Aprobación Automática</option>
                <option value="NO_APLICA">No Aplica</option>
              </select>
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Silencio Administrativo
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={silencioAdministrativo}
                onChange={(e) =>
                  setSilencioAdministrativo(
                    e.target.value as "POSITIVO" | "NEGATIVO" | "NO_APLICA"
                  )
                }
              >
                <option value="NEGATIVO">Silencio Negativo</option>
                <option value="POSITIVO">Silencio Positivo</option>
                <option value="NO_APLICA">No Aplica</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-700">
              Plazo Días Hábiles
              <input
                type="number"
                min="1"
                max={32767}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={plazoDiasHabiles}
                onChange={(e) => {
                  setPlazoDiasHabiles(e.target.value);
                  if (e.target.value) setPlazoTexto(`${e.target.value} días hábiles`);
                }}
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Costo (S/)
              <input
                type="number"
                step="0.01"
                min="0"
                max={99999999.99}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={derechoMonto}
                onChange={(e) => manejarCambioMonto(e.target.value)}
                placeholder="0.00"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              % UIT
              <input
                type="number"
                step="0.01"
                min="0"
                max={9999.99}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={derechoPorcentajeUit}
                onChange={(e) => setDerechoPorcentajeUit(e.target.value)}
                placeholder="0.00"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            Texto del Plazo para el Ciudadano
            <input
              type="text"
              maxLength={300}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={plazoTexto}
              onChange={(e) => setPlazoTexto(e.target.value)}
              placeholder="ej: 30 días hábiles o Inmediato"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700">
            Texto del Derecho de Pago
            <input
              type="text"
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={derechoTexto}
              onChange={(e) => setDerechoTexto(e.target.value)}
              placeholder="ej: Gratuito o Según arancel"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Unidad de Recepción
              <input
                type="text"
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={unidadRecibe}
                onChange={(e) => setUnidadRecibe(e.target.value)}
                placeholder="ej: Mesa de Partes"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Autoridad que Resuelve
              <input
                  type="text"
                  maxLength={200}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={autoridadResuelve}
                onChange={(e) => setAutoridadResuelve(e.target.value)}
                placeholder="ej: Dirección General"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Cuenta o Lugar de Pago
              <input
                type="text"
                maxLength={60}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={cuentaPago}
                onChange={(e) => setCuentaPago(e.target.value)}
                placeholder="ej: Banco de la Nación / Caja"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Base Legal
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={baseLegal}
                onChange={(e) => setBaseLegal(e.target.value)}
                placeholder="ej: Ley N° 30512..."
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Recursos Impugnatorios
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={recursos}
                onChange={(e) => setRecursos(e.target.value)}
                placeholder="ej: Reconsideración: 15 días ante la Dirección..."
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Observaciones
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas especiales o excepciones..."
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
            >
              {guardando ? "Creando…" : "Crear Trámite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =============================================================================
   COMPONENTE PRINCIPAL DE LA PÁGINA: TupaGestionPage
============================================================================= */
export default function TupaGestionPage() {
  const auth = useAuthStore();
  const [tokenDirecto, setTokenDirecto] = useState<string | null>(null);
  const [identificadorLogin, setIdentificadorLogin] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");

  const tokenActivo = auth.accessToken ?? tokenDirecto;
  const nombreUsuario =
    auth.usuario?.nombreCompleto ?? (tokenDirecto ? "Sesión Administrativa" : null);

  const [versiones, setVersiones] = useState<TupaVersion[]>([]);
  const [versionId, setVersionId] = useState("");
  const [tramites, setTramites] = useState<TupaTramite[]>([]);
  const [bitacora, setBitacora] = useState<TupaBitacora[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // Modales
  const [mostrarModalNueva, setMostrarModalNueva] = useState(false);
  const [modoCreacion, setModoCreacion] = useState<"BORRADOR_EDITABLE" | "REEMPLAZO_INMEDIATO">("BORRADOR_EDITABLE");
  const [mostrarModalEditarVersion, setMostrarModalEditarVersion] = useState(false);
  const [tramiteParaEditar, setTramiteParaEditar] = useState<TupaTramite | null>(null);
  const [mostrarModalNuevoTramite, setMostrarModalNuevoTramite] = useState(false);
  const [mostrarEditorIntegral, setMostrarEditorIntegral] = useState(false);
  const [mostrarComparador, setMostrarComparador] = useState(false);

  // Parámetros del Formulario Nueva Versión
  const [nuevoCodigo, setNuevoCodigo] = useState("TUPA-2027-v2.0");
  const [nuevoNombre, setNuevoNombre] = useState("TUPA Institucional 2027 — Modificado con Nuevos Plazos");
  const [nuevaUit, setNuevaUit] = useState("5500.00");
  const [nuevaFechaVigencia, setNuevaFechaVigencia] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [nuevoNumeroResolucion, setNuevoNumeroResolucion] = useState(
    `R.D. N° 002-${new Date().getFullYear()}-DG/IESTP-SUIZA`
  );
  const [nuevaFechaResolucion, setNuevaFechaResolucion] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [copiarDesdeId, setCopiarDesdeId] = useState("");

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("TODOS");
  const [pestañaEstado, setPestañaEstado] = useState<"TODAS" | "VIGENTE" | "BORRADOR" | "SUPERSEDIDA">("TODAS");

  // Subida de PDF
  const [archivoPdf, setArchivoPdf] = useState<File | null>(null);

  const versionVigente = useMemo(
    () => versiones.find((v) => v.estado === "VIGENTE") ?? null,
    [versiones]
  );

  const versionSeleccionada = useMemo(
    () => versiones.find((v) => v.version_id === versionId) ?? null,
    [versiones, versionId]
  );

  const versionesFiltradas = useMemo(() => {
    if (pestañaEstado === "TODAS") return versiones;
    return versiones.filter((v) => v.estado === pestañaEstado);
  }, [versiones, pestañaEstado]);

  const rubrosDisponibles = useMemo(() => {
    const set = new Set<string>();
    tramites.forEach((t) => {
      if (t.rubro) set.add(t.rubro);
    });
    return Array.from(set).sort();
  }, [tramites]);

  const tramitesFiltrados = useMemo(() => {
    return tramites.filter((t) => {
      const matchRubro = filtroRubro === "TODOS" || t.rubro === filtroRubro;
      if (!matchRubro) return false;
      if (!filtroTexto.trim()) return true;
      const q = filtroTexto.toLowerCase();
      return (
        t.codigo.toLowerCase().includes(q) ||
        t.denominacion.toLowerCase().includes(q) ||
        (t.descripcion ?? "").toLowerCase().includes(q)
      );
    });
  }, [tramites, filtroTexto, filtroRubro]);

  async function cargarVersiones(token: string, seleccionarId?: string) {
    setCargando(true);
    try {
      const lista = await tupaApi.versiones(token);
      setVersiones(lista);
      const idParaSeleccionar =
        seleccionarId ??
        versionId ??
        lista.find((v) => v.estado === "VIGENTE")?.version_id ??
        lista[0]?.version_id;

      if (idParaSeleccionar) {
        await seleccionarVersion(token, idParaSeleccionar);
      }
      const vigente = lista.find((v) => v.estado === "VIGENTE");
      if (vigente && !copiarDesdeId) {
        setCopiarDesdeId(vigente.version_id);
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function seleccionarVersion(token: string, id: string) {
    setVersionId(id);
    setCargando(true);
    try {
      const [fichas, eventos] = await Promise.all([
        tupaApi.tramitesVersion(token, id),
        tupaApi.bitacora(token, id),
      ]);
      setTramites(fichas);
      setBitacora(eventos);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (tokenActivo) {
      void cargarVersiones(tokenActivo);
    }
  }, [tokenActivo]);

  async function manejarLoginManual(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const sesion = await tupaApi.login(identificadorLogin.trim(), passwordLogin);
      setTokenDirecto(sesion.accessToken);
      setPasswordLogin("");
      await cargarVersiones(sesion.accessToken);
      setMensaje("Autenticación administrativa concedida.");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function ejecutarCreacionVersion(e: FormEvent) {
    e.preventDefault();
    if (!tokenActivo) return;
    setCargando(true);
    setError("");
    setMensaje("");

    try {
      if (modoCreacion === "REEMPLAZO_INMEDIATO") {
        const res = await tupaApi.reemplazarVigente(tokenActivo, {
          codigo: nuevoCodigo.trim(),
          nombre: nuevoNombre.trim(),
          uit_vigente: Number(nuevaUit),
          fecha_vigencia: nuevaFechaVigencia,
          resolucion_numero: nuevoNumeroResolucion.trim(),
          resolucion_fecha: nuevaFechaResolucion,
          copiarDesdeVersionId: copiarDesdeId || undefined,
        });
        setMostrarModalNueva(false);
        setMensaje(`¡Conmutación exitosa! ${res.mensaje}`);
        await cargarVersiones(tokenActivo, res.version.version_id);
      } else {
        const nueva = await tupaApi.crearVersion(tokenActivo, {
          codigo: nuevoCodigo.trim(),
          nombre: nuevoNombre.trim(),
          uit_vigente: Number(nuevaUit),
          fecha_vigencia: nuevaFechaVigencia,
          copiarDesdeVersionId: copiarDesdeId || undefined,
        });
        try {
          await tupaApi.actualizarVersion(tokenActivo, nueva.version_id, {
            nombre: nuevoNombre.trim(),
            resolucion_numero: nuevoNumeroResolucion.trim() || null,
            resolucion_fecha: nuevaFechaResolucion || null,
          });
        } catch (err) {
          setError(`El borrador se creó, pero no se pudieron guardar los datos de resolución: ${mensajeError(err)}`);
        }
        setMostrarModalNueva(false);
        setMensaje("Borrador creado. Se abrió el editor integral para ajustar el título, todos los parámetros de cada trámite y sus requisitos.");
        await cargarVersiones(tokenActivo, nueva.version_id);
        setMostrarEditorIntegral(true);
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function activarBorrador(version: TupaVersion) {
    if (!tokenActivo) return;
    const confirm = window.confirm(
      `¿Deseas publicar y activar "${version.codigo}" como versión VIGENTE?\n\nAl confirmar, la versión vigente anterior pasará a SUPERSEDIDA y esta versión con todos sus trámites y parámetros editados entrará en producción institucional.`
    );
    if (!confirm) return;

    setCargando(true);
    setError("");
    try {
      const res = await tupaApi.activarVersion(tokenActivo, version.version_id, {
        resolucion_numero: version.resolucion_numero ?? undefined,
        resolucion_fecha: version.resolucion_fecha ?? undefined,
        fecha_vigencia: version.fecha_vigencia ?? undefined,
      });
      setMensaje(`¡Activación exitosa! ${res.mensaje}`);
      await cargarVersiones(tokenActivo, version.version_id);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function eliminarTramite(tramiteId: string, denominacion: string) {
    if (!tokenActivo || !versionId) return;
    const confirm = window.confirm(
      `¿Deseas eliminar el trámite "${denominacion}" de esta versión borrador?\n\nEsta acción quitará el procedimiento de este borrador del TUPA.`
    );
    if (!confirm) return;

    setCargando(true);
    setError("");
    try {
      await tupaApi.eliminarTramite(tokenActivo, versionId, tramiteId);
      setMensaje("Trámite eliminado correctamente del borrador.");
      const fichas = await tupaApi.tramitesVersion(tokenActivo, versionId);
      setTramites(fichas);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function subirPdfResolucion() {
    if (!tokenActivo || !versionId || !archivoPdf) return;
    setCargando(true);
    setError("");
    try {
      await tupaApi.subirResolucion(tokenActivo, versionId, archivoPdf);
      setArchivoPdf(null);
      setMensaje("Resolución PDF cargada y huella SHA-256 registrada.");
      await cargarVersiones(tokenActivo, versionId);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function descargarPdf(id: string, cod: string) {
    if (!tokenActivo) return;
    try {
      const blob = await tupaApi.descargarResolucion(tokenActivo, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resolucion-${cod}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <main className="sigd-tupa-management mx-auto min-h-screen max-w-7xl px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <Link to="/" className="hover:text-blue-700">Inicio</Link>
        <span>/</span>
        <Link to="/administracion" className="hover:text-blue-700">Administración</Link>
        <span>/</span>
        <span className="font-semibold text-slate-700">Gestión de Versiones TUPA</span>
      </nav>

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Gestión Integral de Versiones del TUPA
            </h1>
            <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-800">
              Control Paramétrico Completo
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            Crea nuevas versiones, edita el título institucional, personaliza todos los parámetros de cada trámite y conmuta la versión vigente atómicamente.
          </p>
        </div>

        {tokenActivo && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              Operador: <strong>{nombreUsuario}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                const numSig = versiones.length + 1;
                setNuevoCodigo(`TUPA-${new Date().getFullYear() + 1}-v1.0`);
                setNuevoNombre(`TUPA Institucional ${new Date().getFullYear() + 1} — Versión ${numSig}.0`);
                setModoCreacion("BORRADOR_EDITABLE");
                setMostrarModalNueva(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <span>+ Nueva Versión TUPA</span>
            </button>
            <Link
              to="/tupa"
              target="_blank"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ver Catálogo Ciudadano ↗
            </Link>
          </div>
        )}
      </header>

      {/* Alertas */}
      {mensaje && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{mensaje}</span>
          </div>
          <button type="button" onClick={() => setMensaje("")} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")} className="text-red-600 hover:text-red-900 font-bold">×</button>
        </div>
      )}

      {/* Autenticación si no hay sesión */}
      {!tokenActivo ? (
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <span className="text-3xl">🔐</span>
            <h2 className="mt-2 text-lg font-bold text-slate-900">Acceso a Gestión del TUPA</h2>
            <p className="mt-1 text-xs text-slate-500">
              Se requiere rol <strong>ADMINISTRADOR</strong> o credenciales autorizadas.
            </p>
          </div>
          <form onSubmit={(e) => void manejarLoginManual(e)} className="mt-5 space-y-4">
            <label className="block text-xs font-semibold text-slate-700">
              Usuario o Correo Institucional
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={identificadorLogin}
                onChange={(e) => setIdentificadorLogin(e.target.value)}
                placeholder="ej: rtarazona.flores@gmail.com"
                required
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Contraseña
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {cargando ? "Autenticando…" : "Iniciar Sesión Administrativa"}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card Hero: Versión Vigente en Producción */}
          {versionVigente && (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 min-w-[280px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                      Versión Vigente en Producción
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                      {versionVigente.codigo}
                    </span>
                  </div>
                  <h2 className="mt-2 text-xl font-extrabold text-slate-900">
                    {versionVigente.nombre}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span>
                      📅 <strong>Vigencia:</strong> {versionVigente.fecha_vigencia ?? "Inmediata"}
                    </span>
                    <span>
                      💵 <strong>UIT Oficial:</strong> S/ {Number(versionVigente.uit_vigente ?? 0).toFixed(2)}
                    </span>
                    <span>
                      📋 <strong>Catálogo activo:</strong> {versionVigente.total_tramites ?? 0} procedimientos
                    </span>
                    {versionVigente.resolucion_numero && (
                      <span>
                        📜 <strong>Resolución:</strong> {versionVigente.resolucion_numero}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoCodigo(`TUPA-${new Date().getFullYear() + 1}-v2.0`);
                      setNuevoNombre(`${versionVigente.nombre} (Nueva Revisión)`);
                      setCopiarDesdeId(versionVigente.version_id);
                      setModoCreacion("BORRADOR_EDITABLE");
                      setMostrarModalNueva(true);
                    }}
                    className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800"
                  >
                    ✨ Crear Nueva Versión Editable (Clonar esta Vigente)
                  </button>
                  <button
                    type="button"
                    onClick={() => void seleccionarVersion(tokenActivo, versionVigente.version_id)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Examinar Fichas
                  </button>
                  {versionVigente.tiene_resolucion && (
                    <button
                      type="button"
                      onClick={() => void descargarPdf(versionVigente.version_id, versionVigente.codigo)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Descargar PDF
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMostrarComparador(!mostrarComparador)}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    {mostrarComparador ? "Cerrar Comparador" : "Comparar Versiones"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Comparador de versiones desplegable */}
          {mostrarComparador && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Comparador de Diferencias Entre Versiones</h3>
                <button
                  type="button"
                  onClick={() => setMostrarComparador(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cerrar
                </button>
              </div>
              <TupaVersionComparator token={tokenActivo} versiones={versiones} />
            </div>
          )}

          {/* Layout de 2 Columnas */}
          <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
            {/* Columna Lateral: Historial de Versiones */}
            <aside className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900">Versiones del TUPA</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {versiones.length} {versiones.length === 1 ? "versión" : "versiones"}
                  </span>
                </div>

                {/* Filtro por estado */}
                <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 text-[11px] font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setPestañaEstado("TODAS")}
                    className={`rounded py-1 text-center ${pestañaEstado === "TODAS" ? "bg-white text-blue-700 shadow-xs" : "hover:text-slate-900"}`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setPestañaEstado("VIGENTE")}
                    className={`rounded py-1 text-center ${pestañaEstado === "VIGENTE" ? "bg-white text-emerald-700 shadow-xs" : "hover:text-slate-900"}`}
                  >
                    Vigente
                  </button>
                  <button
                    type="button"
                    onClick={() => setPestañaEstado("BORRADOR")}
                    className={`rounded py-1 text-center ${pestañaEstado === "BORRADOR" ? "bg-white text-amber-700 shadow-xs" : "hover:text-slate-900"}`}
                  >
                    Borrador
                  </button>
                  <button
                    type="button"
                    onClick={() => setPestañaEstado("SUPERSEDIDA")}
                    className={`rounded py-1 text-center ${pestañaEstado === "SUPERSEDIDA" ? "bg-white text-slate-700 shadow-xs" : "hover:text-slate-900"}`}
                  >
                    Histórico
                  </button>
                </div>

                {/* Listado de versiones */}
                <div className="mt-3 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {versionesFiltradas.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">No hay versiones en este estado.</p>
                  ) : (
                    versionesFiltradas.map((v) => {
                      const esSeleccionada = v.version_id === versionId;
                      return (
                        <div
                          key={v.version_id}
                          className={`rounded-xl border p-3 transition ${
                            esSeleccionada
                              ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-100"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => void seleccionarVersion(tokenActivo, v.version_id)}
                              className="text-left flex-1"
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    v.estado === "VIGENTE"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : v.estado === "BORRADOR"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {v.estado}
                                </span>
                                <span className="font-mono text-xs font-semibold text-slate-800">
                                  {v.codigo}
                                </span>
                              </div>
                              <p className="mt-1 text-xs font-medium text-slate-900 line-clamp-2">
                                {v.nombre}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {v.total_tramites ?? 0} trámites · UIT S/ {Number(v.uit_vigente ?? 0).toFixed(2)}
                              </p>
                            </button>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                            {v.estado === "BORRADOR" && (
                              <button
                                type="button"
                                onClick={() => void activarBorrador(v)}
                                className="font-semibold text-emerald-700 hover:text-emerald-900"
                              >
                                ⚡ Publicar y Activar Vigente
                              </button>
                            )}
                            {v.estado === "VIGENTE" && (
                              <span className="font-medium text-emerald-600">● En Producción</span>
                            )}
                            {v.estado === "SUPERSEDIDA" && (
                              <span className="text-slate-400">Reemplazada</span>
                            )}
                            <button
                              type="button"
                              onClick={() => void seleccionarVersion(tokenActivo, v.version_id)}
                              className="text-blue-700 hover:underline"
                            >
                              Explorar Fichas →
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Bitácora inmutable de la versión seleccionada */}
              {versionSeleccionada && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                    Bitácora de Trazabilidad ({versionSeleccionada.codigo})
                  </h4>
                  {bitacora.length === 0 ? (
                    <p className="mt-2 text-xs italic text-slate-400">Sin eventos registrados.</p>
                  ) : (
                    <ol className="mt-3 space-y-2.5 border-l-2 border-blue-200 pl-3">
                      {bitacora.map((ev) => (
                        <li key={ev.bitacora_id} className="text-xs">
                          <p className="font-semibold text-slate-800">
                            {ev.accion} · {ev.estado_anterior ?? "—"} → <span className="text-blue-700">{ev.estado_nuevo}</span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(ev.fecha_hora).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </aside>

            {/* Columna Principal: Versión Seleccionada y Editor Paramétrico de Trámites */}
            <section className="space-y-5">
              {versionSeleccionada ? (
                <>
                  {/* Cabecera de la Versión Seleccionada */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-[280px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {versionSeleccionada.codigo}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              versionSeleccionada.estado === "VIGENTE"
                                ? "bg-emerald-100 text-emerald-800"
                                : versionSeleccionada.estado === "BORRADOR"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {versionSeleccionada.estado}
                          </span>
                          {versionSeleccionada.estado === "BORRADOR" && (
                            <button
                              type="button"
                              onClick={() => setMostrarModalEditarVersion(true)}
                              className="rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              ✏️ Editar Título y Datos de Versión
                            </button>
                          )}
                        </div>

                        <h3 className="mt-1.5 text-xl font-bold text-slate-900">
                          {versionSeleccionada.nombre}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          UIT Vigente: S/ {Number(versionSeleccionada.uit_vigente ?? 0).toFixed(2)} · Vigencia: {versionSeleccionada.fecha_vigencia ?? "No fijada"} · Creado el {new Date(versionSeleccionada.creado_en).toLocaleDateString()}
                        </p>
                      </div>

                      {versionSeleccionada.estado === "BORRADOR" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMostrarEditorIntegral(true)}
                            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-xs hover:bg-indigo-100"
                          >
                            Editor Integral de Parámetros
                          </button>
                          <button
                            type="button"
                            onClick={() => setMostrarModalNuevoTramite(true)}
                            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
                          >
                            + Agregar Trámite
                          </button>
                          <button
                            type="button"
                            onClick={() => void activarBorrador(versionSeleccionada)}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                          >
                            ⚡ Publicar y Reemplazar como Vigente
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Mensaje de modo */}
                    {versionSeleccionada.estado === "BORRADOR" ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <strong>Modo Borrador Habilitado:</strong> Puedes modificar el título de la versión, editar todos los parámetros de cada trámite (denominación, calificación, plazos, derechos, requisitos), o añadir nuevos. Al terminar, haz clic en <strong>"Publicar y Reemplazar como Vigente"</strong> para conmutar la versión en producción.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 flex items-center gap-2">
                        <span>🔒</span>
                        <span>
                          <strong>Versión Oficial Inmutable:</strong> Esta versión está en estado <strong>{versionSeleccionada.estado}</strong> y sus parámetros quedan sellados como garantía de seguridad jurídica. Si deseas actualizar los trámites, haz clic en <em>"Crear Nueva Versión Editable"</em>.
                        </span>
                      </div>
                    )}

                    {/* Subida de resolución si es borrador */}
                    {versionSeleccionada.estado === "BORRADOR" && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          Resolución Aprobatoria (PDF)
                        </h4>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="text-xs text-slate-600"
                            onChange={(e) => setArchivoPdf(e.target.files?.[0] ?? null)}
                          />
                          <button
                            type="button"
                            disabled={!archivoPdf || cargando}
                            onClick={() => void subirPdfResolucion()}
                            className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                          >
                            Subir PDF de Resolución
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Barra de Filtros y Búsqueda */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                        <span className="text-slate-400">🔍</span>
                        <input
                          type="text"
                          className="w-full text-sm outline-none placeholder:text-slate-400"
                          placeholder="Buscar por código, denominación, rubro o palabras clave..."
                          value={filtroTexto}
                          onChange={(e) => setFiltroTexto(e.target.value)}
                        />
                        {filtroTexto && (
                          <button
                            type="button"
                            onClick={() => setFiltroTexto("")}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {rubrosDisponibles.length > 0 && (
                          <select
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700"
                            value={filtroRubro}
                            onChange={(e) => setFiltroRubro(e.target.value)}
                          >
                            <option value="TODOS">Todos los rubros ({tramites.length})</option>
                            {rubrosDisponibles.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        )}
                        <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                          {tramitesFiltrados.length} de {tramites.length} trámites
                        </span>
                      </div>
                    </div>

                    {/* Lista de Fichas de Trámites */}
                    {tramitesFiltrados.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                        No se encontraron trámites con los criterios de búsqueda seleccionados.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tramitesFiltrados.map((t) => {
                          const esEditable = versionSeleccionada.estado === "BORRADOR";
                          return (
                            <article
                              key={t.tramite_version_id}
                              className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:shadow-md"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-800">
                                      {t.codigo}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                      {t.rubro}
                                    </span>
                                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 border border-amber-200/50">
                                      {t.calificacion}
                                    </span>
                                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500 border border-slate-200">
                                      Silencio: {t.silencio_administrativo}
                                    </span>
                                  </div>

                                  <h4 className="mt-2 text-base font-bold text-slate-900">
                                    {t.denominacion}
                                  </h4>

                                  {t.descripcion && (
                                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                                      {t.descripcion}
                                    </p>
                                  )}

                                  <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                                    <span>
                                      💰 <strong>Derecho:</strong> {t.derecho_monto ? `S/ ${Number(t.derecho_monto).toFixed(2)}` : t.derecho_texto || "Gratuito"}
                                      {t.derecho_porcentaje_uit ? ` (${t.derecho_porcentaje_uit}% UIT)` : ""}
                                    </span>
                                    <span>
                                      ⏱️ <strong>Plazo:</strong> {t.plazo_texto || (t.plazo_dias_habiles ? `${t.plazo_dias_habiles} días hábiles` : "No especificado")}
                                    </span>
                                    <span>
                                      📑 <strong>Requisitos:</strong> {t.requisitos?.length ?? 0}
                                    </span>
                                    {t.unidad_recibe && (
                                      <span>
                                        📍 <strong>Recepción:</strong> {t.unidad_recibe}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setTramiteParaEditar(t)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                      esEditable
                                        ? "bg-blue-700 text-white hover:bg-blue-800 shadow-xs"
                                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                  >
                                    {esEditable ? "✏️ Editar Parámetros Completos" : "Ver Ficha Completa"}
                                  </button>

                                  {esEditable && (
                                    <button
                                      type="button"
                                      onClick={() => void eliminarTramite(t.tramite_version_id, t.denominacion)}
                                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                      title="Eliminar este trámite de la versión borrador"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
                  Selecciona una versión del menú lateral para explorar y gestionar sus trámites.
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA VERSIÓN TUPA */}
      {mostrarModalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  Versionamiento Oficial
                </span>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Implementar Nueva Versión del TUPA
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Elige crear un borrador editable para personalizar todos los trámites, o conmutar de inmediato.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalNueva(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => void ejecutarCreacionVersion(e)} className="mt-5 space-y-4">
              {/* Selector de Modo */}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setModoCreacion("BORRADOR_EDITABLE")}
                  className={`rounded-xl border p-4 text-left transition ${
                    modoCreacion === "BORRADOR_EDITABLE"
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-blue-900">Modo Borrador Editable</span>
                    <span className="text-xs bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded">Recomendado</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Clona los trámites y te permite editar el título, todos los parámetros de cada trámite y requisitos antes de activar.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setModoCreacion("REEMPLAZO_INMEDIATO")}
                  className={`rounded-xl border p-4 text-left transition ${
                    modoCreacion === "REEMPLAZO_INMEDIATO"
                      ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-emerald-900">Reemplazo Inmediato</span>
                    <span className="text-xs bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded">1 Clic</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Conmuta la versión vigente actual a superseded y publica esta nueva versión en producción de forma directa.
                  </p>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Código de Versión *
                  <input
                    type="text"
                    required
                    maxLength={30}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    placeholder="ej: TUPA-2027-v2.0"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  UIT Vigente (S/) *
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={nuevaUit}
                    onChange={(e) => setNuevaUit(e.target.value)}
                    placeholder="5500.00"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-slate-700">
                Título / Denominación de la Versión del TUPA *
                <input
                  type="text"
                  required
                  maxLength={200}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="ej: TUPA Institucional 2027 — Modificado con Nuevos Plazos"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Fecha de Vigencia
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={nuevaFechaVigencia}
                    onChange={(e) => setNuevaFechaVigencia(e.target.value)}
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Clonar Trámites y Requisitos Desde
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={copiarDesdeId}
                    onChange={(e) => setCopiarDesdeId(e.target.value)}
                  >
                    <option value="">Sin clonar trámites (Catálogo vacío)</option>
                    {versiones.map((v) => (
                      <option key={v.version_id} value={v.version_id}>
                        {v.codigo} · {v.estado} ({v.total_tramites ?? 0} trámites)
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Resolución Aprobatoria
                </h5>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-slate-600 font-medium">
                    Número de Resolución
                    <input
                      type="text"
                      maxLength={100}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                      value={nuevoNumeroResolucion}
                      onChange={(e) => setNuevoNumeroResolucion(e.target.value)}
                      placeholder="R.D. N° 001-2027-DG/IESTP-SUIZA"
                    />
                  </label>
                  <label className="block text-xs text-slate-600 font-medium">
                    Fecha de Resolución
                    <input
                      type="date"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                      value={nuevaFechaResolucion}
                      onChange={(e) => setNuevaFechaResolucion(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMostrarModalNueva(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className={`rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                    modoCreacion === "REEMPLAZO_INMEDIATO"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-blue-700 hover:bg-blue-800"
                  }`}
                >
                  {cargando
                    ? "Procesando…"
                    : modoCreacion === "REEMPLAZO_INMEDIATO"
                    ? "🚀 Crear y Activar Automáticamente"
                    : "Crear Borrador y Abrir Editor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mostrarEditorIntegral && versionSeleccionada && versionSeleccionada.estado === "BORRADOR" && tokenActivo && (
        <EditorIntegralTupa
          version={versionSeleccionada}
          tramites={tramites}
          uitVersion={Number(versionSeleccionada.uit_vigente ?? 5500)}
          token={tokenActivo}
          onCerrar={() => setMostrarEditorIntegral(false)}
          onGuardado={async () => {
            await cargarVersiones(tokenActivo, versionSeleccionada.version_id);
          }}
          onActivarVersion={async (v) => {
            await activarBorrador(v);
            setMostrarEditorIntegral(false);
          }}
          onError={setError}
        />
      )}

      {/* MODAL: EDITAR VERSIÓN SELECCIONADA */}
      {mostrarModalEditarVersion && versionSeleccionada && (
        <ModalEditarVersion
          version={versionSeleccionada}
          token={tokenActivo!}
          onCerrar={() => setMostrarModalEditarVersion(false)}
          onGuardado={async (act) => {
            setMostrarModalEditarVersion(false);
            setMensaje("Parámetros y título de la versión actualizados exitosamente.");
            await cargarVersiones(tokenActivo!, act.version_id);
          }}
          onError={setError}
        />
      )}

      {/* MODAL: EDITAR PARÁMETROS COMPLETOS DEL TRÁMITE */}
      {tramiteParaEditar && versionSeleccionada && (
        <ModalEditarTramite
          tramite={tramiteParaEditar}
          versionId={versionSeleccionada.version_id}
          uitVersion={Number(versionSeleccionada.uit_vigente ?? 5500)}
          token={tokenActivo!}
          esBorrador={versionSeleccionada.estado === "BORRADOR"}
          onCerrar={() => setTramiteParaEditar(null)}
          onGuardado={async () => {
            const fichas = await tupaApi.tramitesVersion(tokenActivo!, versionSeleccionada.version_id);
            setTramites(fichas);
            setMensaje("Trámite actualizado correctamente con todos sus parámetros.");
          }}
          onError={setError}
        />
      )}

      {/* MODAL: CREAR NUEVO TRÁMITE */}
      {mostrarModalNuevoTramite && versionSeleccionada && (
        <ModalNuevoTramite
          versionId={versionSeleccionada.version_id}
          uitVersion={Number(versionSeleccionada.uit_vigente ?? 5500)}
          token={tokenActivo!}
          onCerrar={() => setMostrarModalNuevoTramite(false)}
          onGuardado={async () => {
            const fichas = await tupaApi.tramitesVersion(tokenActivo!, versionSeleccionada.version_id);
            setTramites(fichas);
            setMensaje("Nuevo trámite creado exitosamente en la versión borrador.");
          }}
          onError={setError}
        />
      )}
    </main>
  );
}
