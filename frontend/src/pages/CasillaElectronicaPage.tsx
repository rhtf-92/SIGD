import { useState } from "react";

import AcuseNotificacionModal, { type AcuseEmitidoServidor } from "../components/casilla/AcuseNotificacionModal";
import NotificationList from "../components/casilla/NotificacionList";
import { useCasilla } from "../hooks/useCasilla";
import type { EstadoNotificacion, Notificacion } from "../types/casilla";

type PestañaLegal = "TODOS" | "NO_LEÍDO" | "LEÍDO" | "CON_ACUSE";

const PESTAÑAS: { id: PestañaLegal; estado: EstadoNotificacion | "TODOS" }[] = [
  { id: "TODOS", estado: "TODOS" },
  { id: "NO_LEÍDO", estado: "NO_LEIDO" },
  { id: "LEÍDO", estado: "LEIDO" },
  { id: "CON_ACUSE", estado: "NOTIFICADO" },
];

function etiquetaEstado(estado: EstadoNotificacion): string {
  if (estado === "NO_LEIDO") return "NO LEÍDO";
  if (estado === "LEIDO") return "LEÍDO";
  return "CON ACUSE";
}

function clasesEstado(estado: EstadoNotificacion): string {
  if (estado === "NO_LEIDO") return "border-amber-800 bg-amber-100 text-amber-950";
  if (estado === "LEIDO") return "border-sky-800 bg-sky-100 text-sky-950";
  return "border-emerald-800 bg-emerald-100 text-emerald-950";
}

function formatFecha(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default function CasillaElectronicaPage() {
  const casilla = useCasilla();
  const [pestaña, setPestaña] = useState<PestañaLegal>("TODOS");
  const [seleccionada, setSeleccionada] = useState<Notificacion | null>(null);
  const [acuseAbierto, setAcuseAbierto] = useState(false);
  const [acuseEmitido, setAcuseEmitido] = useState<AcuseEmitidoServidor | null>(null);

  function cambiarPestaña(nuevaPestaña: PestañaLegal) {
    setPestaña(nuevaPestaña);
    const estado = PESTAÑAS.find((item) => item.id === nuevaPestaña)?.estado;
    if (estado) casilla.setEstado(estado);
    setSeleccionada(null);
    setAcuseAbierto(false);
    setAcuseEmitido(null);
  }

  function seleccionarNotificacion(notificacion: Notificacion) {
    setSeleccionada(notificacion);
    setAcuseEmitido(null);
    if (notificacion.estado === "NO_LEIDO" && notificacion.requiereAcuse && !notificacion.acuse) {
      setAcuseAbierto(true);
    }
  }

  function registrarAcuse(acuse: AcuseEmitidoServidor) {
    setAcuseEmitido(acuse);
    setSeleccionada((actual) => actual ? {
      ...actual,
      estado: "NOTIFICADO",
      fechaNotificadoIso: acuse.selladoTiempo,
    } : actual);
    void casilla.refetch();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-300 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-800">
              IESTP Suiza · Casilla ciudadana
            </p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              Casilla Electrónica
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Notificaciones oficiales, actos administrativos y constancias de recepción.
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-700">Consulte los plazos en el acto administrativo.</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:px-8">
        <section aria-label="Bandeja de notificaciones" className="min-w-0">
          <div role="tablist" aria-label="Estado legal de notificaciones" className="flex flex-wrap border-b border-slate-300">
            {PESTAÑAS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={pestaña === item.id}
                onClick={() => cambiarPestaña(item.id)}
                className={`border-b-2 px-3 py-3 text-xs font-bold sm:px-4 ${
                  pestaña === item.id
                    ? "border-blue-800 text-blue-900"
                    : "border-transparent text-slate-600 hover:text-slate-950"
                }`}
              >
                {item.id}
              </button>
            ))}
          </div>

          <div className="pt-5">
            <NotificationList
              notificaciones={casilla.notificaciones}
              meta={casilla.meta}
              filtros={casilla.filtros}
              hasActiveFilters={casilla.hasActiveFilters}
              isLoading={casilla.isLoading}
              isError={casilla.isError}
              onSelectNotificacion={seleccionarNotificacion}
              onSetTipo={casilla.setTipo}
              onSetEstado={(estado) => {
                casilla.setEstado(estado);
                const tab = PESTAÑAS.find((item) => item.estado === estado);
                if (tab) setPestaña(tab.id);
              }}
              onSetFechaInicio={casilla.setFechaInicio}
              onSetFechaFin={casilla.setFechaFin}
              onSetBusqueda={casilla.setBusqueda}
              onSetPage={casilla.setPage}
              onSetLimit={casilla.setLimit}
              onResetFiltros={casilla.resetFiltros}
              onRetry={() => void casilla.refetch()}
            />
          </div>
        </section>

        <section aria-label="Visor del acto administrativo" className="min-w-0 border-t border-slate-300 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          {seleccionada ? (
            <article className="space-y-5">
              <header className="border-b border-slate-300 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`inline-flex items-center border px-3 py-1 text-xs font-black ${clasesEstado(seleccionada.estado)}`}>
                    {etiquetaEstado(seleccionada.estado)}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-600">
                    {seleccionada.numeroNotificacion}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-bold">{seleccionada.asunto}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {seleccionada.actoAdministrativo.numeroDocumento} · {seleccionada.unidadEmisora}
                </p>
              </header>

              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-bold text-slate-600">Depositada</dt>
                  <dd className="mt-1">{formatFecha(seleccionada.fechaDepositoIso)}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-600">Expediente</dt>
                  <dd className="mt-1 font-mono">{seleccionada.numeroExpediente}</dd>
                </div>
              </dl>

              <div className="border border-blue-800 bg-blue-50 p-4 text-blue-950">
                <p className="text-xs font-black uppercase tracking-wide">
                  Plazos del acto administrativo
                </p>
                <p className="mt-2 text-sm">El plazo aplicable no está registrado en la Casilla. Consulte el acto y su fecha de notificación.</p>
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">
                  Acto administrativo
                </h3>
                <p className="text-sm leading-6 text-slate-700">
                  {seleccionada.actoAdministrativo.resumenLegal}
                </p>
                {seleccionada.actoAdministrativo.textoCompleto && (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap border border-slate-300 bg-white p-4 font-sans text-sm leading-6 text-slate-800">
                    {seleccionada.actoAdministrativo.textoCompleto}
                  </pre>
                )}
                <p className="break-all border-l-4 border-slate-500 bg-white p-3 font-mono text-xs text-slate-700">
                  SHA-256 del acto: {seleccionada.actoAdministrativo.hashIntegridadSha256 || "No registrado"}
                </p>
              </section>

              {seleccionada.acuse || acuseEmitido ? (
                <div className="border border-emerald-800 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <p className="font-black">Acuse registrado</p>
                  <p className="mt-1">
                    {formatFecha(
                      acuseEmitido?.selladoTiempo ?? seleccionada.acuse?.timestampGeneracionIso ?? "",
                    )}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs">
                    SHA-256: {acuseEmitido?.hashSha256 ?? seleccionada.acuse?.hashSha256Acuse}
                  </p>
                </div>
              ) : seleccionada.requiereAcuse && seleccionada.estado !== "NOTIFICADO" ? (
                <button
                  type="button"
                  onClick={() => setAcuseAbierto(true)}
                  className="w-full bg-blue-800 px-4 py-3 text-sm font-bold text-white hover:bg-blue-900"
                >
                  Confirmar lectura y emitir acuse
                </button>
              ) : null}
            </article>
          ) : (
            <div className="flex min-h-72 items-center justify-center border border-dashed border-slate-400 bg-white p-8 text-center text-sm text-slate-600">
              Seleccione una notificación para consultar el acto administrativo.
            </div>
          )}
        </section>
      </div>

      <AcuseNotificacionModal
        isOpen={acuseAbierto}
        notificacion={seleccionada}
        onClose={() => setAcuseAbierto(false)}
        onAcuseGenerado={registrarAcuse}
      />
    </main>
  );
}
