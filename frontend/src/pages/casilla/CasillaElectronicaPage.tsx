/**
 * Módulo: Bandeja de Casilla Electrónica Ciudadana y Acuse Legal (ENT-M01-03)
 * Página Principal del Administrado (Estudiante / Ciudadano / Empresa)
 * Cumplimiento de la Ley N° 27444 (LPAG) y Ley N° 29733 (Protección de Datos Personales)
 */

import { useState } from "react";
import { Link } from "react-router-dom";

import NotificationList from "../../components/casilla/NotificacionList";
import NotificacionDetailModal from "../../components/casilla/NotificacionDetailModal";
import { useCasilla } from "../../hooks/useCasilla";
import { useAuthStore } from "../../stores/authStore";
import { CasillaBadgeRealtime } from "../../components/casilla/CasillaBadgeRealtime";

export default function CasillaElectronicaPage() {
  const [mostrarBannerInfo, setMostrarBannerInfo] = useState(true);
  const nombreUsuario = useAuthStore((state) => state.usuario?.nombreCompleto);
  const {
    filtros,
    hasActiveFilters,
    setTipo,
    setEstado,
    setFechaInicio,
    setFechaFin,
    setBusqueda,
    setPage,
    setLimit,
    resetFiltros,
    notificaciones,
    meta,
    isLoading,
    isError,
    refetch,
    stats,
    isLoadingStats,
    isErrorStats,
    isModalOpen,
    selectedNotificacion,
    isLoadingDetail,
    detailError,
    openDetalle,
    retryDetalle,
    closeDetalle,
    generarAcuse,
    isGenerandoAcuse,
    generarAcuseError,
  } = useCasilla();

  return (
    <main
      className="relative min-h-[calc(100vh-96px)] w-full overflow-hidden text-slate-900 flex flex-col bg-[#E8F4FE] bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/images/fondo-casillaelectro.png')",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 1. FONDO GENERAL: Relleno completo y continuo con fondo-casillaelectro.png */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/fondo-casillaelectro.png')",
        }}
        aria-hidden="true"
      />

      {/* ==================================================================== */}
      {/* CONTENEDOR PRINCIPAL DEL MÓDULO                                      */}
      {/* ==================================================================== */}
      <div className="relative z-10 mx-auto w-[92%] max-w-[1600px] px-3 sm:px-6 lg:px-8 py-8 space-y-6 flex-1">
        {/* 2. ENCABEZADO DE LA BANDEJA (TARJETA BLANCA ELEVADA CON BORDES REDONDEADOS SUAVES) */}
        <header className="rounded-2xl border border-sky-100 bg-white p-6 sm:p-7 shadow-[0_4px_25px_rgba(8,47,124,0.06)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Lado izquierdo: Píldora/badge azul "SIGD • ENT-001-03", Título grande y Subtítulo */}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center rounded-full bg-[#0073E6] px-3.5 py-1 font-mono text-[11px] font-bold text-white uppercase tracking-wider shadow-xs">
                  SIGD • ENT-001-03
                </span>
              </div>

              <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#082F7C]">
                Bandeja de Casilla Electrónica Ciudadana
              </h1>

              <p className="mt-1 text-sm text-slate-500 font-normal">
                Consulte las notificaciones depositadas en su casilla.
              </p>
            </div>

            {/* Lado derecho: Sobre con badge rojo "1", Tarjeta Cuenta autenticada y Botón con borde */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <CasillaBadgeRealtime />

              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0073E6] font-bold text-white text-base shadow-xs">
                  {nombreUsuario?.trim().charAt(0).toUpperCase() || "C"}
                </div>
                <div className="text-xs">
                  <p className="font-bold text-[#082F7C] leading-tight">
                    {nombreUsuario || "Cuenta autenticada"}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-400" />
                    <span>Casilla de la cuenta autenticada</span>
                  </div>
                </div>
              </div>

              <Link
                to="/"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-400 active:scale-98"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        </header>

        {/* 3. BANNERS INFORMATIVOS Y DE ALERTA */}
        {mostrarBannerInfo && (
          <section className="relative rounded-xl border border-sky-200 bg-[#EAF3FD] p-4 text-xs sm:text-sm shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0073E6] text-white font-bold text-sm shadow-xs">
                  <span className="font-serif italic font-bold">i</span>
                </div>
                <div>
                  <p className="font-bold text-[#082F7C] text-sm sm:text-base">
                    Notificaciones electrónicas
                  </p>
                  <p className="text-slate-600 leading-snug mt-0.5 text-xs sm:text-[13px]">
                    Consulte el detalle, la fecha de depósito y los documentos disponibles de cada notificación.
                    La descarga del acuse requiere una referencia documental registrada conforme a la Ley N° 27444.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarBannerInfo(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-sky-100 transition shrink-0 cursor-pointer font-bold"
                aria-label="Cerrar banner informativo"
              >
                ✕
              </button>
            </div>
          </section>
        )}

        {isErrorStats && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-[#FFF1F2] p-3.5 text-xs sm:text-sm text-rose-900 shadow-xs flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold text-sm">
                ⚠️
              </div>
              <span className="font-medium">
                No se pudieron consultar los contadores de la Casilla Electrónica.
              </span>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs font-semibold text-rose-700 hover:underline shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* 4. CUATRO TARJETAS DE CONTADORES EN FILA */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* TOTAL NOTIFICACIONES */}
          <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_2px_12px_rgba(8,47,124,0.04)] transition duration-200 hover:shadow-md hover:-translate-y-0.5">
            {/* Acento decorativo esquina inferior derecha */}
            <div className="pointer-events-none absolute bottom-0 right-0 w-16 h-16 overflow-hidden z-0" aria-hidden="true">
              <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-gradient-to-br from-sky-200 to-blue-300 opacity-60" />
            </div>

            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0073E6] border border-blue-200/80 shadow-xs">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  TOTAL NOTIFICACIONES
                </span>

                <div className="mt-1 min-h-[36px] flex items-center">
                  {isLoadingStats ? (
                    <span className="text-2xl font-black text-slate-400 animate-pulse">...</span>
                  ) : isErrorStats ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
                      No disponible
                    </span>
                  ) : (
                    <span className="text-2xl sm:text-3xl font-black text-[#082F7C]">
                      {stats.total}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-[11px] text-slate-500 font-normal">
                  Registros en su buzón oficial
                </p>
              </div>
            </div>
          </div>

          {/* NO LEÍDOS */}
          <div
            role="button"
            tabIndex={0}
            aria-label="No Leídos: filtrar por notificaciones no leídas"
            onClick={() => setEstado("NO_LEIDO")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEstado("NO_LEIDO");
              }
            }}
            className="relative overflow-hidden cursor-pointer rounded-2xl border border-amber-200/90 bg-white p-5 shadow-[0_2px_12px_rgba(8,47,124,0.04)] transition duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-amber-300"
          >
            {/* Acento decorativo esquina inferior derecha */}
            <div className="pointer-events-none absolute bottom-0 right-0 w-16 h-16 overflow-hidden z-0" aria-hidden="true">
              <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 opacity-60" />
            </div>

            <div className="relative z-10 flex items-start gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200/80 shadow-xs">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {stats.noLeidos > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-800">
                  NO LEÍDOS
                </span>

                <div className="mt-1 min-h-[36px] flex items-center">
                  {isLoadingStats ? (
                    <span className="text-2xl font-black text-amber-400 animate-pulse">...</span>
                  ) : isErrorStats ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                      No disponible
                    </span>
                  ) : (
                    <span className="text-2xl sm:text-3xl font-black text-amber-900">
                      {stats.noLeidos}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-[11px] text-amber-700 font-medium">
                  Requieren su lectura y revisión
                </p>
              </div>
            </div>
          </div>

          {/* LEÍDOS */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Leídos: filtrar por notificaciones leídas"
            onClick={() => setEstado("LEIDO")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEstado("LEIDO");
              }
            }}
            className="relative overflow-hidden cursor-pointer rounded-2xl border border-indigo-100 bg-white p-5 shadow-[0_2px_12px_rgba(8,47,124,0.04)] transition duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-200"
          >
            {/* Acento decorativo esquina inferior derecha */}
            <div className="pointer-events-none absolute bottom-0 right-0 w-16 h-16 overflow-hidden z-0" aria-hidden="true">
              <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-gradient-to-br from-indigo-200 to-purple-300 opacity-60" />
            </div>

            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/80 shadow-xs">
                <svg
                  className="h-6 w-6"
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
              </div>

              <div className="flex-1 min-w-0">
                <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-indigo-900">
                  LEÍDOS
                </span>

                <div className="mt-1 min-h-[36px] flex items-center">
                  {isLoadingStats ? (
                    <span className="text-2xl font-black text-indigo-400 animate-pulse">...</span>
                  ) : isErrorStats ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      No disponible
                    </span>
                  ) : (
                    <span className="text-2xl sm:text-3xl font-black text-indigo-950">
                      {stats.leidos}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-[11px] text-slate-500 font-normal">
                  Consultados sin acuse emitido
                </p>
              </div>
            </div>
          </div>

          {/* CON CONFIRMACIÓN */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Con confirmación: filtrar por notificaciones con acuse"
            onClick={() => setEstado("NOTIFICADO")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEstado("NOTIFICADO");
              }
            }}
            className="relative overflow-hidden cursor-pointer rounded-2xl border border-emerald-200/90 bg-white p-5 shadow-[0_2px_12px_rgba(8,47,124,0.04)] transition duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-300"
          >
            {/* Acento decorativo esquina inferior derecha */}
            <div className="pointer-events-none absolute bottom-0 right-0 w-16 h-16 overflow-hidden z-0" aria-hidden="true">
              <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-gradient-to-br from-emerald-200 to-teal-300 opacity-60" />
            </div>

            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80 shadow-xs">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800">
                  CON CONFIRMACIÓN
                </span>

                <div className="mt-1 min-h-[36px] flex items-center">
                  {isLoadingStats ? (
                    <span className="text-2xl font-black text-emerald-400 animate-pulse">...</span>
                  ) : isErrorStats ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      No disponible
                    </span>
                  ) : (
                    <span className="text-2xl sm:text-3xl font-black text-emerald-900">
                      {stats.notificados}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-[11px] text-emerald-700 font-medium">
                  Con fecha y hash registrados
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Listado Paginado de Notificaciones */}
        <NotificationList
          notificaciones={notificaciones}
          meta={meta}
          filtros={filtros}
          hasActiveFilters={hasActiveFilters}
          isLoading={isLoading}
          isError={isError}
          onSelectNotificacion={openDetalle}
          onSetTipo={setTipo}
          onSetEstado={setEstado}
          onSetFechaInicio={setFechaInicio}
          onSetFechaFin={setFechaFin}
          onSetBusqueda={setBusqueda}
          onSetPage={setPage}
          onSetLimit={setLimit}
          onResetFiltros={resetFiltros}
          onRetry={() => refetch()}
        />
      </div>

      {/* Modal Accesible de Detalle del Acto Administrativo y Acuse Digital */}
      <NotificacionDetailModal
        isOpen={isModalOpen}
        notificacion={selectedNotificacion}
        isGenerandoAcuse={isGenerandoAcuse}
        isLoadingDetail={isLoadingDetail}
        detailError={detailError}
        acuseError={Boolean(generarAcuseError)}
        onClose={closeDetalle}
        onGenerarAcuse={generarAcuse}
        onRetryDetail={retryDetalle}
      />
    </main>
  );
}
