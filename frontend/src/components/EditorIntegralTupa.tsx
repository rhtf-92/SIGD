import { useEffect, useState } from "react";
import {
  mensajeError,
  tupaApi,
  type TupaRequisito,
  type TupaTramite,
  type TupaVersion,
} from "../services/tupaApi";

type Calificacion = "EVALUACION_PREVIA" | "APROBACION_AUTOMATICA" | "NO_APLICA";
type Silencio = "POSITIVO" | "NEGATIVO" | "NO_APLICA";

interface RequisitoDraft extends TupaRequisito {
  textoEditado: string;
}

interface TramiteDraft {
  codigo: string;
  denominacion: string;
  rubro: string;
  descripcion: string;
  calificacion: Calificacion;
  silencioAdministrativo: Silencio;
  plazoDiasHabiles: string;
  plazoTexto: string;
  derechoMonto: string;
  derechoPorcentajeUit: string;
  derechoTexto: string;
  cuentaPago: string;
  unidadRecibe: string;
  autoridadResuelve: string;
  baseLegal: string;
  recursos: string;
  observaciones: string;
  requisitos: RequisitoDraft[];
  nuevoRequisito: string;
  modificado: boolean;
}

interface EditorIntegralTupaProps {
  version: TupaVersion;
  tramites: TupaTramite[];
  uitVersion: number;
  token: string;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
  onError: (msg: string) => void;
  onActivarVersion?: (version: TupaVersion) => Promise<void>;
}

const texto = (valor: string | null | undefined) => valor ?? "";
const numero = (valor: number | string | null | undefined) =>
  valor === null || valor === undefined || valor === "" ? "" : String(valor);

function crearDraft(tramite: TupaTramite): TramiteDraft {
  return {
    codigo: tramite.codigo,
    denominacion: tramite.denominacion,
    rubro: tramite.rubro,
    descripcion: texto(tramite.descripcion),
    calificacion: tramite.calificacion as Calificacion,
    silencioAdministrativo: tramite.silencio_administrativo as Silencio,
    plazoDiasHabiles: numero(tramite.plazo_dias_habiles),
    plazoTexto: texto(tramite.plazo_texto),
    derechoMonto: numero(tramite.derecho_monto),
    derechoPorcentajeUit: numero(tramite.derecho_porcentaje_uit),
    derechoTexto: texto(tramite.derecho_texto),
    cuentaPago: texto(tramite.cuenta_pago),
    unidadRecibe: texto(tramite.unidad_recibe),
    autoridadResuelve: texto(tramite.autoridad_resuelve),
    baseLegal: texto(tramite.base_legal),
    recursos: texto(tramite.recursos),
    observaciones: texto(tramite.observaciones),
    requisitos: (tramite.requisitos ?? []).map((requisito) => ({
      ...requisito,
      textoEditado: requisito.texto,
    })),
    nuevoRequisito: "",
    modificado: false,
  };
}

function construirPayload(draft: TramiteDraft) {
  return {
    codigo: draft.codigo.trim(),
    denominacion: draft.denominacion.trim(),
    rubro: draft.rubro.trim(),
    descripcion: draft.descripcion.trim() || null,
    calificacion: draft.calificacion,
    silencio_administrativo: draft.silencioAdministrativo,
    plazo_dias_habiles: draft.plazoDiasHabiles ? Number(draft.plazoDiasHabiles) : null,
    plazo_texto:
      draft.plazoTexto.trim() ||
      (draft.plazoDiasHabiles ? `${draft.plazoDiasHabiles} días hábiles` : "No especificado"),
    derecho_monto: draft.derechoMonto === "" ? null : Number(draft.derechoMonto),
    derecho_porcentaje_uit: draft.derechoPorcentajeUit === "" ? null : Number(draft.derechoPorcentajeUit),
    derecho_texto: draft.derechoTexto.trim() || null,
    cuenta_pago: draft.cuentaPago.trim() || null,
    unidad_recibe: draft.unidadRecibe.trim() || null,
    autoridad_resuelve: draft.autoridadResuelve.trim() || null,
    base_legal: draft.baseLegal.trim() || null,
    recursos: draft.recursos.trim() || null,
    observaciones: draft.observaciones.trim() || null,
  };
}

const estiloCampo =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none";

export default function EditorIntegralTupa({
  version,
  tramites,
  uitVersion,
  token,
  onCerrar,
  onGuardado,
  onError,
  onActivarVersion,
}: EditorIntegralTupaProps) {
  // Parámetros y metadatos de la versión del TUPA
  const [nombreVersion, setNombreVersion] = useState(version.nombre);
  const [codigoVersion, setCodigoVersion] = useState(version.codigo);
  const [uitVersionLocal, setUitVersionLocal] = useState(String(version.uit_vigente ?? uitVersion ?? "5500.00"));
  const [fechaVigenciaVersion, setFechaVigenciaVersion] = useState(version.fecha_vigencia ?? "");
  const [resolucionNumeroVersion, setResolucionNumeroVersion] = useState(version.resolucion_numero ?? "");
  const [resolucionFechaVersion, setResolucionFechaVersion] = useState(version.resolucion_fecha ?? "");
  const [versionModificada, setVersionModificada] = useState(false);
  const [guardandoVersion, setGuardandoVersion] = useState(false);
  const [mostrarParametrosVersion, setMostrarParametrosVersion] = useState(true);
  const [activando, setActivando] = useState(false);

  // Parámetros de cada trámite
  const [borradores, setBorradores] = useState<Record<string, TramiteDraft>>(() =>
    Object.fromEntries(tramites.map((tramite) => [tramite.tramite_version_id, crearDraft(tramite)]))
  );
  const [expandido, setExpandido] = useState<string | null>(tramites[0]?.tramite_version_id ?? null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [guardandoTodos, setGuardandoTodos] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    setNombreVersion(version.nombre);
    setCodigoVersion(version.codigo);
    setUitVersionLocal(String(version.uit_vigente ?? uitVersion ?? "5500.00"));
    setFechaVigenciaVersion(version.fecha_vigencia ?? "");
    setResolucionNumeroVersion(version.resolucion_numero ?? "");
    setResolucionFechaVersion(version.resolucion_fecha ?? "");
    setVersionModificada(false);
  }, [version, uitVersion]);

  useEffect(() => {
    setBorradores((prev) => {
      const siguientes: Record<string, TramiteDraft> = {};
      for (const tramite of tramites) {
        siguientes[tramite.tramite_version_id] = prev[tramite.tramite_version_id] ?? crearDraft(tramite);
      }
      return siguientes;
    });
  }, [tramites]);

  function actualizar(id: string, cambios: Partial<TramiteDraft>) {
    setBorradores((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...cambios, modificado: true },
    }));
  }

  const uitEfectiva =
    Number(uitVersionLocal) > 0 ? Number(uitVersionLocal) : uitVersion > 0 ? uitVersion : 5500;

  function recalcularPorMonto(draft: TramiteDraft, valor: string): Partial<TramiteDraft> {
    if (valor === "" || Number.isNaN(Number(valor))) {
      return { derechoMonto: valor, derechoPorcentajeUit: "" };
    }
    const monto = Number(valor);
    const porcentaje = uitEfectiva > 0 ? ((monto / uitEfectiva) * 100).toFixed(2) : "";
    return {
      derechoMonto: valor,
      derechoPorcentajeUit: porcentaje,
      derechoTexto: monto === 0 ? "Gratuito" : draft.derechoTexto,
    };
  }

  function recalcularTodosPorNuevaUit(nuevaUitNum: number) {
    if (nuevaUitNum <= 0) return;
    setBorradores((prev) => {
      const siguientes: Record<string, TramiteDraft> = {};
      for (const [id, draft] of Object.entries(prev)) {
        if (draft.derechoMonto && !Number.isNaN(Number(draft.derechoMonto))) {
          const monto = Number(draft.derechoMonto);
          const nuevoPct = ((monto / nuevaUitNum) * 100).toFixed(2);
          siguientes[id] = {
            ...draft,
            derechoPorcentajeUit: nuevoPct,
            modificado: true,
          };
        } else {
          siguientes[id] = draft;
        }
      }
      return siguientes;
    });
    setAviso(`Porcentajes de UIT recalculados para todos los trámites según la nueva UIT S/ ${nuevaUitNum.toFixed(2)}.`);
  }

  async function guardarParametrosVersion(): Promise<boolean> {
    setGuardandoVersion(true);
    setAviso("");
    try {
      await tupaApi.actualizarVersion(token, version.version_id, {
        nombre: nombreVersion.trim(),
        codigo: codigoVersion.trim(),
        uit_vigente: Number(uitVersionLocal) || 5500,
        fecha_vigencia: fechaVigenciaVersion || null,
        resolucion_numero: resolucionNumeroVersion.trim() || null,
        resolucion_fecha: resolucionFechaVersion || null,
      });
      setVersionModificada(false);
      setAviso("Parámetros y título de la versión guardados exitosamente.");
      await onGuardado();
      return true;
    } catch (err) {
      onError(mensajeError(err));
      return false;
    } finally {
      setGuardandoVersion(false);
    }
  }

  async function handlePublicarYActivar() {
    if (!onActivarVersion) return;
    const confirm = window.confirm(
      `¿Deseas publicar y activar la versión "${codigoVersion}" como VIGENTE?\n\n` +
      `Al confirmar, esta versión sustituirá a la versión actual en producción institucional. Los cambios pendientes en la versión y en los trámites se guardarán automáticamente antes de la activación.`
    );
    if (!confirm) return;

    setActivando(true);
    setAviso("");
    try {
      if (versionModificada) {
        const okVersion = await guardarParametrosVersion();
        if (!okVersion) return;
      }
      const pendientesIds = Object.keys(borradores).filter((id) => borradores[id].modificado);
      for (const id of pendientesIds) {
        const okTramite = await guardarTramite(id);
        if (!okTramite) {
          onError("No se pudo publicar la versión debido a errores al guardar los trámites modificados.");
          return;
        }
      }
      const versionActualizada: TupaVersion = {
        ...version,
        nombre: nombreVersion.trim(),
        codigo: codigoVersion.trim(),
        uit_vigente: Number(uitVersionLocal) || 5500,
        fecha_vigencia: fechaVigenciaVersion || null,
        resolucion_numero: resolucionNumeroVersion.trim() || null,
        resolucion_fecha: resolucionFechaVersion || null,
      };
      await onActivarVersion(versionActualizada);
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setActivando(false);
    }
  }

  async function guardarTramite(id: string): Promise<boolean> {
    const draft = borradores[id];
    if (!draft) return false;
    setGuardandoId(id);
    setAviso("");
    try {
      await tupaApi.actualizarTramite(token, version.version_id, id, construirPayload(draft));
      setBorradores((prev) => ({ ...prev, [id]: { ...prev[id], modificado: false } }));
      setErrores((prev) => {
        const siguientes = { ...prev };
        delete siguientes[id];
        return siguientes;
      });
      await onGuardado();
      return true;
    } catch (err) {
      setErrores((prev) => ({ ...prev, [id]: mensajeError(err) }));
      return false;
    } finally {
      setGuardandoId(null);
    }
  }

  async function guardarTodos() {
    const pendientes = Object.keys(borradores).filter((id) => borradores[id].modificado);
    if (!pendientes.length) {
      setAviso("No hay cambios pendientes de guardar.");
      return;
    }
    setGuardandoTodos(true);
    setAviso("");
    let guardados = 0;
    try {
      for (const id of pendientes) {
        const ok = await guardarTramite(id);
        if (!ok) {
          setAviso(`Se guardaron ${guardados} trámite(s) y se detuvo por un error. Revisa el trámite marcado.`);
          return;
        }
        guardados += 1;
      }
      setAviso(`Se guardaron ${guardados} trámite(s) correctamente.`);
    } finally {
      setGuardandoTodos(false);
    }
  }

  async function agregarRequisito(id: string) {
    const draft = borradores[id];
    const textoRequisito = draft?.nuevoRequisito.trim();
    if (!textoRequisito) return;
    setGuardandoId(id);
    try {
      const orden = Math.max(0, ...draft.requisitos.map((requisito) => requisito.orden)) + 1;
      const res = await tupaApi.agregarRequisito(token, version.version_id, id, orden, textoRequisito);
      setBorradores((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          requisitos: [...prev[id].requisitos, { ...res.requisito, textoEditado: res.requisito.texto }],
          nuevoRequisito: "",
        },
      }));
      await onGuardado();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardandoId(null);
    }
  }

  async function guardarTextoRequisito(id: string, requisito: RequisitoDraft) {
    const nuevoTexto = requisito.textoEditado.trim();
    if (!nuevoTexto || nuevoTexto === requisito.texto) return;
    setGuardandoId(id);
    try {
      await tupaApi.actualizarRequisito(token, version.version_id, id, requisito.requisito_id, {
        texto: nuevoTexto,
      });
      setBorradores((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          requisitos: prev[id].requisitos.map((item) =>
            item.requisito_id === requisito.requisito_id
              ? { ...item, texto: nuevoTexto, textoEditado: nuevoTexto }
              : item
          ),
        },
      }));
      await onGuardado();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardandoId(null);
    }
  }

  async function eliminarRequisito(id: string, requisito: RequisitoDraft) {
    if (!window.confirm("¿Eliminar este requisito del trámite?")) return;
    setGuardandoId(id);
    try {
      await tupaApi.eliminarRequisito(token, version.version_id, id, requisito.requisito_id);
      setBorradores((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          requisitos: prev[id].requisitos.filter((item) => item.requisito_id !== requisito.requisito_id),
        },
      }));
      await onGuardado();
    } catch (err) {
      onError(mensajeError(err));
    } finally {
      setGuardandoId(null);
    }
  }

  const pendientes = Object.values(borradores).filter((draft) => draft.modificado).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-full max-h-[94vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Cabecera Principal */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                Editor Integral del Borrador
              </span>
              <span className="font-mono text-xs font-bold text-slate-500">
                {codigoVersion}
              </span>
            </div>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              {nombreVersion}
            </h3>
            <p className="text-xs text-slate-500">
              UIT: S/ {uitVersionLocal} · {tramites.length} trámite(s) · {pendientes} trámite(s) modificado(s)
              {versionModificada ? " · Metadatos de versión modificados" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onActivarVersion && (
              <button
                type="button"
                disabled={activando || guardandoTodos || guardandoVersion}
                onClick={() => void handlePublicarYActivar()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
                title="Guarda los cambios y publica esta versión como VIGENTE sustituyendo el TUPA actual"
              >
                {activando ? "Publicando versión…" : "⚡ Publicar y Activar como Vigente"}
              </button>
            )}
            <button
              type="button"
              disabled={guardandoTodos || pendientes === 0}
              onClick={() => void guardarTodos()}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
            >
              {guardandoTodos ? "Guardando cambios…" : `Guardar todos (${pendientes})`}
            </button>
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Sección: Parámetros Generales de la Versión del TUPA (Título, UIT, Normativa) */}
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMostrarParametrosVersion(!mostrarParametrosVersion)}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-blue-700"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">
                {mostrarParametrosVersion ? "▼" : "▶"}
              </span>
              <span>Parámetros Generales de la Versión del TUPA</span>
              {versionModificada && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  Cambios sin guardar
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={guardandoVersion || !versionModificada}
                onClick={() => void guardarParametrosVersion()}
                className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-40"
              >
                {guardandoVersion ? "Guardando parámetros…" : "💾 Guardar Parámetros de Versión"}
              </button>
            </div>
          </div>

          {mostrarParametrosVersion && (
            <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:grid-cols-3">
              <label className="block text-xs font-semibold text-slate-700 sm:col-span-2">
                Título Oficial de la Versión del TUPA *
                <input
                  type="text"
                  required
                  maxLength={200}
                  className={estiloCampo}
                  value={nombreVersion}
                  onChange={(e) => {
                    setNombreVersion(e.target.value);
                    setVersionModificada(true);
                  }}
                  placeholder="ej: TUPA Institucional 2027 — Modificado con Nuevos Plazos"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Código de Versión *
                <input
                  type="text"
                  required
                  maxLength={30}
                  className={estiloCampo}
                  value={codigoVersion}
                  onChange={(e) => {
                    setCodigoVersion(e.target.value);
                    setVersionModificada(true);
                  }}
                  placeholder="ej: TUPA-2027-v1.0"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                UIT Vigente (S/) *
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className={estiloCampo}
                    value={uitVersionLocal}
                    onChange={(e) => {
                      setUitVersionLocal(e.target.value);
                      setVersionModificada(true);
                    }}
                    placeholder="5500.00"
                  />
                  <button
                    type="button"
                    title="Recalcular el porcentaje de UIT de todos los trámites basándose en este valor"
                    onClick={() => {
                      const num = Number(uitVersionLocal);
                      if (num > 0) recalcularTodosPorNuevaUit(num);
                    }}
                    className="mt-1 whitespace-nowrap rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Recalc. % UIT
                  </button>
                </div>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Fecha de Vigencia
                <input
                  type="date"
                  className={estiloCampo}
                  value={fechaVigenciaVersion}
                  onChange={(e) => {
                    setFechaVigenciaVersion(e.target.value);
                    setVersionModificada(true);
                  }}
                />
              </label>

              <div className="grid grid-cols-2 gap-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700">
                  N° de Resolución
                  <input
                    type="text"
                    maxLength={100}
                    className={estiloCampo}
                    value={resolucionNumeroVersion}
                    onChange={(e) => {
                      setResolucionNumeroVersion(e.target.value);
                      setVersionModificada(true);
                    }}
                    placeholder="R.D. N° 015-2026"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Fecha de Resolución
                  <input
                    type="date"
                    className={estiloCampo}
                    value={resolucionFechaVersion}
                    onChange={(e) => {
                      setResolucionFechaVersion(e.target.value);
                      setVersionModificada(true);
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {aviso && (
          <div className="border-b border-blue-100 bg-blue-50 px-5 py-2 text-xs text-blue-800">{aviso}</div>
        )}

        {/* Lista de Trámites con Edición Integral de Parámetros */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
          {tramites.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
              Esta versión no tiene trámites. Agregue trámites desde la gestión principal.
            </div>
          )}

          {tramites.map((tramite) => {
            const draft = borradores[tramite.tramite_version_id];
            if (!draft) return null;
            const abierto = expandido === tramite.tramite_version_id;
            const id = tramite.tramite_version_id;

            return (
              <div key={id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => setExpandido(abierto ? null : id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700">{draft.codigo}</span>
                    <span className="text-sm font-semibold text-slate-900">{draft.denominacion}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {draft.rubro}
                    </span>
                    {draft.modificado && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Sin guardar
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">{abierto ? "Contraer" : "Editar"}</span>
                </button>

                {abierto && (
                  <div className="space-y-5 border-t border-slate-100 p-4">
                    {errores[id] && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                        {errores[id]}
                      </div>
                    )}

                    <section>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                        1. Datos generales
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="block text-xs font-semibold text-slate-700">
                          Código *
                          <input
                            className={estiloCampo}
                            value={draft.codigo}
                            maxLength={30}
                            onChange={(e) => actualizar(id, { codigo: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Rubro *
                          <input
                            className={estiloCampo}
                            value={draft.rubro}
                            maxLength={200}
                            onChange={(e) => actualizar(id, { rubro: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Denominación *
                          <input
                            className={estiloCampo}
                            value={draft.denominacion}
                            maxLength={300}
                            onChange={(e) => actualizar(id, { denominacion: e.target.value })}
                          />
                        </label>
                      </div>
                      <label className="mt-3 block text-xs font-semibold text-slate-700">
                        Descripción
                        <textarea
                          className={estiloCampo}
                          rows={2}
                          value={draft.descripcion}
                          onChange={(e) => actualizar(id, { descripcion: e.target.value })}
                        />
                      </label>
                    </section>

                    <section>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                        2. Calificación y plazos
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Calificación
                          <select
                            className={estiloCampo}
                            value={draft.calificacion}
                            onChange={(e) => actualizar(id, { calificacion: e.target.value as Calificacion })}
                          >
                            <option value="EVALUACION_PREVIA">Evaluación Previa</option>
                            <option value="APROBACION_AUTOMATICA">Aprobación Automática</option>
                            <option value="NO_APLICA">No Aplica</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Silencio administrativo
                          <select
                            className={estiloCampo}
                            value={draft.silencioAdministrativo}
                            onChange={(e) => actualizar(id, { silencioAdministrativo: e.target.value as Silencio })}
                          >
                            <option value="POSITIVO">Positivo</option>
                            <option value="NEGATIVO">Negativo</option>
                            <option value="NO_APLICA">No Aplica</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Días hábiles
                          <input
                            type="number"
                            min={1}
                            max={32767}
                            className={estiloCampo}
                            value={draft.plazoDiasHabiles}
                            onChange={(e) => {
                              const dias = e.target.value;
                              actualizar(id, {
                                plazoDiasHabiles: dias,
                                plazoTexto: dias ? `${dias} días hábiles` : draft.plazoTexto,
                              });
                            }}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Texto del plazo
                          <input
                            className={estiloCampo}
                            value={draft.plazoTexto}
                            maxLength={300}
                            onChange={(e) => actualizar(id, { plazoTexto: e.target.value })}
                          />
                        </label>
                      </div>
                    </section>

                    <section>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                        3. Derechos de tramitación
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Monto (S/)
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            max={99999999.99}
                            className={estiloCampo}
                            value={draft.derechoMonto}
                            onChange={(e) => actualizar(id, recalcularPorMonto(draft, e.target.value))}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Porcentaje de UIT
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            max={9999.99}
                            className={estiloCampo}
                            value={draft.derechoPorcentajeUit}
                            onChange={(e) => actualizar(id, { derechoPorcentajeUit: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Texto del derecho
                          <input
                            className={estiloCampo}
                            value={draft.derechoTexto}
                            maxLength={2000}
                            onChange={(e) => actualizar(id, { derechoTexto: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Cuenta o lugar de pago
                          <input
                            className={estiloCampo}
                            value={draft.cuentaPago}
                            maxLength={60}
                            onChange={(e) => actualizar(id, { cuentaPago: e.target.value })}
                          />
                        </label>
                      </div>
                    </section>

                    <section>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                        4. Autoridades y base legal
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Unidad que recibe
                          <input
                            className={estiloCampo}
                            value={draft.unidadRecibe}
                            maxLength={200}
                            onChange={(e) => actualizar(id, { unidadRecibe: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Autoridad que resuelve
                          <input
                            className={estiloCampo}
                            value={draft.autoridadResuelve}
                            maxLength={200}
                            onChange={(e) => actualizar(id, { autoridadResuelve: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Base legal
                          <textarea
                            className={estiloCampo}
                            rows={2}
                            value={draft.baseLegal}
                            onChange={(e) => actualizar(id, { baseLegal: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Recursos
                          <textarea
                            className={estiloCampo}
                            rows={2}
                            value={draft.recursos}
                            onChange={(e) => actualizar(id, { recursos: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Observaciones
                          <textarea
                            className={estiloCampo}
                            rows={2}
                            value={draft.observaciones}
                            onChange={(e) => actualizar(id, { observaciones: e.target.value })}
                          />
                        </label>
                      </div>
                    </section>

                    <section>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                        5. Requisitos
                      </h4>
                      <div className="space-y-2">
                        {draft.requisitos.map((requisito) => (
                          <div key={requisito.requisito_id} className="flex items-center gap-2">
                            <span className="w-6 text-center text-xs font-bold text-slate-400">
                              {requisito.orden}
                            </span>
                            <input
                              className={estiloCampo}
                              value={requisito.textoEditado}
                              onChange={(e) =>
                                setBorradores((prev) => ({
                                  ...prev,
                                  [id]: {
                                    ...prev[id],
                                    requisitos: prev[id].requisitos.map((item) =>
                                      item.requisito_id === requisito.requisito_id
                                        ? { ...item, textoEditado: e.target.value }
                                        : item
                                    ),
                                  },
                                }))
                              }
                              onBlur={() => void guardarTextoRequisito(id, requisito)}
                            />
                            <button
                              type="button"
                              onClick={() => void eliminarRequisito(id, requisito)}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <input
                            className={estiloCampo}
                            placeholder="Nuevo requisito"
                            value={draft.nuevoRequisito}
                            onChange={(e) =>
                              setBorradores((prev) => ({
                                ...prev,
                                [id]: { ...prev[id], nuevoRequisito: e.target.value },
                              }))
                            }
                          />
                          <button
                            type="button"
                            disabled={!draft.nuevoRequisito.trim() || guardandoId === id}
                            onClick={() => void agregarRequisito(id)}
                            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    </section>

                    <div className="flex justify-end border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        disabled={guardandoId === id || guardandoTodos}
                        onClick={() => void guardarTramite(id)}
                        className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
                      >
                        {guardandoId === id ? "Guardando…" : "Guardar este trámite"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
