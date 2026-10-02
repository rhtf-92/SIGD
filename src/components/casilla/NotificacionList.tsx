/**
 * Módulo: Bandeja de Casilla Electrónica Ciudadana (ENT-M01-03)
 * Componente: NotificationList
 * Visualización paginada, filtros por tipo y rango de fechas, e indicadores de estado.
 */

import type {
  EstadoNotificacion,
  FiltrosCasilla,
  Notificacion,
  PaginationMeta,
  TipoNotificacion,
} from "../../types/casilla";

interface NotificationListProps {
  notificaciones: Notificacion[];
  meta: PaginationMeta;
  filtros: FiltrosCasilla;
  hasActiveFilters: boolean;
  isLoading: boolean;
  isError: boolean;
  onSelectNotificacion: (notificacion: Notificacion) => void;
  onSetTipo: (tipo: TipoNotificacion | "TODOS") => void;
  onSetEstado: (estado: EstadoNotificacion | "TODOS") => void;
  onSetFechaInicio: (fecha: string) => void;
  onSetFechaFin: (fecha: string) => void;
  onSetBusqueda: (busqueda: string) => void;
  onSetPage: (page: number) => void;
  onSetLimit: (limit: number) => void;
  onResetFiltros: () => void;
  onRetry: () => void;
}

// ============================================================================
// HELPERS VISUALES: BADGES DE ESTADO Y TIPOS
// ============================================================================
function renderEstadoBadge(estado: EstadoNotificacion) {
  switch (estado) {
    case "NO_LEIDO":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          No Leído
        </span>
      );
    case "LEIDO":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          <svg
            className="h-3 w-3 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          Leído
        </span>
      );
    case "NOTIFICADO":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 shadow-sm">
          <svg
            className="h-3.5 w-3.5 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          Notificado (Con Acuse)
        </span>
      );
  }
}

function renderTipoBadge(tipo: TipoNotificacion) {
  switch (tipo) {
    case "RESOLUCION":
      return (
        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
          Resolución
        </span>
      );
    case "NOTIFICACION_OBSERVACION":
      return (
        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
          Observación
        </span>
      );
    case "OFICIO":
      return (
        <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
          Oficio
        </span>
      );
    case "CITACION":
      return (
        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
          Citación
        </span>
      );
    case "CONSTANCIA":
      return (
        <span className="rounded-md bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
          Constancia
        </span>
      );
    case "INFORME":
      return (
        <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
          Informe
        </span>
      );
    default:
      return (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
          Documento
        </span>
      );
  }
}

function formatIsoFecha(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return isoString;
  }
}

export default function NotificationList({
  notificaciones,
  meta,
  filtros,
  hasActiveFilters,
  isLoading,
  isError,
  onSelectNotificacion,
  onSetTipo,
  onSetEstado,
  onSetFechaInicio,
  onSetFechaFin,
  onSetBusqueda,
  onSetPage,
  onSetLimit,
  onResetFiltros,
  onRetry,
}: NotificationListProps) {
  return (
    <section className="space-y-6">
      {/* ==================================================================== */}
      {/* PANEL DE FILTROS Y BÚSQUEDA                                          */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        <div className="mb-4 flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-blue-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <h2 className="text-base font-bold text-slate-900">
              Filtros de Búsqueda y Criterios
            </h2>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFiltros}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Búsqueda por texto */}
          <div className="sm:col-span-2">
            <label
              htmlFor="filtro-busqueda"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Buscar por Asunto, N° o Expediente
            </label>
            <div className="relative">
              <input
                id="filtro-busqueda"
                type="text"
                value={filtros.busqueda || ""}
                onChange={(e) => onSetBusqueda(e.target.value)}
                placeholder="Ej. EXP-2026-000184, Titulación, RD 0412..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <svg
                className="absolute left-3 top-3 h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Filtro por Tipo de Notificación */}
          <div>
            <label
              htmlFor="filtro-tipo"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Tipo de Acto / Documento
            </label>
            <select
              id="filtro-tipo"
              value={filtros.tipo || "TODOS"}
              onChange={(e) =>
                onSetTipo(e.target.value as TipoNotificacion | "TODOS")
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="TODOS">Todos los tipos</option>
              <option value="RESOLUCION">Resoluciones</option>
              <option value="NOTIFICACION_OBSERVACION">
                Notificaciones de Observación
              </option>
              <option value="OFICIO">Oficios</option>
              <option value="CITACION">Citaciones</option>
              <option value="CONSTANCIA">Constancias</option>
              <option value="INFORME">Informes Técnicos</option>
            </select>
          </div>

          {/* Filtro por Estado */}
          <div>
            <label
              htmlFor="filtro-estado"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Estado de Notificación
            </label>
            <select
              id="filtro-estado"
              value={filtros.estado || "TODOS"}
              onChange={(e) =>
                onSetEstado(e.target.value as EstadoNotificacion | "TODOS")
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="NO_LEIDO">No Leído</option>
              <option value="LEIDO">Leído</option>
              <option value="NOTIFICADO">Notificado (Con Acuse)</option>
            </select>
          </div>

          {/* Rango de Fechas: Desde */}
          <div>
            <label
              htmlFor="filtro-fecha-inicio"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Fecha Depósito (Desde)
            </label>
            <input
              id="filtro-fecha-inicio"
              type="date"
              value={filtros.fechaInicio || ""}
              onChange={(e) => onSetFechaInicio(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Rango de Fechas: Hasta */}
          <div>
            <label
              htmlFor="filtro-fecha-fin"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Fecha Depósito (Hasta)
            </label>
            <input
              id="filtro-fecha-fin"
              type="date"
              value={filtros.fechaFin || ""}
              onChange={(e) => onSetFechaFin(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Items por página */}
          <div className="flex items-end">
            <div className="w-full">
              <label
                htmlFor="filtro-limit"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Por página
              </label>
              <select
                id="filtro-limit"
                value={filtros.limit || 5}
                onChange={(e) => onSetLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-600"
              >
                <option value={5}>5 por página</option>
                <option value={10}>10 por página</option>
                <option value={20}>20 por página</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ESTADO DE CARGA (SKELETON)                                           */}
      {/* ==================================================================== */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="h-6 w-32 rounded-md bg-slate-200" />
                <div className="h-6 w-24 rounded-full bg-slate-200" />
              </div>
              <div className="mb-3 h-5 w-3/4 rounded bg-slate-200" />
              <div className="h-4 w-1/2 rounded bg-slate-100" />
              <div className="mt-4 flex gap-4 pt-3 border-t border-slate-100">
                <div className="h-4 w-28 rounded bg-slate-200" />
                <div className="h-4 w-40 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================================================================== */}
      {/* ESTADO DE ERROR                                                      */}
      {/* ==================================================================== */}
      {isError && !isLoading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="mt-3 text-base font-bold text-red-900">
            Error al consultar la Casilla Electrónica
          </h3>
          <p className="mt-1 text-sm text-red-700">
            No se pudieron recuperar las notificaciones. Por favor, verifica tu
            conexión o reintenta.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 shadow-sm"
          >
            Reintentar consulta
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* BANDEJA VACÍA                                                        */}
      {/* ==================================================================== */}
      {!isLoading && !isError && notificaciones.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">
            No se encontraron notificaciones oficiales
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {hasActiveFilters
              ? "No hay notificaciones que coincidan con los filtros aplicados. Intenta restablecer los filtros para ver todos los registros."
              : "Su casilla electrónica se encuentra al día. Las nuevas notificaciones emitidas por el IESTP Suiza aparecerán en esta bandeja."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFiltros}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
            >
              Restablecer todos los filtros
            </button>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* LISTADO DE NOTIFICACIONES                                            */}
      {/* ==================================================================== */}
      {!isLoading && !isError && notificaciones.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-500">
            <span>
              Mostrando {notificaciones.length} de {meta.totalItems}{" "}
              notificaciones registradas
            </span>
            <span>Página {meta.currentPage} de {meta.totalPages}</span>
          </div>

          <div className="space-y-3.5">
            {notificaciones.map((notif) => {
              const isNoLeido = notif.estado === "NO_LEIDO";
              const isNotificado = notif.estado === "NOTIFICADO";

              return (
                <article
                  key={notif.id}
                  onClick={() => onSelectNotificacion(notif)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectNotificacion(notif);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Notificación ${notif.numeroNotificacion}, expediente ${notif.numeroExpediente}, ${notif.asunto}`}
                  className={`group relative cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    isNoLeido
                      ? "border-amber-300 ring-1 ring-amber-100 bg-gradient-to-r from-amber-50/40 via-white to-white"
                      : isNotificado
                      ? "border-emerald-200"
                      : "border-slate-200"
                  }`}
                >
                  {/* Encabezado de la tarjeta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderTipoBadge(notif.tipo)}
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {notif.numeroNotificacion}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-semibold text-blue-700">
                        Expediente: {notif.numeroExpediente}
                      </span>
                      {notif.prioridad === "URGENTE" && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                          Urgente
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {renderEstadoBadge(notif.estado)}
                    </div>
                  </div>

                  {/* Cuerpo: Asunto y Resumen del Acto */}
                  <div className="mt-3">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                      {notif.asunto}
                    </h3>

                    <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                      <span className="font-semibold text-slate-700">
                        {notif.actoAdministrativo.tipoActo}:{" "}
                      </span>
                      {notif.actoAdministrativo.numeroDocumento} —{" "}
                      {notif.actoAdministrativo.resumenLegal}
                    </p>
                  </div>

                  {/* Pie de tarjeta: Remitente y Tiempos */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="h-4 w-4 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      <span className="font-medium text-slate-700">
                        {notif.unidadEmisora}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>
                          Depositado: {formatIsoFecha(notif.fechaDepositoIso)}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 font-semibold text-blue-700 group-hover:translate-x-0.5 transition-transform">
                        Ver acto completo &rarr;
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ================================================================ */}
          {/* CONTROLES DE PAGINACIÓN                                          */}
          {/* ================================================================ */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row">
            <p className="text-xs text-slate-600">
              Página <strong className="text-slate-900">{meta.currentPage}</strong> de{" "}
              <strong className="text-slate-900">{meta.totalPages}</strong> (Total:{" "}
              {meta.totalItems} notificaciones)
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!meta.hasPreviousPage}
                onClick={() => onSetPage(meta.currentPage - 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                &larr; Anterior
              </button>

              {/* Botones numéricos de página */}
              <div className="flex items-center gap-1">
                {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map(
                  (pageNum) => {
                    const isCurrent = pageNum === meta.currentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => onSetPage(pageNum)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                          isCurrent
                            ? "bg-blue-700 text-white shadow"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  },
                )}
              </div>

              <button
                type="button"
                disabled={!meta.hasNextPage}
                onClick={() => onSetPage(meta.currentPage + 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
