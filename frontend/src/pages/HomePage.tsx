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
    <main className="flex min-h-screen flex-col items-center bg-slate-50 px-3.5 py-8 text-slate-900 sm:px-6 sm:py-10 lg:px-8">
      {/* 1. Encabezado Institucional Principal */}
      <header className="max-w-3xl text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3.5 py-1 text-xs font-bold text-blue-800 shadow-xs">
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
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-xs text-blue-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Sesión activa: <strong className="font-semibold">{usuario.nombreCompleto}</strong> (
              <span className="font-mono font-bold text-blue-800">{usuario.rol}</span>)
            </span>
          </div>
        )}
      </header>

      {/* 2. Tres Bloques Segmentados de Navegación */}
      <div className="mt-12 w-full max-w-6xl space-y-12">
        {/* BLOQUE A: Servicios Públicos */}
        <section aria-labelledby="bloque-publico-titulo" className="space-y-4">
          <div className="flex flex-col gap-1 border-b border-emerald-200/90 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300">
                <Globe className="h-3.5 w-3.5" />
                Servicios Públicos
              </div>
              <h2
                id="bloque-publico-titulo"
                className="mt-1.5 text-xl font-extrabold text-slate-900 sm:text-2xl"
              >
                Servicios Públicos y Consulta Ciudadana
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm">
                Acceso libre y abierto sin requerir autenticación ni credenciales previas.
              </p>
            </div>
            <span className="self-start rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 sm:self-auto">
              5 servicios disponibles
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS_HOME_PUBLICOS.map((modulo) => (
              <CardModuloPublico key={modulo.id} modulo={modulo} />
            ))}
          </div>
        </section>

        {/* BLOQUE B: Acceso con Cuenta Ciudadana */}
        <section aria-labelledby="bloque-ciudadano-titulo" className="space-y-4">
          <div className="flex flex-col gap-1 border-b border-blue-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-800 border border-blue-300">
                <User className="h-3.5 w-3.5" />
                Acceso con Cuenta Ciudadana
              </div>
              <h2
                id="bloque-ciudadano-titulo"
                className="mt-1.5 text-xl font-extrabold text-slate-900 sm:text-2xl"
              >
                Portal y Servicios del Administrado
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm">
                Radicación virtual de trámites 24/7, expedientes de autoría propia y casilla electrónica.
              </p>
            </div>
            <span className="self-start rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 sm:self-auto">
              3 servicios de administrado
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* BLOQUE C: Acceso Institucional por Rol */}
        <section aria-labelledby="bloque-institucional-titulo" className="space-y-4">
          <div className="flex flex-col gap-1 border-b border-slate-300 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-0.5 text-xs font-bold text-slate-800 border border-slate-300">
                <Building2 className="h-3.5 w-3.5" />
                Acceso Institucional por Rol
              </div>
              <h2
                id="bloque-institucional-titulo"
                className="mt-1.5 text-xl font-extrabold text-slate-900 sm:text-2xl"
              >
                Operación, Despacho y Gestión Interna
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm">
                Módulos de gestión documental restringidos para personal y directivos del IESTP Suiza.
              </p>
            </div>
            <span className="self-start rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 sm:self-auto">
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
 * Tarjeta de Servicio Público: estilo más ligero, amigable y abierto.
 */
function CardModuloPublico({ modulo }: { modulo: ModuloHomeItem }) {
  const Icono = ICONOS_POR_ID[modulo.id] || Globe;

  return (
    <Link
      to={modulo.ruta}
      className="group flex flex-col justify-between rounded-xl border border-emerald-200/90 bg-white p-4 sm:p-5 shadow-xs transition duration-200 ease-out hover:border-emerald-400 hover:shadow-md motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/70 group-hover:bg-emerald-100 transition">
            <Icono className="h-4 w-4" />
          </div>
          {/* Badge visible obligatorio */}
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            {modulo.badge}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            {modulo.subtitulo}
          </span>
          <h3 className="mt-0.5 text-base font-bold text-slate-900 group-hover:text-emerald-800 transition">
            {modulo.titulo}
          </h3>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          {modulo.descripcion}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100">
        <span className="inline-flex w-full items-center justify-between rounded-lg border border-emerald-600/30 bg-emerald-50/60 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition group-hover:border-emerald-600 group-hover:bg-emerald-600 group-hover:text-white">
          <span>{modulo.ctaPublico}</span>
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Tarjeta de Cuenta Ciudadana: estilo intermedio, profesional y orientado al administrado.
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
      className="group flex flex-col justify-between rounded-xl border border-blue-200 bg-white p-4 sm:p-5 shadow-xs transition duration-200 ease-out hover:border-blue-400 hover:shadow-md motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-200/70 group-hover:bg-blue-100 transition">
            <Icono className="h-4 w-4" />
          </div>
          {/* Badge visible obligatorio */}
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            {modulo.badge}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            {modulo.subtitulo}
          </span>
          <h3 className="mt-0.5 text-base font-bold text-slate-900 group-hover:text-blue-800 transition">
            {modulo.titulo}
          </h3>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          {modulo.descripcion}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100">
        <span
          className={`inline-flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            !isAuthenticated
              ? "bg-blue-600 text-white shadow-xs group-hover:bg-blue-700"
              : esCiudadano
              ? "border border-blue-600 bg-blue-50 text-blue-800 group-hover:bg-blue-600 group-hover:text-white"
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
 * Tarjeta de Módulo Institucional: estilo sobrio, corporativo y profesional.
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
      className="group flex flex-col justify-between rounded-xl border border-slate-300 bg-white p-4 sm:p-5 shadow-xs transition duration-200 ease-out hover:border-slate-500 hover:shadow-md motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-slate-200 transition">
            <Icono className="h-4 w-4" />
          </div>
          {/* Badge visible obligatorio */}
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
            {modulo.badge}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {modulo.subtitulo}
          </span>
          <h3 className="mt-0.5 text-base font-bold text-slate-900 group-hover:text-blue-900 transition">
            {modulo.titulo}
          </h3>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          {modulo.descripcion}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100">
        <span
          className={`inline-flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            !isAuthenticated
              ? "bg-slate-800 text-white shadow-xs group-hover:bg-slate-900"
              : tienePermiso
              ? "border border-slate-700 bg-slate-50 text-slate-800 group-hover:bg-slate-800 group-hover:text-white"
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
