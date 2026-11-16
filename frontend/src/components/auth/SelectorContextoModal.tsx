import { useState } from "react";
import { Briefcase, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useAuthStore, type ContextoUsuario } from "../../stores/authStore";

interface SelectorContextoModalProps {
  abierto: boolean;
  alCerrar?: () => void;
  bloqueante?: boolean;
}

export default function SelectorContextoModal({
  abierto,
  alCerrar,
  bloqueante = false,
}: SelectorContextoModalProps) {
  const { usuario, seleccionarContexto } = useAuthStore();
  const [seleccionandoId, setSeleccionandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) return null;

  const contextos = usuario?.contextosDisponibles ?? [];
  const activo = usuario?.contextoActivo;

  async function handleSeleccionar(idAsignacion: string) {
    if (seleccionandoId) return;
    setSeleccionandoId(idAsignacion);
    setError(null);
    try {
      await seleccionarContexto(idAsignacion);
      if (alCerrar) alCerrar();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar el contexto de trabajo. Intente nuevamente."
      );
    } finally {
      setSeleccionandoId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-selector-contexto"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Encabezado */}
        <div className="bg-[#004D9E] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/10 p-2">
              <Briefcase className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="titulo-selector-contexto" className="text-lg font-bold">
                Contexto de Trabajo Institucional
              </h2>
              <p className="text-xs text-white/80">
                Seleccione el rol o capacidad operativa para esta sesión
              </p>
            </div>
          </div>
          {!bloqueante && alCerrar && (
            <button
              type="button"
              onClick={alCerrar}
              className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Mensaje de Advertencia si es Selección Obligatoria */}
        {bloqueante && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium">
              Su cuenta cuenta con múltiples asignaciones. Debe seleccionar el contexto con el que operará antes de acceder a los módulos institucionales.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Lista de Contextos */}
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {contextos.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No tiene asignaciones o capacidades activas registradas.
            </div>
          ) : (
            contextos.map((ctx: ContextoUsuario) => {
              const esActivo = activo?.idAsignacion === ctx.idAsignacion;
              const cargando = seleccionandoId === ctx.idAsignacion;

              return (
                <div
                  key={ctx.idAsignacion}
                  className={`rounded-xl border p-4 transition flex items-center justify-between gap-4 ${
                    esActivo
                      ? "border-[#004D9E] bg-blue-50/50 shadow-xs ring-1 ring-[#004D9E]"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                          ctx.tipo === "ROL"
                            ? "bg-blue-100 text-[#004D9E]"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {ctx.tipo}
                      </span>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {ctx.nombre}
                      </h3>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span className="font-medium text-slate-500">Ámbito:</span>
                      <span>
                        {ctx.areaNombre ? ctx.areaNombre : "Institucional Global"}
                      </span>
                    </div>
                  </div>

                  <div>
                    {esActivo ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[#004D9E] bg-white px-3 py-1.5 rounded-lg border border-[#004D9E]/30 shadow-xs">
                        <CheckCircle2 className="w-4 h-4 text-[#004D9E]" />
                        Activo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSeleccionar(ctx.idAsignacion)}
                        disabled={cargando}
                        className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#004D9E] hover:bg-[#003875] text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {cargando ? "Cambiando…" : "Seleccionar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pie */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{contextos.length} asignaciones disponibles</span>
          <span className="italic">El contexto rige las facultades en esta sesión</span>
        </div>
      </div>
    </div>
  );
}
