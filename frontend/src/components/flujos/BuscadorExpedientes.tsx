import { useEffect, useMemo, useRef, useState } from "react";

import { ETIQUETA_ESTADO_TRAMITE } from "../../types/workflowAcademico";
import type { WorkflowAcademico } from "../../types/workflowAcademico";

interface BuscadorExpedientesProps {
  expedientes: readonly WorkflowAcademico[];
  expedienteActualId: number;
  onSeleccionar: (idTramite: number) => void;
}

/**
 * ENT-M04-01 · Buscador de expedientes académicos.
 * Filtra por N.° de expediente, CUT, trámite, solicitante o programa y carga
 * el seleccionado en el visualizador para pasarlo a revisión (Tomar en revisión).
 */
export default function BuscadorExpedientes({
  expedientes,
  expedienteActualId,
  onSeleccionar,
}: BuscadorExpedientesProps) {
  const [busqueda, setBusqueda] = useState("");
  const ultimoAutoRef = useRef<string>("");

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [...expedientes];
    return expedientes.filter((e) => {
      const solicitante = `${e.solicitante.nombres} ${e.solicitante.apellidos}`.toLowerCase();
      return (
        String(e.idTramite).includes(q) ||
        e.cut.toLowerCase().includes(q) ||
        e.nombreTramite.toLowerCase().includes(q) ||
        solicitante.includes(q) ||
        e.programa.toLowerCase().includes(q)
      );
    });
  }, [busqueda, expedientes]);

  const numerosDisponibles = useMemo(
    () => expedientes.map((e) => e.idTramite).join(", "),
    [expedientes],
  );

  /** Enter con N.° exacto o CUT exacto carga el expediente sin buscar el botón. */
  const manejarTecla = (tecla: string) => {
    if (tecla !== "Enter") return;
    const q = busqueda.trim().toLowerCase();
    if (!q) return;
    const exacto = expedientes.find(
      (e) => String(e.idTramite) === q || e.cut.toLowerCase() === q,
    );
    if (exacto && exacto.idTramite !== expedienteActualId) {
      ultimoAutoRef.current = q;
      onSeleccionar(exacto.idTramite);
    }
  };

  // Al escribir el N.° o CUT exacto de otra persona se carga su expediente
  // solo en el visualizador (antes solo filtraba la lista y abajo seguía el
  // predeterminado). Con guardia para no recargar en cada tecla.
  useEffect(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) {
      ultimoAutoRef.current = "";
      return;
    }
    const exacto = expedientes.find(
      (e) => String(e.idTramite) === q || e.cut.toLowerCase() === q,
    );
    if (
      exacto &&
      exacto.idTramite !== expedienteActualId &&
      ultimoAutoRef.current !== q
    ) {
      ultimoAutoRef.current = q;
      onSeleccionar(exacto.idTramite);
    }
  }, [busqueda, expedientes, expedienteActualId, onSeleccionar]);

  return (
    <section
      aria-label="Buscador de expedientes académicos para revisión"
      className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Buscador de expedientes</h2>
          <p className="text-sm text-slate-500">
            Busque por N.° de expediente, CUT, trámite o solicitante y cárguelo
            para pasarlo a revisión.
          </p>
        </div>
        <label className="w-full sm:max-w-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
            Buscar expediente
          </span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => manejarTecla(e.key)}
            placeholder="Ej. 413, EXP-2026-000413, certificado, Torres…"
            aria-label="Buscar expediente por número, CUT, trámite o solicitante"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {resultados.length} de {expedientes.length} expediente(s) · N.° disponibles:{" "}
        {numerosDisponibles} · Pulse Enter con el N.° o CUT exacto para cargar directo.
      </p>

      {resultados.length === 0 ? (
        <p role="status" className="mt-4 text-sm text-slate-500">
          Sin resultados para “{busqueda}”. Pruebe con el N.° de expediente o el CUT.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {resultados.map((e) => {
            const esActual = e.idTramite === expedienteActualId;
            const revisable = e.estado === "EN_TRAMITE" || e.estado === "EN_REVISION";
            return (
              <li
                key={e.idTramite}
                className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between ${
                  esActual ? "bg-blue-50/60" : "bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    N.° {e.idTramite} · <span className="font-mono">{e.cut}</span>
                    {esActual && (
                      <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[0.65rem] font-bold text-white">
                        En visualizador
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-slate-600">{e.nombreTramite}</p>
                  <p className="text-xs text-slate-500">
                    {e.solicitante.nombres} {e.solicitante.apellidos} · {e.programa} ·{" "}
                    {ETIQUETA_ESTADO_TRAMITE[e.estado]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSeleccionar(e.idTramite)}
                  disabled={esActual}
                  title={
                    revisable
                      ? "Cargar en el visualizador para tomar en revisión"
                      : "Cargar en el visualizador (ver detalle)"
                  }
                  className="shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {esActual ? "Cargado" : "Cargar para revisión"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
