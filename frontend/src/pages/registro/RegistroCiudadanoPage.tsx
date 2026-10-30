import { useState } from "react";
import { Link } from "react-router-dom";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import { apiClient } from "../../api/client";

export default function RegistroCiudadanoPage() {
  const [activeTab, setActiveTab] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleNaturalSubmit = async (data: Natural) => {
    setErrorMessage(null);

    const payload = {
      tipoPersona: "NATURAL" as const,
      dni: data.numeroDocumento,
      nombres: data.nombres.trim(),
      apellidoPaterno: data.apellidos.trim().split(/\s+/)[0],
      apellidoMaterno: data.apellidos.trim().split(/\s+/).slice(1).join(" "),
      correo: data.correo.trim().toLowerCase(),
      celular: data.celular,
      ubigeoDistrito: data.domicilio.distritoCodigo,
      direccion: data.domicilio.direccionExacta.trim(),
      password: data.password,
      consentimientoDatos: true as const,
      aceptaNotificaciones: true,
    };

    try {
      await apiClient.post("/api/v1/auth/registro-ciudadano", payload);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `No se pudo completar el registro. ${err.message}`
          : "No se pudo completar el registro. Intente nuevamente.",
      );
      return;
    }

    setSuccessMessage(
      "Registro completado. Ya puedes iniciar sesión con tu DNI."
    );
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    setErrorMessage(null);

    const payload = {
      tipoPersona: "JURIDICA" as const,
      ruc: data.ruc,
      razonSocial: data.razonSocial.trim(),
      partidaRegistral: data.partidaSunarp || undefined,
      dniRepresentante: data.representanteLegal.numeroDocumento,
      nombreRepresentante: `${data.representanteLegal.nombres} ${data.representanteLegal.apellidos}`.trim(),
      correo: data.correoCorporativo.trim().toLowerCase(),
      celular: data.celularContacto,
      ubigeoDistrito: data.domicilio.distritoCodigo,
      direccion: data.domicilio.direccionExacta.trim(),
      password: data.password,
      consentimientoDatos: true as const,
      aceptaNotificaciones: true,
    };

    try {
      await apiClient.post("/api/v1/auth/registro-persona-juridica", payload);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `No se pudo completar el registro. ${err.message}`
          : "No se pudo completar el registro. Intente nuevamente.",
      );
      return;
    }

    setSuccessMessage(
      "Registro completado. Ya puedes iniciar sesión con tu RUC."
    );
  };

  const handleClearSuccess = () => setSuccessMessage(null);

  return (
    <div className="sigd-registration min-h-screen flex items-center justify-center p-4">
      <div className="sigd-auth-shell">
        <aside aria-hidden="true" className="sigd-auth-visual">
          <img alt="" height={720} loading="lazy" src="/img/entrada.jpg" width={480} />
        </aside>
        <div className="sigd-registration-card max-w-2xl w-full bg-white rounded-lg p-8">
        <img
          alt="Escudo del Instituto Suiza"
          className="sigd-brand-logo sigd-auth-form-logo"
          height={44}
          loading="lazy"
          src="/img/logo.jpg"
          width={44}
        />
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          ← Volver al inicio
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Registro de Usuario Externo
        </h1>
        <p className="text-sm text-gray-600 mb-8">
          Complete sus datos para crear su cuenta y Casilla Electrónica
          Institucional
        </p>

        <div
          role="tablist"
          aria-label="Tipo de persona"
          className="flex gap-1 mb-8 border-b border-gray-200"
        >
          <button
            role="tab"
            aria-selected={activeTab === "NATURAL"}
            aria-controls="panel-natural"
            id="tab-natural"
            onClick={() => {
              setActiveTab("NATURAL");
              setSuccessMessage(null);
              setErrorMessage(null);
            }}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#006EC7] focus:ring-offset-2 ${
              activeTab === "NATURAL"
                ? "text-[#006EC7] border-b-2 border-[#006EC7]"
                : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
            }`}
          >
            Persona Natural
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "JURIDICA"}
            aria-controls="panel-juridica"
            id="tab-juridica"
            onClick={() => {
              setActiveTab("JURIDICA");
              setSuccessMessage(null);
              setErrorMessage(null);
            }}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#006EC7] focus:ring-offset-2 ${
              activeTab === "JURIDICA"
                ? "text-[#006EC7] border-b-2 border-[#006EC7]"
                : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
            }`}
          >
            Persona Jurídica
          </button>
        </div>

        <div
          role="tabpanel"
          id="panel-natural"
          aria-labelledby="tab-natural"
          hidden={activeTab !== "NATURAL"}
        >
          {activeTab === "NATURAL" && (
            <PersonaNaturalForm onSubmit={handleNaturalSubmit} />
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-juridica"
          aria-labelledby="tab-juridica"
          hidden={activeTab !== "JURIDICA"}
        >
          {activeTab === "JURIDICA" && (
            <PersonaJuridicaForm onSubmit={handleJuridicaSubmit} />
          )}
        </div>

        {errorMessage && (
          <div
            className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm"
            role="alert"
            aria-live="assertive"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm flex items-center justify-between"
            role="status"
            aria-live="polite"
          >
            <span>{successMessage}</span>
            <button
              onClick={handleClearSuccess}
              className="text-green-600 hover:text-green-800 underline text-xs focus:outline-none focus:ring-2 focus:ring-green-500 rounded"
              aria-label="Cerrar mensaje de éxito"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
