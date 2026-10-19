import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { filtrarModulosPorRol, useSesion } from "../config/accesoModulos";
import { useAuthStore } from "../stores/authStore";

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
    <header className="header-sigd bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-md print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <div
          className="flex cursor-pointer items-center gap-3"
          onClick={() => navigate("/")}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-800 font-black text-base shadow-sm">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider uppercase text-white">
                SIGD SUIZA
              </span>
              <span className="rounded bg-blue-600/60 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-100">
                v1.0
              </span>
            </div>
            <p className="text-xs text-blue-100 font-medium">
              Instituto de Educación Superior Tecnológico Público "Suiza"
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
              className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              <span aria-hidden="true" className="text-sm leading-none">
                {menuAbierto ? "✕" : "☰"}
              </span>
              Menú
              <span aria-hidden="true" className={`text-[10px] transition-transform ${menuAbierto ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>

            {menuAbierto && (
              <nav
                aria-label="Módulos del sistema"
                className="absolute right-0 z-50 mt-2 w-[min(92vw,340px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl"
              >
                <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {autenticado && rol ? `Módulos · ${rol}` : "Módulos públicos"}
                </p>
                <ul className="max-h-[60vh] overflow-y-auto py-1">
                  {visibles.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        role="menuitem"
                        title={m.descripcion}
                        onClick={() => irA(m.ruta)}
                        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-blue-50 hover:text-blue-800"
                      >
                        <span>
                          {m.subtitulo && (
                            <span className="mr-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                              {m.subtitulo}
                            </span>
                          )}
                          {m.titulo}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                  {autenticado && rol ? (
                    <>
                      <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                        {rol}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAbierto(false);
                          logout();
                          navigate("/login");
                        }}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition"
                      >
                        Salir
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] font-medium text-slate-500">
                        Sin sesión
                      </span>
                      <button
                        type="button"
                        onClick={() => irA("/login")}
                        className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800 transition"
                      >
                        Ingresar
                      </button>
                    </>
                  )}
                </div>
              </nav>
            )}
          </div>

          {/* Perfil del usuario */}
          <div ref={perfilRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setPerfilAbierto((v) => !v);
                setMenuAbierto(false);
              }}
              aria-haspopup="menu"
              aria-expanded={perfilAbierto}
              aria-label={autenticado ? `Perfil de ${nombreMostrar}` : "Perfil de invitado"}
              className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-blue-800"
              >
                {iniciales(usuario?.nombreCompleto, rol)}
              </span>
              <span className="hidden max-w-32 truncate text-left text-xs font-bold leading-tight sm:block">
                {nombreMostrar}
                <span className="block text-[10px] font-medium text-blue-100">
                  {autenticado && rol ? rol : "Invitado"}
                </span>
              </span>
              <span aria-hidden="true" className={`text-[10px] transition-transform ${perfilAbierto ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>

            {perfilAbierto && (
              <nav
                aria-label="Menú del perfil"
                className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-black text-white"
                  >
                    {iniciales(usuario?.nombreCompleto, rol)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold">{nombreMostrar}</p>
                    <p className="truncate text-[11px] font-medium text-slate-500">
                      {autenticado && rol ? rol : "Sin sesión iniciada"}
                    </p>
                  </div>
                </div>
                <ul className="py-1">
                  <li>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => irA("/")}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-blue-50 hover:text-blue-800"
                    >
                      <span aria-hidden="true">🏠</span> Inicio
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={abrirAyuda}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-blue-50 hover:text-blue-800"
                    >
                      <span aria-hidden="true">❓</span> Ayuda
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
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-blue-50 hover:text-blue-800"
                    >
                      <span aria-hidden="true">ℹ️</span> Información
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
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-blue-50 hover:text-blue-800"
                    >
                      <span aria-hidden="true">👤</span> Datos del usuario
                    </button>
                  </li>
                </ul>
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                  {autenticado ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPerfilAbierto(false);
                        logout();
                        navigate("/login");
                      }}
                      className="w-full rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition"
                    >
                      Cerrar sesión
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => irA("/login")}
                      className="w-full rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800 transition"
                    >
                      Iniciar sesión
                    </button>
                  )}
                </div>
              </nav>
            )}
          </div>
        </div>
      </div>
      <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-rose-500 to-amber-400" />

      {/* Modal Información del sistema */}
      {modal === "info" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Información del sistema"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-800 to-blue-900 px-5 py-4 text-white">
              <p className="text-sm font-black tracking-wider">ℹ️ INFORMACIÓN</p>
              <p className="text-[11px] text-blue-100">Sistema Integral de Gestión Documentaria</p>
            </div>
            <div className="space-y-2 px-5 py-4 text-[13px] leading-6">
              <p><span className="font-bold">Sistema:</span> SIGD v1.0</p>
              <p><span className="font-bold">Institución:</span> IESTP Público "Suiza" · Pucallpa</p>
              <p><span className="font-bold">Módulos:</span> Mesa de Partes, Casilla Electrónica, Expedientes, Validador CVD, Firma Digital, Titulación, Administración y Reportes.</p>
              <p><span className="font-bold">Validez legal:</span> Ley N.º 27269 de Firmas y Certificados Digitales y TUO de la Ley N.º 27444.</p>
            </div>
            <div className="flex justify-end bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
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
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-800 to-blue-900 px-5 py-4 text-white">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-black text-blue-800"
              >
                {iniciales(usuario?.nombreCompleto, rol)}
              </span>
              <div>
                <p className="text-sm font-black">👤 DATOS DEL USUARIO</p>
                <p className="text-[11px] text-blue-100">{autenticado ? "Sesión activa" : "Sin sesión"}</p>
              </div>
            </div>
            <div className="space-y-2 px-5 py-4 text-[13px] leading-6">
              <p><span className="font-bold">Nombre:</span> {usuario?.nombreCompleto ?? nombreMostrar}</p>
              <p><span className="font-bold">Correo:</span> {usuario?.correo ?? "—"}</p>
              <p><span className="font-bold">Rol:</span> {usuario?.rol ?? rol ?? "—"}</p>
              {usuario?.areaId && <p><span className="font-bold">Área:</span> {usuario.areaId}</p>}
              {!autenticado && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 ring-1 ring-amber-200">
                  No ha iniciado sesión. Inicie sesión para ver sus módulos y su casilla.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 bg-slate-50 px-5 py-3">
              {!autenticado && (
                <button
                  type="button"
                  onClick={() => {
                    setModal(null);
                    navigate("/login");
                  }}
                  className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
                >
                  Iniciar sesión
                </button>
              )}
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
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
