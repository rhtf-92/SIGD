/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/components/administracion/common/LoginAdminModal.tsx
 * DESCRIPCIÓN: Modal de acceso para el Panel de Administración. Acepta nombres de
 * usuario de texto libre, administra el estado global de autenticación y
 * redirige directamente al panel sin volver a la página pública de /login.
 * ==============================================================================
 */

import { useState } from "react";
import axios from "axios";
import { Eye, EyeOff, KeyRound } from "lucide-react";

import { env } from "../../../config/env";
import { useAuthStore, type UsuarioPerfil } from "../../../stores/authStore";
import { PrimaryButton, SecondaryButton } from "./Buttons";

interface LoginAdminModalProps {
  /** Callback para cerrar el modal */
  onClose: () => void;
}

/**
 * Endpoints probados en orden:
 * 1. `/api/auth/login`  -> autenticación de demostración (TEST_USERS del backend).
 * 2. `/api/v1/auth/login` -> autenticación canónica contra PostgreSQL.
 */
const ENDPOINTS_LOGIN = ["/api/auth/login", "/api/v1/auth/login"];

export default function LoginAdminModal({
  onClose,
}: LoginAdminModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const validate = (): string | null => {
    if (!username.trim()) return "Usuario es requerido";
    if (!password.trim()) return "Contraseña es requerida";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setCargando(true);
    let autenticado = false;

    try {
      const payload = {
        identificador: username.trim(),
        password,
      };

      for (const endpoint of ENDPOINTS_LOGIN) {
        try {
          const { data } = await axios.post<{
            accessToken?: string;
            refreshToken?: string;
            usuario?: { rol?: string };
          }>(`${env.apiBaseUrl}${endpoint}`, payload, { timeout: 10000 });

          if (!data?.accessToken) {
            throw new Error("El servidor no devolvió un token de acceso.");
          }

          const rol = (data.usuario?.rol ?? "SUPER_ADMIN") as UsuarioPerfil["rol"];
          const perfil: UsuarioPerfil = {
            id: "",
            nombreCompleto: username.trim(),
            correo: username.trim(),
            rol,
          };

          // Persiste la sesión en localStorage y en el estado global de la app.
          useAuthStore.getState().setSession(
            data.accessToken,
            perfil,
            data.refreshToken ?? null,
          );

          autenticado = true;
          break;
        } catch (err) {
          // Si el servidor respondió (401/404/500) no tiene sentido probar otro
          // endpoint; solo se continúa ante fallos de red.
          const respondio = axios.isAxiosError(err) && err.response !== undefined;
          if (respondio) {
            const detalle = err.response?.data as
              | { message?: string; detail?: string }
              | undefined;
            setError(
              detalle?.detail ??
                detalle?.message ??
                "No se pudo iniciar sesión. Verifique sus credenciales e intente nuevamente.",
            );
            break;
          }
        }
      }
    } catch {
      setError(
        "No se pudo conectar con el servidor de autenticación. Verifique que el backend esté activo.",
      );
    } finally {
      setCargando(false);
    }

    if (autenticado) {
      // Ruta válida registrada en AppRouter: hub central del Panel de Administración.
      window.location.href = "/administracion";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full bg-slate-900/95 p-6 rounded-2xl border border-cyan-500/30 shadow-2xl backdrop-blur-xl text-slate-100 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-violet-700 shadow-lg shadow-fuchsia-500/30">
              <span className="text-white font-bold text-lg">🏛️</span>
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-white">
              Panel de Administración
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="text-slate-400 hover:text-white transition rounded-md hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
            <span className="h-4 w-4 flex-shrink-0 block bg-red-500 rounded-full" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campo 1: Usuario de texto libre */}
          <div className="space-y-2">
            <label
              htmlFor="admin-username"
              className="block text-xs font-semibold tracking-wider uppercase text-slate-400"
            >
              Usuario
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                <Eye className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingrese su nombre de usuario"
                autoComplete="username"
                disabled={cargando}
                className="w-full rounded-xl pl-10 pr-4 py-2.5 border border-slate-700/80 bg-slate-950/60 text-sm font-medium text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Campo 2: Contraseña */}
          <div className="space-y-2">
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold tracking-wider uppercase text-slate-400"
            >
              Contraseña
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                disabled={cargando}
                className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-slate-700/80 bg-slate-950/60 text-sm font-medium text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <SecondaryButton type="button" onClick={onClose} disabled={cargando}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              isLoading={cargando}
              disabled={!!error || cargando}
            >
              Ingresar
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
