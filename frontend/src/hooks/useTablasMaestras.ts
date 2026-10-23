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

export const ORGANIGRAMA_MATERIALIZED_PATH: AreaOrganica[] = [
  { id: 1, codigo: "ARE-001", nombre: "Dirección General", ruta: "01", detalle: "Órgano de máxima autoridad resolutiva institucional.", estado: "Activo" },
  { id: 2, codigo: "ARE-002", nombre: "Secretaría Académica", ruta: "01.01", detalle: "Órgano normativo y de registro académico.", estado: "Activo" },
  { id: 3, codigo: "ARE-003", nombre: "Mesa de Partes", ruta: "01.02", detalle: "Órgano de recepción, foliación inicial y admisibilidad.", estado: "Activo" },
  { id: 4, codigo: "ARE-004", nombre: "Administración", ruta: "01.03", detalle: "Gestión financiera y logística patrimonial.", estado: "Activo" },
  { id: 5, codigo: "ARE-005", nombre: "Archivo Central", ruta: "01.03.01", detalle: "Custodia pasiva conforme a directivas del AGN.", estado: "Activo" },
  { id: 6, codigo: "ARE-006", nombre: "Coordinación DSI", ruta: "01.03.02", detalle: "Unidad académica formativa de sistemas.", estado: "Activo" },
];

const registrosFallback: RegistroMaestro[] = [
  { id: 1, tipo: "Sedes", codigo: "SED-001", nombre: "Sede Principal", detalle: "Campus central de Pucallpa (Av. Centenario Km 3.5).", estado: "Activo", disponible: true },
  { id: 2, tipo: "Áreas", codigo: "ARE-001", nombre: "Dirección General", detalle: "Nivel superior", estado: "Activo", disponible: true },
  { id: 3, tipo: "Áreas", codigo: "ARE-002", nombre: "Secretaría Académica", detalle: "Depende de Dirección General", estado: "Activo", disponible: true },
  { id: 4, tipo: "Áreas", codigo: "ARE-003", nombre: "Mesa de Partes", detalle: "Depende de Administración", estado: "Activo", disponible: true },
  { id: 5, tipo: "Áreas", codigo: "ARE-004", nombre: "Administración", detalle: "Gestión financiera y logística", estado: "Activo", disponible: true },
  { id: 6, tipo: "Áreas", codigo: "ARE-005", nombre: "Archivo Central", detalle: "Custodia histórica (AGN)", estado: "Activo", disponible: true },
  { id: 7, tipo: "Áreas", codigo: "ARE-006", nombre: "Coordinación DSI", detalle: "Unidad académica formativa", estado: "Activo", disponible: true },
  { id: 8, tipo: "Tipos documentales", codigo: "SOL", nombre: "Solicitud", detalle: "Escrito del administrado que inicia un trámite.", estado: "Activo", disponible: true },
  { id: 9, tipo: "Tipos documentales", codigo: "OFI", nombre: "Oficio", detalle: "Comunicación externa con otras entidades del Estado.", estado: "Activo", disponible: true },
  { id: 10, tipo: "Tipos documentales", codigo: "MEMO", nombre: "Memorando", detalle: "Comunicación interna de gestión.", estado: "Activo", disponible: true },
  { id: 11, tipo: "Tipos documentales", codigo: "INF", nombre: "Informe Técnico / Legal", detalle: "Documento de sustento pericial o académico.", estado: "Activo", disponible: true },
  { id: 12, tipo: "Tipos documentales", codigo: "RD", nombre: "Resolución Directoral", detalle: "Acto resolutivo de máxima jerarquía institucional.", estado: "Activo", disponible: true },
  { id: 13, tipo: "Tipos documentales", codigo: "ACT", nombre: "Acta de Notas / Evaluación", detalle: "Registro oficial e inalterable de calificaciones.", estado: "Inactivo", disponible: true },
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

export function useTablasMaestras() {
  const [registros, setRegistros] = useState<RegistroMaestro[]>(registrosFallback);
  const [tipoActivo, setTipoActivo] = useState<TipoTabla>("Sedes");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [areasOrganicas, setAreasOrganicas] = useState<AreaOrganica[]>(ORGANIGRAMA_MATERIALIZED_PATH);

  useEffect(() => {
    let montado = true;
    setIsLoading(true);

    // Consulta de catálogos paramétricos oficiales
    apiClient
      .get<RespuestaTablasMaestras>("/api/v1/admin/tablas-maestras", {
        params: { solo_activos: "false" },
      })
      .then((res) => {
        if (!montado || !res.data?.catalogos) return;
        const mapeados: RegistroMaestro[] = [];
        let idCounter = 1;

        for (const cat of res.data.catalogos) {
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

          for (const item of cat.items) {
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

        if (mapeados.length > 0) {
          setRegistros(mapeados);
        }
      })
      .catch(() => {
        // Fallback resiliente
      })
      .finally(() => {
        if (montado) setIsLoading(false);
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

  // F-05: El backend expone Tablas Maestras exclusivamente como catálogo de solo lectura.
  // Se eliminan mutaciones ficticias en memoria.
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
    isLoading,
  };
}
