import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { filtrarModulosPorRol, useSesion } from "../config/accesoModulos";
import { useAuthStore } from "../stores/authStore";
import BarraSuperior from "./landing/BarraSuperior";
import NavbarInstitucional from "./landing/NavbarInstitucional";

type ModalPerfil = null | "info" | "datos" | "soporte";

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
  const setUsuario = useAuthStore((s) => s.setUsuario);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [modal, setModal] = useState<ModalPerfil>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const perfilRef = useRef<HTMLDivElement>(null);
  const visibles = filtrarModulosPorRol(rol, autenticado);

  const [editandoDatos, setEditandoDatos] = useState(false);
  const [formDatos, setFormDatos] = useState({
    nombreCompleto: usuario?.nombreCompleto ?? "",
    correo: usuario?.correo ?? "",
    telefono: usuario?.telefono ?? "",
    cargo: usuario?.cargo ?? "",
  });

  const cargarFormDatos = () => {
    setFormDatos({
      nombreCompleto: usuario?.nombreCompleto ?? "",
      correo: usuario?.correo ?? "",
      telefono: usuario?.telefono ?? "",
      cargo: usuario?.cargo ?? "",
    });
    setEditandoDatos(true);
  };

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
    setModal("soporte");
    try {
      window.dispatchEvent(new Event("sigd:abrir-soporte"));
    } catch {
      // entorno sin DOM (tests)
    }
  };

  const nombreMostrar = usuario?.nombreCompleto ?? (autenticado ? rol ?? "Usuario" : "Invitado");

  const guardarDatosUsuario = () => {
    const actual = useAuthStore.getState().usuario;
    if (!actual) return;
    setUsuario({ ...actual, ...formDatos });
    setEditandoDatos(false);
  };

  const acciones = (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setMenuAbierto((v) => !v);
            setPerfilAbierto(false);
          }}
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 transition hover:border-[#003366]/40 hover:bg-slate-50"
        >
          {menuAbierto ? (
            <X aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Menu aria-hidden="true" className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Menú</span>
          <ChevronDown
            aria-hidden="true"
            className={`hidden h-3 w-3 text-slate-400 transition-transform sm:block ${menuAbierto ? "rotate-180" : ""}`}
          />
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
                    <span aria-hidden="true" className="text-slate-400">
                      →
                    </span>
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
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700"
                  >
                    Salir
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-medium text-slate-500">Sin sesión</span>
                  <button
                    type="button"
                    onClick={() => irA("/login")}
                    className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-800"
                  >
                    Ingresar
                  </button>
                </>
              )}
            </div>
          </nav>
        )}
      </div>

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
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-2 text-slate-700 transition hover:bg-slate-100"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#003366] text-xs font-black text-white"
          >
            {iniciales(usuario?.nombreCompleto, rol)}
          </span>
          <span className="hidden max-w-32 truncate text-left text-[11px] font-bold leading-tight md:block">
            {nombreMostrar}
            <span className="block text-[10px] font-medium text-slate-500">
              {autenticado && rol ? rol : "Invitado"}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-3 w-3 text-slate-400 transition-transform ${perfilAbierto ? "rotate-180" : ""}`}
          />
        </button>

        {perfilAbierto && (
          <nav
            aria-label="Menú del perfil"
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#003366] text-sm font-black text-white"
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
                  <span aria-hidden="true">💬</span> Ayuda / Soporte IA
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
                    setEditandoDatos(false);
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
                  className="w-full rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700"
                >
                  Cerrar sesión
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => irA("/login")}
                  className="w-full rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-800"
                >
                  Iniciar sesión
                </button>
              )}
            </div>
          </nav>
        )}
      </div>
    </>
  );

  return (
    <header className="print:hidden">
      <BarraSuperior />
      <NavbarInstitucional acciones={acciones} />

      {modal === "info" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Información del sistema"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-800 to-blue-900 px-5 py-4 text-white">
              <p className="text-sm font-black tracking-wider">INFORMACIÓN DEL SISTEMA</p>
              <p className="text-[11px] text-blue-100">Sistema Integral de Gestión Documentaria - SIGD</p>
            </div>
            <div className="space-y-4 px-5 py-5 text-[13px] leading-6">
              <div>
                <p className="mb-2 text-sm font-bold text-blue-900">Presentación de la Plataforma</p>
                <p className="text-slate-700">
                  El SIGD es la plataforma oficial del IESTP Público "Suiza" - Pucallpa para la gestión integral, digital y segura de los trámites documentarios, garantizando trazabilidad, validez legal y atención oportuna.
                </p>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <img src="/vite.svg" alt="Diagrama explicativo de módulos SIGD" className="w-full h-32 object-cover bg-gradient-to-r from-slate-100 to-slate-50" />
                <div className="px-4 py-2 bg-slate-50 text-[11px] text-slate-600">Esquema general de funcionamiento por módulos</div>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold text-blue-900">Módulos Principales</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <li className="rounded-lg border border-slate-200 px-3 py-2">📝 Mesa de Partes Virtual</li>
                  <li className="rounded-lg border border-slate-200 px-3 py-2">📬 Casilla Electrónica</li>
                  <li className="rounded-lg border border-slate-200 px-3 py-2">📂 Expedientes y Trámite</li>
                  <li className="rounded-lg border border-slate-200 px-3 py-2">✅ Validador CVD</li>
                  <li className="rounded-lg border border-slate-200 px-3 py-2">✍️ Firma Digital / Validez Legal</li>
                  <li className="rounded-lg border border-slate-200 px-3 py-2">🎓 Titulación</li>
                  <li className="rounded-lg border border-slate-200 px-3 py-2">🧾 Resoluciones</li>
                  <li className="rounded-lg border border-slate-200 px-3 py-2">⚙️ Administración y Reportes</li>
                </ul>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 ring-1 ring-blue-200">
                <p className="mb-1 text-xs font-bold text-blue-900">Base Legal</p>
                <p className="text-[12px] text-blue-800 leading-5">Ley N° 27269 - Firmas y Certificados Digitales • TUO de la Ley N° 27444 • Normativa Institucional</p>
              </div>
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

      {modal === "datos" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Datos del usuario"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => { setModal(null); setEditandoDatos(false); }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
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
                <p className="text-sm font-black">DATOS DEL USUARIO</p>
                <p className="text-[11px] text-blue-100">{autenticado ? "Sesión activa" : "Sin sesión"}</p>
              </div>
            </div>
            <div className="space-y-2 px-5 py-4 text-[13px] leading-6">
              {editandoDatos ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Nombre completo
                    </span>
                    <input
                      type="text"
                      value={formDatos.nombreCompleto}
                      onChange={(e) => setFormDatos((f) => ({ ...f, nombreCompleto: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-blue-600"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Correo
                    </span>
                    <input
                      type="email"
                      value={formDatos.correo}
                      onChange={(e) => setFormDatos((f) => ({ ...f, correo: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-blue-600"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Teléfono
                    </span>
                    <input
                      type="tel"
                      value={formDatos.telefono}
                      onChange={(e) => setFormDatos((f) => ({ ...f, telefono: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-blue-600"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Cargo
                    </span>
                    <input
                      type="text"
                      value={formDatos.cargo}
                      onChange={(e) => setFormDatos((f) => ({ ...f, cargo: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-blue-600"
                    />
                  </label>
                  <p className="text-[11px] font-medium text-slate-500">
                    Rol: {usuario?.rol ?? rol ?? "—"}
                    {usuario?.areaId ? ` · Área: ${usuario.areaId}` : ""}
                  </p>
                </div>
              ) : (
                <>
                  <p>
                    <span className="font-bold">Nombre:</span> {usuario?.nombreCompleto ?? nombreMostrar}
                  </p>
                  <p>
                    <span className="font-bold">Correo:</span> {usuario?.correo ?? "—"}
                  </p>
                  {usuario?.telefono && (
                    <p>
                      <span className="font-bold">Teléfono:</span> {usuario.telefono}
                    </p>
                  )}
                  {usuario?.cargo && (
                    <p>
                      <span className="font-bold">Cargo:</span> {usuario.cargo}
                    </p>
                  )}
                  <p>
                    <span className="font-bold">Rol:</span> {usuario?.rol ?? rol ?? "—"}
                  </p>
                  {usuario?.areaId && (
                    <p>
                      <span className="font-bold">Área:</span> {usuario.areaId}
                    </p>
                  )}
                </>
              )}
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
              {autenticado && !editandoDatos && (
                <button
                  type="button"
                  onClick={cargarFormDatos}
                  className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
                >
                  Editar datos
                </button>
              )}
              {autenticado && editandoDatos && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditandoDatos(false)}
                    className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={guardarDatosUsuario}
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Guardar cambios
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setModal(null);
                  setEditandoDatos(false);
                }}
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
