import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import CargoDigitalModal from "../../components/tramite/CargoDigitalModal";
import { PROCEDIMIENTOS_TUPA_2026 } from "../../data/tupaSuiza2026";
import { useHorarioCorte } from "../../hooks/useHorarioCorte";
import type { CargoOficialTramite } from "../../types/cargoOficial";
import { apiClient } from "@/api/client";
import { ApiHttpError } from "../../types/api";

interface TipoDocumental {
  tipo_documental_id: string;
  codigo: string;
  nombre: string;
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

export default function VentanillaPresencialPage() {
  const { isAfterCutoff, requiresProjection, legalDate } = useHorarioCorte();
  const esCorteSuperado = isAfterCutoff || requiresProjection;
  const enJornada = !requiresProjection;
  const proximoDiaHabil = legalDate;

  const tipoPersona = "NATURAL";
  const tipoDoc = "DNI";
  const [numeroDoc, setNumeroDoc] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [procedimientoTupa, setProcedimientoTupa] = useState("");
  const [requisitosRecibidos, setRequisitosRecibidos] = useState<Set<number>>(new Set());
  const [tiposDocumentales, setTiposDocumentales] = useState<TipoDocumental[]>([]);
  const [tipoDocumentalId, setTipoDocumentalId] = useState("");
  const [cargandoTiposDocumentales, setCargandoTiposDocumentales] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [asunto, setAsunto] = useState("");
  const [cantidadFolios, setCantidadFolios] = useState(1);
  const [cargoGenerado, setCargoGenerado] = useState<CargoOficialTramite | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const envioEnCurso = useRef(false);
  const procedimientoSeleccionado = PROCEDIMIENTOS_TUPA_2026.find(
    (procedimiento) => procedimiento.codigo === procedimientoTupa,
  );
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (envioEnCurso.current) return;
    setErrorRegistro(null);
    if (cargandoTiposDocumentales || errorCatalogo || tiposDocumentales.length === 0) return;
    if (!tipoDocumentalSeleccionado) {
      setErrorRegistro("Seleccione un tipo documental vigente del catálogo institucional.");
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
      ? `${procedimientoSeleccionado.nombre} - ${asunto}`
      : asunto;

    envioEnCurso.current = true;
    setEnviando(true);
    try {
      const res = await apiClient.post<VentanillaPresencialResultado>(
        "/api/v1/tramites/ventanilla-presencial",
        {
          tipoPersona,
          tipoDocumento: tipoDoc,
          tipoDocumentalId: tipoDocumentalSeleccionado.tipo_documental_id,
          dniSolicitante: numeroDoc,
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          correo: correo.trim(),
          telefono: telefono.trim(),
          asunto: asuntoFinal.trim(),
          foliosTotales: Number(cantidadFolios),
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
          tipoDocumento: tipoDoc,
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
    setNumeroDoc("");
    setNombres("");
    setApellidos("");
    setErrorRegistro(null);
    setCorreo("");
    setTelefono("");
    setProcedimientoTupa("");
    setTipoDocumentalId("");
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

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
            Datos de Recepción en Ventanilla
          </h2>

          {/* Tipo de Persona */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="tipoPersona"
                checked
                readOnly
                className="text-blue-600 focus:ring-blue-500"
              />
              Persona Natural
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="tipoPersona"
                checked={false}
                disabled
                className="text-blue-600 focus:ring-blue-500"
              />
              Persona Jurídica — pendiente
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
                disabled
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="DNI">DNI (8 dígitos)</option>
                <option value="CE" disabled>Carné Extranjería (CE) — pendiente</option>
                <option value="RUC" disabled>RUC — pendiente</option>
              </select>
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
              <label htmlFor="procedimiento-tupa-select" className="block text-xs font-semibold text-slate-700 mb-1">
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Seleccione un procedimiento o servicio</option>
                <option value="NO_TUPA">Trámite no TUPA / documentación general</option>
                {PROCEDIMIENTOS_TUPA_2026.map((procedimiento) => (
                  <option key={procedimiento.codigo} value={procedimiento.codigo}>
                    {procedimiento.nombre}
                  </option>
                ))}
              </select>
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {procedimientoSeleccionado && (
            <section
              aria-labelledby="detalle-tupa-heading"
              className="rounded-lg border border-blue-200 bg-blue-50/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-200 pb-3">
                <div>
                  <h3 id="detalle-tupa-heading" className="text-sm font-bold text-slate-900">
                    TUPA 2026 — IESTP Suiza
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">Concepto seleccionado: {procedimientoSeleccionado.nombre}</p>
                </div>
                {procedimientoSeleccionado.derechoPago && (
                  <p className="max-w-xl text-sm font-semibold text-slate-800">
                    Derecho de pago: {procedimientoSeleccionado.derechoPago}
                  </p>
                )}
              </div>

              {procedimientoSeleccionado.requisitos && (
                <div className="mt-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase text-slate-700">Requisitos documentarios</h4>
                    <span className="text-xs text-slate-600">
                      {requisitosRecibidos.size} de {procedimientoSeleccionado.requisitos.length} verificados
                    </span>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {procedimientoSeleccionado.requisitos.map((requisito, index) => (
                      <li key={`${procedimientoSeleccionado.codigo}-${index}`}>
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

              {procedimientoSeleccionado.detalleTarifas && (
                <div className="mt-3">
                  <h4 className="mb-2 text-xs font-bold uppercase text-slate-700">Servicios y tarifas</h4>
                  <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                    {procedimientoSeleccionado.detalleTarifas.map((tarifa) => (
                      <li key={tarifa}>{tarifa}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(procedimientoSeleccionado.dependencia || procedimientoSeleccionado.autoridad || procedimientoSeleccionado.tiempoMaximo) && (
                <dl className="mt-3 grid gap-2 border-t border-blue-200 pt-3 text-xs sm:grid-cols-3">
                  {procedimientoSeleccionado.dependencia && (
                    <div><dt className="font-bold text-slate-700">Dependencia</dt><dd className="mt-0.5 text-slate-600">{procedimientoSeleccionado.dependencia}</dd></div>
                  )}
                  {procedimientoSeleccionado.autoridad && (
                    <div><dt className="font-bold text-slate-700">Autoridad</dt><dd className="mt-0.5 text-slate-600">{procedimientoSeleccionado.autoridad}</dd></div>
                  )}
                  {procedimientoSeleccionado.tiempoMaximo && (
                    <div><dt className="font-bold text-slate-700">Tiempo máximo</dt><dd className="mt-0.5 text-slate-600">{procedimientoSeleccionado.tiempoMaximo}</dd></div>
                  )}
                </dl>
              )}
              {procedimientoSeleccionado.nota && (
                <p className="mt-3 text-xs text-slate-600">{procedimientoSeleccionado.nota}</p>
              )}
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
              disabled={enviando || cargandoTiposDocumentales || !!errorCatalogo || !tipoDocumentalSeleccionado}
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
        />
      )}
    </main>
  );
}
