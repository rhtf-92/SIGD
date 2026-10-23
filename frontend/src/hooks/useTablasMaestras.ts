// Hook de Tablas Maestras y Catálogos Paramétricos (ENT-M05-05)
// Conectado al endpoint canónico GET /api/v1/admin/tablas-maestras
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

interface CatalogoBackend {
  clave: string;
  esquema: string;
  tabla: string;
  descripcion: string;
  disponible: boolean;
  total: number;
  items: Array<{
    codigo: string | null;
    nombre: string;
    descripcion: string | null;
    extra?: Record<string, unknown>;
  }>;
}

interface RespuestaTablasMaestras {
  catalogos: CatalogoBackend[];
}

export type EstadoCargaMaestras = "loading" | "success" | "empty" | "error";

export function useTablasMaestras() {
  const [registros, setRegistros] = useState<RegistroMaestro[]>([]);
  const [areasOrganicas, setAreasOrganicas] = useState<AreaOrganica[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCargaMaestras>("loading");
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [tipoActivo, setTipoActivo] = useState<TipoTabla>("Sedes");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let montado = true;
    setEstadoCarga("loading");
    setErrorCarga(null);

    // Consulta de catálogos paramétricos oficiales
    apiClient
      .get<RespuestaTablasMaestras>("/api/v1/admin/tablas-maestras", {
        params: { solo_activos: "false" },
      })
      .then((res) => {
        if (!montado) return;
        const catalogos = res.data?.catalogos;
        if (!catalogos || !Array.isArray(catalogos)) {
          setRegistros([]);
          setEstadoCarga("empty");
          return;
        }

        const mapeados: RegistroMaestro[] = [];
        let idCounter = 1;

        for (const cat of catalogos) {
          let tipo: TipoTabla | null = null;
          const clave = cat.clave.toLowerCase();
          const tabla = cat.tabla.toLowerCase();

          if (clave.includes("sede") || tabla.includes("sede")) {
            tipo = "Sedes";
          } else if (clave.includes("organica") || tabla.includes("area")) {
            tipo = "Áreas";
          } else if (clave.includes("documento") || tabla.includes("documento")) {
            tipo = "Tipos documentales";
          }

          if (!tipo) continue;

          for (const item of cat.items ?? []) {
            const estado: EstadoRegistro =
              item.extra?.activo === false || item.extra?.vigente === false ? "Inactivo" : "Activo";

            mapeados.push({
              id: idCounter++,
              tipo,
              codigo: item.codigo ?? "—",
              nombre: item.nombre,
              detalle: item.descripcion ?? (cat.disponible ? "Registro oficial" : "Catálogo no disponible"),
              estado,
              disponible: cat.disponible,
            });
          }
        }

        setRegistros(mapeados);
        setEstadoCarga(mapeados.length > 0 ? "success" : "empty");
      })
      .catch((err) => {
        if (!montado) return;
        setRegistros([]);
        setEstadoCarga("error");
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "No fue posible consultar el catálogo oficial de tablas maestras. Verifique su conexión y permisos.";
        setErrorCarga(msg);
      });

    // Consulta de organigrama
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
        if (!montado || !Array.isArray(res.data) || res.data.length === 0) {
          if (montado) setAreasOrganicas([]);
          return;
        }
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
        if (montado) setAreasOrganicas([]);
      });

    return () => {
      montado = false;
    };
  }, []);

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

  function alternarEstado(_id: number | string) {
    setMensaje("El catálogo de tablas maestras es de solo lectura institucional. Las modificaciones se gestionan mediante DDL y control de cambios.");
  }

  function crearRegistro() {
    setMensaje("El catálogo de tablas maestras es de solo lectura institucional. Las modificaciones se gestionan mediante DDL y control de cambios.");
    setMostrarFormulario(false);
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
    isReadOnly: true,
    isLoading: estadoCarga === "loading",
    estadoCarga,
    errorCarga,
  };
}
