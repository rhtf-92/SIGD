/**
 * Módulo: Bandeja de Casilla Electrónica Ciudadana y Acuse Legal (ENT-M01-03)
 * Página Principal del Administrado (Estudiante / Ciudadano / Empresa)
 * Cumplimiento de la Ley N° 27444 (LPAG) y Ley N° 29733 (Protección de Datos Personales)
 */

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import NotificationList from "../../components/casilla/NotificacionList";
import NotificacionDetailModal from "../../components/casilla/NotificacionDetailModal";
import { useCasilla } from "../../hooks/useCasilla";
import { apiClient } from "../../api/client";
import { useAuthStore } from "../../stores/authStore";
import { ModuleHero, CasillaIllustration } from "../../components/tramite/ModuleHero";

interface PerfilCasilla {
  nombreCompleto: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correo: string;
}

export default function CasillaElectronicaPage() {
  const usuarioId = useAuthStore((state) => state.usuario?.id);
  const token = useAuthStore((state) => state.accessToken);
  const { data: perfil, isLoading: cargandoPerfil, isError: errorPerfil } = useQuery({
    queryKey: ["casilla", "perfil", usuarioId],
    queryFn: async () => (await apiClient.get<PerfilCasilla>("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })).data,
    enabled: Boolean(usuarioId && token),
    staleTime: 0,
  });
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
    <main className="min-h-screen bg-slate-100 text-slate-900">
      {/* ==================================================================== */}
      {/* CABECERA INSTITUCIONAL DE LA CASILLA ELECTRÓNICA                     */}
      {/* ==================================================================== */}
      <div className="mx-auto max-w-7xl px-3.5 pt-6 sm:px-6 lg:px-8">
        <ModuleHero
          eyebrow="SIGD • ENT-M01-03 · Notificación Oficial"
          title={<>Bandeja de Casilla <span className="text-[#f9e000]">Electrónica Ciudadana</span></>}
          subtitle='Recepción oficial de actos administrativos, cédulas y resoluciones emitidas por el IESTP "Suiza" de Pucallpa con validez legal plena.'
          illustration={<CasillaIllustration className="h-40 w-auto" />}
          actions={
            <div className="flex flex-wrap items-center gap-3 w-full">
              <div className="flex items-center gap-3 rounded-2xl border border-white/25 bg-white/15 px-3.5 py-2 backdrop-blur-sm text-xs text-white">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f9e000] font-black text-[#042454] shadow-sm">
                  {perfil?.nombreCompleto?.trim().slice(0, 1).toUpperCase() ?? "—"}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-bold text-white">
                      {cargandoPerfil ? "Cargando datos..." : errorPerfil ? "No se pudo cargar el perfil" : perfil?.nombreCompleto ?? "Mi cuenta"}
                    </p>
                    <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-bold text-[#fef08a]">
                      {perfil?.numeroDocumento ? `${perfil.tipoDocumento} ${perfil.numeroDocumento}` : "Documento no disponible"}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-blue-100 mt-0.5">
                    {perfil?.correo ?? "Correo no disponible"}
                  </p>
                </div>
              </div>

              <Link
                to="/tramite"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-3.5 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25"
              >
                ← Volver
              </Link>
            </div>
          }
          footer={
            <p className="text-[11px] sm:text-xs text-blue-100 leading-relaxed">
              🔔 <strong className="text-[#fef08a]">Aviso legal:</strong> Las comunicaciones de esta casilla pueden corresponder a actuaciones administrativas. Revise su contenido, fecha de emisión y las indicaciones del documento.
            </p>
          }
        />
      </div>

      {/* ==================================================================== */}
      {/* CONTENIDO PRINCIPAL                                                  */}
      {/* ==================================================================== */}
      <div className="mx-auto max-w-7xl px-3.5 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-7">
        {/* Banner Legal Normativo (Ley N° 27444) */}
        <section className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white/95 via-sky-50/50 to-blue-50/30 p-5 shadow-[0_4px_20px_-4px_rgba(14,165,233,0.1)] ring-1 ring-white/80 backdrop-blur-xs text-xs sm:text-sm text-slate-700 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent">
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
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
