import { useEffect, useState, type FormEvent } from "react";
import {
  asignarEvaluador,
  reasignarEvaluador,
  listarDocentesElegibles,
} from "../../api/evaluadoresApi";
import type { DocenteElegible, EvaluadorActivoInfo } from "../../types/expediente";
import { ApiHttpError } from "../../types/api";

interface AsignarEvaluadorModalProps {
  expedienteId: string;
  codigoExpediente: string;
  evaluadorActual?: EvaluadorActivoInfo | null;
  areaId?: string | null;
  onExito: () => void;
  onCerrar: () => void;
}

export default function AsignarEvaluadorModal({
  expedienteId,
  codigoExpediente,
  evaluadorActual,
  areaId,
  onExito,
  onCerrar,
}: AsignarEvaluadorModalProps) {
  const esReasignacion = Boolean(evaluadorActual && evaluadorActual.idUsuarioDocente);
  const [docentes, setDocentes] = useState<DocenteElegible[]>([]);
  const [cargandoDocentes, setCargandoDocentes] = useState(true);
  const [idDocenteSeleccionado, setIdDocenteSeleccionado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setCargandoDocentes(true);
      try {
        const lista = await listarDocentesElegibles(areaId);
        if (!cancelado) {
          // Filtrar el docente actual si es reasignación
          const elegibles = esReasignacion
            ? lista.filter((d) => d.idUsuario !== evaluadorActual?.idUsuarioDocente)
            : lista;
          setDocentes(elegibles);
          if (elegibles.length > 0) {
            setIdDocenteSeleccionado(elegibles[0].idUsuario);
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
  }, [areaId, esReasignacion, evaluadorActual?.idUsuarioDocente]);

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

    if (esReasignacion && justificacion.trim().length < 10) {
      setError("La justificación de reasignación debe tener al menos 10 caracteres conforme a normativa.");
      return;
    }

    setEnviando(true);
    try {
      if (esReasignacion) {
        await reasignarEvaluador(expedienteId, {
          idNuevoDocente: idDocenteSeleccionado,
          motivoAsignacion: motivo.trim(),
          justificacionReasignacion: justificacion.trim(),
          observaciones: observaciones.trim() || null,
        });
      } else {
        await asignarEvaluador(expedienteId, {
          idUsuarioDocente: idDocenteSeleccionado,
          motivoAsignacion: motivo.trim(),
          observaciones: observaciones.trim() || null,
        });
      }
      onExito();
    } catch (err) {
      if (err instanceof ApiHttpError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Error al procesar la asignación.");
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
      aria-labelledby="modal-asignar-titulo"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 id="modal-asignar-titulo" className="text-lg font-bold text-slate-900">
              {esReasignacion ? "Reasignar Docente Evaluador" : "Asignar Docente Evaluador"}
            </h2>
            <p className="text-xs font-semibold text-blue-700">Expediente: {codigoExpediente}</p>
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

        {evaluadorActual && (
          <div className="my-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <span className="font-bold">Evaluador actual:</span> {evaluadorActual.docenteNombre} (
            {evaluadorActual.docenteEmail})
            <br />
            <span className="text-[11px] text-amber-700">
              Asignado el {new Date(evaluadorActual.asignadoEn).toLocaleDateString("es-PE")} — Estado:{" "}
              {evaluadorActual.estadoEvaluacion}
            </span>
          </div>
        )}

        {error && (
          <div
            className="my-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          <div>
            <label htmlFor="select-docente" className="block text-xs font-bold text-slate-700">
              {esReasignacion ? "Nuevo Docente Evaluador *" : "Docente Evaluador Elegible *"}
            </label>
            {cargandoDocentes ? (
              <p className="mt-1 text-xs text-slate-500">Cargando docentes elegibles...</p>
            ) : docentes.length === 0 ? (
              <p className="mt-1 text-xs font-semibold text-red-600">
                No hay otros docentes elegibles activos disponibles en el área.
              </p>
            ) : (
              <select
                id="select-docente"
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
            <label htmlFor="input-motivo" className="block text-xs font-bold text-slate-700">
              Motivo o Instrucción de Asignación *
            </label>
            <input
              id="input-motivo"
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Evaluación de proyecto de titulación y suficiencia profesional"
              disabled={enviando}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              minLength={5}
            />
          </div>

          {esReasignacion && (
            <div>
              <label htmlFor="input-justificacion" className="block text-xs font-bold text-slate-700">
                Justificación de Reasignación (Mínimo 10 caracteres) *
              </label>
              <textarea
                id="input-justificacion"
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                placeholder="Indique la causa administrativa o justificación oficial del cambio de evaluador..."
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
          )}

          <div>
            <label htmlFor="input-observaciones" className="block text-xs font-bold text-slate-700">
              Observaciones Adicionales (Opcional)
            </label>
            <textarea
              id="input-observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas internas o alcances adicionales para el evaluador..."
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
                ? "Procesando..."
                : esReasignacion
                ? "Confirmar Reasignación"
                : "Asignar Evaluador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
