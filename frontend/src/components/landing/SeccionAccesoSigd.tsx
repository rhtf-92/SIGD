import {
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
  LogIn,
  Search,
  Settings,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { filtrarModulosPorRol, useSesion } from "../../config/accesoModulos";
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

export default function SeccionAccesoSigd() {
  const { rol, autenticado } = useSesion();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const modulos = filtrarModulosPorRol(rol, autenticado);

  const cerrarSesion = () => {
    logout();
    navigate("/login");
  };

  return (
    <section id="sigd" className="scroll-mt-24 border-y border-slate-200 bg-white py-14 sm:py-20">
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
                : "Explora los servicios públicos o inicia sesión para acceder a los módulos de tu rol."}
            </p>
          </div>

          {autenticado && rol ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Sesión activa · {rol}
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

        {!autenticado && (
          <div className="mt-6 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <span>Sin sesión solo se muestran los servicios públicos del SIGD.</span>
            <Link to="/registro" className="font-bold underline underline-offset-2 hover:text-amber-900">
              Crear cuenta ciudadana
            </Link>
          </div>
        )}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((modulo) => {
            const Icono = ICONOS_MODULO[modulo.id] ?? ClipboardList;
            return (
              <Link
                key={modulo.ruta}
                to={modulo.ruta}
                className={`group flex items-start gap-3 rounded-xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                  modulo.destacado
                    ? "border-[#006EC7]/30 bg-blue-50/50 hover:border-[#006EC7]"
                    : "border-slate-200 bg-white hover:border-[#006EC7]/40"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                    modulo.destacado ? "bg-[#006EC7] text-white" : "bg-slate-100 text-[#003366]"
                  }`}
                >
                  <Icono aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  {modulo.subtitulo && (
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#006EC7]">
                      {modulo.subtitulo}
                    </span>
                  )}
                  <span className="mt-0.5 block text-sm font-black text-[#003366]">{modulo.titulo}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">{modulo.descripcion}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#E6007E]">
                    Ingresar
                    <ArrowRight aria-hidden="true" className="h-3 w-3 transition group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
