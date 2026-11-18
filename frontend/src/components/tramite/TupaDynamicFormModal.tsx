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

  // Datos del solicitante
  const [solicitante, setSolicitante] = useState<SolicitanteFormState>(
    solicitanteInicial ?? {
      tipoPersona: 'NATURAL',
      numeroDocumento: '',
      correo: '',
      celular: '',
    }
  );

  // Inicializar solicitante con datos de sesión si existen
  useEffect(() => {
    if (usuario) {
      setSolicitante((prev) => ({
        ...prev,
        correo: prev.correo || usuario.correo || '',
        numeroDocumento: prev.numeroDocumento || (usuario as any).dni || (usuario as any).numeroDocumento || '',
      }));
    }
  }, [usuario]);

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
        return <ShoppingBag className="h-4 w-4 text-amber-600" />;
      case 'ALQUILER':
        return <Building className="h-4 w-4 text-sky-600" />;
      case 'ACADEMICO':
        return <GraduationCap className="h-4 w-4 text-indigo-600" />;
      case 'ACTUACION_INTERNA':
        return <Lock className="h-4 w-4 text-rose-600" />;
      default:
        return <FileText className="h-4 w-4 text-cyan-700" />;
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
    // 1. Validar solicitante si no es ciudadano autenticado
    if (!usuario) {
      const tipoDoc = solicitante.tipoPersona === 'JURIDICA' ? 'RUC' : 'DNI';
      const valDoc = validarNumeroDocumento(solicitante.numeroDocumento, tipoDoc);
      if (!valDoc.esValido) {
        setErrorEnvio(valDoc.mensajeError || 'Ingrese un número de documento válido.');
        return false;
      }
      if (!solicitante.correo.trim() || !solicitante.correo.includes('@')) {
        setErrorEnvio('Ingrese un correo electrónico válido para las notificaciones.');
        return false;
      }
    }

    // 2. Validar campos obligatorios de la definición
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

    const token = useAuthStore.getState().accessToken;
    if (!token && esCiudadano) {
      setErrorEnvio('Para registrar una solicitud institucional debe iniciar sesión con una cuenta autorizada.');
      return;
    }

    setEnviando(true);
    setErrorEnvio(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/tramites/solicitudes-dinamicas', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tipoFormulario: definicionActual.tipoFormulario,
          codigoTupa: definicionActual.codigoRef,
          denominacion: definicionActual.denominacion,
          montoTotal: importeCalculado,
          datosFormulario: valoresForm,
          telefono: valoresForm.telefonoContacto ?? solicitante.celular ?? undefined,
          observacion:
            valoresForm.observacionesComerciales ??
            valoresForm.observacionesUso ??
            valoresForm.asuntoPetitorio ??
            valoresForm.observacionesAcademicas,
          ...(!esCiudadano && !definicionActual.bloqueadoParaCiudadano ? { solicitante } : {}),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Error al procesar la solicitud.');
      }

      const data: unknown = await res.json();
      if (
        typeof data !== 'object' ||
        data === null ||
        !('codigoSolicitud' in data) ||
        typeof data.codigoSolicitud !== 'string' ||
        !/^SOL-\d{4}-\d{6}$/.test(data.codigoSolicitud)
      ) {
        throw new Error('El servidor no devolvió un código de solicitud válido.');
      }

      setSolicitudGenerada(data.codigoSolicitud);
      if (onExito) onExito(data.codigoSolicitud);
    } catch (err: unknown) {
      setErrorEnvio(err instanceof Error ? err.message : 'No se pudo registrar la solicitud. Intente nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  // Cabecera institucional del ModalBase
  const modalTitle = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="p-1.5 rounded-lg bg-slate-100 border border-slate-200">
        {getTipoIcono(definicionActual.tipoFormulario)}
      </span>
      <span>Solicitud de Servicio Institucional</span>
      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
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
    <span className="block truncate">
      {definicionActual.denominacion} — Tarifa: {definicionActual.montoTexto} ({definicionActual.unidadCobro})
    </span>
  );

  // Botonera inferior según el paso activo
  const modalFooter = solicitudGenerada ? (
    <div className="flex items-center justify-end gap-3 w-full">
      <Button
        variant="secondary"
        size="md"
        onClick={() => {
          setSolicitudGenerada(null);
          setPaso(1);
          setValoresForm({});
        }}
      >
        Registrar Otra Solicitud
      </Button>
      <Button variant="primary" size="md" onClick={onClose}>
        Cerrar
      </Button>
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
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
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
              <Button variant="primary" size="md">
                Ir a Mesa de Partes Digital (CUT) <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setPaso(2)}
              disabled={definicionActual.bloqueadoParaCiudadano && esCiudadano}
            >
              Completar Solicitud <ArrowRight className="h-4 w-4 ml-1" />
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
          >
            Revisar Resumen <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}

        {paso === 3 && (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void handleSubmit()}
            disabled={enviando || (definicionActual.bloqueadoParaCiudadano && esCiudadano) || (!token && esCiudadano)}
          >
            {enviando
              ? 'Enviando solicitud...'
              : !token && esCiudadano
              ? 'Inicio de Sesión Requerido'
              : 'Confirmar y Enviar Solicitud'}
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
      {/* 1. Indicador visual de pasos */}
      {!solicitudGenerada && (
        <div className="mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <div className={`flex items-center gap-2 ${paso === 1 ? 'text-suiza-primary font-bold' : paso > 1 ? 'text-emerald-700' : ''}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${paso === 1 ? 'bg-suiza-primary text-white' : paso > 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                1
              </span>
              <span>Orientación</span>
            </div>
            <div className="flex-1 h-0.5 mx-3 bg-slate-200">
              <div className={`h-full bg-suiza-primary transition-all duration-300 ${paso === 1 ? 'w-0' : paso === 2 ? 'w-1/2' : 'w-full'}`} />
            </div>
            <div className={`flex items-center gap-2 ${paso === 2 ? 'text-suiza-primary font-bold' : paso > 2 ? 'text-emerald-700' : ''}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${paso === 2 ? 'bg-suiza-primary text-white' : paso > 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                2
              </span>
              <span>Datos</span>
            </div>
            <div className="flex-1 h-0.5 mx-3 bg-slate-200">
              <div className={`h-full bg-suiza-primary transition-all duration-300 ${paso < 3 ? 'w-0' : 'w-full'}`} />
            </div>
            <div className={`flex items-center gap-2 ${paso === 3 ? 'text-suiza-primary font-bold' : ''}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${paso === 3 ? 'bg-suiza-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                3
              </span>
              <span>Confirmación</span>
            </div>
          </div>
        </div>
      )}

      {/* Pantalla de Éxito */}
      {solicitudGenerada ? (
        <div className="py-6 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              ¡Solicitud Registrada con Éxito!
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mt-1">
              Se ha generado su código oficial de seguimiento para este servicio del IESTP Suiza:
            </p>
          </div>

          <div className="inline-flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block text-left">
                Código de Solicitud
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wider">
                {solicitudGenerada}
              </span>
            </div>
            <button
              type="button"
              onClick={copiarCodigo}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
              title="Copiar código"
              aria-label="Copiar código de solicitud"
            >
              {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-cyan-50/60 border border-cyan-200 text-xs text-cyan-950 text-left space-y-2 max-w-lg mx-auto">
            <strong className="block text-cyan-900">Pasos siguientes para su atención:</strong>
            <p>
              1. <strong>Liquidación:</strong> Si el servicio cuenta con arancel oficial y no realizó el pago previo, acérquese a la ventanilla de Tesorería del instituto con su código de solicitud.
            </p>
            <p>
              2. <strong>Atención y retiro:</strong> Para la entrega de bienes o coordinación de uso, contacte a la dependencia encargada: <strong>{definicionActual.unidadResponsable}</strong>.
            </p>
          </div>
        </div>
      ) : paso === 1 ? (
        /* PASO 1: Orientación del Concepto */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="text-xs font-mono font-bold text-slate-700">
                Datos del Formulario ({definicionActual.tipoFormulario}) · Código: {definicionActual.codigoRef}
              </span>
              <span className="text-xs font-bold text-suiza-primary bg-white px-2.5 py-1 rounded-md border border-slate-200">
                {definicionActual.montoTexto} ({definicionActual.unidadCobro})
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-900 leading-snug">
                {definicionActual.denominacion}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="flex items-center gap-2 text-slate-700">
                <Coins className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Arancel / Tarifa</span>
                  <span className="font-semibold text-slate-900">{definicionActual.montoTexto}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Plazo Estimado</span>
                  <span className="font-semibold text-slate-900">{definicionActual.plazo}</span>
                </div>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 text-slate-700 border-t border-slate-100 pt-2">
                <Building className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Área Responsable</span>
                  <span className="font-medium text-slate-800">{definicionActual.unidadResponsable}</span>
                </div>
              </div>
            </div>

            {definicionActual.requisitos.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 uppercase block mb-1.5">
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

          {/* Alertas orientativas */}
          {definicionActual.generaExpediente && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
              <Info className="h-5 w-5 shrink-0 text-blue-700 mt-0.5" />
              <div>
                <strong>Trámite con Radicación Formal:</strong> Este procedimiento administrativo oficial genera
                un expediente institucional con Código Único de Trámite (CUT) y foliación digital en Mesa de Partes.
              </div>
            </div>
          )}

          {definicionActual.bloqueadoParaCiudadano && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
              <Lock className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong>Gestión interna institucional:</strong> Este concepto es de uso exclusivo del personal
                del IESTP "Suiza". Los ciudadanos externos no pueden formular esta solicitud.
              </div>
            </div>
          )}

          {(definicionActual.tipoFormulario === 'VENTA_BIEN' || definicionActual.tipoFormulario === 'ALQUILER') && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                <strong>Aviso de disponibilidad:</strong> La venta o alquiler se encuentra sujeta al stock físico o calendario de uso coordinado con el centro de producción del instituto.
              </span>
            </div>
          )}

          {!token && esCiudadano && (
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-suiza-primary mt-0.5" />
              <span>
                <strong>Atención Institucional:</strong> El registro digital directo de esta solicitud está reservado para ventanilla con cuenta institucional. Para coordinar su trámite de manera particular, acérquese al área responsable.
              </span>
            </div>
          )}
        </div>
      ) : paso === 2 ? (
        /* PASO 2: Datos de la Solicitud */
        <div className="space-y-4">
          {/* Identificación del Solicitante */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Datos del Solicitante
            </span>

            {usuario ? (
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                <p className="text-slate-600">
                  Solicitante: <strong>{usuario.nombreCompleto}</strong> ({usuario.rol})
                </p>
                <p className="text-slate-600">
                  Correo registrado: <strong>{usuario.correo}</strong>
                </p>
                <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Identidad verificada por sesión
                </span>
              </div>
            ) : (
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
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-suiza-primary"
                  >
                    <option value="NATURAL">Persona natural</option>
                    <option value="JURIDICA">Empresa o entidad (Persona jurídica)</option>
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
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-suiza-primary font-mono"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {obtenerTextoAyudaDocumento(solicitante.tipoPersona === 'JURIDICA' ? 'RUC' : 'DNI')}
                  </p>
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
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-suiza-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Teléfono Celular
                  </label>
                  <input
                    type="tel"
                    value={solicitante.celular}
                    onChange={(e) =>
                      setSolicitante((prev) => ({ ...prev, celular: e.target.value }))
                    }
                    placeholder="Ej. 961123456"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-suiza-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Campos específicos de la definición del TUPA */}
          <div className="space-y-3 pt-1">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Detalle de la Solicitud · Datos del Formulario ({definicionActual.tipoFormulario})
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
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-suiza-primary"
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
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-suiza-primary"
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
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-suiza-primary"
                    />
                  )}

                  {campo.ayuda && (
                    <span className="text-[10px] text-slate-500 mt-0.5 block">{campo.ayuda}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumen dinámico del importe */}
          {definicionActual.monto > 0 && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100/80 border border-slate-200">
              <span className="text-xs font-bold text-slate-800">
                Importe Total Calculado ({definicionActual.unidadCobro}):
              </span>
              <span className="font-mono text-base font-black text-slate-900">
                S/ {importeCalculado.toFixed(2)}
              </span>
            </div>
          )}

          {errorEnvio && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorEnvio}</span>
            </div>
          )}
        </div>
      ) : (
        /* PASO 3: Revisión y Confirmación */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block border-b border-slate-200 pb-2">
              Resumen de la Solicitud
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Concepto solicitado:</span>
                <span className="font-bold text-slate-900 text-right">{definicionActual.denominacion}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Código TUPA:</span>
                <span className="font-mono font-semibold text-slate-800">{definicionActual.codigoRef}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Dependencia responsable:</span>
                <span className="font-medium text-slate-800">{definicionActual.unidadResponsable}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Solicitante:</span>
                <span className="font-medium text-slate-800">
                  {usuario ? usuario.nombreCompleto : solicitante.numeroDocumento || 'Persona no identificada'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Correo de notificación:</span>
                <span className="font-medium text-slate-800">
                  {usuario ? usuario.correo : solicitante.correo}
                </span>
              </div>

              {definicionActual.monto > 0 && (
                <div className="flex justify-between py-2 border-t border-slate-200 text-sm">
                  <span className="font-bold text-slate-900">Total a Liquidar:</span>
                  <span className="font-mono font-black text-suiza-primary">
                    S/ {importeCalculado.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600">
            Al pulsar <strong>Confirmar y Enviar Solicitud</strong>, el requerimiento se registrará en el sistema
            institucional y se emitirá el código único de solicitud para su seguimiento ante Tesorería o la dependencia correspondiente.
          </div>

          {!token && esCiudadano && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Debe iniciar sesión para registrar una solicitud institucional por esta vía.</span>
            </div>
          )}

          {errorEnvio && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorEnvio}</span>
            </div>
          )}
        </div>
      )}
    </ModalBase>
  );
}
