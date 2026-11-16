import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { ApiHttpError } from "../../types/api";

export default function ActivarCuentaPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenParam = searchParams.get("token") || "";

  const [tokenInput, setTokenInput] = useState(tokenParam);
  const [estado, setEstado] = useState<"IDLE" | "CARGANDO" | "EXITO" | "ERROR">("IDLE");
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [codigoError, setCodigoError] = useState<string | null>(null);

  // Estados para reenvío de activación
  const [identificadorReenvio, setIdentificadorReenvio] = useState("");
  const [enviandoReenvio, setEnviandoReenvio] = useState(false);
  const [mensajeReenvio, setMensajeReenvio] = useState<string | null>(null);
  const [errorReenvio, setErrorReenvio] = useState<string | null>(null);

  const ejecutarActivacion = async (tok: string) => {
    if (!tok.trim()) {
      setMensajeError("Por favor ingrese o proporcione un token de activación válido.");
      setEstado("ERROR");
      return;
    }

    setEstado("CARGANDO");
    setMensajeError(null);
    setCodigoError(null);

    try {
      const resp = await apiClient.post<{
        exito: boolean;
        mensaje: string;
        idUsuario: string;
        correo: string;
      }>("/api/v1/auth/activar-cuenta", { token: tok.trim() });

      if (resp.status === 200 && resp.data?.exito) {
        setMensajeExito(
          resp.data.mensaje ||
            "¡Cuenta activada exitosamente! Su Casilla Electrónica Institucional ha sido habilitada."
        );
        setEstado("EXITO");
      } else {
        throw new Error("No se pudo verificar la activación.");
      }
    } catch (err) {
      setEstado("ERROR");
      if (err instanceof ApiHttpError) {
        setCodigoError(err.problemDetails?.code || null);
        if (err.status === 410 || err.problemDetails?.code === "TOKEN_EXPIRADO") {
          setMensajeError("El enlace de activación ha expirado (plazo máximo: 24 horas). Solicite un nuevo enlace de activación a continuación.");
        } else if (err.status === 409 || err.problemDetails?.code === "TOKEN_YA_UTILIZADO") {
          setMensajeError("Este enlace de activación ya ha sido utilizado previamente. Su cuenta ya se encuentra activa.");
        } else if (err.status === 404 || err.problemDetails?.code === "TOKEN_INVALIDO") {
          setMensajeError("El enlace o código de activación es inválido o no existe en el sistema.");
        } else {
          setMensajeError(err.problemDetails?.detail || err.message || "Error al procesar la activación.");
        }
      } else {
        setMensajeError("Ocurrió un error inesperado al procesar la activación. Verifique su conexión.");
      }
    }
  };

  useEffect(() => {
    if (tokenParam) {
      ejecutarActivacion(tokenParam);
    }
  }, [tokenParam]);

  const handleReenviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificadorReenvio.trim()) {
      setErrorReenvio("Ingrese su número de documento o correo electrónico.");
      return;
    }

    setEnviandoReenvio(true);
    setMensajeReenvio(null);
    setErrorReenvio(null);

    try {
      const resp = await apiClient.post<{
        exito: boolean;
        mensaje: string;
        correo?: string;
      }>("/api/v1/auth/reenviar-verificacion", {
        identificador: identificadorReenvio.trim(),
      });

      setMensajeReenvio(
        resp.data?.mensaje ||
          "Se ha enviado un nuevo enlace de activación a su correo electrónico institucional."
      );
    } catch (err) {
      if (err instanceof ApiHttpError && err.problemDetails?.code === "CUENTA_YA_ACTIVA") {
        setErrorReenvio("Su cuenta ya se encuentra activa. Puede iniciar sesión directamente.");
      } else {
        setErrorReenvio("No se pudo completar el reenvío. Verifique los datos ingresados.");
      }
    } finally {
      setEnviandoReenvio(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-lg w-full p-8">
        <div className="mb-6 flex justify-between items-center">
          <Link
            to="/"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            ← Inicio
          </Link>
          <span className="text-xs px-2.5 py-1 bg-blue-100 text-[#006EC7] font-semibold rounded-full">
            SIGD Suiza 2026
          </span>
        </div>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-50 text-[#006EC7] rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Activación de Casilla Electrónica
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Validación de identidad institucional y habilitación de cuenta procesal
          </p>
        </div>

        {/* Estado: CARGANDO */}
        {estado === "CARGANDO" && (
          <div className="py-8 text-center space-y-3" role="status">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-700">
              Verificando su enlace de activación institucional...
            </p>
          </div>
        )}

        {/* Estado: EXITO */}
        {estado === "EXITO" && (
          <div className="space-y-6">
            <div
              className="p-5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-sm space-y-2"
              role="alert"
            >
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>¡Activación Exitosa!</span>
              </div>
              <p>{mensajeExito}</p>
              <p className="text-xs text-emerald-700 pt-1 border-t border-emerald-200">
                Conforme al TUO de la Ley N° 27444, las notificaciones depositadas en su Casilla Electrónica surten plenos efectos jurídicos.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full py-3 px-4 bg-[#006EC7] hover:bg-[#005bb5] text-white font-semibold rounded-lg shadow transition focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Iniciar Sesión en el SIGD
              </button>
            </div>
          </div>
        )}

        {/* Estado: ERROR */}
        {estado === "ERROR" && (
          <div className="space-y-5">
            <div
              className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-sm space-y-1.5"
              role="alert"
            >
              <div className="flex items-center gap-2 text-rose-800 font-bold">
                <svg className="w-5 h-5 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>No se pudo activar la cuenta</span>
              </div>
              <p>{mensajeError}</p>
            </div>

            {codigoError === "TOKEN_YA_UTILIZADO" && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full py-2.5 px-4 bg-[#006EC7] hover:bg-[#005bb5] text-white font-semibold rounded-lg shadow text-sm transition"
              >
                Ir a Iniciar Sesión
              </button>
            )}

            {/* Formulario de reenvío */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                ¿Necesita un nuevo enlace de activación?
              </h3>
              <form onSubmit={handleReenviar} className="space-y-3">
                <label className="block text-xs font-medium text-slate-600">
                  Número de documento o correo electrónico
                  <input
                    type="text"
                    value={identificadorReenvio}
                    onChange={(e) => setIdentificadorReenvio(e.target.value)}
                    placeholder="Ej. 74561238 o usuario@correo.com"
                    className="mt-1 w-full p-2.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={enviandoReenvio}
                  />
                </label>

                {errorReenvio && (
                  <p className="text-xs text-rose-600 font-medium" role="alert">
                    {errorReenvio}
                  </p>
                )}
                {mensajeReenvio && (
                  <p className="text-xs text-emerald-700 font-medium bg-emerald-50 p-2 rounded border border-emerald-200" role="status">
                    {mensajeReenvio}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviandoReenvio || !identificadorReenvio.trim()}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                >
                  {enviandoReenvio ? "Enviando..." : "Solicitar nuevo enlace"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Estado: IDLE (Si se ingresó sin token) */}
        {estado === "IDLE" && !tokenParam && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              Si cuenta con un código o token de activación recibido por correo electrónico, ingréselo a continuación para habilitar su Casilla Electrónica:
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ejecutarActivacion(tokenInput);
              }}
              className="space-y-4"
            >
              <label className="block text-xs font-medium text-slate-700">
                Código o Token de Activación
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Pegue aquí el token recibido"
                  className="mt-1 w-full p-2.5 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <button
                type="submit"
                disabled={!tokenInput.trim()}
                className="w-full py-2.5 px-4 bg-[#006EC7] hover:bg-[#005bb5] text-white font-semibold rounded-lg shadow text-sm transition disabled:opacity-50"
              >
                Activar Cuenta y Casilla
              </button>
            </form>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-bold text-slate-700 mb-2">
                ¿No recibió el correo de verificación?
              </h3>
              <form onSubmit={handleReenviar} className="space-y-2.5">
                <input
                  type="text"
                  value={identificadorReenvio}
                  onChange={(e) => setIdentificadorReenvio(e.target.value)}
                  placeholder="DNI, RUC o Correo electrónico"
                  className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={enviandoReenvio}
                />
                {errorReenvio && (
                  <p className="text-xs text-rose-600">{errorReenvio}</p>
                )}
                {mensajeReenvio && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded" role="status">{mensajeReenvio}</p>
                )}
                <button
                  type="submit"
                  disabled={enviandoReenvio || !identificadorReenvio.trim()}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded transition disabled:opacity-50"
                >
                  {enviandoReenvio ? "Enviando..." : "Reenviar enlace de activación"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
