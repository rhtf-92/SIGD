import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { permisosIniciales } from "../../hooks/useRbacConfig";

interface AutenticacionMesaPartesModalProps {
  abierto: boolean;
  onCerrar: () => void;
}

export default function AutenticacionMesaPartesModal({
  abierto,
  onCerrar,
}: AutenticacionMesaPartesModalProps) {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState("");
  const usuarioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    usuarioRef.current?.focus();

    function manejarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }

    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  function iniciarSesion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const identificacion = usuario.trim();
    if (!identificacion) {
      setError("Ingrese su usuario institucional.");
      return;
    }
    if (identificacion.length < 4) {
      setError("El usuario institucional debe tener al menos 4 caracteres.");
      return;
    }
    if (!clave) {
      setError("Ingrese su contraseña.");
      return;
    }
    if (clave.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }

    const token = `demo-mesa-partes-${Date.now()}`;
    const auth = useAuthStore.getState();
    auth.setToken(token, token);
    useAuthStore.setState({
      usuario: {
        id: "mesa-partes",
        nombreCompleto: identificacion,
        correo: identificacion,
        rol: "MESA_PARTES",
      },
      isAuthenticated: true,
    });

    try {
      window.localStorage.setItem("sigd_token", token);
      window.localStorage.setItem("token", token);
      window.localStorage.setItem("sigd_rol", "MESA_PARTES");
      window.localStorage.setItem(
        "sigd_permisos",
        JSON.stringify(permisosIniciales),
      );
    } catch {
      // Ignore storage errors
    }

    setError("");
    setUsuario("");
    setClave("");
    onCerrar();
    navigate("/tramite/mesa-partes-virtual");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b19]/85 p-4 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-acceso-mp"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-7 text-white shadow-2xl shadow-black/60 backdrop-blur-2xl"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-400"
        />

        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar ventana de acceso"
          className="absolute top-4 right-4 rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/15 text-cyan-300">
          <LockKeyhole size={24} aria-hidden="true" />
        </span>

        <h2
          id="titulo-acceso-mp"
          className="mt-4 text-xl font-bold text-white sm:text-2xl"
        >
          Acceso a Mesa de Partes Virtual
        </h2>
        <p className="mt-2 text-sm leading-6 text-blue-100/85">
          Ingrese su usuario institucional y contraseña para continuar con la
          radicación de documentos.
        </p>

        <form className="mt-6 space-y-4" onSubmit={iniciarSesion} noValidate>
          <div>
            <label
              htmlFor="usuario-institucional"
              className="mb-1.5 block text-xs font-bold tracking-wider text-blue-200 uppercase"
            >
              Usuario institucional
            </label>
            <div className="relative">
              <UserRound
                size={16}
                aria-hidden="true"
                className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
              />
              <input
                id="usuario-institucional"
                ref={usuarioRef}
                type="text"
                autoComplete="username"
                value={usuario}
                onChange={(evento) => setUsuario(evento.target.value)}
                placeholder="ej. administrador@suiza.edu.pe"
                className="w-full rounded-xl border border-white/40 bg-white/95 py-3 pr-4 pl-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="clave-institucional"
              className="mb-1.5 block text-xs font-bold tracking-wider text-blue-200 uppercase"
            >
              Contraseña
            </label>
            <div className="relative">
              <LockKeyhole
                size={16}
                aria-hidden="true"
                className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
              />
              <input
                id="clave-institucional"
                type={verClave ? "text" : "password"}
                autoComplete="current-password"
                value={clave}
                onChange={(evento) => setClave(evento.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/40 bg-white/95 py-3 pr-12 pl-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40"
              />
              <button
                type="button"
                onClick={() => setVerClave((visible) => !visible)}
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:text-slate-700"
              >
                {verClave ? (
                  <EyeOff size={16} aria-hidden="true" />
                ) : (
                  <Eye size={16} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-200"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/50 transition hover:bg-blue-400 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            Ingresar
          </button>

          <button
            type="button"
            onClick={onCerrar}
            className="w-full rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            Cancelar
          </button>
        </form>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] font-semibold tracking-wide text-blue-200/75">
          <ShieldCheck size={14} aria-hidden="true" />
          Acceso restringido al personal institucional — IESTP Suiza
        </p>
      </div>
    </div>
  );
}
