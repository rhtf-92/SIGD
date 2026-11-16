import { useEffect, useState, type FormEvent } from "react";
import { reasignarMasivo, listarDocentesElegibles } from "../../api/evaluadoresApi";
import type { DocenteElegible, ReasignacionMasivaResultado } from "../../types/expediente";
import { ApiHttpError } from "../../types/api";

interface ExpedienteLoteItem {
  idExpediente: string;
  cut: string;
  asunto: string;
}

interface ReasignacionMasivaModalProps {
  expedientes: ExpedienteLoteItem[];
  areaId?: string | null;
  onExito: () => void;
  onCerrar: () => void;
}

export default function ReasignacionMasivaModal({
  expedientes,
  areaId,
  onExito,
  onCerrar,
}: ReasignacionMasivaModalProps) {
  const [docentes, setDocentes] = useState<DocenteElegible[]>([]);
  const [cargandoDocentes, setCargandoDocentes] = useState(true);
  const [idDocenteSeleccionado, setIdDocenteSeleccionado] = useState("");
  const [motivo, setMotivo] = useState("Redistribución de expedientes para evaluación académica");
  const [justificacion, setJustificacion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ReasignacionMasivaResultado | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setCargandoDocentes(true);
      try {
        const lista = await listarDocentesElegibles(areaId);
        if (!cancelado) {
          setDocentes(lista);
          if (lista.length > 0) {
            setIdDocenteSeleccionado(lista[0].idUsuario);
          }
        }
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "Error al cargar docentes elegibles.");
        }
      } finally {
        if (!cancelado) setCargandoDocentes(false);
      }
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [areaId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!idDocenteSeleccionado) {
      setError("Debe seleccionar un docente evaluador elegible.");
      return;
    }

    if (motivo.trim().length < 5) {
      setError("El motivo o instrucción de asignación debe tener al menos 5 caracteres.");
      return;
    }

    if (justificacion.trim().length < 10) {
      setError("La justificación de reasignación debe tener al menos 10 caracteres conforme a normativa.");
      return;
    }

    setEnviando(true);
    try {
      const res = await reasignarMasivo({
        expedienteIds: expedientes.map((e) => e.idExpediente),
        idNuevoDocente: idDocenteSeleccionado,
        motivoAsignacion: motivo.trim(),
        justificacionReasignacion: justificacion.trim(),
        observaciones: observaciones.trim() || null,
      });
      setResultado(res);
      if (res.ok) {
        setTimeout(() => {
          onExito();
        }, 1500);
      }
    } catch (err) {
      if (err instanceof ApiHttpError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Error al procesar la reasignación masiva.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-reasignar-masivo-titulo"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 id="modal-reasignar-masivo-titulo" className="text-lg font-bold text-slate-900">
              Reasignación Masiva de Expedientes
            </h2>
            <p className="text-xs font-semibold text-blue-700">
              {expedientes.length} expediente(s) seleccionado(s) para reasignar
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            className="my-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {resultado ? (
          <div className="my-6 space-y-4 text-center">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
                resultado.ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {resultado.ok ? "✓" : "⚠"}
            </div>
            <h3 className="text-base font-bold text-slate-800">{resultado.mensaje}</h3>
            <p className="text-xs text-slate-500">
              Exitosos: <span className="font-bold text-green-700">{resultado.exitosos}</span> ·
              Fallidos: <span className="font-bold text-red-600">{resultado.fallidos}</span>
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2 text-left text-xs">
              {resultado.resultados.map((r) => {
                const exp = expedientes.find((e) => e.idExpediente === r.expedienteId);
                return (
                  <div
                    key={r.expedienteId}
                    className={`flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0 ${
                      r.ok ? "text-slate-700" : "text-red-700 font-semibold"
                    }`}
                  >
                    <span>{exp ? exp.cut : r.expedienteId.slice(0, 8)}</span>
                    <span>{r.ok ? "Reasignado ✓" : `Error: ${r.error || "Rechazado"}`}</span>
                  </div>
                );
              })}
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onExito();
                }}
                className="rounded-lg bg-blue-700 px-6 py-2 text-xs font-bold text-white hover:bg-blue-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
            {/* Lista previa de expedientes seleccionados */}
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Expedientes que serán reasignados ({expedientes.length})
              </label>
              <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs divide-y divide-slate-200">
                {expedientes.map((exp) => (
                  <div key={exp.idExpediente} className="py-1 flex items-center justify-between">
                    <span className="font-mono font-semibold text-blue-700">{exp.cut}</span>
                    <span className="truncate max-w-xs text-slate-600">{exp.asunto}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="select-nuevo-evaluador" className="block text-xs font-bold text-slate-700">
                Nuevo Docente Evaluador Asignado *
              </label>
              {cargandoDocentes ? (
                <p className="mt-1 text-xs text-slate-500">Cargando docentes elegibles...</p>
              ) : docentes.length === 0 ? (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  No hay docentes elegibles activos disponibles en el área.
                </p>
              ) : (
                <select
                  id="select-nuevo-evaluador"
                  value={idDocenteSeleccionado}
                  onChange={(e) => setIdDocenteSeleccionado(e.target.value)}
                  disabled={enviando}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  {docentes.map((d) => (
                    <option key={d.idUsuario} value={d.idUsuario}>
                      {d.nombreCompleto} ({d.correo}) — {d.rol}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="input-motivo-masivo" className="block text-xs font-bold text-slate-700">
                Motivo / Instrucción de Asignación *
              </label>
              <input
                id="input-motivo-masivo"
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. Redistribución de carga lectiva y expedientes de titulación"
                disabled={enviando}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                minLength={5}
              />
            </div>

            <div>
              <label htmlFor="input-justificacion-masiva" className="block text-xs font-bold text-slate-700">
                Justificación de Reasignación en Lote (Mínimo 10 caracteres) *
              </label>
              <textarea
                id="input-justificacion-masiva"
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                placeholder="Indique la causa administrativa o motivo formal de la reasignación en lote..."
                disabled={enviando}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                minLength={10}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {justificacion.length}/10 caracteres mínimos requeridos por el reglamento institucional.
              </p>
            </div>

            <div>
              <label htmlFor="input-observaciones-masiva" className="block text-xs font-bold text-slate-700">
                Observaciones Adicionales (Opcional)
              </label>
              <textarea
                id="input-observaciones-masiva"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Instrucciones adicionales para el nuevo evaluador..."
                disabled={enviando}
                rows={2}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onCerrar}
                disabled={enviando}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando || cargandoDocentes || docentes.length === 0}
                className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
              >
                {enviando
                  ? "Reasignando en lote..."
                  : `Reasignar ${expedientes.length} Expediente(s)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
