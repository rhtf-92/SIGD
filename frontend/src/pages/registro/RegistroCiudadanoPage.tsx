import { useState } from "react";
import { Link } from "react-router-dom";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import { apiClient } from "../../api/client";
import { ApiHttpError } from "../../types/api";

export default function RegistroCiudadanoPage() {
  const [activeTab, setActiveTab] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const mostrarErrorRegistro = (error: unknown) => {
    setErrorMessage(
      error instanceof ApiHttpError && error.status === 409
        ? "Ya existe un registro con ese documento o correo. Revise sus datos o inicie sesión."
        : error instanceof ApiHttpError && (error.status === 400 || error.status === 422)
          ? "No se pudo completar el registro. Revise los datos ingresados e inténtelo nuevamente."
          : "No se pudo confirmar el registro. Sus datos se conservan; inténtelo nuevamente cuando el servicio esté disponible.",
    );
  };

  const handleNaturalSubmit = async (data: Natural) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (password.length < 8 || password.length > 128) {
      setErrorMessage("Ingrese una contraseña de entre 8 y 128 caracteres para su cuenta.");
      return;
    }

    const partesApellidos = data.apellidos.trim().split(/\s+/);
    const apellidoPaterno = partesApellidos[0];
    const apellidoMaterno = partesApellidos.slice(1).join(" ");

    const payload = {
      tipoPersona: "NATURAL" as const,
      dni: data.numeroDocumento,
      nombres: data.nombres.trim(),
      apellidoPaterno,
      apellidoMaterno,
      correo: data.correo.trim().toLowerCase(),
      celular: data.celular.trim(),
      ubigeoDistrito: data.domicilio.distritoCodigo,
      direccion: data.domicilio.direccionExacta.trim(),
      password,
      consentimientoDatos: data.consentimientoLey29733,
      aceptaNotificaciones: data.consentimientoLey29733,
    };

    try {
      const respuesta = await apiClient.post<{ idPersona: string; mensaje: string }>("/api/v1/auth/registro-ciudadano", payload);
      if (respuesta.status !== 201 || typeof respuesta.data?.idPersona !== "string" || !respuesta.data.idPersona.trim()) {
        mostrarErrorRegistro(null);
        return;
      }
      setSuccessMessage("Registro completado. Ya puede iniciar sesión con su cuenta.");
    } catch (err) {
      mostrarErrorRegistro(err);
    }
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (password.length < 8 || password.length > 128) {
      setErrorMessage("Ingrese una contraseña de entre 8 y 128 caracteres para su cuenta.");
      return;
    }

    const payload = {
      tipoPersona: "JURIDICA" as const,
      ruc: data.ruc,
      razonSocial: data.razonSocial.trim(),
      partidaRegistral: data.partidaSunarp || undefined,
      dniRepresentante: data.representanteLegal.numeroDocumento,
      nombreRepresentante: `${data.representanteLegal.nombres} ${data.representanteLegal.apellidos}`.trim(),
      correo: data.correoCorporativo.trim().toLowerCase(),
      celular: data.celularContacto.trim(),
      ubigeoDistrito: data.domicilio.distritoCodigo,
      direccion: data.domicilio.direccionExacta.trim(),
      password,
      consentimientoDatos: data.consentimientoLey29733,
      aceptaNotificaciones: data.consentimientoLey29733,
    };

    try {
      const respuesta = await apiClient.post<{ idPersona: string; mensaje: string }>("/api/v1/auth/registro-persona-juridica", payload);
      if (respuesta.status !== 201 || typeof respuesta.data?.idPersona !== "string" || !respuesta.data.idPersona.trim()) {
        mostrarErrorRegistro(null);
        return;
      }
      setSuccessMessage("Registro completado. Ya puede iniciar sesión con su cuenta.");
    } catch (err) {
      mostrarErrorRegistro(err);
    }
  };

  const handleClearSuccess = () => setSuccessMessage(null);

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm max-w-2xl w-full p-8">
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

        <div className="mb-6">
          <label htmlFor="registro-password" className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña para su cuenta *
          </label>
          <input
            id="registro-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="registro-password-ayuda"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p id="registro-password-ayuda" className="text-sm text-gray-600 mt-1">
            Use entre 8 y 128 caracteres. Esta contraseña se utilizará para iniciar sesión.
          </p>
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
          <div role="alert" className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
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
  );
}
