import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Clock,
  Grid2x2,
  Info,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { filtrarModulosPorRol, useSesion } from "../config/accesoModulos";
import { elementoIconoModulo } from "../config/iconosModulos";
import { useAuthStore } from "../stores/authStore";
import SelloInstitucional from "./common/SelloInstitucional";

type ModalPerfil = null | "info" | "datos";

function iniciales(nombre?: string | null, rol?: string | null): string {
  if (nombre) {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  }
  if (rol) return rol.slice(0, 2).toUpperCase();
  return "?";
}

/** Reloj institucional en la tira de estado de la cabecera. */
function useReloj(): string {
  const [marca, setMarca] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setMarca(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  try {
    return marca.toLocaleString("es-PE", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return marca.toISOString().slice(0, 16).replace("T", " ");
  }
}

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const { rol, autenticado } = useSesion();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [modal, setModal] = useState<ModalPerfil>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const perfilRef = useRef<HTMLDivElement>(null);
  const reloj = useReloj();
  // Solo los módulos correspondientes al rol autenticado (filtrado estricto por BD/RBAC).
  // Sin sesión: únicamente módulos públicos.
  const visibles = filtrarModulosPorRol(rol, autenticado);

  // Cerrar menús con Escape y con clic fuera.
  useEffect(() => {
    if (!menuAbierto && !perfilAbierto && !modal) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuAbierto(false);
        setPerfilAbierto(false);
        setModal(null);
      }
    };
    const onClicFuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuAbierto(false);
      if (perfilRef.current && !perfilRef.current.contains(t)) setPerfilAbierto(false);
    };
    document.addEventListener("keydown", onTecla);
    document.addEventListener("mousedown", onClicFuera);
    return () => {
      document.removeEventListener("keydown", onTecla);
      document.removeEventListener("mousedown", onClicFuera);
    };
  }, [menuAbierto, perfilAbierto, modal]);

  const irA = (ruta: string) => {
    setMenuAbierto(false);
    setPerfilAbierto(false);
    navigate(ruta);
  };

  const abrirAyuda = () => {
    setPerfilAbierto(false);
    try {
      window.dispatchEvent(new Event("sigd:abrir-ayuda"));
    } catch {
      // entorno sin DOM (tests)
    }
  };

  const nombreMostrar = usuario?.nombreCompleto ?? (autenticado ? rol ?? "Usuario" : "Invitado");

  return (
    <header className="header-sigd sticky top-0 z-40 print:hidden">
      {/* Banda principal */}
      <div className="banda-institucional">
        <div className="mx-auto flex h-full max-w-[1680px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <span className="shrink-0 text-vault-azul">
              <SelloInstitucional className="h-9 w-9" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold tracking-[0.02em] text-vault-tinta">
                SIGD
              </span>
              <span className="block truncate text-[11px] font-medium text-tinta-500">
                Sistema Integral de Gestión Documentaria
              </span>
            </span>
          </button>

          <span className="hidden h-7 w-px bg-vault-papel-3 lg:block" aria-hidden="true" />
          <span className="hidden truncate text-[11px] font-semibold text-tinta-500 lg:block">
            IESTP Público “Suiza” · Pucallpa
          </span>

          <div className="ml-auto flex items-center gap-2">
            {/* Menú de módulos */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setMenuAbierto((v) => !v);
                  setPerfilAbierto(false);
                }}
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
                className="flex items-center gap-2 rounded-lg border border-vault-papel-3 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-vault-tinta transition hover:border-tinta-300 hover:bg-vault-papel focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
              >
                <Grid2x2 className="h-4 w-4 text-tinta-500" aria-hidden="true" />
                <span className="hidden sm:inline">Módulos</span>
                <span className="rounded bg-vault-papel-2 px-1.5 py-0.5 text-[9px] font-bold text-tinta-500">
                  {visibles.length}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-tinta-400 transition-transform ${menuAbierto ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {menuAbierto && (
                <nav
                  aria-label="Módulos del sistema"
                  className="absolute right-0 z-50 mt-2 w-[min(94vw,25rem)] overflow-hidden rounded-xl border border-vault-papel-3 bg-white shadow-xl"
                >
                  <p className="flex items-center justify-between gap-2 border-b border-vault-papel-2 bg-vault-papel px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-tinta-500">
                    <span>
                      {autenticado && rol ? `Módulos · ${rol}` : "Módulos públicos"}
                    </span>
                    <span className="text-tinta-400">{visibles.length} accesos</span>
                  </p>
                  <ul className="max-h-[60vh] overflow-y-auto p-2">
                    {visibles.map((m, i) => {
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            role="menuitem"
                            title={m.descripcion}
                            onClick={() => irA(m.ruta)}
                            className="item-modulo flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
                          >
                            <span className="icono-modulo">
                              {elementoIconoModulo(m.id, "h-4 w-4")}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-vault-tinta">
                                {m.titulo}
                              </span>
                              <span className="block truncate text-[11px] leading-4 text-tinta-500">
                                {m.descripcion}
                              </span>
                            </span>
                            <span className="text-[10px] font-semibold text-tinta-300">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-center justify-between gap-2 border-t border-vault-papel-2 bg-vault-papel px-4 py-2.5">
                    {autenticado && rol ? (
                      <>
                        <span className="rounded-md border border-vault-papel-3 bg-white px-2.5 py-1 text-[11px] font-semibold text-tinta-700">
                          {rol}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuAbierto(false);
                            logout();
                            navigate("/login");
                          }}
                          className="rounded-md border border-estado-error/30 bg-estado-error-lavado px-3 py-1.5 text-xs font-semibold text-estado-error transition hover:bg-estado-error hover:text-white"
                        >
                          Salir
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] font-medium text-tinta-500">
                          Sin sesión
                        </span>
                        <button
                          type="button"
                          onClick={() => irA("/login")}
                          className="rounded-md bg-vault-azul px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-vault-azul-profundo"
                        >
                          Ingresar
                        </button>
                      </>
                    )}
                  </div>
                </nav>
              )}
            </div>

            {autenticado ? (
              /* Perfil del usuario */
              <div ref={perfilRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setPerfilAbierto((v) => !v);
                    setMenuAbierto(false);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={perfilAbierto}
                  aria-label={`Perfil de ${nombreMostrar}`}
                  className="flex items-center gap-2 rounded-full border border-vault-papel-3 bg-white py-1 pl-1 pr-3 text-vault-tinta transition hover:border-tinta-300 hover:bg-vault-papel focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-vault-azul text-[11px] font-bold text-white"
                  >
                    {iniciales(usuario?.nombreCompleto, rol)}
                  </span>
                  <span className="hidden max-w-32 truncate text-left text-xs font-semibold leading-tight sm:block">
                    {nombreMostrar}
                    <span className="block text-[10px] font-medium text-tinta-500">
                      {autenticado && rol ? rol : "Invitado"}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-tinta-400 transition-transform ${perfilAbierto ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {perfilAbierto && (
                  <nav
                    aria-label="Menú del perfil"
                    className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-vault-papel-3 bg-white text-vault-tinta shadow-xl"
                  >
                    <div className="flex items-center gap-3 border-b border-vault-papel-2 bg-vault-papel px-4 py-3">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vault-azul text-sm font-bold text-white"
                      >
                        {iniciales(usuario?.nombreCompleto, rol)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">{nombreMostrar}</p>
                        <p className="truncate text-[11px] font-medium text-tinta-500">
                          {autenticado && rol ? rol : "Sin sesión iniciada"}
                        </p>
                      </div>
                    </div>
                    <ul className="p-1.5">
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => irA("/")}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition hover:bg-vault-papel hover:text-vault-azul-tinta"
                        >
                          <Grid2x2 className="h-4 w-4 text-tinta-500" aria-hidden="true" /> Inicio
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={abrirAyuda}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition hover:bg-vault-papel hover:text-vault-azul-tinta"
                        >
                          <LifeBuoy className="h-4 w-4 text-tinta-500" aria-hidden="true" /> Ayuda
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setPerfilAbierto(false);
                            setModal("info");
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition hover:bg-vault-papel hover:text-vault-azul-tinta"
                        >
                          <Info className="h-4 w-4 text-tinta-500" aria-hidden="true" /> Información
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setPerfilAbierto(false);
                            setModal("datos");
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition hover:bg-vault-papel hover:text-vault-azul-tinta"
                        >
                          <UserRound className="h-4 w-4 text-tinta-500" aria-hidden="true" /> Datos del usuario
                        </button>
                      </li>
                    </ul>
                    <div className="border-t border-vault-papel-2 bg-vault-papel px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPerfilAbierto(false);
                          logout();
                          navigate("/login");
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-md border border-estado-error/30 bg-estado-error-lavado px-3 py-1.5 text-xs font-semibold text-estado-error transition hover:bg-estado-error hover:text-white"
                      >
                        <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Cerrar sesión
                      </button>
                    </div>
                  </nav>
                )}
              </div>
            ) : (
              /* Visitante: acceso directo al sistema + ficha de información */
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModal("info")}
                  aria-label="Información del sistema"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-vault-papel-3 bg-white text-tinta-600 transition hover:border-tinta-300 hover:bg-vault-papel focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="rounded-lg bg-vault-azul px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-white transition hover:bg-vault-azul-profundo focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
                >
                  Iniciar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tira de estado institucional */}
      <div className="tira-estado hidden md:flex">
        <div className="mx-auto flex h-full w-full max-w-[1680px] items-center gap-4 px-4 sm:px-6">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-tinta-500">
            <ShieldCheck className="h-3.5 w-3.5 text-vault-azul" aria-hidden="true" />
            Ley N.º 27444 · TUO
          </span>
          <span className="h-3 w-px bg-vault-papel-3" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tinta-500">
            Sesión · {autenticado && rol ? rol : "Invitado"}
          </span>
          <span className="h-3 w-px bg-vault-papel-3" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tinta-500">
            {visibles.length} módulos
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium tracking-[0.06em] text-tinta-400">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {reloj}
          </span>
        </div>
      </div>

      {/* Modal Información del sistema */}
      {modal === "info" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Información del sistema"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-tinta-950/45 p-4 backdrop-blur-[2px]"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-xl border border-vault-papel-3 bg-white text-vault-tinta shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-vault-papel-2 bg-vault-papel px-5 py-4">
              <p className="text-sm font-bold text-vault-tinta">
                Información del sistema
              </p>
              <p className="text-[11px] text-tinta-500">
                Sistema Integral de Gestión Documentaria
              </p>
            </div>
            <div className="space-y-2 px-5 py-4 text-[13px] leading-6">
              <p>
                <span className="font-semibold">Sistema:</span> SIGD v1.0
              </p>
              <p>
                <span className="font-semibold">Institución:</span> IESTP Público “Suiza” · Pucallpa
              </p>
              <p>
                <span className="font-semibold">Módulos:</span> Mesa de Partes, Casilla Electrónica,
                Expedientes, Validador CVD, Firma Digital, Titulación, Administración y Reportes.
              </p>
              <p>
                <span className="font-semibold">Validez legal:</span> Ley N.º 27269 de Firmas y
                Certificados Digitales y TUO de la Ley N.º 27444.
              </p>
            </div>
            <div className="flex justify-end border-t border-vault-papel-2 bg-vault-papel px-5 py-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md bg-vault-azul px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-vault-azul-profundo"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Datos del usuario */}
      {modal === "datos" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Datos del usuario"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-tinta-950/45 p-4 backdrop-blur-[2px]"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-xl border border-vault-papel-3 bg-white text-vault-tinta shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-vault-papel-2 bg-vault-papel px-5 py-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vault-azul text-sm font-bold text-white"
              >
                {iniciales(usuario?.nombreCompleto, rol)}
              </span>
              <div>
                <p className="text-sm font-bold text-vault-tinta">Datos del usuario</p>
                <p className="text-[11px] text-tinta-500">
                  {autenticado ? "Sesión activa" : "Sin sesión"}
                </p>
              </div>
            </div>
            <div className="space-y-2 px-5 py-4 text-[13px] leading-6">
              <p>
                <span className="font-semibold">Nombre:</span> {usuario?.nombreCompleto ?? nombreMostrar}
              </p>
              <p>
                <span className="font-semibold">Correo:</span> {usuario?.correo ?? "—"}
              </p>
              <p>
                <span className="font-semibold">Rol:</span> {usuario?.rol ?? rol ?? "—"}
              </p>
              {usuario?.areaId && (
                <p>
                  <span className="font-semibold">Área:</span> {usuario.areaId}
                </p>
              )}
              {!autenticado && (
                <p className="rounded-md border border-estado-alerta/30 bg-estado-alerta-lavado px-3 py-2 text-[12px] text-estado-alerta">
                  No ha iniciado sesión. Inicie sesión para ver sus módulos y su casilla.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-vault-papel-2 bg-vault-papel px-5 py-3">
              {!autenticado && (
                <button
                  type="button"
                  onClick={() => {
                    setModal(null);
                    navigate("/login");
                  }}
                  className="rounded-md bg-vault-azul px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-vault-azul-profundo"
                >
                  Iniciar sesión
                </button>
              )}
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-vault-papel-3 bg-white px-4 py-1.5 text-xs font-semibold text-tinta-700 transition hover:bg-vault-papel"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
