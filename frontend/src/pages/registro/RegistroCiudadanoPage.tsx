import { useState } from "react";
import { Link } from "react-router-dom";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import { apiClient } from "../../api/client";
import { TRAMITE_WIZARD_STORAGE_KEY } from "../../hooks/useTramiteWizardReducer";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validarCamposObligatorios(celular: string, ubigeo: string, direccion: string, password: string, confirmarPassword: string): string | null {
  if (!/^9[0-9]{8}$/.test(celular)) return 'Ingrese un celular real de nueve dígitos que empiece en 9.';
  if (!/^25[0-9]{4}$/.test(ubigeo)) return 'Seleccione un distrito válido de Ucayali.';
  if (direccion.trim().length < 5) return 'Ingrese una dirección real de al menos cinco caracteres.';
  if (password.length < 8 || password.length > 128) return 'La contraseña debe tener entre 8 y 128 caracteres.';
  if (password !== confirmarPassword) return 'La confirmación de contraseña no coincide.';
  return null;
}

export default function RegistroCiudadanoPage() {
  const [activeTab, setActiveTab] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mergeIdPersonaToWizardDraft = (idPersona: string) => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const raw = window.sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.identificacion = {
        ...(parsed.identificacion ?? {}),
        idPersona,
      };
      window.sessionStorage.setItem(TRAMITE_WIZARD_STORAGE_KEY, JSON.stringify(parsed));
    } catch (err) {
      console.warn('[RegistroCiudadano] No se pudo fusionar idPersona en el borrador del wizard:', err);
    }
  };

  const handleNaturalSubmit = async (data: Natural) => {
    const partesApellidos = data.apellidos.trim().split(/\s+/);
    const errorCampos = validarCamposObligatorios(data.celular, data.domicilio?.distritoCodigo ?? '', data.domicilio?.direccionExacta ?? '', data.password, data.confirmarPassword);
    if (errorCampos || partesApellidos.length < 2) {
      setSuccessMessage(null);
      setErrorMessage(errorCampos ?? 'Ingrese ambos apellidos para completar el registro.');
      return;
    }
    const apellidoPaterno = partesApellidos[0];
    const apellidoMaterno = partesApellidos.slice(1).join(' ');

    const payload = {
      tipoPersona: "NATURAL" as const,
      tipoDocumento: data.tipoDocumento,
      ...(data.tipoDocumento === 'CE' ? { ce: data.numeroDocumento } : { dni: data.numeroDocumento }),
      nombres: data.nombres.trim(),
      apellidoPaterno,
      apellidoMaterno,
      correo: data.correo.trim().toLowerCase(),
      celular: data.celular,
      ubigeoDistrito: data.domicilio.distritoCodigo,
      direccion: data.domicilio.direccionExacta.trim(),
      password: data.password,
      consentimientoDatos: true as const,
      aceptaNotificaciones: false,
    };

    try {
      const res = await apiClient.post("/api/v1/auth/registro-ciudadano", payload);
      const idPersona = res.data?.idPersona ?? res.data?.personaId;

      if (
        res.status !== 201 ||
        !idPersona ||
        typeof idPersona !== "string" ||
        !UUID_REGEX.test(idPersona.trim())
      ) {
        throw new Error(
          res.data?.detail ||
          res.data?.message ||
          "El servidor no devolvió una confirmación válida con idPersona canónico (UUID) para el registro ciudadano."
        );
      }

      mergeIdPersonaToWizardDraft(idPersona.trim());
      setErrorMessage(null);
      setSuccessMessage('Registro completado. Ya puede iniciar sesión con la contraseña que eligió.');
    } catch (err: any) {
      setSuccessMessage(null);
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Error al procesar el registro en el servidor. Verifique su conexión.";
      setErrorMessage(msg);
    }
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    if (data.representanteLegal.tipoDocumento !== 'DNI') {
      setSuccessMessage(null);
      setErrorMessage('El representante legal debe identificarse con DNI según el contrato actual.');
      return;
    }
    const errorCampos = validarCamposObligatorios(data.celularContacto, data.domicilio?.distritoCodigo ?? '', data.domicilio?.direccionExacta ?? '', data.password, data.confirmarPassword);
    if (errorCampos) {
      setSuccessMessage(null);
      setErrorMessage(errorCampos);
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
      celular: data.celularContacto,
      ubigeoDistrito: data.domicilio.distritoCodigo,
      direccion: data.domicilio.direccionExacta.trim(),
      password: data.password,
      consentimientoDatos: true as const,
      aceptaNotificaciones: false,
    };

    try {
      const res = await apiClient.post("/api/v1/auth/registro-persona-juridica", payload);
      const idPersona = res.data?.idPersona ?? res.data?.personaId;

      if (
        res.status !== 201 ||
        !idPersona ||
        typeof idPersona !== "string" ||
        !UUID_REGEX.test(idPersona.trim())
      ) {
        throw new Error(
          res.data?.detail ||
          res.data?.message ||
          "El servidor no devolvió una confirmación válida con idPersona canónico (UUID) para el registro de persona jurídica."
        );
      }

      mergeIdPersonaToWizardDraft(idPersona.trim());
      setErrorMessage(null);
      setSuccessMessage('Registro completado. Ya puede iniciar sesión con la contraseña que eligió.');
    } catch (err: any) {
      setSuccessMessage(null);
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Error al procesar el registro en el servidor. Verifique su conexión.";
      setErrorMessage(msg);
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
          >
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
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
