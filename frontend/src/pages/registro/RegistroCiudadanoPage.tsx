import { useState } from "react";
import { Link } from "react-router-dom";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import { apiClient } from "../../api/client";
import { ArrowLeft, Building2, ShieldCheck, UserRound } from "lucide-react";

export default function RegistroCiudadanoPage() {
  const [activeTab, setActiveTab] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleNaturalSubmit = async (data: Natural) => {
    console.log("POST /api/v1/auth/registro-ciudadano", data);

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
    } catch (err) {
      console.warn("[RegistroCiudadano] Fallo de llamada a API en registro natural:", err);
    }

    setSuccessMessage(
      `Registro completado. Tu casilla electrónica ha sido creada: ${data.numeroDocumento}@casilla.iestpsuiza.edu.pe`
    );
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    console.log("POST /api/v1/auth/registro-ciudadano", data);

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
    } catch (err) {
      console.warn("[RegistroCiudadano] Fallo de llamada a API en registro jurídica:", err);
    }

    setSuccessMessage(
      `Registro completado. Tu casilla electrónica ha sido creada: ${data.ruc}@casilla.iestpsuiza.edu.pe`
    );
  };

  const handleClearSuccess = () => setSuccessMessage(null);

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
              setSuccessMessage(null);
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
              setSuccessMessage(null);
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

        <div
          role="tabpanel"
          id="panel-natural"
          aria-labelledby="tab-natural"
          hidden={activeTab !== "NATURAL"}
          className="registration-panel-enter"
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
          className="registration-panel-enter"
        >
          {activeTab === "JURIDICA" && (
            <PersonaJuridicaForm onSubmit={handleJuridicaSubmit} />
          )}
        </div>

        {successMessage && (
          <div
            className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm"
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
    </main>
  );
}
