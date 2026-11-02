import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import { apiClient } from "../../api/client";
import { ApiHttpError } from "../../types/api";
import { AlertCircle, ArrowLeft, Building2, CheckCircle2, ShieldCheck, UserRound } from "lucide-react";

export default function RegistroCiudadanoPage() {
  const [activeTab, setActiveTab] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mostrarErrorRegistro = (error: unknown) => {
    setSuccessMessage(null);
    setErrorMessage(
      error instanceof ApiHttpError
        ? error.problemDetails.code === "ERR_NETWORK"
          ? "No se pudo conectar con el servidor de registro. Verifique que el backend esté iniciado y accesible; sus datos permanecen en el formulario para que pueda intentarlo nuevamente."
          : error.problemDetails.code === "ERR_TIMEOUT"
            ? "El servidor de registro tardó demasiado en responder. Verifique su conexión e inténtelo nuevamente; sus datos permanecen en el formulario."
            : error.problemDetails.detail
        : "No fue posible completar el registro. Verifique su conexión e inténtelo nuevamente.",
    );
  };

  const handleNaturalSubmit = async (data: Natural) => {
    const partesApellidos = data.apellidos.trim().split(/\s+/);
    if (partesApellidos.length < 2) {
      setErrorMessage("Ingrese sus apellidos paterno y materno para continuar.");
      setSuccessMessage(null);
      return;
    }

    const payload = {
      tipoPersona: "NATURAL" as const,
      tipoDocumento: data.tipoDocumento,
      dni: data.numeroDocumento,
      nombres: data.nombres.trim(),
      apellidoPaterno: partesApellidos[0],
      apellidoMaterno: partesApellidos.slice(1).join(" "),
      correo: data.correo.trim().toLowerCase(),
      celular: data.celular,
      ubigeoDistrito: data.domicilio.distritoCodigo,
      direccion: data.domicilio.direccionExacta.trim(),
      referenciaDomicilio: data.domicilio.referencia?.trim() || undefined,
      fechaNacimiento: data.fechaNacimiento,
      password: `Clave*${data.numeroDocumento}`,
      consentimientoDatos: true as const,
      declaracionJurada: data.declaracionJuradaAceptada,
      fechaAceptacion: data.fechaAceptacion,
      aceptaNotificaciones: false,
    };

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await apiClient.post("/api/v1/auth/registro-ciudadano", payload);
      await queryClient.invalidateQueries({ queryKey: ["expedientes"] });
      setErrorMessage(null);
      setSuccessMessage(
        `La cuenta de ${data.nombres.trim()} ${data.apellidos.trim()} fue creada y su expediente quedó registrado.`,
      );
    } catch (error: unknown) {
      mostrarErrorRegistro(error);
    }
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    const payload = {
      tipoPersona: "JURIDICA" as const,
      ruc: data.ruc,
      razonSocial: data.razonSocial.trim(),
      partidaRegistral: data.partidaSunarp || undefined,
      tipoDocumentoRepresentante: data.representanteLegal.tipoDocumento,
      dniRepresentante: data.representanteLegal.numeroDocumento,
      nombreRepresentante: `${data.representanteLegal.nombres} ${data.representanteLegal.apellidos}`.trim(),
      cargoRepresentante: data.representanteLegal.cargo,
      correo: data.correoCorporativo.trim().toLowerCase(),
      celular: data.celularContacto,
      ubigeoDistrito: data.domicilio.distritoCodigo,
      direccion: data.domicilio.direccionExacta.trim(),
      referenciaDomicilio: data.domicilio.referencia?.trim() || undefined,
      password: `Clave*${data.ruc.slice(-8)}`,
      consentimientoDatos: true as const,
      declaracionJurada: data.declaracionJuradaAceptada,
      fechaAceptacion: data.fechaAceptacion,
      aceptaNotificaciones: false,
    };

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await apiClient.post("/api/v1/auth/registro-persona-juridica", payload);
      await queryClient.invalidateQueries({ queryKey: ["expedientes"] });
      setErrorMessage(null);
      setSuccessMessage(
        `La cuenta de ${data.razonSocial.trim()} fue creada y su expediente quedó registrado.`,
      );
    } catch (error: unknown) {
      mostrarErrorRegistro(error);
    }
  };

  const handleClearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  return (
    <main className="registration-page relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-32 -top-36 h-96 w-96 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-cyan-100/70 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-100/40 blur-3xl" />
      </div>

      <div className="registration-card w-full max-w-4xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-slate-900/10">
        <div className="h-1.5 bg-gradient-to-r from-blue-700 via-cyan-500 to-teal-400" />
        <div className="p-5 sm:p-8 lg:p-10">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Volver al inicio
        </Link>

        <header className="registration-header mb-7 flex flex-col gap-4 border-b border-slate-100 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20 sm:flex">
              <UserRound aria-hidden="true" className="h-7 w-7" />
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                IESTP “Suiza” · Pucallpa
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Registro de Usuario Externo
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Complete sus datos para crear su cuenta y Casilla Electrónica
                Institucional.
              </p>
            </div>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Registro seguro
          </div>
        </header>

        <div
          role="tablist"
          aria-label="Tipo de persona"
          className="registration-tabs mb-7 inline-flex w-full gap-2 rounded-2xl bg-slate-100 p-1.5 sm:w-auto"
        >
          <button
            role="tab"
            aria-selected={activeTab === "NATURAL"}
            aria-controls="panel-natural"
            id="tab-natural"
            onClick={() => {
              setActiveTab("NATURAL");
              handleClearMessages();
            }}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:flex-none sm:px-6 ${
              activeTab === "NATURAL"
                ? "bg-white text-blue-800 shadow-sm"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
            }`}
          >
            <UserRound aria-hidden="true" className="h-4 w-4" />
            Persona Natural
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "JURIDICA"}
            aria-controls="panel-juridica"
            id="tab-juridica"
            onClick={() => {
              setActiveTab("JURIDICA");
              handleClearMessages();
            }}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:flex-none sm:px-6 ${
              activeTab === "JURIDICA"
                ? "bg-white text-blue-800 shadow-sm"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
            }`}
          >
            <Building2 aria-hidden="true" className="h-4 w-4" />
            Persona Jurídica
          </button>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <p className="leading-6">
            Complete los datos tal como aparecen en sus documentos. Al finalizar,
            el sistema creará el expediente correspondiente y podrá consultarlo
            desde la bandeja de expedientes.
          </p>
        </div>

        <div
          role="tabpanel"
          id="panel-natural"
          aria-labelledby="tab-natural"
          hidden={activeTab !== "NATURAL"}
          className="registration-panel-enter"
        >
          {activeTab === "NATURAL" && (
            <PersonaNaturalForm
              onSubmit={handleNaturalSubmit}
              onChange={handleClearMessages}
            />
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-juridica"
          aria-labelledby="tab-juridica"
          hidden={activeTab !== "JURIDICA"}
          className="registration-panel-enter"
        >
          {activeTab === "JURIDICA" && (
            <PersonaJuridicaForm
              onSubmit={handleJuridicaSubmit}
              onChange={handleClearMessages}
            />
          )}
        </div>

        {errorMessage && (
          <div
            className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <p className="flex-1 leading-6">{errorMessage}</p>
            <button
              type="button"
              onClick={handleClearMessages}
              className="rounded px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              aria-label="Cerrar mensaje de error"
            >
              Cerrar
            </button>
          </div>
        )}

        {successMessage && (
          <div
            className="mt-6 flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <span className="leading-6">{successMessage}</span>
            </div>
            <Link
              to="/expedientes"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
            >
              Ver bandeja de expedientes
            </Link>
          </div>
        )}
      </div>
      </div>
    </main>
  );
}
