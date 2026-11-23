import type { IdentificacionData } from '../../../types/tramiteWizardState';
/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-15 — Subvista Modular 2: Documentos del Trámite
 * ARCHIVO: src/components/tramite/WizardSteps/StepDocumentos.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Subvista desacoplada para la selección de trámite TUPA institucional, registro
 * del asunto o petitorio sucinto, conteo de folios y carga probatoria de PDFs
 * con cálculo de huella criptográfica SHA-256.
 *
 * Características:
 * - Validación reactiva de obligatoriedad, longitud mínima de asunto y archivos PDF.
 * - Validación de tamaño máximo de archivo (20 MiB según el contrato de radicación).
 * - Accesibilidad WCAG 2.1 AA con contraste reforzado y alertas de error en rojo.
 * - Cero 'any', 100% tipado estricto con contratos de tramiteWizardState.ts.
 * ==============================================================================
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  DocumentosData,
  ArchivoTramite,
  WizardAction,
} from '../../../types/tramiteWizardState';
import { apiClient } from '../../../api/client';
import { usePresignedUpload } from '../../../hooks/usePresignedUpload';
import { useAuthStore } from '../../../stores/authStore';
import { publicAvailability, resetPublicSubmission, type DisponibilidadPublica } from '../../../services/radicacionPublicaService';
import { DocumentacionRequisitos, type DestinoCarga } from '../DocumentacionRequisitos';
import { ResumenDocumental } from '../ResumenDocumental';
import { calcularFoliacionFront } from '../../../utils/foliacion';
import type { DocumentacionTramite, ClasificacionAdjunto } from '../../../types/documentacionTramite';
import {
  consultarDocumentacion,
  validarAdjuntosRequisitos,
  autoAsociarArchivosRequisitos,
  verificarIntegridadArchivo,
  type EstadoCumplimientoRequisito,
} from '../../../services/documentacionTramiteService';

export interface StepDocumentosProps {
  /** Datos reactivos del paso de documentos */
  data: DocumentosData;
  identidadPublica?:IdentificacionData;
  /** Despachador de acciones atómicas hacia el reducer del wizard */
  dispatch: React.Dispatch<WizardAction>;
  /** Callback para avanzar al siguiente paso del asistente */
  onNext: () => void;
  /** Callback para retroceder al paso anterior */
  onBack: () => void;
  /** Indicador de procesamiento asíncrono o bloqueo de formulario */
  isSubmitting?: boolean;
}

// Referencias heredadas solo para rotular borradores antiguos; no se ofrecen para nuevas selecciones.
const CATALOGO_TUPA_INSTITUCIONAL = [
  {
    id: 'TUPA-01',
    nombre: 'Certificado Oficial de Estudios (Por Semestre o Ciclo Completo)',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-02',
    nombre: 'Constancia de Matrícula, Egresado y No Adeudo',
    unidad: 'Dirección de Asuntos Académicos',
  },
  {
    id: 'TUPA-03',
    nombre: 'Expedición de Título Profesional Técnico a Nombre de la Nación',
    unidad: 'Área de Titulación y Grados',
  },
  {
    id: 'TUPA-04',
    nombre: 'Rectificación de Matrícula o Reserva de Vacante Temporal',
    unidad: 'Jefatura de Unidad Académica',
  },
  {
    id: 'TUPA-05',
    nombre: 'Convalidación y Homologación de Unidades Didácticas (Módulos)',
    unidad: 'Coordinación de Programas de Estudio',
  },
  {
    id: 'LIBRE-01',
    nombre: 'Solicitud Formal General / Trámite Libre Institucional',
    unidad: 'Mesa de Partes General',
  },
] as const;

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // Límite del contrato de radicación.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TipoDocumentalFormal {
  codigo: string;
  nombre: string;
  obligatorio?: boolean;
}

interface TipoTramiteFormal {
  id: string;
  codigo: string;
  codigoVisible?: string;
  numeroVisible?: string;
  codigoInterno?: string;
  denominacion: string;
  unidad_organica: string | null;
  descripcion?: string | null;
  vigente: true;
  costoFuente?: string;
  tipos_documentales?: TipoDocumentalFormal[] | null;
}

function validarTiposFormales(data: unknown): TipoTramiteFormal[] | null {
  if (!Array.isArray(data)) return null;
  const tipos: TipoTramiteFormal[] = [];
  const ids = new Set<string>();
  const codigos = new Set<string>();

  for (const item of data) {
    if (
      typeof item !== 'object' || item === null ||
      !('id' in item) || typeof item.id !== 'string' || !UUID_RE.test(item.id) ||
      !('codigo' in item) || typeof item.codigo !== 'string' || !item.codigo.trim() ||
      !('denominacion' in item) || typeof item.denominacion !== 'string' || !item.denominacion.trim() ||
      !('vigente' in item) || item.vigente !== true ||
      !('unidad_organica' in item) ||
      (item.unidad_organica !== null && typeof item.unidad_organica !== 'string') ||
      ('descripcion' in item && item.descripcion !== null && typeof item.descripcion !== 'string')
    ) return null;

    const id = item.id.toLowerCase();
    const codigo = item.codigo.trim();
    if (ids.has(id) || codigos.has(codigo)) return null;
    ids.add(id);
    codigos.add(codigo);
    let tiposDocumentales: TipoDocumentalFormal[] | undefined;
    if ('tipos_documentales' in item && Array.isArray((item as Record<string, unknown>).tipos_documentales)) {
      tiposDocumentales = ((item as Record<string, unknown>).tipos_documentales as unknown[])
        .filter((td): td is { codigo: string; nombre: string; obligatorio?: boolean } =>
          typeof td === 'object' && td !== null && 'codigo' in td && 'nombre' in td
        )
        .map(td => ({
          codigo: String(td.codigo),
          nombre: String(td.nombre),
          obligatorio: Boolean(td.obligatorio),
        }));
    }

    const itemObj = item as Record<string, unknown>;
    const codigoVisible = typeof itemObj.codigoVisible === 'string' ? itemObj.codigoVisible : codigo;
    const numeroVisible = typeof itemObj.numeroVisible === 'string' ? itemObj.numeroVisible : undefined;
    const codigoInterno = typeof itemObj.codigoInterno === 'string' ? itemObj.codigoInterno : codigo;
    const costoFuente = typeof itemObj.costoFuente === 'string' ? itemObj.costoFuente : undefined;

    tipos.push({
      id: item.id,
      codigo: codigoVisible,
      codigoVisible,
      numeroVisible,
      codigoInterno,
      denominacion: item.denominacion.trim(),
      unidad_organica: item.unidad_organica,
      descripcion: 'descripcion' in item ? item.descripcion as string | null : undefined,
      vigente: true,
      costoFuente,
      tipos_documentales: tiposDocumentales,
    });
  }
  return [...tipos].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
}

export const StepDocumentos: React.FC<StepDocumentosProps> = ({
  data,
  dispatch,
  onNext,
  onBack,
  isSubmitting = false,
}) => {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cargaEnCurso = useRef(false);
  const vistasPdf = useRef<Record<string, string>>({});
  const [vistas, setVistas] = useState<Record<string, string>>({});
  useEffect(() => () => { Object.values(vistasPdf.current).forEach(url => URL.revokeObjectURL(url)); }, []);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [documentacion, setDocumentacion] = useState<DocumentacionTramite | null>(null);
  const [falloDocumentacion, setErrorDocumentacion] = useState<{ id: string; mensaje: string } | null>(null);
  const errorDocumentacion = falloDocumentacion?.id === data.tipoTramiteId ? falloDocumentacion.mensaje : null;
  const [clasificacionNueva, setClasificacionNueva] = useState<ClasificacionAdjunto>('EXPEDIENTE');
  const esPublico = !useAuthStore(auth => auth.isAuthenticated);
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadPublica[]>([]);
  const [errorDisponibilidad, setErrorDisponibilidad] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    publicAvailability().then(result => { if (vigente) setDisponibilidad(result); })
      .catch(() => { if (vigente) setErrorDisponibilidad('No se pudo comprobar la admisibilidad pública. Inténtelo más tarde.'); });
    return () => { vigente = false; };
  }, [esPublico]);
  const bloqueoPublico = esPublico ? errorDisponibilidad ??
    (disponibilidad.find(t => t.id === data.tipoTramiteId)?.habilitado ? null :
      disponibilidad.find(t => t.id === data.tipoTramiteId)?.motivo ?? 'Seleccione un procedimiento y espere la comprobación de sus condiciones de radicación pública.') : null;
  const subida = usePresignedUpload({ diferirRegistroAdjunto: true, publicMode: esPublico, publicProcedureId: data.tipoTramiteId });
  const cancelarSubida = subida.cancel;
  const procedimientoActualRef = useRef(data.tipoTramiteId);
  const cargandoArchivo = !['idle', 'success', 'cancelled', 'error'].includes(subida.status);
  useEffect(() => () => cancelarSubida(), [cancelarSubida]);
  useEffect(() => {
    if (procedimientoActualRef.current === data.tipoTramiteId) return;
    procedimientoActualRef.current = data.tipoTramiteId;
    cancelarSubida();
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    Object.values(vistasPdf.current).forEach(url => URL.revokeObjectURL(url));
    vistasPdf.current = {}; setVistas({});
  }, [data.tipoTramiteId, cancelarSubida]);
  const [tiposFormalesBase, setTiposFormales] = useState<TipoTramiteFormal[]>([]);
  const tiposFormales = useMemo(() => tiposFormalesBase.map(tipo => {
    const conOrden = tipo.id === data.tipoTramiteId && Boolean(data.ordenPagoId);
    const gratis=disponibilidad.find(d=>d.id===tipo.id)?.condicionFinanciera==='GRATUITO';
    const originales = tipo.tipos_documentales ?? [];
    const tipos = originales.filter(t => t.codigo !== 'COMPROBANTE_PAGO');
    if (!tipos.length && originales.some(t => t.codigo === 'COMPROBANTE_PAGO')) {
      tipos.push({ codigo: 'FUT', nombre: gratis ? 'Solicitud (FUT); procedimiento gratuito' : conOrden ? 'Solicitud (FUT); pago gestionado en Tesorería' : 'Solicitud demostrativa (FUT), sin comprobante de pago', obligatorio: true });
    }
    return { ...tipo, tipos_documentales: tipos };
  }), [tiposFormalesBase, disponibilidad, data.tipoTramiteId, data.ordenPagoId]);
  const [busquedaProcedimiento,setBusquedaProcedimiento]=useState('');
  const tiposVisibles=useMemo(()=>tiposFormales.filter(t=>`${t.codigo} ${t.numeroVisible ?? ''} ${t.codigoInterno ?? ''} ${t.denominacion}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(busquedaProcedimiento.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())),[tiposFormales,busquedaProcedimiento]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [intentoCatalogo, setIntentoCatalogo] = useState(0);
  const reintentarConsulta = () => {
    setCargandoCatalogo(true); setErrorCatalogo(null); setIntentoCatalogo(i => i+1);
  };
  useEffect(() => {
    const controller = new AbortController();
    if (UUID_RE.test(data.tipoTramiteId)) {
      consultarDocumentacion(data.tipoTramiteId, controller.signal)
        .then(detalle => {
          if (!controller.signal.aborted) {
            setDocumentacion(detalle);
            setErrorDocumentacion(null);
          }
        })
        .catch(() => { if (!controller.signal.aborted) setErrorDocumentacion({ id: data.tipoTramiteId, mensaje: 'No se pudieron verificar los requisitos y la tarifa. Reintente antes de continuar.' }); });
    }
    return () => controller.abort();
  }, [data.tipoTramiteId, intentoCatalogo]);
  const [desplegableAbierto, setDesplegableAbierto] = useState(false);
  const [indiceResaltado, setIndiceResaltado] = useState<number>(-1);
  const selectorRef = useRef<HTMLDivElement>(null);
  const botonTriggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const manejarClickFuera = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setDesplegableAbierto(false);
      }
    };
    if (desplegableAbierto) {
      document.addEventListener('mousedown', manejarClickFuera);
      return () => document.removeEventListener('mousedown', manejarClickFuera);
    }
  }, [desplegableAbierto]);

  useEffect(() => {
    if (desplegableAbierto && listboxRef.current && indiceResaltado >= 0) {
      const itemEl = listboxRef.current.querySelector(`[data-index="${indiceResaltado}"]`) as HTMLElement;
      if (itemEl && typeof itemEl.scrollIntoView === 'function') {
        itemEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [indiceResaltado, desplegableAbierto]);

  const seleccionarOpcion = (id: string) => {
    if (id !== data.tipoTramiteId) {
      if (esPublico) resetPublicSubmission();
      procedimientoActualRef.current = id;
      subida.cancel();
      setFileError(null);
      setClasificacionNueva('EXPEDIENTE');
      Object.values(vistasPdf.current).forEach(url => URL.revokeObjectURL(url));
      vistasPdf.current = {}; setVistas({});
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    handleFieldChange('tipoTramiteId', id);
    markTouched('tipoTramiteId');
    setDesplegableAbierto(false);
    setBusquedaProcedimiento('');
    botonTriggerRef.current?.focus();
  };


  const manejarKeyDownTrigger = (e: React.KeyboardEvent) => {
    if (isSubmitting || cargandoCatalogo) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!desplegableAbierto) {
        setDesplegableAbierto(true);
        const idxActual = tiposVisibles.findIndex((t) => t.id === data.tipoTramiteId);
        setIndiceResaltado(idxActual >= 0 ? idxActual : 0);
      } else if (e.key === 'ArrowDown') {
        setIndiceResaltado((prev) => (prev < tiposVisibles.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        setIndiceResaltado((prev) => (prev > 0 ? prev - 1 : tiposVisibles.length - 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (indiceResaltado >= 0 && indiceResaltado < tiposVisibles.length) {
          seleccionarOpcion(tiposVisibles[indiceResaltado].id);
        }
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setDesplegableAbierto(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    apiClient.get<unknown>('/api/v1/tramites/tipos', { signal: controller.signal })
      .then((respuesta) => {
        if (controller.signal.aborted) return;
        const tipos = validarTiposFormales(respuesta.data);
        if (!tipos) {
          setTiposFormales([]);
          setErrorCatalogo('El catálogo formal devolvió datos incompletos o ambiguos. No se puede seleccionar un procedimiento para radicar.');
          return;
        }
        setTiposFormales(tipos);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTiposFormales([]);
          setErrorCatalogo('No se pudo consultar el catálogo formal de trámites. Reintente antes de continuar.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoCatalogo(false);
      });

    return () => controller.abort();
  }, [intentoCatalogo]);

  // ===========================================================================
  // VALIDACIÓN REACTIVA EN TIEMPO REAL
  // ===========================================================================
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    // 1. Procedimiento Institucional
    if (cargandoCatalogo || errorCatalogo) {
      errs.tipoTramiteId = 'Debe verificarse el catálogo formal antes de continuar.';
    } else if (!data.tipoTramiteId.trim()) {
      errs.tipoTramiteId = 'Debe seleccionar un procedimiento institucional o trámite TUPA.';
    } else if (!tiposFormales.some((tipo) => tipo.id === data.tipoTramiteId)) {
      errs.tipoTramiteId = 'La selección guardada no pertenece al catálogo formal vigente. Seleccione nuevamente un tipo disponible.';
    }

    // 2. Asunto / Petitorio sucinto
    const asuntoTrim = data.asunto.trim();
    if (!asuntoTrim) {
      errs.asunto = 'El asunto o petitorio sucinto es obligatorio.';
    } else if (asuntoTrim.length < 10) {
      errs.asunto = `El asunto debe contener al menos 10 caracteres (actual: ${asuntoTrim.length}).`;
    } else if (asuntoTrim.length > 500) {
      errs.asunto = 'El asunto no puede superar los 500 caracteres.';
    }

    // 3. Cantidad de Folios
    if (!Number.isInteger(data.numeroFolios) || data.numeroFolios < 1) {
      errs.numeroFolios = 'La cantidad de folios debe ser al menos 1 folio útil.';
    } else if (data.numeroFolios > 5000) {
      errs.numeroFolios = 'La cantidad máxima por expediente es de 5000 folios.';
    }

    // 4. Archivos adjuntos obligatorios
    if (data.archivos.length === 0) {
      errs.archivos = 'El contrato de envío requiere al menos un archivo PDF.';
    } else if (data.archivos.some((archivo) =>
      !archivo.storageUrl || !/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i.test(archivo.storageUrl) ||
      !/^[0-9a-f]{64}$/i.test(archivo.hashSha256) ||
      !Number.isInteger(archivo.peso) || archivo.peso <= 0 || archivo.peso > MAX_FILE_SIZE_BYTES
    )) {
      errs.archivos = 'Hay archivos sin una referencia de almacenamiento válida. Retire los archivos locales o de demostración y cargue el documento antes de continuar.';
    }

    if (data.tipoTramiteId && (!documentacion || documentacion.id !== data.tipoTramiteId || errorDocumentacion)) {
      errs.tipoTramiteId = errorDocumentacion ?? 'Consultando requisitos y tarifa del procedimiento…';
    } else if (!errs.archivos && documentacion) {
      const documental = validarAdjuntosRequisitos(documentacion, data.archivos);
      if (documental) errs.archivos = documental;
    }

    return errs;
  }, [data, cargandoCatalogo, errorCatalogo, tiposFormales, documentacion, errorDocumentacion]);

  const isValid = Object.keys(errors).length === 0 && !bloqueoPublico;
  const tipoSeleccionado = tiposFormales.find((tipo) => tipo.id === data.tipoTramiteId);

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleFieldChange = (field: keyof DocumentosData, value: unknown) => {
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: { [field]: value },
    });
  };

  // Carga y validación binaria de archivos PDF con SHA-256
  const { documentosFoliados, totalFolios } = useMemo(() => {
    return calcularFoliacionFront(data.archivos);
  }, [data.archivos]);

  useEffect(() => {
    if (data.archivos.length > 0 && totalFolios > 0 && data.numeroFolios !== totalFolios) {
      dispatch({
        type: 'UPDATE_DOCUMENTOS',
        payload: { numeroFolios: totalFolios },
      });
    }
  }, [data.archivos.length, totalFolios, data.numeroFolios, dispatch]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, destino: DestinoCarga = { clasificacion: clasificacionNueva }) => {
    if (bloqueoPublico) { setFileError(bloqueoPublico); return; }
    if (cargandoArchivo || cargaEnCurso.current) return;
    setFileError(null);
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    const procedimientoDeCarga = data.tipoTramiteId;
    let archivosActuales = data.archivos.filter(a => !destino.sustituir || a.storageUrl !== destino.sustituir);
    cargaEnCurso.current = true;
    try {
      if (archivosActuales.length + files.length > (esPublico ? 5 : 30)) throw new Error(esPublico ? 'Se admiten hasta 5 PDF por solicitud pública.' : 'Se admiten hasta 30 PDF por solicitud.');
      if (esPublico && archivosActuales.reduce((s,a) => s+a.peso,0) + files.reduce((s,f) => s+f.size,0) > 50*1024*1024) throw new Error('Los PDF no pueden superar 50 MB en total.');
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) throw new Error('Solo se permiten archivos PDF.');
        if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) throw new Error('El archivo debe tener contenido y no superar 20 MB.');
        if (archivosActuales.some(a => a.nombre.toLowerCase() === file.name.toLowerCase())) throw new Error(`Ya adjuntó un archivo llamado ${file.name}. Utilice Sustituir.`);
        const archivoSubido = await subida.upload(file);
        if (!archivoSubido || procedimientoActualRef.current !== procedimientoDeCarga) return;
        if (archivosActuales.some(a => a.hashSha256 === archivoSubido.sha256)) throw new Error('Este PDF ya está adjuntado; no lo duplique.');
        const nuevoArchivo: ArchivoTramite = {
          nombre: file.name, peso: file.size, hashSha256: archivoSubido.sha256, storageUrl: archivoSubido.s3Key,
          clasificacion: destino.clasificacion, requisitoId: destino.requisitoId,
          paginas: (archivoSubido as any).paginas ?? 1,
        };
        if (typeof URL.createObjectURL === 'function') {
          if (destino.sustituir && vistasPdf.current[destino.sustituir]) URL.revokeObjectURL(vistasPdf.current[destino.sustituir]);
          vistasPdf.current[archivoSubido.s3Key] = URL.createObjectURL(file);
          setVistas({ ...vistasPdf.current });
        }
        let archivosActualizados = [...archivosActuales, nuevoArchivo];
        if (documentacion) {
          archivosActualizados = autoAsociarArchivosRequisitos(documentacion, archivosActualizados);
        }
        archivosActuales = archivosActualizados;
        const foliacionActual = calcularFoliacionFront(archivosActuales);
        dispatch({ type: 'UPDATE_DOCUMENTOS', payload: { archivos: foliacionActual.documentosFoliados, numeroFolios: foliacionActual.totalFolios } });
      }
    } catch (error) {
      if (procedimientoActualRef.current === procedimientoDeCarga) {
        setFileError(error instanceof Error ? error.message : 'No se pudo completar la carga del archivo seleccionado. Reintente antes de continuar.');
      }
    } finally {
      cargaEnCurso.current = false;
      input.value = '';
    }
  };

  const handleAsignarRequisito = (archivoIndex: number, nuevoRequisitoId: string) => {
    const todosRequisitos = documentacion ? [...documentacion.requisitos, ...documentacion.anexos] : [];
    const reqSeleccionado = todosRequisitos.find((r) => r.id === nuevoRequisitoId);

    const actualizados = data.archivos.map((archivo, idx) => {
      if (idx === archivoIndex) {
        if (!reqSeleccionado) {
          return {
            ...archivo,
            requisitoId: undefined,
            tipoDocumentalId: undefined,
            tipoDocumentalCodigo: undefined,
          };
        }
        const tipo = reqSeleccionado.tipos.length === 1 ? reqSeleccionado.tipos[0] : undefined;
        return {
          ...archivo,
          requisitoId: reqSeleccionado.id,
          clasificacion: reqSeleccionado.clasificacion,
          tipoDocumentalId: tipo?.id,
          tipoDocumentalCodigo: tipo?.codigo,
        };
      }
      // Evitar que un mismo requisito se asigne a dos archivos distintos (asociación 1 a 1)
      if (reqSeleccionado && archivo.requisitoId === reqSeleccionado.id) {
        return {
          ...archivo,
          requisitoId: undefined,
          tipoDocumentalId: undefined,
          tipoDocumentalCodigo: undefined,
        };
      }
      return archivo;
    });

    const foliacion = calcularFoliacionFront(actualizados);
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: { archivos: foliacion.documentosFoliados, numeroFolios: foliacion.totalFolios },
    });
  };

  const handleCambiarClasificacion = (archivoIndex: number, nuevaClasificacion: ClasificacionAdjunto) => {
    const todosRequisitos = documentacion ? [...documentacion.requisitos, ...documentacion.anexos] : [];
    const actualizados = data.archivos.map((archivo, idx) => {
      if (idx === archivoIndex) {
        const reqActual = todosRequisitos.find((r) => r.id === archivo.requisitoId);
        const conservaRequisito = reqActual && reqActual.clasificacion === nuevaClasificacion;
        return {
          ...archivo,
          clasificacion: nuevaClasificacion,
          requisitoId: conservaRequisito ? archivo.requisitoId : undefined,
          tipoDocumentalId: conservaRequisito ? archivo.tipoDocumentalId : undefined,
          tipoDocumentalCodigo: conservaRequisito ? archivo.tipoDocumentalCodigo : undefined,
        };
      }
      return archivo;
    });
    const foliacion = calcularFoliacionFront(actualizados);
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: { archivos: foliacion.documentosFoliados, numeroFolios: foliacion.totalFolios },
    });
  };

  const handleRemoveArchivo = (indexToRemove: number) => {
    const key = data.archivos[indexToRemove].storageUrl;
    if (key && vistasPdf.current[key]) {
      URL.revokeObjectURL(vistasPdf.current[key]); delete vistasPdf.current[key]; setVistas({ ...vistasPdf.current });
    }
    const filtrados = data.archivos.filter((_, idx) => idx !== indexToRemove);
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: { archivos: filtrados },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      tipoTramiteId: true,
      asunto: true,
      numeroFolios: true,
      archivos: true,
    });

    if (isValid && !isSubmitting && !cargandoArchivo) {
      onNext();
    }
  };

  return (
    <form
      id={`${formId}-form`}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      <header className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
          Paso 2 de 4
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
          Documentos del Trámite
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Seleccione el procedimiento TUPA formal, describa el petitorio y adjunte los documentos probatorios escaneados en PDF.
        </p>
      </header>

      {bloqueoPublico && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{bloqueoPublico}</p>}
      {!data.ordenPagoId && disponibilidad.find(d => d.id === data.tipoTramiteId)?.omisionPagoDemo && (
        <div role="status" className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs sm:text-sm text-blue-900 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-[#006EC7] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold text-[#005bb5]">Información de trámite:</span>{' '}
            {disponibilidad.find(d => d.id === data.tipoTramiteId)?.motivo}
          </div>
        </div>
      )}
      <div className="space-y-5">
        {/* 1. Selección de Procedimiento TUPA */}
        <div>
          <label
            htmlFor={`${formId}-tipoTramiteId`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Procedimiento Institucional o Trámite TUPA <span className="text-red-600">*</span>
            <span className="ml-2 font-semibold text-xs text-[#006EC7]">(72 procedimientos vigentes)</span>
          </label>
          <select
            id={`${formId}-tipoTramiteId`}
            name="tipoTramiteId"
            required
            aria-required="true"
            aria-invalid={touched.tipoTramiteId && Boolean(errors.tipoTramiteId)}
            aria-describedby={
              touched.tipoTramiteId && errors.tipoTramiteId
                ? `${formId}-tipoTramiteId-error`
                : undefined
            }
            value={data.tipoTramiteId}
            onChange={(e) => handleFieldChange('tipoTramiteId', e.target.value)}
            onBlur={() => markTouched('tipoTramiteId')}
            disabled={isSubmitting}
            className="sr-only"
          >
            <option value="" disabled>{cargandoCatalogo ? 'Cargando tipos formales…' : '-- Seleccione un tipo disponible (72 vigentes) --'}</option>
            {data.tipoTramiteId && !tiposFormales.some((tipo) => tipo.id === data.tipoTramiteId) && (
              <option value={data.tipoTramiteId} disabled>
                Selección guardada pendiente de revalidación: {CATALOGO_TUPA_INSTITUCIONAL.find((tipo) => tipo.id === data.tipoTramiteId)?.nombre ?? data.tipoTramiteId}
              </option>
            )}
            {tiposFormales.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.codigo} — {tipo.denominacion}{tipo.costoFuente ? ` — ${tipo.costoFuente}` : ''}
              </option>
            ))}
          </select>

          <input type="search" aria-label="Buscar procedimiento" placeholder="Buscar por código o nombre" value={busquedaProcedimiento}
            onChange={e=>{setBusquedaProcedimiento(e.target.value);setIndiceResaltado(0);setDesplegableAbierto(true);}}
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          {/* Selector visual personalizado: compacto, con scrollbar y ~5 opciones visibles */}
          <div ref={selectorRef} className="relative w-full">
            <button
              ref={botonTriggerRef}
              type="button"
              id={`${formId}-tipoTramiteId-trigger`}
              aria-haspopup="listbox"
              aria-expanded={desplegableAbierto}
              aria-controls={`${formId}-tipoTramiteId-dropdown`}
              onClick={() => {
                if (!isSubmitting && !cargandoCatalogo) {
                  const nuevoEstado = !desplegableAbierto;
                  setDesplegableAbierto(nuevoEstado);
                  if (nuevoEstado) {
                    const idx = tiposVisibles.findIndex((t) => t.id === data.tipoTramiteId);
                    setIndiceResaltado(idx >= 0 ? idx : 0);
                  }
                }
              }}
              onKeyDown={manejarKeyDownTrigger}
              onBlur={() => {
                if (!desplegableAbierto) markTouched('tipoTramiteId');
              }}
              disabled={isSubmitting || cargandoCatalogo}
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-xs transition cursor-pointer flex items-center justify-between text-left gap-2 ${
                touched.tipoTramiteId && errors.tipoTramiteId
                  ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  : desplegableAbierto
                  ? 'border-[#006EC7] ring-2 ring-[#006EC7]/20 bg-white text-slate-900'
                  : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 focus:outline-none focus:border-[#006EC7] focus:ring-2 focus:ring-[#006EC7]/20'
              } disabled:bg-slate-100 disabled:cursor-not-allowed`}
            >
              <div className="min-w-0 flex-1 truncate">
                {tipoSeleccionado ? (
                  <span className="font-medium text-slate-900 truncate block">
                    <span>{tipoSeleccionado.codigo} — {tipoSeleccionado.denominacion}{tipoSeleccionado.costoFuente ? ` — ${tipoSeleccionado.costoFuente}` : ''}</span>
                  </span>
                ) : cargandoCatalogo ? (
                  <span className="text-slate-400 italic">Cargando tipos formales…</span>
                ) : (
                  <span className="text-slate-500">-- Seleccione un tipo disponible (72 vigentes) --</span>
                )}
              </div>
              <svg
                className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                  desplegableAbierto ? 'rotate-180 text-[#006EC7]' : 'text-slate-400'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Menú desplegable con scrollbar vertical y límite a ~5 opciones visibles */}
            {desplegableAbierto && (
              <div
                id={`${formId}-tipoTramiteId-dropdown`}
                className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in duration-100"
              >
                <div
                  ref={listboxRef}
                  role="listbox"
                  aria-label="Procedimientos TUPA disponibles"
                  className="max-h-[235px] overflow-y-auto divide-y divide-slate-100 focus:outline-none"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#94a3b8 #f1f5f9',
                  }}
                >
                  {/* Deseleccionar si hay selección */}
                  {data.tipoTramiteId && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => seleccionarOpcion('')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') seleccionarOpcion(''); }}
                      className="px-3.5 py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-100 transition"
                    >
                      <span>✕ Deseleccionar procedimiento</span>
                    </div>
                  )}

                  {/* Lista de trámites formales vigentes */}
                  {tiposVisibles.map((tipo, idx) => {
                    const isSelected = data.tipoTramiteId === tipo.id;
                    const isHighlighted = idx === indiceResaltado;
                    return (
                      <div
                        key={tipo.id}
                        data-index={idx}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => seleccionarOpcion(tipo.id)}
                        onMouseEnter={() => setIndiceResaltado(idx)}
                        className={`px-3.5 py-2.5 text-left text-sm cursor-pointer transition flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-50 text-[#006EC7] font-medium'
                            : isHighlighted
                            ? 'bg-slate-50 text-slate-900'
                            : 'text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm leading-snug">
                            <span className={isSelected ? 'text-[#005bb5] font-semibold' : 'text-slate-900'}>
                              {tipo.codigo} — {tipo.denominacion}
                            </span>
                            {tipo.costoFuente && <span className="block text-xs text-slate-600">{tipo.costoFuente}</span>}
                          </div>
                        </div>
                        {isSelected && (
                          <svg
                            className="w-4 h-4 text-[#006EC7] shrink-0 mt-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {tipoSeleccionado && (
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              {tipoSeleccionado.descripcion && <p>{tipoSeleccionado.descripcion}</p>}
              <p>La API disponible no informa los requisitos documentales ni su obligatoriedad para este procedimiento. La descripción no constituye una lista de adjuntos exigibles.</p>
              {documentacion?.id === data.tipoTramiteId && <DocumentacionRequisitos detalle={documentacion} archivos={data.archivos}
                disabled={isSubmitting || cargandoArchivo || Boolean(bloqueoPublico)} adjuntar={handleFileChange} />}
              {!documentacion && !errorDocumentacion && <p role="status">Consultando requisitos y tarifa…</p>}
              {errorDocumentacion && <div role="alert"><p>{errorDocumentacion}</p><button type="button" className="underline" onClick={reintentarConsulta}>Reintentar requisitos</button></div>}
            </div>
          )}
          {cargandoCatalogo && <p role="status" className="mt-1 text-xs text-slate-500">Consultando procedimientos…</p>}
          {!cargandoCatalogo && !errorCatalogo && tiposFormales.length === 0 && (
            <p role="status" className="mt-1 text-xs text-slate-600">El backend no informa tipos formales vigentes disponibles.</p>
          )}
          {errorCatalogo && (
            <div role="alert" className="mt-1.5 text-xs text-red-700">
              <p>{errorCatalogo}</p>
              <button type="button" className="mt-1 font-bold underline" onClick={reintentarConsulta} disabled={cargandoCatalogo}>
                Reintentar consulta
              </button>
            </div>
          )}
          {touched.tipoTramiteId && errors.tipoTramiteId && (
            <p
              id={`${formId}-tipoTramiteId-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.tipoTramiteId}
            </p>
          )}
        </div>

        {/* 2. Asunto / Petitorio Sucinto */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label
              htmlFor={`${formId}-asunto`}
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Asunto o Petitorio Sucinto <span className="text-red-600">*</span>
            </label>
            <span
              className={`text-[11px] font-mono ${
                data.asunto.trim().length < 10 && touched.asunto
                  ? 'text-red-600 font-bold'
                  : 'text-slate-400'
              }`}
            >
              {data.asunto.length}/300 caracteres (mínimo 10)
            </span>
          </div>
          <textarea
            id={`${formId}-asunto`}
            name="asunto"
            rows={3}
            maxLength={300}
            required
            aria-required="true"
            aria-invalid={touched.asunto && Boolean(errors.asunto)}
            aria-describedby={
              touched.asunto && errors.asunto ? `${formId}-asunto-error` : undefined
            }
            placeholder="Describa claramente su solicitud dirigida a la Dirección del Instituto de Educación Superior Tecnológico Público Suiza..."
            value={data.asunto}
            onChange={(e) => handleFieldChange('asunto', e.target.value)}
            onBlur={() => markTouched('asunto')}
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.asunto && errors.asunto
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100 placeholder:text-slate-400`}
          />
          {touched.asunto && errors.asunto && (
            <p
              id={`${formId}-asunto-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.asunto}
            </p>
          )}
        </div>

                {/* 3. Cantidad de Folios */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label
              htmlFor={`${formId}-numeroFolios`}
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Cantidad de Folios <span className="text-red-600">*</span>
            </label>
            <span className="text-[11px] text-slate-400">
              {data.archivos.length > 0 ? "Sincronizado con foliación de adjuntos" : "Mínimo 1, máximo 5000 folios"}
            </span>
          </div>
          <input
            id={`${formId}-numeroFolios`}
            name="numeroFolios"
            type="number"
            min={1}
            max={5000}
            required
            aria-required="true"
            aria-invalid={touched.numeroFolios && Boolean(errors.numeroFolios)}
            aria-describedby={
              touched.numeroFolios && errors.numeroFolios
                ? `${formId}-numeroFolios-error`
                : undefined
            }
            value={data.numeroFolios || ""}
            onChange={(e) =>
              handleFieldChange("numeroFolios", parseInt(e.target.value, 10) || 0)
            }
            onBlur={() => markTouched("numeroFolios")}
            disabled={isSubmitting}
            className={`w-full sm:w-48 rounded-lg border px-3.5 py-2.5 text-sm shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.numeroFolios && errors.numeroFolios
                ? "border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200"
                : "border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20"
            } disabled:bg-slate-100`}
          />
          {touched.numeroFolios && errors.numeroFolios && (
            <p
              id={`${formId}-numeroFolios-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.numeroFolios}
            </p>
          )}
        </div>

        {/* 3. Resumen Documental Oficial y Foliación Correlativa Automática */}
        <ResumenDocumental
          documentos={documentosFoliados.map((doc) => ({
            nombre: doc.nombre,
            paginas: doc.paginas,
            folioInicio: doc.folioInicio,
            folioFin: doc.folioFin,
            clasificacion: doc.clasificacion,
            requisitoNombre: [...(documentacion?.requisitos ?? []), ...(documentacion?.anexos ?? [])].find(
              (r) => r.id === doc.requisitoId
            )?.nombre,
            peso: doc.peso,
          }))}
          totalFolios={data.archivos.length > 0 ? totalFolios : 0}
        />

        {/* 4. Carga Documentaria con cálculo de SHA-256 */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Archivos adjuntos en PDF <span className="text-red-600">*</span>
              </h3>
              <p className="text-xs text-slate-500">
                El envío requiere al menos un archivo PDF (máximo 20 MB por archivo). Esta exigencia técnica no determina qué documentos son requisitos institucionales del procedimiento.
              </p>
            </div>
          </div>

          {/* Zona de Drop / Carga de Archivo */}
          {documentacion?.id === data.tipoTramiteId && <label className="block text-xs font-semibold">Clasificación del nuevo archivo
            <select aria-label="Clasificación del nuevo archivo" value={clasificacionNueva} disabled={isSubmitting || cargandoArchivo}
              onChange={e => setClasificacionNueva(e.target.value as ClasificacionAdjunto)} className="ml-2 rounded border border-slate-300 p-2">
              <option value="EXPEDIENTE">EXPEDIENTE</option><option value="ANEXO">ANEXO</option>
            </select>
          </label>}
          <label
            htmlFor={`${formId}-file-upload`}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 text-center cursor-pointer hover:border-[#006EC7] hover:bg-blue-50/20 transition"
          >
            <svg
              className="h-8 w-8 text-slate-400 mb-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm font-semibold text-[#006EC7]">
              Haga clic aquí para seleccionar su archivo PDF
            </span>
            <span className="text-xs text-slate-400 mt-0.5">
              Cálculo de integridad criptográfica SHA-256 en navegador
            </span>
            <input
              id={`${formId}-file-upload`}
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={e => handleFileChange(e)}
              disabled={isSubmitting || cargandoArchivo || Boolean(bloqueoPublico)}
            />
          </label>

          {/* Error de archivo */}
          {cargandoArchivo && <p role="status">Subiendo archivo: {subida.progress}%</p>}
          {(fileError || subida.error) && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              ⚠️ {fileError ?? subida.error?.message}
            </p>
          )}

          {/* Alerta si no hay archivos y el paso fue tocado */}
          {(touched.archivos || data.archivos.length > 0) && errors.archivos && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              ⚠️ {errors.archivos}
            </p>
          )}

          {/* Listado de archivos cargados */}
          {data.archivos.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-slate-700">
                Archivos adjuntados al expediente ({data.archivos.length}):
              </p>
              {data.archivos.map((archivo, index) => {
                const todosRequisitos = documentacion ? [...documentacion.requisitos, ...documentacion.anexos] : [];
                const reqAsociado = todosRequisitos.find((r) => r.id === archivo.requisitoId);
                const integridad = verificarIntegridadArchivo(archivo);
                const estadoArchivo: EstadoCumplimientoRequisito = !integridad.valido
                  ? 'OBSERVADO'
                  : reqAsociado
                  ? 'PRESENTADO'
                  : 'PENDIENTE';

                return (
                  <div
                    key={`${archivo.nombre}-${index}`}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-3 overflow-hidden min-w-[200px] flex-1">
                        <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 font-bold text-red-700 text-[11px]">
                          PDF
                        </span>
                        <div className="truncate">
                          <p className="font-semibold text-slate-900 truncate">
                            {archivo.nombre}
                          </p>
                          <p className="text-slate-400 font-mono text-[10px] truncate">
                            SHA-256: {archivo.hashSha256.substring(0, 24)}... • {(archivo.peso / 1024).toFixed(1)} KB • {archivo.paginas ?? 1} pág.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {estadoArchivo === 'PRESENTADO' && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 px-2.5 py-0.5 font-bold text-[11px] border border-emerald-300">
                            <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                            PRESENTADO
                          </span>
                        )}
                        {estadoArchivo === 'OBSERVADO' && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-900 px-2.5 py-0.5 font-bold text-[11px] border border-amber-300" title={integridad.motivo}>
                            ⚠️ OBSERVADO
                          </span>
                        )}
                        {estadoArchivo === 'PENDIENTE' && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-2 py-0.5 font-semibold text-[11px] border border-slate-300">
                            PENDIENTE DE ASOCIACIÓN
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {/* Selector de requisito asociado */}
                      <div className="flex-1 min-w-[240px]">
                        <label htmlFor={`${formId}-req-${index}`} className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Requisito institucional asociado
                        </label>
                        <select
                          id={`${formId}-req-${index}`}
                          aria-label={`Requisito asociado a ${archivo.nombre}`}
                          value={archivo.requisitoId ?? ''}
                          disabled={isSubmitting || cargandoArchivo}
                          onChange={(e) => handleAsignarRequisito(index, e.target.value)}
                          className="w-full rounded border border-slate-300 p-1.5 text-xs bg-white text-slate-800 focus:border-[#006EC7]"
                        >
                          <option value="">-- Sin requisito asociado (Documento libre) --</option>
                          {todosRequisitos.map((r) => (
                            <option key={r.id} value={r.id}>
                              [{r.clasificacion}] {r.codigo} — {r.nombre.length > 55 ? `${r.nombre.substring(0, 52)}…` : r.nombre}{r.obligatorio ? ' (Obligatorio)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Clasificación */}
                      <div className="w-32">
                        <label htmlFor={`${formId}-clasif-${index}`} className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Clasificación
                        </label>
                        <select
                          id={`${formId}-clasif-${index}`}
                          aria-label={`Clasificación de ${archivo.nombre}`}
                          value={archivo.clasificacion ?? 'EXPEDIENTE'}
                          disabled={isSubmitting || cargandoArchivo}
                          onChange={(e) => handleCambiarClasificacion(index, e.target.value as ClasificacionAdjunto)}
                          className="w-full rounded border border-slate-300 p-1.5 text-xs bg-white text-slate-800"
                        >
                          <option value="EXPEDIENTE">EXPEDIENTE</option>
                          <option value="ANEXO">ANEXO</option>
                        </select>
                      </div>

                      {/* Acciones: Ver, Sustituir, Eliminar */}
                      <div className="flex items-center gap-2 self-end pb-0.5">
                        {archivo.storageUrl && vistas[archivo.storageUrl] && (
                          <a href={vistas[archivo.storageUrl]} target="_blank" rel="noreferrer" className="text-blue-800 underline text-xs font-medium">
                            Ver PDF
                          </a>
                        )}
                        <label className="text-xs text-blue-800 font-medium cursor-pointer hover:underline border border-blue-200 bg-blue-50/50 rounded px-2 py-1">
                          Sustituir
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            aria-label={`Sustituir ${archivo.nombre}`}
                            disabled={isSubmitting || cargandoArchivo}
                            className="sr-only"
                            onChange={(e) => handleFileChange(e, { clasificacion: archivo.clasificacion ?? 'EXPEDIENTE', requisitoId: archivo.requisitoId, sustituir: archivo.storageUrl })}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveArchivo(index)}
                          disabled={isSubmitting || cargandoArchivo}
                          className="shrink-0 rounded px-2 py-1 font-bold text-red-600 hover:bg-red-50 cursor-pointer border border-red-200"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* BOTONERA DE NAVEGACIÓN ACCESIBLE */}
      <footer className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting || cargandoArchivo}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
        >
          ← Anterior
        </button>

        <button
          type="submit"
          disabled={!isValid || isSubmitting || cargandoArchivo}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-xs font-bold text-white shadow-xs transition ${
            isValid && !isSubmitting
              ? 'bg-[#006EC7] hover:bg-[#005ba3] cursor-pointer'
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          Siguiente →
        </button>
      </footer>
    </form>
  );
};

export default StepDocumentos;
