import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import CargoDigitalModal from "../../components/tramite/CargoDigitalModal";
import { useHorarioCorte } from "../../hooks/useHorarioCorte";
import type { CargoOficialTramite } from "../../types/cargoOficial";
import { apiClient } from "@/api/client";
import { obtenerCatalogoTupaCompleto, type RegistroTupaCompleto } from "../../services/procedimientosTupa.service";
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

  // Búsqueda presencial de persona registrada
  const [buscandoPersona, setBuscandoPersona] = useState(false);
  const [personaEncontrada, setPersonaEncontrada] = useState<DtoPersonaBusqueda | null>(null);
  const [mensajeBusquedaPersona, setMensajeBusquedaPersona] = useState<string | null>(null);
  const [documentoFisicoVerificado, setDocumentoFisicoVerificado] = useState(false);

  const handleBuscarPersona = async () => {
    if (!numeroDoc.trim()) {
      setMensajeBusquedaPersona("Ingrese un número de documento para buscar.");
      return;
    }
    setBuscandoPersona(true);
    setMensajeBusquedaPersona(null);
    try {
      const resp = await tesoreriaService.buscarPersonaPresencial(tipoDoc, numeroDoc.trim());
      if (resp.exito && resp.datos) {
        setPersonaEncontrada(resp.datos);
        setNombre(resp.datos.nombreCompleto);
        setMensajeBusquedaPersona(`✓ Administrado registrado encontrado: ${resp.datos.nombreCompleto}`);
        setDocumentoFisicoVerificado(true);
      } else {
        setPersonaEncontrada(null);
        setMensajeBusquedaPersona("No se encontró registro previo en la base institucional. Ingrese los datos manualmente.");
      }
    } catch {
      setPersonaEncontrada(null);
      setMensajeBusquedaPersona("No se encontró registro previo en la base institucional. Ingrese los datos manualmente.");
    } finally {
      setBuscandoPersona(false);
    }
  };
  const [procedimientoTupa, setProcedimientoTupa] = useState("");
  const [busquedaTupa, setBusquedaTupa] = useState("");
  const [procedimientos, setProcedimientos] = useState<RegistroTupaCompleto[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [intentoCatalogo, setIntentoCatalogo] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [modalDinamicoAbierto, setModalDinamicoAbierto] = useState(false);
  const [requisitosRecibidos, setRequisitosRecibidos] = useState<Set<number>>(new Set());
  const [tipoDocumento, setTipoDocumento] = useState("SOLICITUD");
  const [asunto, setAsunto] = useState("");
  const [cantidadFolios, setCantidadFolios] = useState(1);
  const [cargoGenerado, setCargoGenerado] = useState<CargoOficialTramite | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [comboboxAbierto, setComboboxAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const comboboxRef = useRef<HTMLDivElement>(null);

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
    setRequisitosRecibidos(new Set());
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

    if (!/^[0-9]{8}$/.test(numeroDoc) || nombre.trim().length < 2 || asuntoFinal.trim().length < 5) {
      alert("Complete DNI, remitente y asunto con valores válidos antes de radicar.");
      return;
    }

    try {
      setEnviando(true);
      const res = await apiClient.post<VentanillaPresencialResultado>(
        "/api/v1/tramites/ventanilla-presencial",
        {
          dniSolicitante: numeroDoc,
          datosRemitente: nombre.trim(),
          asunto: asuntoFinal.trim(),
          foliosTotales: Number(cantidadFolios),
          ...(procedimientoSeleccionado
            ? { registroVersionId: procedimientoSeleccionado.registroVersionId }
            : {}),
        },
      );

      const serverData = res.data;
      const cargoServer = serverData.cargo;
      const fechaRecepcion = cargoServer.fechaRecepcion;

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
          numeroDocumento: numeroDoc,
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
    } catch (error) {
      console.error("[VentanillaPresencial] Error al radicar en ventanilla:", error);
      alert("Error al conectar con el servidor de radicación de ventanilla. Intente nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  function handleNuevoRegistro() {
    setNumeroDoc("");
    setNombre("");
    setCorreo("");
    setTelefono("");
    setProcedimientoTupa("");
    setBusquedaTupa("");
    setRequisitosRecibidos(new Set());
    setAsunto("");
    setCantidadFolios(1);
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
              className={`rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border ${
                personaEncontrada
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <div>
                <p className="font-semibold">{mensajeBusquedaPersona}</p>
                {personaEncontrada && (
                  <p className="text-[11px] text-emerald-700 mt-0.5 font-mono">
                    Documento: {personaEncontrada.documentoEnmascarado} · Cuenta de usuario:{" "}
                    {personaEncontrada.tieneCuentaUsuario ? "Activa" : "No registrada"}
                  </p>
                )}
              </div>
              {personaEncontrada && (
                <label className="flex items-center gap-1.5 font-bold text-xs text-emerald-950 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-xs shrink-0">
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
                setRequisitosRecibidos(new Set());
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
            </div>
          </div>

          {procedimientoSeleccionado && (
            <section aria-label="Detalle del procedimiento TUPA seleccionado">
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm">
                <h3 className="font-semibold">{procedimientoSeleccionado.denominacion}</h3>
                <p>{procedimientoSeleccionado.fuente.referenciaFila} · {definicionSeleccionada?.tipoFormulario} · {definicionSeleccionada?.generaExpediente ? 'CUT' : definicionSeleccionada?.bloqueadoParaCiudadano ? 'INTERNO' : 'SOL'}</p>
                <p>Monto TUPA: {procedimientoSeleccionado.monto ?? 'No indicado'}</p>
                <p>Fuente: {procedimientoSeleccionado.fuente.nombre}, página {procedimientoSeleccionado.fuente.pagina}, revisión {procedimientoSeleccionado.revision}</p>
                {(procedimientoSeleccionado.vigenciaDesde || procedimientoSeleccionado.vigenciaHasta) &&
                  <p>Vigencia: {procedimientoSeleccionado.vigenciaDesde ?? 'sin inicio'} a {procedimientoSeleccionado.vigenciaHasta ?? 'sin fin'}</p>}
                <p>Estado de validación: {procedimientoSeleccionado.estadoValidacion}</p>
                {procedimientoSeleccionado.requisitos.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase text-slate-700">Requisitos documentarios</h4>
                      <span className="text-xs text-slate-600">
                        {requisitosRecibidos.size} de {procedimientoSeleccionado.requisitos.length} verificados
                      </span>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {procedimientoSeleccionado.requisitos.map((requisito, index) => (
                        <li key={`${procedimientoSeleccionado.registroVersionId}-${index}`}>
                          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={requisitosRecibidos.has(index)}
                              onChange={(event) => {
                                setRequisitosRecibidos((actuales) => {
                                  const siguientes = new Set(actuales);
                                  if (event.target.checked) siguientes.add(index);
                                  else siguientes.delete(index);
                                  return siguientes;
                                });
                              }}
                              className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                            />
                            <span>{requisito}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
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
