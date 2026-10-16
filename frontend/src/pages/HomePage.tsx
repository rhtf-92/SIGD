import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Building2,
  FileCheck2,
  FileSignature,
  FolderOpen,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Lock,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  type LucideIcon,
  X,
} from "lucide-react";

import { useAuthStore } from "../stores/authStore";
import {
  useAutenticado,
  useModulosVisibles,
  useRolActual,
} from "../hooks/useModulosVisibles";
import { TODOS_LOS_ROLES } from "../config/modulos";
import type { RolCanonicoId } from "../types/rbacRoles";

const ETIQUETA_ROL: Record<RolCanonicoId, string> = {
  SUPER_ADMIN: "Super Administrador",
  DIRECTOR: "Director General",
  DOCENTE: "Docente / Coordinador",
  MESA_PARTES: "Mesa de Partes / Ventanilla",
  ESTUDIANTE: "Estudiante / Administrado",
};

const ICONOS_MODULO: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  registro: { icon: UserPlus, color: "text-blue-600", bg: "bg-blue-50 text-blue-600 border-blue-200/60" },
  casilla: { icon: Inbox, color: "text-indigo-600", bg: "bg-indigo-50 text-indigo-600 border-indigo-200/60" },
  "mesa-partes": { icon: Send, color: "text-blue-600", bg: "bg-blue-50 text-blue-600 border-blue-200/60" },
  ventanilla: { icon: Building2, color: "text-cyan-600", bg: "bg-cyan-50 text-cyan-600 border-cyan-200/60" },
  expedientes: { icon: FolderOpen, color: "text-amber-600", bg: "bg-amber-50 text-amber-600 border-amber-200/60" },
  "validez-legal": { icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 text-emerald-600 border-emerald-200/60" },
  titulacion: { icon: GraduationCap, color: "text-fuchsia-600", bg: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200/60" },
  resoluciones: { icon: FileSignature, color: "text-rose-600", bg: "bg-rose-50 text-rose-600 border-rose-200/60" },
  reportes: { icon: BarChart3, color: "text-teal-600", bg: "bg-teal-50 text-teal-600 border-teal-200/60" },
  "validador-cvd": { icon: BadgeCheck, color: "text-emerald-600", bg: "bg-emerald-50 text-emerald-600 border-emerald-200/60" },
  administracion: { icon: LayoutDashboard, color: "text-violet-600", bg: "bg-violet-50 text-violet-600 border-violet-200/60" },
};

export default function HomePage() {
  const autenticado = useAutenticado();
  const rol = useRolActual();
  const modulos = useModulosVisibles();
  const cerrarSesion = useAuthStore((state) => state.logout);
  const [busqueda, setBusqueda] = useState("");

  const esRolCanonico = rol !== null && TODOS_LOS_ROLES.includes(rol);

  const modulosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return modulos;
    const term = busqueda.toLowerCase().trim();
    return modulos.filter(
      (m) =>
        m.titulo.toLowerCase().includes(term) ||
        (m.subtitulo && m.subtitulo.toLowerCase().includes(term)) ||
        m.descripcion.toLowerCase().includes(term)
    );
  }, [modulos, busqueda]);

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-[#F8FAFC] px-4 py-12 text-slate-900 sm:px-6 lg:px-8">
      {/* Decorative ambient background glows */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
      >
        <div className="h-[28rem] w-[50rem] rounded-full bg-gradient-to-tr from-blue-600/10 via-sky-400/5 to-transparent blur-3xl" />
      </div>

      <div className="w-full max-w-5xl space-y-8">
        {/* Header / Hero Section */}
        <div className="text-center space-y-3.5 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3.5 py-1 text-xs font-bold text-blue-700 shadow-sm backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            IESTP &quot;Suiza&quot; — Pucallpa
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-500">Gobierno Digital</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-slate-950">
            SIGD
          </h1>

          <p className="text-lg font-bold text-slate-700 sm:text-xl">
            Sistema Integral de Gestión Documentaria
          </p>

          <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Plataforma Institucional y Notificación Electrónica con Validez Legal
            conforme a la Ley N° 27444 (LPAG) y el D.L. N° 1412.
          </p>

          {autenticado && esRolCanonico ? (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3.5 py-1 text-xs font-bold text-emerald-800 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Sesión activa · {ETIQUETA_ROL[rol]}
              </span>
              <button
                type="button"
                onClick={() => cerrarSesion()}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>

        {/* Minimalist Trust & Compliance Pillars */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
              <Send className="h-3.5 w-3.5" />
              Mesa de Partes
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium leading-snug">
              Recepción 24/7 con corte legal LPAG a las 16:30 hrs
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
              <Inbox className="h-3.5 w-3.5" />
              Casilla Electrónica
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium leading-snug">
              Notificaciones oficiales con acuse de recibo y validez legal
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
              <FileCheck2 className="h-3.5 w-3.5" />
              Firma & CVD
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium leading-snug">
              Verificación criptográfica SHA-256 y trazabilidad de folios
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md">
            <div className="flex items-center gap-2 text-fuchsia-600 font-bold text-xs uppercase tracking-wider">
              <Lock className="h-3.5 w-3.5" />
              Control RBAC
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium leading-snug">
              Segregación de roles institucionales canónicos
            </p>
          </div>
        </div>

        {/* Dynamic Search & Filter Input */}
        <div className="relative max-w-md mx-auto pt-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Filtrar módulos del sistema..."
              aria-label="Filtrar módulos del sistema"
              className="w-full rounded-2xl border border-slate-300 bg-white/90 py-2.5 pl-10 pr-10 text-xs font-medium text-slate-900 shadow-sm backdrop-blur-md placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
            />
            {busqueda ? (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 rounded-full p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Modules Grid - Bento Style */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {modulosFiltrados.map((modulo) => {
            const configIcono = ICONOS_MODULO[modulo.id] ?? {
              icon: Sparkles,
              color: "text-blue-600",
              bg: "bg-blue-50 text-blue-600 border-blue-200/60",
            };
            const Icono = configIcono.icon;

            return (
              <Link
                key={modulo.ruta}
                to={modulo.ruta}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                  modulo.destacado
                    ? "border-blue-200/90 bg-gradient-to-b from-white via-white to-blue-50/40 hover:border-blue-400"
                    : "border-slate-200/80 bg-white hover:border-slate-300"
                }`}
              >
                {/* Top card bar: Tag + Icon + Arrow */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${configIcono.bg} shadow-sm transition-transform duration-200 group-hover:scale-105`}
                    >
                      <Icono className="h-5 w-5" aria-hidden="true" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {modulo.subtitulo ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          {modulo.subtitulo}
                        </span>
                      ) : null}
                      <span className="rounded-lg p-1 text-slate-400 transition-colors group-hover:text-blue-600">
                        <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </div>

                  <h2 className="mt-4 text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    {modulo.titulo}
                  </h2>

                  <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">
                    {modulo.descripcion}
                  </p>
                </div>

                {/* Subtle card bottom accent line on hover */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                  <span>Acceder al módulo</span>
                  <span className="font-mono text-[10px]">→</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Empty search state */}
        {modulosFiltrados.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center backdrop-blur-sm">
            <Search className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-800">
              No se encontraron módulos para &quot;{busqueda}&quot;
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Intente buscar con otro término como trámite, casilla o expediente.
            </p>
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="mt-3 text-xs font-bold text-blue-600 hover:underline"
            >
              Restablecer búsqueda
            </button>
          </div>
        )}

        {/* Institutional Login CTA for Unauthenticated Users */}
        {!autenticado ? (
          <div className="w-full pt-4">
            <Link
              to="/login"
              className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-blue-50/70 p-7 text-center shadow-sm backdrop-blur-md transition-all duration-200 hover:border-blue-400 hover:shadow-lg"
            >
              <span className="rounded-full bg-blue-100 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-700">
                Acceso Institucional
              </span>
              <span className="mt-2 text-xl font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors">
                Iniciar Sesión
              </span>
              <span className="mt-1.5 max-w-lg text-xs leading-relaxed text-slate-600 font-medium">
                Ingresa con tus credenciales para ver los módulos asignados a tu
                rol institucional (Mesa de Partes, Coordinación Académica, Dirección o Administración).
              </span>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-transform group-hover:scale-105">
                Ingresar al sistema <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
