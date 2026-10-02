import { useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import type { CcdTreeSelectorProps, FondoDocumental, NodoCcd, RutaCcdSeleccionada } from "../../types/ccdArchivistica";
import "./expedientes.css";

interface Entrada {
  clave: string;
  padre?: string;
  nodo: NodoCcd;
  ruta?: RutaCcdSeleccionada;
  hijos: Entrada[];
}

function crearEntradas(fondos: readonly FondoDocumental[]): Entrada[] {
  return fondos.map((fondo) => ({
    clave: JSON.stringify([fondo.id]), nodo: fondo,
    hijos: fondo.secciones.map((seccion) => ({
      clave: JSON.stringify([fondo.id, seccion.id]), padre: JSON.stringify([fondo.id]), nodo: seccion,
      hijos: seccion.series.map((serie) => ({
        clave: JSON.stringify([fondo.id, seccion.id, serie.id]), padre: JSON.stringify([fondo.id, seccion.id]),
        nodo: serie, ruta: { fondo, seccion, serie }, hijos: [],
      })),
    })),
  }));
}

function mismaRuta(a: RutaCcdSeleccionada, b: RutaCcdSeleccionada | null): boolean {
  return a.fondo.id === b?.fondo.id && a.seccion.id === b.seccion.id && a.serie.id === b.serie.id;
}

export default function CcdTreeSelector(props: CcdTreeSelectorProps) {
  const { recurso } = props;
  if (recurso.estado === "cargando") return <div className="m03 m03-panel" role="status">Cargando clasificación documental…</div>;
  if (recurso.estado === "error") return <div className="m03 m03-alert" role="alert">{recurso.mensaje}</div>;
  if (recurso.estado === "vacio" || recurso.datos.length === 0) return <div className="m03 m03-panel" role="status">No hay clasificación documental disponible.</div>;
  return <ArbolCcd {...props} fondos={recurso.datos} />;
}

function ArbolCcd({ fondos, seleccion, onSeleccionar, disabled = false, permitirLimpiar = true }: CcdTreeSelectorProps & { fondos: readonly FondoDocumental[] }) {
  const id = useId();
  const entradas = crearEntradas(fondos);
  const [expandidas, setExpandidas] = useState<ReadonlySet<string>>(() => new Set(seleccion ? [
    JSON.stringify([seleccion.fondo.id]), JSON.stringify([seleccion.fondo.id, seleccion.seccion.id]),
  ] : []));
  const [foco, setFoco] = useState<string | null>(null);
  const elementos = useRef(new Map<string, HTMLLIElement>());
  const busqueda = useRef({ texto: "", tiempo: 0 });
  const visibles: Entrada[] = [];
  const todas: Entrada[] = [];
  function recorrer(items: Entrada[], visible: boolean) {
    for (const item of items) {
      todas.push(item);
      if (visible) visibles.push(item);
      recorrer(item.hijos, visible && expandidas.has(item.clave));
    }
  }
  recorrer(entradas, true);
  const seleccionValida = todas.find((item) => item.ruta && mismaRuta(item.ruta, seleccion) && !item.ruta.serie.deshabilitada)?.ruta ?? null;
  const activa = visibles.find((item) => item.clave === foco) ?? visibles.find((item) => item.ruta && mismaRuta(item.ruta, seleccionValida)) ?? visibles[0];

  function enfocar(item: Entrada | undefined) {
    if (!item) return;
    setFoco(item.clave);
    elementos.current.get(item.clave)?.focus();
  }
  function expandir(clave: string, abierta: boolean) {
    setExpandidas((previas) => {
      const siguientes = new Set(previas);
      if (abierta) siguientes.add(clave); else siguientes.delete(clave);
      return siguientes;
    });
  }
  function activar(item: Entrada) {
    if (disabled) return;
    if (item.nodo.tipo !== "serie") {
      if (item.hijos.length > 0) expandir(item.clave, !expandidas.has(item.clave));
    } else if (!item.nodo.deshabilitada && item.nodo.id.trim() && item.nodo.codigo.trim() && item.ruta) {
      onSeleccionar(item.ruta);
    }
  }
  function teclado(event: KeyboardEvent<HTMLLIElement>, item: Entrada) {
    event.stopPropagation();
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const indice = visibles.indexOf(item);
    switch (event.key) {
      case "ArrowDown": enfocar(visibles[indice + 1]); break;
      case "ArrowUp": enfocar(visibles[indice - 1]); break;
      case "Home": enfocar(visibles[0]); break;
      case "End": enfocar(visibles.at(-1)); break;
      case "ArrowRight":
        if (item.hijos.length > 0) {
          if (expandidas.has(item.clave)) enfocar(item.hijos[0]); else expandir(item.clave, true);
        }
        break;
      case "ArrowLeft":
        if (item.hijos.length > 0 && expandidas.has(item.clave)) expandir(item.clave, false);
        else enfocar(visibles.find((entrada) => entrada.clave === item.padre));
        break;
      case "Enter": case " ": activar(item); break;
      default: {
        if (event.key.length !== 1) return;
        const tiempo = Date.now();
        const texto = (tiempo - busqueda.current.tiempo < 700 ? busqueda.current.texto : "") + event.key.toLocaleLowerCase("es");
        busqueda.current = { texto, tiempo };
        const orden = [...visibles.slice(indice + 1), ...visibles.slice(0, indice + 1)];
        enfocar(orden.find((entrada) => entrada.nodo.nombre.toLocaleLowerCase("es").startsWith(texto)));
      }
    }
    event.preventDefault();
  }
  function renderizar(items: Entrada[]): ReactNode {
    return items.map((item) => {
      const serie = item.nodo.tipo === "serie" ? item.nodo : null;
      const bloqueada = disabled || Boolean(serie && (serie.deshabilitada || !serie.id.trim() || !serie.codigo.trim()));
      const abierta = expandidas.has(item.clave);
      return <li key={item.clave} role="treeitem" aria-label={item.nodo.nombre}
        aria-expanded={item.hijos.length > 0 ? abierta : undefined}
        aria-selected={serie && !bloqueada ? Boolean(item.ruta && mismaRuta(item.ruta, seleccionValida)) : undefined}
        aria-disabled={bloqueada || undefined} tabIndex={!disabled && activa?.clave === item.clave ? 0 : -1}
        ref={(elemento) => { if (elemento) elementos.current.set(item.clave, elemento); else elementos.current.delete(item.clave); }}
        onFocus={(event) => { event.stopPropagation(); setFoco(item.clave); }}
        onClick={(event) => { event.stopPropagation(); if (!disabled) { enfocar(item); activar(item); } }}
        onKeyDown={(event) => teclado(event, item)}>
        <div className="m03-tree-label"><span aria-hidden="true">{serie ? "•" : abierta ? "▾" : "▸"}</span><span>{item.nodo.nombre}{serie ? ` (${serie.codigo})` : ""}</span></div>
        {abierta && item.hijos.length > 0 ? <ul role="group">{renderizar(item.hijos)}</ul> : null}
      </li>;
    });
  }
  return <section className="m03 m03-panel" aria-labelledby={`${id}-titulo`}>
    <h2 id={`${id}-titulo`} className="m03-heading">Cuadro de Clasificación Documental</h2>
    <p id={`${id}-ayuda`} className="m03-help">Seleccione una serie documental. Use las flechas para recorrer y expandir el árbol, y Enter para seleccionar.</p>
    <ul role="tree" className="m03-tree" aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-ayuda`} aria-disabled={disabled || undefined}>{renderizar(entradas)}</ul>
    <p className="m03-notice" role="status">{seleccionValida ? `${seleccionValida.fondo.nombre} / ${seleccionValida.seccion.nombre} / ${seleccionValida.serie.nombre}` : "Sin serie seleccionada."}</p>
    {permitirLimpiar && seleccion ? <button className="btn-secondary mt-3" type="button" disabled={disabled} onClick={() => onSeleccionar(null)}>Limpiar selección</button> : null}
  </section>;
}
