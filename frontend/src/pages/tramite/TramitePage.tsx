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
 * ==============================================================================
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import ConsultaExpedientePublico from "../../components/tramite/ConsultaExpedientePublico";
import TramiteWizard from "../../components/tramite/TramiteWizard";
import { useAuthStore } from "../../stores/authStore";
import "../../styles/consulta-publica.css";

interface TramiteTupaPublico {
  id: string;
  codigo: string;
  denominacion: string;
  unidad_organica: string;
  plazo_dias: number;
}

function MesaPartesPublica() {
  const [catalogo, setCatalogo] = useState<TramiteTupaPublico[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);

  useEffect(() => {
    const control = new AbortController();
    apiClient
      .get<TramiteTupaPublico[]>("/api/v1/tramites/tupa", {
        signal: control.signal,
      })
      .then((respuesta) => {
        if (!control.signal.aborted) {
          setCatalogo(Array.isArray(respuesta.data) ? respuesta.data : []);
          setErrorCatalogo(null);
        }
      })
      .catch(() => {
        if (!control.signal.aborted) {
          setErrorCatalogo("No se pudo cargar el catálogo TUPA en este momento.");
        }
      })
      .finally(() => {
        if (!control.signal.aborted) {
          setCargandoCatalogo(false);
        }
      });

    return () => control.abort();
  }, []);

  return (
    <main className="sigd-public-page">
      <div className="sigd-public-shell">
        <header className="sigd-public-banner">
          <div className="sigd-public-banner-inner">
            <div>
              <div className="sigd-public-badges">
                <span className="sigd-public-kicker">Mesa de Partes Virtual</span>
                <span className="sigd-public-entity">
                  IESTP &ldquo;Suiza&rdquo; de Pucallpa
                </span>
              </div>
              <h1>
                Mesa de Partes Virtual — Consulta Pública y Catálogo TUPA
              </h1>
              <p className="sigd-public-banner-desc">
                Consulta el estado de tu documentación sin cuenta usando tu código CUT y revisa los procedimientos TUPA disponibles.
              </p>
            </div>

            <Link to="/" className="sigd-public-back-btn">
              ← Volver al inicio
            </Link>
          </div>
        </header>

        <ConsultaExpedientePublico
          syncUrl={false}
          titulo="Consulta el estado de tu documentación"
          subtitulo="¿Ya presentaste un trámite? Ingresa tu código CUT para revisar su avance sin necesidad de iniciar sesión."
          mostrarEnlacePortal={false}
        />

        <section
          aria-labelledby="tupa-publico-titulo"
          className="sigd-public-tupa-section"
        >
          <div className="sigd-public-tupa-head">
            <h2 id="tupa-publico-titulo">Catálogo Público de Trámites TUPA</h2>
            <p>
              Procedimientos vigentes, unidades orgánicas responsables y plazos legales de atención.
            </p>
          </div>

          {cargandoCatalogo && (
            <div className="sigd-tracker-skeleton" role="status">
              <div className="sigd-tracker-skeleton-status">
                <span className="sigd-tracker-spinner" aria-hidden="true" />
                <span>Cargando catálogo de trámites...</span>
              </div>
              <div className="sigd-tracker-skeleton-bar is-medium" />
            </div>
          )}

          {errorCatalogo && (
            <div role="alert" className="sigd-tracker-error">
              <span>{errorCatalogo}</span>
            </div>
          )}

          {!cargandoCatalogo && !errorCatalogo && catalogo.length === 0 && (
            <p className="sigd-public-tupa-area">
              No hay procedimientos TUPA vigentes registrados en este momento.
            </p>
          )}

          {!cargandoCatalogo && !errorCatalogo && catalogo.length > 0 && (
            <div className="sigd-public-tupa-grid">
              {catalogo.map((item) => (
                <article key={item.id} className="sigd-public-tupa-card">
                  <div>
                    <span className="sigd-public-tupa-code">{item.codigo}</span>
                    <h3>{item.denominacion}</h3>
                    <p className="sigd-public-tupa-area">
                      Área responsable: {item.unidad_organica}
                    </p>
                  </div>
                  <span className="sigd-public-tupa-days">
                    {item.plazo_dias} días hábiles
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="sigd-public-cta">
          <div className="sigd-public-cta-copy">
            <h2>¿Deseas presentar un nuevo trámite virtual?</h2>
            <p>
              La radicación formal de expedientes con carga de documentos PDF requiere identificación ciudadana conforme a la Ley N° 27444.
            </p>
          </div>
          <div className="sigd-public-cta-actions">
            <Link to="/login" className="sigd-public-btn-primary">
              Iniciar sesión para radicar
            </Link>
            <Link to="/registro" className="sigd-public-btn-secondary">
              Registrarme como ciudadano/estudiante
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function TramitePage() {
  const usuario = useAuthStore((state) => state.usuario);
  const [ultimoCut, setUltimoCut] = useState<string | null>(null);

  if (!usuario) {
    return <MesaPartesPublica />;
  }

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

            <div className="flex flex-wrap shrink-0 items-center gap-3 self-start md:self-auto">
              <Link
                to="/consulta"
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Consultar trámite (CUT)
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Volver al inicio
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Ventanilla Virtual Abierta
              </span>
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
            onSuccess={(_data, cut) => {
              setUltimoCut(cut);
            }}
          />
        </main>
      </div>
  );
}
