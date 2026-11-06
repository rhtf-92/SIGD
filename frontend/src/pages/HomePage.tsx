import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Send,
  Search,
  ShieldCheck,
  UserCheck,
  Inbox,
  Clock,
  GraduationCap,
  FileSpreadsheet,
  BarChart3,
  Settings,
  ArrowRight,
  Globe,
  Building2,
  LogIn,
  LogOut,
  Mail,
  Layers,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";

interface ServicioPublicoItem {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  ruta: string;
  icono: React.ReactNode;
}

interface ServicioInternoItem {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  ruta: string;
  icono: React.ReactNode;
}

const serviciosPublicos: ServicioPublicoItem[] = [
  {
    titulo: "Mesa de Partes Virtual",
    subtitulo: "Trámite Digital",
    descripcion:
      "Presentación y radicación virtual de documentos y solicitudes con emisión de cargo digital.",
    ruta: "/tramite/mesa-partes-virtual",
    icono: <Send className="h-6 w-6 text-emerald-600" />,
  },
  {
    titulo: "Consulta Pública y Seguimiento CUT",
    subtitulo: "Seguimiento CUT",
    descripcion:
      "Consulta del estado situacional e historial de expedientes institucionales mediante el Código Único de Trámite.",
    ruta: "/consulta",
    icono: <Search className="h-6 w-6 text-blue-600" />,
  },
  {
    titulo: "Validador Público CVD / QR",
    subtitulo: "Verificación Oficial",
    descripcion:
      "Comprobación de autenticidad e integridad de resoluciones y documentos institucionales firmados digitalmente.",
    ruta: "/validador-cvd",
    icono: <ShieldCheck className="h-6 w-6 text-teal-600" />,
  },
  {
    titulo: "Registro de Administrados",
    subtitulo: "Empadronamiento",
    descripcion:
      "Registro de personas naturales y jurídicas para la gestión de trámites y notificaciones electrónicas.",
    ruta: "/registro",
    icono: <UserCheck className="h-6 w-6 text-indigo-600" />,
  },
];

const serviciosInternos: ServicioInternoItem[] = [
  {
    titulo: "Flujo y Validez Legal",
    subtitulo: "Firma Digital",
    descripcion:
      "Firma digital y certificación de autenticidad de resoluciones y documentos institucionales.",
    ruta: "/flujo-validez-legal",
    icono: <ShieldCheck className="h-6 w-6 text-blue-700" />,
  },
  {
    titulo: "Bandeja de Expedientes",
    subtitulo: "Gestión Documental",
    descripcion:
      "Gestión y despacho diario de expedientes, derivaciones entre áreas y control de plazos de atención.",
    ruta: "/expedientes",
    icono: <Inbox className="h-6 w-6 text-blue-600" />,
  },
  {
    titulo: "Ventanilla Presencial",
    subtitulo: "Atención Presencial",
    descripcion:
      "Recepción presencial de documentos en mesa de partes física con emisión de constancia de cargo.",
    ruta: "/tramite/ventanilla-presencial",
    icono: <Clock className="h-6 w-6 text-amber-600" />,
  },
  {
    titulo: "Workflow Académico de Titulación",
    subtitulo: "Gestión Académica",
    descripcion:
      "Revisión, dictamen colegiado y aprobación de expedientes de titulación profesional técnica.",
    ruta: "/flujos/titulacion",
    icono: <GraduationCap className="h-6 w-6 text-violet-600" />,
  },
  {
    titulo: "Proyector de Resoluciones",
    subtitulo: "Despacho Directoral",
    descripcion:
      "Redacción estandarizada y emisión oficial de proyectos de Resoluciones Directorales.",
    ruta: "/flujos/proyector-resoluciones",
    icono: <FileSpreadsheet className="h-6 w-6 text-rose-600" />,
  },
  {
    titulo: "Tablero Ejecutivo MGD",
    subtitulo: "Analítica Institucional",
    descripcion:
      "Métricas de gestión documental, tiempos promedio de atención y analítica institucional.",
    ruta: "/reportes",
    icono: <BarChart3 className="h-6 w-6 text-purple-600" />,
  },
  {
    titulo: "Administración Institucional",
    subtitulo: "Seguridad y Roles",
    descripcion:
      "Gestión de usuarios institucionales, organigrama, asignación de roles y políticas de seguridad.",
    ruta: "/administracion",
    icono: <Settings className="h-6 w-6 text-slate-700" />,
  },
];

type TabFiltro = "TODOS" | "INTERNOS" | "PUBLICOS";

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, usuario, logout } = useAuthStore();
  const [tabActiva, setTabActiva] = useState<TabFiltro>("TODOS");

  const rolUsuario = usuario?.rol ?? "";
  const puedeVerExpedientes = ["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"].includes(
    rolUsuario
  );

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex-1 w-full flex flex-col items-center px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8 sm:py-12 bg-slate-50 text-slate-900">
      {/* =========================================================================
          HERO BANNER INSTITUCIONAL
          ========================================================================= */}
      <section className="w-full text-center space-y-3 sm:space-y-4 max-w-5xl mx-auto mb-8 sm:mb-12 xl:mb-16">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100/80 px-3.5 py-1 text-xs font-bold text-blue-800 border border-blue-200">
          <span>IESTP &quot;Suiza&quot;</span>
          <span className="text-blue-400">•</span>
          <span>Pucallpa, Ucayali</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900">
          Sistema Integral de Gestión Documentaria
        </h1>

        <p className="text-base sm:text-lg xl:text-xl font-medium text-slate-600 max-w-3xl xl:max-w-4xl mx-auto">
          Plataforma oficial de digitalización, tramitación y notificación electrónica del IESTP &quot;Suiza&quot;.
        </p>

        {/* Barra de estado rápido */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-4 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 shadow-2xs">
          <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Servicios Operativos
          </span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-slate-500">
            Horario de Corte: <strong className="text-slate-800">16:30 hrs</strong>
          </span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-blue-700 font-bold">Cero Papel • F. 1 a N</span>
        </div>
      </section>

      {/* =========================================================================
          PANEL DE BIENVENIDA INSTITUCIONAL (SOLO USUARIOS AUTENTICADOS)
          ========================================================================= */}
      {isAuthenticated && usuario && (
        <section
          aria-label="Panel de bienvenida institucional"
          className="w-full mb-8 sm:mb-10 rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 p-6 sm:p-8 xl:p-10 2xl:p-12 text-white shadow-lg border border-blue-700/50"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-900 font-black text-2xl shadow-md border-2 border-blue-200">
                {usuario.nombreCompleto ? usuario.nombreCompleto[0].toUpperCase() : "U"}
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  ¡Bienvenido(a), {usuario.nombreCompleto || usuario.usuario}!
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-blue-100/90 mt-1">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <span className="text-blue-300">Rol:</span>
                    <span className="rounded bg-white/15 px-2 py-0.5 font-bold text-white uppercase tracking-wider text-[11px]">
                      {usuario.rol}
                    </span>
                  </span>
                  <span>•</span>
                  <span>{usuario.correo}</span>
                  {usuario.numeroDocumento && (
                    <>
                      <span>•</span>
                      <span>Doc: {usuario.numeroDocumento}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto pt-2 md:pt-0 border-t md:border-t-0 border-blue-700/60">
              {puedeVerExpedientes ? (
                <Link
                  to="/expedientes"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50 px-4 py-2 text-xs font-bold shadow-sm transition"
                >
                  <Inbox className="h-4 w-4 text-blue-700" />
                  <span>Ir a mi Bandeja</span>
                </Link>
              ) : (
                <Link
                  to="/casilla"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50 px-4 py-2 text-xs font-bold shadow-sm transition"
                >
                  <Mail className="h-4 w-4 text-blue-700" />
                  <span>Mi Casilla Electrónica</span>
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white border border-white/20 px-3 py-2 text-xs font-semibold transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          SELECTOR DE FILTROS POR CATEGORÍA (SOLO AUTENTICADOS)
          ========================================================================= */}
      {isAuthenticated && (
        <div className="w-full mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-700" />
            <span className="text-sm font-bold text-slate-800">Catálogo de Módulos</span>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTabActiva("TODOS")}
              className={`rounded-lg px-3 py-1 transition ${
                tabActiva === "TODOS"
                  ? "bg-white text-blue-900 font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({serviciosInternos.length + serviciosPublicos.length})
            </button>
            <button
              type="button"
              onClick={() => setTabActiva("INTERNOS")}
              className={`rounded-lg px-3 py-1 transition ${
                tabActiva === "INTERNOS"
                  ? "bg-white text-blue-900 font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Gestión Interna ({serviciosInternos.length})
            </button>
            <button
              type="button"
              onClick={() => setTabActiva("PUBLICOS")}
              className={`rounded-lg px-3 py-1 transition ${
                tabActiva === "PUBLICOS"
                  ? "bg-white text-blue-900 font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Servicios Públicos ({serviciosPublicos.length})
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECCIÓN 1: SERVICIOS PÚBLICOS A LA CIUDADANÍA
          ========================================================================= */}
      {(!isAuthenticated || tabActiva === "TODOS" || tabActiva === "PUBLICOS") && (
        <section
          className="w-full mb-10 sm:mb-14 xl:mb-16"
          aria-labelledby="seccion-publica-titulo"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <Globe className="h-4 w-4" />
                </span>
                <h2
                  id="seccion-publica-titulo"
                  className="text-xl sm:text-2xl font-black tracking-tight text-slate-900"
                >
                  Servicios Públicos a la Ciudadanía
                </h2>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                Canales digitales de atención y consulta para administrados, estudiantes y público en general.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 xl:gap-6 2xl:gap-8">
            {serviciosPublicos.map((seccion) => (
              <Link
                key={seccion.ruta}
                to={seccion.ruta}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs transition duration-200 ease-out hover:border-blue-400 hover:shadow-md motion-safe:hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-blue-100/60 transition">
                      {seccion.icono}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-800 transition">
                    {seccion.titulo}
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 line-clamp-3">
                    {seccion.descripcion}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-700 group-hover:text-blue-800">
                  <span>Ingresar al servicio</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          SECCIÓN 2: SERVICIOS INTERNOS Y DE GESTIÓN INSTITUCIONAL
          SOLO SE RENDERIZA SI EL USUARIO HA INICIADO SESIÓN (isAuthenticated === true)
          ========================================================================= */}
      {isAuthenticated && (tabActiva === "TODOS" || tabActiva === "INTERNOS") && (
        <section
          className="w-full mb-10 sm:mb-14 xl:mb-16"
          aria-labelledby="seccion-interna-titulo"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                  <Building2 className="h-4 w-4" />
                </span>
                <h2
                  id="seccion-interna-titulo"
                  className="text-xl sm:text-2xl font-black tracking-tight text-slate-900"
                >
                  Servicios Internos y de Gestión Institucional
                </h2>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                Módulos de gestión, trámite y despacho para el personal institucional del IESTP &quot;Suiza&quot;.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 xl:gap-6 2xl:gap-8">
            {serviciosInternos.map((seccion) => (
              <Link
                key={seccion.ruta}
                to={seccion.ruta}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs transition duration-200 ease-out hover:border-blue-400 hover:shadow-md motion-safe:hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-blue-100/60 transition">
                      {seccion.icono}
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-900 transition">
                    {seccion.titulo}
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 line-clamp-3">
                    {seccion.descripcion}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className="text-blue-700 group-hover:text-blue-900">
                    Ingresar al módulo
                  </span>
                  <ArrowRight className="h-4 w-4 text-blue-700 transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          BANNER INSTITUCIONAL DE ACCESO PARA PERSONAL (SOLO USUARIOS NO AUTENTICADOS)
          ========================================================================= */}
      {!isAuthenticated && (
        <section
          aria-label="Acceso para funcionarios y personal institucional"
          className="w-full rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-8 xl:p-10 2xl:p-12 text-white shadow-md border border-slate-800"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  ¿Es personal institucional del IESTP &quot;Suiza&quot;?
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl">
                  Inicie sesión para acceder a la bandeja de expedientes, emisión de resoluciones y despacho institucional.
                </p>
              </div>
            </div>

            <Link
              to="/login"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 text-sm font-bold shadow-sm transition"
            >
              <LogIn className="h-4 w-4" />
              <span>Iniciar Sesión en el Sistema</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
