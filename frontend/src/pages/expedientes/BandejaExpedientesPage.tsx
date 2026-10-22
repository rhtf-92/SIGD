import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Gem, Search } from "lucide-react";

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
    <main className="relative isolate min-h-screen overflow-hidden bg-[#06131b] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[-1] bg-[radial-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),repeating-linear-gradient(135deg,rgba(255,255,255,0.012)_0_1px,transparent_1px_4px)] [background-size:24px_24px,auto]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_8%_14%,rgba(8,145,178,0.18),transparent_32%),radial-gradient(ellipse_at_90%_20%,rgba(217,70,239,0.12),transparent_30%),radial-gradient(ellipse_at_50%_100%,rgba(245,158,11,0.11),transparent_38%)]"
      />
      <header className="border-b border-cyan-300/15 bg-[#07131e]/85 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-sm transition hover:border-amber-300/70 hover:bg-amber-400/10 hover:text-amber-100"
          >
            ← Volver al inicio
          </button>

          <p className="text-sm font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">SIGD · IESTP "Suiza"</p>
          <h1 className="text-2xl font-bold text-fuchsia-300 drop-shadow-[0_0_14px_rgba(232,121,249,0.38)]">Bandeja de Trabajo Diario</h1>
          <p className="mt-1 text-sm text-slate-300">
            Gestión operativa de expedientes, semáforo SLA de 30 días LPAG y taxonomía archivística CCD.
          </p>
        </div>
      </header>

      <section
        className="bandeja-neon-shell relative mx-auto my-8 max-w-7xl rounded-3xl px-6 py-8 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:px-8"
      >
        {/* Panel de KPIs */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-cyan-300/55 bg-gradient-to-br from-cyan-950/75 via-slate-950/75 to-blue-950/70 p-5 text-center shadow-[0_0_28px_rgba(6,182,212,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
            <p className="text-3xl font-bold text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.75)]">{volumenActivo}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-cyan-100/80">
              Volumen Activo
            </p>
          </div>
          <div className="rounded-2xl border border-amber-300/65 bg-gradient-to-br from-amber-950/80 via-orange-950/60 to-slate-950/75 p-5 text-center shadow-[0_0_30px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
            <p className="text-3xl font-bold text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.75)]">{urgentes}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-100/85">
              Trámites Urgentes
            </p>
          </div>
          <div className="rounded-2xl border border-rose-400/50 bg-gradient-to-br from-rose-950/75 via-red-950/55 to-slate-950/75 p-5 text-center shadow-[0_0_28px_rgba(244,63,94,0.16),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
            <div className="flex items-center justify-center gap-2">
              <Gem aria-hidden="true" className="h-4 w-4 animate-pulse text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.85)]" />
              <p className="text-3xl font-bold text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]">{proximosAVencer}</p>
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-rose-100/80">
              Próximos a Vencer (LPAG)
            </p>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtro CCD */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300 drop-shadow-[0_0_7px_rgba(251,191,36,0.6)]" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por CUT, solicitante o asunto…"
              className="w-full rounded-xl border border-cyan-400/35 bg-slate-950/65 py-2 pl-10 pr-4 text-sm text-amber-100 shadow-[0_0_18px_rgba(6,182,212,0.08)] backdrop-blur-md placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/25"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarFiltroCcd(!mostrarFiltroCcd)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur-md transition hover:shadow-[0_0_16px_rgba(245,158,11,0.18)] ${
                filtroCcd
                  ? "border-amber-300 bg-amber-950/75 text-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.2)]"
                    : "border-amber-300/45 bg-slate-950/65 text-amber-100 hover:border-amber-300 hover:bg-amber-400/10"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5 text-amber-600 drop-shadow-[0_0_5px_rgba(245,158,11,0.65)]" />
              Taxonomía CCD {filtroCcd ? `(${filtroCcd.serie.codigo})` : ""}
            </button>
            {filtroCcd && (
              <button
                type="button"
                onClick={() => setFiltroCcd(null)}
                className="text-xs text-rose-300 hover:text-rose-200 hover:underline"
              >
                Limpiar filtro CCD
              </button>
            )}
          </div>
        </div>

        {/* Panel Desplegable de Árbol CCD (ENT-M03-04) */}
        {mostrarFiltroCcd && (
          <div className="mb-6 rounded-2xl border border-amber-300/30 bg-slate-950/60 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between border-b border-amber-300/20 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-100">
                Seleccionar Serie Documental Archivística (Cuadro CCD)
              </h3>
              <button
                type="button"
                onClick={() => setMostrarFiltroCcd(false)}
                className="text-xs text-slate-400 hover:text-amber-200"
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
          <p className="rounded-2xl border border-cyan-400/20 bg-slate-950/65 p-6 text-sm text-cyan-100">Cargando expedientes…</p>
        )}
        {isError && (
          <p className="rounded-2xl border border-rose-400/35 bg-rose-950/50 p-6 text-sm text-rose-200">
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
