// Hook de Tablas Maestras y Catálogos Paramétricos (ENT-M05-05)
import { useMemo, useState } from "react";

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

const registrosIniciales: RegistroMaestro[] = [
  { id: 1, tipo: "Sedes", codigo: "SED-001", nombre: "Sede Principal", detalle: "Campus central de Pucallpa (Av. Centenario Km 3.5).", estado: "Activo" },
  { id: 2, tipo: "Áreas", codigo: "ARE-001", nombre: "Dirección General", detalle: "Nivel superior", estado: "Activo" },
  { id: 3, tipo: "Áreas", codigo: "ARE-002", nombre: "Secretaría Académica", detalle: "Depende de Dirección General", estado: "Activo" },
  { id: 4, tipo: "Áreas", codigo: "ARE-003", nombre: "Mesa de Partes", detalle: "Depende de Administración", estado: "Activo" },
  { id: 5, tipo: "Áreas", codigo: "ARE-004", nombre: "Administración", detalle: "Gestión financiera y logística", estado: "Activo" },
  { id: 6, tipo: "Áreas", codigo: "ARE-005", nombre: "Archivo Central", detalle: "Custodia histórica (AGN)", estado: "Activo" },
  { id: 7, tipo: "Áreas", codigo: "ARE-006", nombre: "Coordinación DSI", detalle: "Unidad académica formativa", estado: "Activo" },
  { id: 8, tipo: "Tipos documentales", codigo: "SOL", nombre: "Solicitud", detalle: "Escrito del administrado que inicia un trámite.", estado: "Activo" },
  { id: 9, tipo: "Tipos documentales", codigo: "OFI", nombre: "Oficio", detalle: "Comunicación externa con otras entidades del Estado.", estado: "Activo" },
  { id: 10, tipo: "Tipos documentales", codigo: "MEMO", nombre: "Memorando", detalle: "Comunicación interna de gestión.", estado: "Activo" },
  { id: 11, tipo: "Tipos documentales", codigo: "INF", nombre: "Informe Técnico / Legal", detalle: "Documento de sustento pericial o académico.", estado: "Activo" },
  { id: 12, tipo: "Tipos documentales", codigo: "RD", nombre: "Resolución Directoral", detalle: "Acto resolutivo de máxima jerarquía institucional.", estado: "Activo" },
  { id: 13, tipo: "Tipos documentales", codigo: "ACT", nombre: "Acta de Notas / Evaluación", detalle: "Registro oficial e inalterable de calificaciones.", estado: "Inactivo" },
];

export function useTablasMaestras() {
  const [registros, setRegistros] = useState(registrosIniciales);
  const [tipoActivo, setTipoActivo] = useState<TipoTabla>("Sedes");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [mensaje, setMensaje] = useState("");

  const areasOrganicas: AreaOrganica[] = ORGANIGRAMA_MATERIALIZED_PATH;

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

  // Invariante SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-02:
  // prohibido el borrado físico; solo inactivación (borrado lógico).
  function alternarEstado(id: number) {
    setMensaje("");
    setRegistros((actuales) =>
      actuales.map((registro) =>
        registro.id === id
          ? {
              ...registro,
              estado: (registro.estado === "Activo"
                ? "Inactivo"
                : "Activo") as EstadoRegistro,
            }
          : registro,
      ),
    );
    const registro = registros.find((item) => item.id === id);
    if (registro) {
      setMensaje(
        `Registro ${registro.codigo} ${
          registro.estado === "Activo" ? "desactivado (borrado lógico)" : "reactivado"
        }. Los históricos preservan su trazabilidad.`,
      );
    }
  }

  function crearRegistro() {
    if (!codigo.trim() || !nombre.trim()) return;

    setRegistros((actuales) => [
      ...actuales,
      {
        id: Math.max(0, ...actuales.map((registro) => registro.id)) + 1,
        tipo: tipoActivo,
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        detalle: detalle.trim() || "Sin detalle",
        estado: "Activo",
      },
    ]);

    setMensaje(
      `Registro ${codigo.trim().toUpperCase()} creado correctamente en ${tipoActivo}.`,
    );
    setCodigo("");
    setNombre("");
    setDetalle("");
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
  };
}