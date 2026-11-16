import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../../types/api";

import BandejaTabFilter from "../../components/expedientes/BandejaTabFilter";
import ExpedienteTable from "../../components/expedientes/ExpedienteTable";
import CcdTreeSelector from "../../components/expedientes/CcdTreeSelector";
import ReasignacionMasivaModal from "../../components/expedientes/ReasignacionMasivaModal";
import { useBandejaExpedientes, mensajeErrorExpediente } from "../../hooks/useBandejaExpedientes";
import { useAuthStore } from "../../stores/authStore";
import type { PestanaRutaDoc } from "../../types/expediente";
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

export default function BandejaExpedientesPage() {
  const navigate = useNavigate();
  const [estadoActivo, setEstadoActivo] = useState<PestanaRutaDoc>("PENDIENTES");
  const [busqueda, setBusqueda] = useState("");
  const [filtroCcd, setFiltroCcd] = useState<RutaCcdSeleccionada | null>(null);
  const [mostrarFiltroCcd, setMostrarFiltroCcd] = useState(false);
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const usuario = useAuthStore((state) => state.usuario);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [modalReasignacionMasiva, setModalReasignacionMasiva] = useState(false);

  const puedeReasignar = Boolean(
    usuario && (
      ["ADMINISTRADOR", "DIRECTOR", "JEFE_UNIDAD_ACADEMICA", "COORDINADOR_AREA", "SECRETARIO"].includes(usuario.rol) ||
      usuario.roles?.some((r) => ["ADMINISTRADOR", "DIRECTOR", "JEFE_UNIDAD_ACADEMICA", "COORDINADOR_AREA", "SECRETARIO"].includes(r)) ||
      usuario.permisos?.some((p) => p.codigo === "EXPEDIENTE_REASIGNAR") ||
      usuario.contextoActivo?.permisos?.some((p) => p.codigo === "EXPEDIENTE_REASIGNAR")
    )
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setBusquedaAplicada(busqueda), 250);
    return () => window.clearTimeout(timeout);
  }, [busqueda]);

  const { data: elementos, isLoading, isError, error, contadores,
    fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } =
    useBandejaExpedientes({ pestana: estadoActivo, busqueda: busquedaAplicada });
  const errorAcceso = error instanceof ApiHttpError && [401, 403, 404].includes(error.status);
  const errorBloqueante = isError && (!isFetchNextPageError || errorAcceso);
  const conteos = errorBloqueante ? undefined : contadores;
  const expedientesVisibles = useMemo(() => errorBloqueante ? [] : elementos ?? [], [elementos, errorBloqueante]);
  const volumenActivo = conteos ? Object.values(conteos).reduce((a, b) => a + b, 0) : "—";
  const urgentes = "No disponible";
  const proximosAVencer = "No disponible";

  const handleToggleSeleccion = (idExpediente: string) => {
    setSeleccionados((prev) =>
      prev.includes(idExpediente)
        ? prev.filter((id) => id !== idExpediente)
        : [...prev, idExpediente]
    );
  };

  const handleSeleccionarTodos = () => {
    const idsVisibles = expedientesVisibles.map((e) => e.idExpediente);
    const todosSeleccionados =
      idsVisibles.length > 0 && idsVisibles.every((id) => seleccionados.includes(id));

    if (todosSeleccionados) {
      setSeleccionados((prev) => prev.filter((id) => !idsVisibles.includes(id)));
    } else {
      setSeleccionados((prev) => Array.from(new Set([...prev, ...idsVisibles])));
    }
  };

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

          <p className="text-sm font-bold text-blue-700">SIGD · IESTP "Suiza"</p>
          <h1 className="text-2xl font-bold">Bandeja de Trabajo Diario</h1>
          <p className="mt-1 text-sm text-slate-500">
            Consulta operativa de expedientes y sus actuaciones registradas.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Panel de KPIs */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-3xl font-bold text-blue-700">{volumenActivo}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total de expedientes
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
              Próximos a vencer
            </p>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtro CCD */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por CUT o asunto" maxLength={100}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled title="La clasificación CCD de estos expedientes no está disponible" onClick={() => setMostrarFiltroCcd(!mostrarFiltroCcd)}
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
            onCambiarEstado={(pestana) => {
              setSeleccionados([]);
              setEstadoActivo(pestana);
            }}
            conteos={conteos}
          />
        </div>

        {/* Barra de Acciones Masivas para Coordinador/Autoridad */}
        {seleccionados.length > 0 && puedeReasignar && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">
                {seleccionados.length}
              </span>
              <span className="text-sm font-semibold text-blue-950">
                {seleccionados.length === 1
                  ? "1 expediente seleccionado para reasignación operativa"
                  : `${seleccionados.length} expedientes seleccionados para reasignación operativa`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSeleccionados([])}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Deseleccionar todos
              </button>
              <button
                type="button"
                onClick={() => setModalReasignacionMasiva(true)}
                className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition flex items-center gap-1.5"
              >
                <span>🔄 Reasignar Evaluador ({seleccionados.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Tabla Operativa con Semáforo SLA integrado */}
        {isLoading && (
          <p className="p-6 text-sm text-slate-500">Cargando expedientes…</p>
        )}
        {isError && (
          <p role="alert" className="p-6 text-sm text-red-600">
            {mensajeErrorExpediente(error)}
          </p>
        )}
        {!isLoading && !errorBloqueante && (
          <ExpedienteTable
            expedientes={expedientesVisibles}
            onVerExpediente={(expediente) =>
              navigate(`/expedientes/${expediente.idExpediente}`)
            }
            permitirSeleccion={puedeReasignar}
            seleccionados={seleccionados}
            onToggleSeleccion={handleToggleSeleccion}
            onSeleccionarTodos={handleSeleccionarTodos}
          />
        )}
        {hasNextPage && !errorBloqueante && (
          <button type="button" disabled={isFetchingNextPage}
            className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
            onClick={() => { if (!isFetchingNextPage) void fetchNextPage(); }}>
            {isFetchingNextPage ? "Cargando más expedientes…" : "Cargar más"}
          </button>
        )}

        {/* Modal de Reasignación Masiva de Evaluador */}
        {modalReasignacionMasiva && (
          <ReasignacionMasivaModal
            expedientes={expedientesVisibles
              .filter((e) => seleccionados.includes(e.idExpediente))
              .map((e) => ({
                idExpediente: e.idExpediente,
                cut: e.cut,
                asunto: e.asunto,
              }))}
            areaId={usuario?.areaId ?? null}
            onCerrar={() => setModalReasignacionMasiva(false)}
            onExito={() => {
              setSeleccionados([]);
              setModalReasignacionMasiva(false);
              void refetch();
            }}
          />
        )}
      </section>
    </main>
  );
}
