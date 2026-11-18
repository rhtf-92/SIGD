import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Search } from "lucide-react";

import BandejaTabFilter from "../../components/expedientes/BandejaTabFilter";
import ExpedienteTable from "../../components/expedientes/ExpedienteTable";
import CcdTreeSelector from "../../components/expedientes/CcdTreeSelector";
import { useBandejaExpedientes, useExpedientesBase } from "../../hooks/useBandejaExpedientes";
import {
  ORDEN_PESTANAS_BANDEJA,
  type EstadoFlujoExpediente,
  type ExpedienteSGD,
} from "../../types/expediente";
import type {
  FondoDocumental,
  RutaCcdSeleccionada,
} from "../../types/ccdArchivistica";

const FONDOS_CCD_INSTITUCIONALES: readonly FondoDocumental[] = [
  {
    tipo: "fondo",
    id: "fondo-iestp",
    nombre: "IESTP_SUIZA",
    secciones: [
      {
        tipo: "seccion",
        id: "sec-sa",
        nombre: "Secretaría Académica",
        series: [
          {
            tipo: "serie",
            id: "ser-tit",
            nombre: "Expedientes de Titulación Profesional",
            codigo: "CCD-SA-TIT",
          },
          {
            tipo: "serie",
            id: "ser-act",
            nombre: "Actas de Evaluación y Certificados",
            codigo: "CCD-SA-ACTA",
          },
        ],
      },
      {
        tipo: "seccion",
        id: "sec-dg",
        nombre: "Dirección General",
        series: [
          {
            tipo: "serie",
            id: "ser-res",
            nombre: "Resoluciones Directorales",
            codigo: "CCD-DG-RES",
          },
        ],
      },
    ],
  },
];

function calcularConteosPorEstado(
  expedientes: ExpedienteSGD[] | undefined,
): Record<EstadoFlujoExpediente, number> {
  const conteos = ORDEN_PESTANAS_BANDEJA.reduce(
    (acc, estado) => ({ ...acc, [estado]: 0 }),
    {} as Record<EstadoFlujoExpediente, number>,
  );

  if (!expedientes) {
    return conteos;
  }

  for (const expediente of expedientes) {
    conteos[expediente.estadoFlujo] += 1;
  }

  return conteos;
}

export default function BandejaExpedientesPage() {
  const navigate = useNavigate();
  const [estadoActivo, setEstadoActivo] = useState<EstadoFlujoExpediente>("PENDIENTE");
  const [busqueda, setBusqueda] = useState("");
  const [filtroCcd, setFiltroCcd] = useState<RutaCcdSeleccionada | null>(null);
  const [mostrarFiltroCcd, setMostrarFiltroCcd] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const { data: expedientesBase } = useExpedientesBase();
  const { data: expedientesFiltradosApi, isLoading, isError } =
    useBandejaExpedientes({ estado: estadoActivo, busqueda });

  // Filtrado compuesto local por serie CCD seleccionada
  const expedientesVisibles = useMemo(() => {
    if (!expedientesFiltradosApi) return [];
    if (!filtroCcd) return expedientesFiltradosApi;

    return expedientesFiltradosApi.filter(
      (exp) =>
        exp.clasificacionCCD.codigoSerie === filtroCcd.serie.codigo ||
        exp.clasificacionCCD.serieDocumental.toLowerCase().includes(filtroCcd.serie.nombre.toLowerCase()),
    );
  }, [expedientesFiltradosApi, filtroCcd]);

  const conteos = useMemo(
    () => calcularConteosPorEstado(expedientesBase),
    [expedientesBase],
  );

  const volumenActivo = expedientesBase?.length ?? 0;
  const urgentes =
    expedientesBase?.filter(
      (exp) => exp.prioridad === "URGENTE" || exp.prioridad === "MUY_URGENTE",
    ).length ?? 0;
  const proximosAVencer =
    expedientesBase?.filter((exp) => {
      const diasRestantes = Math.ceil(
        (new Date(exp.fechaLimiteAtencion).getTime() - ahora) /
          (1000 * 60 * 60 * 24),
      );
      return diasRestantes >= 0 && diasRestantes <= 2;
    }).length ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            ← Volver al inicio
          </button>

          <p className="text-sm font-bold text-blue-800">SIGD · IESTP "Suiza"</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bandeja de Trabajo Diario</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestión operativa de expedientes, semáforo SLA de 30 días LPAG y taxonomía archivística CCD.
          </p>
        </div>
      </header>

      <section
        className="relative mx-auto my-8 max-w-7xl rounded-2xl border border-slate-200 bg-white px-4 py-6 shadow-sm sm:px-8 sm:py-8"
      >
        {/* Panel de KPIs */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-3xl font-bold tabular-nums text-blue-800">{volumenActivo}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Volumen Activo
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-3xl font-bold tabular-nums text-slate-900">{urgentes}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Trámites Urgentes
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-3xl font-bold tabular-nums text-slate-900">{proximosAVencer}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Próximos a Vencer (LPAG)
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
              recurso={{ estado: "listo", datos: FONDOS_CCD_INSTITUCIONALES }}
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
        {isError && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800" role="alert">
            Ocurrió un error al cargar los expedientes. Intenta nuevamente.
          </p>
        )}
        {!isLoading && !isError && (
          <ExpedienteTable
            expedientes={expedientesVisibles}
            onVerExpediente={(expediente) =>
              navigate(`/expedientes/${expediente.id}`)
            }
          />
        )}
      </section>
    </main>
  );
}
