import { Link } from "react-router-dom";
import {
  Globe,
  User,
  Building2,
  ArrowRight,
  Lock,
  Shield,
  Search,
  FileCheck,
  Layers,
  LogIn,
  FileText,
  Mail,
  Inbox,
  Sliders,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import {
  MODULOS_HOME_PUBLICOS,
  MODULOS_HOME_CIUDADANO,
  MODULOS_HOME_INSTITUCIONAL,
  type ModuloHomeItem,
  type RolCanonica,
} from "../config/navigation.config";

const ICONOS_POR_ID: Record<string, LucideIcon> = {
  "consulta-cut": Search,
  "registro-ciudadano": User,
  "validador-cvd": FileCheck,
  "flujo-validez-legal": Layers,
  "iniciar-sesion": LogIn,
  "mesa-partes-virtual": FileText,
  "mis-expedientes": Layers,
  "casilla-electronica": Mail,
  "bandeja-expedientes": Inbox,
  "ventanilla-presencial": Building2,
  "panel-administracion": Sliders,
  "reportes-tableros": BarChart3,
};

export default function HomePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const usuario = useAuthStore((state) => state.usuario);

  const tieneRolPermitido = (rolesPermitidos?: readonly RolCanonica[]) => {
    if (!isAuthenticated || !usuario?.rol || !rolesPermitidos) return false;
    return rolesPermitidos.includes(usuario.rol as RolCanonica);
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-br from-slate-50 via-sky-50/20 to-teal-50/15 px-3.5 py-8 text-slate-900 sm:px-6 sm:py-10 lg:px-8">
      {/* 1. Encabezado Institucional Principal */}
      <header className="max-w-3xl text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-gradient-to-b from-white/95 via-cyan-50/85 to-sky-50/70 px-4 py-1.5 text-xs font-bold text-cyan-950 shadow-[0_2px_10px_rgba(6,182,212,0.15),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-xs">
          <span className="h-2 w-2 rounded-full bg-cyan-600 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          IESTP &quot;Suiza&quot; — Pucallpa, Ucayali
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          SIGD
        </h1>
        <p className="text-lg font-semibold text-slate-700 sm:text-xl">
          Sistema Integral de Gestión Documentaria
        </p>
        <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
          Plataforma Institucional y Notificación Electrónica con Validez Legal.
          Accede a servicios de consulta abierta, trámites de administrados o gestión interna.
        </p>

        {isAuthenticated && usuario && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-gradient-to-b from-white/95 via-cyan-50/80 to-white px-4 py-1.5 text-xs text-slate-900 shadow-[0_2px_8px_rgba(6,182,212,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-xs ring-1 ring-cyan-400/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Sesión activa: <strong className="font-semibold">{usuario.rol === 'CIUDADANO' ? 'Mi cuenta' : usuario.nombreCompleto}</strong>
              {usuario.rol !== 'CIUDADANO' && <> (<span className="font-mono font-bold text-cyan-800">{usuario.rol}</span>)</>}
            </span>
          </div>
        )}
      </header>

      {/* 2. Tres Bloques Segmentados de Navegación con lenguaje visual Liquid Glass */}
      <div className="mt-12 w-full max-w-6xl space-y-10">
        {/* BLOQUE A: Servicios Públicos (Aqua / Cyan / Emerald Liquid Glass) */}
        <section
          aria-labelledby="bloque-publico-titulo"
          className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white/90 via-cyan-50/40 to-emerald-50/25 p-5 sm:p-7 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(6,182,212,0.06),0_16px_48px_-8px_rgba(6,182,212,0.14),0_2px_12px_-2px_rgba(0,0,0,0.02)] ring-1 ring-cyan-200/50 backdrop-blur-md space-y-5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent after:pointer-events-none after:absolute after:-top-24 after:-right-24 after:h-48 after:w-48 after:rounded-full after:bg-cyan-300/15 after:blur-2xl"
        >
          <div className="relative z-10 flex flex-col gap-2 border-b border-cyan-200/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/80 bg-gradient-to-b from-white/95 via-cyan-50/80 to-sky-50/60 px-3 py-1 text-xs font-bold text-cyan-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(6,182,212,0.12)] backdrop-blur-xs">
                <Globe className="h-3.5 w-3.5 text-cyan-700" />
                Servicios Públicos
              </div>
              <h2
                id="bloque-publico-titulo"
                className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl tracking-tight"
              >
                Servicios Públicos y Consulta Ciudadana
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm">
                Acceso libre y abierto sin requerir autenticación ni credenciales previas.
              </p>
            </div>
            <span className="self-start rounded-full border border-cyan-200/70 bg-gradient-to-b from-white/95 via-cyan-50/60 to-white px-3.5 py-1 text-xs font-semibold text-cyan-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(6,182,212,0.08)] sm:self-auto">
              5 servicios disponibles
            </span>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS_HOME_PUBLICOS.map((modulo) => (
              <CardModuloPublico key={modulo.id} modulo={modulo} />
            ))}
          </div>
        </section>

        {/* BLOQUE B: Acceso con Cuenta Ciudadana (Sky / Blue Liquid Glass) */}
        <section
          aria-labelledby="bloque-ciudadano-titulo"
          className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white/90 via-sky-50/40 to-blue-50/20 p-5 sm:p-7 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(14,165,233,0.06),0_16px_48px_-8px_rgba(14,165,233,0.12),0_2px_12px_-2px_rgba(0,0,0,0.02)] ring-1 ring-sky-200/50 backdrop-blur-md space-y-5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent after:pointer-events-none after:absolute after:-top-24 after:-right-24 after:h-48 after:w-48 after:rounded-full after:bg-sky-300/15 after:blur-2xl"
        >
          <div className="relative z-10 flex flex-col gap-2 border-b border-sky-200/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-gradient-to-b from-white/95 via-sky-50/80 to-blue-50/60 px-3 py-1 text-xs font-bold text-sky-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(14,165,233,0.12)] backdrop-blur-xs">
                <User className="h-3.5 w-3.5 text-sky-700" />
                Acceso con Cuenta Ciudadana
              </div>
              <h2
                id="bloque-ciudadano-titulo"
                className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl tracking-tight"
              >
                Portal y Servicios del Administrado
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm">
                Radicación virtual de trámites 24/7, expedientes de autoría propia y casilla electrónica.
              </p>
            </div>
            <span className="self-start rounded-full border border-sky-200/70 bg-gradient-to-b from-white/95 via-sky-50/60 to-white px-3.5 py-1 text-xs font-semibold text-sky-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(14,165,233,0.08)] sm:self-auto">
              3 servicios de administrado
            </span>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS_HOME_CIUDADANO.map((modulo) => (
              <CardModuloCiudadano
                key={modulo.id}
                modulo={modulo}
                isAuthenticated={isAuthenticated}
                esCiudadano={usuario?.rol === "CIUDADANO"}
              />
            ))}
          </div>
        </section>

        {/* BLOQUE C: Acceso Institucional por Rol (Slate / Indigo Liquid Glass) */}
        <section
          aria-labelledby="bloque-institucional-titulo"
          className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white/90 via-slate-50/60 to-indigo-50/25 p-5 sm:p-7 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(99,102,241,0.05),0_16px_48px_-8px_rgba(99,102,241,0.10),0_2px_12px_-2px_rgba(0,0,0,0.02)] ring-1 ring-indigo-200/40 backdrop-blur-md space-y-5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent after:pointer-events-none after:absolute after:-top-24 after:-right-24 after:h-48 after:w-48 after:rounded-full after:bg-indigo-300/10 after:blur-2xl"
        >
          <div className="relative z-10 flex flex-col gap-2 border-b border-indigo-200/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-gradient-to-b from-white/95 via-indigo-50/70 to-slate-50/60 px-3 py-1 text-xs font-bold text-indigo-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(99,102,241,0.10)] backdrop-blur-xs">
                <Building2 className="h-3.5 w-3.5 text-indigo-700" />
                Acceso Institucional por Rol
              </div>
              <h2
                id="bloque-institucional-titulo"
                className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl tracking-tight"
              >
                Operación, Despacho y Gestión Interna
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm">
                Módulos de gestión documental restringidos para personal y directivos del IESTP Suiza.
              </p>
            </div>
            <span className="self-start rounded-full border border-indigo-200/70 bg-gradient-to-b from-white/95 via-indigo-50/50 to-white px-3.5 py-1 text-xs font-semibold text-indigo-950 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_2px_6px_rgba(99,102,241,0.08)] sm:self-auto">
              4 módulos institucionales
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            {MODULOS_HOME_INSTITUCIONAL.map((modulo) => (
              <CardModuloInstitucional
                key={modulo.id}
                modulo={modulo}
                isAuthenticated={isAuthenticated}
                tienePermiso={tieneRolPermitido(modulo.rolesPermitidos)}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Tarjeta de Servicio Público: estilo aqua / glass translúcido con microinteracción elegante.
 */
function CardModuloPublico({ modulo }: { modulo: ModuloHomeItem }) {
  const Icono = ICONOS_POR_ID[modulo.id] || Globe;

  return (
    <Link
      to={modulo.ruta}
      className="group relative overflow-hidden flex flex-col justify-between rounded-2xl border border-white/90 bg-white/80 p-4 sm:p-5 shadow-[0_4px_20px_-4px_rgba(6,182,212,0.08)] backdrop-blur-sm transition-all duration-300 ease-out ring-1 ring-cyan-100/60 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent hover:-translate-y-1 hover:border-cyan-300/80 hover:bg-white/95 hover:shadow-[0_14px_30px_-6px_rgba(6,182,212,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-white to-cyan-50 text-cyan-700 border border-cyan-200/80 shadow-[0_2px_5px_rgba(6,182,212,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)] group-hover:bg-cyan-100 group-hover:text-cyan-800 transition">
            <Icono className="h-4 w-4" />
          </div>
          {/* Badge visible obligatorio estilo cápsula */}
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/70 bg-gradient-to-b from-white via-cyan-50/80 to-sky-50/60 px-2.5 py-0.5 text-xs font-semibold text-cyan-950 shadow-[0_1px_4px_rgba(6,182,212,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)]">
            {modulo.badge}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">
            {modulo.subtitulo}
          </span>
          <h3 className="mt-0.5 text-base font-bold text-slate-900 group-hover:text-cyan-900 transition">
            {modulo.titulo}
          </h3>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          {modulo.descripcion}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-cyan-100/60">
        <span className="inline-flex w-full items-center justify-between rounded-xl border border-cyan-600/30 bg-gradient-to-b from-white to-cyan-50/90 px-3.5 py-2 text-xs font-bold text-cyan-800 transition shadow-2xs group-hover:border-cyan-600 group-hover:bg-gradient-to-r group-hover:from-teal-600 group-hover:to-cyan-600 group-hover:text-white group-hover:shadow-[0_4px_12px_rgba(6,182,212,0.3)]">
          <span>{modulo.ctaPublico}</span>
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Tarjeta de Cuenta Ciudadana: estilo azul institucional translúcido orientado al administrado.
 */
function CardModuloCiudadano({
  modulo,
  isAuthenticated,
  esCiudadano,
}: {
  modulo: ModuloHomeItem;
  isAuthenticated: boolean;
  esCiudadano: boolean;
}) {
  const Icono = ICONOS_POR_ID[modulo.id] || User;

  const ctaTexto = !isAuthenticated
    ? "Iniciar sesión para acceder"
    : esCiudadano
    ? (modulo.ctaAutenticado ?? "Acceder al servicio")
    : "Iniciar sesión para acceder";

  return (
    <Link
      to={modulo.ruta}
      className="group relative overflow-hidden flex flex-col justify-between rounded-2xl border border-white/90 bg-white/80 p-4 sm:p-5 shadow-[0_4px_20px_-4px_rgba(14,165,233,0.08)] backdrop-blur-sm transition-all duration-300 ease-out ring-1 ring-sky-100/60 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent hover:-translate-y-1 hover:border-sky-300/80 hover:bg-white/95 hover:shadow-[0_14px_30px_-6px_rgba(14,165,233,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-white to-sky-50 text-sky-700 border border-sky-200/80 shadow-[0_2px_5px_rgba(14,165,233,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)] group-hover:bg-sky-100 transition">
            <Icono className="h-4 w-4" />
          </div>
          {/* Badge visible obligatorio estilo cápsula */}
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200/70 bg-gradient-to-b from-white via-sky-50/80 to-blue-50/60 px-2.5 py-0.5 text-xs font-semibold text-sky-950 shadow-[0_1px_4px_rgba(14,165,233,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)]">
            {modulo.badge}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600">
            {modulo.subtitulo}
          </span>
          <h3 className="mt-0.5 text-base font-bold text-slate-900 group-hover:text-sky-800 transition">
            {modulo.titulo}
          </h3>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          {modulo.descripcion}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-sky-100/60">
        <span
          className={`inline-flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-2xs ${
            !isAuthenticated
              ? "bg-blue-600 text-white shadow-xs group-hover:bg-blue-700"
              : esCiudadano
              ? "border border-blue-600 bg-gradient-to-b from-white to-blue-50 text-blue-800 group-hover:bg-blue-600 group-hover:text-white"
              : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}
        >
          <span>{ctaTexto}</span>
          {!isAuthenticated ? (
            <Lock className="h-3.5 w-3.5 opacity-90" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          )}
        </span>
      </div>
    </Link>
  );
}

/**
 * Tarjeta de Módulo Institucional: estilo sobrio índigo/slate translúcido y profesional.
 */
function CardModuloInstitucional({
  modulo,
  isAuthenticated,
  tienePermiso,
}: {
  modulo: ModuloHomeItem;
  isAuthenticated: boolean;
  tienePermiso: boolean;
}) {
  const Icono = ICONOS_POR_ID[modulo.id] || Building2;

  const ctaTexto = !isAuthenticated
    ? "Acceso con rol asignado"
    : tienePermiso
    ? (modulo.ctaAutenticado ?? "Ingresar al módulo")
    : "Acceso con rol asignado";

  return (
    <Link
      to={modulo.ruta}
      className="group relative overflow-hidden flex flex-col justify-between rounded-2xl border border-white/90 bg-white/80 p-4 sm:p-5 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.06)] backdrop-blur-sm transition-all duration-300 ease-out ring-1 ring-indigo-100/50 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent hover:-translate-y-1 hover:border-indigo-300/80 hover:bg-white/95 hover:shadow-[0_14px_30px_-6px_rgba(99,102,241,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-white to-indigo-50/70 text-indigo-700 border border-indigo-200/70 shadow-[0_2px_5px_rgba(99,102,241,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)] group-hover:bg-indigo-100 transition">
            <Icono className="h-4 w-4" />
          </div>
          {/* Badge visible obligatorio estilo cápsula */}
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200/70 bg-gradient-to-b from-white via-indigo-50/70 to-slate-50/60 px-2.5 py-0.5 text-xs font-semibold text-indigo-950 shadow-[0_1px_4px_rgba(99,102,241,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)]">
            {modulo.badge}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            {modulo.subtitulo}
          </span>
          <h3 className="mt-0.5 text-base font-bold text-slate-900 group-hover:text-indigo-900 transition">
            {modulo.titulo}
          </h3>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          {modulo.descripcion}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-indigo-100/60">
        <span
          className={`inline-flex w-full items-center justify-between rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-2xs ${
            !isAuthenticated
              ? "bg-slate-800 text-white shadow-xs group-hover:bg-slate-900"
              : tienePermiso
              ? "border border-indigo-600 bg-gradient-to-b from-white to-indigo-50 text-indigo-900 group-hover:bg-indigo-700 group-hover:text-white"
              : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}
        >
          <span>{ctaTexto}</span>
          {!isAuthenticated ? (
            <Shield className="h-3.5 w-3.5 opacity-90" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          )}
        </span>
      </div>
    </Link>
  );
}
