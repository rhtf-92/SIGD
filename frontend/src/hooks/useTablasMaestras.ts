import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import type { AreaOrganica, RegistroMaestro, TipoTabla } from "../types/tablasMaestras";

export const TIPOS_TABLA: TipoTabla[] = ["Áreas", "Cargos", "Roles", "Tipos documentales"];
const CLAVES: Record<TipoTabla, string> = {
  "Áreas": "areas", "Cargos": "cargos", "Roles": "roles", "Tipos documentales": "tipos_documentales",
};

interface ItemApi { id: string; codigo: string; nombre: string; descripcion: string | null; vigente: boolean; extra?: Record<string, unknown> }
interface CatalogoApi { clave: string; items: ItemApi[] }
interface NodoAreaApi { id: string; codigo: string; nombre: string; path: string; vigente: boolean; children?: NodoAreaApi[] }

function aRegistros(catalogos: CatalogoApi[]): RegistroMaestro[] {
  return TIPOS_TABLA.flatMap((tipo) => {
    const catalogo = catalogos.find((item) => item.clave === CLAVES[tipo]);
    return (catalogo?.items ?? []).map((item) => ({
      id: item.id, tipo, codigo: item.codigo, nombre: item.nombre,
      detalle: item.descripcion ?? String(item.extra?.path ?? "Sin detalle"),
      estado: item.vigente ? "Activo" as const : "Inactivo" as const,
    }));
  });
}

function aAreas(nodos: NodoAreaApi[]): AreaOrganica[] {
  return nodos.flatMap((nodo) => [{
    id: nodo.id, codigo: nodo.codigo, nombre: nodo.nombre, ruta: nodo.path,
    detalle: "Unidad orgánica institucional", estado: nodo.vigente ? "Activo" as const : "Inactivo" as const,
  }, ...aAreas(nodo.children ?? [])]);
}

async function obtenerTablasMaestras() {
  const [maestras, organigrama] = await Promise.all([
    apiClient.get<{ catalogos: CatalogoApi[] }>("/api/v1/admin/tablas-maestras", { params: { solo_activos: false, recargar: true } }),
    apiClient.get<NodoAreaApi[]>("/api/v1/admin/organigrama"),
  ]);
  return {
    registros: aRegistros(maestras.data.catalogos),
    areasOrganicas: aAreas(organigrama.data),
  };
}

export function useTablasMaestras() {
  const [registros, setRegistros] = useState<RegistroMaestro[]>([]);
  const [areasOrganicas, setAreasOrganicas] = useState<AreaOrganica[]>([]);
  const [tipoActivo, setTipoActivo] = useState<TipoTabla>("Áreas");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const cargar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resultado = await obtenerTablasMaestras();
      setRegistros(resultado.registros);
      setAreasOrganicas(resultado.areasOrganicas);
    } catch (causa) {
      setError(causa instanceof Error ? causa : new Error("No se pudieron cargar las tablas maestras."));
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    let activo = true;
    void obtenerTablasMaestras()
      .then((resultado) => {
        if (!activo) return;
        setRegistros(resultado.registros);
        setAreasOrganicas(resultado.areasOrganicas);
      })
      .catch((causa) => {
        if (activo) setError(causa instanceof Error ? causa : new Error("No se pudieron cargar las tablas maestras."));
      })
      .finally(() => { if (activo) setIsLoading(false); });
    return () => { activo = false; };
  }, []);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return registros.filter((registro) => registro.tipo === tipoActivo && (!texto ||
      [registro.codigo, registro.nombre, registro.detalle].some((valor) => valor.toLowerCase().includes(texto))));
  }, [busqueda, registros, tipoActivo]);

  function cambiarTipo(tipo: TipoTabla) {
    setTipoActivo(tipo); setBusqueda(""); setMostrarFormulario(false); setMensaje("");
  }

  async function crearRegistro() {
    if (!codigo.trim() || !nombre.trim()) return;
    setIsSaving(true); setError(null); setMensaje("");
    try {
      await apiClient.post(`/api/v1/admin/tablas-maestras/${CLAVES[tipoActivo]}`, {
        codigo: codigo.trim(), nombre: nombre.trim(), descripcion: detalle.trim() || null,
      });
      await cargar();
      setCodigo(""); setNombre(""); setDetalle(""); setMostrarFormulario(false);
      setMensaje(`Registro ${codigo.trim().toUpperCase()} guardado correctamente.`);
    } catch (causa) {
      setError(causa instanceof Error ? causa : new Error("No se pudo guardar el registro."));
    } finally { setIsSaving(false); }
  }

  async function alternarEstado(id: string) {
    const registro = registros.find((item) => item.id === id);
    if (!registro) return;
    setIsSaving(true); setError(null); setMensaje("");
    try {
      const vigente = registro.estado !== "Activo";
      await apiClient.patch(`/api/v1/admin/tablas-maestras/${CLAVES[registro.tipo]}/${id}/vigencia`, { vigente });
      await cargar();
      setMensaje(`Registro ${registro.codigo} ${vigente ? "reactivado" : "inactivado (borrado lógico)"}.`);
    } catch (causa) {
      setError(causa instanceof Error ? causa : new Error("No se pudo cambiar el estado."));
    } finally { setIsSaving(false); }
  }

  return {
    tipos: TIPOS_TABLA, registros: filtrados, areasOrganicas, tipoActivo, cambiarTipo,
    busqueda, setBusqueda, mostrarFormulario, setMostrarFormulario,
    codigo, setCodigo, nombre, setNombre, detalle, setDetalle,
    mensaje, setMensaje, crearRegistro, alternarEstado,
    isLoading, isSaving, error, recargar: cargar,
  };
}
