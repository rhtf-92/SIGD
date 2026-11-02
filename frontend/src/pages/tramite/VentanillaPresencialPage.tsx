import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import CargoDigitalModal from "../../components/tramite/CargoDigitalModal";
import { useHorarioCorte } from "../../hooks/useHorarioCorte";
import type { CargoOficialTramite } from "../../types/cargoOficial";
import { apiClient } from "@/api/client";
import {
  obtenerCatalogoTupaCompleto,
  obtenerRequisitosProcedimiento,
  type RegistroTupaCompleto,
  type DtoRequisitosProcedimiento,
  type DtoRequisitoTupa,
} from "../../services/procedimientosTupa.service";
import {
  contarPaginasPdfArchivo,
  recalcularRangosFolios,
  type DocumentoCargadoConFolios,
} from "../../utils/foliacionPdf";
import { obtenerDefinicionTupa } from "../../data/tupaFormulariosConfig";
import TupaDynamicFormModal from "../../components/tramite/TupaDynamicFormModal";
import { useAuthStore } from "../../stores/authStore";
import { tesoreriaService, type DtoPersonaBusqueda } from "../../services/tesoreria.service";

export function mapearEtiquetaHumanaTipo(tipo?: string | null): string {
  if (!tipo) return 'Trámite general';
  switch (tipo.toUpperCase()) {
    case 'ACTUACION_INTERNA':
      return 'Actuación interna';
    case 'PROCEDIMIENTO_APROBADO':
      return 'Procedimiento administrativo';
    case 'PROCEDIMIENTO_PENDIENTE':
      return 'Procedimiento en revisión';
    case 'SERVICIO_ACADEMICO':
      return 'Servicio académico';
    case 'SERVICIO_COMERCIAL':
      return 'Servicio comercial';
    case 'BIEN_PRODUCTIVO':
      return 'Venta de bien / Bien productivo';
    case 'OTRO_NO_RADICABLE':
      return 'Otro servicio';
    default:
      return tipo
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());
  }
}

export function normalizarParaBusqueda(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

interface OpcionComboboxTupa {
  id: string;
  codigoRef: string;
  denominacion: string;
  categoriaHumana: string;
  monto: string;
  esNoTupa?: boolean;
}

interface VentanillaPresencialResultado {
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaRadicacion: string;
  registroVersionId?: string | null;
  ordenPago?: {
    ordenPagoId: string;
    codigoPago: string;
    monto: number;
    concepto: string;
    fechaVencimiento: string;
  } | null;
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

export default function VentanillaPresencialPage() {
  const rol = useAuthStore((state) => state.usuario?.rol);
  const puedeRadicarCut = rol === 'MESA_PARTES' || rol === 'ADMINISTRADOR';
  const { isAfterCutoff, requiresProjection, legalDate } = useHorarioCorte();
  const esCorteSuperado = isAfterCutoff || requiresProjection;
  const enJornada = !requiresProjection;
  const proximoDiaHabil = legalDate;

  const [tipoPersona, setTipoPersona] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [tipoDoc, setTipoDoc] = useState<"DNI" | "RUC" | "CE">("DNI");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");

  // Búsqueda presencial de persona registrada
  const [buscandoPersona, setBuscandoPersona] = useState(false);
  const [personaEncontrada, setPersonaEncontrada] = useState<DtoPersonaBusqueda | null>(null);
  const [mensajeBusquedaPersona, setMensajeBusquedaPersona] = useState<string | null>(null);
  const [documentoFisicoVerificado, setDocumentoFisicoVerificado] = useState(false);

  // Registro de administrado nuevo sin cuenta
  const [mostrarFormularioRegistro, setMostrarFormularioRegistro] = useState(false);
  const [registrandoPersona, setRegistrandoPersona] = useState(false);
  const [nuevoNombres, setNuevoNombres] = useState("");
  const [nuevoApellidos, setNuevoApellidos] = useState("");
  const [nuevoRazonSocial, setNuevoRazonSocial] = useState("");
  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [nuevoDireccion, setNuevoDireccion] = useState("");
  const [ordenPagoGenerada, setOrdenPagoGenerada] = useState<VentanillaPresencialResultado['ordenPago'] | null>(null);

  // Documento presentado físico escaneado / digital
  const [archivoPresentado, setArchivoPresentado] = useState<File | null>(null);
  const [archivoBase64, setArchivoBase64] = useState<string | null>(null);

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setArchivoPresentado(null);
      setArchivoBase64(null);
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Solo se admiten documentos en formato PDF (%PDF- requerido).");
      e.target.value = "";
      return;
    }
    setArchivoPresentado(file);
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      setArchivoBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleBuscarPersona = async () => {
    if (!numeroDoc.trim()) {
      setMensajeBusquedaPersona("Ingrese un número de documento para buscar.");
      return;
    }
    setBuscandoPersona(true);
    setMensajeBusquedaPersona(null);
    setMostrarFormularioRegistro(false);
    try {
      const resp = await tesoreriaService.buscarPersonaPresencial(tipoDoc, numeroDoc.trim());
      const p = resp.persona ?? resp.datos;
      const encontrada = Boolean(resp.encontrada || (resp.exito && resp.datos));

      if (encontrada && p) {
        setPersonaEncontrada(p);
        setNombre(p.nombreCompleto);
        if (p.correo) setCorreo(p.correo);
        if (p.telefono) setTelefono(p.telefono);
        if (p.direccion) setDireccion(p.direccion);
        setMensajeBusquedaPersona(`✓ Administrado registrado encontrado: ${p.nombreCompleto}`);
        setDocumentoFisicoVerificado(true);
        setMostrarFormularioRegistro(false);
      } else {
        setPersonaEncontrada(null);
        setMensajeBusquedaPersona("No existe un administrado registrado. Puede registrarlo para continuar la atención presencial.");
        setMostrarFormularioRegistro(true);
        setNuevoNombres("");
        setNuevoApellidos("");
        setNuevoRazonSocial("");
        setNuevoCorreo(correo);
        setNuevoTelefono(telefono);
        setNuevoDireccion(direccion);
      }
    } catch {
      setPersonaEncontrada(null);
      setMensajeBusquedaPersona("No existe un administrado registrado. Puede registrarlo para continuar la atención presencial.");
      setMostrarFormularioRegistro(true);
    } finally {
      setBuscandoPersona(false);
    }
  };

  const handleRegistrarPersona = async (e: FormEvent) => {
    e.preventDefault();
    if (tipoPersona === 'NATURAL' && (!nuevoNombres.trim() || !nuevoApellidos.trim())) {
      alert("Ingrese nombres y apellidos para registrar al administrado.");
      return;
    }
    if (tipoPersona === 'JURIDICA' && !nuevoRazonSocial.trim()) {
      alert("Ingrese la razón social de la entidad jurídica.");
      return;
    }
    setRegistrandoPersona(true);
    try {
      const resp = await tesoreriaService.registrarPersonaPresencial({
        tipoPersona,
        tipoDocumento: tipoDoc,
        numeroDocumento: numeroDoc.trim(),
        nombres: nuevoNombres.trim() || undefined,
        apellidos: nuevoApellidos.trim() || undefined,
        razonSocial: nuevoRazonSocial.trim() || undefined,
        correo: nuevoCorreo.trim() || null,
        telefono: nuevoTelefono.trim() || null,
        direccion: nuevoDireccion.trim() || null,
      });

      const p = resp.persona;
      setPersonaEncontrada(p);
      setNombre(p.nombreCompleto);
      if (p.correo) setCorreo(p.correo);
      if (p.telefono) setTelefono(p.telefono);
      if (p.direccion) setDireccion(p.direccion);
      setMensajeBusquedaPersona(`✓ Administrado registrado exitosamente: ${p.nombreCompleto}`);
      setDocumentoFisicoVerificado(true);
      setMostrarFormularioRegistro(false);
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Error al registrar administrado presencial.");
    } finally {
      setRegistrandoPersona(false);
    }
  };
  const [procedimientoTupa, setProcedimientoTupa] = useState("");
  const [busquedaTupa, setBusquedaTupa] = useState("");
  const [procedimientos, setProcedimientos] = useState<RegistroTupaCompleto[]>([]);
  const [requisitosEstructurados, setRequisitosEstructurados] = useState<DtoRequisitosProcedimiento | null>(null);
  const [cargandoRequisitos, setCargandoRequisitos] = useState(false);
  const [documentosConFolios, setDocumentosConFolios] = useState<DocumentoCargadoConFolios[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [intentoCatalogo, setIntentoCatalogo] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [modalDinamicoAbierto, setModalDinamicoAbierto] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState("SOLICITUD");
  const [asunto, setAsunto] = useState("");
  const [cantidadFolios, setCantidadFolios] = useState(1);
  const [cargoGenerado, setCargoGenerado] = useState<CargoOficialTramite | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [comboboxAbierto, setComboboxAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!procedimientoTupa || procedimientoTupa === "NO_TUPA") {
      setRequisitosEstructurados(null);
      return;
    }
    const controller = new AbortController();
    setCargandoRequisitos(true);
    obtenerRequisitosProcedimiento(procedimientoTupa, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted && res && Array.isArray(res.requisitos)) {
          setRequisitosEstructurados(res);
        } else if (!controller.signal.aborted) {
          setRequisitosEstructurados(null);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.warn("No se pudieron cargar requisitos estructurados:", err);
          setRequisitosEstructurados(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoRequisitos(false);
      });
    return () => controller.abort();
  }, [procedimientoTupa]);

  const requisitosObligatoriosFaltantes = useMemo(() => {
    if (!requisitosEstructurados || !Array.isArray(requisitosEstructurados.anexosDigitales)) return [];
    const obligatorios = requisitosEstructurados.anexosDigitales.filter((r) => r && r.obligatorio);
    return obligatorios.filter(
      (req) => !(documentosConFolios ?? []).some((doc) => doc.idRequisito === req.idRequisito),
    );
  }, [requisitosEstructurados, documentosConFolios]);

  const handleCargarDocumentoConFolios = async (file: File, requisito?: DtoRequisitoTupa) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Solo se admiten documentos en formato PDF (%PDF- requerido).");
      return;
    }
    try {
      const paginas = await contarPaginasPdfArchivo(file);
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.includes(",") ? res.split(",")[1] : res;

        setDocumentosConFolios((anteriores) => {
          const filtrados = requisito
            ? anteriores.filter((d) => d.idRequisito !== requisito.idRequisito)
            : anteriores;

          const nuevoDoc: DocumentoCargadoConFolios = {
            id: crypto.randomUUID(),
            idRequisito: requisito?.idRequisito ?? null,
            nombreRequisito: requisito?.nombre ?? "Documento Adicional",
            archivo: file,
            nombreArchivo: file.name,
            tamanoBytes: file.size,
            paginas,
            folioInicio: 1,
            folioFin: paginas,
            hashSha256: hashHex,
            base64,
          };

          const { documentosConFolios: recalculados, totalFolios } = recalcularRangosFolios([...filtrados, nuevoDoc]);
          setCantidadFolios(totalFolios);
          return recalculados;
        });
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert("Error al procesar el archivo PDF: " + (err.message || String(err)));
    }
  };

  const handleEliminarDocumentoConFolios = (idDoc: string) => {
    setDocumentosConFolios((anteriores) => {
      const filtrados = anteriores.filter((d) => d.id !== idDoc);
      const { documentosConFolios: recalculados, totalFolios } = recalcularRangosFolios(filtrados);
      setCantidadFolios(totalFolios > 0 ? totalFolios : 1);
      return recalculados;
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setComboboxAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCargandoCatalogo(true);
    setErrorCatalogo(null);
    obtenerCatalogoTupaCompleto(controller.signal).then((registros) => {
      if (controller.signal.aborted) return;
      if (registros.length !== 72 || registros[0]?.fuente.referenciaFila !== 'p1-fila-01'
        || registros[71]?.fuente.referenciaFila !== 'p6-fila-07'
        || registros.some((r) => !obtenerDefinicionTupa(r.fuente.referenciaFila))) {
        throw new Error('El catálogo institucional no contiene las 72 entradas esperadas.');
      }
      setProcedimientos(registros);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setErrorCatalogo(cause instanceof Error ? cause.message : 'No se pudo cargar el TUPA.');
    }).finally(() => {
      if (!controller.signal.aborted) setCargandoCatalogo(false);
    });
    return () => controller.abort();
  }, [intentoCatalogo]);

  const procedimientoSeleccionado = procedimientos.find(
    (procedimiento) => procedimiento.registroVersionId === procedimientoTupa,
  );
  const definicionSeleccionada = procedimientoSeleccionado
    ? obtenerDefinicionTupa(procedimientoSeleccionado.fuente.referenciaFila) : undefined;

  const terminosBusqueda = useMemo(() => {
    return normalizarParaBusqueda(busquedaTupa).split(/\s+/).filter(Boolean);
  }, [busquedaTupa]);

  const procedimientosFiltrados = useMemo(() => {
    if (terminosBusqueda.length === 0) return procedimientos;
    return procedimientos.filter((procedimiento) => {
      const def = obtenerDefinicionTupa(procedimiento.fuente.referenciaFila);
      const etiquetaHumana = mapearEtiquetaHumanaTipo(def?.categoria);
      const texto = normalizarParaBusqueda([
        procedimiento.fuente.referenciaFila,
        procedimiento.denominacion,
        def?.categoria ?? '',
        etiquetaHumana,
        def?.tipoFormulario ?? '',
        procedimiento.monto ?? '',
      ].join(' '));
      return terminosBusqueda.every((termino) => texto.includes(termino));
    });
  }, [procedimientos, terminosBusqueda]);

  const opcionesCombobox: OpcionComboboxTupa[] = useMemo(() => {
    const lista: OpcionComboboxTupa[] = [];
    const coincideNoTupa = terminosBusqueda.length === 0 || terminosBusqueda.every((t) =>
      normalizarParaBusqueda('trámite no tupa documentación general').includes(t)
    );
    if (coincideNoTupa) {
      lista.push({
        id: 'NO_TUPA',
        codigoRef: 'GENERAL',
        denominacion: 'Trámite no TUPA / documentación general',
        categoriaHumana: 'Trámite general',
        monto: 'Sin costo',
        esNoTupa: true,
      });
    }

    for (const p of procedimientosFiltrados) {
      const def = obtenerDefinicionTupa(p.fuente.referenciaFila);
      lista.push({
        id: p.registroVersionId,
        codigoRef: p.fuente.referenciaFila,
        denominacion: p.denominacion,
        categoriaHumana: mapearEtiquetaHumanaTipo(def?.categoria),
        monto: p.monto ?? 'Gratuito',
      });
    }
    return lista;
  }, [terminosBusqueda, procedimientosFiltrados]);

  function handleSeleccionarProcedimiento(id: string) {
    setProcedimientoTupa(id);
    setDocumentosConFolios([]);
    setComboboxAbierto(false);
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!comboboxAbierto) {
        setComboboxAbierto(true);
        setIndiceActivo(0);
      } else {
        setIndiceActivo((prev) => Math.min(prev + 1, Math.max(0, opcionesCombobox.length - 1)));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (comboboxAbierto) {
        setIndiceActivo((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === "Enter") {
      if (comboboxAbierto && opcionesCombobox.length > 0) {
        e.preventDefault();
        const seleccionado = opcionesCombobox[indiceActivo];
        if (seleccionado) {
          handleSeleccionarProcedimiento(seleccionado.id);
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setComboboxAbierto(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (definicionSeleccionada && !definicionSeleccionada.generaExpediente) {
      setModalDinamicoAbierto(true);
      return;
    }
    if (!puedeRadicarCut) {
      alert('Solo Mesa de Partes o Administración pueden emitir un cargo CUT presencial.');
      return;
    }

    const etiquetaProcedimiento = procedimientoSeleccionado
      ? `${procedimientoSeleccionado.fuente.referenciaFila}: ${procedimientoSeleccionado.denominacion}`
      : null;
    const asuntoFinal = etiquetaProcedimiento ? `${etiquetaProcedimiento} - ${asunto}` : asunto;

    const docLimpio = numeroDoc.trim();
    const esDniValido = tipoDoc === "DNI" && /^[0-9]{8}$/.test(docLimpio);
    const esRucValido = tipoDoc === "RUC" && /^[0-9]{11}$/.test(docLimpio);
    const esCeValido = tipoDoc === "CE" && /^[0-9a-zA-Z]{9,12}$/.test(docLimpio);

    if (!esDniValido && !esRucValido && !esCeValido) {
      alert(`El número de ${tipoDoc} no cumple con el formato requerido.`);
      return;
    }
    if (nombre.trim().length < 2 || asuntoFinal.trim().length < 5) {
      alert("Complete remitente y asunto con valores válidos antes de radicar.");
      return;
    }

    if (requisitosObligatoriosFaltantes.length > 0) {
      const faltantesTxt = requisitosObligatoriosFaltantes.map((r) => `"${r.nombre}"`).join(", ");
      alert(`Faltan requisitos documentales obligatorios: ${faltantesTxt}. Debe adjuntar todos los documentos requeridos antes de radicar.`);
      return;
    }

    try {
      setEnviando(true);
      const documentosAdjuntos = documentosConFolios.length > 0
        ? documentosConFolios.map((d) => ({
            nombreArchivo: d.nombreArchivo,
            contenidoBase64: d.base64,
            idRequisito: d.idRequisito || undefined,
          }))
        : (archivoPresentado && archivoBase64 ? [
            {
              nombreArchivo: archivoPresentado.name,
              contenidoBase64: archivoBase64,
            }
          ] : undefined);

      const res = await apiClient.post<VentanillaPresencialResultado>(
        "/api/v1/tramites/ventanilla-presencial",
        {
          tipoDocumento: tipoDoc,
          numeroDocumento: docLimpio,
          dniSolicitante: tipoDoc === "DNI" ? docLimpio : undefined,
          solicitanteId: personaEncontrada?.idPersona,
          datosRemitente: nombre.trim(),
          correo: correo.trim() || undefined,
          telefono: telefono.trim() || undefined,
          direccion: direccion.trim() || undefined,
          asunto: asuntoFinal.trim(),
          foliosTotales: Math.max(1, Number(cantidadFolios)),
          ...(procedimientoSeleccionado
            ? { registroVersionId: procedimientoSeleccionado.registroVersionId }
            : {}),
          documentosAdjuntos,
        },
      );

      const serverData = res.data;
      const cargoServer = serverData.cargo;
      const fechaRecepcion = cargoServer.fechaRecepcion;

      if (serverData.ordenPago) {
        setOrdenPagoGenerada(serverData.ordenPago);
      } else {
        setOrdenPagoGenerada(null);
      }

      const nuevoCargo: CargoOficialTramite = {
        codigoExpediente: cargoServer.cut,
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
          tipoDocumento: tipoDoc,
          numeroDocumento: docLimpio,
          nombreOrazonSocial: nombre,
          correoElectronico: correo,
          telefono,
        },
        asunto: asuntoFinal,
        documentoPrincipalTipo: tipoDocumento,
        cantidadFolios: Number(cantidadFolios),
        hashSha256Recepcion: cargoServer.hashSha256,
        horaCorteAplicada: "16:30",
        radicadoDiaSiguiente: esCorteSuperado,
        urlSeguimiento: cargoServer.qrSeguimientoUrl,
      };

      setCargoGenerado(nuevoCargo);
      setModalAbierto(true);
    } catch (error: any) {
      console.error("[VentanillaPresencial] Error al radicar en ventanilla:", error);
      const msg = error?.response?.data?.detail || error?.response?.data?.message || error?.message || "Error al conectar con el servidor de radicación de ventanilla. Intente nuevamente.";
      alert(msg);
    } finally {
      setEnviando(false);
    }
  }

  function handleNuevoRegistro() {
    setNumeroDoc("");
    setNombre("");
    setCorreo("");
    setTelefono("");
    setDireccion("");
    setPersonaEncontrada(null);
    setMensajeBusquedaPersona(null);
    setMostrarFormularioRegistro(false);
    setDocumentoFisicoVerificado(false);
    setOrdenPagoGenerada(null);
    setProcedimientoTupa("");
    setBusquedaTupa("");
    setRequisitosEstructurados(null);
    setDocumentosConFolios([]);
    setAsunto("");
    setCantidadFolios(1);
    setArchivoPresentado(null);
    setArchivoBase64(null);
    setModalAbierto(false);
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
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  enJornada && !esCorteSuperado
                    ? "border border-emerald-200/80 bg-gradient-to-b from-white/95 via-emerald-50/80 to-teal-50/60 text-emerald-950 shadow-[0_2px_6px_rgba(16,185,129,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)]"
                    : "border border-amber-200/80 bg-gradient-to-b from-white/95 via-amber-50/80 to-orange-50/60 text-amber-950 shadow-[0_2px_6px_rgba(245,158,11,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)]"
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

      <div className="mx-auto max-w-5xl px-3.5 py-6 sm:px-6 sm:py-8">
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

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8"
        >
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
            Datos de Recepción en Ventanilla
          </h2>
          <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-white/95 via-amber-50/70 to-orange-50/40 p-3 text-xs text-amber-950 flex items-start gap-2.5 shadow-[0_2px_8px_rgba(245,158,11,0.08)] ring-1 ring-amber-100/70">
            <span>⚠️ <strong>Aviso para ventanilla:</strong> Verifique los datos del administrado y los requisitos antes de registrar la recepción.</span>
          </div>

          {/* Tipo de Persona */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="tipoPersona"
                checked={tipoPersona === "NATURAL"}
                onChange={() => {
                  setTipoPersona("NATURAL");
                  setTipoDoc("DNI");
                }}
                className="text-blue-600 focus:ring-blue-500"
              />
              Persona Natural
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="tipoPersona"
                checked={tipoPersona === "JURIDICA"}
                onChange={() => {
                  setTipoPersona("JURIDICA");
                  setTipoDoc("RUC");
                }}
                className="text-blue-600 focus:ring-blue-500"
              />
              Persona Jurídica
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="tipo-doc-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo Documento Identidad *
              </label>
              <select
                id="tipo-doc-select"
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value as "DNI" | "RUC" | "CE")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                {tipoPersona === "NATURAL" ? (
                  <>
                    <option value="DNI">DNI (8 dígitos)</option>
                    <option value="CE">Carné Extranjería (CE)</option>
                  </>
                ) : (
                  <option value="RUC">RUC (11 dígitos)</option>
                )}
              </select>
            </div>

            <div>
              <label htmlFor="num-doc-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Documento *
              </label>
              <div className="flex gap-2">
                <input
                  id="num-doc-input"
                  type="text"
                  required
                  value={numeroDoc}
                  onChange={(e) => {
                    setNumeroDoc(e.target.value);
                    setPersonaEncontrada(null);
                    setMensajeBusquedaPersona(null);
                  }}
                  placeholder={tipoDoc === "DNI" ? "8 dígitos" : "11 dígitos"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={buscandoPersona}
                  onClick={() => void handleBuscarPersona()}
                  className="shrink-0 rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold text-white hover:bg-blue-900 transition disabled:opacity-50"
                  title="Buscar en base de datos ciudadana institucional"
                >
                  {buscandoPersona ? "..." : "Buscar"}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="nombre-input" className="block text-xs font-semibold text-slate-700 mb-1">
                {tipoPersona === "NATURAL" ? "Apellidos y Nombres *" : "Razón Social *"}
              </label>
              <input
                id="nombre-input"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {mensajeBusquedaPersona && (
            <div
              className={`rounded-xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border ${
                personaEncontrada
                  ? "bg-emerald-50/90 text-emerald-900 border-emerald-300 shadow-xs"
                  : "bg-amber-50/90 text-amber-900 border-amber-300 shadow-xs"
              }`}
            >
              <div className="space-y-0.5">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <span>{personaEncontrada ? "✓" : "ℹ️"}</span>
                  <span>{mensajeBusquedaPersona}</span>
                </p>
                {personaEncontrada && (
                  <p className="text-xs text-emerald-800 font-mono">
                    Doc: <strong>{personaEncontrada.documentoEnmascarado}</strong> · Cuenta web:{" "}
                    <span className="font-semibold">{personaEncontrada.tieneCuentaUsuario ? "Activa" : "Sin cuenta (atención presencial)"}</span>
                  </p>
                )}
              </div>
              {personaEncontrada && (
                <label className="flex items-center gap-2 font-bold text-xs text-emerald-950 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-emerald-300 shadow-xs shrink-0">
                  <input
                    type="checkbox"
                    checked={documentoFisicoVerificado}
                    onChange={(e) => setDocumentoFisicoVerificado(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Doc. físico verificado</span>
                </label>
              )}
            </div>
          )}

          {/* Formulario de Alta de Administrado Presencial sin Cuenta */}
          {mostrarFormularioRegistro && !personaEncontrada && (
            <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>Registrar Administrado para Atención Presencial</span>
                  </h3>
                  <p className="text-xs text-blue-800 mt-0.5">
                    Registro administrativo sin creación de cuenta de usuario web (persona natural/jurídica independiente).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarFormularioRegistro(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Ocultar
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tipoPersona === 'NATURAL' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
                      <input
                        type="text"
                        required
                        value={nuevoNombres}
                        onChange={(e) => setNuevoNombres(e.target.value)}
                        placeholder="Nombres del administrado"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
                      <input
                        type="text"
                        required
                        value={nuevoApellidos}
                        onChange={(e) => setNuevoApellidos(e.target.value)}
                        placeholder="Apellidos completos"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Social *</label>
                    <input
                      type="text"
                      required
                      value={nuevoRazonSocial}
                      onChange={(e) => setNuevoRazonSocial(e.target.value)}
                      placeholder="Nombre o razón social institucional"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono / Celular</label>
                  <input
                    type="tel"
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                    placeholder="9XXXXXXXX"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={nuevoCorreo}
                    onChange={(e) => setNuevoCorreo(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección / Domicilio</label>
                  <input
                    type="text"
                    value={nuevoDireccion}
                    onChange={(e) => setNuevoDireccion(e.target.value)}
                    placeholder="Av. / Jr. / Calle y número"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-blue-200">
                <button
                  type="button"
                  onClick={() => setMostrarFormularioRegistro(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={registrandoPersona}
                  onClick={(e) => void handleRegistrarPersona(e)}
                  className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {registrandoPersona ? "Registrando..." : "Registrar y Continuar"}
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="correo-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Correo Electrónico de Contacto *
              </label>
              <input
                id="correo-input"
                type="email"
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
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="9XXXXXXXX"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Selector y Buscador Combobox TUPA 2026 */}
          <div className="space-y-3">
            {/* Control accesible y sincrónico para lectores de pantalla y compatibilidad */}
            <label
              htmlFor="procedimiento-tupa-select"
              className="sr-only"
            >
              Procedimiento TUPA 2026 *
            </label>
            <select
              id="procedimiento-tupa-select"
              required
              value={procedimientoTupa}
              onChange={(e) => {
                setProcedimientoTupa(e.target.value);
                setDocumentosConFolios([]);
              }}
              disabled={cargandoCatalogo || Boolean(errorCatalogo)}
              className="sr-only"
              tabIndex={-1}
            >
              <option value="">Seleccione un procedimiento o servicio</option>
              <option value="NO_TUPA">Trámite no TUPA / documentación general</option>
              {procedimientosFiltrados.map((procedimiento) => (
                <option
                  key={procedimiento.registroVersionId}
                  value={procedimiento.registroVersionId}
                >
                  {procedimiento.fuente.referenciaFila} — {procedimiento.denominacion} — {obtenerDefinicionTupa(procedimiento.fuente.referenciaFila)?.categoria} — {procedimiento.monto ?? 'Monto no indicado'}
                </option>
              ))}
            </select>

            {/* Combobox Moderno y Filtrable (cuando no hay selección o al pulsar Cambiar) */}
            {!procedimientoTupa ? (
              <div ref={comboboxRef} className="relative">
                <label
                  htmlFor="tupa-combobox-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Búsqueda y Selección en Catálogo TUPA 2026
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    id="tupa-combobox-input"
                    type="search"
                    role="combobox"
                    aria-expanded={comboboxAbierto}
                    aria-controls="tupa-combobox-listbox"
                    aria-autocomplete="list"
                    aria-activedescendant={indiceActivo >= 0 ? `tupa-opcion-${indiceActivo}` : undefined}
                    aria-label="Buscar TUPA por nombre, código o categoría"
                    placeholder="Buscar: mango, p2-fila-09, certificado, tipo..."
                    value={busquedaTupa}
                    onChange={(event) => {
                      setBusquedaTupa(event.target.value);
                      setComboboxAbierto(true);
                      setIndiceActivo(0);
                    }}
                    onFocus={() => setComboboxAbierto(true)}
                    onKeyDown={handleInputKeyDown}
                    disabled={cargandoCatalogo || Boolean(errorCatalogo)}
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-12 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100"
                  />
                  {busquedaTupa && (
                    <button
                      type="button"
                      onClick={() => {
                        setBusquedaTupa("");
                        setIndiceActivo(0);
                      }}
                      className="absolute inset-y-0 right-7 flex items-center pr-1 text-slate-400 hover:text-slate-600 min-h-[44px] w-6 justify-center"
                      aria-label="Limpiar búsqueda"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setComboboxAbierto((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 min-h-[44px]"
                    aria-label="Desplegar catálogo de procedimientos"
                    tabIndex={-1}
                  >
                    <svg className={`h-4 w-4 transition-transform duration-200 ${comboboxAbierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Dropdown de Opciones Filtradas */}
                {comboboxAbierto && !cargandoCatalogo && !errorCatalogo && (
                  <ul
                    id="tupa-combobox-listbox"
                    role="listbox"
                    aria-label="Resultados de procedimientos TUPA 2026"
                    className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5"
                  >
                    {opcionesCombobox.length === 0 ? (
                      <li className="px-4 py-4 text-center text-xs text-slate-500">
                        No se encontraron procedimientos para &ldquo;{busquedaTupa}&rdquo;
                      </li>
                    ) : (
                      opcionesCombobox.map((opc, idx) => {
                        const activo = idx === indiceActivo;
                        return (
                          <li
                            key={opc.id}
                            id={`tupa-opcion-${idx}`}
                            role="option"
                            aria-selected={opc.id === procedimientoTupa}
                            onClick={() => handleSeleccionarProcedimiento(opc.id)}
                            onMouseEnter={() => setIndiceActivo(idx)}
                            className={`cursor-pointer px-4 py-2.5 text-left transition ${
                              activo ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-900'
                            }`}
                          >
                            <div className="font-semibold text-sm leading-snug">
                              {opc.denominacion}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono font-bold text-blue-800">
                                {opc.codigoRef}
                              </span>
                              <span>·</span>
                              <span className="font-medium text-slate-700">
                                {opc.categoriaHumana}
                              </span>
                              <span>·</span>
                              <span className={opc.monto && opc.monto !== 'Gratuito' && opc.monto !== 'Sin costo' ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
                                {opc.monto}
                              </span>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}

                {cargandoCatalogo && <p role="status" className="mt-1 text-xs text-slate-500">Cargando catálogo TUPA…</p>}
                {errorCatalogo && !cargandoCatalogo && (
                  <div role="alert" className="mt-1 text-xs text-red-600">
                    {errorCatalogo}{" "}
                    <button type="button" onClick={() => setIntentoCatalogo((n) => n + 1)} className="font-semibold underline ml-1">
                      Reintentar
                    </button>
                  </div>
                )}
                {!cargandoCatalogo && !errorCatalogo && (
                  <p className="mt-1 text-xs text-slate-600">
                    {procedimientos.length} entradas TUPA disponibles (18 CUT, 49 SOL, 5 internas).
                  </p>
                )}
              </div>
            ) : (
              /* Tarjeta Resumen del Procedimiento Seleccionado */
              <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 p-4 shadow-sm ring-1 ring-blue-100">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-800">
                        {procedimientoSeleccionado ? procedimientoSeleccionado.fuente.referenciaFila : 'GENERAL'}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {procedimientoSeleccionado ? mapearEtiquetaHumanaTipo(definicionSeleccionada?.categoria) : 'Trámite general'}
                      </span>
                      {procedimientoSeleccionado && (
                        <span className="inline-flex items-center rounded-md bg-cyan-100 px-2 py-0.5 text-xs font-mono font-semibold text-cyan-800">
                          {`${procedimientoSeleccionado.fuente.referenciaFila} · ${definicionSeleccionada?.tipoFormulario ?? 'DOCUMENTARIO'} · ${definicionSeleccionada?.generaExpediente ? 'CUT' : 'DIRECTO'}`}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        {procedimientoSeleccionado ? (procedimientoSeleccionado.monto ?? 'Gratuito') : 'Sin costo'}
                      </span>
                      {definicionSeleccionada?.plazo && (
                        <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Plazo: {definicionSeleccionada.plazo}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug break-words">
                      {procedimientoSeleccionado ? procedimientoSeleccionado.denominacion : 'Trámite no TUPA / documentación general'}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {procedimientoSeleccionado ? (
                        <>
                          Código: <strong className="font-mono text-slate-800">{procedimientoSeleccionado.fuente.referenciaFila}</strong> · Tipo: <strong className="text-slate-800">{mapearEtiquetaHumanaTipo(definicionSeleccionada?.categoria)}</strong> · Costo: <strong className="text-slate-800">{procedimientoSeleccionado.monto ?? 'Gratuito'}</strong> · Plazo: <strong className="text-slate-800">{definicionSeleccionada?.plazo ?? '15 días'}</strong>
                        </>
                      ) : (
                        'Recepción de documentación libre, petitorio general o documentos no tabulados en TUPA.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProcedimientoTupa('');
                      setBusquedaTupa('');
                      setComboboxAbierto(true);
                      setIndiceActivo(0);
                    }}
                    className="inline-flex shrink-0 items-center justify-center min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    aria-label="Cambiar procedimiento"
                  >
                    Cambiar procedimiento
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tipo-documento-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Documento Presentado *
              </label>
              <select
                id="tipo-documento-select"
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="SOLICITUD">Solicitud Simple / Formato Único</option>
                <option value="OFICIO">Oficio Institucional</option>
                <option value="CARTA">Carta / Carta Notarial</option>
                <option value="EXPEDIENTE_EXTERNO">Expediente Externo</option>
                <option value="INFORME">Informe Técnico</option>
              </select>
            </div>

            <div>
              <label htmlFor="folios-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Cantidad de Folios Físicos *
              </label>
              <input
                id="folios-input"
                type="number"
                min={1}
                max={500}
                required
                value={cantidadFolios}
                onChange={(e) => setCantidadFolios(Number(e.target.value))}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono focus:border-blue-600 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Calculado automáticamente según páginas físicas de los PDFs adjuntos.
              </p>
            </div>
          </div>

          {/* SECCIÓN GUIADA DE REQUISITOS Y FOLIACIÓN CONTINUA */}
          {cargandoRequisitos && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-center text-xs text-blue-700 font-medium animate-pulse">
              Cargando requisitos documentales oficiales del procedimiento...
            </div>
          )}

          {procedimientoSeleccionado && (
            <section aria-label="Detalle del procedimiento TUPA seleccionado" className="space-y-4">
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900">{procedimientoSeleccionado.denominacion}</h3>
                  <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-800 font-mono">
                    {procedimientoSeleccionado.fuente.referenciaFila}
                  </span>
                </div>
                <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                  <p>{`Monto TUPA: ${procedimientoSeleccionado.monto ?? 'Gratuito'}`}</p>
                  <p>{`Fuente: ${procedimientoSeleccionado.fuente.nombre} (Pág. ${procedimientoSeleccionado.fuente.pagina})`}</p>
                  <p><strong>Clasificación:</strong> {definicionSeleccionada?.tipoFormulario ?? 'DOCUMENTARIO'}</p>
                  <p><strong>Régimen:</strong> {definicionSeleccionada?.generaExpediente ? 'Emisión CUT' : 'Servicio Directo'}</p>
                </div>
              </div>

              {/* LISTA ESTRUCTURADA DE REQUISITOS OFICIALES */}
              {requisitosEstructurados && Array.isArray(requisitosEstructurados.requisitos) && requisitosEstructurados.requisitos.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Requisitos Oficiales del Procedimiento TUPA
                      </h4>
                      <p className="text-xs text-slate-500">
                        {requisitosEstructurados.totalAnexosObligatorios > 0
                          ? `${requisitosEstructurados.totalAnexosObligatorios} anexo(s) obligatorio(s) requerido(s)`
                          : 'Este procedimiento no exige anexos documentales obligatorios'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {documentosConFolios.filter((d) => d.idRequisito).length} de {requisitosEstructurados.requisitos.length} atendidos
                    </span>
                  </div>

                  <div className="space-y-3">
                    {requisitosEstructurados.requisitos.map((req, idx) => {
                      const docAdjunto = documentosConFolios.find((d) => d.idRequisito === req.idRequisito);
                      const esObligatorio = req.obligatorio;

                      return (
                        <div
                          key={req.idRequisito || `req-${idx}`}
                          className={`rounded-lg border p-3.5 transition text-xs ${
                            docAdjunto
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : esObligatorio && req.esAnexoDigital
                              ? 'border-amber-300 bg-amber-50/40'
                              : 'border-slate-200 bg-slate-50/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-500 text-[11px]">{idx + 1}.</span>
                              <span className="font-bold text-slate-900">{req.nombre}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  req.tipoRequisito === 'DOCUMENTAL'
                                    ? 'bg-blue-100 text-blue-800'
                                    : req.tipoRequisito === 'FINANCIERO'
                                    ? 'bg-amber-100 text-amber-800'
                                    : req.tipoRequisito === 'INTERNO'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {req.tipoRequisito}
                              </span>
                              {esObligatorio ? (
                                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                  [Obligatorio]
                                </span>
                              ) : (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  [Opcional]
                                </span>
                              )}
                            </div>
                          </div>

                          {req.descripcion && (
                            <p className="text-slate-500 text-[11px] mb-2">{req.descripcion}</p>
                          )}

                          {req.esAnexoDigital ? (
                            <div>
                              {docAdjunto ? (
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-white border border-emerald-200 px-3 py-2">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="font-bold text-emerald-700">✓ [Cargado]</span>
                                    <span className="font-medium text-slate-800 truncate">{docAdjunto.nombreArchivo}</span>
                                    <span className="text-slate-400 font-mono text-[10px]">
                                      ({(docAdjunto.tamanoBytes / 1024).toFixed(1)} KB)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="rounded-sm bg-blue-100 px-2 py-0.5 text-[11px] font-bold font-mono text-blue-800">
                                      {docAdjunto.paginas} {docAdjunto.paginas === 1 ? 'pág' : 'págs'} · Folios {docAdjunto.folioInicio}–{docAdjunto.folioFin}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleEliminarDocumentoConFolios(docAdjunto.id)}
                                      className="text-red-600 hover:text-red-800 font-bold hover:underline cursor-pointer"
                                    >
                                      Quitar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    {esObligatorio ? (
                                      <span className="font-semibold text-amber-700">⚠️ [!] Requerido sin archivo</span>
                                    ) : (
                                      <span className="text-slate-400 font-medium">○ [Opcional] Sin archivo cargado</span>
                                    )}
                                  </div>
                                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-blue-500 shadow-2xs">
                                    <span>Adjuntar PDF para este requisito</span>
                                    <input
                                      type="file"
                                      accept="application/pdf"
                                      className="sr-only"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleCargarDocumentoConFolios(file, req);
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] text-slate-500 italic bg-white/70 rounded p-1.5 border border-slate-200">
                              ℹ️ Requisito {req.tipoRequisito.toLowerCase()}: Gestionado como trámite institucional (no requiere adjunto PDF).
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* CARGA DE DOCUMENTOS ADICIONALES */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Documentos Adicionales Presentados
                  </h4>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100/70 shadow-2xs">
                    <span>+ Adjuntar documento adicional (PDF)</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCargarDocumentoConFolios(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {documentosConFolios.filter((d) => !d.idRequisito).length > 0 && (
                  <div className="space-y-2">
                    {documentosConFolios
                      .filter((d) => !d.idRequisito)
                      .map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="font-semibold text-slate-800 truncate">{doc.nombreArchivo}</span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              ({(doc.tamanoBytes / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-sm bg-blue-100 px-2 py-0.5 text-[11px] font-bold font-mono text-blue-800">
                              {doc.paginas} {doc.paginas === 1 ? 'pág' : 'págs'} · Folios {doc.folioInicio}–{doc.folioFin}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEliminarDocumentoConFolios(doc.id)}
                              className="text-red-600 hover:text-red-800 font-bold hover:underline cursor-pointer"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* RESUMEN DE FOLIACIÓN FÍSICA AUTORITATIVA */}
              {documentosConFolios.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 pb-2">
                    <span className="font-bold uppercase tracking-wider text-blue-900">
                      Resumen de Foliación Física Continua
                    </span>
                    <span className="font-bold text-blue-900">
                      TOTAL: {documentosConFolios.length} documento(s) · {cantidadFolios} folio(s) útiles
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                    {documentosConFolios.map((doc, idx) => (
                      <span
                        key={`folio-item-${idx}`}
                        className="rounded bg-white border border-blue-200 px-2 py-1 text-slate-700 shadow-2xs"
                      >
                        Doc {idx + 1}: Folios <strong>{doc.folioInicio}–{doc.folioFin}</strong> ({doc.paginas} pág.)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ALERTA DE BLOQUEO SI FALTAN REQUISITOS OBLIGATORIOS */}
              {requisitosObligatoriosFaltantes.length > 0 && (
                <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-red-800">
                    <span>⚠️</span>
                    <span>Requisitos documentales obligatorios pendientes</span>
                  </div>
                  <p>
                    Faltan los siguientes documentos obligatorios según el TUPA oficial:
                  </p>
                  <ul className="list-disc list-inside font-semibold space-y-0.5 pt-1">
                    {requisitosObligatoriosFaltantes.map((f, i) => (
                      <li key={`faltante-${i}`}>{f.nombre}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-red-700 pt-1">
                    Debe adjuntar cada documento requerido antes de poder radicar el expediente y emitir el CUT.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* MODO GENERAL O NO-TUPA: CARGA SIMPLE CON DETECCIÓN DE PÁGINAS */}
          {(!procedimientoSeleccionado || procedimientoTupa === "NO_TUPA") && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <label htmlFor="archivo-presentado-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Documentación Sustentatoria Principal en PDF (%PDF-)
              </label>
              <input
                id="archivo-presentado-input"
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCargarDocumentoConFolios(file);
                  handleArchivoChange(e);
                }}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 focus:border-blue-600 focus:outline-none"
              />
              {documentosConFolios.length > 0 && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-xs space-y-1">
                  <p className="font-bold text-emerald-800">✓ Documentos cargados con foliación automática:</p>
                  {documentosConFolios.map((doc, i) => (
                    <div key={`no-tupa-doc-${i}`} className="flex justify-between items-center text-slate-700 font-mono text-[11px]">
                      <span>{doc.nombreArchivo} ({(doc.tamanoBytes / 1024).toFixed(1)} KB)</span>
                      <span className="font-bold text-blue-700">Folios {doc.folioInicio}–{doc.folioFin} ({doc.paginas} págs)</span>
                    </div>
                  ))}
                  <p className="font-bold text-slate-900 pt-1 border-t border-emerald-200">
                    TOTAL FOLIOS: {cantidadFolios}
                  </p>
                </div>
              )}
            </div>
          )}

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

          {ordenPagoGenerada && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span>💳</span>
                <span>Orden de Pago Generada: {ordenPagoGenerada.codigoPago}</span>
              </p>
              <p>
                Monto oficial a recaudar: <strong>S/ {Number(ordenPagoGenerada.monto).toFixed(2)}</strong> ({ordenPagoGenerada.concepto}).
                El expediente ha quedado registrado y bloqueado para derivación hasta la confirmación del pago en Tesorería.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            {!puedeRadicarCut && (!definicionSeleccionada || definicionSeleccionada.generaExpediente) &&
              <p className="text-xs text-amber-800">La emisión de CUT presencial requiere Mesa de Partes o Administración.</p>}
            <button
              type="button"
              onClick={handleNuevoRegistro}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Limpiar Campos
            </button>
            <button
              type={definicionSeleccionada && !definicionSeleccionada.generaExpediente ? 'button' : 'submit'}
              onClick={definicionSeleccionada && !definicionSeleccionada.generaExpediente
                ? () => setModalDinamicoAbierto(true) : undefined}
              disabled={((!definicionSeleccionada || definicionSeleccionada.generaExpediente) && !puedeRadicarCut) || enviando}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition"
            >
              {definicionSeleccionada && !definicionSeleccionada.generaExpediente ? 'Abrir formulario específico' : '✓ Registrar y Emitir Cargo CUT'}
            </button>
          </div>
        </form>
      </div>

      {cargoGenerado && (
        <CargoDigitalModal
          isOpen={modalAbierto}
          onClose={() => setModalAbierto(false)}
          cargo={cargoGenerado}
        />
      )}
      <TupaDynamicFormModal key={definicionSeleccionada?.codigoRef} isOpen={modalDinamicoAbierto} codigoInicial={definicionSeleccionada?.codigoRef}
        solicitanteInicial={{ tipoPersona, numeroDocumento: numeroDoc, correo }}
        codigosDisponibles={procedimientos.map((registro) => registro.fuente.referenciaFila)}
        onClose={() => setModalDinamicoAbierto(false)} />
    </main>
  );
}
