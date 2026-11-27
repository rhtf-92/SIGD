import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { ApiHttpError } from "../types/api";
import { useAuthStore } from "../stores/authStore";

export default function CambiarPasswordPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function cambiarPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (passwordNueva !== confirmacion) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (passwordActual === passwordNueva) {
      setError("La nueva contraseña debe ser distinta de la contraseña temporal.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await apiClient.post("/api/v1/auth/cambiar-password", {
        passwordActual,
        passwordNueva,
      });
      useAuthStore.getState().setToken(data.accessToken);
      const state = useAuthStore.getState();
      if (state.usuario) {
        useAuthStore.setState({
          usuario: { ...state.usuario, debeCambiarPassword: false },
        });
      }
      navigate(
        state.usuario?.rol === "CIUDADANO" ? "/mi-registro" : "/",
        { replace: true },
      );
    } catch (changeError) {
      setError(
        changeError instanceof ApiHttpError
          ? changeError.problemDetails.detail
          : "No se pudo cambiar la contraseña. Inténtelo nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-blue-700">Registro Ciudadano</p>
        <h1 className="mt-1 text-2xl font-bold">Cambia tu contraseña temporal</h1>
        <p className="mt-2 text-sm text-slate-600">
          Por seguridad, reemplaza tu número de documento por una contraseña
          personal de al menos 10 caracteres.
        </p>
        <form onSubmit={cambiarPassword} className="mt-6 space-y-4">
          <div>
            <label htmlFor="passwordActual" className="mb-2 block text-sm font-semibold">
              Contraseña temporal (DNI)
            </label>
            <input
              id="passwordActual"
              type="password"
              autoComplete="current-password"
              required
              value={passwordActual}
              onChange={(event) => setPasswordActual(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="passwordNueva" className="mb-2 block text-sm font-semibold">
              Nueva contraseña
            </label>
            <input
              id="passwordNueva"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              value={passwordNueva}
              onChange={(event) => setPasswordNueva(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="confirmacion" className="mb-2 block text-sm font-semibold">
              Confirma la nueva contraseña
            </label>
            <input
              id="confirmacion"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              value={confirmacion}
              onChange={(event) => setConfirmacion(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  );
}
