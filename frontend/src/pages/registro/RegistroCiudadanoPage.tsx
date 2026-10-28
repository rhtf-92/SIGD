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
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-teal-50/20 flex items-center justify-center p-3.5 sm:p-6 lg:p-8">
      {/* Halo ambiental suave estilo Aqua / Glass */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-cyan-200/25 blur-3xl" />
      </div>

      <div className="relative overflow-hidden bg-gradient-to-br from-white/92 via-cyan-50/40 to-sky-50/25 rounded-3xl border border-white/85 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(6,182,212,0.06),0_16px_48px_-8px_rgba(6,182,212,0.14),0_2px_12px_-2px_rgba(0,0,0,0.02)] ring-1 ring-cyan-200/50 backdrop-blur-md max-w-2xl w-full p-5 sm:p-8 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent after:pointer-events-none after:absolute after:-top-24 after:-right-24 after:h-48 after:w-48 after:rounded-full after:bg-cyan-300/15 after:blur-2xl">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-cyan-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-cyan-50/80 hover:border-cyan-300 transition"
        >
          ← Volver al inicio
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">IESTP &quot;Suiza&quot;</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Registro de Usuario Externo
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Complete sus datos para crear su cuenta y Casilla Electrónica
          Institucional
        </p>

        <div className="mb-6 rounded-xl border border-cyan-300/80 bg-gradient-to-r from-cyan-50/70 to-teal-50/50 p-3.5 text-xs text-cyan-950 flex items-start gap-2 shadow-2xs backdrop-blur-xs">
          <span>ℹ️ <strong>Tratamiento de Datos Personales:</strong> Los datos proporcionados serán tratados por el IESTP Suiza para fines de identificación, gestión documentaria y comunicaciones institucionales, en ejercicio de sus funciones públicas y conforme a la Ley N.° 29733 y su Reglamento (D.S. N.° 016-2024-JUS).</span>
        </div>

        <div
          role="tablist"
          aria-label="Tipo de persona"
          className="flex gap-1 mb-8 border-b border-cyan-100"
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
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-md transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
              activeTab === "NATURAL"
                ? "text-cyan-900 border-b-2 border-cyan-600 bg-cyan-50/50"
                : "text-slate-500 hover:text-slate-700 border-b-2 border-transparent"
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
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-md transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
              activeTab === "JURIDICA"
                ? "text-cyan-900 border-b-2 border-cyan-600 bg-cyan-50/50"
                : "text-slate-500 hover:text-slate-700 border-b-2 border-transparent"
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
