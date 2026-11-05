import { useState } from "react";
import {
  Archive,
  BarChart3,
  FileInput,
  Home,
  Inbox,
  LogIn,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import sigdLogo from "../assets/LOGO 3.png";
import { useAuthStore } from "../stores/authStore";

const NAVEGACION = [
  { etiqueta: "Inicio", ruta: "/", icono: Home, exacta: true },
  { etiqueta: "Trámites", ruta: "/tramite", icono: FileInput, exacta: false },
  { etiqueta: "Expedientes", ruta: "/expedientes", icono: Archive, exacta: false, permiso: "EXPEDIENTE_LEER" },
  { etiqueta: "Casilla", ruta: "/casilla", icono: Inbox, exacta: false },
  { etiqueta: "Reportes", ruta: "/reportes/dashboard", icono: BarChart3, exacta: false, permiso: "REPORTE_LEER" },
  { etiqueta: "Administración", ruta: "/administracion", icono: Settings, exacta: false, permiso: "ADMIN_USUARIOS" },
] as const;

export default function HeaderInstitucional() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const permisosUsuario = useAuthStore((state) => state.usuario?.permisos) ?? [];
  const navegacionVisible = NAVEGACION.filter((elemento) =>
    !("permiso" in elemento) || permisosUsuario.includes(elemento.permiso),
  );

  return (
    <header className="sigd-app-header print:hidden">
      <div className="sigd-header-inner">
        <Link to="/" className="sigd-brand" aria-label="SIGD SUIZA — ir al inicio">
          <span className="sigd-brand-logo"><img src={sigdLogo} alt="" /></span>
          <span className="sigd-brand-copy">
            <span className="sigd-brand-title">SIGD SUIZA <small>v1.0</small></span>
            <span>Gestión Documental Institucional</span>
          </span>
        </Link>

        <nav className="sigd-desktop-nav" aria-label="Navegación principal">
          {navegacionVisible.map(({ etiqueta, ruta, icono: Icono, exacta }) => (
            <NavLink
              key={ruta}
              to={ruta}
              end={exacta}
              className={({ isActive }) => `sigd-nav-link${isActive ? " is-active" : ""}`}
            >
              <Icono aria-hidden="true" size={16} />
              <span>{etiqueta}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sigd-header-actions">
          {isAuthenticated ? (
            <button type="button" className="sigd-access-link" onClick={logout}>
              <LogOut aria-hidden="true" size={17} />
              <span>Cerrar sesión</span>
            </button>
          ) : (
            <Link to="/login" className="sigd-access-link">
              <LogIn aria-hidden="true" size={17} />
              <span>Acceder</span>
            </Link>
          )}
          <button
            type="button"
            className="sigd-menu-toggle"
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuAbierto}
            aria-controls="sigd-mobile-navigation"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            {menuAbierto ? <X aria-hidden="true" size={21} /> : <Menu aria-hidden="true" size={21} />}
          </button>
        </div>
      </div>

      <nav
        id="sigd-mobile-navigation"
        className={`sigd-mobile-nav${menuAbierto ? " is-open" : ""}`}
        aria-label="Navegación móvil"
      >
        {navegacionVisible.map(({ etiqueta, ruta, icono: Icono, exacta }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end={exacta}
            onClick={() => setMenuAbierto(false)}
            className={({ isActive }) => `sigd-mobile-link${isActive ? " is-active" : ""}`}
          >
            <Icono aria-hidden="true" size={18} />
            <span>{etiqueta}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sigd-header-line" aria-hidden="true" />
    </header>
  );
}
