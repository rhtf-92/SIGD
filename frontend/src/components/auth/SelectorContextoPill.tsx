import { useState } from "react";
import { Briefcase, ChevronDown, AlertCircle } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import SelectorContextoModal from "./SelectorContextoModal";

export default function SelectorContextoPill() {
  const { usuario } = useAuthStore();
  const [modalAbierto, setModalAbierto] = useState(false);

  const activo = usuario?.contextoActivo;
  const contextos = usuario?.contextosDisponibles ?? [];
  const requiereSeleccion = !activo && contextos.length > 1;

  if (contextos.length <= 1 && !requiereSeleccion) {
    if (!activo) return null;
    return (
      <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white border border-white/20">
        <Briefcase className="w-3.5 h-3.5 opacity-80" />
        <span className="font-semibold">{activo.nombre}</span>
        {activo.areaNombre && (
          <span className="opacity-80 font-normal">({activo.areaNombre})</span>
        )}
      </div>
    );
  }

  return (
    <>
      {requiereSeleccion ? (
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition shadow-sm cursor-pointer animate-pulse"
        >
          <AlertCircle className="w-4 h-4" />
          <span>Elegir Contexto</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-medium text-white transition border border-white/20 cursor-pointer"
          title="Haga clic para cambiar de rol o ámbito de trabajo"
        >
          <Briefcase className="w-3.5 h-3.5 opacity-90" />
          <div className="flex flex-col text-left leading-tight">
            <span className="font-bold">{activo?.nombre}</span>
            {activo?.areaNombre && (
              <span className="text-[10px] opacity-80 font-normal truncate max-w-[140px]">
                {activo.areaNombre}
              </span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-1" />
        </button>
      )}

      <SelectorContextoModal
        abierto={modalAbierto || requiereSeleccion}
        alCerrar={() => setModalAbierto(false)}
        bloqueante={requiereSeleccion}
      />
    </>
  );
}
