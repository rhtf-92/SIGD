import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import {
  NAV_ITEMS_PUBLICOS,
  NAV_ITEMS_POR_ROL,
  type RolCanonica,
  type NavItem,
} from "../config/navigation.config";

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const usuario = useAuthStore((state) => state.usuario);
  const logout = useAuthStore((state) => state.logout);

  const navItems: readonly NavItem[] = isAuthenticated && usuario?.rol
    ? NAV_ITEMS_POR_ROL[usuario.rol as RolCanonica] || []
    : NAV_ITEMS_PUBLICOS;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="header-sigd bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-md print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex cursor-pointer items-center gap-3 no-underline text-white hover:opacity-95 transition"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-800 font-black text-base shadow-sm">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider uppercase text-white">
                SIGD SUIZA
              </span>
              <span className="rounded bg-blue-600/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-100">
                v1.0
              </span>
            </div>
            <p className="text-xs text-blue-100 font-medium">
              Instituto de Educación Superior Tecnológico Público "Suiza"
            </p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {navItems.map((item) => {
            const isActive = location.pathname === item.ruta;
            return (
              <button
                key={item.ruta}
                type="button"
                onClick={() => navigate(item.ruta)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  isActive
                    ? "bg-white text-blue-900 font-bold shadow-sm"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {item.etiqueta}
              </button>
            );
          })}

          {isAuthenticated && usuario && (
            <div className="ml-2 flex items-center gap-2 border-l border-blue-700/60 pl-3">
              <div className="text-right">
                <p className="text-[11px] font-bold text-white leading-tight">
                  {usuario.nombreCompleto}
                </p>
                <span className="inline-block rounded bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-900">
                  {usuario.rol}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-rose-600/80 hover:bg-rose-600 px-2.5 py-1 text-white transition text-[11px]"
                title="Cerrar sesión"
              >
                Salir
              </button>
            </div>
          )}
        </nav>
      </div>
      <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-rose-500 to-amber-400" />
    </header>
  );
}
