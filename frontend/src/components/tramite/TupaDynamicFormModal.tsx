import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Building,
  GraduationCap,
  ShoppingBag,
  FileText,
  Lock,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Coins,
  Clock,
  Info,
  User,
  Users,
  Printer,
  ShieldCheck,
  Receipt,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  TUPA_FORMULARIOS_CONFIG,
  obtenerDefinicionTupa,
} from '../../data/tupaFormulariosConfig';
import type { TupaFormDefinition, TipoFormularioTupa } from '../../types/tupaFormulario.types';
import { useAuthStore } from '../../stores/authStore';
import { ModalBase } from '../ui/ModalBase';
import { Button } from '../ui/Button';
import {
  sanitizarNumeroDocumento,
  validarNumeroDocumento,
  obtenerTextoAyudaDocumento,
  obtenerPlaceholderDocumento,
} from '../../utils/documentValidation';

export interface SolicitanteFormState {
  tipoPersona: 'NATURAL' | 'JURIDICA';
  numeroDocumento: string;
  correo: string;
  celular?: string;
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
}

export interface TupaDynamicFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  codigoInicial?: string;
  onExito?: (codigoSolicitud: string) => void;
  solicitanteInicial?: SolicitanteFormState;
  codigosDisponibles?: readonly string[];
}

export default function TupaDynamicFormModal({
  isOpen,
  onClose,
  codigoInicial,
  onExito,
  solicitanteInicial,
  codigosDisponibles: _codigosDisponibles,
}: TupaDynamicFormModalProps) {
  const usuario = useAuthStore((s) => s.usuario);
  const token = useAuthStore((s) => s.accessToken);
  const esCiudadano = usuario?.rol === 'CIUDADANO' || !usuario?.rol;

  // Código activo del formulario
  const [codigoSeleccionado, setCodigoSeleccionado] = useState<string>(
    codigoInicial || TUPA_FORMULARIOS_CONFIG[0]?.codigoRef || 'p1-fila-05'
  );

  // Sincronizar cuando cambia el código inicial al abrir
  useEffect(() => {
    if (codigoInicial) {
      setCodigoSeleccionado(codigoInicial);
      setPaso(1);
      setValoresForm({});
      setErrorEnvio(null);
      setSolicitudGenerada(null);
      setAtenderTercero(false);
    }
  }, [codigoInicial, isOpen]);

  const definicionActual: TupaFormDefinition = useMemo(() => {
    return obtenerDefinicionTupa(codigoSeleccionado) || TUPA_FORMULARIOS_CONFIG[0];
  }, [codigoSeleccionado]);

  // Pasos del formulario: 1: Orientación, 2: Datos, 3: Revisión
  const [paso, setPaso] = useState<1 | 2 | 3>(1);

  // Estado del formulario
  const [valoresForm, setValoresForm] = useState<Record<string, string | number>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [solicitudGenerada, setSolicitudGenerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Modo ventanilla institucional: ¿Atender a un tercero en ventanilla o usar mi propia cuenta?
  const [atenderTercero, setAtenderTercero] = useState(false);

  // Datos del solicitante (para no autenticados o atención a terceros en ventanilla)
  const [solicitante, setSolicitante] = useState<SolicitanteFormState>(
    solicitanteInicial ?? {
      tipoPersona: 'NATURAL',
      numeroDocumento: '',
      correo: '',
      celular: '',
      nombreCompleto: '',
    }
  );

  // Cálculo dinámico del importe total
  const importeCalculado = useMemo(() => {
    const precioBase = definicionActual.monto;
    if (definicionActual.tipoFormulario === 'VENTA_BIEN') {
      const cantidad = Number(valoresForm.cantidad ?? 1);
      return Math.max(1, cantidad) * precioBase;
    }
    if (definicionActual.tipoFormulario === 'ALQUILER') {
      const periodos = Number(valoresForm.cantidadPeriodos ?? 1);
      return Math.max(1, periodos) * precioBase;
    }
    return precioBase;
  }, [definicionActual, valoresForm.cantidad, valoresForm.cantidadPeriodos]);

  if (!isOpen) return null;

  const handleCampoChange = (nombre: string, valor: string | number) => {
    setValoresForm((prev) => ({ ...prev, [nombre]: valor }));
    if (errorEnvio) setErrorEnvio(null);
  };

  const getTipoIcono = (tipo: TipoFormularioTupa) => {
    switch (tipo) {
      case 'VENTA_BIEN':
        return <ShoppingBag className="h-4 w-4 text-amber-700" />;
      case 'ALQUILER':
        return <Building className="h-4 w-4 text-sky-700" />;
      case 'ACADEMICO':
        return <GraduationCap className="h-4 w-4 text-indigo-700" />;
      case 'ACTUACION_INTERNA':
        return <Lock className="h-4 w-4 text-rose-700" />;
      default:
        return <FileText className="h-4 w-4 text-blue-700" />;
    }
  };

  const getTipoBadgeClass = (tipo: TipoFormularioTupa) => {
    switch (tipo) {
      case 'VENTA_BIEN':
        return 'bg-amber-50 text-amber-900 border-amber-200';
      case 'ALQUILER':
        return 'bg-sky-50 text-sky-900 border-sky-200';
      case 'ACADEMICO':
        return 'bg-indigo-50 text-indigo-900 border-indigo-200';
      case 'ACTUACION_INTERNA':
        return 'bg-rose-50 text-rose-900 border-rose-200';
      default:
        return 'bg-blue-50 text-blue-900 border-blue-200';
    }
  };

  const copiarCodigo = () => {
    if (!solicitudGenerada) return;
    navigator.clipboard.writeText(solicitudGenerada).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  // Validaciones antes de avanzar de paso 2 a paso 3
  const validarPaso2 = (): boolean => {
    // Si atiende a tercero o no hay usuario autenticado, validar datos del solicitante
    if (!usuario || (atenderTercero && !esCiudadano)) {
      const tipoDoc = solicitante.tipoPersona === 'JURIDICA' ? 'RUC' : 'DNI';
      const valDoc = validarNumeroDocumento(solicitante.numeroDocumento, tipoDoc);
      if (!valDoc.esValido) {
        setErrorEnvio(valDoc.mensajeError || 'Ingrese un número de documento válido para el solicitante.');
        return false;
      }
      if (!solicitante.correo.trim() || !solicitante.correo.includes('@')) {
        setErrorEnvio('Ingrese un correo electrónico válido para las notificaciones.');
        return false;
      }
    }

    // Validar campos obligatorios de la definición
    for (const campo of definicionActual.campos) {
      if (campo.obligatorio) {
        const val = valoresForm[campo.nombre];
        if (val === undefined || val === null || String(val).trim() === '') {
          setErrorEnvio(`El campo "${campo.etiqueta}" es obligatorio.`);
          return false;
        }
      }
    }

    setErrorEnvio(null);
    return true;
  };

  // Envío final de la solicitud al backend
  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (definicionActual.generaExpediente) {
      setErrorEnvio('Este procedimiento requiere radicación formal con CUT. Use Mesa de Partes.');
      return;
    }
    if (definicionActual.bloqueadoParaCiudadano && esCiudadano) {
      setErrorEnvio('Gestión interna institucional. Los ciudadanos externos no pueden iniciar este trámite.');
      return;
    }

    const tokenActual = useAuthStore.getState().accessToken;
    if (!tokenActual && esCiudadano) {
      setErrorEnvio('Para registrar una solicitud institucional debe iniciar sesión con una cuenta autorizada.');
      return;
    }

    setEnviando(true);
    setErrorEnvio(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokenActual) headers['Authorization'] = `Bearer ${tokenActual}`;

      // Si el operador institucional indicó atender a un tercero en ventanilla o no hay sesión
      const debeEnviarSolicitanteTercero =
        (!usuario || atenderTercero) &&
        solicitante.numeroDocumento.trim().length >= 8;

      const bodyPayload = {
        tipoFormulario: definicionActual.tipoFormulario,
        codigoTupa: definicionActual.codigoRef,
        denominacion: definicionActual.denominacion,
        montoTotal: importeCalculado,
        datosFormulario: valoresForm,
        telefono: (valoresForm.telefonoContacto as string) ?? solicitante.celular ?? undefined,
        observacion:
          (valoresForm.observacionesComerciales as string) ??
          (valoresForm.observacionesUso as string) ??
          (valoresForm.asuntoPetitorio as string) ??
          (valoresForm.observacionesAcademicas as string),
        ...(debeEnviarSolicitanteTercero
          ? {
              solicitante: {
                tipoPersona: solicitante.tipoPersona,
                numeroDocumento: solicitante.numeroDocumento.trim(),
                correo: solicitante.correo.trim(),
                nombreCompleto: solicitante.nombreCompleto?.trim() || undefined,
                celular: solicitante.celular?.trim() || undefined,
              },
            }
          : {}),
      };

      const res = await fetch('/api/v1/tramites/solicitudes-dinamicas', {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const detallesMsg = Array.isArray(errorData.detalles)
          ? errorData.detalles.join(' • ')
          : null;
        throw new Error(
          detallesMsg ||
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          'Error al procesar la solicitud en el servidor institucional.'
        );
      }

      const data: unknown = await res.json();
      if (
        typeof data !== 'object' ||
        data === null ||
        !('codigoSolicitud' in data) ||
        typeof data.codigoSolicitud !== 'string' ||
        !/^SOL-\d{4}-\d{6}$/.test(data.codigoSolicitud)
      ) {
        throw new Error('El servidor no devolvió un código de solicitud canónico válido.');
      }

      setSolicitudGenerada(data.codigoSolicitud);
      if (onExito) onExito(data.codigoSolicitud);
    } catch (err: unknown) {
      setErrorEnvio(err instanceof Error ? err.message : 'No se pudo registrar la solicitud. Intente nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  // Cabecera institucional con diseño sobrio y representativo
  const modalTitle = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 shadow-2xs">
        {getTipoIcono(definicionActual.tipoFormulario)}
      </span>
      <span className="font-bold text-slate-900 tracking-tight">Solicitud de Requerimiento Institucional</span>
      <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${getTipoBadgeClass(definicionActual.tipoFormulario)}`}>
        {definicionActual.tipoFormulario}
      </span>
      {definicionActual.generaExpediente && (
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
          Genera Expediente CUT
        </span>
      )}
    </div>
  );

  const modalSubtitle = (
    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
      <span className="font-semibold text-slate-700 truncate max-w-sm sm:max-w-md">
        {definicionActual.denominacion}
      </span>
      <span>•</span>
      <span className="text-blue-900 font-bold font-mono">
        Tarifa: {definicionActual.montoTexto} ({definicionActual.unidadCobro})
      </span>
    </div>
  );

  // Botonera inferior según el paso activo
  const modalFooter = solicitudGenerada ? (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={() => window.print()}
        className="flex items-center gap-1.5 text-slate-700 border-slate-300 hover:bg-slate-50"
      >
        <Printer className="h-4 w-4 text-slate-600" />
        Imprimir Comprobante
      </Button>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            setSolicitudGenerada(null);
            setPaso(1);
            setValoresForm({});
            setErrorEnvio(null);
          }}
        >
          Registrar Otra Solicitud
        </Button>
        <Button variant="primary" size="md" onClick={onClose} className="bg-blue-900 hover:bg-blue-800 text-white">
          Cerrar
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between w-full">
      <div>
        {paso > 1 ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setPaso((p) => (p - 1) as 1 | 2)}
            disabled={enviando}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Anterior
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cancelar
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {paso === 1 && (
          definicionActual.generaExpediente ? (
            <Link to={`/mesa-partes?procedimiento=${encodeURIComponent(definicionActual.codigoRef)}`} onClick={onClose}>
              <Button variant="primary" size="md" className="bg-blue-900 hover:bg-blue-800 text-white flex items-center gap-1">
                Ir a Mesa de Partes Digital (CUT) <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setPaso(2)}
              disabled={definicionActual.bloqueadoParaCiudadano && esCiudadano}
              className="bg-blue-900 hover:bg-blue-800 text-white flex items-center gap-1 shadow-sm"
            >
              Completar Solicitud <ArrowRight className="h-4 w-4" />
            </Button>
          )
        )}

        {paso === 2 && (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              if (validarPaso2()) {
                setPaso(3);
              }
            }}
            className="bg-blue-900 hover:bg-blue-800 text-white flex items-center gap-1 shadow-sm"
          >
            Revisar Resumen <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {paso === 3 && (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void handleSubmit()}
            disabled={enviando || (definicionActual.bloqueadoParaCiudadano && esCiudadano) || (!token && esCiudadano)}
            className="bg-blue-900 hover:bg-blue-800 text-white font-semibold flex items-center gap-1.5 shadow-sm"
          >
            {enviando ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-1" />
                Registrando Solicitud...
              </>
            ) : !token && esCiudadano ? (
              'Inicio de Sesión Requerido'
            ) : (
              <>
                <Receipt className="h-4 w-4" /> Confirmar y Enviar Solicitud
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      size="lg"
      footer={modalFooter}
    >
      {/* 1. Indicador visual de pasos estilizado para entorno educativo */}
      {!solicitudGenerada && (
        <div className="mb-6 pb-4 border-b border-slate-200">
          <div className="grid grid-cols-3 gap-2">
            {/* Paso 1 */}
            <div
              className={`flex items-center gap-2.5 p-2 rounded-lg border transition ${
                paso === 1
                  ? 'bg-blue-50/70 border-blue-300 text-blue-950 font-bold shadow-2xs'
                  : paso > 1
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  paso === 1
                    ? 'bg-blue-900 text-white shadow-xs'
                    : paso > 1
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {paso > 1 ? <Check className="h-3.5 w-3.5" /> : '1'}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Paso 1</span>
                <span className="block text-xs truncate">Orientación</span>
              </div>
            </div>

            {/* Paso 2 */}
            <div
              className={`flex items-center gap-2.5 p-2 rounded-lg border transition ${
                paso === 2
                  ? 'bg-blue-50/70 border-blue-300 text-blue-950 font-bold shadow-2xs'
                  : paso > 2
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  paso === 2
                    ? 'bg-blue-900 text-white shadow-xs'
                    : paso > 2
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {paso > 2 ? <Check className="h-3.5 w-3.5" /> : '2'}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Paso 2</span>
                <span className="block text-xs truncate">Datos del Servicio</span>
              </div>
            </div>

            {/* Paso 3 */}
            <div
              className={`flex items-center gap-2.5 p-2 rounded-lg border transition ${
                paso === 3
                  ? 'bg-blue-50/70 border-blue-300 text-blue-950 font-bold shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  paso === 3
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Paso 3</span>
                <span className="block text-xs truncate">Liquidación</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pantalla de Éxito con diseño institucional */}
      {solicitudGenerada ? (
        <div className="py-6 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 border-2 border-emerald-300 shadow-sm animate-in fade-in zoom-in duration-300">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
              Registro Oficial Exitoso
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              Solicitud Registrada en el Sistema
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mt-1">
              IESTP "Suiza" — Se ha generado su correlativo oficial de atención institucional:
            </p>
          </div>

          <div className="inline-flex items-center gap-3 p-4 rounded-xl bg-slate-900 text-white shadow-md border border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block text-left tracking-wider">
                Código Canónico de Solicitud
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-black text-white tracking-widest">
                {solicitudGenerada}
              </span>
            </div>
            <button
              type="button"
              onClick={copiarCodigo}
              className="p-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white transition active:scale-95"
              title="Copiar código al portapapeles"
              aria-label="Copiar código de solicitud"
            >
              {copiado ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 text-left space-y-2.5 max-w-lg mx-auto shadow-2xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-200 pb-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span>Instrucciones para la culminación del requerimiento:</span>
            </div>
            <div className="space-y-1.5 text-slate-600">
              <p className="flex items-start gap-2">
                <span className="font-bold text-blue-900 shrink-0">1.</span>
                <span><strong>Pago / Liquidación:</strong> Aproxímese a la ventanilla de Tesorería del instituto e indique el código <strong>{solicitudGenerada}</strong> para la cancelación o emisión de su recibo oficial.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-blue-900 shrink-0">2.</span>
                <span><strong>Coordinación y Entrega:</strong> Presente su comprobante ante <strong>{definicionActual.unidadResponsable}</strong> para coordinar la entrega o inicio del servicio.</span>
              </p>
            </div>
          </div>
        </div>
      ) : paso === 1 ? (
        /* PASO 1: Orientación del Concepto */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <span className="text-xs font-mono font-bold text-slate-600 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-900" />
                Catálogo TUPA 2026 · Código: <span className="text-blue-900 font-black">{definicionActual.codigoRef}</span>
              </span>
              <span className="text-xs font-bold text-blue-950 bg-blue-50 px-3 py-1 rounded-md border border-blue-200 font-mono">
                Tarifa: {definicionActual.montoTexto} ({definicionActual.unidadCobro})
              </span>
            </div>

            <div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {definicionActual.denominacion}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700">
                <Coins className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Modalidad de Arancel</span>
                  <span className="font-semibold text-slate-900">{definicionActual.montoTexto} ({definicionActual.unidadCobro})</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700">
                <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Plazo Estimado de Atención</span>
                  <span className="font-semibold text-slate-900">{definicionActual.plazo}</span>
                </div>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700">
                <Building className="h-4 w-4 text-blue-800 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Dependencia Responsable</span>
                  <span className="font-medium text-slate-900">{definicionActual.unidadResponsable}</span>
                </div>
              </div>
            </div>

            {definicionActual.requisitos.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block mb-2">
                  Requisitos y Condiciones Oficiales:
                </span>
                <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
                  {definicionActual.requisitos.map((req, rIdx) => (
                    <li key={rIdx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Alertas orientativas con estética institucional sobria */}
          {definicionActual.generaExpediente && (
            <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-950 text-xs flex items-start gap-2.5 shadow-2xs">
              <Info className="h-4 w-4 shrink-0 text-blue-800 mt-0.5" />
              <div>
                <strong>Trámite con Radicación Formal:</strong> Este procedimiento administrativo oficial genera
                un expediente institucional con Código Único de Trámite (CUT) y foliación digital en Mesa de Partes.
              </div>
            </div>
          )}

          {definicionActual.bloqueadoParaCiudadano && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs">
              <Lock className="h-4 w-4 shrink-0 text-rose-700 mt-0.5" />
              <div>
                <strong>Gestión interna institucional:</strong> Este concepto es de uso exclusivo del personal
                del IESTP "Suiza". Los ciudadanos externos no pueden formular esta solicitud.
              </div>
            </div>
          )}

          {(definicionActual.tipoFormulario === 'VENTA_BIEN' || definicionActual.tipoFormulario === 'ALQUILER') && (
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
              <Info className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
              <span>
                <strong>Disponibilidad física:</strong> La entrega de bienes y la cesión de ambientes quedan sujetas a la validación de stock o cronograma operativo en el Centro de Producción del instituto.
              </span>
            </div>
          )}

          {!token && esCiudadano && (
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs flex items-start gap-2.5 shadow-2xs">
              <Info className="h-4 w-4 shrink-0 text-blue-900 mt-0.5" />
              <span>
                <strong>Atención Institucional:</strong> El registro digital directo de esta solicitud está reservado para ventanilla con cuenta institucional. Para coordinar su trámite de manera particular, acérquese al área responsable.
              </span>
            </div>
          )}
        </div>
      ) : paso === 2 ? (
        /* PASO 2: Datos de la Solicitud y Solicitante */
        <div className="space-y-4">
          {/* Identificación del Solicitante */}
          <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-blue-900" />
                Identificación del Solicitante
              </span>

              {/* Si es operador institucional (Mesa de Partes, Tesorería, etc.), permitir registrar a su nombre o a nombre de un tercero */}
              {!esCiudadano && usuario && (
                <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setAtenderTercero(false)}
                    className={`py-1 px-2.5 rounded-md transition text-center flex items-center gap-1 ${
                      !atenderTercero
                        ? 'bg-white text-blue-950 font-bold shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <User className="h-3 w-3" /> Mi Cuenta ({usuario.rol})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAtenderTercero(true)}
                    className={`py-1 px-2.5 rounded-md transition text-center flex items-center gap-1 ${
                      atenderTercero
                        ? 'bg-white text-blue-950 font-bold shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="h-3 w-3" /> Tercero en Ventanilla
                  </button>
                </div>
              )}
            </div>

            {/* Caso 1: Usuario autenticado registrando con su propia cuenta */}
            {usuario && (!atenderTercero || esCiudadano) ? (
              <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-slate-700">
                    Solicitante Titular: <strong className="text-slate-900">{usuario.nombreCompleto}</strong>
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" /> Sesión Verificada
                  </span>
                </div>
                <p className="text-slate-600">
                  Correo registrado: <strong className="text-slate-800">{usuario.correo}</strong> · Rol: <span className="font-mono text-slate-700">{usuario.rol}</span>
                </p>
              </div>
            ) : (
              /* Caso 2: Atención en ventanilla a un administrado o usuario no autenticado */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tipo de Solicitante *
                  </label>
                  <select
                    value={solicitante.tipoPersona}
                    onChange={(e) =>
                      setSolicitante((prev) => ({
                        ...prev,
                        tipoPersona: e.target.value as 'NATURAL' | 'JURIDICA',
                        numeroDocumento: '',
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-blue-800"
                  >
                    <option value="NATURAL">Persona natural (DNI / Carnet)</option>
                    <option value="JURIDICA">Empresa o entidad (Persona jurídica - RUC)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Número de Documento *
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {solicitante.numeroDocumento.length} / {solicitante.tipoPersona === 'JURIDICA' ? '11 dígitos' : '8 dígitos'}
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={solicitante.tipoPersona === 'JURIDICA' ? 11 : 8}
                    required
                    value={solicitante.numeroDocumento}
                    onChange={(e) => {
                      const tipoDoc = solicitante.tipoPersona === 'JURIDICA' ? 'RUC' : 'DNI';
                      const sanitizado = sanitizarNumeroDocumento(e.target.value, tipoDoc);
                      setSolicitante((prev) => ({ ...prev, numeroDocumento: sanitizado }));
                    }}
                    placeholder={obtenerPlaceholderDocumento(solicitante.tipoPersona === 'JURIDICA' ? 'RUC' : 'DNI')}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-blue-800 font-mono"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {obtenerTextoAyudaDocumento(solicitante.tipoPersona === 'JURIDICA' ? 'RUC' : 'DNI')}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nombres y Apellidos / Razón Social
                  </label>
                  <input
                    type="text"
                    value={solicitante.nombreCompleto ?? ''}
                    onChange={(e) =>
                      setSolicitante((prev) => ({ ...prev, nombreCompleto: e.target.value }))
                    }
                    placeholder="Ej. Juan Pérez Quispe"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-blue-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Correo para notificaciones *
                  </label>
                  <input
                    type="email"
                    required
                    value={solicitante.correo}
                    onChange={(e) =>
                      setSolicitante((prev) => ({ ...prev, correo: e.target.value }))
                    }
                    placeholder="ejemplo@correo.com"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-blue-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Teléfono Celular de Contacto
                  </label>
                  <input
                    type="tel"
                    value={solicitante.celular ?? ''}
                    onChange={(e) =>
                      setSolicitante((prev) => ({ ...prev, celular: e.target.value }))
                    }
                    placeholder="Ej. 961123456"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-blue-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Campos específicos de la definición del TUPA */}
          <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3 shadow-2xs">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block border-b border-slate-100 pb-2">
              Especificaciones del Requerimiento · {definicionActual.tipoFormulario}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {definicionActual.campos.map((campo) => (
                <div
                  key={campo.nombre}
                  className={campo.tipo === 'textarea' ? 'sm:col-span-2' : ''}
                >
                  <label
                    htmlFor={`campo-${campo.nombre}`}
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    {campo.etiqueta} {campo.obligatorio && <span className="text-rose-500">*</span>}
                  </label>

                  {campo.tipo === 'select' ? (
                    <select
                      id={`campo-${campo.nombre}`}
                      required={campo.obligatorio}
                      value={valoresForm[campo.nombre] ?? campo.valorPorDefecto ?? ''}
                      onChange={(e) => handleCampoChange(campo.nombre, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-blue-800"
                    >
                      <option value="">Seleccione una opción...</option>
                      {campo.opciones?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : campo.tipo === 'textarea' ? (
                    <textarea
                      id={`campo-${campo.nombre}`}
                      required={campo.obligatorio}
                      rows={3}
                      placeholder={campo.placeholder}
                      value={valoresForm[campo.nombre] ?? ''}
                      onChange={(e) => handleCampoChange(campo.nombre, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-blue-800"
                    />
                  ) : (
                    <input
                      id={`campo-${campo.nombre}`}
                      type={campo.tipo}
                      required={campo.obligatorio}
                      min={campo.tipo === 'number' ? 1 : undefined}
                      placeholder={campo.placeholder}
                      value={valoresForm[campo.nombre] ?? campo.valorPorDefecto ?? ''}
                      onChange={(e) => handleCampoChange(campo.nombre, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-blue-800"
                    />
                  )}

                  {campo.ayuda && (
                    <span className="text-[10px] text-slate-500 mt-0.5 block">{campo.ayuda}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumen dinámico del importe calculado */}
          {definicionActual.monto > 0 && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
              <div className="text-xs text-blue-950">
                <span className="font-bold block">Liquidación Estimada:</span>
                <span className="text-[11px] text-slate-600">
                  Tarifa base: S/ {definicionActual.monto.toFixed(2)} por {definicionActual.unidadCobro}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total a Liquidar</span>
                <span className="font-mono text-lg font-black text-blue-900">
                  S/ {importeCalculado.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {errorEnvio && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorEnvio}</span>
            </div>
          )}
        </div>
      ) : (
        /* PASO 3: Revisión y Confirmación (Ficha de Pre-Liquidación) */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-blue-900 tracking-wider block">
                  IESTP "SUIZA" — VENTANILLA INSTITUCIONAL
                </span>
                <span className="text-xs font-bold text-slate-800">
                  Resumen Oficial de la Solicitud
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {definicionActual.codigoRef}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Concepto solicitado:</span>
                <span className="font-bold text-slate-900 text-right">{definicionActual.denominacion}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Dependencia responsable:</span>
                <span className="font-medium text-slate-800 text-right">{definicionActual.unidadResponsable}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Solicitante registrado:</span>
                <span className="font-semibold text-slate-900 text-right">
                  {usuario && (!atenderTercero || esCiudadano)
                    ? `${usuario.nombreCompleto} (${usuario.rol})`
                    : solicitante.nombreCompleto || solicitante.numeroDocumento || 'Persona en ventanilla'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Correo para acuse / notificación:</span>
                <span className="font-medium text-slate-800 text-right">
                  {usuario && (!atenderTercero || esCiudadano) ? usuario.correo : solicitante.correo}
                </span>
              </div>

              {definicionActual.tipoFormulario === 'VENTA_BIEN' && valoresForm.cantidad && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Cantidad solicitada:</span>
                  <span className="font-bold text-slate-900">{valoresForm.cantidad} ({definicionActual.unidadCobro})</span>
                </div>
              )}

              {definicionActual.tipoFormulario === 'ALQUILER' && valoresForm.cantidadPeriodos && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Periodos de alquiler:</span>
                  <span className="font-bold text-slate-900">{valoresForm.cantidadPeriodos} ({definicionActual.unidadCobro})</span>
                </div>
              )}
            </div>

            {/* Tarjeta de Importe Total a Liquidar */}
            {definicionActual.monto > 0 && (
              <div className="rounded-xl bg-blue-950 text-white p-4 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-200 tracking-wider block">
                    Total a Liquidar ante Tesorería
                  </span>
                  <span className="text-xs text-blue-300">Arancel institucional oficial</span>
                </div>
                <span className="font-mono text-2xl font-black text-amber-400">
                  S/ {importeCalculado.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-blue-900 shrink-0 mt-0.5" />
            <span>
              Al pulsar <strong>Confirmar y Enviar Solicitud</strong>, el requerimiento se registrará en el sistema
              institucional y se emitirá el código correlativo oficial para su liquidación ante Tesorería o despacho en el área correspondiente.
            </span>
          </div>

          {!token && esCiudadano && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Debe iniciar sesión para registrar una solicitud institucional por esta vía.</span>
            </div>
          )}

          {errorEnvio && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong className="block font-bold">No se pudo procesar la solicitud:</strong>
                <span>{errorEnvio}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </ModalBase>
  );
}
