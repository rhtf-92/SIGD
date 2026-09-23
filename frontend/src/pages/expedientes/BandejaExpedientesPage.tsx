import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import BandejaTabFilter from "../../components/expedientes/BandejaTabFilter";
import ExpedienteTable from "../../components/expedientes/ExpedienteTable";
import { useBandejaExpedientes, useExpedientesBase } from "../../hooks/useBandejaExpedientes";
import {
  ORDEN_PESTANAS_BANDEJA,
  type EstadoFlujoExpediente,
  type ExpedienteSGD,
} from "../../types/expediente";

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
  const [estadoActivo, setEstadoActivo] = useState<EstadoFlujoExpediente>(
    "PENDIENTE",
  );
  const [busqueda, setBusqueda] = useState("");

  const { data: expedientesBase } = useExpedientesBase();
  const { data: expedientesFiltrados, isLoading, isError } =
    useBandejaExpedientes({ estado: estadoActivo, busqueda });

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
        (new Date(exp.fechaLimiteAtencion).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );
      return diasRestantes >= 0 && diasRestantes <= 2;
    }).length ?? 0;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Volver al inicio
          </button>

          <p className="text-sm font-bold text-blue-700">SIGD</p>
          <h1 className="text-2xl font-bold">Bandeja de Trabajo Diario</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestión de expedientes de tu unidad orgánica, según plazos LPAG (Ley N.º
            27444).
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Panel de KPIs */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-blue-700">{volumenActivo}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Volumen Activo
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-amber-600">{urgentes}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Trámites Urgentes
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-red-600">{proximosAVencer}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Próximos a Vencer
            </p>
          </div>
        </div>

        {/* Buscador simple */}
        <div className="mb-4">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por CUT, solicitante o asunto…"
            className="w-full max-w-md rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Pestañas */}
        <div className="mb-4">
          <BandejaTabFilter
            estadoActivo={estadoActivo}
            onCambiarEstado={setEstadoActivo}
            conteos={conteos}
          />
        </div>

        {/* Tabla */}
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
            expedientes={expedientesFiltrados ?? []}
            onVerExpediente={(expediente) =>
              navigate(`/expedientes/${expediente.id}`)
            }
          />
        )}
      </section>
    </main>
  );
}
