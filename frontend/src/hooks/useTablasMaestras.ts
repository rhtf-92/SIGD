// Hook de Tablas Maestras y Catálogos Paramétricos (ENT-M05-05)
// Conectado a la API real del backend (sigd_org.tabla_maestra).
// Cada creación/inactivación se persiste en PostgreSQL y se refleja inmediatamente.
import { useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import type {
  AreaOrganica,
  EstadoRegistro,
  RegistroMaestro,
  TipoTabla,
} from "../types/tablasMaestras";

export const TIPOS_TABLA: TipoTabla[] = [
  "Sedes",
  "Áreas",
  "Tipos documentales",
];

export const ORGANIGRAMA_MATERIALIZED_PATH = [
  { id: 1, codigo: "ARE-001", nombre: "Dirección General", ruta: "01", detalle: "Órgano de máxima autoridad resolutiva institucional.", estado: "Activo" },
  { id: 2, codigo: "ARE-002", nombre: "Secretaría Académica", ruta: "01.01", detalle: "Órgano normativo y de registro académico.", estado: "Activo" },
  { id: 3, codigo: "ARE-003", nombre: "Mesa de Partes", ruta: "01.02", detalle: "Órgano de recepción, foliación inicial y admisibilidad.", estado: "Activo" },
  { id: 4, codigo: "ARE-004", nombre: "Administración", ruta: "01.03", detalle: "Gestión financiera y logística patrimonial.", estado: "Activo" },
  { id: 5, codigo: "ARE-005", nombre: "Archivo Central", ruta: "01.03.01", detalle: "Custodia pasiva conforme a directivas del AGN.", estado: "Activo" },
  { id: 6, codigo: "ARE-006", nombre: "Coordinación DSI", ruta: "01.03.02", detalle: "Unidad académica formativa de sistemas.", estado: "Activo" },
] satisfies AreaOrganica[];

export function useTablasMaestras() {
  const [registros, setRegistros] = useState<RegistroMaestro[]>([]);
  const [tipoActivo, setTipoActivo] = useState<TipoTabla>("Sedes");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const [areasOrganicas, setAreasOrganicas] = useState<AreaOrganica[]>(ORGANIGRAMA_MATERIALIZED_PATH);

  /* ------------------------------------------------------------------ */
  /* Carga inicial de áreas orgánicas (órganigrama)                     */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    let montado = true;
    apiClient
      .get<
        Array<{
          id?: string | number;
          area_id?: string;
          codigo?: string;
          sigla?: string;
          nombre: string;
          ruta_jerarquica?: string;
          path?: string;
        }>
      >("/api/v1/admin/organigrama")
      .then((res) => {
        if (!montado || !Array.isArray(res.data) || res.data.length === 0) return;
        const mapped: AreaOrganica[] = res.data.map((item, index) => ({
          id: typeof item.id === "number" ? item.id : index + 1,
          codigo: item.codigo ?? item.sigla ?? `ARE-${String(index + 1).padStart(3, "0")}`,
          nombre: item.nombre,
          ruta: item.ruta_jerarquica ?? item.path ?? `01.${String(index + 1).padStart(2, "0")}`,
          detalle: `Unidad orgánica institucional (${item.sigla ?? item.nombre})`,
          estado: "Activo" as const,
        }));
        setAreasOrganicas(mapped);
      })
      .catch(() => {
        // Fallback al catálogo predeterminado
      });

    return () => {
      montado = false;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Cargar registros reales de un tipo desde el backend                */
  /* ------------------------------------------------------------------ */

  const cargarRegistros = async (tipo: TipoTabla) => {
    setCargando(true);
    try {
      const { data } = await apiClient.get<RegistroMaestro[]>(
        `/api/v1/admin/tablas-maestras/${encodeURIComponent(tipo)}/registros`,
      );
      setRegistros(
        data.map((r) => ({
          id: r.id,
          tipo: r.tipo as TipoTabla,
          codigo: r.codigo,
          nombre: r.nombre,
          detalle: r.detalle ?? "",
          estado: r.estado as EstadoRegistro,
        })),
      );
    } catch (error) {
      console.error("[useTablasMaestras] Error cargando registros:", error);
      setMensaje("No se pudieron cargar los registros de la base de datos.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarRegistros(tipoActivo);
  }, [tipoActivo]);

  /* ------------------------------------------------------------------ */
  /* Filtros                                                            */
  /* ------------------------------------------------------------------ */

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return registros.filter(
      (registro) =>
        registro.tipo === tipoActivo &&
        (texto === "" ||
          registro.codigo.toLowerCase().includes(texto) ||
          registro.nombre.toLowerCase().includes(texto) ||
          registro.detalle.toLowerCase().includes(texto)),
    );
  }, [busqueda, registros, tipoActivo]);

  function cambiarTipo(tipo: TipoTabla) {
    setTipoActivo(tipo);
    setBusqueda("");
    setMostrarFormulario(false);
    setMensaje("");
  }

  /* ------------------------------------------------------------------ */
  /* Alternar estado (Activo <-> Inactivo) — borrado lógico real         */
  /* ------------------------------------------------------------------ */

  async function alternarEstado(id: string) {
    setMensaje("");
    try {
      const { data } = await apiClient.patch<RegistroMaistroActualizado>(
        `/api/v1/admin/tablas-maestras/${id}/estado`,
      );

      setRegistros((actuales) =>
        actuales.map((registro) =>
          registro.id === data.id
            ? {
                ...registro,
                estado: data.estado as EstadoRegistro,
              }
            : registro,
        ),
      );

      const registro = registros.find((item) => item.id === id);
      if (registro) {
        setMensaje(
          `Registro ${registro.codigo} ${
            data.estado === "Activo" ? "activado" : "inactivado (borrado lógico)"
          }. Los históricos preservan su trazabilidad.`,
        );
      }
    } catch (error) {
      console.error("[useTablasMaestras] Error alternando estado:", error);
      setMensaje("No se pudo cambiar el estado del registro.");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Crear registro real en el backend                                  */
  /* ------------------------------------------------------------------ */

  async function crearRegistro() {
    if (!codigo.trim() || !nombre.trim()) return;

    setCargando(true);
    try {
      const { data } = await apiClient.post<RegistroMaestro>("/api/v1/admin/tablas-maestras", {
        tipo: tipoActivo,
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        detalle: detalle.trim() || null,
      });

      setRegistros((actuales) => [
        ...actuales,
        {
          id: data.id,
          tipo: data.tipo as TipoTabla,
          codigo: data.codigo,
          nombre: data.nombre,
          detalle: data.detalle ?? "",
          estado: data.estado as EstadoRegistro,
        },
      ]);

      setMensaje(
        `Registro ${codigo.trim().toUpperCase()} creado correctamente en ${tipoActivo}.`,
      );
      setCodigo("");
      setNombre("");
      setDetalle("");
      setMostrarFormulario(false);
    } catch (error: any) {
      console.error("[useTablasMaestras] Error creando registro:", error);
      setMensaje(
        error?.response?.data?.detail ||
        "No se pudo crear el registro. Verifique que el código no esté duplicado.",
      );
    } finally {
      setCargando(false);
    }
  }

  return {
    tipos: TIPOS_TABLA,
    registros: filtrados,
    areasOrganicas,
    tipoActivo,
    cambiarTipo,
    busqueda,
    setBusqueda,
    mostrarFormulario,
    setMostrarFormulario,
    codigo,
    setCodigo,
    nombre,
    setNombre,
    detalle,
    setDetalle,
    mensaje,
    setMensaje,
    crearRegistro,
    alternarEstado,
    cargando,
  };
}

interface RegistroMaistroActualizado {
  id: string;
  estado: string;
}
