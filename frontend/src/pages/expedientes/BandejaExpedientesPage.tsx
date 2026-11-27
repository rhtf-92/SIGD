import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, FolderOpen, Search } from "lucide-react";

import BandejaTabFilter from "../../components/expedientes/BandejaTabFilter";
import ExpedienteTable from "../../components/expedientes/ExpedienteTable";
import CcdTreeSelector from "../../components/expedientes/CcdTreeSelector";
import { useBandejaExpedientes } from "../../hooks/useBandejaExpedientes";
import { apiClient } from "../../api/client";
import {
  ORDEN_PESTANAS_BANDEJA,
  type EstadoFlujoExpediente,
} from "../../types/expediente";
import type {
  EstadoRecurso,
  FondoDocumental,
  RutaCcdSeleccionada,
  SeccionOrganica,
  SerieDocumental,
} from "../../types/ccdArchivistica";

const ETIQUETAS_SECCION: Record<string, string> = {
  SECRETARIA_ACADEMICA: "Secretaría Académica",
  DIRECCION_GENERAL: "Dirección General",
};

interface NodoCcdApi {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "SERIE" | "SUBSERIE";
  seccion?: string;
  hijos: NodoCcdApi[];
}

export default function BandejaExpedientesPage() {
  const navigate = useNavigate();
  const ccdQuery = useQuery({
    queryKey: ["expedientes", "clasificador-ccd"],
    queryFn: async () => (await apiClient.get<{ elementos: NodoCcdApi[] }>(
      "/api/v1/expedientes/clasificador-ccd",
    )).data.elementos,
    staleTime: 5 * 60_000,
  });
  const [estadoActivo, setEstadoActivo] = useState<EstadoFlujoExpediente>("PENDIENTE");
  const [busqueda, setBusqueda] = useState("");
  const [filtroCcd, setFiltroCcd] = useState<RutaCcdSeleccionada | null>(null);
  const [mostrarFiltroCcd, setMostrarFiltroCcd] = useState(false);
  const {
    data: datosBandeja,
    indicadores,
    isLoading,
    isError,
    errorIndicadores,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } =
    useBandejaExpedientes({ estado: estadoActivo, busqueda, codigoSerie: filtroCcd?.serie.codigo });

  const expedientesVisibles = datosBandeja?.expedientes ?? [];

  const conteos = datosBandeja?.conteos ?? ORDEN_PESTANAS_BANDEJA.reduce(
    (resultado, estado) => ({ ...resultado, [estado]: 0 }),
    {} as Record<EstadoFlujoExpediente, number>,
  );

  const volumenActivo = indicadores?.volumenActivo ?? 0;
  const seccionesPorCodigo = (ccdQuery.data ?? []).reduce<Record<string, SerieDocumental[]>>(
    (secciones, nodo) => {
      if (nodo.tipo !== "SERIE" || !nodo.seccion) return secciones;
      const lista = secciones[nodo.seccion] ?? [];
      lista.push({ tipo: "serie", id: nodo.id, codigo: nodo.codigo, nombre: nodo.nombre });
      secciones[nodo.seccion] = lista;
      return secciones;
    },
    {},
  );
  const fondosCcd: readonly FondoDocumental[] = [{
    tipo: "fondo",
    id: "IESTP_SUIZA",
    nombre: "IESTP_SUIZA",
    secciones: Object.entries(seccionesPorCodigo).map(([codigo, series]): SeccionOrganica => ({
      tipo: "seccion",
      id: codigo,
      nombre: ETIQUETAS_SECCION[codigo] ?? codigo,
      series,
    })),
  }];
  const recursoCcd: EstadoRecurso<readonly FondoDocumental[]> = ccdQuery.isLoading
    ? { estado: "cargando" }
    : ccdQuery.isError
      ? { estado: "error", mensaje: "No se pudo cargar el catálogo de series CCD." }
      : { estado: "listo", datos: fondosCcd };

  return (
    <main className="bandeja-expedientes-page min-h-screen text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            ← Volver al inicio
          </button>

          <p className="text-sm font-bold text-blue-800">SIGD SUIZA · Módulo de Expedientes</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bandeja de Expedientes</h1>
          <p className="mt-1 text-sm text-slate-600">
            Administración, seguimiento, recepción y gestión de documentos institucionales.
          </p>
        </div>
      </header>

      <section
        className="relative mx-auto my-8 max-w-7xl rounded-2xl border border-slate-200 bg-white px-4 py-6 shadow-sm sm:px-8 sm:py-8"
      >
        {/* Panel de KPIs */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-3xl font-bold tabular-nums text-slate-900">{volumenActivo}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Expedientes registrados
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-3xl font-bold tabular-nums text-blue-800">{conteos.PENDIENTE}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Pendientes
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-3xl font-bold tabular-nums text-slate-900">{conteos.EN_PROCESO}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              En trámite
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-3xl font-bold tabular-nums text-slate-900">{conteos.ARCHIVADO}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Finalizados
            </p>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtro CCD */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por CUT, solicitante o asunto…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarFiltroCcd(!mostrarFiltroCcd)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                filtroCcd
                  ? "border-blue-700 bg-blue-50 text-blue-800"
                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5 text-blue-700" />
              Taxonomía CCD {filtroCcd ? `(${filtroCcd.serie.codigo})` : ""}
            </button>
            {filtroCcd && (
              <button
                type="button"
                onClick={() => setFiltroCcd(null)}
                className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
              >
                Limpiar filtro CCD
              </button>
            )}
          </div>
        </div>

        {/* Panel Desplegable de Árbol CCD (ENT-M03-04) */}
        {mostrarFiltroCcd && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Seleccionar Serie Documental Archivística (Cuadro CCD)
              </h3>
              <button
                type="button"
                onClick={() => setMostrarFiltroCcd(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                ✕ Cerrar
              </button>
            </div>
            <CcdTreeSelector
              recurso={recursoCcd}
              seleccion={filtroCcd}
              onSeleccionar={(ruta) => {
                setFiltroCcd(ruta);
                setMostrarFiltroCcd(false);
              }}
            />
          </div>
        )}

        {/* Pestañas de la FSM de 6 Estados */}
        <div className="mb-4">
          <BandejaTabFilter
            estadoActivo={estadoActivo}
            onCambiarEstado={setEstadoActivo}
            conteos={conteos}
          />
        </div>

        {/* Tabla Operativa con Semáforo SLA integrado */}
        {isLoading && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600" role="status">Cargando expedientes…</p>
        )}
        {(isError || errorIndicadores) && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800" role="alert">
            No se pudieron actualizar los datos desde el servidor. Intenta nuevamente.
          </p>
        )}
        {!isLoading && !isError && (
          <>
            <ExpedienteTable
              expedientes={expedientesVisibles}
              onVerExpediente={(expediente) => navigate(`/expedientes/${expediente.id}`)}
            />
            {hasNextPage && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                >
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                  {isFetchingNextPage ? "Cargando…" : "Cargar más expedientes"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
