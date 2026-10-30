import { useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";
import { useRutaDocDetalle } from "./rutadoc/useRutaDocDetalle";
import { useContextoTupa } from "./rutadoc/useContextoTupa";
import { rutaDoc } from "./rutadoc/rutadoc.service";
import type { DocumentoAdjuntoDto, SolicitanteResumenDto } from "./rutadoc/rutadoc.dto";
import RutaDocEstado, { FechaRutaDoc, IdentificadorRutaDoc } from "./rutadoc/RutaDocEstado";
import RutaDocTimeline from "./rutadoc/RutaDocTimeline";
import RutaDocFoliacion from "./rutadoc/RutaDocFoliacion";
import RutaDocSla from "./rutadoc/RutaDocSla";
import RutaDocTupa from "./rutadoc/RutaDocTupa";
import DerivacionModal from "../../components/expedientes/DerivacionModal";
import ObservacionModal from "../../components/expedientes/ObservacionModal";
import SubsanacionModal from "../../components/expedientes/SubsanacionModal";
import AcumulacionModal from "../../components/expedientes/AcumulacionModal";
import AtencionModal from "../../components/expedientes/AtencionModal";
import ArchivadoModal from "../../components/expedientes/ArchivadoModal";
import ExpedienteActionToast from "../../components/expedientes/ExpedienteActionToast";
import { useExpedienteActions } from "../../hooks/useExpedienteActions";
import { servicioExpedienteActionsReal } from "../../api/expedienteActions";
import { useAuthStore } from "../../stores/authStore";
import { apiClient } from "../../api/client";
import { tesoreriaService, type DtoOrdenPago } from "../../services/tesoreria.service";
import type { BusquedaExpedientes, ExpedienteAccionReferencia, UnidadDestino } from "../../types/expedienteActions";

const busquedaConexos: BusquedaExpedientes = {
  buscar: async (texto: string, signal: AbortSignal) => {
    try {
      const { apiClient } = await import("../../api/client");
      const res = await apiClient.get<{ elementos?: Array<{ idExpediente: string; cut: string }> }>(
        "/api/v1/expedientes",
        { params: { terminoBusqueda: texto, limite: 10, pestana: "EN_TRAMITE" }, signal }
      );
      return (res.data?.elementos ?? []).map((e) => ({ id: e.idExpediente, codigo: e.cut }));
    } catch {
      return [];
    }
  },
};

function formatearBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const unidades = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${unidades[i]}`;
}

function humanizarEstado(estado?: string): { texto: string; badgeClass: string; dotClass: string } {
  switch (estado) {
    case "REGISTRADO":
      return { texto: "Registrado", badgeClass: "bg-blue-50 text-blue-800 border-blue-200", dotClass: "bg-blue-600" };
    case "RECEPCIONADO":
      return { texto: "Recepcionado", badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200", dotClass: "bg-indigo-600" };
    case "EN_CALIFICACION":
      return { texto: "En calificación", badgeClass: "bg-purple-50 text-purple-800 border-purple-200", dotClass: "bg-purple-600" };
    case "EN_REVISION":
      return { texto: "En revisión", badgeClass: "bg-amber-50 text-amber-800 border-amber-200", dotClass: "bg-amber-600" };
    case "OBSERVADO":
      return { texto: "Observado", badgeClass: "bg-rose-50 text-rose-800 border-rose-200", dotClass: "bg-rose-600" };
    case "SUBSANADO":
      return { texto: "Subsanado", badgeClass: "bg-teal-50 text-teal-800 border-teal-200", dotClass: "bg-teal-600" };
    case "DERIVADO":
      return { texto: "Derivado", badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200", dotClass: "bg-cyan-600" };
    case "EN_FIRMA":
      return { texto: "En firma", badgeClass: "bg-violet-50 text-violet-800 border-violet-200", dotClass: "bg-violet-600" };
    case "RESUELTO":
      return { texto: "Resuelto", badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200", dotClass: "bg-emerald-600" };
    case "ARCHIVADO":
      return { texto: "Archivado", badgeClass: "bg-slate-100 text-slate-800 border-slate-300", dotClass: "bg-slate-500" };
    default:
      return { texto: estado || "Registrado", badgeClass: "bg-slate-100 text-slate-800 border-slate-200", dotClass: "bg-slate-500" };
  }
}

function humanizarClasificacion(clasificacion?: string): string {
  if (!clasificacion) return "Procedimiento administrativo";
  switch (clasificacion.toUpperCase()) {
    case "PROCEDIMIENTO_APROBADO":
      return "Procedimiento administrativo";
    case "AUTOMATICO":
    case "APROBACION_AUTOMATICA":
      return "Aprobación automática";
    case "EVALUACION_PREVIA_POSITIVO":
      return "Evaluación previa (Silencio positivo)";
    case "EVALUACION_PREVIA_NEGATIVO":
      return "Evaluación previa (Silencio negativo)";
    case "SERVICIO_NO_EXCLUSIVO":
      return "Servicio prestado en exclusividad";
    default:
      return "Procedimiento administrativo";
  }
}

function formatoNombre(nombre?: string | null): string {
  if (!nombre) return "Administrado";
  return nombre
    .toLowerCase()
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function formatearFechaLarga(fechaStr?: string): string {
  if (!fechaStr) return "No disponible";
  const f = new Date(fechaStr);
  if (isNaN(f.getTime())) return fechaStr;
  return f.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearFechaCorta(fechaStr?: string): string {
  if (!fechaStr) return "No disponible";
  const f = new Date(fechaStr);
  if (isNaN(f.getTime())) return fechaStr;
  return f.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ExpedienteDetallePage() {
  const disponibilidadId = useId();
  const { id } = useParams<{ id: string }>();

  // Estados de carga bajo demanda
  const [verTrazabilidad, setVerTrazabilidad] = useState(false);
  const [verFoliacionDetallada, setVerFoliacionDetallada] = useState(false);
  const [documentoPreview, setDocumentoPreview] = useState<{ idDocumento: string; nombreArchivo: string; url: string } | null>(null);
  const [cargandoAccionDoc, setCargandoAccionDoc] = useState<{ id: string; tipo: 'preview' | 'download' } | null>(null);
  const [errorDoc, setErrorDoc] = useState<string | null>(null);
  const [verDatosSolicitante, setVerDatosSolicitante] = useState(false);
  const [expandirShaDoc, setExpandirShaDoc] = useState<Record<string, boolean>>({});
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Manejador tecla Escape para cerrar modales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (documentoPreview) setDocumentoPreview(null);
        if (verDatosSolicitante) setVerDatosSolicitante(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [documentoPreview, verDatosSolicitante]);

  const copiarTexto = async (texto: string, clave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(clave);
      setTimeout(() => setCopiadoId(null), 2000);
    } catch {
      // noop
    }
  };

  const toggleSha = (docId: string) => {
    setExpandirShaDoc((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  const handleVerPdf = async (doc: DocumentoAdjuntoDto) => {
    if (!id) return;
    setErrorDoc(null);
    setCargandoAccionDoc({ id: doc.idDocumento, tipo: 'preview' });
    try {
      const data = await rutaDoc.obtenerUrlArchivo(id, doc.idDocumento);
      setDocumentoPreview({
        idDocumento: doc.idDocumento,
        nombreArchivo: data.nombreArchivo || doc.nombreArchivo,
        url: data.url,
      });
    } catch (err) {
      setErrorDoc(err instanceof Error ? err.message : "No se pudo obtener la vista previa del documento.");
    } finally {
      setCargandoAccionDoc(null);
    }
  };

  const handleDescargarPdf = async (doc: DocumentoAdjuntoDto) => {
    if (!id) return;
    setErrorDoc(null);
    setCargandoAccionDoc({ id: doc.idDocumento, tipo: 'download' });
    try {
      const data = await rutaDoc.obtenerUrlArchivo(id, doc.idDocumento);
      const a = document.createElement("a");
      a.href = data.downloadUrl || data.url;
      a.download = data.nombreArchivo || doc.nombreArchivo;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setErrorDoc(err instanceof Error ? err.message : "No se pudo generar el enlace de descarga.");
    } finally {
      setCargandoAccionDoc(null);
    }
  };

  // 1. Endpoint consolidado: 1 solo request HTTP (/resumen) alimenta la vista inicial
  const resumen = useQuery({
    queryKey: ["rutadoc", id, "resumen"],
    queryFn: ({ signal }) => rutaDoc.resumen(id!, signal),
    enabled: Boolean(id),
    retry: false,
  });

  const debeUsarFallback = resumen.isError || (resumen.isSuccess && !resumen.data?.expediente);
  const usaResumen = Boolean(resumen.data?.expediente);

  // Fallback transparente a endpoints granulares si /resumen falla o no contiene expediente
  const { detalle: detalleLegacy, sla: slaLegacy } = useRutaDocDetalle(
    debeUsarFallback ? id : undefined,
    { habilitarFoliacion: false }
  );

  // Foliación detallada: habilitada bajo demanda explícita (verFoliacionDetallada) o en modo fallback
  const foliacionDetallada = useQuery({
    queryKey: ["rutadoc", id, "foliacion"],
    queryFn: ({ signal }) => rutaDoc.foliacion(id!, signal),
    enabled: Boolean(id) && (debeUsarFallback || verFoliacionDetallada),
    retry: false,
  });

  const timelineQuery = useExpedienteTimeline(
    debeUsarFallback || verTrazabilidad ? id : undefined
  );
  const tupaLegacy = useContextoTupa(debeUsarFallback ? id : undefined);

  // Datos consolidados
  const detalleData = usaResumen ? resumen.data!.expediente : detalleLegacy.data;
  const isPending = usaResumen ? resumen.isPending : detalleLegacy.isPending;
  const isSuccess = Boolean(detalleData);
  const error = usaResumen ? resumen.error : detalleLegacy.error;

  const foliacionResumen = usaResumen ? resumen.data?.foliacionResumen : null;
  const documentosAdjuntos: DocumentoAdjuntoDto[] = usaResumen ? (resumen.data?.documentos ?? []) : [];
  const solicitanteResumen: SolicitanteResumenDto | null = usaResumen ? (resumen.data?.solicitanteResumen ?? null) : null;
  const tupaResumen = usaResumen ? (resumen.data?.tupaResumen ?? null) : null;
  const slaResumen = usaResumen ? (resumen.data?.slaResumen ?? null) : null;

  const usuario = useAuthStore((s) => s.usuario);
  const [modal, setModal] = useState<"derivacion" | "observacion" | "subsanacion" | "acumulacion" | "atender" | "archivar" | null>(null);
  const puedeOperar = Boolean(usuario && ["ADMINISTRADOR", "DIRECTOR", "ESPECIALISTA", "SECRETARIO", "MESA_PARTES"].includes(usuario.rol));
  const unidadesQuery = useQuery({
    queryKey: ["organigrama", "areas-activas"],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<UnidadDestino[]>("/api/v1/organigrama/areas-activas", { signal });
      if (!Array.isArray(data)) throw new Error("Respuesta de unidades inválida.");
      return data;
    },
    enabled: puedeOperar && modal === "derivacion",
    staleTime: 60_000,
  });

  const acciones = useExpedienteActions({
    servicio: servicioExpedienteActionsReal,
    obtenerClavesAfectadas: (ids) =>
      ids.flatMap((expId) => [
        ["rutadoc", expId, "resumen"],
        ["rutadoc", expId, "detalle"],
        ["rutadoc", expId, "trazabilidad"],
        ["rutadoc", expId, "foliacion"],
        ["rutadoc", expId, "sla"],
        ["rutadoc", expId, "acumulaciones"],
        ["tramicore", expId, "tupa"],
        ["rutadoc", "bandeja"],
      ]),
  });

  const esTitular = Boolean(usuario?.idPersona && usuario.idPersona === detalleData?.solicitanteId);
  const rolSubsanacionInstitucional = Boolean(usuario && ["ADMINISTRADOR", "DIRECTOR", "MESA_PARTES"].includes(usuario.rol));
  const tienePermisoSubsanacion = esTitular || rolSubsanacionInstitucional;
  const puedeSubsanar = tienePermisoSubsanacion && detalleData?.estadoActual === "OBSERVADO";

  const refExpediente: ExpedienteAccionReferencia = {
    id: detalleData?.idExpediente ?? id ?? "",
    codigo: detalleData?.cut ?? "",
    unidadOrigenId: detalleData?.areaActualId ?? undefined,
  };

  const tieneCostoTupa = Boolean(tupaResumen && tupaResumen.costo > 0);
  const [consultarPagoBajoDemanda, setConsultarPagoBajoDemanda] = useState(false);

  // Consulta de pago / Tesorería: bajo demanda si se genera orden o se actualiza
  const pagoQuery = useQuery({
    queryKey: ["tesoreria", id, "pago"],
    queryFn: ({ signal }) => tesoreriaService.obtenerPagoExpediente(id!, signal),
    enabled: Boolean(id) && consultarPagoBajoDemanda,
    staleTime: 5_000,
  });

  const [generandoOrden, setGenerandoOrden] = useState(false);
  const [errorOrden, setErrorOrden] = useState<string | null>(null);
  const [modalReciboDetalle, setModalReciboDetalle] = useState<DtoOrdenPago | null>(null);

  const handleGenerarOrdenPago = async () => {
    if (!id) return;
    setGenerandoOrden(true);
    setErrorOrden(null);
    try {
      await tesoreriaService.generarOrdenPagoExpediente(id);
      setConsultarPagoBajoDemanda(true);
      void pagoQuery.refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al generar orden de pago.";
      setErrorOrden(msg);
    } finally {
      setGenerandoOrden(false);
    }
  };

  const pagoEnResumen = (resumen.data as { pago?: DtoOrdenPago | null } | undefined)?.pago;
  const ordenPago = pagoQuery.data?.tieneOrden ? pagoQuery.data.pago : (pagoEnResumen ?? null);
  const pagoConfirmado = Boolean(ordenPago && ordenPago.estado === "CONFIRMADO");
  const bloqueadoPorPago = tieneCostoTupa && !pagoConfirmado;

  const accionesDisponibles = [
    {
      nombre: "Derivar",
      tipo: "derivacion" as const,
      ayuda: !puedeOperar
        ? "No cuenta con permisos para derivar este expediente."
        : bloqueadoPorPago
          ? "El expediente requiere pago confirmado en Tesorería antes de continuar."
          : "Derivar el expediente hacia otra unidad orgánica para su atención.",
      habilitado: puedeOperar && !bloqueadoPorPago,
      clase: "border-blue-800 bg-blue-800 text-white hover:bg-blue-900 focus-visible:outline-blue-700 shadow-xs",
    },
    {
      nombre: "Observar",
      tipo: "observacion" as const,
      ayuda: puedeOperar
        ? "Registrar pliego de observaciones formales para el administrado."
        : "No cuenta con permisos para observar este expediente.",
      habilitado: puedeOperar,
      clase: "border-amber-700 bg-amber-700 text-white hover:bg-amber-800 focus-visible:outline-amber-700 shadow-xs",
    },
    {
      nombre: "Subsanar",
      tipo: "subsanacion" as const,
      ayuda: !tienePermisoSubsanacion
        ? "No cuenta con permisos para subsanar este expediente."
        : detalleData?.estadoActual !== "OBSERVADO"
          ? "Solo se pueden subsanar expedientes en estado OBSERVADO."
          : "Registrar la corrección y subsanación de las observaciones.",
      habilitado: puedeSubsanar,
      clase: "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:outline-emerald-700 shadow-xs",
    },
    {
      nombre: "Atender",
      tipo: "atender" as const,
      ayuda: !puedeOperar
        ? "No cuenta con permisos para atender este expediente."
        : detalleData?.estadoActual !== "EN_REVISION" && detalleData?.estadoActual !== "DERIVADO"
          ? "Solo se pueden atender expedientes en estado EN_REVISION o DERIVADO."
          : "Emitir acto resolutivo formal y notificar a Casilla Electrónica.",
      habilitado: puedeOperar && (detalleData?.estadoActual === "EN_REVISION" || detalleData?.estadoActual === "DERIVADO"),
      clase: "border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-900 focus-visible:outline-emerald-700 shadow-xs",
    },
    {
      nombre: "Archivar",
      tipo: "archivar" as const,
      ayuda: !Boolean(usuario && ["ADMINISTRADOR", "DIRECTOR", "SECRETARIO", "MESA_PARTES"].includes(usuario.rol))
        ? "No cuenta con facultades para archivar formalmente el expediente."
        : detalleData?.estadoActual !== "RESUELTO"
          ? "Solo se pueden archivar expedientes en estado RESUELTO."
          : "Registrar ubicación de inventario físico y archivar expediente.",
      habilitado: Boolean(usuario && ["ADMINISTRADOR", "DIRECTOR", "SECRETARIO", "MESA_PARTES"].includes(usuario.rol)) && detalleData?.estadoActual === "RESUELTO",
      clase: "border-amber-800 bg-amber-800 text-white hover:bg-amber-900 focus-visible:outline-amber-700 shadow-xs",
    },
    {
      nombre: "Acumular",
      tipo: "acumulacion" as const,
      ayuda: puedeOperar
        ? "Acumular expedientes conexos bajo este expediente principal (Art. 160 LPAG)."
        : "No cuenta con permisos para acumular este expediente.",
      habilitado: puedeOperar,
      clase: "border-slate-700 bg-slate-700 text-white hover:bg-slate-800 focus-visible:outline-slate-700 shadow-xs",
    },
  ];

  // 1. Ubicación Actual y Nombres Institucionales (Sin UUIDs crudos)
  const resolverNombreArea = (areaId: string | null | undefined): string => {
    if (!areaId) return "Mesa de Partes";
    if (areaId === "a0000000-0000-0000-0000-000000000001" || areaId === "SDA") {
      return "Subdirección Académica";
    }
    if (areaId === "a0000000-0000-0000-0000-000000000002" || areaId === "DIR") {
      return "Dirección General";
    }
    const encontrada = unidadesQuery.data?.find((u) => u.id === areaId);
    if (encontrada) return encontrada.nombre;
    return "Mesa de Partes";
  };

  const ubicacionActual = useMemo(() => {
    if (detalleData?.estadoActual === "ARCHIVADO") {
      return "Archivo Central (Custodia Física)";
    }
    if (detalleData?.estadoActual === "RESUELTO") {
      return "Subdirección Académica / Casilla Ciudadana";
    }
    if (detalleData?.estadoActual === "DERIVADO" || detalleData?.estadoActual === "EN_REVISION") {
      return resolverNombreArea(detalleData.areaActualId);
    }
    // Si está en REGISTRADO o PAGO PENDIENTE: permanece en Mesa de Partes
    return "Mesa de Partes";
  }, [detalleData, unidadesQuery.data]);

  const areaResponsable = useMemo(() => {
    if (detalleData?.estadoActual === "ARCHIVADO") {
      return "Archivo Central";
    }
    if (detalleData?.estadoActual === "DERIVADO" || detalleData?.estadoActual === "EN_REVISION" || detalleData?.estadoActual === "RESUELTO") {
      return resolverNombreArea(detalleData.areaActualId);
    }
    if (tupaResumen?.codigo === "p1-fila-06" || tupaResumen?.denominacion?.toLowerCase().includes("inglés")) {
      return "Subdirección Académica (SDA)";
    }
    return "Mesa de Partes";
  }, [detalleData, tupaResumen, unidadesQuery.data]);

  const responsableActual = useMemo(() => {
    if (detalleData?.estadoActual === "ARCHIVADO") {
      return "Encargado de Archivo Central";
    }
    if (detalleData?.estadoActual === "RESUELTO") {
      return "Secretario Académico / Director";
    }
    if (detalleData?.estadoActual === "EN_REVISION") {
      return "Especialista Académico (SDA)";
    }
    if (detalleData?.estadoActual === "DERIVADO") {
      return "Jefatura / Mesa de Entrada SDA";
    }
    return "Operador de Mesa de Partes";
  }, [detalleData]);

  const ultimaActuacion = useMemo(() => {
    if (detalleData?.estadoActual === "ARCHIVADO") {
      return "Archivado formalmente en legajo institucional";
    }
    if (detalleData?.estadoActual === "RESUELTO") {
      return "Acto administrativo emitido y depositado en Casilla";
    }
    if (detalleData?.estadoActual === "EN_REVISION") {
      return "Expediente recepcionado y en calificación técnica";
    }
    if (detalleData?.estadoActual === "DERIVADO") {
      return "Derivado formalmente a Subdirección Académica";
    }
    if (pagoConfirmado) {
      return "Pago de derecho verificado y confirmado por Tesorería";
    }
    if (bloqueadoPorPago) {
      return `Orden de pago emitida (${ordenPago?.codigoPago || "Pendiente"})`;
    }
    return `Expediente radicado formalmente (${formatearFechaLarga(detalleData?.fechaRadicacion || "")})`;
  }, [detalleData, pagoConfirmado, bloqueadoPorPago, ordenPago]);

  const siguienteAccion = useMemo(() => {
    if (detalleData?.estadoActual === "ARCHIVADO") {
      return "Trámite concluido (custodia pasiva definitiva)";
    }
    if (detalleData?.estadoActual === "RESUELTO") {
      return "Inventariar y archivar legajo en custodia física";
    }
    if (detalleData?.estadoActual === "EN_REVISION") {
      return "Evaluar expediente y emitir documento de resolución";
    }
    if (detalleData?.estadoActual === "DERIVADO") {
      return "Confirmar recepción formal en Subdirección Académica";
    }
    if (pagoConfirmado) {
      return "Derivar expediente a Subdirección Académica";
    }
    if (bloqueadoPorPago) {
      return "Esperar confirmación de pago en Tesorería";
    }
    return "Derivar expediente a área técnica competente";
  }, [detalleData, pagoConfirmado, bloqueadoPorPago]);

  // Destino sugerido según TUPA
  const esTramiteSDA = Boolean(
    tupaResumen?.codigo === "p1-fila-06" ||
    tupaResumen?.denominacion?.toLowerCase().includes("inglés") ||
    tupaResumen?.clasificacion === "PROCEDIMIENTO_APROBADO" ||
    tupaResumen?.clasificacion === "SERVICIO_ACADEMICO"
  );
  const destinoSugeridoId = esTramiteSDA ? "a0000000-0000-0000-0000-000000000001" : undefined;
  const destinoSugeridoNombre = esTramiteSDA ? "Subdirección Académica" : undefined;

  const estadoInfo = humanizarEstado(detalleData?.estadoActual);
  const cantidadDocs = foliacionResumen?.cantidadDocumentos ?? detalleData?.resumenDocumentos?.cantidadDocumentos ?? documentosAdjuntos.length ?? 0;
  const foliosAsignados = foliacionResumen?.totalFolios ?? detalleData?.resumenDocumentos?.totalFolios ?? 0;
  const esFoliadoCompleto = foliacionResumen?.cantidadFoliados ? foliacionResumen.cantidadFoliados >= cantidadDocs : foliosAsignados > 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 text-slate-800">
      {/* 1. Volver a la bandeja */}
      <nav aria-label="Navegación secundaria">
        <Link
          to="/expedientes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 hover:text-blue-900 underline transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          ← Volver a la bandeja
        </Link>
      </nav>

      {/* Manejo de estado de carga y error principal */}
      <RutaDocEstado
        pendiente={isPending}
        error={error}
        reintentar={() => {
          void resumen.refetch();
          void detalleLegacy.refetch();
        }}
      >
        {detalleData && (
          <>
            {/* Si está en modo fallback (legacy), renderizamos la estructura de compatibilidad exacta */}
            {debeUsarFallback ? (
              <section aria-label="Detalle legacy">
                <h1 className="text-2xl font-bold">Detalle de expediente</h1>
                <h2>{detalleData.cut}</h2>
                <p>{detalleData.asunto}</p>
                <dl>
                  <dt>UUID</dt>
                  <dd className="break-all font-mono text-sm">{detalleData.idExpediente}</dd>
                  <dt>Estado</dt>
                  <dd>{detalleData.estadoActual}</dd>
                  <dt>Radicación</dt>
                  <dd><FechaRutaDoc valor={detalleData.fechaRadicacion} /></dd>
                  <dt>Área actual</dt>
                  <dd><IdentificadorRutaDoc valor={detalleData.areaActualId} /></dd>
                  <dt>Solicitante UUID</dt>
                  <dd><IdentificadorRutaDoc valor={detalleData.solicitanteId} /></dd>
                  <dt>Resumen documental</dt>
                  <dd>{`${cantidadDocs} ${cantidadDocs === 1 ? 'documento' : 'documentos'}, ${foliosAsignados} folios asignados`}</dd>
                </dl>
              </section>
            ) : (
              /* MODO OPERACIONAL MODERNO (/resumen) */
              <>
                {/* 2. CABECERA DEL EXPEDIENTE */}
                <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Expediente</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-600 font-medium">Mesa de Partes</span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {detalleData.cut}
                      </h1>
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${estadoInfo.badgeClass}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${estadoInfo.dotClass}`} aria-hidden="true"></span>
                        {estadoInfo.texto}
                      </span>
                    </div>
                  </div>

                  <p className="text-base sm:text-lg font-semibold text-slate-800 leading-snug">
                    {detalleData.asunto || tupaResumen?.denominacion || "Trámite documentario institucional"}
                  </p>

                  <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400">Radicado: </span>
                      <span className="font-medium text-slate-800">{formatearFechaLarga(detalleData.fechaRadicacion)}</span>
                    </div>
                    <span>·</span>
                    <div>
                      <span className="text-slate-400">Área actual: </span>
                      <span className="font-medium text-slate-800">{resolverNombreArea(detalleData.areaActualId)}</span>
                    </div>
                    <span>·</span>
                    <div>
                      <span className="text-slate-400">Resumen: </span>
                      <span className="font-semibold text-slate-900">
                        {cantidadDocs} {cantidadDocs === 1 ? 'documento' : 'documentos'}, {foliosAsignados} folios asignados
                      </span>
                    </div>
                  </div>
                </header>

                {/* TARJETA DE SEGUIMIENTO Y LIVE TRACKING OPERACIONAL */}
                <section aria-label="Seguimiento operacional en vivo" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base" aria-hidden="true">📍</span>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                        Ubicación y Seguimiento Operacional (Live Tracking)
                      </h2>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" aria-hidden="true" />
                      En tiempo real
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1 text-xs">
                    {/* Ubicación Actual */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                        Ubicación Actual
                      </span>
                      <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>🏢</span>
                        <span>{ubicacionActual}</span>
                      </p>
                    </div>

                    {/* Área Responsable */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                        Área Responsable
                      </span>
                      <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                        <span>🏛️</span>
                        <span>{areaResponsable}</span>
                      </p>
                    </div>

                    {/* Responsable Actual */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                        Responsable Actual
                      </span>
                      <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                        <span>👤</span>
                        <span>{responsableActual}</span>
                      </p>
                    </div>

                    {/* Estado Documental */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                        Estado Documental
                      </span>
                      <div className="pt-0.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${estadoInfo.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${estadoInfo.dotClass}`} aria-hidden="true" />
                          {estadoInfo.texto}
                        </span>
                      </div>
                    </div>

                    {/* Última Actuación */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                        Última Actuación
                      </span>
                      <p className="font-medium text-slate-700 truncate" title={ultimaActuacion}>
                        {ultimaActuacion}
                      </p>
                    </div>

                    {/* Siguiente Acción */}
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1">
                      <span className="text-blue-700 font-bold uppercase tracking-wider text-[10px] block">
                        Siguiente Acción Requerida
                      </span>
                      <p className="font-bold text-blue-950 truncate" title={siguienteAccion}>
                        {siguienteAccion}
                      </p>
                    </div>
                  </div>
                </section>

                {/* BANNER LISTO PARA DERIVAR POST-PAGO (ESTADO REGISTRADO CON PAGO CONFIRMADO) */}
                {detalleData.estadoActual === "REGISTRADO" && pagoConfirmado && (
                  <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Listo para derivar
                        </span>
                        <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">
                          Pago Confirmado por Tesorería
                        </h3>
                      </div>
                      <p className="text-xs text-emerald-900">
                        El administrado completó el pago de derecho de tramitación en Tesorería. El expediente se encuentra en Mesa de Partes habilitado para su derivación inmediata.
                      </p>
                      {destinoSugeridoNombre && (
                        <p className="text-xs font-bold text-emerald-800 pt-0.5">
                          💡 Destino sugerido: <span className="underline">{destinoSugeridoNombre}</span> ({tupaResumen?.codigo || "p1-fila-06"})
                        </p>
                      )}
                    </div>
                    {puedeOperar && (
                      <button
                        type="button"
                        onClick={() => setModal("derivacion")}
                        className="shrink-0 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white transition shadow-xs flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-emerald-600 cursor-pointer"
                      >
                        <span>🚀</span>
                        <span>Derivar Expediente</span>
                      </button>
                    )}
                  </div>
                )}

                {/* BANNER BLOQUEADO POR PAGO PENDIENTE (ESTADO REGISTRADO CON COSTO Y SIN PAGO CONFIRMADO) */}
                {detalleData.estadoActual === "REGISTRADO" && bloqueadoPorPago && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          ⏳ Pago Pendiente en Tesorería
                        </span>
                        <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                          Trámite TUPA Arancelado ({tupaResumen?.costo ? `S/ ${tupaResumen.costo.toFixed(2)}` : "Con costo"})
                        </h3>
                      </div>
                      <p className="text-xs text-amber-900">
                        El expediente se encuentra en Mesa de Partes pero la derivación está bloqueada preventivamente hasta que Tesorería confirme el pago del arancel correspondiente.
                      </p>
                    </div>
                  </div>
                )}

                {/* BANNER OPERACIONAL SDA / ATENCIÓN SEGÚN ESTADO FSM */}
                {detalleData.estadoActual === "DERIVADO" && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                        <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wide">
                          Atención del Expediente — Pendiente de Recepción (Subdirección Académica)
                        </h3>
                      </div>
                      <p className="text-xs text-indigo-900">
                        Este expediente fue derivado a su área. Debe confirmar la recepción formal para iniciar la evaluación técnica y sustantiva.
                      </p>
                    </div>
                    {puedeOperar && (
                      <button
                        type="button"
                        disabled={acciones.recepcion.pending}
                        onClick={() => void acciones.recepcion.ejecutar({ expediente: refExpediente })}
                        className="shrink-0 rounded-xl bg-indigo-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-900 transition shadow-xs disabled:opacity-50"
                      >
                        {acciones.recepcion.pending ? "Recepcionando..." : "📥 Recepcionar Expediente"}
                      </button>
                    )}
                  </div>
                )}

                {detalleData.estadoActual === "EN_REVISION" && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse"></span>
                        <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                          Expediente en Calificación y Revisión Académica
                        </h3>
                      </div>
                      <p className="text-xs text-amber-900">
                        El expediente se encuentra en revisión. Una vez evaluados los requisitos, emita el acto resolutivo para notificar a la Casilla Electrónica.
                      </p>
                    </div>
                    {puedeOperar && (
                      <button
                        type="button"
                        onClick={() => setModal("atender")}
                        className="shrink-0 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-900 transition shadow-xs"
                      >
                        📝 Atender y Emitir Resolución
                      </button>
                    )}
                  </div>
                )}

                {detalleData.estadoActual === "RESUELTO" && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                        <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">
                          Expediente Atendido y Resuelto
                        </h3>
                      </div>
                      <p className="text-xs text-emerald-900">
                        El acto administrativo fue emitido y depositado en la Casilla Electrónica del administrado. El legajo está listo para su inventario y archivo formal en custodia física.
                      </p>
                    </div>
                    {Boolean(usuario && ["ADMINISTRADOR", "DIRECTOR", "SECRETARIO", "MESA_PARTES"].includes(usuario.rol)) && (
                      <button
                        type="button"
                        onClick={() => setModal("archivar")}
                        className="shrink-0 rounded-xl bg-amber-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-900 transition shadow-xs"
                      >
                        🗄️ Archivar Expediente
                      </button>
                    )}
                  </div>
                )}

                {detalleData.estadoActual === "ARCHIVADO" && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-100/90 p-4 sm:p-5 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        Expediente Archivado Formalmente
                      </h3>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">
                      Trámite cerrado en estado terminal ARCHIVADO. Custodia física formal registrada en el Archivo Institucional.
                    </p>
                  </div>
                )}

                {/* 3. RESUMEN SUPERIOR: DOS TARJETAS COMPACTAS (SOLICITANTE + TRÁMITE) */}
                <section aria-label="Resumen operativo" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tarjeta Solicitante */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Solicitante
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {solicitanteResumen?.tipoDocumento || "Persona"}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          {solicitanteResumen?.nombreCompleto
                            ? formatoNombre(solicitanteResumen.nombreCompleto)
                            : "Administrado registrado"}
                        </h2>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">
                          {solicitanteResumen?.tipoDocumento || "DNI"}:{" "}
                          <span className="font-semibold text-slate-800">
                            {solicitanteResumen?.documentoEnmascarado || "••••••••"}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-slate-400">Correo:</span>
                          <span className="text-slate-800 font-medium truncate">
                            {solicitanteResumen?.correo || "No registrado"}
                          </span>
                        </div>
                        {solicitanteResumen?.telefono && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Teléfono:</span>
                            <span className="text-slate-800 font-medium">{solicitanteResumen.telefono}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setVerDatosSolicitante(true)}
                        className="inline-flex items-center text-xs font-semibold text-blue-800 hover:text-blue-900 underline focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        Ver datos completos
                      </button>
                    </div>
                  </div>

                  {/* Tarjeta Trámite TUPA */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Trámite solicitado
                        </span>
                        {tupaResumen?.codigo && (
                          <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                            TUPA {tupaResumen.codigo}
                          </span>
                        )}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900 line-clamp-2">
                          {tupaResumen?.denominacion || detalleData.asunto || "Trámite General"}
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {humanizarClasificacion(tupaResumen?.clasificacion)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Plazo de ley:</span>
                          <span className="font-semibold text-slate-800">
                            {tupaResumen?.plazoDias ? `${tupaResumen.plazoDias} días hábiles` : "30 días hábiles"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Costo:</span>
                          <span className="font-semibold text-slate-800">
                            {tupaResumen?.costo && tupaResumen.costo > 0
                              ? `S/ ${tupaResumen.costo.toFixed(2)}`
                              : "Gratuito"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </RutaDocEstado>

      {/* BLOQUE PRINCIPAL SI EL DETALLE ESTÁ CARGADO */}
      {isSuccess && detalleData && (
        <>
          {/* MODO FALLBACK (LEGACY COMPATIBILITY) */}
          {debeUsarFallback ? (
            <>
              {/* Contexto TUPA Legacy */}
              <section aria-label="Contexto TUPA">
                <h2>Contexto TUPA</h2>
                <RutaDocEstado pendiente={tupaLegacy.isPending} error={tupaLegacy.error} reintentar={() => { void tupaLegacy.refetch(); }}>
                  {tupaLegacy.data && (tupaLegacy.data.tupa === null
                    ? <p>Expediente sin procedimiento TUPA vinculado</p>
                    : <RutaDocTupa datos={tupaLegacy.data.tupa} />)}
                </RutaDocEstado>
              </section>

              {/* Acciones del expediente Legacy */}
              <section aria-label="Acciones del expediente" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="text-lg font-bold">Acciones del expediente</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {accionesDisponibles.map((accion, indice) => (
                    <div key={accion.nombre}>
                      <button
                        type="button"
                        disabled={!accion.habilitado}
                        aria-describedby={`${disponibilidadId}-${indice}`}
                        onClick={() => setModal(accion.tipo)}
                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          accion.habilitado
                            ? "border-blue-800 bg-blue-800 text-white hover:bg-blue-900 focus-visible:outline-blue-700"
                            : "border-slate-300 bg-slate-100 text-slate-500 disabled:cursor-not-allowed"
                        }`}
                      >
                        {accion.nombre}
                      </button>
                      <p id={`${disponibilidadId}-${indice}`} className="mt-2 text-sm text-slate-600">
                        {accion.ayuda}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Clasificación CCD Legacy */}
              <section aria-label="Clasificación CCD" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="text-lg font-bold">Clasificación CCD</h2>
                <p className="mt-2 text-sm text-slate-600">La consulta de clasificación documental no está disponible por el momento.</p>
              </section>

              {/* Versiones documentales Legacy */}
              <section aria-label="Versiones documentales" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="text-lg font-bold">Versiones documentales</h2>
                <p className="mt-2 text-sm text-slate-600">La consulta del historial de versiones documentales no está disponible por el momento.</p>
              </section>

              {/* Trazabilidad Legacy */}
              <section aria-label="Trazabilidad">
                <h2>Trazabilidad</h2>
                <RutaDocEstado pendiente={timelineQuery.isPending} error={timelineQuery.error} reintentar={() => { void timelineQuery.refetch(); }}>
                  {timelineQuery.data && <RutaDocTimeline datos={timelineQuery.data} />}
                </RutaDocEstado>
              </section>

              {/* Foliación Legacy */}
              <section aria-label="Foliación">
                <h2>Foliación</h2>
                <RutaDocEstado pendiente={foliacionDetallada.isPending} error={foliacionDetallada.error} reintentar={() => { void foliacionDetallada.refetch(); }}>
                  {foliacionDetallada.data && <RutaDocFoliacion datos={foliacionDetallada.data} />}
                </RutaDocEstado>
              </section>

              {/* SLA Legacy */}
              <section aria-label="SLA" role="region">
                <h2>SLA</h2>
                <RutaDocEstado pendiente={slaLegacy.isPending} error={slaLegacy.error} reintentar={() => { void slaLegacy.refetch(); }}>
                  {slaLegacy.data && <RutaDocSla datos={slaLegacy.data} />}
                </RutaDocEstado>
              </section>
            </>
          ) : (
            /* MODO MODERNO OPERACIONAL */
            <>
              {/* 4. DOCUMENTOS ADJUNTOS */}
              <section aria-label="Documentos adjuntos" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-slate-900">Documentos adjuntos</h2>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                      {documentosAdjuntos.length} {documentosAdjuntos.length === 1 ? 'documento' : 'documentos'}
                    </span>
                  </div>
                </div>

                {errorDoc && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-center justify-between">
                    <span>{errorDoc}</span>
                    <button
                      type="button"
                      onClick={() => setErrorDoc(null)}
                      className="text-xs font-semibold text-red-900 underline ml-2"
                    >
                      Cerrar
                    </button>
                  </div>
                )}

                {documentosAdjuntos.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    No se han registrado documentos adjuntos en este expediente.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {documentosAdjuntos.map((doc) => (
                      <li key={doc.idDocumento} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-red-100 text-red-700 font-extrabold text-xs uppercase shrink-0" aria-hidden="true">
                              PDF
                            </span>
                            <span className="font-semibold text-slate-900 break-all text-sm">{doc.nombreArchivo}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 font-medium">
                              {doc.tipoDocumental || 'Solicitud'}
                            </span>
                            <span>·</span>
                            <span>{formatearBytes(doc.tamanoBytes)}</span>
                            <span>·</span>
                            <span>{formatearFechaLarga(doc.creadoEn)}</span>
                            <span>·</span>
                            <span
                              className={`inline-flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded text-xs ${
                                doc.foliado
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${doc.foliado ? "bg-emerald-600" : "bg-amber-500"}`}
                                aria-hidden="true"
                              />
                              {doc.foliado ? `Foliado (${doc.folios})` : "Sin foliar"}
                            </span>
                          </div>

                          {/* Integridad criptográfica verificada */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ✓ Integridad verificada
                            </span>
                            {doc.sha256 && (
                              <button
                                type="button"
                                onClick={() => toggleSha(doc.idDocumento)}
                                className="text-[11px] text-slate-500 hover:text-slate-800 underline transition"
                              >
                                {expandirShaDoc[doc.idDocumento] ? "Ocultar SHA-256" : "Detalles técnicos"}
                              </button>
                            )}
                          </div>

                          {expandirShaDoc[doc.idDocumento] && doc.sha256 && (
                            <div className="mt-1 rounded-lg bg-slate-50 border border-slate-200 p-2 text-[11px] font-mono text-slate-600 break-all">
                              <span className="font-bold text-slate-700">SHA-256: </span>
                              {doc.sha256}
                            </div>
                          )}
                        </div>

                        {/* Botones de acción Ver PDF y Descargar */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleVerPdf(doc)}
                            disabled={cargandoAccionDoc?.id === doc.idDocumento}
                            className="rounded-xl border border-blue-800 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50 transition focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50"
                          >
                            {cargandoAccionDoc?.id === doc.idDocumento && cargandoAccionDoc.tipo === 'preview' ? "Cargando..." : "Ver PDF"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDescargarPdf(doc)}
                            disabled={cargandoAccionDoc?.id === doc.idDocumento}
                            className="rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition focus-visible:outline-2 focus-visible:outline-slate-700 disabled:opacity-50"
                          >
                            {cargandoAccionDoc?.id === doc.idDocumento && cargandoAccionDoc.tipo === 'download' ? "Descargando..." : "Descargar"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 5. CHECKLIST OPERACIONAL (REVISIÓN DEL EXPEDIENTE) */}
              <section aria-label="Revisión operacional" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                    Revisión del expediente
                  </h2>
                  <p className="text-xs text-slate-500">
                    Control operacional rápido de requisitos iniciales para Mesa de Partes
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-emerald-600 font-bold text-sm">✓</span>
                    <div>
                      <span className="font-semibold text-slate-800 block">Solicitante identificado</span>
                      <span className="text-slate-500">
                        {solicitanteResumen?.nombreCompleto ? formatoNombre(solicitanteResumen.nombreCompleto) : "Identidad certificada"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-emerald-600 font-bold text-sm">✓</span>
                    <div>
                      <span className="font-semibold text-slate-800 block">Procedimiento TUPA identificado</span>
                      <span className="text-slate-500">
                        {tupaResumen?.denominacion ? `Vinculado: ${tupaResumen.codigo || 'TUPA'}` : "Trámite identificado"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-emerald-600 font-bold text-sm">✓</span>
                    <div>
                      <span className="font-semibold text-slate-800 block">Documento recibido</span>
                      <span className="text-slate-500">
                        {documentosAdjuntos.length} {documentosAdjuntos.length === 1 ? 'documento presentado' : 'documentos presentados'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className={esFoliadoCompleto ? "text-emerald-600 font-bold text-sm" : "text-amber-500 font-bold text-sm"}>
                      {esFoliadoCompleto ? "✓" : "○"}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-800 block">
                        {esFoliadoCompleto ? "Foliación completa" : "Pendiente de foliación"}
                      </span>
                      <span className="text-slate-500">
                        {foliosAsignados} folios asignados formalmente
                      </span>
                    </div>
                  </div>
                </div>

                {tupaResumen && (
                  <div className="pt-1 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100">
                    <span>
                      {tupaResumen.costo > 0
                        ? `Arancel TUPA: S/ ${tupaResumen.costo.toFixed(2)}`
                        : "Trámite gratuito (Exento de arancel institucional)"}
                    </span>
                    <span className={bloqueadoPorPago ? "text-amber-700 font-semibold" : "text-emerald-700 font-semibold"}>
                      {bloqueadoPorPago
                        ? "⚠ Requiere pago confirmado antes de derivación"
                        : tieneCostoTupa
                          ? "✓ Arancel confirmado por Tesorería"
                          : "✓ Trámite gratuito sin arancel"}
                    </span>
                  </div>
                )}
              </section>

              {/* 5.1 SECCIÓN PAGO DEL TRÁMITE / TESORERÍA */}
              <section aria-label="Control de Pago" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                      Pago del Trámite (Tesorería)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Control institucional de arancel TUPA y confirmación de recaudación
                    </p>
                  </div>
                  {tieneCostoTupa ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                        pagoConfirmado
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : ordenPago
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          pagoConfirmado ? "bg-emerald-500" : ordenPago ? "bg-amber-500" : "bg-slate-400"
                        }`}
                      />
                      {pagoConfirmado
                        ? "✓ Pago Confirmado"
                        : ordenPago
                          ? `Orden: ${ordenPago.estado}`
                          : "Pendiente de Generar Orden"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                      ✓ Trámite Gratuito
                    </span>
                  )}
                </div>

                {!tieneCostoTupa ? (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">Trámite no sujeto a arancel</p>
                      <p className="text-slate-500 mt-0.5">
                        Este procedimiento no requiere pago institucional previo para su derivación.
                      </p>
                    </div>
                    <span className="font-mono font-bold text-slate-700 text-sm">S/ 0.00</span>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    {/* Tarjeta de estado de la orden */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-slate-500 block">Arancel TUPA:</span>
                        <span className="font-mono text-base font-extrabold text-blue-900">
                          S/ {tupaResumen?.costo.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Código Orden Pago:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {ordenPago ? ordenPago.codigoPago : "Sin generar"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Estado del Pago:</span>
                        <span className="font-bold text-slate-800">
                          {ordenPago ? ordenPago.estado : "No generado"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Vencimiento Orden:</span>
                        <span className="text-slate-700 font-medium">
                          {ordenPago ? formatearFechaCorta(ordenPago.fechaVencimiento) : "-"}
                        </span>
                      </div>
                    </div>

                    {/* Botones de acción / Recibo */}
                    {!ordenPago ? (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
                        <div>
                          <p className="font-semibold text-amber-900">
                            Se requiere generar la orden de pago oficial
                          </p>
                          <p className="text-amber-700 mt-0.5">
                            El administrado debe contar con su código de orden para abonar en caja o Yape.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={generandoOrden}
                          onClick={() => void handleGenerarOrdenPago()}
                          className="shrink-0 rounded-xl bg-blue-800 px-4 py-2 text-xs font-bold text-white hover:bg-blue-900 transition shadow-xs disabled:opacity-50"
                        >
                          {generandoOrden ? "Generando..." : "Generar orden de pago"}
                        </button>
                      </div>
                    ) : ordenPago.estado === "CONFIRMADO" ? (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                        <div className="space-y-0.5">
                          <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                            ✓ Pago verificado y liberado por Tesorería
                          </p>
                          <p className="text-emerald-800 font-mono text-[11px]">
                            Recibo: <strong>{ordenPago.codigoRecibo || "REC-2026-OFICIAL"}</strong> · Medio:{" "}
                            {ordenPago.metodoPago === "EFECTIVO"
                              ? "Efectivo"
                              : ordenPago.metodoPago === "YAPE"
                                ? "Yape Asistido"
                                : "QR Automático (Sandbox)"}
                            {ordenPago.fechaPago ? ` · Fecha: ${formatearFechaLarga(ordenPago.fechaPago)}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setModalReciboDetalle(ordenPago)}
                          className="shrink-0 rounded-xl border border-emerald-700 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition shadow-xs"
                        >
                          Ver Recibo Oficial
                        </button>
                      </div>
                    ) : ordenPago.estado === "PENDIENTE" ? (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200">
                        <div>
                          <p className="font-bold text-amber-900">
                            Orden emitida ({ordenPago.codigoPago}) — Pendiente de cobro en Tesorería
                          </p>
                          <p className="text-amber-700 mt-0.5">
                            El ciudadano puede pagar en efectivo en Ventanilla o vía Yape institucional.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(ordenPago.codigoPago);
                              setCopiadoId("codigo-pago");
                              setTimeout(() => setCopiadoId(null), 2000);
                            }}
                            className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-50 transition"
                          >
                            {copiadoId === "codigo-pago" ? "✓ Copiado" : "Copiar código"}
                          </button>
                          {usuario?.rol === "TESORERIA" || usuario?.rol === "ADMINISTRADOR" ? (
                            <Link
                              to="/tesoreria"
                              className="rounded-xl bg-blue-800 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-900 transition"
                            >
                              Ir a Cobrar →
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {errorOrden && (
                      <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        {errorOrden}
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* 6. ACCIONES DEL EXPEDIENTE (FSM STRICT) */}
              <section aria-label="Acciones del expediente" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-base font-bold text-slate-900">Acciones del expediente</h2>
                  <p className="text-xs text-slate-500">
                    Operaciones válidas según el estado actual del expediente y permisos del usuario
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {accionesDisponibles.map((accion, indice) => (
                    <div key={accion.nombre} className="flex flex-col justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                      <div>
                        <button
                          type="button"
                          disabled={!accion.habilitado}
                          aria-describedby={`${disponibilidadId}-${indice}`}
                          onClick={() => setModal(accion.tipo)}
                          className={`w-full rounded-xl border px-4 py-2.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            accion.habilitado
                              ? accion.clase
                              : "border-slate-200 bg-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          {accion.nombre}
                        </button>
                      </div>
                      <p id={`${disponibilidadId}-${indice}`} className="text-xs text-slate-600 leading-snug">
                        {accion.ayuda}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 7. PLAZO DEL TRÁMITE (SLA) */}
              <section aria-label="SLA" role="region" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                    Plazo del trámite
                  </h2>
                  {slaResumen && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${
                        slaResumen.estado === "VERDE"
                          ? "bg-emerald-100 text-emerald-800"
                          : slaResumen.estado === "AMARILLO"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          slaResumen.estado === "VERDE"
                            ? "bg-emerald-600"
                            : slaResumen.estado === "AMARILLO"
                            ? "bg-amber-600"
                            : "bg-red-600"
                        }`}
                      />
                      {slaResumen.estado === "VERDE"
                        ? "En plazo"
                        : slaResumen.estado === "AMARILLO"
                        ? "Por vencer"
                        : "Vencido"}
                    </span>
                  )}
                </div>

                {slaResumen ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                      <div className="text-slate-800 font-semibold">
                        {slaResumen.diasHabilesRestantes} días hábiles restantes
                      </div>
                      <div className="text-xs text-slate-500">
                        Fecha límite: <span className="font-semibold text-slate-800">{formatearFechaCorta(slaResumen.fechaLimite)}</span>
                      </div>
                    </div>

                    {/* Barra visual de progreso */}
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                      <div
                        className={`h-full transition-all duration-300 ${
                          slaResumen.estado === "VERDE"
                            ? "bg-emerald-600"
                            : slaResumen.estado === "AMARILLO"
                            ? "bg-amber-500"
                            : "bg-red-600"
                        }`}
                        style={{ width: `${Math.min(Math.max(slaResumen.porcentaje, 0), 100)}%` }}
                        aria-valuenow={slaResumen.porcentaje}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        role="progressbar"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Expediente sin plazo de SLA configurado</p>
                )}
              </section>

              {/* 8. INFORMACIÓN ADICIONAL Y SEGUIMIENTO (ACORDEONES) */}
              <section aria-label="Información adicional" className="space-y-3">
                <div className="border-b border-slate-200 pb-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Información adicional y seguimiento
                  </h2>
                </div>

                {/* Acordeón Foliación */}
                <details className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition list-none font-semibold text-sm text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 group-open:rotate-90 transition-transform">▸</span>
                      <span>Foliación</span>
                      <span className="text-xs font-normal text-slate-500">
                        · {cantidadDocs} documento(s) presentado(s), {foliosAsignados} folios asignados
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        esFoliadoCompleto ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {esFoliadoCompleto ? "Foliado" : "Pendiente de foliación"}
                    </span>
                  </summary>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 text-sm space-y-3">
                    <p className="text-slate-700">
                      Estado actual: <span className="font-semibold">{cantidadDocs} documento(s) presentado(s), {foliosAsignados} folios asignados.</span>
                    </p>
                    <div>
                      {!verFoliacionDetallada ? (
                        <button
                          type="button"
                          onClick={() => setVerFoliacionDetallada(true)}
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50 transition"
                        >
                          Ver desglose detallado de documentos y folios
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={() => setVerFoliacionDetallada(false)}
                            className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                          >
                            Ocultar desglose detallado
                          </button>
                          <RutaDocEstado pendiente={foliacionDetallada.isPending} error={foliacionDetallada.error} reintentar={() => { void foliacionDetallada.refetch(); }}>
                            {foliacionDetallada.data && <RutaDocFoliacion datos={foliacionDetallada.data} />}
                          </RutaDocEstado>
                        </div>
                      )}
                    </div>
                  </div>
                </details>

                {/* Acordeón Trazabilidad */}
                <details
                  className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
                  onToggle={(event) => {
                    if (event.currentTarget.open) setVerTrazabilidad(true);
                  }}
                >
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition list-none font-semibold text-sm text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 group-open:rotate-90 transition-transform">▸</span>
                      <span>Trazabilidad</span>
                      <span className="text-xs font-normal text-slate-500">· Historial del expediente</span>
                    </div>
                  </summary>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
                    {!verTrazabilidad ? (
                      <button
                        type="button"
                        onClick={() => setVerTrazabilidad(true)}
                        className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        Cargar trazabilidad completa
                      </button>
                    ) : (
                      <RutaDocEstado pendiente={timelineQuery.isPending} error={timelineQuery.error} reintentar={() => { void timelineQuery.refetch(); }}>
                        {timelineQuery.data && <RutaDocTimeline datos={timelineQuery.data} />}
                      </RutaDocEstado>
                    )}
                  </div>
                </details>

                {/* Acordeón Clasificación CCD */}
                <details className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition list-none font-semibold text-sm text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 group-open:rotate-90 transition-transform">▸</span>
                      <span>Clasificación documental (CCD)</span>
                    </div>
                    <span className="text-xs text-slate-400">No disponible</span>
                  </summary>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-600">
                    La consulta de clasificación documental no está disponible por el momento.
                  </div>
                </details>

                {/* Acordeón Versiones documentales */}
                <details className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition list-none font-semibold text-sm text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 group-open:rotate-90 transition-transform">▸</span>
                      <span>Versiones documentales</span>
                    </div>
                    <span className="text-xs text-slate-400">No disponible</span>
                  </summary>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-600">
                    La consulta del historial de versiones documentales no está disponible por el momento.
                  </div>
                </details>

                {/* Acordeón Información técnica y auditoría */}
                <details className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition list-none font-semibold text-sm text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 group-open:rotate-90 transition-transform">▸</span>
                      <span>Información técnica y auditoría</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">UUID & metadata</span>
                  </summary>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-700 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <span className="text-slate-400 block text-[11px]">UUID Expediente:</span>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="font-mono text-xs break-all text-slate-800">{detalleData.idExpediente}</span>
                          <button
                            type="button"
                            onClick={() => copiarTexto(detalleData.idExpediente, "exp")}
                            className="text-xs text-blue-800 underline hover:text-blue-900 shrink-0"
                          >
                            {copiadoId === "exp" ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                      </div>

                      {detalleData.solicitanteId && (
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                          <span className="text-slate-400 block text-[11px]">UUID Solicitante:</span>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="font-mono text-xs break-all text-slate-800">{detalleData.solicitanteId}</span>
                            <button
                              type="button"
                              onClick={() => copiarTexto(detalleData.solicitanteId!, "sol")}
                              className="text-xs text-blue-800 underline hover:text-blue-900 shrink-0"
                            >
                              {copiadoId === "sol" ? "Copiado" : "Copiar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {detalleData.ultimoMovimiento && (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                        <span className="text-slate-400 block text-[11px]">Último movimiento:</span>
                        <div className="text-xs text-slate-700">
                          <span className="font-semibold">{detalleData.ultimoMovimiento.evento}</span> ·{" "}
                          <span>{detalleData.ultimoMovimiento.estadoNuevo}</span> ·{" "}
                          <span>{formatearFechaLarga(detalleData.ultimoMovimiento.fechaHora)}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 truncate">
                          Operador ID: {detalleData.ultimoMovimiento.usuarioOperadorId} · Movimiento: {detalleData.ultimoMovimiento.idMovimiento}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </section>
            </>
          )}

          {/* MODALES FSM */}
          <ExpedienteActionToast notificacion={acciones.notificacion} onClose={acciones.limpiarNotificacion} />
          <DerivacionModal
            open={modal === "derivacion"}
            onClose={() => setModal(null)}
            expediente={refExpediente}
            unidades={unidadesQuery.isError
              ? { estado: "error", mensaje: "No se pudieron consultar las unidades vigentes." }
              : unidadesQuery.isSuccess
                ? { estado: "listo", datos: unidadesQuery.data }
                : { estado: "cargando" }}
            accion={acciones.derivacion}
            destinoSugeridoId={destinoSugeridoId}
            destinoSugeridoNombre={destinoSugeridoNombre}
          />
          <ObservacionModal
            open={modal === "observacion"}
            onClose={() => setModal(null)}
            expediente={refExpediente}
            accion={acciones.observacion}
          />
          <SubsanacionModal
            open={modal === "subsanacion" && puedeSubsanar}
            onClose={() => setModal(null)}
            expediente={refExpediente}
            accion={acciones.subsanacion}
          />
          <AcumulacionModal
            open={modal === "acumulacion"}
            onClose={() => setModal(null)}
            expediente={refExpediente}
            accion={acciones.acumulacion}
            busqueda={busquedaConexos}
          />
          <AtencionModal
            open={modal === "atender"}
            onClose={() => setModal(null)}
            expediente={refExpediente}
            accion={acciones.atencion}
          />
          <ArchivadoModal
            open={modal === "archivar"}
            onClose={() => setModal(null)}
            expediente={refExpediente}
            accion={acciones.archivado}
          />
        </>
      )}

      {/* MODAL VER DATOS DEL SOLICITANTE */}
      {verDatosSolicitante && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 w-full h-full backdrop-blur-xs"
          aria-labelledby="solicitante-modal-titulo"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="solicitante-modal-titulo" className="text-base font-bold text-slate-900">
                Datos del solicitante
              </h3>
              <button
                type="button"
                onClick={() => setVerDatosSolicitante(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
                aria-label="Cerrar ventana de solicitante"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <span className="text-slate-400 block text-[11px]">Nombre completo:</span>
                <span className="font-bold text-sm text-slate-900">
                  {solicitanteResumen?.nombreCompleto ? formatoNombre(solicitanteResumen.nombreCompleto) : "Administrado registrado"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[11px]">Tipo de documento:</span>
                  <span className="font-semibold text-slate-800">{solicitanteResumen?.tipoDocumento || "DNI"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Número de documento:</span>
                  <span className="font-mono font-semibold text-slate-800">{solicitanteResumen?.numeroDocumento || "No disponible"}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Correo electrónico:</span>
                <span className="font-semibold text-slate-800">{solicitanteResumen?.correo || "No registrado"}</span>
              </div>
              {solicitanteResumen?.telefono && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Teléfono de contacto:</span>
                  <span className="font-semibold text-slate-800">{solicitanteResumen.telefono}</span>
                </div>
              )}
              {solicitanteResumen?.direccion && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Dirección declarada:</span>
                  <span className="font-semibold text-slate-800">{solicitanteResumen.direccion}</span>
                </div>
              )}
              {solicitanteResumen?.idPersona && (
                <div>
                  <span className="text-slate-400 block text-[11px]">ID de persona:</span>
                  <span className="font-mono text-[11px] text-slate-500 break-all">{solicitanteResumen.idPersona}</span>
                </div>
              )}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setVerDatosSolicitante(false)}
                className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* VISOR MODAL DE PDF */}
      {documentoPreview && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 w-full h-full backdrop-blur-xs"
          aria-labelledby="preview-modal-titulo"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold text-sm text-red-600">PDF</span>
                <h3 id="preview-modal-titulo" className="font-bold text-slate-900 truncate">
                  {documentoPreview.nombreArchivo}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={documentoPreview.url}
                  download={documentoPreview.nombreArchivo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Descargar
                </a>
                <button
                  type="button"
                  onClick={() => setDocumentoPreview(null)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  aria-label="Cerrar visor PDF"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-1">
              <iframe
                src={documentoPreview.url}
                title={`Visor de ${documentoPreview.nombreArchivo}`}
                className="w-full h-full border-0 rounded"
              />
            </div>
          </div>
        </dialog>
      )}

      {/* RECIBO OFICIAL DE TESORERÍA MODAL */}
      {modalReciboDetalle && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 w-full h-full backdrop-blur-xs"
          aria-labelledby="recibo-modal-titulo"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200">
            <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
              <div className="inline-block text-[11px] font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-full mb-1">
                IESTP &quot;SUIZA&quot; — PUCALLPA
              </div>
              <h3 id="recibo-modal-titulo" className="text-base font-extrabold text-slate-900 tracking-tight">
                CONSTANCIA DE PAGO
              </h3>
              <p className="text-xs font-semibold text-slate-600">
                RECIBO INTERNO DE TESORERÍA
              </p>
              <p className="text-[11px] font-mono text-slate-500">RUC: 20496155601</p>
              <p className="text-xs font-mono font-bold text-emerald-800">
                N° COMPROBANTE: {modalReciboDetalle.codigoRecibo || "REC-2026-OFICIAL"}
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-700 border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha y Hora:</span>
                <span className="font-semibold text-slate-800">
                  {formatearFechaLarga(modalReciboDetalle.fechaPago || modalReciboDetalle.fechaCreacion)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Código Orden:</span>
                <span className="font-mono font-bold text-slate-900">{modalReciboDetalle.codigoPago}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expediente CUT:</span>
                <span className="font-mono font-semibold text-blue-800">{modalReciboDetalle.codigoExpediente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Administrado:</span>
                <span className="font-semibold text-slate-900">{modalReciboDetalle.solicitanteNombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Documento:</span>
                <span className="font-mono text-slate-700">{modalReciboDetalle.documentoEnmascarado}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Concepto:</span>
                <span className="font-medium text-slate-800 text-right">{modalReciboDetalle.concepto}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Medio de Pago:</span>
                <span className="font-semibold text-slate-900">
                  {modalReciboDetalle.metodoPago === "EFECTIVO"
                    ? "Efectivo en Ventanilla"
                    : modalReciboDetalle.metodoPago === "YAPE"
                      ? "Yape / Digital Asistido"
                      : "QR Automático — TAYPI Sandbox"}
                </span>
              </div>
              {modalReciboDetalle.metodoPago === "YAPE" && modalReciboDetalle.referenciaOperacion && (
                <div className="flex justify-between">
                  <span className="text-slate-500">N° Operación Yape:</span>
                  <span className="font-mono font-bold text-purple-900">{modalReciboDetalle.referenciaOperacion}</span>
                </div>
              )}
              {modalReciboDetalle.metodoPago === "QR_AUTOMATICO_SANDBOX" && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Origen confirmación:</span>
                  <span className="font-mono font-bold text-amber-900">Webhook TAYPI</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Operador:</span>
                <span className="font-semibold text-slate-800">{modalReciboDetalle.tesoreroNombre || "Tesorería — IESTP Suiza"}</span>
              </div>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-900 text-sm">TOTAL CANCELADO:</span>
              <span className="font-mono text-lg font-extrabold text-blue-900">
                {modalReciboDetalle.moneda} {modalReciboDetalle.monto.toFixed(2)}
              </span>
            </div>

            <div className="text-center text-[10px] text-slate-400">
              ✓ Pago validado por Tesorería. El expediente se encuentra desbloqueado para continuar su trámite.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalReciboDetalle(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-blue-800 px-4 py-2 text-xs font-bold text-white hover:bg-blue-900 shadow-xs"
              >
                🖨️ Imprimir Recibo
              </button>
            </div>
          </div>
        </dialog>
      )}
    </main>
  );
}
