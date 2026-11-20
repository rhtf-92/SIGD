import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import type { ApiHttpError } from "../types/api";
import type { AreaOrganica, RegistroMaestro, TipoTabla } from "../types/tablasMaestras";

export const TIPOS_TABLA: TipoTabla[] = ["Sedes", "Áreas", "Cargos", "Roles", "Tipos documentales"];
const CLAVES: Partial<Record<TipoTabla, string>> = {
  "Áreas": "areas", "Cargos": "cargos", "Roles": "roles", "Tipos documentales": "tipos_documentales",
};

interface ItemApi { id: string; codigo: string; nombre: string; descripcion: string | null; vigente: boolean; extra?: Record<string, unknown> }
interface CatalogoApi { clave: string; items: ItemApi[] }
interface SedeApi { id: string; codigo: string; nombre: string; direccion?: string | null; vigente?: boolean }
interface NodoAreaApi { id: string; codigo: string; nombre: string; padreId?: string | null; path: string; vigente: boolean; children?: NodoAreaApi[] }

function mensajeError(causa: unknown, porDefecto: string): Error {
  const http = causa as ApiHttpError | undefined;
  const detalle = http?.problemDetails?.detail || (causa instanceof Error ? causa.message : "");
  return new Error(detalle || porDefecto);
}

function aRegistros(catalogos: CatalogoApi[], sedes: SedeApi[]): RegistroMaestro[] {
  const registrosSedes: RegistroMaestro[] = sedes.map((sede) => ({
    id: sede.id,
    tipo: "Sedes",
    codigo: sede.codigo,
    nombre: sede.nombre,
    detalle: sede.direccion ?? "Sin dirección",
    estado: sede.vigente === false ? "Inactivo" : "Activo",
  }));
  const registrosCatalogos = (["Áreas", "Cargos", "Roles", "Tipos documentales"] as const).flatMap((tipo) => {
    const catalogo = catalogos.find((item) => item.clave === CLAVES[tipo]);
    return (catalogo?.items ?? []).map((item) => {
      let detalle = item.descripcion ?? String(item.extra?.path ?? "Sin detalle");
      if (tipo === "Tipos documentales" && item.extra) {
        const ext = item.extra.extension ? String(item.extra.extension).toUpperCase() : "PDF";
        const maxMb = item.extra.tamanoMaximoMb ? `${String(item.extra.tamanoMaximoMb)} MB` : "";
        const firma = item.extra.exigeFirma ? "Exige firma" : "Sin firma obligatoria";
        detalle = [ext, maxMb, firma].filter(Boolean).join(" · ");
      }
      return {
        id: item.id,
        tipo,
        codigo: item.codigo,
        nombre: item.nombre,
        detalle,
        padreId: typeof item.extra?.padreId === "string" ? item.extra.padreId : null,
        estado: item.vigente ? "Activo" as const : "Inactivo" as const,
      };
    });
  });
  return [...registrosSedes, ...registrosCatalogos];
}

function aAreas(nodos: NodoAreaApi[]): AreaOrganica[] {
  return nodos.flatMap((nodo) => [{
    id: nodo.id,
    codigo: nodo.codigo,
    nombre: nodo.nombre,
    ruta: nodo.path,
    padreId: nodo.padreId ?? null,
    detalle: "Unidad orgánica institucional",
    estado: nodo.vigente ? "Activo" as const : "Inactivo" as const,
  }, ...aAreas(nodo.children ?? [])]);
}

async function obtenerTablasMaestras() {
  const [maestras, organigrama, sedesRes] = await Promise.all([
    apiClient.get<{ catalogos: CatalogoApi[] }>("/api/v1/admin/tablas-maestras", { params: { solo_activos: false, recargar: true } }),
    apiClient.get<NodoAreaApi[]>("/api/v1/admin/organigrama"),
    apiClient.get<{ sedes: SedeApi[] }>("/api/v1/admin/maestras/sede", { params: { solo_activos: false } }).catch(() => ({ data: { sedes: [] as SedeApi[] } })),
  ]);
  return {
    registros: aRegistros(maestras.data.catalogos ?? [], sedesRes.data.sedes ?? []),
    areasOrganicas: aAreas(organigrama.data ?? []),
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
  const [padreId, setPadreId] = useState("");
  const [registroEditando, setRegistroEditando] = useState<string | null>(null);
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
      setError(mensajeError(causa, "No se pudieron cargar las tablas maestras."));
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
        if (activo) setError(mensajeError(causa, "No se pudieron cargar las tablas maestras."));
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
    setTipoActivo(tipo); setBusqueda(""); setMostrarFormulario(false); setRegistroEditando(null); setPadreId(""); setMensaje(""); setError(null);
  }

  function editarRegistro(id: string) {
    const registro = registros.find((item) => item.id === id);
    if (!registro) return;
    setRegistroEditando(id);
    setCodigo(registro.codigo);
    setNombre(registro.nombre);
    setDetalle(registro.detalle === "Sin detalle" || registro.detalle === "Sin dirección" ? "" : registro.detalle);
    setPadreId(registro.padreId ?? "");
    setMostrarFormulario(true);
    setMensaje("");
    setError(null);
  }

  function cancelarFormulario() {
    setMostrarFormulario(false); setRegistroEditando(null);
    setCodigo(""); setNombre(""); setDetalle(""); setPadreId("");
  }

  async function crearRegistro() {
    if (!codigo.trim() || !nombre.trim()) {
      setError(new Error("Ingrese código y nombre para guardar el registro."));
      return;
    }
    setIsSaving(true); setError(null); setMensaje("");
    try {
      if (tipoActivo === "Sedes") {
        const payload = { codigo: codigo.trim(), nombre: nombre.trim(), direccion: detalle.trim() || null };
        if (registroEditando) {
          await apiClient.put(`/api/v1/admin/maestras/sede/${registroEditando}`, payload);
        } else {
          await apiClient.post("/api/v1/admin/maestras/sede", payload);
        }
      } else {
        const clave = CLAVES[tipoActivo];
        const payload = {
          codigo: codigo.trim(),
          nombre: nombre.trim(),
          descripcion: tipoActivo === "Áreas" ? null : (detalle.trim() || null),
          ...(tipoActivo === "Áreas" ? { padreId: padreId || null } : {}),
        };
        if (registroEditando) {
          await apiClient.put(`/api/v1/admin/tablas-maestras/${clave}/${registroEditando}`, payload);
        } else {
          await apiClient.post(`/api/v1/admin/tablas-maestras/${clave}`, payload);
        }
      }
      const codigoGuardado = codigo.trim().toUpperCase();
      await cargar();
      cancelarFormulario();
      setMensaje(`Registro ${codigoGuardado} ${registroEditando ? "actualizado" : "guardado"} correctamente.`);
    } catch (causa) {
      setError(mensajeError(causa, "No se pudo guardar el registro."));
    } finally { setIsSaving(false); }
  }

  async function alternarEstado(id: string) {
    const registro = registros.find((item) => item.id === id);
    if (!registro) return;
    setIsSaving(true); setError(null); setMensaje("");
    try {
      const vigente = registro.estado !== "Activo";
      if (registro.tipo === "Sedes") {
        await apiClient.patch(`/api/v1/admin/maestras/sede/${id}/vigencia`, { vigente });
      } else {
        await apiClient.patch(`/api/v1/admin/tablas-maestras/${CLAVES[registro.tipo]}/${id}/vigencia`, { vigente });
      }
      await cargar();
      setMensaje(`Registro ${registro.codigo} ${vigente ? "reactivado" : "inactivado (borrado lógico)"}.`);
    } catch (causa) {
      setError(mensajeError(causa, "No se pudo cambiar el estado."));
    } finally { setIsSaving(false); }
  }

  return {
    tipos: TIPOS_TABLA, registros: filtrados, areasOrganicas, tipoActivo, cambiarTipo,
    busqueda, setBusqueda, mostrarFormulario, setMostrarFormulario,
    codigo, setCodigo, nombre, setNombre, detalle, setDetalle, padreId, setPadreId,
    mensaje, setMensaje, crearRegistro, alternarEstado, editarRegistro, cancelarFormulario, registroEditando,
    isLoading, isSaving, error, recargar: cargar,
  };
}
