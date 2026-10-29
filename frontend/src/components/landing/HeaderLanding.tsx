<<<<<<< Updated upstream
import { LayoutDashboard, LogIn, LogOut } from "lucide-react";
=======
﻿import { LayoutDashboard, LogIn, LogOut } from "lucide-react";
>>>>>>> Stashed changes
import { Link, useNavigate } from "react-router-dom";

import { useSesion } from "../../config/accesoModulos";
import { useAuthStore } from "../../stores/authStore";
import BarraSuperior from "./BarraSuperior";
import NavbarInstitucional from "./NavbarInstitucional";

export default function HeaderLanding() {
  const navigate = useNavigate();
  const { rol, autenticado } = useSesion();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const nombre = usuario?.nombreCompleto ?? (autenticado ? rol ?? "Usuario" : "Invitado");

  const acciones = autenticado ? (
    <>
      <span className="hidden max-w-36 truncate text-[11px] font-semibold text-slate-600 lg:block">
        {nombre}
      </span>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#003366] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#00264d]"
      >
        <LayoutDashboard aria-hidden="true" className="h-3.5 w-3.5" />
        Panel
      </Link>
      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login");
        }}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
      </button>
    </>
  ) : (
    <Link
      to="/login"
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#003366] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#00264d]"
    >
      <LogIn aria-hidden="true" className="h-3.5 w-3.5" />
      Ingresar
    </Link>
  );

  return (
    <header className="print:hidden">
      <BarraSuperior />
      <NavbarInstitucional acciones={acciones} />
    </header>
  );
}
