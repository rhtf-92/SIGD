import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, User, Building2, ShieldCheck, CheckCircle2 } from "lucide-react";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import type { Natural, Juridical } from "../../types/registroCiudadano";
import { apiClient } from "../../api/client";
import { TRAMITE_WIZARD_STORAGE_KEY } from "../../hooks/useTramiteWizardReducer";
import { Button } from "../../components/ui/Button";
import logoSuiza from "../../assets/sigd/logo-suiza.webp";

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
  const [pendiente, setPendiente] = useState<{ tipo: 'NATURAL'; datos: Natural } | { tipo: 'JURIDICA'; datos: Juridical } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const confirmandoRef = useRef(false);

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

  const registrarNatural = async (data: Natural) => {
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
      username: data.username.trim().toLowerCase(),
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
          "El servidor no devolvió una confirmación válida con idPersona para el registro ciudadano."
        );
      }

      mergeIdPersonaToWizardDraft(idPersona.trim());
      setErrorMessage(null);
      setSuccessMessage('Registro completado. Ya puede iniciar sesión con su nombre de usuario o correo y la contraseña que eligió.');
    } catch (err: any) {
      setSuccessMessage(null);
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Error al procesar el registro en el servidor. Verifique su conexión.";
      setErrorMessage(msg);
    }
  };

  const registrarJuridica = async (data: Juridical) => {
    if (data.representanteLegal.tipoDocumento !== 'DNI') {
      setSuccessMessage(null);
      setErrorMessage('El representante legal debe identificarse con DNI.');
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
      username: data.username.trim().toLowerCase(),
      celular: data.celularContacto,
      ubigeoDistrito: data.domicilio.distritoCodigo,
      direccion: data.domicilio.direccionExacta.trim(),
      password: data.password,
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
          "El servidor no devolvió una confirmación válida con idPersona para el registro ciudadano."
        );
      }

      mergeIdPersonaToWizardDraft(idPersona.trim());
      setErrorMessage(null);
      setSuccessMessage('Registro completado. Ya puede iniciar sesión con su nombre de usuario o correo y la contraseña que eligió.');
    } catch (err: any) {
      setSuccessMessage(null);
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Error al procesar el registro en el servidor. Verifique su conexión.";
      setErrorMessage(msg);
    }
  };

  const prepararNatural = (datos: Natural) => {
    if (confirmandoRef.current) return;
    const error = validarCamposObligatorios(datos.celular, datos.domicilio?.distritoCodigo ?? '', datos.domicilio?.direccionExacta ?? '', datos.password, datos.confirmarPassword);
    if (error || datos.apellidos.trim().split(/\s+/).length < 2) {
      setErrorMessage(error ?? 'Ingrese ambos apellidos para completar el registro.');
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendiente({ tipo: 'NATURAL', datos });
  };

  const prepararJuridica = (datos: Juridical) => {
    if (confirmandoRef.current) return;
    const error = validarCamposObligatorios(datos.celularContacto, datos.domicilio?.distritoCodigo ?? '', datos.domicilio?.direccionExacta ?? '', datos.password, datos.confirmarPassword);
    if (error || datos.representanteLegal.tipoDocumento !== 'DNI') {
      setErrorMessage(error ?? 'El representante legal debe identificarse con DNI.');
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendiente({ tipo: 'JURIDICA', datos });
  };

  const confirmarRegistro = async () => {
    if (!pendiente || confirmandoRef.current) return;
    confirmandoRef.current = true;
    setConfirmando(true);
    try {
      if (pendiente.tipo === 'NATURAL') await registrarNatural(pendiente.datos);
      else await registrarJuridica(pendiente.datos);
      setPendiente(null);
    } finally {
      confirmandoRef.current = false;
      setConfirmando(false);
    }
  };

  const handleClearSuccess = () => setSuccessMessage(null);

  return (
    <main className="min-h-screen bg-surface-page flex items-center justify-center p-4 sm:p-6 lg:p-8 text-slate-900">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-suiza-primary transition mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <img
              src={logoSuiza}
              alt="IESTP Suiza"
              width={40}
              height={41}
              loading="eager"
              decoding="async"
              className="h-10 w-auto object-contain mr-1 aspect-[256/261]"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">IESTP &quot;Suiza&quot;</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Registro de Usuario Externo
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Esta cuenta permite presentar y consultar trámites públicos del IESTP &quot;Suiza&quot;.
          </p>
        </div>

        {/* Nota legal y tratamiento de datos */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-suiza-primary shrink-0 mt-0.5" />
          <span>
            <strong>Tratamiento de Datos Personales:</strong> Los datos proporcionados serán tratados por el IESTP Suiza exclusivamente para fines de identificación y gestión documentaria de sus solicitudes, conforme a la Ley N.° 29733.
          </span>
        </div>

        {/* Pestañas de Tipo de Persona */}
        <div
          role="tablist"
          aria-label="Tipo de persona"
          className="flex gap-2 border-b border-slate-200 pb-px"
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
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors cursor-pointer focus:outline-none ${
              activeTab === "NATURAL"
                ? "text-suiza-primary border-b-2 border-suiza-primary bg-sky-50/50"
                : "text-slate-500 hover:text-slate-800 border-b-2 border-transparent"
            }`}
          >
            <User className="h-3.5 w-3.5" />
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
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors cursor-pointer focus:outline-none ${
              activeTab === "JURIDICA"
                ? "text-suiza-primary border-b-2 border-suiza-primary bg-sky-50/50"
                : "text-slate-500 hover:text-slate-800 border-b-2 border-transparent"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
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
            <div className="space-y-4">
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                Verifica cuidadosamente tu número de documento. Este dato se utilizará para identificar tu cuenta y no podrá modificarse directamente después del registro.
              </p>
              <PersonaNaturalForm onSubmit={prepararNatural} />
            </div>
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-juridica"
          aria-labelledby="tab-juridica"
          hidden={activeTab !== "JURIDICA"}
        >
          {activeTab === "JURIDICA" && (
            <div className="space-y-4">
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                Verifica cuidadosamente el RUC de la entidad. No podrá modificarse directamente después del registro.
              </p>
              <PersonaJuridicaForm onSubmit={prepararJuridica} />
            </div>
          )}
        </div>

        {errorMessage && (
          <div
            className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center justify-between"
            role="alert"
          >
            <span className="font-medium">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-900 underline text-xs font-semibold cursor-pointer ml-2"
              aria-label="Cerrar mensaje de error"
            >
              Cerrar
            </button>
          </div>
        )}

        {successMessage && (
          <div
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
            <button
              onClick={handleClearSuccess}
              className="text-emerald-700 hover:text-emerald-900 underline text-xs font-semibold cursor-pointer ml-2"
              aria-label="Cerrar mensaje de éxito"
            >
              Cerrar
            </button>
          </div>
        )}

        {pendiente && (
          <div role="dialog" aria-modal="true" aria-labelledby="confirmar-documento" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
              <h2 id="confirmar-documento" className="text-base font-bold text-slate-900">
                Verifica tu documento antes de continuar
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed">
                ¿Confirmas que el {pendiente.tipo === 'JURIDICA' ? 'RUC' : pendiente.datos.tipoDocumento} <strong>{pendiente.tipo === 'JURIDICA' ? pendiente.datos.ruc : pendiente.datos.numeroDocumento}</strong> es correcto?
              </p>
              <div className="flex justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPendiente(null)}
                  disabled={confirmando}
                >
                  Revisar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void confirmarRegistro()}
                  disabled={confirmando}
                  isLoading={confirmando}
                  loadingText="Creando cuenta..."
                >
                  Confirmar y crear cuenta
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
