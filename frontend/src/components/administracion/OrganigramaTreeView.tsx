// Organigrama jerárquico Materialized Path (ENT-M05-05)
import { useMemo, useState } from "react";

import type { AreaOrganica } from "../../types/tablasMaestras";

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
              className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${
                expandido ? "border-[#d7e9f7] bg-[#f4f8fb]" : "border-[#d7e9f7] bg-white"
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
                  className="flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-[#4b6b85] hover:bg-[#d7e9f7]"
                >
                  {expandido ? "−" : "+"}
                </button>
              ) : (
                <span className="h-6 w-6" aria-hidden="true" />
              )}

              <span className="rounded bg-[#e8f4ff] px-2 py-0.5 font-mono text-xs font-semibold text-[#4b6b85]">
                {nodo.ruta}
              </span>
              <span className="rounded bg-[#e8f4ff] px-2 py-0.5 font-mono text-xs font-semibold text-[#006ec7]">
                {nodo.codigo}
              </span>
              <span className="text-sm font-semibold">{nodo.nombre}</span>
              <span className="text-xs text-[#4b6b85]">{nodo.detalle}</span>

              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                  nodo.estado === "Activo"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-[#d7e9f7] text-[#2f648c]"
                }`}
              >
                {nodo.estado}
              </span>
            </div>

            {tieneHijos && expandido && (
              <div className="ml-6 mt-2 border-l-2 border-[#d7e9f7] pl-4">
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

  return <Ramas nodos={arbol} expandidos={expandidos} onAlternar={alternarRuta} />;
}