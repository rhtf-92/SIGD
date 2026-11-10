import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import { apiClient } from "../../api/client";

export default function RegistroCiudadanoPage() {
  const [activeTab, setActiveTab] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleNaturalSubmit = async (data: Natural) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const partesApellidos = data.apellidos.trim().split(/\s+/);
    const apellidoPaterno = partesApellidos[0];
    const apellidoMaterno = partesApellidos.slice(1).join(" ");
    const celularValido = /^9[0-9]{8}$/.test(data.celular) ? data.celular : "";
    const ubigeoValido = /^25[0-9]{4}$/.test(data.domicilio?.distritoCodigo || "")
      ? (data.domicilio.distritoCodigo as string)
      : "";

    const payload = {
      tipoPersona: "NATURAL" as const,
      dni: data.numeroDocumento,
      nombres: data.nombres.trim(),
      apellidoPaterno,
      apellidoMaterno: apellidoMaterno || "",
      correo: data.correo.trim().toLowerCase(),
      celular: celularValido,
      ubigeoDistrito: ubigeoValido,
      direccion: data.domicilio?.direccionExacta?.trim() || "",
      password: `Clave*${data.numeroDocumento}`,
      consentimientoDatos: true as const,
      aceptaNotificaciones: true,
    };

    try {
      const response = await apiClient.post("/api/v1/auth/registro-ciudadano", payload);
      if (response.data?.ok === false) {
        setErrorMessage(response.data?.detail ?? "No fue posible completar el registro en este momento.");
        return;
      }
      const casillaId = response.data?.casillaId ?? response.data?.idPersona ?? "";
      setSuccessMessage(`Registro completado. Tu casilla electrónica ha sido creada${casillaId ? `: ${casillaId}` : ""}.`);
      setTimeout(() => { navigate("/login", { replace: true }); }, 2000);
    } catch (err: unknown) {
      const r = (err as { response?: { data?: any } })?.response?.data;
      setErrorMessage(r?.detail ?? r?.message ?? "No se pudo registrar la persona natural. Verifique los datos e intente nuevamente.");
    }
  };

  const handleJuridicaSubmit = async (data: Juridical) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const celularValido = /^9[0-9]{8}$/.test(data.celularContacto) ? data.celularContacto : "";
    const ubigeoValido = /^25[0-9]{4}$/.test(data.domicilio?.distritoCodigo || "")
      ? (data.domicilio.distritoCodigo as string)
      : "";

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
      direccion: data.domicilio?.direccionExacta?.trim() || "",
      password: `Clave*${data.ruc.slice(-8)}`,
      consentimientoDatos: true as const,
      aceptaNotificaciones: true,
    };

    try {
      const response = await apiClient.post("/api/v1/auth/registro-persona-juridica", payload);
      if (response.data?.ok === false) {
        setErrorMessage(response.data?.detail ?? "No fue posible completar el registro en este momento.");
        return;
      }
      const casillaId = response.data?.casillaId ?? response.data?.idPersona ?? "";
      setSuccessMessage(`Registro completado. Tu casilla electrónica ha sido creada${casillaId ? `: ${casillaId}` : ""}.`);
      setTimeout(() => { navigate("/login", { replace: true }); }, 2000);
    } catch (err: unknown) {
      const r = (err as { response?: { data?: any } })?.response?.data;
      setErrorMessage(r?.detail ?? r?.message ?? "No se pudo registrar la persona jurídica. Verifique los datos e intente nuevamente.");
    }
  };

  const handleClearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  return (
    <div className="sigd-fade-in admin-dark min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="rounded-2xl border border-[#d7e9f7] bg-white shadow-[0_0_15px_rgba(6,182,212,0.15)] backdrop-blur-[12px] max-w-2xl w-full p-8 transition-all duration-300 ease-out">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-[#d7e9f7] bg-[#e8f4ff] px-4 py-2.5 text-sm font-semibold text-[#2f648c] transition-all duration-300 ease-out hover:brightness-110 hover:border-[#8cc8f0]"
        >
          ← Volver al inicio
        </Link>
        <h1 className="text-2xl font-bold text-[#0b2a4a] mb-2">Registro de Usuario Externo</h1>
        <p className="text-sm text-[#4b6b85] mb-8">Complete sus datos para crear su cuenta y Casilla Electrónica Institucional</p>

        <div role="tablist" aria-label="Tipo de persona" className="flex gap-1 mb-8 border-b border-[#d7e9f7]">
          <button role="tab" aria-selected={activeTab === "NATURAL"} aria-controls="panel-natural" id="tab-natural"
            onClick={() => { setActiveTab("NATURAL"); setSuccessMessage(null); setErrorMessage(null); }}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-md transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-[#bfe0f7] ${activeTab === "NATURAL" ? "text-[#00539b] border-b-2 border-[#006ec7]" : "text-[#6b8aa5] hover:text-[#2f648c] border-b-2 border-transparent"}`}>
            Persona Natural
          </button>
          <button role="tab" aria-selected={activeTab === "JURIDICA"} aria-controls="panel-juridica" id="tab-juridica"
            onClick={() => { setActiveTab("JURIDICA"); setSuccessMessage(null); setErrorMessage(null); }}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-md transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-[#bfe0f7] ${activeTab === "JURIDICA" ? "text-[#00539b] border-b-2 border-[#006ec7]" : "text-[#6b8aa5] hover:text-[#2f648c] border-b-2 border-transparent"}`}>
            Persona Jurídica
          </button>
        </div>

        <div role="tabpanel" id="panel-natural" aria-labelledby="tab-natural" hidden={activeTab !== "NATURAL"}>
          {activeTab === "NATURAL" && <PersonaNaturalForm onSubmit={handleNaturalSubmit} />}
        </div>
        <div role="tabpanel" id="panel-juridica" aria-labelledby="tab-juridica" hidden={activeTab !== "JURIDICA"}>
          {activeTab === "JURIDICA" && <PersonaJuridicaForm onSubmit={handleJuridicaSubmit} />}
        </div>

        {errorMessage && (
          <div className="mt-6 p-4 bg-red-950/30 border border-red-500/30 rounded-xl text-red-200 text-sm flex items-center justify-between" role="alert" aria-live="assertive">
            <span>{errorMessage}</span>
            <button onClick={handleClearMessages} className="text-red-300 hover:text-red-100 underline text-xs" aria-label="Cerrar mensaje de error">Cerrar</button>
          </div>
        )}
        {successMessage && (
          <div className="mt-6 p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-200 text-sm flex items-center justify-between" role="status" aria-live="polite">
            <span>{successMessage}</span>
            <button onClick={handleClearMessages} className="text-emerald-300 hover:text-emerald-100 underline text-xs" aria-label="Cerrar mensaje de éxito">Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}