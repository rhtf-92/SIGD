import { useState } from "react";
import { Link } from "react-router-dom";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import { apiClient } from "../../api/client";

export default function RegistroCiudadanoPage() {
  const [activeTab, setActiveTab] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [password,setPassword] = useState('');
  const [confirmacion,setConfirmacion] = useState('');
  const [error,setError] = useState<string|null>(null);
  const [aceptaNotificaciones,setAceptaNotificaciones] = useState(false);
  async function registrar(path:string,payload:Record<string,unknown>,documento:string) {
    setSuccessMessage(null);setError(null);
    if(password.length<8 || password.length>128 || password!==confirmacion){setError('Ingrese una clave de 8 a 128 caracteres y confirme la misma clave.');return;}
    try {
      await apiClient.post(path,{...payload,password});
      setSuccessMessage('Cuenta creada. Inicie sesi\u00f3n con el usuario '+documento+' y la clave que acaba de elegir.');
      setPassword('');setConfirmacion('');
    } catch(err) {setError(err instanceof Error ? err.message : 'No se pudo registrar la cuenta.');}
  }
  const handleNaturalSubmit = async (data: Natural) => {
    if(data.tipoDocumento!=='DNI'){setError('El registro local admite DNI. CE requiere una integraci\u00f3n pendiente.');return;}
    const partes=data.apellidos.trim().split(/\s+/);
    if(partes.length<2){setError('Ingrese apellido paterno y materno.');return;}
    await registrar('/api/v1/auth/registro-ciudadano',{
      tipoPersona:'NATURAL',dni:data.numeroDocumento,nombres:data.nombres.trim(),
      apellidoPaterno:partes[0],apellidoMaterno:partes.slice(1).join(' '),
      fechaNacimiento:data.fechaNacimiento,
      correo:data.correo.trim().toLowerCase(),celular:data.celular,ubigeoDistrito:data.domicilio.distritoCodigo,
      direccion:data.domicilio.direccionExacta.trim(),consentimientoDatos:data.consentimientoLey29733,
      aceptaNotificaciones,
    },data.numeroDocumento);
  };
  const handleJuridicaSubmit = async (data: Juridical) => {
    if(data.representanteLegal.tipoDocumento!=='DNI'){setError('El representante debe estar registrado con DNI.');return;}
    await registrar('/api/v1/auth/registro-persona-juridica',{
      tipoPersona:'JURIDICA',ruc:data.ruc,razonSocial:data.razonSocial.trim(),partidaRegistral:data.partidaSunarp||undefined,
      dniRepresentante:data.representanteLegal.numeroDocumento,
      nombreRepresentante:(data.representanteLegal.nombres+' '+data.representanteLegal.apellidos).trim(),
      correo:data.correoCorporativo.trim().toLowerCase(),celular:data.celularContacto,
      ubigeoDistrito:data.domicilio.distritoCodigo,direccion:data.domicilio.direccionExacta.trim(),
      consentimientoDatos:data.consentimientoLey29733,aceptaNotificaciones,
    },data.ruc);
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
          Complete sus datos para crear su cuenta local.
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

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <label>Clave para iniciar sesión<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} className="block w-full rounded border p-2"/></label>
          <label>Confirmar clave<input type="password" autoComplete="new-password" value={confirmacion} onChange={e=>setConfirmacion(e.target.value)} className="block w-full rounded border p-2"/></label>
        </div>
        {error && <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
        <label className="mb-4 flex gap-2 text-sm"><input type="checkbox" checked={aceptaNotificaciones} onChange={e=>setAceptaNotificaciones(e.target.checked)}/>Acepto recibir notificaciones (opcional)</label>
        {successMessage && <Link className="mb-4 block text-blue-700 underline" to="/login">Iniciar sesión</Link>}

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
