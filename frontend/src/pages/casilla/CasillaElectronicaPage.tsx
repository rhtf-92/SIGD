/**
 * Módulo: Bandeja de Casilla Electrónica Ciudadana y Acuse Legal (ENT-M01-03)
 * Página Principal del Administrado (Estudiante / Ciudadano / Empresa)
 * Cumplimiento de la Ley N° 27444 (LPAG) y Ley N° 29733 (Protección de Datos Personales)
 */

import { Link } from "react-router-dom";
import { BarChart3, Home, Mail, Settings, ShieldCheck } from "lucide-react";

import NotificationList from "../../components/casilla/NotificacionList";
import NotificacionDetailModal from "../../components/casilla/NotificacionDetailModal";
import { useCasilla } from "../../hooks/useCasilla";

export default function CasillaElectronicaPage() {
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
    isModalOpen,
    selectedNotificacion,
    openDetalle,
    closeDetalle,
    generarAcuse,
    isGenerandoAcuse,
  } = useCasilla();

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-cyan-50 via-white to-sky-100 font-sans text-slate-800">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(14,165,233,0.12) 1px, transparent 1px), radial-gradient(ellipse at 12% 10%, rgba(34,211,238,0.2), transparent 38%), radial-gradient(ellipse at 85% 28%, rgba(59,130,246,0.12), transparent 36%)",
          backgroundSize: "22px 22px, auto, auto",
        }}
      />

      {/* ==================================================================== */}
      {/* CABECERA INSTITUCIONAL DE LA CASILLA ELECTRÓNICA                     */}
      {/* ==================================================================== */}
      <header className="relative z-10 mx-auto mt-4 w-[calc(100%-2rem)] max-w-7xl rounded-2xl border border-white/80 bg-white/75 shadow-[0_12px_40px_rgba(14,116,144,0.12)] backdrop-blur-2xl sm:w-[calc(100%-3rem)]">
        <div className="mx-auto w-full px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between border-b border-sky-100 pb-3">
            <Link
              to="/"
              aria-label="SIGD Suiza, ir al inicio"
              className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-400/60 bg-gradient-to-br from-blue-900 to-blue-700 text-xl font-black text-white shadow-[0_0_18px_rgba(14,165,233,0.28)]">
                S
              </span>
              <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-blue-950 sm:block">
                SIGD <span className="text-sky-600">Suiza</span>
              </span>
            </Link>
            <nav aria-label="Navegación principal" className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/casilla"
                aria-current="page"
                className="rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-xs font-semibold text-blue-800 shadow-[0_0_15px_rgba(14,165,233,0.12)] transition hover:border-sky-500 hover:bg-sky-200 sm:text-sm"
              >
                Casilla Electrónica
              </Link>
              <Link
                to="/administracion"
                className="rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-blue-800 sm:text-sm"
              >
                Administración
              </Link>
            </nav>
          </div>

          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-blue-800">
                  SIGD • ENT-M01-03
                </span>
                <span className="text-xs font-semibold text-sky-700">
                  IESTP "Suiza" — Pucallpa
                </span>
              </div>

              <div className="mt-2 h-px w-16 bg-gradient-to-r from-sky-400 to-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.55)]" />
              <h1 className="mt-2 text-2xl font-black tracking-tight text-blue-950 sm:text-3xl">
                Bandeja de Casilla Electrónica Ciudadana
              </h1>

              <nav aria-label="Ruta de navegación" className="mt-1 text-xs text-sky-700 sm:text-sm">
                <Link to="/" className="transition hover:text-blue-900">Inicio</Link>
                <span className="mx-2 text-sky-400">/</span>
                <span>Casilla Electrónica</span>
                <span className="mx-2 text-sky-400">/</span>
                <span className="text-blue-800">Bandeja de notificaciones</span>
              </nav>
              <p className="mt-1.5 text-sm text-slate-600">
                Recepción oficial de actos administrativos, cédulas y resoluciones
                con validez legal plena.
              </p>
            </div>

            {/* Ficha del Administrado y Dirección de Casilla */}
            <div className="flex flex-col items-start gap-3.5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200 bg-white/70 p-3.5 shadow-[0_8px_24px_rgba(14,165,233,0.12)] backdrop-blur-xl transition hover:border-sky-400 hover:shadow-[0_0_22px_rgba(34,211,238,0.22)]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-300 bg-gradient-to-br from-sky-100 to-cyan-50 font-bold text-blue-800 shadow-[0_0_15px_rgba(14,165,233,0.15)]">
                  SP
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-blue-950">
                      Sergio Serruche Panduro
                    </p>
                    <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                      DNI 74561238
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] font-semibold text-sky-700">
                    74561238@casilla.iestpsuiza.edu.pe
                  </p>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>Casilla vinculada y homologada (Ley N° 29733)</span>
                  </div>
                </div>
              </div>
              <Link
                to="/"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-sky-200 bg-white/75 px-4 py-2.5 text-sm font-semibold text-blue-800 backdrop-blur-lg transition hover:border-sky-400 hover:bg-sky-50 hover:text-blue-950"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </header>

      <aside className="fixed left-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 rounded-2xl border border-white/80 bg-white/75 p-2 shadow-[0_12px_36px_rgba(14,116,144,0.14)] backdrop-blur-xl 2xl:flex">
        <Link
          to="/"
          title="Inicio"
          aria-label="Inicio"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-sky-50 hover:text-blue-700"
        >
          <Home className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link
          to="/casilla"
          title="Casilla"
          aria-label="Casilla"
          aria-current="page"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-300 bg-sky-100 text-blue-700 shadow-[0_0_16px_rgba(14,165,233,0.22)]"
        >
          <Mail className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link
          to="/administracion"
          title="Administración"
          aria-label="Administración"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-sky-50 hover:text-blue-700"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link
          to="/reportes/dashboard"
          title="Reportes"
          aria-label="Reportes"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-sky-50 hover:text-blue-700"
        >
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link
          to="/administracion/seguridad"
          title="Seguridad"
          aria-label="Seguridad"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-sky-50 hover:text-blue-700"
        >
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </Link>
      </aside>

      {/* ==================================================================== */}
      {/* CONTENIDO PRINCIPAL                                                  */}
      {/* ==================================================================== */}
      <div className="relative z-10 mx-auto w-full max-w-7xl flex-1 space-y-7 px-4 py-8 sm:px-6 lg:px-8">
        {/* Banner Legal Normativo (Ley N° 27444) */}
        <section className="rounded-2xl border border-cyan-300/70 bg-gradient-to-r from-white/85 via-sky-50/80 to-cyan-50/70 p-4.5 text-xs text-blue-900 shadow-[0_10px_30px_rgba(14,165,233,0.14)] backdrop-blur-xl sm:text-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-sky-300 bg-sky-100 text-xs font-bold text-blue-700">
              §
            </div>
            <div className="space-y-1">
              <p className="font-bold text-blue-900">
                Marco Legal de la Notificación Electrónica — TUO de la Ley N° 27444 (Art. 20)
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                La notificación dirigida a su Casilla Electrónica surte plenos
                efectos legales el <strong>día de su depósito formal</strong> en
                horario hábil (hasta las 16:30 hrs). Los depósitos efectuados
                con posterioridad o en días no laborables se entienden surtidos al{" "}
                <strong>primer día hábil siguiente</strong> a las 08:00 hrs.
              </p>
            </div>
          </div>
        </section>

        {/* Métricas y Contadores de la Casilla */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Total */}
          <div className="relative overflow-hidden rounded-2xl border border-blue-300/80 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-5 text-white shadow-[0_12px_32px_rgba(37,99,235,0.28)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(37,99,235,0.38)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold tracking-wider uppercase text-white/90">
                  Total Notificaciones
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] sm:text-3xl">
                    {isLoadingStats ? "..." : stats.total}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-xs text-white/75">
                  Registros en su buzón oficial
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-100/45 bg-cyan-300/20 text-white shadow-[0_0_16px_rgba(34,211,238,0.25)]">
                <span aria-hidden="true" className="text-xl font-bold">#</span>
              </div>
            </div>
          </div>

          {/* No Leídos */}
          <button
            type="button"
            onClick={() => setEstado("NO_LEIDO")}
            aria-pressed={filtros.estado === "NO_LEIDO"}
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 p-5 text-left text-white shadow-[0_12px_32px_rgba(245,158,11,0.24)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(245,158,11,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${filtros.estado === "NO_LEIDO" ? "border-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.38)]" : "border-amber-200/70"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold tracking-wider uppercase text-white/95">
                  No Leídos
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.45)] sm:text-3xl">
                    {isLoadingStats ? "..." : stats.noLeidos}
                  </span>
                  <span className="ml-2 inline-flex h-3 w-3 items-center justify-center rounded-full bg-amber-500/30" />
                </div>
                <p className="mt-1.5 truncate text-xs text-white/80">
                  Requieren su lectura y revisión
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/35 bg-white/15">
                  <span className="text-lg font-bold text-white">#</span>
                </div>
              </div>
            </div>
          </button>

          {/* Leídos */}
          <button
            type="button"
            onClick={() => setEstado("LEIDO")}
            aria-pressed={filtros.estado === "LEIDO"}
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-700 p-5 text-left text-white shadow-[0_12px_32px_rgba(147,51,234,0.24)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(147,51,234,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${filtros.estado === "LEIDO" ? "border-violet-100 shadow-[0_0_24px_rgba(192,132,252,0.38)]" : "border-violet-200/65"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold tracking-wider uppercase text-white/95">
                  Leídos
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.45)] sm:text-3xl">
                    {isLoadingStats ? "..." : stats.leidos}
                  </span>
                  <svg
                    className="h-4 w-4 text-white/90"
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
                <p className="mt-1.5 truncate text-xs text-white/80">
                  Consultados sin acuse emitido
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center text-white/90">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            </div>
          </button>

          {/* Notificados con Acuse */}
          <button
            type="button"
            onClick={() => setEstado("NOTIFICADO")}
            aria-pressed={filtros.estado === "NOTIFICADO"}
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600 p-5 text-left text-white shadow-[0_12px_32px_rgba(6,182,212,0.24)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(6,182,212,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${filtros.estado === "NOTIFICADO" ? "border-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.35)]" : "border-cyan-100/70"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold tracking-wider uppercase text-white/95">
                  Con Acuse Legal
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.45)] sm:text-3xl">
                    {isLoadingStats ? "..." : stats.notificados}
                  </span>
                  <svg
                    className="h-4 w-4 text-white"
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
                </div>
                <p className="mt-1.5 truncate text-xs text-white/80">
                  Con fecha cierta y hash SHA-256
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center text-white">
                <svg
                  className="h-4 w-4"
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
              </div>
            </div>
          </button>
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
        onClose={closeDetalle}
        onGenerarAcuse={generarAcuse}
      />
    </main>
  );
}