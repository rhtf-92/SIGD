import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import CargoDigitalModal from "../../components/tramite/CargoDigitalModal";
import { useHorarioCorte } from "../../hooks/useHorarioCorte";
import type { CargoOficialTramite } from "../../types/cargoOficial";
import { apiClient } from "@/api/client";
import { ApiHttpError } from "../../types/api";
import { useAuthStore } from '../../stores/authStore';
import DevolucionesMesaPartes from '../../components/tesoreria/DevolucionesMesaPartes';
import { consultarDocumentacion } from '../../services/documentacionTramiteService';
import type { DocumentacionTramite } from '../../types/documentacionTramite';
import { ResumenDocumental } from '../../components/tramite/ResumenDocumental';
import { calcularFoliacionFront } from '../../utils/foliacion';

interface TipoDocumental {
  tipo_documental_id: string;
  codigo: string;
  nombre: string;
  vigente: boolean;
}

interface ProcedimientoFormal {
  id: string;
  codigo: string;
  codigoVisible?: string;
  numeroVisible?: string;
  codigoInterno?: string;
  costoFuente?: string;
  denominacion: string;
  descripcion: string | null;
  unidad_organica: string | null;
  vigente: boolean;
}

interface VentanillaPresencialResultado {
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaRadicacion: string;
  ticketImpresion: string;
  cargo: {
    cut: string;
    remitente: string;
    dni: string;
    asunto: string;
    folios: number;
    fechaRecepcion: string;
    hashSha256: string;
    qrSeguimientoUrl: string;
  };
}

export interface OpcionTipoDocumento {
  id: string;
  codigo: string;
  denominacion: string;
  descripcion: string;
  habilitado: boolean;
  longitud: number;
}

export const OPCIONES_TIPO_DOCUMENTO: OpcionTipoDocumento[] = [
  {
    id: "DNI",
    codigo: "DNI",
    denominacion: "Documento Nacional de Identidad",
    descripcion: "8 dígitos numéricos (Persona Natural)",
    habilitado: true,
    longitud: 8,
  },
  {
    id: "CE",
    codigo: "CE",
    denominacion: "Carné de Extranjería",
    descripcion: "No disponible en ventanilla física",
    habilitado: false,
    longitud: 9,
  },
  {
    id: "RUC",
    codigo: "RUC",
    denominacion: "Registro Único de Contribuyentes",
    descripcion: "No disponible en ventanilla física",
    habilitado: false,
    longitud: 11,
  },
  {
    id: "PASAPORTE",
    codigo: "PAS",
    denominacion: "Pasaporte",
    descripcion: "No disponible en ventanilla física",
    habilitado: false,
    longitud: 12,
  },
  {
    id: "PTP",
    codigo: "PTP",
    denominacion: "Permiso Temporal de Permanencia",
    descripcion: "No disponible en ventanilla física",
    habilitado: false,
    longitud: 9,
  },
];

export default function VentanillaPresencialPage() {
  const rolesUsuario = useAuthStore((s) => s.usuario?.roles);
  const rolesActuales = rolesUsuario || [];
  const { isAfterCutoff, requiresProjection, legalDate } = useHorarioCorte();
  const esCorteSuperado = isAfterCutoff || requiresProjection;
  const enJornada = !requiresProjection;
  const proximoDiaHabil = legalDate;
  const navigate = useNavigate();
  const [ultimoRegistroExitoso, setUltimoRegistroExitoso] = useState<CargoOficialTramite | null>(null);

  const tipoPersona = "NATURAL";
  const [tipoDoc, setTipoDoc] = useState("DNI");
  const [desplegableDocAbierto, setDesplegableDocAbierto] = useState(false);
  const [indiceDocResaltado, setIndiceDocResaltado] = useState<number>(0);
  const selectorDocRef = useRef<HTMLDivElement>(null);
  const botonTriggerDocRef = useRef<HTMLButtonElement>(null);
  const listboxDocRef = useRef<HTMLDivElement>(null);
  const [numeroDoc, setNumeroDoc] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [procedimientoTupa, setProcedimientoTupa] = useState("");
  const [procedimientos, setProcedimientos] = useState<ProcedimientoFormal[]>([]);
  const [busquedaTupa, setBusquedaTupa] = useState("");
  const [desplegableTupaAbierto, setDesplegableTupaAbierto] = useState(false);
  const [indiceTupaResaltado, setIndiceTupaResaltado] = useState<number>(0);
  const selectorTupaRef = useRef<HTMLDivElement>(null);
  const botonTriggerTupaRef = useRef<HTMLButtonElement>(null);
  const listboxTupaRef = useRef<HTMLDivElement>(null);
  const [cargandoTupa, setCargandoTupa] = useState(true);
  const [errorTupa, setErrorTupa] = useState<string | null>(null);
  const [intentoTupa, setIntentoTupa] = useState(0);
  const [tiposDocumentales, setTiposDocumentales] = useState<TipoDocumental[]>([]);
  const [tipoDocumentalId, setTipoDocumentalId] = useState("");
  const [cargandoTiposDocumentales, setCargandoTiposDocumentales] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [asunto, setAsunto] = useState("");
  const [cantidadFolios, setCantidadFolios] = useState(1);
  const [documentacion, setDocumentacion] = useState<DocumentacionTramite | null>(null);
  const [cargandoDoc, setCargandoDoc] = useState(false);
  const [documentosAdjuntos, setDocumentosAdjuntos] = useState<Array<{
    nombreArchivo: string;
    tamanoBytes: number;
    hashSha256: string;
    paginas: number;
    folioInicio: number;
    folioFin: number;
    clasificacion: 'EXPEDIENTE' | 'ANEXO';
    requisitoId?: string;
  }>>([]);
  const [analizandoPdf, setAnalizandoPdf] = useState(false);
  const [modalVinculacionesAbierto, setModalVinculacionesAbierto] = useState(false);
  const [solicitudesVinculacion, setSolicitudesVinculacion] = useState<Array<{
    id: string;
    expediente_id: string;
    cut: string;
    asunto: string;
    dni_solicitante: string;
    solicitante: string;
    dni_usuario: string;
    nombre_usuario: string;
    motivo_solicitud: string | null;
    creado_en: string;
  }>>([]);
  const [cargandoVinculaciones, setCargandoVinculaciones] = useState(false);
  const [resolviendoVinculacion, setResolviendoVinculacion] = useState(false);
  const [mensajeVinculacion, setMensajeVinculacion] = useState<string | null>(null);
  const [cargoGenerado, setCargoGenerado] = useState<CargoOficialTramite | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const envioEnCurso = useRef(false);
  const procedimientoSeleccionado = procedimientos.find(
    (procedimiento) => procedimiento.codigo === procedimientoTupa,
  );

  useEffect(() => {
    if (!procedimientoSeleccionado?.id) {
      setDocumentacion(null);
      return;
    }
    const controller=new AbortController();
    setCargandoDoc(true);
    consultarDocumentacion(procedimientoSeleccionado.id,controller.signal)
      .then((doc) => {
        if (!controller.signal.aborted) setDocumentacion(doc);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDocumentacion(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoDoc(false);
      });
    return () => controller.abort();
  }, [procedimientoSeleccionado?.id]);

  const cargarSolicitudesVinculacion = async () => {
    setCargandoVinculaciones(true);
    setMensajeVinculacion(null);
    try {
      const res = await apiClient.get('/api/v1/tramites/vinculaciones/pendientes');
      setSolicitudesVinculacion(res.data);
    } catch {
      setSolicitudesVinculacion([]);
    } finally {
      setCargandoVinculaciones(false);
    }
  };

  const handleResolverVinculacion = async (id: string, accion: 'APROBAR' | 'RECHAZAR', observacion?: string) => {
    setResolviendoVinculacion(true);
    setMensajeVinculacion(null);
    try {
      await apiClient.post(`/api/v1/tramites/vinculaciones/${id}/resolver`, { accion, observacion });
      setMensajeVinculacion(`Solicitud ${accion === 'APROBAR' ? 'aprobada' : 'rechazada'} exitosamente.`);
      await cargarSolicitudesVinculacion();
    } catch (err: any) {
      setMensajeVinculacion(err.response?.data?.problemDetails?.detail || 'Error al procesar la vinculación.');
    } finally {
      setResolviendoVinculacion(false);
    }
  };

  const handleAdjuntarPdfVentanilla = async (e: React.ChangeEvent<HTMLInputElement>, clasificacion: 'EXPEDIENTE' | 'ANEXO' = 'EXPEDIENTE', requisitoId?: string) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setAnalizandoPdf(true);
    setErrorRegistro(null);
    try {
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          throw new Error('Solo se permiten archivos en formato PDF.');
        }
        const formData = new FormData();
        formData.append('archivo', file);
        const res = await apiClient.post<{ valido: boolean; paginas: number; tamanoBytes: number; sha256: string }>(
          '/api/v1/tramites/analizar-pdf',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const nuevo = {
          nombreArchivo: file.name,
          tamanoBytes: file.size,
          hashSha256: res.data.sha256,
          paginas: res.data.paginas,
          clasificacion,
          requisitoId,
        };
        setDocumentosAdjuntos(prev => {
          const actualizados = [...prev, nuevo];
          const foliados = calcularFoliacionFront(actualizados);
          setCantidadFolios(foliados.totalFolios);
          return foliados.documentosFoliados.map(d => ({
            ...d,
            nombreArchivo: d.nombreArchivo,
            tamanoBytes: d.tamanoBytes,
            hashSha256: d.hashSha256,
            clasificacion: d.clasificacion,
            requisitoId: d.requisitoId,
          }));
        });
      }
    } catch (err: any) {
      setErrorRegistro(err.response?.data?.problemDetails?.invalidParams?.[0]?.reason || err.message || 'Error al analizar archivo PDF.');
    } finally {
      setAnalizandoPdf(false);
      e.target.value = '';
    }
  };

  const handleEliminarPdfVentanilla = (index: number) => {
    setDocumentosAdjuntos(prev => {
      const filtrados = prev.filter((_, idx) => idx !== index);
      const foliados = calcularFoliacionFront(filtrados);
      setCantidadFolios(Math.max(1, foliados.totalFolios));
      return foliados.documentosFoliados.map(d => ({
        ...d,
        nombreArchivo: d.nombreArchivo,
        tamanoBytes: d.tamanoBytes,
        hashSha256: d.hashSha256,
        clasificacion: d.clasificacion,
        requisitoId: d.requisitoId,
      }));
    });
  };
  const tipoDocumentalSeleccionado = tiposDocumentales.find(
    (tipo) => tipo.tipo_documental_id === tipoDocumentalId,
  );

  useEffect(() => {
    let activo = true;
    const controller = new AbortController();
    apiClient.get<TipoDocumental[]>("/api/v1/admin/maestras/tipo-documento", { signal: controller.signal })
      .then((res) => {
        if (!activo) return;
        if (res.status !== 200 || !Array.isArray(res.data) || res.data.some((tipo) => (
          !tipo || typeof tipo.tipo_documental_id !== "string" ||
          !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(tipo.tipo_documental_id) ||
          typeof tipo.codigo !== "string" || !tipo.codigo.trim() ||
          typeof tipo.nombre !== "string" || !tipo.nombre.trim() || tipo.vigente !== true
        ))) {
          throw new Error("Respuesta del catálogo documental inválida.");
        }
        setTiposDocumentales(res.data);
      })
      .catch(() => {
        if (!activo) return;
        setTiposDocumentales([]);
        setErrorCatalogo("No se pudo cargar el catálogo documental. El registro está deshabilitado. Vuelva a cargar la página.");
      })
      .finally(() => {
        if (activo) setCargandoTiposDocumentales(false);
      });
    return () => {
      activo = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCargandoTupa(true);
    setErrorTupa(null);
    apiClient.get<ProcedimientoFormal[]>("/api/v1/tramites/tipos", { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
        if (!Array.isArray(data) || data.some(p => !p || !uuid.test(p.id) ||
            typeof p.codigo !== "string" || !p.codigo.trim() ||
            typeof p.denominacion !== "string" || !p.denominacion.trim() ||
            typeof p.vigente !== "boolean" ||
            (p.descripcion != null && typeof p.descripcion !== "string") ||
            (p.unidad_organica != null && typeof p.unidad_organica !== "string")) ||
            new Set(data.map(p => p.id)).size !== data.length ||
            new Set(data.map(p => p.codigo)).size !== data.length) {
          throw new Error("Catálogo formal inválido.");
        }
        const validos = data.filter(p => p.vigente);
        setProcedimientos(validos.map(p => ({
          ...p,
          codigo: p.codigo,
          codigoVisible: p.codigoVisible ?? p.codigo,
          numeroVisible: p.numeroVisible,
          codigoInterno: p.codigoInterno ?? p.codigo,
          denominacion: p.denominacion,
          descripcion: p.costoFuente && p.costoFuente !== 'Gratuito'
            ? `${p.descripcion ?? ''}\nCosto según TUPA: ${p.costoFuente}`.trim()
            : (p.descripcion ?? null),
        })));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setProcedimientos([]);
          setErrorTupa("No se pudo consultar el catálogo formal de trámites. Reintente antes de registrar.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setCargandoTupa(false); });
    return () => controller.abort();
  }, [intentoTupa]);

  useEffect(() => {
    const manejarClickFueraDoc = (e: MouseEvent) => {
      if (selectorDocRef.current && !selectorDocRef.current.contains(e.target as Node)) {
        setDesplegableDocAbierto(false);
      }
    };
    if (desplegableDocAbierto) {
      document.addEventListener("mousedown", manejarClickFueraDoc);
      return () => document.removeEventListener("mousedown", manejarClickFueraDoc);
    }
  }, [desplegableDocAbierto]);

  useEffect(() => {
    if (desplegableDocAbierto && listboxDocRef.current && indiceDocResaltado >= 0) {
      const itemEl = listboxDocRef.current.children[indiceDocResaltado] as HTMLElement;
      if (itemEl && typeof itemEl.scrollIntoView === "function") {
        itemEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [indiceDocResaltado, desplegableDocAbierto]);

  const seleccionarOpcionDoc = (opcion: OpcionTipoDocumento) => {
    if (!opcion.habilitado) return;
    setTipoDoc(opcion.id);
    setDesplegableDocAbierto(false);
    botonTriggerDocRef.current?.focus();
  };

  const manejarKeyDownTriggerDoc = (e: React.KeyboardEvent) => {
    if (enviando) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!desplegableDocAbierto) {
        setDesplegableDocAbierto(true);
        const idxActual = OPCIONES_TIPO_DOCUMENTO.findIndex((t) => t.id === tipoDoc);
        setIndiceDocResaltado(idxActual >= 0 ? idxActual : 0);
      } else if (e.key === "ArrowDown") {
        setIndiceDocResaltado((prev) => (prev < OPCIONES_TIPO_DOCUMENTO.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        setIndiceDocResaltado((prev) => (prev > 0 ? prev - 1 : OPCIONES_TIPO_DOCUMENTO.length - 1));
      } else if (e.key === "Enter" || e.key === " ") {
        if (indiceDocResaltado >= 0 && indiceDocResaltado < OPCIONES_TIPO_DOCUMENTO.length) {
          seleccionarOpcionDoc(OPCIONES_TIPO_DOCUMENTO[indiceDocResaltado]);
        }
      }
    } else if (e.key === "Escape" || e.key === "Tab") {
      setDesplegableDocAbierto(false);
    }
  };

  const opcionDocSeleccionada =
    OPCIONES_TIPO_DOCUMENTO.find((o) => o.id === tipoDoc) ?? OPCIONES_TIPO_DOCUMENTO[0];

  const procedimientosFiltrados = procedimientos.filter(
    (p) =>
      p.codigo === procedimientoTupa ||
      p.codigoVisible === procedimientoTupa ||
      p.codigoInterno === procedimientoTupa ||
      `${p.codigo} ${p.numeroVisible ?? ''} ${p.codigoInterno ?? ''} ${p.denominacion}`
        .toLocaleLowerCase("es")
        .includes(busquedaTupa.trim().toLocaleLowerCase("es"))
  );

  useEffect(() => {
    const manejarClickFueraTupa = (e: MouseEvent) => {
      if (selectorTupaRef.current && !selectorTupaRef.current.contains(e.target as Node)) {
        setDesplegableTupaAbierto(false);
      }
    };
    if (desplegableTupaAbierto) {
      document.addEventListener("mousedown", manejarClickFueraTupa);
      return () => document.removeEventListener("mousedown", manejarClickFueraTupa);
    }
  }, [desplegableTupaAbierto]);

  useEffect(() => {
    if (desplegableTupaAbierto && listboxTupaRef.current && indiceTupaResaltado >= 0) {
      const itemEl = listboxTupaRef.current.children[indiceTupaResaltado] as HTMLElement;
      if (itemEl && typeof itemEl.scrollIntoView === "function") {
        itemEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [indiceTupaResaltado, desplegableTupaAbierto]);

  const seleccionarProcedimiento = (codigo: string) => {
    setProcedimientoTupa(codigo);
    setDesplegableTupaAbierto(false);
    botonTriggerTupaRef.current?.focus();
  };

  const manejarKeyDownTriggerTupa = (e: React.KeyboardEvent) => {
    if (enviando || cargandoTupa || !!errorTupa) return;
    const totalOpciones = 2 + procedimientosFiltrados.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!desplegableTupaAbierto) {
        setDesplegableTupaAbierto(true);
        let idxActual = 0;
        if (procedimientoTupa === "NO_TUPA") {
          idxActual = 1;
        } else if (procedimientoTupa) {
          const idxProc = procedimientosFiltrados.findIndex((p) => p.codigo === procedimientoTupa);
          idxActual = idxProc >= 0 ? idxProc + 2 : 0;
        }
        setIndiceTupaResaltado(idxActual);
      } else if (e.key === "ArrowDown") {
        setIndiceTupaResaltado((prev) => (prev < totalOpciones - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        setIndiceTupaResaltado((prev) => (prev > 0 ? prev - 1 : totalOpciones - 1));
      } else if (e.key === "Enter" || e.key === " ") {
        if (indiceTupaResaltado === 0) {
          seleccionarProcedimiento("");
        } else if (indiceTupaResaltado === 1) {
          seleccionarProcedimiento("NO_TUPA");
        } else {
          const proc = procedimientosFiltrados[indiceTupaResaltado - 2];
          if (proc) seleccionarProcedimiento(proc.codigo);
        }
      }
    } else if (e.key === "Escape" || e.key === "Tab") {
      setDesplegableTupaAbierto(false);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (envioEnCurso.current) return;
    setErrorRegistro(null);
    if (cargandoTiposDocumentales || errorCatalogo || tiposDocumentales.length === 0) return;
    if (!tipoDocumentalSeleccionado) {
      setErrorRegistro("Seleccione un tipo documental vigente del catálogo institucional.");
      return;
    }
    if (cargandoTupa || errorTupa) return;
    if (procedimientoTupa !== "NO_TUPA" && !procedimientoSeleccionado) {
      setErrorRegistro("Seleccione un procedimiento vigente o documentación general no TUPA.");
      return;
    }
    if (!/^[0-9]{8}$/.test(numeroDoc)) {
      setErrorRegistro("El DNI debe contener exactamente 8 dígitos.");
      return;
    }
    if (!nombres.trim() || !apellidos.trim() || nombres.trim().length > 120 || apellidos.trim().length > 120) {
      setErrorRegistro("Indique nombres y apellidos explícitos, con un máximo de 120 caracteres por campo.");
      return;
    }

    const asuntoFinal = procedimientoSeleccionado
      ? `${procedimientoSeleccionado.codigo} — ${procedimientoSeleccionado.denominacion} - ${asunto}`
      : asunto;

    envioEnCurso.current = true;
    setEnviando(true);
    try {
      const res = await apiClient.post<VentanillaPresencialResultado>(
        "/api/v1/tramites/ventanilla-presencial",
        {
          tipoPersona,
          tipoDocumento: (tipoDoc === "CE" || tipoDoc === "RUC") ? tipoDoc : "DNI",
          tipoDocumentalId: tipoDocumentalSeleccionado.tipo_documental_id,
          ...(procedimientoSeleccionado ? { idTipoTramiteTupa: procedimientoSeleccionado.id } : {}),
          dniSolicitante: numeroDoc,
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          correo: correo.trim(),
          telefono: telefono.trim(),
          asunto: asuntoFinal.trim(),
          foliosTotales: Number(cantidadFolios),
          ...(documentosAdjuntos.length > 0 ? {
            documentos: documentosAdjuntos.map(d => ({
              nombreArchivo: d.nombreArchivo,
              tamanoBytes: d.tamanoBytes,
              hashSha256: d.hashSha256,
              paginas: d.paginas,
              folioInicio: d.folioInicio,
              folioFin: d.folioFin,
              clasificacion: d.clasificacion,
            })),
          } : {}),
        },
      );

      const serverData = res.data;
      const cargoServer = serverData?.cargo;
      if (
        res.status !== 201 ||
        typeof serverData?.expedienteId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(serverData.expedienteId) ||
        typeof serverData.cut !== "string" || !/^EXP-[0-9]{4}-[0-9]{6}$/.test(serverData.cut) ||
        !Number.isInteger(serverData.anioFiscal) || serverData.anioFiscal !== Number(serverData.cut.slice(4, 8)) ||
        typeof serverData.fechaRadicacion !== "string" || !Number.isFinite(Date.parse(serverData.fechaRadicacion)) ||
        typeof serverData.ticketImpresion !== "string" || !serverData.ticketImpresion.trim() ||
        !cargoServer || cargoServer.cut !== serverData.cut || cargoServer.dni !== numeroDoc ||
        typeof cargoServer.remitente !== "string" || !cargoServer.remitente.trim() ||
        typeof cargoServer.asunto !== "string" || !cargoServer.asunto.trim() ||
        typeof cargoServer.fechaRecepcion !== "string" || !Number.isFinite(Date.parse(cargoServer.fechaRecepcion)) ||
        cargoServer.folios !== Number(cantidadFolios) ||
        typeof cargoServer.hashSha256 !== "string" || !/^[0-9a-f]{64}$/i.test(cargoServer.hashSha256) ||
        typeof cargoServer.qrSeguimientoUrl !== "string" || !cargoServer.qrSeguimientoUrl.trim()
      ) {
        throw new Error("Respuesta de registro incompleta.");
      }
      const fechaRecepcion = cargoServer.fechaRecepcion;

      const nuevoCargo: CargoOficialTramite = {
        codigoExpediente: serverData.cut,
        fechaRecepcionIso: fechaRecepcion,
        fechaIngresoFormalIso: esCorteSuperado ? proximoDiaHabil : fechaRecepcion,
        horaRecepcion: new Date(fechaRecepcion).toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        operadorVentanillaNombre: "Operador de Mesa de Partes (Ventanilla 1)",
        sedeInstitucional: "Sede Central - Jr. Tarapacá N° 645, Pucallpa",
        solicitante: {
          tipoPersona,
          tipoDocumento: (tipoDoc === "CE" || tipoDoc === "RUC") ? tipoDoc : "DNI",
          numeroDocumento: numeroDoc,
          nombreOrazonSocial: cargoServer.remitente,
          correoElectronico: correo,
          telefono,
        },
        asunto: asuntoFinal,
        documentoPrincipalTipo: tipoDocumentalSeleccionado.nombre,
        cantidadFolios: cargoServer.folios,
        hashSha256Recepcion: cargoServer.hashSha256,
        horaCorteAplicada: "16:30",
        radicadoDiaSiguiente: esCorteSuperado,
        urlSeguimiento: cargoServer.qrSeguimientoUrl,
      };

      setCargoGenerado(nuevoCargo);
      setUltimoRegistroExitoso(nuevoCargo);
      setModalAbierto(true);
    } catch (error) {
      setCargoGenerado(null);
      setModalAbierto(false);
      setErrorRegistro(error instanceof ApiHttpError
        ? [error.problemDetails.detail, ...(error.problemDetails.invalidParams ?? []).map((campo) => `${campo.name}: ${campo.reason}`)].join(" ")
        : "No se pudo confirmar el registro del trámite. No se emitió un cargo válido.");
    } finally {
      envioEnCurso.current = false;
      setEnviando(false);
    }
  }

  function handleNuevoRegistro() {
    setTipoDoc("DNI");
    setDesplegableDocAbierto(false);
    setNumeroDoc("");
    setNombres("");
    setApellidos("");
    setErrorRegistro(null);
    setCorreo("");
    setTelefono("");
    setProcedimientoTupa("");
    setTipoDocumentalId("");
    setBusquedaTupa("");
    setAsunto("");
    setCantidadFolios(1);
    setModalAbierto(false);
    setUltimoRegistroExitoso(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <nav className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link to="/" className="hover:text-blue-700">Inicio</Link>
            <span>/</span>
            <Link to="/tramite" className="hover:text-blue-700">Trámite Documentario</Link>
            <span>/</span>
            <span className="text-slate-800">Ventanilla Presencial</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Módulo 02 · Mesa de Partes y Registro Documentario
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Ventanilla Presencial de Atención al Ciudadano
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Digitación de mesa de partes física, asignación de CUT y emisión de ticket con QR (ENT-M02-05).
              </p>
            </div>

            <div className="flex items-center gap-2">
              {rolesActuales.includes('MESA_PARTES') && (
                <button
                  type="button"
                  id="btn-gestionar-vinculaciones"
                  onClick={() => setModalVinculacionesAbierto(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900 hover:bg-blue-100 transition shadow-xs"
                >
                  Vinculaciones Pendientes
                </button>
              )}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  enJornada && !esCorteSuperado
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                    : "bg-amber-50 text-amber-900 border border-amber-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {enJornada && !esCorteSuperado
                  ? "Atención Ordinaria LPAG (< 16:30 hrs)"
                  : "Horario Posterior al Corte (Art. 138 LPAG)"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {rolesActuales.includes('MESA_PARTES') && <DevolucionesMesaPartes />}

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {esCorteSuperado && (
          <div
            role="note"
            className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-900 shadow-sm"
          >
            <p className="font-bold">Aviso Legal — Horario de Corte LPAG:</p>
            <p className="mt-0.5">
              Son más de las 16:30 hrs. Los documentos recepcionados se registrarán con la fecha física actual,
              pero surtirán efectos legales a partir de las 08:00 hrs del día hábil siguiente ({proximoDiaHabil}).
            </p>
          </div>
        )}

        {!modalAbierto && ultimoRegistroExitoso && (
          <section
            role="status"
            aria-label="Confirmación de último trámite registrado"
            className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm text-slate-800"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold" aria-hidden="true">✓</span>
                  <h2 className="text-base font-bold text-slate-900">
                    ¡Trámite registrado exitosamente!
                  </h2>
                  <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                    REGISTRADO
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Su solicitud se registró correctamente. Conserve el código de expediente y el cargo digital para realizar el seguimiento.
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
                  <span>
                    <strong className="text-slate-700">Expediente / CUT:</strong>{" "}
                    <span className="font-mono font-bold text-blue-700">{ultimoRegistroExitoso.codigoExpediente}</span>
                  </span>
                  <span>
                    <strong className="text-slate-700">Solicitante:</strong>{" "}
                    {ultimoRegistroExitoso.solicitante.nombreOrazonSocial} ({ultimoRegistroExitoso.solicitante.numeroDocumento})
                  </span>
                  <span>
                    <strong className="text-slate-700">Fecha y Hora:</strong>{" "}
                    {ultimoRegistroExitoso.horaRecepcion}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(true)}
                  className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition cursor-pointer"
                >
                  📄 Ver Cargo Digital
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/expedientes")}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  📂 Ir a Bandeja
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/consulta/${ultimoRegistroExitoso.codigoExpediente}`)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  🔍 Seguimiento
                </button>
                <button
                  type="button"
                  onClick={() => setUltimoRegistroExitoso(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  title="Cerrar notificación"
                >
                  ✕
                </button>
              </div>
            </div>
          </section>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
            Datos de Recepción en Ventanilla
          </h2>

          {/* Tipo de Persona */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="tipoPersona"
                value="NATURAL"
                checked={tipoPersona === "NATURAL"}
                readOnly
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Persona Natural</span>
            </label>
            <label
              className="flex items-center gap-2 text-sm font-medium text-slate-400 cursor-not-allowed"
              title="La recepción presencial para personas jurídicas no está habilitada en el servicio institucional actual."
            >
              <input
                type="radio"
                name="tipoPersona"
                value="JURIDICA"
                checked={false}
                disabled
                aria-disabled="true"
                className="text-slate-400 focus:ring-slate-300 cursor-not-allowed"
              />
              <span>
                Persona Jurídica{" "}
                <span className="text-xs font-normal text-slate-400">
                  (No disponible en ventanilla física)
                </span>
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="tipo-doc-select"
                id="tipo-doc-label"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Tipo Documento Identidad *
              </label>

              {/* Select nativo accesible sincronizado para tests y lectores de pantalla */}
              <select
                id="tipo-doc-select"
                value={tipoDoc}
                onChange={(e) => {
                  const encontrada = OPCIONES_TIPO_DOCUMENTO.find((o) => o.id === e.target.value);
                  if (encontrada && encontrada.habilitado) {
                    setTipoDoc(encontrada.id);
                  }
                }}
                className="sr-only"
                aria-labelledby="tipo-doc-label"
                tabIndex={-1}
              >
                {OPCIONES_TIPO_DOCUMENTO.map((opcion) => (
                  <option
                    key={opcion.id}
                    value={opcion.id}
                    disabled={!opcion.habilitado}
                  >
                    {opcion.codigo} — {opcion.denominacion} {!opcion.habilitado ? `(${opcion.descripcion})` : ""}
                  </option>
                ))}
              </select>

              {/* Selector visual personalizado idéntico al estándar de StepDocumentos */}
              <div ref={selectorDocRef} className="relative w-full">
                <button
                  ref={botonTriggerDocRef}
                  type="button"
                  id="tipo-doc-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={desplegableDocAbierto}
                  aria-labelledby="tipo-doc-label tipo-doc-trigger"
                  aria-controls="tipo-doc-dropdown"
                  onClick={() => {
                    if (!enviando) {
                      const nuevoEstado = !desplegableDocAbierto;
                      setDesplegableDocAbierto(nuevoEstado);
                      if (nuevoEstado) {
                        const idx = OPCIONES_TIPO_DOCUMENTO.findIndex((t) => t.id === tipoDoc);
                        setIndiceDocResaltado(idx >= 0 ? idx : 0);
                      }
                    }
                  }}
                  onKeyDown={manejarKeyDownTriggerDoc}
                  disabled={enviando}
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition cursor-pointer flex items-center justify-between text-left gap-2 ${
                    desplegableDocAbierto
                      ? "border-[#006EC7] ring-2 ring-[#006EC7]/20 bg-white text-slate-900"
                      : "border-slate-300 bg-white text-slate-900 hover:border-slate-400 focus:outline-none focus:border-[#006EC7] focus:ring-2 focus:ring-[#006EC7]/20"
                  } disabled:bg-slate-100 disabled:cursor-not-allowed`}
                >
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-slate-900 truncate block">
                      <span className="font-bold text-[#005bb5] mr-1.5">{opcionDocSeleccionada.codigo}</span>
                      <span>— {opcionDocSeleccionada.denominacion}</span>
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                      desplegableDocAbierto ? "rotate-180 text-[#006EC7]" : "text-slate-400"
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
                {desplegableDocAbierto && (
                  <div
                    id="tipo-doc-dropdown"
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in duration-100"
                  >
                    <div
                      ref={listboxDocRef}
                      role="listbox"
                      aria-label="Tipos de documento de identidad"
                      className="max-h-[235px] overflow-y-auto divide-y divide-slate-100 focus:outline-none"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#94a3b8 #f1f5f9",
                      }}
                    >
                      {OPCIONES_TIPO_DOCUMENTO.map((opcion, idx) => {
                        const isSelected = tipoDoc === opcion.id;
                        const isHighlighted = idx === indiceDocResaltado;
                        return (
                          <div
                            key={opcion.id}
                            role="option"
                            aria-selected={isSelected}
                            aria-disabled={!opcion.habilitado}
                            onClick={() => {
                              if (opcion.habilitado) {
                                seleccionarOpcionDoc(opcion);
                              }
                            }}
                            onMouseEnter={() => setIndiceDocResaltado(idx)}
                            className={`px-3 py-2 text-left text-xs transition flex items-start justify-between gap-2 ${
                              !opcion.habilitado
                                ? "bg-slate-50/70 text-slate-400 cursor-not-allowed opacity-80"
                                : isSelected
                                ? "bg-blue-50 text-[#006EC7] font-medium cursor-pointer"
                                : isHighlighted
                                ? "bg-slate-50 text-slate-900 cursor-pointer"
                                : "text-slate-800 hover:bg-slate-50 cursor-pointer"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="leading-snug">
                                <span className={`font-bold mr-1.5 ${opcion.habilitado ? "text-[#005bb5]" : "text-slate-500"}`}>
                                  {opcion.codigo}
                                </span>
                                <span className={isSelected ? "text-[#005bb5] font-semibold" : ""}>
                                  — {opcion.denominacion}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {opcion.descripcion}
                              </p>
                            </div>
                            {isSelected && (
                              <svg className="w-4 h-4 text-[#006EC7] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            </div>

            <div>
              <label htmlFor="num-doc-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Documento *
              </label>
              <input
                id="num-doc-input"
                type="text"
                required
                value={numeroDoc}
                pattern="[0-9]{8}"
                maxLength={8}
                inputMode="numeric"
                onChange={(e) => setNumeroDoc(e.target.value)}
                placeholder={tipoDoc === "DNI" ? "8 dígitos" : "11 dígitos"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="nombre-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Nombres *
              </label>
              <input
                id="nombre-input"
                type="text"
                required
                maxLength={120}
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="apellidos-input" className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
              <input id="apellidos-input" type="text" required maxLength={120} value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="correo-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Correo Electrónico para Notificación *
              </label>
              <input
                id="correo-input"
                type="email"
                maxLength={160}
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="tel-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono / Celular de Contacto *
              </label>
              <input
                id="tel-input"
                type="tel"
                maxLength={20}
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="9XXXXXXXX"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="procedimiento-tupa-select"
                  id="procedimiento-tupa-label"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Procedimiento TUPA 2026 * <span className="font-normal text-xs text-[#006EC7]">(72 procedimientos vigentes)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (procedimientoTupa === "NO_TUPA") {
                      seleccionarProcedimiento("");
                    } else {
                      seleccionarProcedimiento("NO_TUPA");
                    }
                  }}
                  className={`text-xs px-2 py-0.5 rounded border transition ${
                    procedimientoTupa === "NO_TUPA"
                      ? "bg-amber-100 text-amber-900 border-amber-400 font-semibold"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {procedimientoTupa === "NO_TUPA" ? "✓ Trámite no TUPA activo" : "Cambiar a trámite general (no TUPA)"}
                </button>
              </div>
              <label htmlFor="buscar-tupa" className="block text-xs text-slate-600 mb-1">
                Buscar por código o denominación
              </label>
              <input
                id="buscar-tupa"
                type="search"
                value={busquedaTupa}
                onChange={(e) => setBusquedaTupa(e.target.value)}
                placeholder="Filtrar por código o palabra clave..."
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />

              {/* Select nativo accesible sincronizado para tests y lectores de pantalla */}
              <select
                id="procedimiento-tupa-select"
                required
                disabled={enviando || cargandoTupa || !!errorTupa}
                value={procedimientoTupa}
                onChange={(e) => {
                  setProcedimientoTupa(e.target.value);
                }}
                className="sr-only"

                tabIndex={-1}
              >
                <option value="" disabled hidden>Seleccione un procedimiento o servicio</option>
                <option value="NO_TUPA">Trámite no TUPA / documentación general</option>
                {procedimientosFiltrados.map((procedimiento) => (
                  <option key={procedimiento.codigo} value={procedimiento.codigo}>
                    {procedimiento.codigo} — {procedimiento.denominacion}
                  </option>
                ))}
              </select>

              {/* Selector visual personalizado compacto con scrollbar (~235px) */}
              <div ref={selectorTupaRef} className="relative w-full">
                <button
                  ref={botonTriggerTupaRef}
                  type="button"
                  id="procedimiento-tupa-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={desplegableTupaAbierto}

                  aria-controls="procedimiento-tupa-dropdown"
                  disabled={enviando || cargandoTupa || !!errorTupa}
                  onClick={() => {
                    if (!enviando && !cargandoTupa && !errorTupa) {
                      const nuevoEstado = !desplegableTupaAbierto;
                      setDesplegableTupaAbierto(nuevoEstado);
                      if (nuevoEstado) {
                        const idxProc = procedimientosFiltrados.findIndex((p) => p.codigo === procedimientoTupa);
                        setIndiceTupaResaltado(idxProc >= 0 ? idxProc : 0);
                      }
                    }
                  }}
                  onKeyDown={manejarKeyDownTriggerTupa}
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition cursor-pointer flex items-center justify-between text-left gap-2 ${
                    desplegableTupaAbierto
                      ? "border-[#006EC7] ring-2 ring-[#006EC7]/20 bg-white text-slate-900"
                      : "border-slate-300 bg-white text-slate-900 hover:border-slate-400 focus:outline-none focus:border-[#006EC7] focus:ring-2 focus:ring-[#006EC7]/20"
                  } disabled:bg-slate-100 disabled:cursor-not-allowed`}
                >
                  <div className="min-w-0 flex-1 truncate">
                    {cargandoTupa ? (
                      <span className="text-slate-400 italic">Consultando catálogo formal…</span>
                    ) : errorTupa ? (
                      <span className="text-red-600 font-medium">Error al cargar catálogo TUPA</span>
                    ) : procedimientoTupa === "NO_TUPA" ? (
                      <span className="font-medium text-slate-900 truncate block">
                        <span className="font-bold text-[#005bb5] mr-1.5">GENERAL</span>
                        <span>— Trámite no TUPA / documentación general</span>
                      </span>
                    ) : procedimientoSeleccionado ? (
                      <span className="font-medium text-slate-900 truncate block">
                        <span className="font-bold text-[#005bb5] mr-1.5">{procedimientoSeleccionado.codigo}</span>
                        <span>— {procedimientoSeleccionado.denominacion}</span>
                        {procedimientoSeleccionado.unidad_organica && (
                          <span className="text-slate-500 text-xs font-normal ml-1">
                            ({procedimientoSeleccionado.unidad_organica})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-500">-- Seleccione un procedimiento o servicio --</span>
                    )}
                  </div>
                  <svg
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                      desplegableTupaAbierto ? "rotate-180 text-[#006EC7]" : "text-slate-400"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Menú desplegable con scrollbar vertical y límite a ~5 opciones visibles (~235px) */}
                {desplegableTupaAbierto && (
                  <div
                    id="procedimiento-tupa-dropdown"
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in duration-100"
                  >
                    <div
                      ref={listboxTupaRef}
                      role="listbox"
                      aria-label="Procedimientos TUPA disponibles"
                      className="max-h-[235px] overflow-y-auto divide-y divide-slate-100 focus:outline-none"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#94a3b8 #f1f5f9",
                      }}
                    >
                      {/* Deseleccionar si hay selección */}
                      {procedimientoTupa && (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => seleccionarProcedimiento("")}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") seleccionarProcedimiento(""); }}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-100 transition"
                        >
                          <span>✕ Deseleccionar procedimiento</span>
                        </div>
                      )}

                      {/* Opciones del catálogo (72 vigentes) */}
                      {procedimientosFiltrados.map((procedimiento, idx) => {
                        const isSelected = procedimientoTupa === procedimiento.codigo;
                        const isHighlighted = indiceTupaResaltado === idx;
                        return (
                          <div
                            key={procedimiento.codigo}
                            data-index={idx}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => seleccionarProcedimiento(procedimiento.codigo)}
                            onMouseEnter={() => setIndiceTupaResaltado(idx)}
                            className={`px-3 py-2 text-left text-xs cursor-pointer transition flex items-start justify-between gap-2 ${
                              isSelected
                                ? "bg-blue-50 text-[#006EC7] font-medium"
                                : isHighlighted
                                ? "bg-slate-50 text-slate-900"
                                : "text-slate-800 hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="leading-snug">
                                <span className="font-bold text-[#005bb5] mr-1.5">{procedimiento.codigo}</span>
                                <span className={isSelected ? "text-[#005bb5] font-semibold" : "text-slate-900"}>
                                  — {procedimiento.denominacion}
                                </span>
                              </div>
                              {procedimiento.unidad_organica && (
                                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                  {procedimiento.unidad_organica}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <svg className="w-4 h-4 text-[#006EC7] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

              {cargandoTupa && <p role="status" className="text-xs text-slate-500 mt-1">Consultando catálogo formal…</p>}
              {errorTupa && (
                <div role="alert" className="text-sm text-red-700 mt-1 flex items-center gap-2">
                  <span>{errorTupa}</span>
                  <button type="button" onClick={() => setIntentoTupa((i) => i + 1)} className="font-semibold underline hover:text-red-900">
                    Reintentar catálogo
                  </button>
                </div>
              )}
              {!cargandoTupa && !errorTupa && procedimientos.length === 0 && (
                <p role="status" className="text-xs text-slate-500 mt-1">No hay procedimientos formales vigentes disponibles.</p>
              )}
              {!cargandoTupa && !errorTupa && procedimientos.length > 0 && procedimientosFiltrados.length === 0 && (
                <p role="status" className="text-xs text-amber-700 mt-1">No hay procedimientos que coincidan con la búsqueda.</p>
              )}
              <p className="mt-1 text-xs text-slate-600">
                Catálogo formal vigente de la API institucional. Los conceptos informativos de Ventanilla no son automáticamente trámites radicables. Se conservan las advertencias de la fuente.
              </p>
            </div>

            <div>
              <label htmlFor="tipo-documento-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Documento Presentado *
              </label>
              <select
                id="tipo-documento-select"
                required
                value={tipoDocumentalId}
                disabled={enviando || cargandoTiposDocumentales || !!errorCatalogo || tiposDocumentales.length === 0}
                onChange={(e) => setTipoDocumentalId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Seleccione un tipo documental</option>
                {tiposDocumentales.map((tipo) => (
                  <option key={tipo.tipo_documental_id} value={tipo.tipo_documental_id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
              {cargandoTiposDocumentales && <p role="status" className="mt-2 text-sm text-slate-600">Cargando tipos documentales…</p>}
              {errorCatalogo && <p role="alert" className="mt-2 text-sm text-red-700">{errorCatalogo}</p>}
              {!cargandoTiposDocumentales && !errorCatalogo && tiposDocumentales.length === 0 && (
                <p role="status" className="mt-2 text-sm text-amber-800">
                  No hay tipos documentales vigentes disponibles. No se puede registrar el trámite hasta que se configure el catálogo institucional.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="folios-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Cantidad de Folios {documentosAdjuntos.length > 0 ? '(Calculado Automáticamente)' : 'Físicos *'}
              </label>
              <input
                id="folios-input"
                type="number"
                min={1}
                max={5000}
                required
                value={cantidadFolios}
                readOnly={documentosAdjuntos.length > 0}
                onChange={(e) => setCantidadFolios(Number(e.target.value))}
                className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none ${
                  documentosAdjuntos.length > 0 ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : 'bg-white text-slate-800 focus:border-blue-600'
                }`}
              />
              {documentosAdjuntos.length > 0 && (
                <p className="mt-1 text-[11px] text-blue-700 font-semibold">
                  ✓ Determinado por el total de páginas útiles verificadas en los PDF adjuntos.
                </p>
              )}
            </div>
          </div>

          {/* Sección Unificada de Requisitos Documentales Oficiales TUPA 2026 */}
          {procedimientoSeleccionado && (
            <section aria-labelledby="detalle-tupa-heading" className="rounded-xl border border-blue-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Catálogo Documental TUPA 2026</span>
                  <h3 id="detalle-tupa-heading" className="text-sm font-bold text-slate-900">
                    TUPA 2026 — IESTP Suiza: {procedimientoSeleccionado.codigo} — {procedimientoSeleccionado.denominacion}
                  </h3>
                  {procedimientoSeleccionado.descripcion && (
                    <p className="mt-1 text-xs text-slate-600">{procedimientoSeleccionado.descripcion}</p>
                  )}
                </div>
                {documentacion?.estadoValidacion === 'PENDIENTE_VALIDACION_DOCUMENTAL' && (
                  <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                    Validación documental en curso
                  </span>
                )}
              </div>

              {cargandoDoc ? (
                <p className="text-xs text-slate-500 italic">Consultando especificación documental oficial…</p>
              ) : documentacion ? (
                <div className="space-y-3 text-xs">
                  {documentacion.tarifa && (
                    <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-2.5">
                      <p className="font-bold text-blue-950">
                        Costo: S/ {Number(documentacion.tarifa.importe).toFixed(2)} ({documentacion.condicionFinanciera === 'GRATUITO' ? 'Gratuito' : 'Sujeto a pago en Tesorería tras radicación'})
                      </p>
                      <p className="text-[11px] text-slate-600">{documentacion.tarifa.concepto}</p>
                    </div>
                  )}

                  {/* Asignación Institucional y Enrutamiento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-700">
                    <div>
                      <span className="font-bold text-slate-900 block">Unidad de presentación:</span>
                      <span>{documentacion.unidadRecepcion || 'Mesa de Partes (MP)'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Unidad responsable:</span>
                      <span>{documentacion.unidadResponsable || 'Secretaría Académica (SEC)'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Autoridad resolutiva:</span>
                      <span>{documentacion.autoridadResolutiva || 'Pendiente de validación institucional'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Plazo de atención:</span>
                      <span>{documentacion.plazoDias ? `${documentacion.plazoDias} días hábiles` : 'Sujeto a evaluación reglamentaria'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Silencio administrativo:</span>
                      <span>{documentacion.silencioAdministrativo || 'Según evaluación institucional'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Versión TUPA:</span>
                      <span>{documentacion.versionTupa || 'TUPA Suiza 2026 (TUPA-2026-V1)'}</span>
                    </div>
                  </div>

                  {documentacion.observacionInstitucional && (
                    <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                      <strong>Nota oficial:</strong> {documentacion.observacionInstitucional}
                    </p>
                  )}

                  {/* Requisitos y Anexos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
                      <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1">
                        Requisitos Obligatorios ({documentacion.requisitos.filter(r => r.obligatorio).length})
                      </h4>
                      {documentacion.requisitos.length === 0 ? (
                        <p className="text-slate-500 italic text-[11px]">Solicitud general formal (FUT).</p>
                      ) : (
                        documentacion.requisitos.map(r => (
                          <div key={r.id} className="text-[11px] space-y-0.5">
                            <p className="font-semibold text-slate-800">
                              • {r.nombre} <span className={r.obligatorio ? 'text-red-700 font-bold' : 'text-slate-500'}>({r.obligatorio ? 'Obligatorio' : 'Opcional'})</span>
                            </p>
                            {r.descripcion && <p className="text-slate-500 pl-2">{r.descripcion}</p>}
                            {r.fuente && <p className="text-[10px] text-slate-400 pl-2">Fuente: {r.fuente}</p>}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                        <h4 className="font-bold text-slate-900">Anexos Específicos</h4>
                        {documentacion.sinAnexosEspecificos && (
                          <span className="text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded font-medium">
                            Sin anexos específicos
                          </span>
                        )}
                      </div>
                      {documentacion.anexos.length === 0 ? (
                        <p className="text-slate-500 italic text-[11px]">
                          {documentacion.sinAnexosEspecificos ? 'Este procedimiento no exige anexos obligatorios según TUPA.' : 'No se registran anexos específicos.'}
                        </p>
                      ) : (
                        documentacion.anexos.map(a => (
                          <div key={a.id} className="text-[11px] space-y-0.5">
                            <p className="font-semibold text-slate-800">• {a.nombre}</p>
                            {a.descripcion && <p className="text-slate-500 pl-2">{a.descripcion}</p>}
                            {a.fuente && <p className="text-[10px] text-slate-400 pl-2">Fuente: {a.fuente}</p>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          )}

          {/* Adjuntar y Foliación Correlativa Automática para Ventanilla */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Digitalización y Conteo Real de Páginas (PDF)
                </h4>
                <p className="text-xs text-slate-500">
                  Adjunte los archivos PDF escaneados en ventanilla para calcular automáticamente la foliación correlativa oficial.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 cursor-pointer">
                <span>📎 Adjuntar PDF Escaneado</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  disabled={enviando || analizandoPdf}
                  onChange={handleAdjuntarPdfVentanilla}
                  className="sr-only"
                />
              </label>
            </div>

            {analizandoPdf && (
              <p role="status" className="text-xs font-semibold text-blue-700 animate-pulse">
                ⏳ Analizando estructura del PDF y contando páginas reales en el servidor…
              </p>
            )}

            {/* Componente Resumen Documental Oficial */}
            <ResumenDocumental
              documentos={documentosAdjuntos.map(d => ({
                nombre: d.nombreArchivo,
                paginas: d.paginas,
                folioInicio: d.folioInicio,
                folioFin: d.folioFin,
                clasificacion: d.clasificacion,
                peso: d.tamanoBytes,
              }))}
              totalFolios={cantidadFolios}
            />

            {documentosAdjuntos.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {documentosAdjuntos.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-slate-400">#{idx + 1}</span>
                      <span className="font-semibold text-slate-900 truncate">{doc.nombreArchivo}</span>
                      <span className="text-[11px] font-mono text-blue-800 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                        {doc.paginas} {doc.paginas === 1 ? 'pág' : 'págs'} (Folio {doc.folioInicio} al {doc.folioFin})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEliminarPdfVentanilla(idx)}
                      disabled={enviando}
                      className="text-red-600 hover:text-red-800 font-bold text-xs px-2 py-0.5 rounded hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="asunto-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Asunto / Petitorio Concreto *
            </label>
            <textarea
              id="asunto-input"
              rows={3}
              required
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Describa brevemente el petitorio del administrado..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              disabled={enviando}
              onClick={handleNuevoRegistro}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Limpiar Campos
            </button>
            <button
              type="submit"
              disabled={enviando || cargandoTiposDocumentales || !!errorCatalogo || !tipoDocumentalSeleccionado || cargandoTupa || !!errorTupa}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition"
            >
              {enviando ? "Registrando…" : "✓ Registrar y Emitir Cargo CUT"}
            </button>
          </div>
          {errorRegistro && <p role="alert" className="text-sm text-red-700">{errorRegistro}</p>}
        </form>
      </div>

      {cargoGenerado && (
        <CargoDigitalModal
          isOpen={modalAbierto}
          onClose={() => setModalAbierto(false)}
          cargo={cargoGenerado}
          modoVentanilla={true}
          onIrBandeja={() => navigate("/expedientes")}
          onConsultarSeguimiento={(cut) => navigate(`/consulta/${cut}`)}
          onNuevoRegistro={handleNuevoRegistro}
        />
      )}

      {/* Modal de Gestión de Solicitudes de Vinculación (Mesa de Partes) */}
      {modalVinculacionesAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-vinculaciones-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Mesa de Partes</span>
                <h3 id="modal-vinculaciones-titulo" className="text-base font-bold text-slate-900">
                  Solicitudes de Vinculación de Expedientes Históricos
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalVinculacionesAbierto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Solicitudes emitidas por administrados con cuenta registrada para vincular expedientes radicados previamente de forma pública o presencial.
            </p>

            {mensajeVinculacion && (
              <div role="status" className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-900 font-semibold">
                {mensajeVinculacion}
              </div>
            )}

            {cargandoVinculaciones ? (
              <p className="py-8 text-center text-xs text-slate-500 italic">Cargando solicitudes pendientes…</p>
            ) : solicitudesVinculacion.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                No hay solicitudes de vinculación pendientes de revisión en este momento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                      <th className="py-2 px-3">CUT</th>
                      <th className="py-2 px-3">Titular del Trámite</th>
                      <th className="py-2 px-3">Cuenta Solicitante</th>
                      <th className="py-2 px-3">Motivo Declarado</th>
                      <th className="py-2 px-3 text-center">Fecha</th>
                      <th className="py-2 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {solicitudesVinculacion.map((sol) => (
                      <tr key={sol.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-900">
                          {sol.cut}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900">{sol.solicitante}</p>
                          <p className="text-[10px] text-slate-500 font-mono">DNI: {sol.dni_solicitante}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-800">{sol.nombre_usuario}</p>
                          <p className="text-[10px] text-slate-500 font-mono">DNI: {sol.dni_usuario}</p>
                        </td>
                        <td className="py-2.5 px-3 max-w-xs truncate text-slate-600">
                          {sol.motivo_solicitud || 'Sin motivo declarado'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                          {new Date(sol.creado_en).toLocaleDateString('es-PE')}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={resolviendoVinculacion}
                              onClick={() => handleResolverVinculacion(sol.id, 'APROBAR')}
                              className="rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 text-[11px]"
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              disabled={resolviendoVinculacion}
                              onClick={() => {
                                const obs = window.prompt('Indique el motivo del rechazo de la vinculación:') || undefined;
                                handleResolverVinculacion(sol.id, 'RECHAZAR', obs);
                              }}
                              className="rounded bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 text-[11px]"
                            >
                              Rechazar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalVinculacionesAbierto(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
</main>
  );
}
