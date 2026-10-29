import React, { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Mail,
  ShieldCheck,
  Send,
  Search,
  ArrowRight,
  Clock,
  FileCheck2,
  Calendar,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";

export default function HomePage(): React.JSX.Element {
  const navigate = useNavigate();
  const [codigoCutInput, setCodigoCutInput] = useState<string>("");
  const usuario = useAuthStore((s) => s.usuario);

  // 1. Verificación estricta de flujo inicial: si no está autenticado, redirigir a Login
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("sigd_token") : null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const rol =
    usuario?.rol ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("sigd_rol") || "SUPER_ADMIN"
      : "SUPER_ADMIN");

  const nombreUsuario =
    usuario?.nombreCompleto ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("sigd_usuario_nombre") || "Usuario Institucional"
      : "Usuario Institucional");

  const handleBuscarCut = (e: React.FormEvent) => {
    e.preventDefault();
    const cut = codigoCutInput.trim().toUpperCase();
    if (cut) {
      navigate(`/consulta/${cut}`);
    }
  };

  // Fecha formal en formato peruano
  const hoy = new Date();
  const fechaTexto = hoy.toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fechaCapitalizada = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);

  return (
    <div className="space-y-6">
      {/* 1. Encabezado del Tablero Institucional (Sin duplicidad visual) */}
      <section
        aria-label="Bienvenida al sistema SIGD"
        className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0c2340]">
                IESTP "Suiza" • Pucallpa
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 uppercase">
                {rol}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                <Calendar className="h-3 w-3 text-slate-400" aria-hidden="true" />
                {fechaCapitalizada}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c2340]">
              Bienvenido, {nombreUsuario}
            </h1>

            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              Plataforma oficial para la administración, tramitación electrónica y seguimiento de
              expedientes académicos y administrativos con valor probatorio y plena validez legal.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <Link
              to="/tramite/mesa-partes-virtual"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0c2340] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0f3261] transition"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nuevo Trámite Virtual</span>
            </Link>

            <Link
              to="/validador-cvd"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Verificar Documento CVD</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Tarjetas Métricas Clave de Gestión (Estructura sobria sobre fondo neutro) */}
      <section aria-label="Indicadores clave del sistema">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Métrica 1: Expedientes en Trámite */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Expedientes Activos
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0c2340]">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black tracking-tight text-slate-900">24</div>
              <p className="mt-1 text-xs text-emerald-700 font-medium">
                • 94% en plazo reglamentario SLA
              </p>
            </div>
            <Link
              to="/expedientes"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0c2340] hover:underline"
            >
              <span>Ver bandeja de expedientes</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          {/* Métrica 2: Notificaciones en Casilla */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Casilla Electrónica
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0c2340]">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black tracking-tight text-slate-900">18</div>
              <p className="mt-1 text-xs text-blue-700 font-medium">
                • Actos notificados válidos
              </p>
            </div>
            <Link
              to="/casilla"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0c2340] hover:underline"
            >
              <span>Revisar notificaciones</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          {/* Métrica 3: Documentos con Firma Digital */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Firma Digital & CVD
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0c2340]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black tracking-tight text-slate-900">42</div>
              <p className="mt-1 text-xs text-slate-600 font-medium">
                • D.S. N° 070-2013-PCM verificado
              </p>
            </div>
            <Link
              to="/flujo-validez-legal"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0c2340] hover:underline"
            >
              <span>Pasarela de firma oficial</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          {/* Métrica 4: Mesa de Partes Virtual */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mesa de Partes
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0c2340]">
                <Send className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black tracking-tight text-slate-900">15</div>
              <p className="mt-1 text-xs text-amber-700 font-medium">
                • Trámites recepcionados hoy
              </p>
            </div>
            <Link
              to="/tramite/mesa-partes-virtual"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0c2340] hover:underline"
            >
              <span>Acceder a ventanilla</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Panel de Búsqueda Rápida y Normativa Operativa (Sin duplicidad) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Consulta Rápida de Expediente por CUT */}
        <section
          aria-labelledby="consulta-rapida-titulo"
          className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2.5 text-[#0c2340]">
              <Search className="h-5 w-5 text-[#0f3261]" aria-hidden="true" />
              <h2 id="consulta-rapida-titulo" className="text-base font-bold">
                Consulta Rápida de Expediente (CUT)
              </h2>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Consulte la trazabilidad, estado y actuados de cualquier expediente institucional
              ingresando su Código Único de Trámite.
            </p>

            <form onSubmit={handleBuscarCut} className="mt-4 flex gap-2">
              <input
                type="text"
                value={codigoCutInput}
                onChange={(e) => setCodigoCutInput(e.target.value)}
                placeholder="Ej. CUT-2026-00042"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:outline-none focus:ring-2 focus:ring-[#0c2340]/20 font-mono uppercase"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0c2340] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0f3261] transition"
              >
                <span>Buscar</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Para una búsqueda avanzada con filtros por fecha y administrado:</span>
            <Link
              to="/expedientes"
              className="font-bold text-[#0c2340] hover:underline shrink-0 ml-2"
            >
              Ir a Bandeja Completa
            </Link>
          </div>
        </section>

        {/* Notificaciones y Directivas Institucionales */}
        <section
          aria-labelledby="directivas-titulo"
          className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-2.5 text-[#0c2340]">
            <Clock className="h-5 w-5 text-[#0f3261]" aria-hidden="true" />
            <h2 id="directivas-titulo" className="text-base font-bold">
              Directivas y Horario de Corte Oficial
            </h2>
          </div>

          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
              <Clock className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="text-amber-900">Horario de Corte Legal (16:30 hrs):</strong>
                <p className="mt-0.5 text-amber-800 text-[11px] leading-relaxed">
                  Conforme a la Ley N° 27444, las solicitudes recibidas después de las 16:30 hrs
                  se computan para efectos de plazo al día hábil siguiente.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <FileCheck2 className="h-4 w-4 shrink-0 text-[#0f3261] mt-0.5" aria-hidden="true" />
              <div>
                <strong className="text-blue-900">Validez y Firma Digital (Ley N° 27269):</strong>
                <p className="mt-0.5 text-blue-800 text-[11px] leading-relaxed">
                  Todo documento emitido en el SIGD cuenta con firma digital certificada, código de
                  verificación (CVD) y sellado de tiempo criptográfico.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
