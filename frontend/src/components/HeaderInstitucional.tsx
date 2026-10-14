import { useState } from "react";
import {
  Archive,
  BarChart3,
  FileInput,
  Home,
  Inbox,
  LogIn,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import sigdLogo from "../assets/LOGO 3.png";

const NAVEGACION = [
  { etiqueta: "Inicio", ruta: "/", icono: Home, exacta: true },
  { etiqueta: "Trámites", ruta: "/tramite", icono: FileInput, exacta: false },
  { etiqueta: "Expedientes", ruta: "/expedientes", icono: Archive, exacta: false },
  { etiqueta: "Casilla", ruta: "/casilla", icono: Inbox, exacta: false },
  { etiqueta: "Reportes", ruta: "/reportes/dashboard", icono: BarChart3, exacta: false },
  { etiqueta: "Administración", ruta: "/administracion", icono: Settings, exacta: false },
] as const;

export default function HeaderInstitucional() {
  const [menuAbierto, setMenuAbierto] = useState(false);

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
          {NAVEGACION.map(({ etiqueta, ruta, icono: Icono, exacta }) => (
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
          <Link to="/login" className="sigd-access-link">
            <LogIn aria-hidden="true" size={17} />
            <span>Acceder</span>
          </Link>
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
        {NAVEGACION.map(({ etiqueta, ruta, icono: Icono, exacta }) => (
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
