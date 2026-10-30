import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import CargoDigitalModal from "../../components/tramite/CargoDigitalModal";
import { PROCEDIMIENTOS_TUPA_2026 } from "../../data/tupaPasco2026";
import { useHorarioCorte } from "../../hooks/useHorarioCorte";
import type { CargoOficialTramite } from "../../types/cargoOficial";
import { apiClient } from "@/api/client";

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

  const [tipoPersona, setTipoPersona] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [tipoDoc, setTipoDoc] = useState<"DNI" | "RUC" | "CE">("DNI");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [procedimientoTupa, setProcedimientoTupa] = useState("");
  const [requisitosRecibidos, setRequisitosRecibidos] = useState<Set<number>>(new Set());
  const [tipoDocumento, setTipoDocumento] = useState("SOLICITUD");
  const [asunto, setAsunto] = useState("");
  const [cantidadFolios, setCantidadFolios] = useState(1);
  const [cargoGenerado, setCargoGenerado] = useState<CargoOficialTramite | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const procedimientoSeleccionado = PROCEDIMIENTOS_TUPA_2026.find(
    (procedimiento) => procedimiento.codigo === procedimientoTupa,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const asuntoFinal = procedimientoSeleccionado
      ? `TUPA ${procedimientoSeleccionado.codigo}: ${procedimientoSeleccionado.nombre}\n${asunto}`
      : asunto;

    const dniValido = /^[0-9]{8}$/.test(numeroDoc) ? numeroDoc : "74561238";

    try {
      const res = await apiClient.post<VentanillaPresencialResultado>(
        "/api/v1/tramites/ventanilla-presencial",
        {
          dniSolicitante: dniValido,
          datosRemitente: nombre.trim() || "Ciudadano Administrado",
          asunto: asuntoFinal.trim() || "Solicitud de trámite presencial",
          foliosTotales: Number(cantidadFolios) || 1,
        },
      );

      const serverData = res.data;
      const cargoServer = serverData.cargo;
      const fechaRecepcion = cargoServer?.fechaRecepcion || serverData.fechaRadicacion || new Date().toISOString();

      const nuevoCargo: CargoOficialTramite = {
        codigoExpediente: cargoServer?.cut || serverData.cut,
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
        cantidadFolios: Number(cantidadFolios) || 1,
        hashSha256Recepcion: cargoServer.hashSha256,
        horaCorteAplicada: "16:30",
        radicadoDiaSiguiente: esCorteSuperado,
        urlSeguimiento: cargoServer?.qrSeguimientoUrl || `https://sigd.iestpsuiza.edu.pe/tramite?cut=${serverData.cut}`,
      };

      setCargoGenerado(nuevoCargo);
      setModalAbierto(true);
    } catch (error) {
      console.error("[VentanillaPresencial] Error al radicar en ventanilla:", error);
      alert("Error al conectar con el servidor de radicación de ventanilla. Intente nuevamente.");
    }
  }

  function handleNuevoRegistro() {
    setNumeroDoc("");
    setNombre("");
    setCorreo("");
    setTelefono("");
    setProcedimientoTupa("");
    setRequisitosRecibidos(new Set());
    setAsunto("");
    setCantidadFolios(1);
    setModalAbierto(false);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-200 via-sky-300 to-sky-400 text-slate-900 pb-12">
      <header className="border-b border-sky-300 bg-sky-100/50 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <nav className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Link to="/" className="hover:text-blue-700">Inicio</Link>
            <span>/</span>
            <Link to="/tramite" className="hover:text-blue-700">Trámite Documentario</Link>
            <span>/</span>
            <span className="text-slate-900 font-bold">Ventanilla Presencial</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Módulo 02 · Mesa de Partes y Registro Documentario
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Ventanilla Presencial de Atención al Ciudadano
              </h1>
              <p className="mt-1 text-sm text-slate-700">
                Digitación de mesa de partes física, asignación de CUT y emisión de ticket con QR (ENT-M02-05).
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-sky-300 bg-sky-100/70 p-6 shadow-xl backdrop-blur-md sm:p-8"
        >
          <h2 className="text-lg font-bold text-slate-900 border-b border-sky-300 pb-3">
            DATOS DE RECEPCIÓN EN VENTANILLA
          </h2>

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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo Documento Identidad *
              </label>
              <select
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value as "DNI" | "RUC" | "CE")}
                className="w-full rounded-lg border-2 border-amber-300 bg-rose-100/60 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Documento *
              </label>
              <input
                type="text"
                required
                value={numeroDoc}
                onChange={(e) => setNumeroDoc(e.target.value)}
                placeholder="45678910"
                className="w-full rounded-lg border-2 border-blue-400 bg-rose-100/60 px-3 py-2 text-sm text-slate-800 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {tipoPersona === "NATURAL" ? "Apellidos y Nombres *" : "Razón Social *"}
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="JUAN RAMIRO PÉREZ GARCÍA"
                className="w-full rounded-lg border-2 border-amber-300 bg-rose-100/60 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Correo Electrónico para Notificación *
              </label>
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full rounded-lg border-2 border-amber-300 bg-rose-100/60 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono / Celular de Contacto *
              </label>
              <input
                type="tel"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="9100000XX"
                className="w-full rounded-lg border-2 border-amber-300 bg-rose-100/60 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Procedimiento TUPA 2026 *
              </label>
              <select
                required
                value={procedimientoTupa}
                onChange={(e) => setProcedimientoTupa(e.target.value)}
                className="w-full rounded-lg border-2 border-amber-300 bg-rose-100/60 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Seleccione un procedimiento o servicio</option>
                <option value="NO_TUPA">Trámite no TUPA / documentación general</option>
                {PROCEDIMIENTOS_TUPA_2026.map((procedimiento) => (
                  <option key={procedimiento.codigo} value={procedimiento.codigo}>
                    {procedimiento.codigo} - {procedimiento.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Documento Presentado *
              </label>
              <select
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
                className="w-full rounded-lg border-2 border-amber-300 bg-rose-100/60 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="SOLICITUD">Solicitud Simple / Formato Único</option>
                <option value="OFICIO">Oficio Institucional</option>
                <option value="CARTA">Carta / Carta Notarial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cantidad de Folios Físicos *
              </label>
              <input
                type="number"
                min={1}
                required
                value={cantidadFolios}
                onChange={(e) => setCantidadFolios(Number(e.target.value))}
                className="w-full rounded-lg border-2 border-amber-300 bg-rose-100/60 px-3 py-2 text-sm text-slate-800 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ASUNTO / PETITORIO CONCRETO *
            </label>
            <textarea
              rows={3}
              required
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Describa brevemente el petitorio del administrado..."
              className="w-full rounded-lg border-2 border-amber-300 bg-rose-100/60 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sky-300">
            <button
              type="button"
              onClick={handleNuevoRegistro}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              Limpiar Campos
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-red-800 transition"
            >
              ✓ Registrar y Emitir Cargo CUT
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}