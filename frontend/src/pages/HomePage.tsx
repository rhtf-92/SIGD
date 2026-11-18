import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PROCEDIMIENTOS_TUPA_2026 } from "../data/tupaPasco2026";

interface SeccionModulo {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  ruta: string;
  topBarGradient: string;
  badgeClasses: string;
  dotClasses: string;
  actionBtnClasses: string;
  illustrationBg: string;
  illustration: React.ReactNode;
}

type CategoriaBusqueda = "Módulo" | "Trámite TUPA" | "Acción Rápida";

interface ItemBusquedaGlobal {
  id: string;
  titulo: string;
  codigo: string;
  descripcion: string;
  categoria: CategoriaBusqueda;
  ruta: string;
  icono: string;
}

const secciones: SeccionModulo[] = [
  {
    titulo: "Flujo y Validez Legal",
    subtitulo: "MOD-04 / FIRMA DIGITAL",
    descripcion:
      "Tramitación con plena validez legal: firma digital, re-firma, workflow académico y verificación pública de documentos (CVD).",
    ruta: "/flujo-validez-legal",
    topBarGradient: "bg-gradient-to-r from-indigo-500 to-purple-500 h-[3px]",
    badgeClasses: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    dotClasses: "bg-indigo-600",
    actionBtnClasses: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30",
    illustrationBg: "from-indigo-50 via-purple-50 to-blue-100 border-indigo-200/60",
    illustration: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="8" width="34" height="46" rx="6" fill="url(#docGrad1)" stroke="#4F46E5" strokeWidth="2" />
        <path d="M20 20H38M20 27H38M20 34H30" stroke="#4338CA" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 44C23 41 26 45 29 42C32 39 34 43 38 41" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="44" cy="44" r="11" fill="#4F46E5" />
        <path d="M39.5 44L42.5 47L48.5 41" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="docGrad1" x1="12" y1="8" x2="46" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#EEF2FF" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    titulo: "Casilla Electrónica",
    subtitulo: "MOD-05 / NOTIFICACIÓN (ENT-M01-03)",
    descripcion:
      "Consulta y recepción de notificaciones electrónicas institucionales con plena validez legal y acuse automático.",
    ruta: "/casilla",
    topBarGradient: "bg-gradient-to-r from-cyan-400 to-blue-500 h-[3px]",
    badgeClasses: "bg-cyan-50 text-cyan-800 border-cyan-200/80",
    dotClasses: "bg-cyan-500",
    actionBtnClasses: "bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/30",
    illustrationBg: "from-cyan-50 via-sky-50 to-blue-100 border-cyan-200/60",
    illustration: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="16" width="44" height="34" rx="7" fill="url(#mailGrad)" stroke="#0891B2" strokeWidth="2" />
        <path d="M10 20L30 34L50 20" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="48" cy="18" r="9" fill="#10B981" stroke="white" strokeWidth="2" />
        <path d="M44.5 18L47 20.5L51.5 15.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="mailGrad" x1="8" y1="16" x2="52" y2="50" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#E0F2FE" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    titulo: "Mesa de Partes Virtual",
    subtitulo: "MOD-03 / TUPA (ENT-M02)",
    descripcion:
      "Presentación y radicación de trámites digitales, requisitos TUPA y anexos documentales las 24 horas.",
    ruta: "/tramite",
    topBarGradient: "bg-gradient-to-r from-emerald-400 to-teal-500 h-[3px]",
    badgeClasses: "bg-teal-50 text-teal-800 border-teal-200/80",
    dotClasses: "bg-teal-500",
    actionBtnClasses: "bg-teal-500 hover:bg-teal-600 shadow-teal-500/30",
    illustrationBg: "from-teal-50 via-emerald-50 to-cyan-100 border-teal-200/60",
    illustration: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 24L32 11L54 24H10Z" fill="#0D9488" />
        <rect x="14" y="24" width="36" height="26" fill="white" stroke="#0D9488" strokeWidth="2" />
        <path d="M22 24V50M32 24V50M42 24V50" stroke="#0F766E" strokeWidth="2.5" />
        <rect x="8" y="50" width="48" height="5" rx="2" fill="#0F766E" />
        <circle cx="48" cy="44" r="9" fill="#10B981" />
        <path d="M48 40V48M44 44H52" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    titulo: "Registro Ciudadano",
    subtitulo: "ENT-M01-01 / ENT-M01-02",
    descripcion:
      "Registro de personas naturales y jurídicas con validación RENIEC / SUNAT y Ubigeo Ucayali.",
    ruta: "/registro",
    topBarGradient: "bg-gradient-to-r from-blue-500 to-sky-500 h-[3px]",
    badgeClasses: "bg-blue-50 text-blue-700 border-blue-200/80",
    dotClasses: "bg-blue-600",
    actionBtnClasses: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30",
    illustrationBg: "from-blue-50 via-sky-50 to-indigo-100 border-blue-200/60",
    illustration: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="14" width="48" height="36" rx="6" fill="url(#idCardGrad)" stroke="#2563EB" strokeWidth="2" />
        <circle cx="23" cy="29" r="6" fill="#93C5FD" stroke="#1D4ED8" strokeWidth="2" />
        <path d="M14 43C14 38.5817 18.0294 35 23 35C27.9706 35 32 38.5817 32 43" stroke="#1D4ED8" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M36 25H48M36 32H48M36 39H43" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="49" cy="43" r="8" fill="#2563EB" />
        <path d="M45.5 43L48 45.5L52.5 40.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="idCardGrad" x1="8" y1="14" x2="56" y2="50" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#DBEAFE" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    titulo: "Bandeja de Expedientes",
    subtitulo: "MOD-02 / EXPEDIENTES (ENT-M05)",
    descripcion:
      "Gestiona y consulta el estado, trazabilidad, providencias y foliado de expedientes institucionales.",
    ruta: "/expedientes",
    topBarGradient: "bg-gradient-to-r from-green-400 to-emerald-600 h-[3px]",
    badgeClasses: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dotClasses: "bg-emerald-600",
    actionBtnClasses: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30",
    illustrationBg: "from-emerald-50 via-green-50 to-teal-100 border-emerald-200/60",
    illustration: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 20C8 17.7909 9.79086 16 12 16H25L30 21H52C54.2091 21 56 22.7909 56 25V48C56 50.2091 54.2091 52 52 52H12C9.79086 52 8 50.2091 8 48V20Z" fill="url(#folderGrad)" stroke="#059669" strokeWidth="2" />
        <rect x="16" y="28" width="32" height="16" rx="3" fill="white" stroke="#10B981" strokeWidth="1.5" />
        <path d="M22 34H38M22 39H32" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
        <defs>
          <linearGradient id="folderGrad" x1="8" y1="16" x2="56" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A7F3D0" />
            <stop offset="1" stopColor="#34D399" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    titulo: "Validador CVD",
    subtitulo: "MOD-01 / VERIFICACIÓN",
    descripcion:
      "Valida la autenticidad e integridad de documentos firmados digitalmente mediante el Código de Verificación de Documentos.",
    ruta: "/validador-cvd",
    topBarGradient: "bg-gradient-to-r from-amber-400 to-orange-500 h-[3px]",
    badgeClasses: "bg-amber-50 text-amber-800 border-amber-200/80",
    dotClasses: "bg-amber-500",
    actionBtnClasses: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/30",
    illustrationBg: "from-amber-50 via-orange-50 to-yellow-100 border-amber-200/60",
    illustration: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 8L52 16V31C52 44.5 43.2 54.6 32 58C20.8 54.6 12 44.5 12 31V16L32 8Z" fill="url(#shieldGrad)" stroke="#D97706" strokeWidth="2" />
        <path d="M24 32L29.5 37.5L41 26" stroke="#B45309" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="shieldGrad" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FEF3C7" />
            <stop offset="1" stopColor="#FCD34D" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    titulo: "Panel de Administración",
    subtitulo: "ENT-M05-01 / RBAC",
    descripcion:
      "Gestión de usuarios, roles, permisos, auditoría, tablas maestras y calendario laboral.",
    ruta: "/administracion",
    topBarGradient: "bg-gradient-to-r from-rose-500 to-red-600 h-[3px]",
    badgeClasses: "bg-rose-50 text-rose-800 border-rose-200/80",
    dotClasses: "bg-rose-600",
    actionBtnClasses: "bg-rose-600 hover:bg-rose-700 shadow-rose-500/30",
    illustrationBg: "from-rose-50 via-red-50 to-pink-100 border-rose-200/60",
    illustration: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 10L50 17V30C50 42.5 42.2 52 32 55C21.8 52 14 42.5 14 30V17L32 10Z" fill="url(#rbacGrad)" stroke="#E11D48" strokeWidth="2" />
        <circle cx="32" cy="31" r="7" fill="white" stroke="#BE123C" strokeWidth="2.5" />
        <path d="M32 20V23M32 39V42M21 31H24M40 31H43M24.5 23.5L26.5 25.5M37.5 36.5L39.5 38.5M39.5 23.5L37.5 25.5M26.5 36.5L24.5 38.5" stroke="#BE123C" strokeWidth="2.2" strokeLinecap="round" />
        <defs>
          <linearGradient id="rbacGrad" x1="14" y1="10" x2="50" y2="55" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFE4E6" />
            <stop offset="1" stopColor="#FDA4AF" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    titulo: "Iniciar Sesión",
    subtitulo: "ACCESO INSTITUCIONAL",
    descripcion:
      "Ingreso al sistema SIGD con credenciales y verificación de perfil asignado.",
    ruta: "/login",
    topBarGradient: "bg-gradient-to-r from-slate-600 to-blue-800 h-[3px]",
    badgeClasses: "bg-slate-100 text-slate-800 border-slate-300/80",
    dotClasses: "bg-slate-700",
    actionBtnClasses: "bg-slate-700 hover:bg-slate-800 shadow-slate-500/30",
    illustrationBg: "from-slate-100 via-blue-50 to-slate-200 border-slate-300/60",
    illustration: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="26" width="32" height="26" rx="6" fill="url(#lockGrad)" stroke="#1E3A8A" strokeWidth="2" />
        <path d="M23 26V19C23 14.0294 27.0294 10 32 10C36.9706 10 41 14.0294 41 19V26" stroke="#1E40AF" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="37" r="3.5" fill="#1E3A8A" />
        <path d="M32 40.5V45" stroke="#1E3A8A" strokeWidth="2.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="lockGrad" x1="16" y1="26" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#DBEAFE" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    titulo: "Reportes y Tableros de Control",
    subtitulo: "06_REPORTES-TABLERO-CONTROL",
    descripcion:
      "Consulta indicadores ejecutivos, tendencias, distribución de carga procesal y tiempos de respuesta.",
    ruta: "/reportes/dashboard",
    topBarGradient: "bg-gradient-to-r from-purple-500 to-pink-500 h-[3px]",
    badgeClasses: "bg-purple-50 text-purple-800 border-purple-200/80",
    dotClasses: "bg-purple-600",
    actionBtnClasses: "bg-purple-600 hover:bg-purple-700 shadow-purple-500/30",
    illustrationBg: "from-purple-50 via-fuchsia-50 to-pink-100 border-purple-200/60",
    illustration: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="12" width="44" height="40" rx="6" fill="url(#chartGrad)" stroke="#9333EA" strokeWidth="2" />
        <rect x="18" y="34" width="6" height="11" rx="2" fill="#A855F7" />
        <rect x="29" y="26" width="6" height="19" rx="2" fill="#9333EA" />
        <rect x="40" y="19" width="6" height="26" rx="2" fill="#DB2777" />
        <path d="M18 27L28 21L42 15" stroke="#7E22CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="chartGrad" x1="10" y1="12" x2="54" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#FAE8FF" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
];

// ============================================================================
// ÍNDICE UNIFICADO DE BÚSQUEDA GLOBAL (MÓDULOS + TUPA 2026 + ACCIONES RÁPIDAS)
// ============================================================================
const INDICE_BUSQUEDA_GLOBAL: readonly ItemBusquedaGlobal[] = [
  ...secciones.map((s, idx): ItemBusquedaGlobal => ({
    id: `mod-${idx}`,
    titulo: s.titulo,
    codigo: s.subtitulo,
    descripcion: s.descripcion,
    categoria: "Módulo",
    ruta: s.ruta,
    icono: "🧩",
  })),
  ...PROCEDIMIENTOS_TUPA_2026.map((p): ItemBusquedaGlobal => ({
    id: `tupa-${p.codigo}`,
    titulo: p.nombre,
    codigo: `TUPA-${p.codigo}`,
    descripcion: `${p.dependencia ?? "Secretaría Académica"} • Derecho: ${p.derechoPago ?? "Consultar"} • Plazo: ${p.tiempoMaximo ?? "Ley 27444"}`,
    categoria: "Trámite TUPA",
    ruta: `/tramite?tupa=TUPA-${p.codigo}`,
    icono: "📄",
  })),
  {
    id: "acc-cvd",
    titulo: "Verificar documento con CVD",
    codigo: "ACCIÓN DIRECTA • D.S. 070-2013-PCM",
    descripcion: "Comprobar validez legal, firma digital y sello de tiempo mediante Código CVD o código QR.",
    categoria: "Acción Rápida",
    ruta: "/validador-cvd",
    icono: "🛡️",
  },
  {
    id: "acc-cut",
    titulo: "Seguimiento de Trámite por CUT",
    codigo: "ACCIÓN DIRECTA • CONSULTA PÚBLICA",
    descripcion: "Rastrear el estado actual de un expediente mediante su Código Único de Trámite.",
    categoria: "Acción Rápida",
    ruta: "/consulta",
    icono: "🔎",
  },
  {
    id: "acc-mpv",
    titulo: "Radicar Nuevo Trámite en Mesa de Partes",
    codigo: "ACCIÓN DIRECTA • ASISTENTE 4 PASOS",
    descripcion: "Iniciar registro documentario virtual con generación inmediata de cargo digital y QR.",
    categoria: "Acción Rápida",
    ruta: "/tramite",
    icono: "🏛️",
  },
  {
    id: "acc-casilla",
    titulo: "Consultar Casilla Electrónica",
    codigo: "ACCIÓN DIRECTA • LEY N° 27444",
    descripcion: "Revisar cédulas de notificación, resoluciones directorales y emitir acuse de recibo.",
    categoria: "Acción Rápida",
    ruta: "/casilla",
    icono: "📬",
  },
  {
    id: "acc-login",
    titulo: "Iniciar Sesión Institucional",
    codigo: "ACCIÓN DIRECTA • AUTENTICACIÓN",
    descripcion: "Ingresar con credenciales de personal administrativo, docente o estudiante.",
    categoria: "Acción Rápida",
    ruta: "/login",
    icono: "🔐",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState("");
  const [panelAbierto, setPanelAbierto] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Atajo global Ctrl+K / Cmd+K para abrir y Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setPanelAbierto(true);
      } else if (e.key === "Escape") {
        setPanelAbierto(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cierre automático al hacer clic fuera del buscador
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setPanelAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtrado del índice global agrupado por categoría
  const resultadosAgrupados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = !q
      ? [
          ...INDICE_BUSQUEDA_GLOBAL.filter((i) => i.categoria === "Módulo").slice(0, 4),
          ...INDICE_BUSQUEDA_GLOBAL.filter((i) => i.categoria === "Trámite TUPA").slice(0, 5),
          ...INDICE_BUSQUEDA_GLOBAL.filter((i) => i.categoria === "Acción Rápida"),
        ]
      : INDICE_BUSQUEDA_GLOBAL.filter(
          (item) =>
            item.titulo.toLowerCase().includes(q) ||
            item.codigo.toLowerCase().includes(q) ||
            item.descripcion.toLowerCase().includes(q),
        );

    return {
      modulos: filtrados.filter((i) => i.categoria === "Módulo"),
      tramitesTupa: filtrados.filter((i) => i.categoria === "Trámite TUPA"),
      accionesRapidas: filtrados.filter((i) => i.categoria === "Acción Rápida"),
      total: filtrados.length,
    };
  }, [busqueda]);

  const tarjetasVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return secciones;
    const coincidenciasDirectas = secciones.filter(
      (s) =>
        s.titulo.toLowerCase().includes(q) ||
        s.subtitulo.toLowerCase().includes(q) ||
        s.descripcion.toLowerCase().includes(q),
    );
    return coincidenciasDirectas.length > 0 ? coincidenciasDirectas : secciones;
  }, [busqueda]);

  const handleSeleccionarResultado = (item: ItemBusquedaGlobal) => {
    setBusqueda("");
    setPanelAbierto(false);
    navigate(item.ruta);
  };

  const renderGrupoResultados = (
    tituloGrupo: string,
    items: readonly ItemBusquedaGlobal[],
    badgeColor: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="py-2 first:pt-1 last:pb-1">
        <div className="px-3 pb-1.5 text-[10px] font-extrabold tracking-widest uppercase text-cyan-300/80 flex items-center justify-between">
          <span>{tituloGrupo}</span>
          <span className="font-mono text-[10px] text-slate-400">{items.length}</span>
        </div>
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSeleccionarResultado(item)}
              className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-cyan-500/15 hover:border-cyan-400/40 border border-transparent transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3 min-w-0 pr-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-base shadow-inner">
                  {item.icono}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors truncate">
                    {item.titulo}
                  </p>
                  <p className="text-[11px] text-cyan-200/80 font-mono truncate">
                    {item.codigo} <span className="font-sans text-slate-300/80">— {item.descripcion}</span>
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}
                >
                  {item.categoria}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-mono font-bold text-cyan-300 group-hover:bg-cyan-400 group-hover:text-slate-950 transition-colors">
                  ↵ Ir
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-slate-800 selection:bg-cyan-500 selection:text-white">
      {/* CAPA A: IMAGEN CON MOVIMIENTO DINÁMICO FLOTANTE (KEN BURNS SUAVE) */}
      <div
        className="fixed inset-0 pointer-events-none bg-cover bg-center bg-no-repeat animate-ambient-bg"
        style={{ backgroundImage: `url('/images/bg-sigd-expedientes.jpg')` }}
        aria-hidden="true"
      />

      {/* CAPA B: SUPERPOSICIÓN DE CONTRASTE Y GRADIENTE DE SEGURIDAD */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#001428]/80 via-slate-950/75 to-[#001428]/90 backdrop-blur-[1.5px]"
        aria-hidden="true"
      />

      {/* CAPA C: ONDAS LUMINOSAS DINÁMICAS QUE INTERACTÚAN CON LOS CIRCUITOS */}
      <div
        className="fixed -top-20 left-1/3 w-[500px] h-[350px] bg-cyan-400/20 rounded-full blur-3xl pointer-events-none animate-glow-circuit"
        aria-hidden="true"
      />
      <div
        className="fixed bottom-10 right-1/4 w-[450px] h-[450px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-glow-circuit [animation-delay:3.5s]"
        aria-hidden="true"
      />

      {/* CAPA DE CONTENIDO */}
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center pt-2">
        {/* 1. HERO CENTRAL */}
        <div className="text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-cyan-950/80 border border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.4)] mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>IESTP &quot;SUIZA&quot; — PUCALLPA</span>
          </div>

          <h1 className="text-6xl font-black text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] mb-2">
            SIGD
          </h1>

          <p className="text-xl font-bold text-white drop-shadow-xs">
            Sistema Integral de Gestión Documentaria
          </p>
          <p className="text-xs sm:text-sm text-cyan-100/90 font-medium tracking-wide mt-1">
            Trámites más ágiles &nbsp;•&nbsp; Documentos seguros &nbsp;•&nbsp; Una sola plataforma
          </p>
        </div>

        {/* 2. BUSCADOR GLOBAL INTEGRAL (COMMAND PALETTE) CON PANEL FLOTANTE */}
        <div
          ref={searchContainerRef}
          className="w-full max-w-2xl mx-auto my-7 relative group z-40"
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-300 z-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M16.65 10.825a5.825 5.825 0 11-11.65 0 5.825 5.825 0 0111.65 0z"
            />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            role="combobox"
            aria-expanded={panelAbierto}
            aria-controls="sigd-global-search-results"
            aria-autocomplete="list"
            value={busqueda}
            onFocus={() => setPanelAbierto(true)}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPanelAbierto(true);
            }}
            placeholder="Buscar trámite TUPA (ej. Certificado, Título), módulo o acción rápida..."
            aria-label="Buscador global de módulos, trámites TUPA 2026 y acciones rápidas"
            className="w-full pl-12 pr-28 py-3.5 rounded-full bg-blue-950/80 backdrop-blur-md border border-cyan-400/50 text-white placeholder:text-blue-200/60 text-sm shadow-[0_0_20px_rgba(6,182,212,0.25)] focus:shadow-[0_0_30px_rgba(6,182,212,0.45)] focus:border-cyan-300 focus:outline-hidden transition-all"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda("");
                  searchInputRef.current?.focus();
                }}
                aria-label="Limpiar término de búsqueda"
                className="text-xs font-bold text-cyan-300 hover:text-white px-1.5 py-0.5 cursor-pointer"
              >
                ✕
              </button>
            )}
            <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/20 text-[10px] text-blue-200 font-mono">
              Ctrl + K
            </span>
          </div>

          {/* PANEL FLOTANTE DE RESULTADOS EN CRISTAL ESMERILADO */}
          {panelAbierto && (
            <div
              id="sigd-global-search-results"
              role="listbox"
              className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-400/30 shadow-2xl shadow-slate-950/80 max-h-[380px] overflow-y-auto p-2 text-white divide-y divide-white/10"
            >
              {resultadosAgrupados.total === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-bold text-white">
                    No se encontraron trámites ni módulos con &lsquo;{busqueda}&rsquo;
                  </p>
                  <p className="mt-1 text-xs text-cyan-200/70">
                    Pruebe con términos como &ldquo;TUPA-01&rdquo;, &ldquo;Certificado&rdquo;, &ldquo;Título&rdquo;, &ldquo;Casilla&rdquo; o &ldquo;CVD&rdquo;.
                  </p>
                </div>
              ) : (
                <>
                  {renderGrupoResultados(
                    "MÓDULOS DEL SISTEMA",
                    resultadosAgrupados.modulos,
                    "bg-indigo-500/20 text-indigo-200 border-indigo-400/30",
                  )}
                  {renderGrupoResultados(
                    "TRÁMITES TUPA 2026",
                    resultadosAgrupados.tramitesTupa,
                    "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
                  )}
                  {renderGrupoResultados(
                    "ACCIONES RÁPIDAS",
                    resultadosAgrupados.accionesRapidas,
                    "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 3. CÁPSULA UNIFICADA DE MICRO-INDICADORES */}
        <div className="w-full max-w-4xl mx-auto mb-10 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-white/15 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-xl">
          {/* Columna 1: Ventanilla */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-white">
                Ventanilla
              </p>
              <p className="text-[11px] text-cyan-100/85 flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>Abierta (Horario Hábil Ley 27444)</span>
              </p>
            </div>
          </div>

          {/* Columna 2: Seguridad */}
          <div className="flex items-center gap-3 px-2 md:border-x md:border-white/15 md:px-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-white">
                Seguridad
              </p>
              <p className="text-[11px] text-cyan-100/85 mt-0.5">
                Firmas Digitales PAdES / Validado CVD
              </p>
            </div>
          </div>

          {/* Columna 3: TUPA */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-white">
                TUPA
              </p>
              <p className="text-[11px] text-cyan-100/85 mt-0.5">
                Catálogo Oficial Suiza 2026 Vigente
              </p>
            </div>
          </div>
        </div>

        {/* 4. CUADRÍCULA COMPLETA DE LOS 9 MÓDULOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-7xl mx-auto">
          {tarjetasVisibles.map((seccion) => (
            <Link
              key={seccion.ruta}
              to={seccion.ruta}
              className="group relative rounded-3xl bg-white/95 backdrop-blur-xl p-6 sm:p-7 shadow-xl shadow-slate-950/20 border border-white/80 transition-all duration-200 hover:-translate-y-1.5 hover:shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              {/* BORDE SUPERIOR TEMÁTICO DE LUZ */}
              <div
                aria-hidden="true"
                className={`absolute top-0 inset-x-0 ${seccion.topBarGradient}`}
              />

              <div className="flex items-start gap-4">
                {/* LADO IZQUIERDO: ILUSTRACIÓN / ICONO TEMÁTICO DESTACADO */}
                <div
                  className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${seccion.illustrationBg} border shadow-inner transition-transform duration-300 group-hover:scale-105`}
                >
                  {seccion.illustration}
                </div>

                {/* LADO DERECHO: BADGE, TÍTULO Y RESUMEN FUNCIONAL */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${seccion.badgeClasses} mb-1.5`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${seccion.dotClasses}`} />
                    {seccion.subtitulo}
                  </span>

                  <h2 className="text-xl font-black text-slate-900 tracking-tight group-hover:text-blue-700 transition-colors">
                    {seccion.titulo}
                  </h2>

                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    {seccion.descripcion}
                  </p>
                </div>
              </div>

              {/* BOTÓN CIRCULAR INFERIOR DERECHO CON FLECHA */}
              <div className="mt-4 flex items-center justify-end">
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold shadow-md transition-transform duration-200 group-hover:translate-x-1 ${seccion.actionBtnClasses}`}
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* 5. FOOTER INSTITUCIONAL */}
        <footer className="w-full border-t border-white/10 py-6 px-4 mt-12 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-200/70 gap-4">
          <div className="flex items-center gap-2 font-bold text-white tracking-wider">
            <span>S</span> IESTP SUIZA
          </div>
          <div>
            IESTP &quot;SUIZA&quot; — Pucallpa | SIGD — Sistema Integral de Gestión Documentaria
          </div>
          <div className="italic text-cyan-300/80">
            — Tu trámite, en buenas manos —
          </div>
        </footer>
      </div>
    </div>
  );
}
