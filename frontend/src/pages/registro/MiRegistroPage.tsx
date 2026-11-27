import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { useAuthStore } from "../../stores/authStore";
import { ApiHttpError } from "../../types/api";

interface RegistroCiudadano {
  tipo: "NATURAL" | "JURIDICA";
  id_documento: string;
  tipo_documento: string | null;
  direccion: string | null;
  ubigeo_distrito: string | null;
  referencia_domicilio: string | null;
  nombre_completo: string | null;
  correo: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  razon_social: string | null;
  representante_legal: string | null;
  partida_registral_sunarp: string | null;
  usuario: string;
  correo_cuenta: string;
}

export default function MiRegistroPage() {
  const [registro, setRegistro] = useState<RegistroCiudadano | null>(null);
  const [error, setError] = useState("");
  const nombre = useAuthStore((state) => state.usuario?.nombreCompleto ?? "Ciudadano");
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    let vigente = true;
    apiClient.get<RegistroCiudadano>("/api/v1/auth/mi-registro")
      .then(({ data }) => {
        if (vigente) setRegistro(data);
      })
      .catch((requestError: unknown) => {
        if (!vigente) return;
        setError(
          requestError instanceof ApiHttpError
            ? requestError.problemDetails.detail
            : "No se pudo cargar tu registro. Inténtalo nuevamente.",
        );
      });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold text-blue-700">Registro Ciudadano</p>
        <h1 className="mt-1 text-2xl font-bold">Mi registro</h1>
        <p className="mt-2 text-sm text-slate-600">
          Hola, {nombre}. Aquí solo se muestra la información asociada a tu cuenta.
        </p>

        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {!error && !registro && <p className="mt-6 text-sm text-slate-600">Cargando tu registro...</p>}
        {registro && (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Titular</dt>
              <dd className="mt-1 font-medium">{registro.nombre_completo ?? registro.razon_social}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Documento</dt>
              <dd className="mt-1 font-medium">{registro.tipo_documento ?? "Documento"}: {registro.id_documento}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Correo</dt>
              <dd className="mt-1 font-medium">{registro.correo ?? registro.correo_cuenta}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Celular</dt>
              <dd className="mt-1 font-medium">{registro.telefono ?? "No registrado"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-slate-500">Dirección</dt>
              <dd className="mt-1 font-medium">
                {[registro.direccion, registro.ubigeo_distrito, registro.referencia_domicilio]
                  .filter(Boolean)
                  .join(" · ") || "No registrada"}
              </dd>
            </div>
            {registro.representante_legal && (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Representante legal</dt>
                <dd className="mt-1 font-medium">{registro.representante_legal}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Volver al inicio
          </Link>
          <button
            type="button"
            onClick={logout}
            className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
        </div>
      </section>
    </main>
  );
}
