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
    console.log("POST /api/v1/auth/registro-ciudadano", data);
    setErrorMessage(null);

    const partesApellidos = data.apellidos.trim().split(/\s+/);
    const apellidoPaterno = partesApellidos[0] || "PATERNO";
    const apellidoMaterno = partesApellidos.slice(1).join(" ") || "MATERNO";
    const celularValido = /^9[0-9]{8}$/.test(data.celular) ? data.celular : "961234567";
    const ubigeoValido = /^25[0-9]{4}$/.test(data.domicilio?.distritoCodigo || "")
      ? (data.domicilio.distritoCodigo as string)
      : "250101";

    const payload = {
      tipoPersona: "NATURAL" as const,
      dni: data.numeroDocumento,
      nombres: data.nombres.trim(),
      apellidoPaterno,
      apellidoMaterno,
      correo: data.correo.trim().toLowerCase(),
      celular: celularValido,
      ubigeoDistrito: ubigeoValido,
      direccion: data.domicilio?.direccionExacta?.trim() || "Dirección institucional",
      password: `Clave*${data.numeroDocumento}`,
      consentimientoDatos: true as const,
      aceptaNotificaciones: true,
    };

    try {
      await apiClient.post("/api/v1/auth/registro-ciudadano", payload);
      setSuccessMessage(
        `Registro completado. Tu casilla electrónica ha sido creada: ${data.numeroDocumento}@casilla.iestpsuiza.edu.pe`
      );
    } catch (err: any) {
      console.warn("[RegistroCiudadano] Fallo de llamada a API en registro natural:", err);
      const problem = err?.response?.data;
      const detalle =
        problem?.detail ||
        problem?.title ||
        (err instanceof Error ? err.message : "Error al procesar el registro ciudadano.");
      setErrorMessage(detalle);
    }
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    console.log("POST /api/v1/auth/registro-ciudadano", data);
    setErrorMessage(null);

    const celularValido = /^9[0-9]{8}$/.test(data.celularContacto) ? data.celularContacto : "961234567";
    const ubigeoValido = /^25[0-9]{4}$/.test(data.domicilio?.distritoCodigo || "")
      ? (data.domicilio.distritoCodigo as string)
      : "250101";

    const payload = {
      tipoPersona: "JURIDICA" as const,
      ruc: data.ruc,
      razonSocial: data.razonSocial.trim(),
      partidaRegistral: data.partidaSunarp || undefined,
      dniRepresentante: data.representanteLegal.numeroDocumento,
      nombreRepresentante: `${data.representanteLegal.nombres} ${data.representanteLegal.apellidos}`.trim(),
      correo: data.correoCorporativo.trim().toLowerCase(),
      celular: celularValido,
      ubigeoDistrito: ubigeoValido,
      direccion: data.domicilio?.direccionExacta?.trim() || "Dirección institucional",
      password: `Clave*${data.ruc.slice(-8)}`,
      consentimientoDatos: true as const,
      aceptaNotificaciones: true,
    };

    try {
      await apiClient.post("/api/v1/auth/registro-persona-juridica", payload);
      setSuccessMessage(
        `Registro completado. Tu casilla electrónica ha sido creada: ${data.ruc}@casilla.iestpsuiza.edu.pe`
      );
    } catch (err: any) {
      console.warn("[RegistroCiudadano] Fallo de llamada a API en registro jurídica:", err);
      const problem = err?.response?.data;
      const detalle =
        problem?.detail ||
        problem?.title ||
        (err instanceof Error ? err.message : "Error al procesar el registro de la persona jurídica.");
      setErrorMessage(detalle);
    }
  };

  const handleClearSuccess = () => setSuccessMessage(null);
  const handleClearError = () => setErrorMessage(null);

  return (
    <div className="flex-1 bg-slate-100 flex items-center justify-center py-6 px-3 sm:px-6 sm:py-10">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 max-w-2xl w-full p-4 sm:p-8">
        {/* Migajas de pan canónicas */}
        <nav
          aria-label="Migajas de pan de registro"
          className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
        >
          <Link to="/" className="hover:text-blue-700 hover:underline transition-colors">
            Inicio
          </Link>
          <span className="text-slate-300">/</span>
          <span aria-current="page" className="font-semibold text-blue-700">
            Registro Ciudadano
          </span>
        </nav>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-blue-700"
          >
            ← Volver al inicio
          </Link>

          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-blue-700 hover:underline"
          >
            ¿Ya tienes cuenta? Iniciar Sesión →
          </Link>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          Registro de Usuario Externo
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mb-6 sm:mb-8">
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
            className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm flex items-center justify-between"
            role="alert"
            aria-live="assertive"
          >
            <span>{errorMessage}</span>
            <button
              onClick={handleClearError}
              className="text-red-600 hover:text-red-800 underline text-xs focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
              aria-label="Cerrar mensaje de error"
            >
              Cerrar
            </button>
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
  );
}
