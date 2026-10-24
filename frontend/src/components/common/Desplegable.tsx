// Desplegable (acordeón) reutilizable del SIGD.
// Se usa en preguntas frecuentes y paneles de ayuda: solo un panel
// abierto a la vez cuando están agrupados con el mismo `grupo`.
import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

interface DesplegableProps {
  titulo: string;
  children: ReactNode;
  abiertoPorDefecto?: boolean;
}

export function Desplegable({ titulo, children, abiertoPorDefecto = false }: DesplegableProps) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);
  const id = useId();

  return (
    <div
      className={`card-sigd overflow-hidden transition ${abierto ? "!border-[#006EC7]/40" : ""}`}
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={`${id}-panel`}
        id={`${id}-boton`}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-display text-[15px] font-extrabold tracking-tight text-slate-900">
          {titulo}
        </span>
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition duration-300 ${
            abierto
              ? "rotate-180 border-[#006EC7] bg-[#006EC7] text-white"
              : "border-slate-200 text-slate-400"
          }`}
        >
          <ChevronDown size={16} strokeWidth={2.75} />
        </span>
      </button>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-boton`}
        className={`grid transition-all duration-300 ease-out ${
          abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-sm font-medium leading-6 text-slate-600">{children}</div>
        </div>
      </div>
    </div>
  );
}

interface GrupoDesplegablesProps {
  items: { titulo: string; contenido: ReactNode }[];
}

export function GrupoDesplegables({ items }: GrupoDesplegablesProps) {
  return (
    <div className="grid gap-3">
      {items.map((item, i) => (
        <Desplegable key={item.titulo} titulo={item.titulo} abiertoPorDefecto={i === 0}>
          {item.contenido}
        </Desplegable>
      ))}
    </div>
  );
}
