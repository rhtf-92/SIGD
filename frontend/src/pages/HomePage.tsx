import { useState } from "react";
import { Link } from "react-router-dom";
import LoginAdminModal from "../components/administracion/common/LoginAdminModal";
import {
  FileSignature,
  Mail,
  Inbox,
  UserCheck,
  FolderSearch,
  ShieldCheck,
  Sliders,
  Lock,
  BarChart3,
  ArrowRight,
  User,
  ExternalLink,
  Sparkles,
  MapPin,
  CheckCircle2,
  Building,
} from "lucide-react";

interface ServiceCard {
  id: string;
  titulo: string;
  descripcion: string;
  ruta: string;
  colorScheme: {
    bgGradient: string;
    cardBorder: string;
    iconBg: string;
    iconColor: string;
    glowShadow: string;
    tagColor: string;
  };
  icon: React.ComponentType<{ className?: string }>;
}

const servicios: ServiceCard[] = [
  {
    id: "firma-digital",
    titulo: "Firma Digital",
    descripcion:
      "Tramitación con plena validez legal: firma digital, re-firma, workflow académico y verificación pública de documentos.",
    ruta: "/flujo-validez-legal",
    colorScheme: {
      bgGradient: "from-cyan-400 via-sky-500 to-blue-700",
      cardBorder: "border-cyan-200/80 hover:border-cyan-100",
      iconBg: "bg-cyan-300/20 shadow-cyan-200/60",
      iconColor: "text-cyan-100",
      glowShadow: "hover:shadow-cyan-400/50",
      tagColor: "bg-cyan-200/20 text-cyan-100",
    },
    icon: FileSignature,
  },
  {
    id: "casilla-electronica",
    titulo: "Casilla Electrónica",
    descripcion:
      "Consulta y recepción de notificaciones electrónicas institucionales con plena validez y valor legal acreditado.",
    ruta: "/casilla",
    colorScheme: {
      bgGradient: "from-yellow-500 via-amber-500 to-orange-600",
      cardBorder: "border-amber-200/90 hover:border-yellow-100",
      iconBg: "bg-yellow-200/20 shadow-yellow-100/60",
      iconColor: "text-yellow-50",
      glowShadow: "hover:shadow-yellow-400/50",
      tagColor: "bg-yellow-100/20 text-yellow-50",
    },
    icon: Mail,
  },
  {
    id: "mesa-partes",
    titulo: "Mesa de Partes Virtual",
    descripcion:
      "Presentación y radicación de trámites digitales, requisitos TUPA y anexos documentales oficiales.",
    ruta: "/tramite",
    colorScheme: {
      bgGradient: "from-blue-600 via-blue-700 to-indigo-900",
      cardBorder: "border-blue-200/80 hover:border-sky-100",
      iconBg: "bg-blue-200/20 shadow-sky-100/60",
      iconColor: "text-sky-50",
      glowShadow: "hover:shadow-blue-400/50",
      tagColor: "bg-blue-100/20 text-sky-50",
    },
    icon: Inbox,
  },
  {
    id: "registro-ciudadano",
    titulo: "Registro Ciudadano",
    descripcion:
      "Registro de personas naturales y jurídicas con validación RENIEC / SUNAT y Ubigeo Ucayali.",
    ruta: "/registro",
    colorScheme: {
      bgGradient: "from-violet-600 via-purple-700 to-indigo-900",
      cardBorder: "border-violet-200/80 hover:border-purple-100",
      iconBg: "bg-purple-200/20 shadow-violet-100/60",
      iconColor: "text-violet-50",
      glowShadow: "hover:shadow-purple-400/50",
      tagColor: "bg-purple-100/20 text-violet-50",
    },
    icon: UserCheck,
  },
  {
    id: "bandeja-expedientes",
    titulo: "Bandeja de Expedientes",
    descripcion:
      "Gestiona y consulta el estado, trazabilidad, providencias, foliado y avance de expedientes.",
    ruta: "/expedientes",
    colorScheme: {
      bgGradient: "from-amber-500 via-orange-600 to-red-700",
      cardBorder: "border-orange-200/90 hover:border-amber-100",
      iconBg: "bg-orange-200/20 shadow-amber-100/60",
      iconColor: "text-amber-50",
      glowShadow: "hover:shadow-orange-400/50",
      tagColor: "bg-orange-100/20 text-amber-50",
    },
    icon: FolderSearch,
  },
  {
    id: "validador-cvd",
    titulo: "Validador CVD",
    descripcion:
      "Valida la autenticidad e integridad de documentos firmados digitalmente mediante Código de Verificación.",
    ruta: "/validador-cvd",
    colorScheme: {
      bgGradient: "from-teal-400 via-cyan-500 to-sky-700",
      cardBorder: "border-cyan-100/90 hover:border-white",
      iconBg: "bg-cyan-200/20 shadow-cyan-100/60",
      iconColor: "text-cyan-50",
      glowShadow: "hover:shadow-cyan-300/50",
      tagColor: "bg-cyan-100/20 text-cyan-50",
    },
    icon: ShieldCheck,
  },
  {
    id: "panel-administracion",
    titulo: "Panel de Administración",
    descripcion:
      "Gestión de usuarios, roles, permisos RBAC, auditoría forense, tablas maestras y calendario.",
    ruta: "/administracion",
    colorScheme: {
      bgGradient: "from-fuchsia-500 via-purple-700 to-violet-900",
      cardBorder: "border-fuchsia-200/80 hover:border-pink-100",
      iconBg: "bg-fuchsia-200/20 shadow-pink-100/60",
      iconColor: "text-fuchsia-50",
      glowShadow: "hover:shadow-fuchsia-400/50",
      tagColor: "bg-fuchsia-100/20 text-fuchsia-50",
    },
    icon: Sliders,
  },
  {
    id: "iniciar-sesion",
    titulo: "Iniciar Sesión",
    descripcion:
      "Ingreso al sistema SIGD con credenciales institucionales y verificación de perfil asignado.",
    ruta: "/login",
    colorScheme: {
      bgGradient: "from-rose-600 via-red-700 to-red-900",
      cardBorder: "border-rose-200/80 hover:border-red-100",
      iconBg: "bg-rose-200/20 shadow-red-100/60",
      iconColor: "text-rose-50",
      glowShadow: "hover:shadow-rose-400/50",
      tagColor: "bg-rose-100/20 text-rose-50",
    },
    icon: Lock,
  },
  {
    id: "reportes-tableros",
    titulo: "Reportes y Tableros de Control",
    descripcion:
      "Consulta indicadores ejecutivos, tendencias, distribución de expedientes y áreas con cuellos de botella.",
    ruta: "/reportes/dashboard",
    colorScheme: {
      bgGradient: "from-slate-900 via-blue-800 to-blue-600",
      cardBorder: "border-blue-200/80 hover:border-cyan-100",
      iconBg: "bg-blue-200/20 shadow-cyan-100/60",
      iconColor: "text-blue-50",
      glowShadow: "hover:shadow-blue-400/50",
      tagColor: "bg-blue-100/20 text-blue-50",
    },
    icon: BarChart3,
  },
];

export default function HomePage() {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-cyan-50 via-white to-sky-100 font-sans text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[-1]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(8,145,178,0.10) 1px, transparent 1px), repeating-linear-gradient(135deg, rgba(14,116,144,0.018) 0 1px, transparent 1px 4px)",
          backgroundSize: "24px 24px, auto",
        }}
      />
      {/* 1. Encabezado Superior */}
      <header className="sticky top-0 z-30 border-b border-cyan-100 bg-white/85 shadow-[0_8px_30px_rgba(8,145,178,0.10)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logotipo S y Marca */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur-xs opacity-75 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300 bg-slate-900 text-2xl font-extrabold text-cyan-100 shadow-[0_0_16px_rgba(6,182,212,0.25)]">
                S
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  SIGD <span className="font-extrabold text-cyan-700">SUIZA</span>
                </span>
                <span className="hidden items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-800 md:inline-flex">
                  <CheckCircle2 className="h-3 w-3 text-cyan-600" />
                  OFICIAL
                </span>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">
                IESTP &quot;Suiza&quot; • Pucallpa, Ucayali — Gestión Documentaria Digital
              </p>
            </div>
          </div>

          {/* Enlaces de Navegación y Perfil Administrador */}
          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="hidden items-center gap-5 text-sm font-medium text-slate-700 lg:flex">
              <Link
                to="/casilla"
                className="rounded-lg px-2 py-1 transition-colors hover:bg-cyan-50 hover:text-cyan-800"
              >
                Casilla Electrónica
              </Link>
              <Link
                to="/administracion"
                className="rounded-lg px-2 py-1 transition-colors hover:bg-cyan-50 hover:text-cyan-800"
              >
                Administración
              </Link>
            </nav>

            <button
              onClick={() => setShowImageModal(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 transition hover:border-amber-300/60 hover:bg-amber-50 hover:text-amber-800"
              title="Ver Render Fotográfico en Alta Resolución"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">Render</span> HD
            </button>

            {/* Perfil de Usuario Administrador */}
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700 shadow-xs">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:block text-left">
                <span className="block text-xs font-bold leading-tight text-slate-800">
                  Administrador
                </span>
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
                  Conectado
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Banner Ancho Institucional con Representación Arquitectónica */}
      <section className="relative overflow-hidden border-b border-cyan-200 bg-gradient-to-r from-cyan-100 via-sky-50 to-white text-slate-900 shadow-lg">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(8,145,178,0.12)_1px,transparent_1px)] opacity-50 [background-size:16px_16px]"></div>

        {/* Glow de fondo */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-cyan-300/25 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Información Izquierda / Arquitectura */}
            <div className="md:col-span-7 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/75 text-cyan-900 text-xs font-semibold backdrop-blur-xs border border-cyan-200">
                <Building className="w-3.5 h-3.5" />
                <span>Instituto de Educación Superior Tecnológico Público Suiza</span>
              </div>

              <div className="flex items-baseline gap-3">
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 drop-shadow-md">
                  SIGD
                </h1>
                <span className="text-sm sm:text-base text-slate-600 font-light border-l border-slate-300 pl-3">
                  Sistema Integral de Gestión Documentaria
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
                Plataforma digital gubernamental con soporte de notificación electrónica,
                firma digital reglamentada y trazabilidad con valor legal.
              </p>

              {/* El gran texto manuscrito: "Formación que transforma" */}
              <div className="pt-2">
                <p className="text-2xl sm:text-4xl text-cyan-800 font-serif italic tracking-wide drop-shadow-lg select-none">
                  &ldquo;Formación que transforma&rdquo;
                </p>
              </div>
            </div>

            {/* Representación Arquitectónica / Miniatura del Campus */}
            <div className="md:col-span-5 flex justify-center md:justify-end">
              <div
                onClick={() => setShowImageModal(true)}
                className="group relative cursor-pointer rounded-2xl overflow-hidden border border-cyan-200 shadow-2xl bg-white/70 max-w-sm transition-all duration-300 hover:scale-[1.02] hover:border-cyan-400"
              >
                <img
                  src="/portal_sigd_suiza.jpg"
                  alt="Render arquitectónico institucional SIGD SUIZA"
                  className="w-full h-44 sm:h-48 object-cover object-center brightness-95 group-hover:brightness-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex items-end p-3">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 drop-shadow">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Sede Institucional — Pucallpa
                    </span>
                    <span className="text-[10px] bg-blue-600/90 text-white font-semibold px-2 py-0.5 rounded-full">
                      Ampliación HD
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Foco Central: Cuadrícula 3x3 de Nueve Tarjetas de Servicio */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Servicios Digitales Institucionales
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Acceso directo a todos los módulos y ventanillas del ecosistema digital SIGD Suiza.
          </p>
        </div>

        {/* Cuadrícula 3x3 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicios.map((s) => {
            const IconComponent = s.icon;
            return (
              <div
                key={s.id}
                className={`group relative flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl border-2 bg-gradient-to-br ${s.colorScheme.bgGradient} p-6 text-white shadow-[0_16px_38px_rgba(15,23,42,0.22)] backdrop-blur-xl ${s.colorScheme.cardBorder} ${s.colorScheme.glowShadow} transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl`}
              >
                {/* Efecto de resplandor sutil de fondo */}
                <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/20 blur-2xl transition-transform duration-500 group-hover:scale-150"></div>
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_42%,rgba(255,255,255,0.04))]"></div>

                <div className="relative z-10">
                  {/* Icono Resplandeciente con efecto Vidrio / Neón */}
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`relative flex h-14 w-14 items-center justify-center rounded-xl border border-white/45 bg-white/20 shadow-lg backdrop-blur-md ${s.colorScheme.iconBg} transition-transform duration-300 group-hover:scale-110`}
                    >
                      <IconComponent
                        className={`h-7 w-7 ${s.colorScheme.iconColor} drop-shadow-[0_0_10px_currentColor]`}
                      />
                    </div>
                  </div>

                  {/* Título de Servicio (SIN CÓDIGO) */}
                  <h3 className="text-xl font-bold tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] transition-colors group-hover:text-white/95">
                    {s.titulo}
                  </h3>

                  {/* Breve Descripción */}
                  <p className="mt-2 text-xs font-normal leading-relaxed text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:text-sm">
                    {s.descripcion}
                  </p>
                </div>

{/* Botón Circular Azul de 'flecha' con texto "Ingresar" */}
                 <div className="relative z-10 mt-6 flex items-center justify-end border-t border-white/35 pt-4">
                   {s.id === "panel-administracion" ? (
                     <button
                       type="button"
                       onClick={() => setShowAdminLoginModal(true)}
                       className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-lg transition-all duration-200 group-hover:gap-2.5 hover:bg-cyan-50 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                     >
                       <span>Ingresar</span>
                       <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_12px_rgba(56,189,248,0.6)]">
                         <ArrowRight className="h-3.5 w-3.5 text-white transition-transform duration-200 group-hover:translate-x-0.5" />
                       </div>
                     </button>
                   ) : (
                     <Link
                       to={s.ruta}
                       className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-lg transition-all duration-200 group-hover:gap-2.5 hover:bg-cyan-50 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                     >
                       <span>Ingresar</span>
                       <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_12px_rgba(56,189,248,0.6)]">
                         <ArrowRight className="h-3.5 w-3.5 text-white transition-transform duration-200 group-hover:translate-x-0.5" />
                       </div>
                     </Link>
                   )}
                 </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 4. Barra Lateral de Referencia, Badges Institucionales y Pie de Página */}
      <footer className="mt-auto border-t border-cyan-100 bg-white/80 py-6 text-xs text-slate-600 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Info Institucional Izquierda */}
            <div className="flex items-center gap-3 text-center md:text-left">
              {/* Bandera de Perú SVG Oficial */}
              <div
                className="flex h-5.5 w-8 overflow-hidden rounded-sm border border-slate-300 shadow-xs"
                title="República del Perú"
              >
                <div className="w-1/3 bg-red-600 h-full"></div>
                <div className="w-1/3 bg-white h-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80"></div>
                </div>
                <div className="w-1/3 bg-red-600 h-full"></div>
              </div>

              <div>
                <p className="font-semibold text-slate-800">
                  IESTP Suiza • Dirección Regional de Educación de Ucayali
                </p>
                <p className="text-[11px] text-slate-500">
                  Gobierno Regional de Ucayali — República del Perú
                </p>
              </div>
            </div>

            {/* Ubicación Pucallpa & Versión */}
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <div className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                <MapPin className="h-3 w-3 text-cyan-700" />
                <span>Pucallpa, Coronel Portillo, Ucayali</span>
              </div>

              <div className="text-right text-[11px] text-slate-500">
                <span className="font-mono font-medium text-slate-700">
                  Versión 6.51.3.02.3 : D4
                </span>
                <span className="mx-2">•</span>
                <span>Plataforma Conforme a Ley 27269 / 27444</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal para Visualizar el Render / Fotografía en Alta Resolución */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-cyan-500/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm sm:text-base text-cyan-200">
                  Render Oficial de Alta Resolución — Portal SIGD SUIZA
                </h3>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded-md hover:bg-slate-800 transition cursor-pointer"
              >
                Cerrar ✕
              </button>
            </div>
            <div className="p-2 sm:p-4 bg-slate-950/50 flex justify-center">
              <img
                src="/portal_sigd_suiza.jpg"
                alt="Fotografía de alta resolución de la interfaz de portal digital SIGD SUIZA"
                className="max-h-[75vh] w-auto object-contain rounded-xl shadow-lg border border-slate-800"
              />
            </div>
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Resolución Nativa UI/UX • Estilo Futurista Neón / Vidrio Pulido</span>
              <a
                href="/portal_sigd_suiza.jpg"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                <span>Abrir en pestaña nueva</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ingreso al Panel de Administración */}
      {showAdminLoginModal && (
        <LoginAdminModal
          onClose={() => {
            setShowAdminLoginModal(false);
          }}
        />
      )}
    </div>
  );
}