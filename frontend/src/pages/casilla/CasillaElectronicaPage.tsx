/**
 * Módulo: Bandeja de Casilla Electrónica Ciudadana y Acuse Legal (ENT-M01-03)
 * Página Principal del Administrado (Estudiante / Ciudadano / Empresa)
 * Cumplimiento de la Ley N° 27444 (LPAG) y Ley N° 29733 (Protección de Datos Personales)
 */

import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import NotificationList from "../../components/casilla/NotificacionList";
import NotificacionDetailModal from "../../components/casilla/NotificacionDetailModal";
import { useCasilla, CASILLA_QUERY_KEYS } from "../../hooks/useCasilla";
import { useAuthStore } from "../../stores/authStore";

export default function CasillaElectronicaPage() {
  const { usuario, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

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

  const handleResetFiltros = () => {
    resetFiltros();
    queryClient.invalidateQueries({ queryKey: CASILLA_QUERY_KEYS.all });
  };

  if (!isAuthenticated || !usuario) {
    return (
      <div className="flex-1 w-full bg-slate-100 text-slate-900 flex items-center justify-center p-4 min-h-[60vh]">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 mb-4">
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Autenticación Requerida
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Para acceder a su Casilla Electrónica Oficial y revisar sus notificaciones con validez legal, debe iniciar sesión con sus credenciales institucionales.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/login"
              state={{ from: { pathname: "/casilla" } }}
              className="w-full inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-800"
            >
              Iniciar Sesión Institucional
            </Link>
            <Link
              to="/"
              className="w-full inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const titularNombre = usuario.nombreCompleto || usuario.usuario || "Administrado";

  const titularDocumento = usuario.numeroDocumento
    ? `DNI ${usuario.numeroDocumento}`
    : usuario.rol === "SUPER_ADMIN"
      ? "SUPER_ADMIN"
      : usuario.rol || "Sin Documento";

  const titularCasilla = usuario.numeroDocumento
    ? `${usuario.numeroDocumento}@casilla.iestpsuiza.edu.pe`
    : `${usuario.usuario || (usuario.correo ? usuario.correo.split("@")[0] : "usuario")}@casilla.iestpsuiza.edu.pe`;

  const titularIniciales = (usuario.nombreCompleto || usuario.usuario || "AD")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("") || "AD";

  return (
    <div className="flex-1 w-full bg-slate-100 text-slate-900">
      {/* ==================================================================== */}
      {/* CABECERA INSTITUCIONAL DE LA CASILLA ELECTRÓNICA                     */}
      {/* ==================================================================== */}
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-5">
          {/* Migajas de pan canónicas */}
          <nav
            aria-label="Migajas de pan de casilla electrónica"
            className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
          >
            <Link to="/" className="hover:text-blue-700 hover:underline transition-colors">
              Inicio
            </Link>
            <span className="text-slate-300">/</span>
            <span aria-current="page" className="font-semibold text-blue-700">
              Casilla Electrónica Oficial
            </span>
          </nav>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
                Bandeja de Casilla Electrónica Ciudadana
              </h1>

              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                Recepción oficial de actos administrativos, cédulas y resoluciones con validez legal plena.
              </p>
            </div>

            {/* Ficha del Administrado y Dirección de Casilla */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 p-3 shadow-xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 font-bold text-sm text-white shadow-xs">
                  {titularIniciales}
                </div>
                <div className="text-xs min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-bold text-slate-900 truncate">
                      {titularNombre}
                    </p>
                    <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-800">
                      {titularDocumento}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-blue-700 font-semibold mt-0.5 truncate">
                    {titularCasilla}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>Casilla homologada (Ley N° 29733)</span>
                  </div>
                </div>
              </div>
              <Link
                to="/"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-700"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>

          {/* Botones de navegación intermodular */}
          <nav
            aria-label="Accesos directos ciudadanos"
            className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 mt-4 border-t border-slate-100 scrollbar-none"
          >
            <Link
              to="/casilla"
              aria-current="page"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-blue-700 text-white shadow-xs"
            >
              <span>📬 Casilla Electrónica</span>
            </Link>
            <Link
              to="/tramite"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition"
            >
              <span>📝 Mesa de Partes Virtual</span>
            </Link>
            <Link
              to="/consulta"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition"
            >
              <span>🔍 Consulta CUT</span>
            </Link>
            <Link
              to="/validador-cvd"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition"
            >
              <span>🛡️ Validador CVD / QR</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* CONTENIDO PRINCIPAL                                                  */}
      {/* ==================================================================== */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8 space-y-7">
        {/* Banner Legal Normativo (Ley N° 27444) */}
        <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-50/40 p-4.5 shadow-xs text-xs sm:text-sm text-slate-700">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white font-bold text-xs">
              §
            </div>
            <div className="space-y-1">
              <p className="font-bold text-blue-950">
                Marco Legal de la Notificación Electrónica — TUO de la Ley N° 27444 (Art. 20)
              </p>
              <p className="text-slate-600 leading-relaxed text-xs">
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
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5 xl:gap-6 2xl:gap-8">
          {/* Total */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Notificaciones
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 font-bold text-xs">
                #
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
              {isLoadingStats ? "..." : stats.total}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Registros en su buzón oficial
            </p>
          </div>

          {/* No Leídos */}
          <div
            onClick={() => setEstado("NO_LEIDO")}
            className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50/40 p-4.5 shadow-xs transition hover:shadow-md hover:bg-amber-50"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                No Leídos
              </span>
              <span className="relative flex h-3 w-3">
                {stats.noLeidos > 0 && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                )}
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-amber-900 sm:text-3xl">
              {isLoadingStats ? "..." : stats.noLeidos}
            </p>
            <p className="mt-1 text-[11px] text-amber-700 font-semibold">
              Requieren su lectura y revisión
            </p>
          </div>

          {/* Leídos */}
          <div
            onClick={() => setEstado("LEIDO")}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs transition hover:shadow-md hover:bg-slate-50"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Leídos
              </span>
              <svg
                className="h-4 w-4 text-slate-400"
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
            <p className="mt-2 text-2xl font-black text-slate-800 sm:text-3xl">
              {isLoadingStats ? "..." : stats.leidos}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Consultados sin acuse emitido
            </p>
          </div>

          {/* Notificados con Acuse */}
          <div
            onClick={() => setEstado("NOTIFICADO")}
            className="cursor-pointer rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4.5 shadow-xs transition hover:shadow-md hover:bg-emerald-50"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Con Acuse Legal
              </span>
              <svg
                className="h-4 w-4 text-emerald-600"
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
            <p className="mt-2 text-2xl font-black text-emerald-900 sm:text-3xl">
              {isLoadingStats ? "..." : stats.notificados}
            </p>
            <p className="mt-1 text-[11px] text-emerald-700 font-semibold">
              Con fecha cierta y hash SHA-256
            </p>
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
          onResetFiltros={handleResetFiltros}
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
    </div>
  );
}
