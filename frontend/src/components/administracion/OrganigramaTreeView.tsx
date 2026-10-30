// Organigrama jerárquico Materialized Path (ENT-M05-05)
import { useMemo, useState } from "react";
import type { AreaOrganica } from "../../types/tablasMaestras";
import StatusBadge from "./common/StatusBadge";
import { ChevronDown, ChevronRight, FolderTree } from "lucide-react";

interface NodoArbol extends AreaOrganica {
  children: NodoArbol[];
}

function construirArbol(areas: AreaOrganica[]): NodoArbol[] {
  const ordenado = [...areas].sort((a, b) =>
    a.ruta.localeCompare(b.ruta, undefined, { numeric: true }),
  );

  const mapa = new Map<string, NodoArbol>();
  ordenado.forEach((area) => mapa.set(area.ruta, { ...area, children: [] }));

  const raices: NodoArbol[] = [];
  ordenado.forEach((area) => {
    const partes = area.ruta.split(".");
    const rutaPadre = partes.slice(0, -1).join(".");
    const padre = rutaPadre ? mapa.get(rutaPadre) : undefined;
    const nodo = mapa.get(area.ruta);
    if (!nodo) return;
    if (padre) padre.children.push(nodo);
    else raices.push(nodo);
  });

  return raices;
}

interface OrganigramaTreeViewProps {
  areas: AreaOrganica[];
}

interface RamasProps {
  nodos: NodoArbol[];
  expandidos: Set<string>;
  onAlternar: (ruta: string) => void;
}

function Ramas({ nodos, expandidos, onAlternar }: RamasProps) {
  return (
    <ul className="space-y-2">
      {nodos.map((nodo) => {
        const tieneHijos = nodo.children.length > 0;
        const expandido = expandidos.has(nodo.ruta);

        return (
          <li key={nodo.ruta}>
            <div
              className={`flex flex-wrap items-center gap-2.5 rounded-xl border px-3.5 py-2.5 backdrop-blur-md transition-all duration-200 ${
                expandido
                  ? "border-cyan-500/30 bg-slate-900/80 shadow-[0_0_15px_rgba(6,182,212,0.08)]"
                  : "border-slate-800/80 bg-slate-900/50 hover:bg-slate-850 hover:border-slate-700"
              }`}
            >
              {tieneHijos ? (
                <button
                  type="button"
                  onClick={() => onAlternar(nodo.ruta)}
                  aria-label={
                    expandido
                      ? `Contraer ${nodo.nombre}`
                      : `Expandir ${nodo.nombre}`
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-cyan-400 hover:text-white hover:border-cyan-400/50 transition cursor-pointer"
                >
                  {expandido ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="flex h-6 w-6 items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                </span>
              )}

              {/* Materialized Path Badge */}
              <span className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                {nodo.ruta}
              </span>

              {/* Code */}
              <span className="rounded-md border border-blue-500/30 bg-blue-950/40 px-2 py-0.5 font-mono text-xs font-semibold text-blue-300">
                {nodo.codigo}
              </span>

              {/* Name */}
              <span className="text-sm font-semibold text-white">
                {nodo.nombre}
              </span>

              {/* Detail */}
              <span className="text-xs text-slate-400">
                {nodo.detalle}
              </span>

              {/* Status */}
              <span className="ml-auto">
                <StatusBadge status={nodo.estado} size="sm" />
              </span>
            </div>

            {tieneHijos && expandido && (
              <div className="ml-5 mt-2 border-l-2 border-cyan-500/20 pl-4 space-y-2">
                <Ramas
                  nodos={nodo.children}
                  expandidos={expandidos}
                  onAlternar={onAlternar}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function OrganigramaTreeView({ areas }: OrganigramaTreeViewProps) {
  const arbol = useMemo(() => construirArbol(areas), [areas]);

  const [expandidos, setExpandidos] = useState<Set<string>>(
    () => new Set(areas.map((area) => area.ruta)),
  );

  function alternarRuta(ruta: string) {
    setExpandidos((actuales) => {
      const nuevo = new Set(actuales);
      if (nuevo.has(ruta)) nuevo.delete(ruta);
      else nuevo.add(ruta);
      return nuevo;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
        <FolderTree className="h-4 w-4 text-cyan-400" />
        <span>Estructura de dependencias según modelo jerárquico Materialized Path.</span>
      </div>
      <Ramas nodos={arbol} expandidos={expandidos} onAlternar={alternarRuta} />
    </div>
  );
}