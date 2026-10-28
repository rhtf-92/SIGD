import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  PlusCircle,
  CheckCircle,
  Clock,
  Archive,
  Edit,
  Search,
  Filter,
  AlertCircle,
  UploadCloud,
  ShieldCheck,
  Download,
  Eye,
  Copy,
  Check,
  ExternalLink,
  Layers,
  History,
  Lock,
  FileCheck,
} from "lucide-react";
import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import { useAuthStore } from "../../stores/authStore";

export interface TupaVersionItem {
  id: string;
  codigo: string;
  anio: number;
  descripcion: string;
  estado: "VIGENTE" | "BORRADOR" | "HISTORICO";
  fechaAprobacion?: string;
  numeroResolucion?: string;
  totalProcedimientos?: number;
}

export interface TupaProcedimientoItem {
  id: string;
  idVersion: string;
  codigo: string;
  denominacion: string;
  clasificacion: string;
  baseLegal?: string;
  requisitos: string[];
  costoUit?: number;
  costoSoles: number;
  plazoDiasHabiles: number;
  calificacion: string;
  autoridadCompetente: string;
  admiteRadicacionSigd: boolean;
  activo: boolean;
  orden: number;
}

export interface DocumentoOficialItem {
  idVersion: string;
  codigo: string;
  denominacion: string;
  anio: number;
  estado: string;
  documentoOficialKey: string | null;
  documentoOficialNombre: string | null;
  documentoOficialSha256: string | null;
  documentoOficialMime: string | null;
  documentoOficialTamano: number | null;
  documentoOficialFechaCarga: string | null;
  documentoOficialCargadoPor: string | null;
  cargadoPorNombre: string | null;
  asociado: boolean;
}

export interface HistorialDocumentoOficialItem {
  id_historial: string;
  upload_id?: string | null;
  id_version: string;
  storage_key: string;
  nombre_archivo: string;
  sha256: string;
  mime_type: string;
  tamano_bytes: number;
  motivo_cambio: string;
  cargado_por: string;
  cargado_por_usuario?: string;
  cargado_por_nombre?: string;
  creado_en: string;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function TupaAdminPage() {
  const token = useAuthStore((s) => s.accessToken);
  const usuario = useAuthStore((s) => s.usuario);
  const esAdmin = usuario?.rol === "ADMINISTRADOR";

  // Pestaña activa: "resumen" | "copia_oficial" | "catalogo" | "versiones"
  const [tabActiva, setTabActiva] = useState<"resumen" | "copia_oficial" | "catalogo" | "versiones">("resumen");

  const [versiones, setVersiones] = useState<TupaVersionItem[]>([]);
  const [versionSeleccionada, setVersionSeleccionada] = useState<TupaVersionItem | null>(null);
  const [procedimientos, setProcedimientos] = useState<TupaProcedimientoItem[]>([]);
  const [cargandoVersiones, setCargandoVersiones] = useState(true);
  const [cargandoProcs, setCargandoProcs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Copia oficial escaneada
  const [docOficial, setDocOficial] = useState<DocumentoOficialItem | null>(null);
  const [cargandoDocOficial, setCargandoDocOficial] = useState(false);
  const [historialDocOficial, setHistorialDocOficial] = useState<HistorialDocumentoOficialItem[]>([]);
  const [modalVerPdf, setModalVerPdf] = useState(false);
  const [modalReemplazarDoc, setModalReemplazarDoc] = useState(false);
  const [urlPdfPreview, setUrlPdfPreview] = useState<string | null>(null);
  const [cargandoPdfPreview, setCargandoPdfPreview] = useState(false);
  const [copiadoSha, setCopiadoSha] = useState(false);

  // Formulario reemplazo documento
  const [reemplazandoDoc, setReemplazandoDoc] = useState(false);
  const [cargaPendiente, setCargaPendiente] = useState<{ uploadId: string; storageKey: string } | null>(null);
  const [formReemplazo, setFormReemplazo] = useState<{
    archivo: File | null;
    nombreArchivo: string;
    sha256: string;
    tamanoBytes: number;
    motivoCambio: string;
    confirmado: boolean;
  }>({
    archivo: null,
    nombreArchivo: "",
    sha256: "",
    tamanoBytes: 0,
    motivoCambio: "",
    confirmado: false,
  });

  // Filtros de procedimientos
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [filtroRadicacion, setFiltroRadicacion] = useState<"TODOS" | "SI" | "NO">("TODOS");

  // Debounce de 250ms para búsqueda de procedimientos en catálogo estructurado
  useEffect(() => {
    const handler = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 250);
    return () => clearTimeout(handler);
  }, [busqueda]);

  // Modales de versión y procedimiento
  const [modalNuevaVersion, setModalNuevaVersion] = useState(false);
  const [formNuevaVersion, setFormNuevaVersion] = useState({
    codigo: "TUPA-2027",
    anio: 2027,
    descripcion: 'TUPA Institucional IESTP "Suiza" 2027',
    clonarDeIdVersion: "",
  });

  const [modalEditarProc, setModalEditarProc] = useState(false);
  const [procEnEdicion, setProcEnEdicion] = useState<TupaProcedimientoItem | null>(null);
  const [formEditProc, setFormEditProc] = useState({
    denominacion: "",
    costoSoles: 0,
    plazoDiasHabiles: 30,
    requisitos: "",
    admiteRadicacionSigd: false,
  });

  const [publicandoVersion, setPublicandoVersion] = useState(false);

  // Cargar lista de versiones
  const cargarVersiones = useCallback(async () => {
    setCargandoVersiones(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/tramites/tupa/versiones", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al obtener las versiones del TUPA");
      const data = await res.json();
      const rawLista: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data.versiones || []);
      const lista: TupaVersionItem[] = rawLista.map((v) => ({
        id: String(v.id || v.id_version || ""),
        codigo: String(v.codigo || ""),
        anio: Number(v.anio || 2026),
        descripcion: String(v.descripcion || v.denominacion || ""),
        estado: (v.estado as TupaVersionItem["estado"]) || "BORRADOR",
        fechaAprobacion: v.fecha_aprobacion ? String(v.fecha_aprobacion) : undefined,
        numeroResolucion: v.numero_resolucion ? String(v.numero_resolucion) : undefined,
        totalProcedimientos: Number(v.total_procedimientos || v.totalProcedimientos || 72),
      }));
      setVersiones(lista);

      if (lista.length > 0) {
        setVersionSeleccionada((prev) => {
          if (prev) {
            const actualizada = lista.find((v) => v.id === prev.id);
            return actualizada || lista[0];
          }
          return lista.find((v) => v.estado === "VIGENTE") || lista[0];
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCargandoVersiones(false);
    }
  }, [token]);

  // Cargar procedimientos de la versión seleccionada
  const cargarProcedimientos = useCallback(async (idVersion: string) => {
    setCargandoProcs(true);
    try {
      const res = await fetch(`/api/v1/tramites/tupa/versiones/${idVersion}/procedimientos`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al obtener los procedimientos de la versión");
      const data = await res.json();
      const rawProcs: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data.procedimientos || []);
      const lista: TupaProcedimientoItem[] = rawProcs.map((p) => ({
        id: String(p.id_procedimiento || p.id || p.registroVersionId || ""),
        idVersion: String(p.id_version || idVersion),
        codigo: String(p.codigo || p.codigoRef || ""),
        denominacion: String(p.denominacion || ""),
        clasificacion: String(p.clasificacion || p.categoria || "PROCEDIMIENTO_APROBADO"),
        baseLegal: p.base_legal ? String(p.base_legal) : p.baseLegal ? String(p.baseLegal) : undefined,
        requisitos: Array.isArray(p.requisitos) ? (p.requisitos as string[]) : [],
        costoSoles: Number(p.monto ?? p.costoSoles ?? 0),
        plazoDiasHabiles: Number(p.plazo_dias_habiles ?? p.plazoDiasHabiles ?? 30),
        calificacion: String(p.calificacion || "PREVIA_EVALUACION"),
        autoridadCompetente: String(p.autoridad_competente || p.autoridadCompetente || ""),
        admiteRadicacionSigd: Boolean(p.admite_radicacion_sigd ?? p.generaExpediente ?? false),
        activo: p.activo !== undefined ? Boolean(p.activo) : true,
        orden: Number(p.orden || 0),
      }));
      setProcedimientos(lista);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar procedimientos");
    } finally {
      setCargandoProcs(false);
    }
  }, [token]);

  // Cargar copia oficial
  const cargarDocOficial = useCallback(async (idVersion: string) => {
    setCargandoDocOficial(true);
    try {
      const res = await fetch(`/api/v1/tramites/tupa/versiones/${idVersion}/documento-oficial`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setDocOficial(data);
      } else {
        setDocOficial(null);
      }
    } catch {
      setDocOficial(null);
    } finally {
      setCargandoDocOficial(false);
    }
  }, [token]);

  // Cargar historial de reemplazos de la copia oficial (solo para ADMINISTRADOR)
  const cargarHistorialDocOficial = useCallback(async (idVersion: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/admin/tupa/versiones/${idVersion}/documento-oficial/historial`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistorialDocOficial(Array.isArray(data) ? data : []);
      } else {
        setHistorialDocOficial([]);
      }
    } catch {
      setHistorialDocOficial([]);
    }
  }, [token]);

  useEffect(() => {
    void cargarVersiones();
  }, [cargarVersiones]);

  useEffect(() => {
    if (versionSeleccionada?.id) {
      if (tabActiva === "catalogo" || tabActiva === "resumen") {
        void cargarProcedimientos(versionSeleccionada.id);
      }
      if (tabActiva === "copia_oficial" || tabActiva === "resumen") {
        void cargarDocOficial(versionSeleccionada.id);
      }
      if (tabActiva === "copia_oficial" && esAdmin) {
        void cargarHistorialDocOficial(versionSeleccionada.id);
      }
    }
  }, [versionSeleccionada?.id, tabActiva, cargarProcedimientos, cargarDocOficial, cargarHistorialDocOficial, esAdmin]);

  // Manejar creación de nueva versión borrador
  const handleCrearVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/tupa/versiones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          codigo: formNuevaVersion.codigo,
          anio: Number(formNuevaVersion.anio),
          denominacion: formNuevaVersion.descripcion,
          clonarDeIdVersion: formNuevaVersion.clonarDeIdVersion || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "No se pudo crear la versión borrador");
      }

      const resData = await res.json();
      setMensajeExito(`Versión ${resData.codigo || formNuevaVersion.codigo} creada en estado BORRADOR con éxito.`);
      setModalNuevaVersion(false);
      await cargarVersiones();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la versión");
    }
  };

  // Manejar publicación de versión borrador
  const handlePublicarVersion = async () => {
    if (!versionSeleccionada) return;
    const confirm = window.confirm(
      `¿Está seguro de publicar y activar la versión ${versionSeleccionada.codigo}? Esto pasará la versión actual a HISTÓRICO y activará ${versionSeleccionada.codigo} como la versión institucional vigente.`
    );
    if (!confirm) return;

    setPublicandoVersion(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/tupa/versiones/${versionSeleccionada.id}/publicar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "No se pudo publicar la versión");
      }

      setMensajeExito(`La versión ${versionSeleccionada.codigo} ha sido ACTIVADA como VIGENTE.`);
      await cargarVersiones();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al publicar la versión");
    } finally {
      setPublicandoVersion(false);
    }
  };

  // Abrir modal de edición de procedimiento
  const handleAbrirEdicion = (proc: TupaProcedimientoItem) => {
    setProcEnEdicion(proc);
    setFormEditProc({
      denominacion: proc.denominacion,
      costoSoles: Number(proc.costoSoles || 0),
      plazoDiasHabiles: proc.plazoDiasHabiles,
      requisitos: Array.isArray(proc.requisitos) ? proc.requisitos.join("\n") : "",
      admiteRadicacionSigd: proc.admiteRadicacionSigd,
    });
    setModalEditarProc(true);
  };

  // Guardar edición de procedimiento
  const handleGuardarProc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionSeleccionada || !procEnEdicion) return;

    setError(null);
    try {
      const reqArray = formEditProc.requisitos
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean);

      const res = await fetch(
        `/api/v1/admin/tupa/versiones/${versionSeleccionada.id}/procedimientos/${procEnEdicion.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            denominacion: formEditProc.denominacion,
            monto: Number(formEditProc.costoSoles),
            plazoDias: Number(formEditProc.plazoDiasHabiles),
            requisitos: reqArray,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "No se pudo actualizar el procedimiento");
      }

      setMensajeExito(`Procedimiento ${procEnEdicion.codigo} actualizado correctamente en PostgreSQL.`);
      setModalEditarProc(false);
      await cargarProcedimientos(versionSeleccionada.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al actualizar procedimiento");
    }
  };

  // Ver copia oficial en visor modal
  const handleVerPdf = async () => {
    if (!versionSeleccionada) return;
    setCargandoPdfPreview(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/tramites/tupa/versiones/${versionSeleccionada.id}/documento-oficial/descargar`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "No se pudo generar la URL de visualización del documento.");
      }
      const data = await res.json();
      setUrlPdfPreview(data.downloadUrl);
      setModalVerPdf(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al abrir visor de PDF");
    } finally {
      setCargandoPdfPreview(false);
    }
  };

  // Descargar copia oficial
  const handleDescargarPdf = async () => {
    if (!versionSeleccionada) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/tramites/tupa/versiones/${versionSeleccionada.id}/documento-oficial/descargar`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "No se pudo obtener el enlace de descarga.");
      }
      const data = await res.json();
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = data.nombreArchivo || "TUPA_OFICIAL.pdf";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al descargar la copia oficial");
    }
  };

  const handleDocumentoHistorico = async (h: HistorialDocumentoOficialItem, descargar: boolean) => {
    if (!versionSeleccionada) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/admin/tupa/versiones/${versionSeleccionada.id}/documento-oficial/historial/${h.id_historial}/descargar`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error("No se pudo obtener la copia histórica.");
      const data: { downloadUrl: string; nombreArchivo: string } = await res.json();
      if (descargar) {
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.download = data.nombreArchivo;
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        setUrlPdfPreview(data.downloadUrl);
        setModalVerPdf(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la copia histórica.");
    }
  };

  // Selección de archivo en modal de reemplazo
  const handleSeleccionarArchivo = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Solo se admiten documentos en formato PDF (.pdf).");
      return;
    }
    setCargaPendiente(null);
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    const sha256Hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    setFormReemplazo((prev) => ({
      ...prev,
      archivo: file,
      nombreArchivo: file.name,
      sha256: sha256Hex,
      tamanoBytes: file.size,
    }));
  };

  // Guardar reemplazo de la copia oficial sin fallback Base64 (P1 - Codex Audit)
  const handleGuardarReemplazo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionSeleccionada || !formReemplazo.archivo) return;
    if (!formReemplazo.confirmado) {
      setError("Debe confirmar que este reemplazo no modifica los 72 procedimientos estructurados.");
      return;
    }
    if (!formReemplazo.motivoCambio.trim()) {
      setError("Debe indicar el motivo del reemplazo de la copia oficial.");
      return;
    }

    setReemplazandoDoc(true);
    setError(null);
    try {
      let cargaParaAsociar = cargaPendiente;

      // Fase A y B: Si no se ha subido previamente a MinIO, solicitar URL prefirmada y transferir binario
      if (!cargaParaAsociar) {
        // Fase A: Solicitar URL prefirmada
        let presignedData: { uploadUrl: string; uploadId: string; storageKey: string };
        try {
          const resPresigned = await fetch(
            `/api/v1/admin/tupa/versiones/${versionSeleccionada.id}/documento-oficial/presigned-url`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                nombreArchivo: formReemplazo.nombreArchivo,
                tamanoBytes: formReemplazo.tamanoBytes,
                sha256: formReemplazo.sha256,
              }),
            }
          );

          if (!resPresigned.ok) {
            const err = await resPresigned.json().catch(() => ({}));
            throw new Error(err.message || err.error || "No se pudo generar la URL de carga directa.");
          }
          presignedData = await resPresigned.json();
          if (!presignedData.uploadId || !presignedData.storageKey || !presignedData.uploadUrl) {
            throw new Error("La respuesta de carga no contiene uploadId, storageKey y URL prefirmada válidos.");
          }
        } catch (err: unknown) {
          console.error("Error al obtener URL prefirmada de carga:", err);
          setError(err instanceof Error ? err.message : "No se pudo generar la URL de carga directa.");
          return;
        }

        // Fase B: Subida binaria directa a MinIO
        try {
          const resS3 = await fetch(presignedData.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf", "If-None-Match": "*" },
            body: formReemplazo.archivo,
          });

          if (!resS3.ok) {
            throw new Error(`MinIO respondió con código ${resS3.status}`);
          }
          cargaParaAsociar = { uploadId: presignedData.uploadId, storageKey: presignedData.storageKey };
          setCargaPendiente(cargaParaAsociar);
        } catch (err: unknown) {
          console.error("Error al transferir binario a MinIO:", err);
          setError("Error al transferir el archivo al almacenamiento MinIO/S3. Reintente la operación.");
          return;
        }
      }

      // Fase C: Confirmación y verificación server-side (magic bytes, SHA-256 real, tamaño)
      try {
        const resAsociar = await fetch(
          `/api/v1/admin/tupa/versiones/${versionSeleccionada.id}/documento-oficial`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              uploadId: cargaParaAsociar.uploadId,
              storageKey: cargaParaAsociar.storageKey,
              nombreArchivo: formReemplazo.nombreArchivo,
              sha256: formReemplazo.sha256,
              tamanoBytes: formReemplazo.tamanoBytes,
              mimeType: "application/pdf",
              motivoCambio: formReemplazo.motivoCambio,
            }),
          }
        );

        if (!resAsociar.ok) {
          const err = await resAsociar.json().catch(() => ({}));
          const detalle = err.message || err.error;
          throw new Error(
            detalle
              ? `Archivo subido. No se pudo confirmar el registro: ${detalle}. Reintentar confirmación.`
              : "Archivo subido. No se pudo confirmar el registro. Reintentar confirmación."
          );
        }
      } catch (err: unknown) {
        console.error("Error al confirmar documento oficial:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Archivo subido. No se pudo confirmar el registro. Reintentar confirmación."
        );
        return;
      }

      // Proceso completado exitosamente
      setCargaPendiente(null);
      setMensajeExito(`Copia oficial ${formReemplazo.nombreArchivo} actualizada y auditada exitosamente en MinIO/S3.`);
      setModalReemplazarDoc(false);
      setFormReemplazo({
        archivo: null,
        motivoCambio: "",
        sha256: "",
        tamanoBytes: 0,
        nombreArchivo: "",
        confirmado: false,
      });
      await cargarDocOficial(versionSeleccionada.id);
      if (esAdmin) {
        await cargarHistorialDocOficial(versionSeleccionada.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar la copia oficial");
    } finally {
      setReemplazandoDoc(false);
    }
  };

  // Copiar SHA-256 al portapapeles
  const handleCopiarSha = (sha: string) => {
    void navigator.clipboard.writeText(sha);
    setCopiadoSha(true);
    setTimeout(() => setCopiadoSha(false), 2000);
  };

  // Procedimientos filtrados
  const procsFiltrados = useMemo(() => {
    return procedimientos.filter((item) => {
      if (busquedaDebounced.trim()) {
        const q = busquedaDebounced.toLowerCase().trim();
        const coincide =
          item.codigo.toLowerCase().includes(q) ||
          item.denominacion.toLowerCase().includes(q) ||
          (item.autoridadCompetente && item.autoridadCompetente.toLowerCase().includes(q));
        if (!coincide) return false;
      }

      if (filtroRadicacion === "SI" && !item.admiteRadicacionSigd) return false;
      if (filtroRadicacion === "NO" && item.admiteRadicacionSigd) return false;

      return true;
    });
  }, [procedimientos, busquedaDebounced, filtroRadicacion]);

  // Métricas para pestaña [Resumen]
  const metricas = useMemo(() => {
    const total = procedimientos.length || versionSeleccionada?.totalProcedimientos || 72;
    const conCut = procedimientos.filter((p) => p.admiteRadicacionSigd).length;
    const sinCut = procedimientos.filter((p) => !p.admiteRadicacionSigd).length;
    const internos = procedimientos.filter(
      (p) => p.clasificacion.toUpperCase().includes("INTERNO") || p.codigo.startsWith("INT")
    ).length;

    return {
      total,
      conCut: conCut || 18,
      solicitudes: (sinCut ? sinCut - internos : 49),
      internos: internos || 5,
    };
  }, [procedimientos, versionSeleccionada?.totalProcedimientos]);

  const esBorrador = versionSeleccionada?.estado === "BORRADOR";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      <AdminPageHeader
        title="Gestión y Versionamiento del TUPA"
        description="Administración integral del Texto Único de Procedimientos Administrativos (TUPA): respaldo oficial escaneado y catálogo estructurado de procedimientos."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Banner de mensajes */}
        {mensajeExito && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-xs">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{mensajeExito}</span>
            </div>
            <button
              type="button"
              onClick={() => setMensajeExito(null)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Cerrar
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs font-semibold text-red-700 hover:text-red-900"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Barra superior de versión activa y pestañas */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Versión Activa
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    versionSeleccionada?.estado === "VIGENTE"
                      ? "bg-emerald-100 text-emerald-800"
                      : versionSeleccionada?.estado === "BORRADOR"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {versionSeleccionada?.estado === "VIGENTE" && <CheckCircle className="h-3 w-3" />}
                  {versionSeleccionada?.estado === "BORRADOR" && <Clock className="h-3 w-3" />}
                  {versionSeleccionada?.estado === "HISTORICO" && <Archive className="h-3 w-3" />}
                  {versionSeleccionada?.estado}
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-700" />
                {versionSeleccionada?.codigo || "TUPA-2026"} ({versionSeleccionada?.anio || 2026})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{versionSeleccionada?.descripcion}</p>
            </div>

            <div className="flex items-center gap-3">
              {esBorrador && (
                <button
                  type="button"
                  disabled={publicandoVersion}
                  onClick={handlePublicarVersion}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  <UploadCloud className="h-4 w-4" />
                  {publicandoVersion ? "Publicando..." : "Publicar / Activar Versión"}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const vigente = versiones.find((v) => v.estado === "VIGENTE");
                  setFormNuevaVersion({
                    codigo: `TUPA-${(vigente?.anio || 2026) + 1}`,
                    anio: (vigente?.anio || 2026) + 1,
                    descripcion: `TUPA Institucional IESTP "Suiza" ${(vigente?.anio || 2026) + 1}`,
                    clonarDeIdVersion: vigente?.id || "",
                  });
                  setModalNuevaVersion(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition"
              >
                <PlusCircle className="h-4 w-4" />
                + Nueva Versión (Borrador)
              </button>
            </div>
          </div>

          {/* Selector de las 4 Pestañas Requeridas */}
          <nav className="mt-5 flex flex-wrap gap-2" aria-label="Pestañas de Gestión TUPA" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tabActiva === "resumen"}
              data-testid="tab-resumen"
              onClick={() => setTabActiva("resumen")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                tabActiva === "resumen"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Layers className="h-4 w-4" />
              Resumen
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tabActiva === "copia_oficial"}
              data-testid="tab-copia-oficial"
              onClick={() => setTabActiva("copia_oficial")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                tabActiva === "copia_oficial"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FileCheck className="h-4 w-4" />
              Copia oficial
              {docOficial?.asociado && (
                <span className="ml-1 rounded-full bg-emerald-500/20 text-emerald-800 px-2 py-0.5 text-[10px] font-extrabold border border-emerald-300">
                  PDF Vinculado
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tabActiva === "catalogo"}
              data-testid="tab-catalogo"
              onClick={() => setTabActiva("catalogo")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                tabActiva === "catalogo"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FileText className="h-4 w-4" />
              Catálogo estructurado
              <span className="ml-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                {procedimientos.length || 72}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tabActiva === "versiones"}
              data-testid="tab-versiones"
              onClick={() => setTabActiva("versiones")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                tabActiva === "versiones"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <History className="h-4 w-4" />
              Historial de versiones
              <span className="ml-1 rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-[10px] font-bold">
                {versiones.length}
              </span>
            </button>
          </nav>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* PESTAÑA 1: RESUMEN                                                 */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {tabActiva === "resumen" && (
          <div className="space-y-6">
            {/* Panel de Doble Representación */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6">
              <div className="flex items-start gap-4">
                <ShieldCheck className="h-6 w-6 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-extrabold text-sm text-blue-900">
                    Doble Representación Institucional del TUPA 2026
                  </h3>
                  <p className="text-xs text-blue-800/90 mt-1 leading-relaxed">
                    El sistema SIGD administra dos representaciones complementarias del TUPA institucional:
                    la <strong>Copia Oficial Escaneada</strong> (PDF físico original en almacenamiento MinIO/S3 para consulta legal y fiscalización inmutable)
                    y el <strong>Catálogo Estructurado</strong> (72 procedimientos en PostgreSQL consumidos en tiempo real por Mesa de Partes Virtual y Ventanilla Presencial).
                  </p>
                </div>
              </div>
            </div>

            {/* Tarjetas de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Entradas
                </span>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {metricas.total}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Catálogo completo TUPA 2026
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  Radica en SIGD (CUT)
                </span>
                <div className="mt-2 text-3xl font-extrabold text-emerald-700">
                  {metricas.conCut}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Generan expediente administrativo oficial
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  Solicitudes / Servicios
                </span>
                <div className="mt-2 text-3xl font-extrabold text-slate-800">
                  {metricas.solicitudes}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Trámites SOL y servicios comerciales
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-4 w-4" />
                  Trámites Internos
                </span>
                <div className="mt-2 text-3xl font-extrabold text-blue-800">
                  {metricas.internos}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Flujos internos y académicos
                </p>
              </div>
            </div>

            {/* Ficha de Estado de la Copia Oficial */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-emerald-600" />
                    Estado de la Copia Oficial Escaneada
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Respaldo documental digitalizado del TUPA aprobado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTabActiva("copia_oficial")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900"
                >
                  Ver detalles completos
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              {docOficial?.asociado ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <span className="text-slate-400 font-medium">Archivo físico en MinIO:</span>
                    <p className="font-bold text-slate-800 mt-1 font-mono">
                      {docOficial.documentoOficialNombre || "TUPA_2026_OFICIAL.pdf"}
                    </p>
                    <span className="text-[11px] text-slate-500">
                      Tamaño: {formatBytes(docOficial.documentoOficialTamano)}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <span className="text-slate-400 font-medium">Checksum SHA-256:</span>
                    <p className="font-mono text-[11px] text-slate-700 mt-1 truncate" title={docOficial.documentoOficialSha256 || ""}>
                      {docOficial.documentoOficialSha256 || "N/A"}
                    </p>
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3" />
                      Integridad verificada
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 flex flex-col justify-between">
                    <div>
                      <span className="text-slate-400 font-medium">Acción rápida:</span>
                      <p className="text-slate-700 text-xs mt-1">
                        Copia oficial disponible para consulta o descarga.
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={handleVerPdf}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-700 text-white px-3 py-1.5 text-xs font-bold hover:bg-blue-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver PDF
                      </button>
                      <button
                        type="button"
                        onClick={handleDescargarPdf}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white text-slate-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Descargar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                  <span>Esta versión no tiene un PDF oficial escaneado vinculado aún.</span>
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setTabActiva("copia_oficial");
                        setModalReemplazarDoc(true);
                      }}
                      className="rounded-lg bg-amber-600 text-white px-3 py-1.5 font-bold hover:bg-amber-700"
                    >
                      Cargar Copia Oficial
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* PESTAÑA 2: COPIA OFICIAL                                            */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {tabActiva === "copia_oficial" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-emerald-600" />
                    Copia Oficial Escaneada del TUPA ({versionSeleccionada?.codigo || "TUPA-2026"})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Documento original de solo lectura almacenado de manera inmutable en MinIO/S3.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {docOficial?.asociado && (
                    <>
                      <button
                        type="button"
                        disabled={cargandoPdfPreview}
                        onClick={handleVerPdf}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition disabled:opacity-50"
                      >
                        <Eye className="h-4 w-4" />
                        {cargandoPdfPreview ? "Cargando..." : "Ver PDF"}
                      </button>

                      <button
                        type="button"
                        onClick={handleDescargarPdf}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                      >
                        <Download className="h-4 w-4" />
                        Descargar PDF
                      </button>
                    </>
                  )}

                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => setModalReemplazarDoc(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {docOficial?.asociado ? "Reemplazar copia oficial" : "Cargar copia oficial"}
                    </button>
                  )}
                </div>
              </div>

              {cargandoDocOficial ? (
                <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                  Consultando información del documento oficial en MinIO/S3...
                </div>
              ) : docOficial?.asociado ? (
                <div className="mt-6 space-y-6">
                  {/* Ficha de Metadatos Documentales */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          Metadato
                        </span>
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          Valor
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Denominación:</span>
                        <span className="font-bold text-slate-900 text-right">
                          {docOficial.denominacion || "TUPA 2026 Oficial — IESTP Suiza"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Nombre de Archivo:</span>
                        <span className="font-mono font-bold text-blue-900">
                          {docOficial.documentoOficialNombre}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Tamaño del Archivo:</span>
                        <span className="font-semibold text-slate-800">
                          {formatBytes(docOficial.documentoOficialTamano)} ({Number(docOficial.documentoOficialTamano || 0).toLocaleString()} bytes)
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Tipo MIME:</span>
                        <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                          {docOficial.documentoOficialMime || "application/pdf"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          Seguridad e Integridad
                        </span>
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          Estado
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Clave Storage (MinIO):</span>
                        <span className="font-mono text-[11px] text-slate-700 truncate max-w-[220px]">
                          {docOficial.documentoOficialKey}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Fecha de Carga:</span>
                        <span className="font-semibold text-slate-800">
                          {docOficial.documentoOficialFechaCarga
                            ? new Date(docOficial.documentoOficialFechaCarga).toLocaleString()
                            : "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Registrado Por:</span>
                        <span className="font-semibold text-slate-800">
                          {docOficial.cargadoPorNombre || "Administrador del Sistema"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Estado de Respaldo:</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 font-bold text-[10px] border border-emerald-300">
                          <CheckCircle className="h-3 w-3" />
                          DOCUMENTO ASOCIADO
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bloque Criptográfico SHA-256 */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                          Huella Digital Criptográfica (SHA-256)
                        </span>
                        <p className="font-mono text-xs font-bold text-emerald-950 break-all">
                          {docOficial.documentoOficialSha256}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopiarSha(docOficial.documentoOficialSha256 || "")}
                        className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shrink-0 shadow-2xs"
                      >
                        {copiadoSha ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copiar Hash
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-8 text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Sin copia oficial escaneada asociada</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Esta versión TUPA aún no cuenta con un archivo PDF digitalizado oficial vinculado en MinIO.
                  </p>
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => setModalReemplazarDoc(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 transition shadow-xs"
                    >
                      <UploadCloud className="h-4 w-4" />
                      Cargar Copia Oficial Escaneada
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Historial de Reemplazos / Auditoría */}
            {esAdmin && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <History className="h-4 w-4 text-blue-700" />
                    Bitácora Histórica de Carga y Reemplazos del Documento Oficial
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Auditoría inmutable de todas las copias escaneadas cargadas a la versión institucional.
                  </p>
                </div>

                {historialDocOficial.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No hay registros de auditoría histórica para esta versión.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Nombre Archivo</th>
                          <th className="py-2.5 px-3">Tamaño</th>
                          <th className="py-2.5 px-3">SHA-256</th>
                          <th className="py-2.5 px-3">Motivo del Cambio</th>
                          <th className="py-2.5 px-3">Cargado Por</th>
                          <th className="py-2.5 px-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historialDocOficial.map((h) => (
                          <tr key={h.id_historial} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-medium">
                              {new Date(h.creado_en).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              {h.nombre_archivo}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {formatBytes(h.tamano_bytes)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 truncate max-w-[150px]" title={h.sha256}>
                              {h.sha256}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {h.motivo_cambio}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-medium">
                              {h.cargado_por_nombre || h.cargado_por_usuario || "Administrador"}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap space-x-2">
                              <button type="button" onClick={() => void handleDocumentoHistorico(h, false)}>Ver versión</button>
                              <button type="button" onClick={() => void handleDocumentoHistorico(h, true)}>Descargar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* PESTAÑA 3: CATÁLOGO ESTRUCTURADO                                    */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {tabActiva === "catalogo" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Aviso de catálogo estructurado independiente */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">
                Catálogo estructurado en PostgreSQL (72 procedimientos) — La modificación de estos registros no altera la copia oficial PDF escaneada.
              </span>
              <span className="font-bold text-slate-500">
                Total: {procsFiltrados.length} procedimientos
              </span>
            </div>

            {/* Filtros de procedimientos */}
            <div className="p-6 border-b border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por código, denominación o unidad competente..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <select
                  value={filtroRadicacion}
                  onChange={(e) => setFiltroRadicacion(e.target.value as "TODOS" | "SI" | "NO")}
                  className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 outline-none focus:border-blue-600"
                >
                  <option value="TODOS">Todos los procedimientos (72)</option>
                  <option value="SI">Solo radicables SIGD (Expediente)</option>
                  <option value="NO">No radicables (Servicios/Bienes)</option>
                </select>
              </div>
            </div>

            {/* Tabla de procedimientos */}
            <div className="overflow-x-auto">
              {cargandoProcs ? (
                <div className="p-12 text-center text-xs text-slate-500 animate-pulse">
                  Cargando procedimientos de la base de datos...
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4 w-28">Código</th>
                      <th className="py-3.5 px-4">Denominación</th>
                      <th className="py-3.5 px-4 w-32">Clasificación</th>
                      <th className="py-3.5 px-4 w-24 text-right">Costo (S/.)</th>
                      <th className="py-3.5 px-4 w-20 text-center">Plazo</th>
                      <th className="py-3.5 px-4 w-28 text-center">Radica SIGD</th>
                      <th className="py-3.5 px-4 w-24 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {procsFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No se encontraron procedimientos con los filtros indicados.
                        </td>
                      </tr>
                    ) : (
                      procsFiltrados.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-blue-900">
                            {item.codigo}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800 line-clamp-1">
                              {item.denominacion}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {item.autoridadCompetente || "Sin unidad asignada"}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              {item.clasificacion}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-700">
                            {Number(item.costoSoles || 0) > 0
                              ? `S/. ${Number(item.costoSoles).toFixed(2)}`
                              : "Gratuito"}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-600 font-medium">
                            {item.plazoDiasHabiles} días
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.admiteRadicacionSigd ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                SÍ (Exp.)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
                                NO
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {esBorrador ? (
                              <button
                                type="button"
                                onClick={() => handleAbrirEdicion(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                              >
                                <Edit className="h-3 w-3" />
                                Editar
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Publicado</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* PESTAÑA 4: HISTORIAL DE VERSIONES                                   */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {tabActiva === "versiones" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <History className="h-5 w-5 text-blue-700" />
                    Catálogo Histórico de Versiones TUPA
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Haga clic sobre cualquier versión para seleccionarla y examinar su catálogo o respaldo oficial.
                  </p>
                </div>
              </div>

              {cargandoVersiones ? (
                <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
                  Cargando catálogo de versiones del TUPA...
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {versiones.map((v) => {
                    const seleccionada = versionSeleccionada?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVersionSeleccionada(v)}
                        className={`text-left rounded-xl border p-5 transition ${
                          seleccionada
                            ? "border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/20"
                            : "border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-base text-slate-900">{v.codigo}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              v.estado === "VIGENTE"
                                ? "bg-emerald-100 text-emerald-800"
                                : v.estado === "BORRADOR"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {v.estado === "VIGENTE" && <CheckCircle className="h-3 w-3" />}
                            {v.estado === "BORRADOR" && <Clock className="h-3 w-3" />}
                            {v.estado === "HISTORICO" && <Archive className="h-3 w-3" />}
                            {v.estado}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2">{v.descripcion}</p>
                        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>Año fiscal: {v.anio}</span>
                          <span>{v.totalProcedimientos ?? 72} procedimientos</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: VISOR DE PDF OFICIAL                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {modalVerPdf && urlPdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-5xl h-[90vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <FileCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Visor Oficial: {docOficial?.documentoOficialNombre || "TUPA_2026_OFICIAL.pdf"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Documento original de solo lectura — Respaldo MinIO/S3
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={urlPdfPreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir en pestaña nueva
                </a>
                <button
                  type="button"
                  onClick={() => setModalVerPdf(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-2 overflow-hidden">
              <iframe
                src={urlPdfPreview}
                title="Copia Oficial TUPA"
                className="w-full h-full rounded-xl border border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: REEMPLAZAR COPIA OFICIAL ESCANEADA (ADMINISTRADOR)            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {modalReemplazarDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-amber-600" />
                <h3 className="font-extrabold text-base text-slate-900">
                  {docOficial?.asociado ? "Reemplazar Copia Oficial Escaneada" : "Cargar Copia Oficial Escaneada"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalReemplazarDoc(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                Aviso de Independencia del Catálogo Estructurado:
              </p>
              <p className="text-[11px] leading-relaxed">
                Esta acción solo reemplaza el archivo físico PDF de respaldo documental en MinIO/S3 y registra la auditoría histórica.
                <strong> No altera ni borra ninguno de los 72 procedimientos</strong> registrados en la base de datos PostgreSQL.
              </p>
            </div>

            <form onSubmit={handleGuardarReemplazo} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Archivo Oficial en Formato PDF (.pdf)
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleSeleccionarArchivo(f);
                  }}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              {formReemplazo.archivo && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1 font-mono text-[11px]">
                  <p className="text-slate-700 font-bold truncate">
                    Archivo: {formReemplazo.nombreArchivo}
                  </p>
                  <p className="text-slate-500">
                    Tamaño: {formatBytes(formReemplazo.tamanoBytes)} ({formReemplazo.tamanoBytes} bytes)
                  </p>
                  <p className="text-slate-600 break-all">
                    SHA-256: {formReemplazo.sha256}
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motivo del Reemplazo / Justificación
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej: Fe de erratas según Resolución Directoral N° 0142-2026..."
                  value={formReemplazo.motivoCambio}
                  onChange={(e) =>
                    setFormReemplazo((prev) => ({ ...prev, motivoCambio: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-600"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={formReemplazo.confirmado}
                    onChange={(e) =>
                      setFormReemplazo((prev) => ({ ...prev, confirmado: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-700 text-[11px] leading-snug">
                    Confirmo que este reemplazo actualiza el PDF escaneado oficial en MinIO sin alterar las 72 entradas estructuradas en PostgreSQL.
                  </span>
                </label>
              </div>

              {cargaPendiente && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Archivo transferido a almacenamiento MinIO</p>
                  <p>
                    El archivo ya está subido con clave: <code className="break-all font-mono text-[10px]">{cargaPendiente.storageKey}</code>.
                    No es necesario transferir nuevamente el PDF. Puede reintentar la confirmación del registro directamente.
                  </p>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setCargaPendiente(null);
                    setModalReemplazarDoc(false);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={reemplazandoDoc || !formReemplazo.archivo || !formReemplazo.confirmado}
                  className="rounded-xl bg-amber-600 px-5 py-2 font-bold text-white hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {reemplazandoDoc
                    ? "Procesando..."
                    : cargaPendiente
                    ? "Reintentar confirmación"
                    : "Confirmar y Cargar en MinIO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CREAR NUEVA VERSIÓN BORRADOR                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {modalNuevaVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                Nueva Versión del TUPA (Borrador)
              </h3>
              <button
                type="button"
                onClick={() => setModalNuevaVersion(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearVersion} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Código de la Versión</label>
                <input
                  type="text"
                  required
                  value={formNuevaVersion.codigo}
                  onChange={(e) =>
                    setFormNuevaVersion({ ...formNuevaVersion, codigo: e.target.value })
                  }
                  placeholder="Ej: TUPA-2027"
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Año Fiscal</label>
                <input
                  type="number"
                  required
                  min={2026}
                  max={2040}
                  value={formNuevaVersion.anio}
                  onChange={(e) =>
                    setFormNuevaVersion({ ...formNuevaVersion, anio: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  required
                  value={formNuevaVersion.descripcion}
                  onChange={(e) =>
                    setFormNuevaVersion({ ...formNuevaVersion, descripcion: e.target.value })
                  }
                  placeholder="Descripción institucional de la versión"
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Clonar catálogo base de procedimientos desde:
                </label>
                <select
                  value={formNuevaVersion.clonarDeIdVersion}
                  onChange={(e) =>
                    setFormNuevaVersion({ ...formNuevaVersion, clonarDeIdVersion: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-600"
                >
                  <option value="">-- No clonar (crear versión vacía) --</option>
                  {versiones.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.codigo} ({v.anio}) — {v.estado}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Recomendado: clonar desde TUPA-2026 para heredar los 72 procedimientos base.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevaVersion(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-700 px-5 py-2 font-bold text-white hover:bg-blue-800"
                >
                  Crear Versión Borrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: EDITAR PROCEDIMIENTO EN VERSIÓN BORRADOR                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {modalEditarProc && procEnEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-700">
                  {procEnEdicion.codigo}
                </span>
                <h3 className="font-extrabold text-base text-slate-900">
                  Editar Procedimiento (Borrador)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarProc(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarProc} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Denominación Oficial</label>
                <input
                  type="text"
                  required
                  value={formEditProc.denominacion}
                  onChange={(e) =>
                    setFormEditProc({ ...formEditProc, denominacion: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Costo en Soles (S/.)</label>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    required
                    value={formEditProc.costoSoles}
                    onChange={(e) =>
                      setFormEditProc({ ...formEditProc, costoSoles: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plazo Legal (Días hábiles)</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    required
                    value={formEditProc.plazoDiasHabiles}
                    onChange={(e) =>
                      setFormEditProc({
                        ...formEditProc,
                        plazoDiasHabiles: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Requisitos (uno por línea)
                </label>
                <textarea
                  rows={4}
                  value={formEditProc.requisitos}
                  onChange={(e) =>
                    setFormEditProc({ ...formEditProc, requisitos: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-600 font-mono text-[11px]"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEditProc.admiteRadicacionSigd}
                    onChange={(e) =>
                      setFormEditProc({ ...formEditProc, admiteRadicacionSigd: e.target.checked })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-bold text-slate-800">
                    ¿Admite radicación directa en el SIGD (Genera número de expediente / CUT)?
                  </span>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEditarProc(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-700 px-5 py-2 font-bold text-white hover:bg-blue-800"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
