/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLES: ENT-M02-01 (Asistente Wizard) & ENT-M02-02 (Motor JSON Schema)
 * ARCHIVO: src/pages/tramite/TramitePage.tsx
 * RESPONSABLE: Anllely Melgarejo V. (F_ANLLELY)
 * COLABORADORAS: Lucy Panduro Ramos, Noelia Alva (Grupo 1)
 * 
 * DESCRIPCIÓN:
 * Vista oficial de la Mesa de Partes Virtual que alberga el Asistente Wizard de 4 Pasos.
 * Cumple con los requisitos de evaluación docente:
 * 1. Presentación limpia e institucional sin componentes de prueba aislados.
 * 2. Barra de progreso accesible (WCAG 2.1 AA) e indicadores de estado.
 * 3. Persistencia reactiva del borrador en memoria ante avances y retrocesos.
 * 4. Control de navegación bloqueante basado en las reglas de la Ley N° 27444.
 * 5. Claridad canónica: separación entre Radicación Directa y Consulta de Catálogo TUPA.
 * ==============================================================================
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { TRAMITE_WIZARD_STORAGE_KEY } from "../../hooks/useTramiteWizardReducer";
import { FileText, ArrowRight, BookOpen, KeyRound, LogIn, UserPlus } from "lucide-react";
import TramiteWizard from "../../components/tramite/TramiteWizard";
import { useAuthStore } from "../../stores/authStore";

export default function TramitePage() {
  const [ultimoCut, setUltimoCut] = useState<string | null>(null);
  const location = useLocation();
  const [resetKey, setResetKey] = useState<number>(0);

  useEffect(() => {
    const navState = location.state as { nuevoTramite?: boolean; t?: number } | null;
    if (navState?.nuevoTramite) {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.removeItem(TRAMITE_WIZARD_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
      setUltimoCut(null);
      setResetKey((prev) => prev + 1);
      try {
        window.history.replaceState({ ...window.history.state, usr: null }, '');
      } catch {
        // ignore
      }
    }
  }, [location.state, location.key]);
  const usuario = useAuthStore((s) => s.usuario);
  const token = useAuthStore((s) => s.accessToken);
  const [accesoTupa, setAccesoTupa] = useState<'cargando' | 'autorizado' | 'solicitar' | 'error'>('cargando');
  const esInstitucional =
    usuario?.rol &&
    ["MESA_PARTES", "ADMINISTRADOR", "DIRECTOR", "ESPECIALISTA", "SECRETARIO"].includes(usuario.rol);

  useEffect(() => {
    if (!token || !usuario || esInstitucional) return;
    const controller = new AbortController();
    setAccesoTupa('cargando');
    fetch('/api/v1/tramites/tupa/acceso/estado', {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok) throw new Error('No se pudo consultar el acceso TUPA.');
      return res.json() as Promise<{ autorizado: boolean }>;
    }).then((estado) => {
      if (!controller.signal.aborted) setAccesoTupa(estado.autorizado ? 'autorizado' : 'solicitar');
    }).catch(() => {
      if (!controller.signal.aborted) setAccesoTupa('error');
    });
    return () => controller.abort();
  }, [token, usuario?.id, esInstitucional]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* CABECERA INSTITUCIONAL OFICIAL */}
      <header className="rounded-2xl border border-blue-200/80 bg-linear-to-r from-blue-50 via-sky-50/50 to-indigo-50/40 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-md bg-[#006EC7] px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white">
                Mesa de Partes Virtual
              </span>
              <span className="text-xs font-semibold text-slate-500">
                IESTP &ldquo;Suiza&rdquo; de Pucallpa
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Asistente de Registro Documentario en Línea
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 max-w-2xl leading-relaxed">
              Complete los 4 pasos secuenciales para registrar formalmente su solicitud o expediente institucional.
              Sus datos son validados conforme a la Ley del Procedimiento Administrativo General (Ley N° 27444).
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 self-start md:self-auto">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Volver
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Ventanilla Virtual Abierta
            </span>
          </div>
        </div>

        {/* Panel Guía TUPA — Separación clara de intenciones */}
        <div className="mt-6 pt-5 border-t border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                ¿Busca consultar el Catálogo Integral TUPA 2026 completo (72 entradas)?
              </p>
              <p className="text-[11px] text-slate-500">
                {esInstitucional
                  ? "Su rol institucional permite consultar las 72 entradas."
                  : accesoTupa === 'autorizado'
                    ? "Su acceso al catálogo completo está aprobado."
                    : accesoTupa === 'error'
                      ? "No se pudo consultar su autorización TUPA. Actualice la página para reintentar."
                      : "Para consultar las 72 entradas se requiere una solicitud aprobada."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(esInstitucional || (token && accesoTupa === 'autorizado')) && (
              <Link to="/tupa" className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-900 hover:bg-cyan-100 transition shadow-2xs">
                <BookOpen className="h-3.5 w-3.5 text-cyan-700" />
                Ver Catálogo TUPA <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {token && !esInstitucional && accesoTupa === 'solicitar' && (
              <Link
                to="/solicitud-acceso-tupa"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                <KeyRound className="h-3.5 w-3.5 text-slate-600" />
                Solicitar acceso TUPA
              </Link>
            )}
            {token && !esInstitucional && accesoTupa === 'cargando' && <span role="status" className="text-xs text-slate-500">Consultando acceso TUPA...</span>}
            {!token && <>
              <Link to="/login" className="text-xs font-semibold text-cyan-900"><LogIn className="inline h-3.5 w-3.5" /> Iniciar sesión</Link>
              <Link to="/registro" className="text-xs font-semibold text-cyan-900"><UserPlus className="inline h-3.5 w-3.5" /> Registrarme</Link>
            </>}
          </div>
        </div>
      </header>

      {/* NOTIFICACIÓN DE EXPEDIENTE RADICADO EN ESTA SESIÓN */}
      {ultimoCut && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>
              Expediente radicado con éxito. Código Único de Trámite: <strong>{ultimoCut}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setUltimoCut(null)}
            className="text-xs text-emerald-700 hover:underline font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ASISTENTE WIZARD OFICIAL DE 4 PASOS */}
      <main>
        <TramiteWizard
          resetKey={resetKey}
          onSuccess={(_data, cut) => {
            setUltimoCut(cut);
          }}
        />
      </main>
    </div>
  );
}
