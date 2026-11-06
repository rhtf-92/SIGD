import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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
    <div className="flex-1 w-full bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-4 sm:py-5">
          {/* Migajas de pan canónicas */}
          <nav
            aria-label="Migajas de pan de expedientes"
            className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
          >
            <Link to="/" className="hover:text-blue-700 hover:underline transition-colors">
              Inicio
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600">Expedientes</span>
            <span className="text-slate-300">/</span>
            <span aria-current="page" className="font-semibold text-blue-700">
              Bandeja de Trabajo
            </span>
          </nav>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                ← Volver al inicio
              </button>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold">Bandeja de Trabajo Diario</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Gestión operativa de expedientes, semáforo SLA de 30 días LPAG y taxonomía archivística CCD.
          </p>

          {/* Botones de navegación intermodular */}
          <nav
            aria-label="Navegación operativa institucional"
            className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 mt-4 border-t border-slate-100 scrollbar-none"
          >
            <Link
              to="/expedientes"
              aria-current="page"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-blue-700 text-white shadow-xs"
            >
              <span>📂 Bandeja de Expedientes</span>
            </Link>
            <Link
              to="/ventanilla"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>🏛️ Ventanilla Presencial</span>
            </Link>
            <Link
              to="/flujo-validez-legal"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>📜 Validez Legal</span>
            </Link>
            <Link
              to="/reportes"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <span>📊 Reportes MGD</span>
            </Link>
          </nav>
        </div>
      </header>

      <section className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-5 sm:py-8">
        {/* Panel de KPIs */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 xl:gap-6 2xl:gap-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 text-center shadow-xs">
            <p className="text-2xl sm:text-3xl font-bold text-blue-700">{volumenActivo}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Volumen Activo
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 text-center shadow-xs">
            <p className="text-2xl sm:text-3xl font-bold text-amber-600">{urgentes}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Trámites Urgentes
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 text-center shadow-xs">
            <p className="text-2xl sm:text-3xl font-bold text-red-600">{proximosAVencer}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Próximos a Vencer (LPAG)
            </p>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtro CCD */}
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 w-full sm:max-w-lg lg:max-w-xl">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por CUT, solicitante o asunto…"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-xs sm:text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarFiltroCcd(!mostrarFiltroCcd)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                filtroCcd
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              📂 Taxonomía CCD {filtroCcd ? `(${filtroCcd.serie.codigo})` : ""}
            </button>
            {filtroCcd && (
              <button
                type="button"
                onClick={() => setFiltroCcd(null)}
                className="text-xs text-red-600 hover:underline"
              >
                Limpiar filtro CCD
              </button>
            )}
          </div>
        </div>

        {/* Panel Desplegable de Árbol CCD (ENT-M03-04) */}
        {mostrarFiltroCcd && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Seleccionar Serie Documental Archivística (Cuadro CCD)
              </h3>
              <button
                type="button"
                onClick={() => setMostrarFiltroCcd(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
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
          <p className="p-6 text-sm text-slate-500">Cargando expedientes…</p>
        )}
        {isError && (
          <p className="p-6 text-sm text-red-600">
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
    </div>
  );
}
