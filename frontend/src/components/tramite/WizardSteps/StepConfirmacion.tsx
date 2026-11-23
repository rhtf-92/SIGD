/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-15 — Subvista Modular 4: Confirmación y Emisión de Cargo Digital
 * ARCHIVO: src/components/tramite/WizardSteps/StepConfirmacion.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Subvista desacoplada para la revisión final de datos consolidados, radicación
 * formal del expediente y visualización del Cargo Digital con CUT inmutable,
 * trazabilidad criptográfica SHA-256 y código QR (LPAG Ley N° 27444).
 *
 * Características:
 * - Resumen auditado de los pasos 1, 2 y 3 con navegación directa para correcciones.
 * - Despacho de acción atómica SET_CARGO con generación oficial del CUT.
 * - Ticket digital imprimible y trazabilidad con QrCodeView.
 * - Cero 'any', 100% tipado estricto con contratos de tramiteWizardState.ts.
 * ==============================================================================
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  TramiteWizardState,
  WizardAction,
  WizardStep,
  CargoDigitalResponse,
} from '../../../types/tramiteWizardState';
import QrCodeView from '../../common/QrCodeView';
import { apiClient } from '../../../api/client';
import { useAuthStore } from '../../../stores/authStore';
import { ApiHttpError } from '../../../types/api';
import { TRAMITE_WIZARD_STORAGE_KEY } from '../../../hooks/useTramiteWizardReducer';
import { submitPublicRequest, completePublicSubmission, publicTrackingUrl, publicAvailability } from '../../../services/radicacionPublicaService';
import { Link, useLocation } from 'react-router-dom';
import { OrdenPosteriorRadicacion, type EstadoOrdenPosterior } from '../OrdenPosteriorRadicacion';

interface RadicacionVirtualResponse {
  tesoreria?: EstadoOrdenPosterior;
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  diferidoPorCorte: boolean;
  totalFolios: number;
  qrSeguimientoUrl: string;
  cargoDigital: {
    codigo: string;
    hashSha256: string;
    qrContenido: string;
  };
  mensajeLegal: string;
}

interface TipoTramiteFormal {
  id: string;
  codigo: string;
  denominacion: string;
  descripcion?: string | null;
  vigente: true;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validarCatalogoFormal(data: unknown): TipoTramiteFormal[] | null {
  if (!Array.isArray(data)) return null;
  const resultado: TipoTramiteFormal[] = [];
  const ids = new Set<string>();
  const codigos = new Set<string>();
  for (const item of data) {
    if (
      typeof item !== 'object' || item === null ||
      !('id' in item) || typeof item.id !== 'string' || !UUID_RE.test(item.id) ||
      !('codigo' in item) || typeof item.codigo !== 'string' || !item.codigo.trim() ||
      !('denominacion' in item) || typeof item.denominacion !== 'string' || !item.denominacion.trim() ||
      !('vigente' in item) || item.vigente !== true ||
      ('descripcion' in item && item.descripcion !== null && typeof item.descripcion !== 'string')
    ) return null;
    const id = item.id.toLowerCase();
    const codigo = item.codigo.trim();
    if (ids.has(id) || codigos.has(codigo)) return null;
    ids.add(id);
    codigos.add(codigo);
    resultado.push({ id: item.id, codigo, denominacion: item.denominacion, descripcion: 'descripcion' in item ? item.descripcion as string | null : undefined, vigente: true });
  }
  return resultado;
}


export interface StepConfirmacionProps {
  /** Estado global canónico del asistente */
  state: TramiteWizardState;
  /** Despachador de acciones atómicas hacia el reducer del wizard */
  dispatch: React.Dispatch<WizardAction>;
  /** Callback para retroceder al paso anterior (Paso 3) */
  onBack: () => void;
  /** Callback opcional para navegar directamente a un paso específico */
  onGoToStep?: (step: WizardStep) => void;
  /** Callback opcional ejecutado al completar satisfactoriamente la radicación */
  onSuccess?: (cargo: CargoDigitalResponse, cutGenerado: string) => void;
}

function EnlaceInicioSesionParaRetomar(): React.ReactElement {
  let location: { pathname: string; search: string; hash: string } | null = null;
  try {
    location = useLocation();
  } catch {
    location = null;
  }
  if (!location) {
    return (
      <a href="/login" className="font-bold underline">
        Iniciar sesion y volver a la solicitud
      </a>
    );
  }
  return (
    <Link
      to="/login"
      state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash } }}
      className="font-bold underline"
    >
      Iniciar sesion y volver a la solicitud
    </Link>
  );
}

export const StepConfirmacion: React.FC<StepConfirmacionProps> = ({
  state,
  dispatch,
  onBack,
  onGoToStep,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore(auth => auth.isAuthenticated);
  const [disponiblePublico, setDisponiblePublico] = useState(false);
  const esPublico = !isAuthenticated && disponiblePublico;
  const esCiudadano = useAuthStore(auth => auth.usuario?.rol === 'CIUDADANO' || Boolean(auth.usuario?.roles?.includes('CIUDADANO')));
  const envioEnCurso = useRef(false);
  const [copiado, setCopiado] = useState(false);
  const [tiposFormales, setTiposFormales] = useState<TipoTramiteFormal[]>([]);
  const [ordenPosterior,setOrdenPosterior]=useState<{expedienteId:string;inicial?:EstadoOrdenPosterior}|null>(null);
  const [estadoCatalogo, setEstadoCatalogo] = useState<'cargando' | 'disponible' | 'error'>('cargando');
  const [intentoCatalogo, setIntentoCatalogo] = useState(0);
  const {
    identificacion,
    documentos,
    declaracionJurada,
    cargoEmitido,
    isSubmitting,
    error,
  } = state;

  useEffect(() => {
    const controller = new AbortController();
    setEstadoCatalogo('cargando');
    apiClient.get<unknown>('/api/v1/tramites/tipos', { signal: controller.signal })
      .then((respuesta) => {
        if (controller.signal.aborted) return;
        const tipos = validarCatalogoFormal(respuesta.data);
        if (!tipos) {
          setTiposFormales([]);
          setEstadoCatalogo('error');
          return;
        }
        setTiposFormales(tipos);
        setEstadoCatalogo('disponible');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTiposFormales([]);
          setEstadoCatalogo('error');
        }
      });
    return () => controller.abort();
  }, [intentoCatalogo]);

  const tipoSeleccionado = tiposFormales.find((tipo) => tipo.id === documentos.tipoTramiteId);
  const [avisoDemo, setAvisoDemo] = useState<string | null>(null);
  useEffect(() => {
    let activo = true;
    publicAvailability().then(tipos => {
      const tipo = tipos.find(t => t.id === documentos.tipoTramiteId);
      if (activo) {
        setDisponiblePublico(Boolean(tipo?.habilitado));
        setAvisoDemo(tipo?.omisionPagoDemo && !documentos.ordenPagoId ? tipo.motivo : null);
      }
    }).catch(() => {
      if (activo) {
        setDisponiblePublico(false);
        setAvisoDemo(null);
      }
    });
    return () => { activo = false; };
  }, [isAuthenticated, documentos.tipoTramiteId, documentos.ordenPagoId]);

  const navigateToStep = useCallback(
    (step: WizardStep) => {
      if (onGoToStep) {
        onGoToStep(step);
      } else {
        dispatch({ type: 'SET_STEP', payload: step });
      }
    },
    [dispatch, onGoToStep]
  );

  const handleCopiarCut = async () => {
    if (!cargoEmitido?.cut) return;
    try {
      await navigator.clipboard.writeText(cargoEmitido.cut);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleRadicar = async () => {
    if (isSubmitting || envioEnCurso.current) return;
    if (!esPublico && !useAuthStore.getState().accessToken) {
      dispatch({
        type: 'SET_ERROR',
        payload: 'Inicie sesion con una cuenta vinculada a una persona para radicar la solicitud.',
      });
      return;
    }

    if (estadoCatalogo !== 'disponible') {
      dispatch({
        type: 'SET_ERROR',
        payload: 'No se pudo verificar el catálogo formal vigente. No se envió la radicación; vuelva al paso anterior e inténtelo nuevamente.',
      });
      return;
    }

    if (!UUID_RE.test(documentos.tipoTramiteId) || !tipoSeleccionado) {
      dispatch({
        type: 'SET_ERROR',
        payload: 'La selección guardada no tiene un vínculo UUID único con un tipo formal vigente. Vuelva al paso 2 y seleccione nuevamente; no se resolvieron códigos antiguos por semejanza.',
      });
      return;
    }

    if (documentos.archivos.length === 0 || documentos.archivos.some((a) =>
      !a.storageUrl || !/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i.test(a.storageUrl) ||
      !/^[0-9a-f]{64}$/i.test(a.hashSha256) || !Number.isInteger(a.peso) || a.peso <= 0
    )) {
      dispatch({ type: 'SET_ERROR', payload: 'Debe volver al paso 2 y subir los documentos al almacenamiento institucional antes de radicar.' });
      return;
    }
    const nombreCompleto =
        identificacion.tipoDocumento === 'RUC'
          ? identificacion.nombres.trim()
          : `${identificacion.nombres} ${identificacion.apellidos}`.trim();
    const asuntoFinal = documentos.asunto.trim();
    const correo = identificacion.correo.trim().toLowerCase();
    if (asuntoFinal.length < 10 || asuntoFinal.length > 500 || nombreCompleto.length < 2 || nombreCompleto.length > 120
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 150
        || !identificacion.numeroDocumento.trim() || identificacion.numeroDocumento.length > 20
        || !Number.isInteger(documentos.numeroFolios) || documentos.numeroFolios < 1 || documentos.numeroFolios > 5000) {
      dispatch({ type: 'SET_ERROR', payload: 'Revise la identificación, el correo, el asunto y los folios en los pasos anteriores. No se sustituirán datos faltantes para enviar la solicitud.' });
      return;
    }
    envioEnCurso.current = true;
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    try {

      const idTipoTramite = tipoSeleccionado.id;

      const archivosPayload = documentos.archivos.map((a) => ({
              nombreArchivo: a.nombre,
              contentType: 'application/pdf',
              tamanoBytes: a.peso,
              hashSha256: a.hashSha256.toLowerCase(),
              storagePath: a.storageUrl,
              ...(a.clasificacion ? { clasificacion: a.clasificacion, requisitoId: a.requisitoId } : {
                tipoDocumentalCodigo: a.tipoDocumentalCodigo,
                tipoDocumentalId: a.tipoDocumentalId,
              }),
            }));

      const payload = {
        asunto: asuntoFinal,
        idTipoTramiteTupa: idTipoTramite,
        tipoDocumento: identificacion.tipoDocumento,
        numeroDocumento: identificacion.numeroDocumento,
        nombreSolicitante: nombreCompleto,
        correo,
        totalFolios: documentos.numeroFolios,
        ...(documentos.ordenPagoId ? { ordenPagoId: documentos.ordenPagoId } : {}),
        documentos: archivosPayload,
      };

      const res = esPublico ? await submitPublicRequest<RadicacionVirtualResponse>({ ...payload,
        nombres: identificacion.nombres.trim(), apellidos: identificacion.apellidos.trim(), telefono: identificacion.telefono.trim(),
        declaracionVeracidad: state.declaracionJurada.declaracionVeracidad, aceptaTerminos: state.declaracionJurada.aceptaTerminos,
      }) : await apiClient.post<RadicacionVirtualResponse>(
        '/api/v1/tramites/radicacion-virtual',
        payload,
      );

      const serverData = res.data;
      if (res.status !== 201 || !serverData ||
          !UUID_RE.test(serverData.expedienteId) || !/^EXP-\d{4}-\d{6}$/.test(serverData.cut) ||
          serverData.anioFiscal !== Number(serverData.cut.slice(4, 8)) ||
          typeof serverData.fechaEnvioReal !== 'string' || !serverData.fechaEnvioReal.trim() ||
          typeof serverData.fechaRadicacionLegal !== 'string' || !serverData.fechaRadicacionLegal.trim() ||
          !Number.isSafeInteger(serverData.totalFolios) || serverData.totalFolios<1 || serverData.totalFolios>5000 || typeof serverData.diferidoPorCorte !== 'boolean' ||
          typeof serverData.qrSeguimientoUrl !== 'string' || !serverData.qrSeguimientoUrl.trim() ||
          serverData.cargoDigital?.codigo !== serverData.cut ||
          serverData.cargoDigital?.qrContenido !== serverData.qrSeguimientoUrl) {
        throw new Error('La respuesta no confirma la radicación del expediente.');
      }
      if (typeof serverData.cargoDigital?.hashSha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(serverData.cargoDigital.hashSha256)) {
        throw new Error('La respuesta no contiene la huella del cargo digital.');
      }
      const cargoEmitido: CargoDigitalResponse = {
        mensajeLegal: serverData.mensajeLegal,
        cut: serverData.cut,
        fechaRadicacion: serverData.fechaRadicacionLegal,
        fechaRecepcionOficial: serverData.fechaEnvioReal,
        asunto: documentos.asunto,
        remitente: nombreCompleto,
        hashTransaccion: serverData.cargoDigital.hashSha256,
        qrValidationUrl: esPublico ? publicTrackingUrl(serverData.cut) : serverData.qrSeguimientoUrl,
      };

      setOrdenPosterior({expedienteId:serverData.expedienteId,inicial:serverData.tesoreria});
      dispatch({type:'UPDATE_DOCUMENTOS',payload:{numeroFolios:serverData.totalFolios}});
      void queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      if (esPublico) completePublicSubmission(serverData.cut);
      try {
        window.sessionStorage.removeItem(TRAMITE_WIZARD_STORAGE_KEY);
      } catch {
        // El cargo sigue siendo válido aunque el navegador restrinja el almacenamiento.
      }
      dispatch({ type: 'SET_CARGO', payload: cargoEmitido });

      if (onSuccess) {
        onSuccess(cargoEmitido, serverData.cut);
      }
    } catch (err: unknown) {
      const status = err instanceof ApiHttpError
        ? err.status
        : (err as { status?: number; response?: { status?: number } })?.status ??
          (err as { response?: { status?: number } })?.response?.status;
      console.error('[StepConfirmacion] No se pudo confirmar la radicación.', { status });

      const detail = err instanceof ApiHttpError
        ? (err.problemDetails?.detail || err.message || '')
        : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (err as { message?: string })?.message ??
          '';

      const detailNorm = detail.toLowerCase();
      const invalidParams = err instanceof ApiHttpError
        ? err.problemDetails.invalidParams ?? []
        : [];
      const validationReasons = invalidParams.map((param) => param.reason.toUpperCase());

      let mensajeError: string;
      if (esPublico && [403, 410, 413, 415, 422, 429, 503].includes(status ?? 0)) {
        mensajeError = detail || 'No se pudo completar la radicación pública. Revise los datos del formulario.';
      } else if (status === 401) {
        if (detailNorm.includes('expirado') || detailNorm.includes('vigente') || detailNorm.includes('caducada')) {
          mensajeError = 'Su sesión ha caducado o no corresponde a una cuenta activa. Inicie sesión nuevamente para radicar la solicitud.';
        } else {
          mensajeError = 'Inicie sesion con una cuenta vinculada a una persona para radicar la solicitud.';
        }
      } else if (status === 403) {
        if (detailNorm.includes('no coinciden con la identidad')) {
          mensajeError = 'Discrepancia de identidad: los datos declarados no coinciden con la identidad vinculada a su sesión. Vuelva al Paso 1 y compruebe el tipo y número de documento y los nombres del titular autenticado.';
        } else if (detailNorm.includes('no está habilitada') || detailNorm.includes('no tiene una identidad')) {
          mensajeError = 'Cuenta no habilitada para radicar: Su cuenta no tiene una identidad (persona natural o jurídica) registrada y habilitada en el sistema institucional. Comuníquese con la administración institucional del IESTP «Suiza» para validar su identidad.';
        } else if (detailNorm.includes('mesa_partes')) {
          mensajeError = 'Operación no autorizada: Esta acción requiere el rol de operador de Mesa de Partes vigente. Para registrar solicitudes presenciales de terceros, utilice la Ventanilla Presencial.';
        } else if (detailNorm.includes('no cuenta con permisos')) {
          mensajeError = 'Acceso denegado: su cuenta no tiene autorización para esta operación. La radicación virtual solo permite presentar solicitudes a nombre del titular autenticado.';
        } else if (detail && !detailNorm.includes('no cuenta con permisos')) {
          mensajeError = `Acceso denegado: ${detail}`;
        } else {
          mensajeError = 'La cuenta no esta habilitada para radicar o los datos declarados no coinciden con su identidad.';
        }
      } else if (status === 503) {
        mensajeError = 'La Mesa de Partes Virtual no está disponible temporalmente. Para evitar trámites duplicados, verifique el estado con Mesa de Partes antes de volver a enviar o acuda a la Mesa de Partes presencial de la institución. Los datos de su solicitud se conservan en pantalla.';
      } else if (status === 409) {
        mensajeError = 'El servidor detectó un conflicto al registrar la solicitud. No la vuelva a enviar hasta comprobar si ya se generó un expediente; sus datos permanecen en pantalla.';
      } else if (status === 400 || status === 422) {
        if (validationReasons.some((reason) => reason.includes('DOCUMENTOS_FALTANTES'))) {
          mensajeError = 'Faltan documentos requeridos para este procedimiento. Revise los documentos indicados en el paso 2.';
        } else if (validationReasons.some((reason) => reason.includes('TIPO_DOCUMENTAL_NO_AUTORIZADO'))) {
          mensajeError = 'Uno o más archivos tienen una clasificación que no corresponde al procedimiento seleccionado. Vuelva al paso 2 y revise los documentos.';
        } else if (validationReasons.some((reason) => reason.includes('TIPO_DOCUMENTAL_DUPLICADO'))) {
          mensajeError = 'Hay más de un archivo con la misma clasificación. Revise los documentos del paso 2.';
        } else if (validationReasons.some((reason) => reason.includes('CLASIFICACION_DOCUMENTAL'))) {
          mensajeError = 'No se pudo validar la clasificación documental de este procedimiento. Consulte con Mesa de Partes antes de volver a enviar.';
        } else if (validationReasons.some((reason) => reason.includes('TIPO_TRAMITE_INACTIVO') || reason.includes('TIPO_TRAMITE_DESCONOCIDO'))) {
          mensajeError = 'El procedimiento seleccionado ya no está disponible para nuevas radicaciones. Vuelva al paso 2 y elija uno vigente.';
        } else {
          const campos = [...new Set(invalidParams.map((param) => param.name))].filter(Boolean);
          mensajeError = campos.length
            ? `Revise los campos indicados (${campos.join(', ')}) y vuelva a intentarlo. Sus datos se conservaron.`
            : 'La solicitud no superó una validación. Revise los pasos anteriores; sus datos se conservaron.';
        }
      } else if (typeof status !== 'number') {
        mensajeError = 'No se recibió confirmación del servidor. Para evitar solicitudes duplicadas, verifique el estado con Mesa de Partes antes de volver a enviar. Los datos de su solicitud permanecen en pantalla.';
      } else {
        mensajeError = 'El servidor institucional reportó un error al procesar la solicitud. No es posible confirmar si la radicación llegó a completarse. Para evitar trámites duplicados, verifique el estado con Mesa de Partes antes de volver a enviar. Los datos de su solicitud permanecen en pantalla.';
      }

      dispatch({
        type: 'SET_ERROR',
        payload: mensajeError,
      });
    } finally {
      envioEnCurso.current = false;
    }
  };

  const handleIniciarNuevoTramite = () => {
    dispatch({ type: 'RESET' });
  };

  // ===========================================================================
  // ESCENARIO 2: CARGO DIGITAL YA RADICADO CON ÉXITO
  // ===========================================================================
  if (cargoEmitido) {
    return (
      <div className="space-y-6">
        {ordenPosterior&&<OrdenPosteriorRadicacion expedienteId={ordenPosterior.expedienteId} cut={cargoEmitido.cut} publico={esPublico} inicial={ordenPosterior.inicial}/>}
        {cargoEmitido.mensajeLegal?.includes('RADICACIÓN DEMOSTRATIVA') && (
          <p role="status" className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs sm:text-sm text-blue-900">
            {cargoEmitido.mensajeLegal}
          </p>
        )}
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-sm text-center">
          {/* Icono de Confirmación Oficial */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3 shadow-xs">
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
            Radicación Formal Exitosa (Mesa de Partes Virtual)
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Cargo de Recepción Digital (CUT)
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Su expediente ha sido asentado en el Sistema de Gestión Documentaria del IESTP &ldquo;Suiza&rdquo; con valor legal conforme al TUO de la Ley N° 27444.
          </p>

          {/* Tarjeta Destacada del CUT */}
          <div className="mt-5 inline-block rounded-xl border-2 border-dashed border-[#006EC7] bg-blue-50/70 px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Código Único de Trámite
            </p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-[#006EC7] mt-1 font-mono">
              {cargoEmitido.cut}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCopiarCut}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#006EC7] hover:underline cursor-pointer"
              >
                {copiado ? '✓ ¡CUT Copiado al Portapapeles!' : 'Copiar Código CUT'}
              </button>
            </div>
          </div>

          {/* Código QR de Validación 24/7 */}
          <div className="mt-6 flex flex-col items-center justify-center">
            <QrCodeView
              value={cargoEmitido.qrValidationUrl || cargoEmitido.cut}
              size={135}
              ariaLabel={`Código QR de validación legal para el expediente ${cargoEmitido.cut}`}
            />
            <p className="text-[11px] text-slate-500 mt-2 font-mono">
              Escanee para verificar autenticidad y estado procesal en línea
            </p>
          </div>

          {/* Resumen del Cargo */}
          <div className="mt-6 max-w-lg mx-auto text-left rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 text-xs text-slate-700">
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900">Remitente:</span>
              <span className="truncate max-w-[240px]">{cargoEmitido.remitente}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900">Asunto:</span>
              <span className="truncate max-w-[240px]">{cargoEmitido.asunto}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900">Fecha de Radicación:</span>
              <span className="font-mono">{cargoEmitido.fechaRadicacion}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900">Recepción Oficial:</span>
              <span className="font-semibold text-emerald-700 font-mono">
                {cargoEmitido.fechaRecepcionOficial}
              </span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="font-bold text-slate-900">Hash SHA-256:</span>
              <span className="text-[10px] text-slate-500 font-mono truncate max-w-[220px]">
                {cargoEmitido.hashTransaccion}
              </span>
            </div>
          </div>

          {/* Botonera Posterior */}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a
              href={esPublico ? `/consulta/${cargoEmitido.cut}` : esCiudadano ? '/consulta' : '/expedientes'}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              {esPublico ? 'Consultar esta solicitud' : 'Ver mis expedientes'}
            </a>
            <button
              type="button"
              onClick={handleImprimir}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
            >
              🖨️ Imprimir Ticket de Cargo
            </button>
            <button
              type="button"
              onClick={handleIniciarNuevoTramite}
              className="inline-flex items-center gap-2 rounded-lg bg-[#006EC7] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#005ba3] transition cursor-pointer shadow-xs"
            >
              Iniciar Nuevo Trámite
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // ESCENARIO 1: RESUMEN CONSOLIDADO ANTES DE RADICAR
  // ===========================================================================
  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
          Paso 4 de 4
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
          Confirmación y Emisión de Cargo
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Revise minuciosamente el consolidado de datos antes de asentar legalmente su expediente institucional.
        </p>
      </header>

      {avisoDemo && (
        <div role="status" className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs sm:text-sm text-blue-900 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-[#006EC7] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold text-[#005bb5]">Información de pago:</span>{' '}
            {avisoDemo}
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 flex items-center justify-between"
        >
          <span className="space-y-2">
            <span className="block">⚠️ {error}</span>
            {(error.toLocaleLowerCase('es-PE').includes('inicie sesion') || error.toLocaleLowerCase('es-PE').includes('inicie sesión')) && (
              <span className="block"><EnlaceInicioSesionParaRetomar /></span>
            )}
            {error.toLocaleLowerCase('es-PE').includes('paso 1') && onGoToStep && (
              <span className="block">
                <button
                  type="button"
                  onClick={() => onGoToStep(1)}
                  className="font-bold underline text-red-900 hover:text-red-700 cursor-pointer"
                >
                  Volver al Paso 1 para corregir la identidad
                </button>
              </span>
            )}
            {error.toLocaleLowerCase('es-PE').includes('ventanilla presencial') && (
              <span className="block">
                <a
                  href="/tramite/ventanilla-presencial"
                  className="font-bold underline text-red-900 hover:text-red-700"
                >
                  Ir al módulo de Ventanilla Presencial
                </a>
              </span>
            )}
          </span>
        </div>
      )}

      {/* Grid de 3 Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tarjeta 1: Solicitante */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4.5 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
              1. Solicitante / Administrado
            </h3>
            <button
              type="button"
              onClick={() => navigateToStep(1)}
              className="text-[11px] font-semibold text-[#006EC7] hover:underline cursor-pointer"
            >
              Editar
            </button>
          </div>
          <p className="text-sm font-bold text-slate-900">
            {identificacion.tipoDocumento === 'RUC'
              ? identificacion.nombres
              : `${identificacion.nombres} ${identificacion.apellidos}`}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">{identificacion.tipoDocumento}:</span>{' '}
            <span className="font-mono">{identificacion.numeroDocumento || 'No consignado'}</span>
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Correo:</span> {identificacion.correo || 'No consignado'}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Teléfono:</span>{' '}
            <span className="font-mono">{identificacion.telefono || 'No consignado'}</span>
          </p>
          {identificacion.direccion && (
            <p className="text-xs text-slate-500">
              <span className="font-semibold">Dirección:</span> {identificacion.direccion}
            </p>
          )}
        </div>

        {/* Tarjeta 2: Trámite y Documentos */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4.5 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
              2. Procedimiento y Documentos
            </h3>
            <button
              type="button"
              onClick={() => navigateToStep(2)}
              className="text-[11px] font-semibold text-[#006EC7] hover:underline cursor-pointer"
            >
              Editar
            </button>
          </div>
          <p className="text-sm font-bold text-slate-900">
            {tipoSeleccionado
              ? `${tipoSeleccionado.codigo} — ${tipoSeleccionado.denominacion}`
              : 'Selección formal pendiente de revalidación'}
          </p>
          {estadoCatalogo === 'cargando' && <p role="status" className="text-xs text-slate-500">Verificando el catálogo formal vigente…</p>}
          {estadoCatalogo === 'disponible' && tipoSeleccionado && <p role="status" className="text-xs text-slate-500">El tipo coincide con un UUID marcado vigente por el catálogo backend.</p>}
          {estadoCatalogo === 'disponible' && !tipoSeleccionado && <p role="alert" className="text-xs text-red-700">El procedimiento guardado no está en el catálogo vigente. Vuelva al paso 2 para revisar la selección.</p>}
          {estadoCatalogo === 'error' && <p role="alert" className="text-xs text-red-700">No fue posible verificar el catálogo formal. No se puede radicar hasta reintentar la verificación.</p>}
          {estadoCatalogo === 'error' && <button type="button" className="text-xs font-bold underline" onClick={() => setIntentoCatalogo(valor => valor + 1)} disabled={isSubmitting}>Reintentar verificación</button>}
          {tipoSeleccionado && (
            <div className="space-y-1 text-xs text-slate-600">
              {tipoSeleccionado.descripcion && <p>{tipoSeleccionado.descripcion}</p>}
              <p>La API disponible no informa los requisitos documentales ni su obligatoriedad para este procedimiento. La descripción no constituye una lista de adjuntos exigibles.</p>
            </div>
          )}
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Folios:</span>{' '}
            <span className="font-mono">{documentos.numeroFolios}</span>
          </p>
          <p className="text-xs text-slate-600 italic bg-white p-2.5 rounded border border-slate-200 line-clamp-2">
            &ldquo;{documentos.asunto || 'Sin asunto especificado'}&rdquo;
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Archivos adjuntos:</span>{' '}
            {documentos.archivos.length} archivo(s) PDF verificado(s)
          </p>
        </div>

        {/* Tarjeta 3: Conformidad Legal */}
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4.5 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
              3. Conformidad Legal (Ley N° 27444)
            </h3>
            <button
              type="button"
              onClick={() => navigateToStep(3)}
              className="text-[11px] font-semibold text-[#006EC7] hover:underline cursor-pointer"
            >
              Editar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${declaracionJurada.declaracionVeracidad ? 'text-emerald-600 font-bold' : 'text-red-500'}`}>
                {declaracionJurada.declaracionVeracidad ? '✓' : '✗'}
              </span>
              <span>Veracidad Jurada (Art. 51 LPAG)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${declaracionJurada.aceptaTerminos ? 'text-emerald-600 font-bold' : 'text-red-500'}`}>
                {declaracionJurada.aceptaTerminos ? '✓' : '✗'}
              </span>
              <span>Términos y Condiciones MPV</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${declaracionJurada.autorizaNotificacionCasilla ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                {declaracionJurada.autorizaNotificacionCasilla ? '✓' : '○'}
              </span>
              <span>Notificación Casilla Electrónica</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta de Radicación */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
        <h3 className="text-base font-bold text-emerald-950">
          ¿Desea radicar formalmente su expediente?
        </h3>
        <p className="mt-1 text-xs text-emerald-800 max-w-lg mx-auto">
          Al confirmar la radicación, se emitirá su Código Único de Trámite (CUT) oficial con sello de tiempo institucional inmutable.
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleRadicar}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Radicando Trámite...</span>
              </>
            ) : (
              <span>Radicar Trámite</span>
            )}
          </button>
        </div>
      </div>

      {/* BOTONERA INFERIOR */}
      <footer className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
        >
          ← Anterior
        </button>
      </footer>
    </div>
  );
};

export default StepConfirmacion;
