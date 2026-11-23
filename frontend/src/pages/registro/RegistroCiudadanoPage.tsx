import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import { apiClient } from "../../api/client";
import { ApiHttpError } from "../../types/api";

interface RegistroApiResponse {
  idPersona?: string;
  idUsuario?: string;
  idCasilla?: string;
  cvdCasilla?: string;
  correo?: string;
  mensaje?: string;
  activo?: boolean;
  casillaHabilitada?: boolean;
}

interface RegistroConfirmado {
  idPersona: string;
  idUsuario?: string;
  idCasilla?: string;
  cvdCasilla?: string;
  correo: string;
  activo: true;
  casillaHabilitada: true;
}

export default function RegistroCiudadanoPage() {
  const [activeTab, setActiveTab] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [registroConfirmado, setRegistroConfirmado] = useState<RegistroConfirmado | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [capacidades, setCapacidades] = useState({ domicilio: false, verificacionContacto: false });
  const [enviando, setEnviando] = useState(false);

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
        : error instanceof ApiHttpError && error.problemDetails.code === "CASILLA_OPENING_FAILED"
          ? "No se pudo confirmar la apertura formal de su Casilla Electrónica. No se creó ninguna cuenta; inténtelo nuevamente."
        : error instanceof ApiHttpError && (error.status === 400 || error.status === 422)
          ? "No se pudo completar el registro. Revise los datos ingresados e inténtelo nuevamente."
          : "No se pudo confirmar el registro. Sus datos se conservan; inténtelo nuevamente cuando el servicio esté disponible.",
    );
  };

  const procesarRespuestaRegistro = (
    status: number,
    data: RegistroApiResponse | undefined,
    correoFallback: string,
  ) => {
    const confirmado =
      status === 201 &&
      typeof data?.idPersona === "string" &&
      data.idPersona.trim().length > 0 &&
      data.activo === true &&
      data.casillaHabilitada === true;

    if (!confirmado || !data?.idPersona) {
      mostrarErrorRegistro(null);
      return;
    }

    setRegistroConfirmado({
      idPersona: data.idPersona,
      idUsuario: data.idUsuario,
      idCasilla: data.idCasilla,
      cvdCasilla: data.cvdCasilla,
      correo: data.correo ?? correoFallback,
      activo: true,
      casillaHabilitada: true,
    });
    setPassword("");
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNaturalSubmit = async (data: Natural) => {
    if (enviando) return;
    setRegistroConfirmado(null);
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
      const respuesta = await apiClient.post<RegistroApiResponse>("/api/v1/auth/registro-ciudadano", payload);
      procesarRespuestaRegistro(respuesta.status, respuesta.data, payload.correo);
    } catch (err) {
      mostrarErrorRegistro(err);
    } finally {
      setEnviando(false);
    }
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    if (enviando) return;
    setRegistroConfirmado(null);
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
      const respuesta = await apiClient.post<RegistroApiResponse>("/api/v1/auth/registro-persona-juridica", payload);
      procesarRespuestaRegistro(respuesta.status, respuesta.data, payload.correo);
    } catch (err) {
      mostrarErrorRegistro(err);
    } finally {
      setEnviando(false);
    }
  };

  if (registroConfirmado) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-md border border-slate-200 max-w-xl w-full p-8 sm:p-10 text-center space-y-6"
          role="status"
          aria-live="polite"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#082F7C] text-xs font-semibold tracking-wide uppercase">
            SIGD RENATO · IESTP «Suiza»
          </div>

          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center shadow-inner">
            <svg
              className="w-9 h-9 text-emerald-600"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">
              ¡Registro realizado exitosamente!
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Tu cuenta y tu Casilla Electrónica Institucional se han creado correctamente. Ya puedes ingresar al sistema con tu DNI y contraseña.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left space-y-3 max-w-md mx-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-medium text-slate-700">Cuenta institucional:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                ACTIVA
              </span>
            </div>

            <div className={`flex items-center justify-between ${registroConfirmado.cvdCasilla ? "border-b border-slate-200 pb-3" : ""}`}>
              <span className="text-sm font-medium text-slate-700">Casilla electrónica:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                HABILITADA
              </span>
            </div>

            {registroConfirmado.cvdCasilla && (
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs font-medium text-slate-500">Código de apertura (CVD):</span>
                <span className="text-xs font-mono font-semibold text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200">
                  {registroConfirmado.cvdCasilla}
                </span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full sm:w-auto min-w-[220px] px-8 py-3.5 bg-[#006EC7] hover:bg-[#005bb5] text-white text-sm font-bold tracking-wide uppercase rounded-xl shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#006EC7] focus:ring-offset-2"
            >
              INICIAR SESIÓN
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              setRegistroConfirmado(null);
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
              setRegistroConfirmado(null);
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
            Esta contraseña le permitirá ingresar de inmediato al SIGD y a su Casilla Electrónica.
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
      </div>
    </div>
  );
}
