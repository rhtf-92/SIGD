import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import CargoDigitalModal from "../../components/tramite/CargoDigitalModal";
import { useHorarioCorte } from "../../hooks/useHorarioCorte";
import type { CargoOficialTramite } from "../../types/cargoOficial";

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
  const [tipoDocumento, setTipoDocumento] = useState("SOLICITUD");
  const [asunto, setAsunto] = useState("");
  const [cantidadFolios, setCantidadFolios] = useState(1);
  const [cargoGenerado, setCargoGenerado] = useState<CargoOficialTramite | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const anioActual = new Date().getFullYear();
    const correlativo = String(Math.floor(100000 + Math.random() * 900000));
    const cutGenerado = `EXP-${anioActual}-${correlativo}`;

    const ahora = new Date();
    const fechaRecepcionIso = ahora.toISOString();

    const nuevoCargo: CargoOficialTramite = {
      codigoExpediente: cutGenerado,
      fechaRecepcionIso,
      fechaIngresoFormalIso: esCorteSuperado ? proximoDiaHabil : fechaRecepcionIso,
      horaRecepcion: ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
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
      asunto,
      documentoPrincipalTipo: tipoDocumento,
      cantidadFolios: Number(cantidadFolios) || 1,
      hashSha256Recepcion: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      horaCorteAplicada: "16:30",
      radicadoDiaSiguiente: esCorteSuperado,
      urlSeguimiento: `https://sigd.iestpsuiza.edu.pe/tramite?cut=${cutGenerado}`,
    };

    setCargoGenerado(nuevoCargo);
    setModalAbierto(true);
  }

  function handleNuevoRegistro() {
    setNumeroDoc("");
    setNombre("");
    setCorreo("");
    setTelefono("");
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
              <input
                id="num-doc-input"
                type="text"
                required
                value={numeroDoc}
                onChange={(e) => setNumeroDoc(e.target.value)}
                placeholder={tipoDoc === "DNI" ? "8 dígitos" : "11 dígitos"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono focus:border-blue-600 focus:outline-none"
              />
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="correo-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Correo Electrónico para Notificación *
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tipo-tramite-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Documento Presentado *
              </label>
              <select
                id="tipo-tramite-select"
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
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
              onClick={handleNuevoRegistro}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Limpiar Campos
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition"
            >
              ✓ Registrar y Emitir Cargo CUT
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
    </main>
  );
}
