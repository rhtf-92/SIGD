import { useState, useEffect } from "react";
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
  const [capacidades, setCapacidades] = useState({ domicilio: false, verificacionContacto: false });
  const [enviando, setEnviando] = useState(false);
  const [tokenActivacion, setTokenActivacion] = useState<string | null>(null);
  const [correoRegistrado, setCorreoRegistrado] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    apiClient.get<{ domicilio: boolean; verificacionContacto: boolean }>("/api/v1/auth/registro-capacidades")
      .then(({ data }) => { if (vigente) setCapacidades({ domicilio: data.domicilio === true, verificacionContacto: data.verificacionContacto === true }); })
      .catch(() => { /* Keep the minimal account form; never guess storage support. */ });
    return () => { vigente = false; };
  }, []);

  const mostrarErrorRegistro = (error: unknown) => {
    setErrorMessage(
      error instanceof ApiHttpError && error.problemDetails.code === "CITIZEN_IDENTITY_CONFLICT"
        ? "No fue posible comprobar la correspondencia de su identidad. Revise los datos o solicite validación institucional presencial."
        : error instanceof ApiHttpError && error.problemDetails.code === "REPRESENTANTE_NO_REGISTRADO"
        ? "El representante legal debe tener su identidad registrada antes de solicitar la cuenta jurídica."
        : error instanceof ApiHttpError && error.status === 409
        ? "Ya existe un registro con ese documento o correo. Revise sus datos o inicie sesión."
        : error instanceof ApiHttpError && error.problemDetails.code === "REGISTRO_MODELO_NO_COMPATIBLE"
          ? "No se pudo confirmar el registro: el modelo de datos vigente no permite guardar todos los datos requeridos. No se creó ninguna cuenta."
        : error instanceof ApiHttpError && (error.status === 400 || error.status === 422)
          ? "No se pudo completar el registro. Revise los datos ingresados e inténtelo nuevamente."
          : "No se pudo confirmar el registro. Sus datos se conservan; inténtelo nuevamente cuando el servicio esté disponible.",
    );
  };

  const handleNaturalSubmit = async (data: Natural) => {
    if (enviando) return;
    setSuccessMessage(null);
    setErrorMessage(null);
    setTokenActivacion(null);
    setCorreoRegistrado(null);
    if (password.length < 8 || password.length > 128) {
      setErrorMessage("Ingrese una contraseña de entre 8 y 128 caracteres para su cuenta.");
      return;
    }

    const partesApellidos = data.apellidos.trim().split(/\s+/);
    const apellidoPaterno = partesApellidos[0];
    const apellidoMaterno = partesApellidos.slice(1).join(" ");

    const payload = {
      tipoPersona: "NATURAL" as const,
      dni: data.tipoDocumento === "DNI" ? data.numeroDocumento : undefined,
      tipoDocumento: data.tipoDocumento,
      numeroDocumento: data.numeroDocumento,
      nombres: data.nombres.trim(),
      apellidoPaterno,
      apellidoMaterno,
      fechaNacimiento: data.fechaNacimiento,
      correo: data.correo.trim().toLowerCase(),
      celular: data.celular.trim(),
      ...(capacidades.domicilio ? { ubigeoDistrito: data.domicilio.distritoCodigo,
        direccion: data.domicilio.direccionExacta.trim(), referencia: data.domicilio.referencia?.trim() } : {}),
      password,
      consentimientoDatos: data.consentimientoLey29733,
      declaracionJuradaAceptada: data.declaracionJuradaAceptada,
      aceptaNotificaciones: false,
      versionPolitica: data.version,
    };

    setEnviando(true);
    try {
      const respuesta = await apiClient.post<{ idPersona: string; idUsuario?: string; tokenVerificacion?: string; mensaje: string }>("/api/v1/auth/registro-ciudadano", payload);
      if (respuesta.status !== 201 || typeof respuesta.data?.idPersona !== "string" || !respuesta.data.idPersona.trim()) {
        mostrarErrorRegistro(null);
        return;
      }
      if (respuesta.data?.tokenVerificacion) {
        setTokenActivacion(respuesta.data.tokenVerificacion);
      }
      setCorreoRegistrado(payload.correo);
      setSuccessMessage("Registro completado. Ya puede iniciar sesión con su cuenta. Hemos enviado un enlace de activación a tu correo electrónico (" + payload.correo + "). Revisa tu bandeja de entrada para activar tu cuenta y acceder a tu Casilla Electrónica.");
    } catch (err) {
      mostrarErrorRegistro(err);
    } finally {
      setEnviando(false);
    }
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    if (enviando) return;
    setSuccessMessage(null);
    setErrorMessage(null);
    setTokenActivacion(null);
    setCorreoRegistrado(null);
    if (password.length < 8 || password.length > 128) {
      setErrorMessage("Ingrese una contraseña de entre 8 y 128 caracteres para su cuenta.");
      return;
    }

    const payload = {
      tipoPersona: "JURIDICA" as const,
      ruc: data.ruc,
      razonSocial: data.razonSocial.trim(),
      partidaRegistral: data.partidaSunarp || undefined,
      tipoDocumentoRepresentante: data.representanteLegal.tipoDocumento,
      numeroDocumentoRepresentante: data.representanteLegal.numeroDocumento,
      dniRepresentante: data.representanteLegal.tipoDocumento === "DNI"
        ? data.representanteLegal.numeroDocumento
        : undefined,
      nombreRepresentante: `${data.representanteLegal.nombres} ${data.representanteLegal.apellidos}`.trim(),
      cargoRepresentante: data.representanteLegal.cargo.trim(),
      correo: data.correoCorporativo.trim().toLowerCase(),
      celular: data.celularContacto.trim(),
      ...(capacidades.domicilio ? { ubigeoDistrito: data.domicilio.distritoCodigo,
        direccion: data.domicilio.direccionExacta.trim(), referencia: data.domicilio.referencia?.trim() } : {}),
      password,
      consentimientoDatos: data.consentimientoLey29733,
      declaracionJuradaAceptada: data.declaracionJuradaAceptada,
      aceptaNotificaciones: false,
      versionPolitica: data.version,
    };

    setEnviando(true);
    try {
      const respuesta = await apiClient.post<{ idPersona: string; idUsuario?: string; tokenVerificacion?: string; mensaje: string }>("/api/v1/auth/registro-persona-juridica", payload);
      if (respuesta.status !== 201 || typeof respuesta.data?.idPersona !== "string" || !respuesta.data.idPersona.trim()) {
        mostrarErrorRegistro(null);
        return;
      }
      if (respuesta.data?.tokenVerificacion) {
        setTokenActivacion(respuesta.data.tokenVerificacion);
      }
      setCorreoRegistrado(payload.correo);
      setSuccessMessage("Registro completado. Ya puede iniciar sesión con su cuenta. Hemos enviado un enlace de activación a tu correo corporativo (" + payload.correo + "). Revisa tu bandeja de entrada para activar tu cuenta y acceder a tu Casilla Electrónica.");
    } catch (err) {
      mostrarErrorRegistro(err);
    } finally {
      setEnviando(false);
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
          <label
            htmlFor="cuenta-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Contraseña para su cuenta *
          </label>
          <input
            id="cuenta-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Entre 8 y 128 caracteres"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006EC7] focus:border-transparent text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Esta contraseña le permitirá ingresar al SIGD una vez activada su cuenta.
          </p>
        </div>

        <div
          id="panel-natural"
          role="tabpanel"
          aria-labelledby="tab-natural"
          hidden={activeTab !== "NATURAL"}
        >
          {activeTab === "NATURAL" && (
            <PersonaNaturalForm onSubmit={handleNaturalSubmit} solicitarDomicilio={capacidades.domicilio} />
          )}
        </div>

        <div
          id="panel-juridica"
          role="tabpanel"
          aria-labelledby="tab-juridica"
          hidden={activeTab !== "JURIDICA"}
        >
          {activeTab === "JURIDICA" && (
            <PersonaJuridicaForm onSubmit={handleJuridicaSubmit} solicitarDomicilio={capacidades.domicilio} />
          )}
        </div>

        {errorMessage && (
          <div role="alert" className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="mt-6 p-5 bg-green-50 border border-green-200 rounded-lg text-green-900 text-sm space-y-3"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 font-bold text-green-800 text-base">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>¡Registro Recibido con Éxito!</span>
              </div>
              <button
                onClick={handleClearSuccess}
                className="text-green-600 hover:text-green-800 underline text-xs focus:outline-none focus:ring-2 focus:ring-green-500 rounded"
                aria-label="Cerrar mensaje de éxito"
              >
                Cerrar
              </button>
            </div>
            <p className="text-sm">{successMessage}</p>
            {correoRegistrado && (
              <p className="text-xs text-green-800 bg-green-100 p-2 rounded">
                Verificación enviada al buzón: <span className="font-semibold">{correoRegistrado}</span>
              </p>
            )}
            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                to={tokenActivacion ? `/activar-cuenta?token=${tokenActivacion}` : "/activar-cuenta"}
                className="inline-flex items-center px-4 py-2 bg-[#006EC7] hover:bg-[#005bb5] text-white text-xs font-semibold rounded-md shadow transition"
              >
                Activar Mi Cuenta y Habilitar Casilla →
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-md transition"
              >
                Ir a Iniciar Sesión
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
