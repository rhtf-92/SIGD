<<<<<<< Updated upstream
import {
=======
﻿import {
>>>>>>> Stashed changes
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  FileCheck2,
  FileSignature,
  FolderOpen,
  GraduationCap,
  Inbox,
  Landmark,
  LockKeyhole,
  LogIn,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  filtrarModulosPorRol,
  useSesion,
  type DefinicionModulo,
} from "../../config/accesoModulos";
import { casillaService } from "../../services/casillaService";
import { useAuthStore } from "../../stores/authStore";

const ICONOS_MODULO: Record<string, LucideIcon> = {
  "mesa-virtual": ClipboardList,
  ventanilla: Building2,
  registro: User,
  expedientes: FolderOpen,
  casilla: Inbox,
  consulta: Search,
  validador: ShieldCheck,
  "flujo-validez": FileCheck2,
  titulacion: GraduationCap,
  proyector: FileSignature,
  administracion: Settings,
  reportes: BarChart3,
};

const IDS_PRINCIPALES = ["mesa-virtual", "consulta", "validador", "casilla"];
const CLAVE_FAVORITOS = "sigd_modulos_favoritos";

type FiltroModulo = "todos" | "principales" | "publicos" | "favoritos";
type CategoriaModulo = "principal" | "publico" | "gestion";

interface ModuloDashboard {
  id: string;
  code: string;
  title: string;
  description: string;
  category: CategoriaModulo;
  path: string;
  icon: LucideIcon;
  badgeCount: number;
  isFavorite: boolean;
  publico: boolean;
  principal: boolean;
}

const FILTROS: { id: FiltroModulo; etiqueta: string }[] = [
  { id: "todos", etiqueta: "Todos" },
  { id: "principales", etiqueta: "Principales" },
  { id: "publicos", etiqueta: "Públicas" },
  { id: "favoritos", etiqueta: "Favoritos" },
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function leerFavoritos(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const guardados = window.localStorage.getItem(CLAVE_FAVORITOS);
    if (!guardados) return [];
    const datos: unknown = JSON.parse(guardados);
    return Array.isArray(datos)
      ? datos.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function guardarFavoritos(favoritos: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(favoritos));
  } catch {
    // El almacenamiento puede estar bloqueado por el navegador; los favoritos
    // siguen funcionando durante la sesión actual.
  }
}

function codigoDe(modulo: DefinicionModulo): string {
  const subtitulo = modulo.subtitulo?.trim();
  if (subtitulo) return subtitulo.split(/[/·]/)[0]?.trim() || modulo.id.toUpperCase();
  return modulo.id.toUpperCase();
}

function categoriaDe(modulo: DefinicionModulo): CategoriaModulo {
  if (modulo.destacado || IDS_PRINCIPALES.includes(modulo.id)) return "principal";
  if (modulo.publico) return "publico";
  return "gestion";
}

interface TarjetaModuloProps {
  modulo: ModuloDashboard;
  onToggleFavorito: (id: string) => void;
  compact?: boolean;
}

function TarjetaModulo({ modulo, onToggleFavorito, compact = false }: TarjetaModuloProps) {
  const Icono = modulo.icon;
  const pendientes = modulo.badgeCount ?? 0;

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
        modulo.isFavorite
          ? "border-amber-300/80"
          : "border-slate-200 hover:border-[#006EC7]/50"
      }`}
    >
      <Link
        to={modulo.path}
        aria-label={`Abrir ${modulo.title}`}
        className={`flex h-full flex-col ${compact ? "p-4 pr-12" : "p-5 pr-12"}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`grid shrink-0 place-items-center rounded-xl ${
              compact ? "h-10 w-10" : "h-11 w-11"
            } ${
              modulo.principal
                ? "bg-[#003366] text-white transition group-hover:bg-[#006EC7]"
                : "bg-blue-50 text-[#003366]"
            }`}
          >
            <Icono aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#006EC7]">
              {modulo.code}
            </span>
            <span className="mt-1 block text-sm font-black leading-snug text-[#003366]">
              {modulo.title}
            </span>
          </span>
        </div>

        {!compact && (
          <span className="mt-3 flex-1 text-xs leading-relaxed text-slate-500">
            {modulo.description}
          </span>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {modulo.publico && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Público
            </span>
          )}
          {modulo.principal && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#006EC7]">
              Principal
            </span>
          )}
          {pendientes > 0 && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              {pendientes} {pendientes === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-[#E6007E]">
            Abrir
            <ArrowRight
              aria-hidden="true"
              className="h-3 w-3 transition group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => onToggleFavorito(modulo.id)}
        aria-pressed={modulo.isFavorite}
        aria-label={
          modulo.isFavorite
            ? `Quitar ${modulo.title} de favoritos`
            : `Agregar ${modulo.title} a favoritos`
        }
        title={modulo.isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
        className={`absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border transition ${
          modulo.isFavorite
            ? "border-amber-300 bg-amber-50 text-amber-500"
            : "border-slate-200 bg-white/90 text-slate-400 hover:border-amber-300 hover:text-amber-500"
        }`}
      >
        <Star
          aria-hidden="true"
          className="h-4 w-4"
          fill={modulo.isFavorite ? "currentColor" : "none"}
        />
      </button>
    </article>
  );
}

export default function SeccionAccesoSigd() {
  const { rol, autenticado } = useSesion();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const inputBusqueda = useRef<HTMLInputElement>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroModulo>("todos");
  const [favoritos, setFavoritos] = useState<string[]>(leerFavoritos);
  const [badges, setBadges] = useState<Record<string, number>>({});

  const modulosBase = useMemo(
    () => filtrarModulosPorRol(rol, autenticado),
    [rol, autenticado],
  );

  const modulos = useMemo<ModuloDashboard[]>(
    () =>
      modulosBase.map((modulo) => ({
        id: modulo.id,
        code: codigoDe(modulo),
        title: modulo.titulo,
        description: modulo.descripcion,
        category: categoriaDe(modulo),
        path: modulo.ruta,
        icon: ICONOS_MODULO[modulo.id] ?? ClipboardList,
        badgeCount: badges[modulo.id] ?? 0,
        isFavorite: favoritos.includes(modulo.id),
        publico: modulo.publico,
        principal: Boolean(modulo.destacado || IDS_PRINCIPALES.includes(modulo.id)),
      })),
    [modulosBase, badges, favoritos],
  );

  useEffect(() => {
    guardarFavoritos(favoritos);
  }, [favoritos]);

  useEffect(() => {
    if (!autenticado || !modulosBase.some((modulo) => modulo.id === "casilla")) {
      return;
    }

    let activo = true;
    casillaService
      .getEstadisticas()
      .then((estadisticas) => {
        if (activo) {
          setBadges({ casilla: Number(estadisticas.noLeidos ?? 0) });
        }
      })
      .catch(() => {
        if (activo) setBadges({});
      });

    return () => {
      activo = false;
    };
  }, [autenticado, modulosBase]);

  useEffect(() => {
    const alPresionarTecla = (evento: KeyboardEvent) => {
      const objetivo = evento.target;
      const escribiendo =
        objetivo instanceof HTMLElement &&
        Boolean(objetivo.closest("input, textarea, select, [contenteditable='true']"));

      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        inputBusqueda.current?.focus();
        inputBusqueda.current?.select();
        return;
      }

      if (evento.key === "/" && !escribiendo) {
        evento.preventDefault();
        inputBusqueda.current?.focus();
      }
    };

    window.addEventListener("keydown", alPresionarTecla);
    return () => window.removeEventListener("keydown", alPresionarTecla);
  }, []);

  const texto = normalizar(busqueda);
  const modulosFiltrados = useMemo(
    () =>
      modulos.filter((modulo) => {
        const contenido = normalizar(
          `${modulo.title} ${modulo.code} ${modulo.description} ${modulo.category} ${modulo.path}`,
        );
        const coincideTexto = !texto || contenido.includes(texto);
        const coincideFiltro =
          filtro === "todos" ||
          (filtro === "principales" && modulo.principal) ||
          (filtro === "publicos" && modulo.publico) ||
          (filtro === "favoritos" && modulo.isFavorite);
        return coincideTexto && coincideFiltro;
      }),
    [modulos, texto, filtro],
  );

  const favoritosDestacados = modulos.filter((modulo) => modulo.isFavorite);

  const alternarFavorito = (id: string) => {
    setFavoritos((actuales) =>
      actuales.includes(id) ? actuales.filter((favorito) => favorito !== id) : [...actuales, id],
    );
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltro("todos");
  };

  const cerrarSesion = () => {
    logout();
    navigate("/login");
  };

  return (
    <section id="sigd" className="scroll-mt-24 border-y border-slate-200 bg-slate-50 py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#006EC7]">
              <Landmark aria-hidden="true" className="h-3.5 w-3.5" />
              Gobierno digital
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#003366] sm:text-3xl">
              Accesos al Sistema SIGD
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {autenticado && rol
                ? `Mostrando los módulos asignados a tu rol ${rol} según la matriz de accesos institucional.`
                : "El modo invitado está limitado a la portada. Inicia sesión para abrir cualquier módulo del SIGD."}
            </p>
          </div>

          {autenticado ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Sesión activa{rol ? ` · ${rol}` : ""}
              </span>
              <button
                type="button"
                onClick={cerrarSesion}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-[#003366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#00264d]"
            >
              <LogIn aria-hidden="true" className="h-4 w-4" />
              Iniciar sesión
            </Link>
          )}
        </div>

        {!autenticado ? (
          <>
            <div className="mt-6 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
              <span>Modo invitado: los módulos del SIGD están bloqueados hasta que inicies sesión.</span>
              <Link
                to="/login"
                className="font-bold underline underline-offset-2 hover:text-amber-900"
              >
                Iniciar sesión
              </Link>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#003366] text-white">
                  <LockKeyhole aria-hidden="true" className="h-7 w-7" />
                </span>
                <div>
                  <h3 className="text-lg font-black text-[#003366]">
                    Acceso exclusivo para usuarios
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                    Para abrir la mesa de partes, la casilla electrónica, el registro documentario o
                    cualquier otro módulo del SIGD, inicia sesión con tu cuenta institucional.
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    ¿Aún no tienes cuenta? Regístrate para solicitar acceso como ciudadano.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#003366] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#00264d]"
                  >
                    <LogIn aria-hidden="true" className="h-4 w-4" />
                    Iniciar sesión
                  </Link>
                  <Link
                    to="/registro"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <UserPlus aria-hidden="true" className="h-4 w-4" />
                    Crear cuenta
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-amber-500" />
                  Acceso rápido
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">
                  {favoritosDestacados.length} favorito
                  {favoritosDestacados.length === 1 ? "" : "s"}
                </span>
              </div>

              {favoritosDestacados.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {favoritosDestacados.map((modulo) => (
                    <TarjetaModulo
                      key={`favorito-${modulo.id}`}
                      modulo={modulo}
                      onToggleFavorito={alternarFavorito}
                      compact
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-1 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>Marca módulos con la estrella para fijarlos aquí.</span>
                  <span className="text-xs font-semibold text-slate-400">
                    Se guardan en este navegador
                  </span>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  ref={inputBusqueda}
                  type="search"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar módulo, código o servicio…"
                  aria-label="Buscar módulos del SIGD"
                  aria-keyshortcuts="Control+K /"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-20 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#006EC7] focus:bg-white focus:ring-2 focus:ring-[#006EC7]/20"
                />
                {busqueda ? (
                  <button
                    type="button"
                    onClick={() => setBusqueda("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 sm:block">
                    Ctrl K
                  </kbd>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {FILTROS.map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setFiltro(opcion.id)}
                    aria-pressed={filtro === opcion.id}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      filtro === opcion.id
                        ? "bg-[#003366] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
                <span aria-live="polite" className="ml-1 text-xs font-semibold text-slate-400">
                  {modulosFiltrados.length} módulo{modulosFiltrados.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {modulosFiltrados.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-sm font-bold text-slate-600">
                  {filtro === "favoritos"
                    ? "Aún no tienes módulos favoritos que coincidan con la búsqueda."
                    : "No encontramos módulos con ese criterio."}
                </p>
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="mt-3 text-sm font-bold text-[#006EC7] hover:underline"
                >
                  Limpiar búsqueda y filtros
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {modulosFiltrados.map((modulo) => (
                  <TarjetaModulo
                    key={modulo.id}
                    modulo={modulo}
                    onToggleFavorito={alternarFavorito}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
