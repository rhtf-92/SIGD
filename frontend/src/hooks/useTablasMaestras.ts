// Hook de Tablas Maestras y Catálogos Paramétricos (ENT-M05-05)
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

export interface RegistroMaestroExtendido extends RegistroMaestro {
  uuid?: string;
  extension?: string;
  mimeType?: string;
  tamanoMaximoMb?: number;
  exigeFirma?: boolean;
}

export function useTablasMaestras() {
  const [registros, setRegistros] = useState<RegistroMaestroExtendido[]>(registrosIniciales);
  const [tipoActivo, setTipoActivo] = useState<TipoTabla>("Sedes");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [areasOrganicas, setAreasOrganicas] = useState<AreaOrganica[]>(ORGANIGRAMA_MATERIALIZED_PATH);

  // Carga inicial y conmutación de tipos documentales y organigrama desde la API REST
  useEffect(() => {
    let montado = true;

    // 1. Cargar organigrama institucional
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
        // Fallback defensivo a organigrama predeterminado
      });

    // 2. Cargar catálogo de tipos documentales desde el backend real
    apiClient
      .get<
        Array<{
          tipoDocumentalId?: string;
          tipo_documental_id?: string;
          id?: string | number;
          codigo: string;
          nombre: string;
          descripcion?: string;
          extension?: string;
          mimeType?: string;
          mime_type?: string;
          tamanoMaximoMb?: number;
          tamano_maximo_mb?: number;
          exigeFirma?: boolean;
          exige_firma?: boolean;
          vigente?: boolean;
        }>
      >("/api/v1/admin/maestras/tipo-documento")
      .then((res) => {
        if (!montado || !Array.isArray(res.data) || res.data.length === 0) return;
        const tiposDesdeApi: RegistroMaestroExtendido[] = res.data.map((item, index) => {
          const uuid = item.tipoDocumentalId || item.tipo_documental_id || (typeof item.id === "string" ? item.id : undefined);
          const mime = item.mimeType || item.mime_type || "application/pdf";
          const maxMb = item.tamanoMaximoMb || item.tamano_maximo_mb || 25;
          const firma = item.exigeFirma ?? item.exige_firma ?? false;
          return {
            id: 100 + index,
            uuid,
            tipo: "Tipos documentales",
            codigo: item.codigo,
            nombre: item.nombre,
            detalle: item.descripcion || `${mime} (${maxMb} MB)${firma ? " · Exige firma" : ""}`,
            estado: (item.vigente !== false ? "Activo" : "Inactivo") as EstadoRegistro,
            extension: item.extension || "pdf",
            mimeType: mime,
            tamanoMaximoMb: maxMb,
            exigeFirma: firma,
          };
        });

        setRegistros((actuales) => {
          // Mantener Sedes y Áreas, y reemplazar los Tipos documentales con los reales de la BD
          const noTipos = actuales.filter((r) => r.tipo !== "Tipos documentales");
          return [...noTipos, ...tiposDesdeApi];
        });
      })
      .catch(() => {
        // Fallback defensivo a catálogo inicial si el backend está desconectado
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

  // Invariante SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-02:
  // prohibido el borrado físico; solo inactivación (borrado lógico).
  async function alternarEstado(id: number) {
    setMensaje("");
    const registro = registros.find((item) => item.id === id);
    if (!registro) return;

    const nuevoEstado: EstadoRegistro = registro.estado === "Activo" ? "Inactivo" : "Activo";
    const nuevoVigente = nuevoEstado === "Activo";

    // Si es un tipo documental con UUID persistido o código, conmutar en el backend
    if (registro.tipo === "Tipos documentales") {
      const targetId = registro.uuid || registro.codigo;
      try {
        await apiClient.patch(`/api/v1/admin/tipos-documento/${encodeURIComponent(targetId)}/estado`, {
          vigente: nuevoVigente,
        });
      } catch (err) {
        console.warn(`[useTablasMaestras] Aviso al conmutar estado de ${registro.codigo} en backend:`, err);
      }
    }

    setRegistros((actuales) =>
      actuales.map((item) =>
        item.id === id
          ? {
              ...item,
              estado: nuevoEstado,
            }
          : item,
      ),
    );

    setMensaje(
      `Registro ${registro.codigo} ${
        nuevoEstado === "Inactivo" ? "desactivado (borrado lógico)" : "reactivado"
      }. Los históricos preservan su trazabilidad.`,
    );
  }

  async function crearRegistro() {
    if (!codigo.trim() || !nombre.trim()) return;

    const codNormalizado = codigo.trim().toUpperCase();
    const nomNormalizado = nombre.trim();
    const detNormalizado = detalle.trim() || "Sin detalle";

    let nuevoUuid: string | undefined = undefined;

    // Si el tipo activo es Tipo Documental, persistir formalmente en backend
    if (tipoActivo === "Tipos documentales") {
      try {
        const payload = {
          codigo: codNormalizado,
          nombre: nomNormalizado,
          extension: "pdf",
          mimeType: "application/pdf",
          tamanoMaximoMb: 25,
          exigeFirma: false,
          vigente: true,
        };
        const res = await apiClient.post<{ tipoDocumentalId?: string; id?: string }>("/api/v1/admin/tipos-documento", payload);
        nuevoUuid = res.data?.tipoDocumentalId || res.data?.id;
      } catch (err) {
        console.warn(`[useTablasMaestras] Aviso al registrar tipo documental ${codNormalizado} en backend:`, err);
      }
    }

    const nuevoId = Math.max(0, ...registros.map((registro) => registro.id)) + 1;
    const nuevoRegistro: RegistroMaestroExtendido = {
      id: nuevoId,
      uuid: nuevoUuid,
      tipo: tipoActivo,
      codigo: codNormalizado,
      nombre: nomNormalizado,
      detalle: detNormalizado,
      estado: "Activo",
    };

    setRegistros((actuales) => [...actuales, nuevoRegistro]);

    setMensaje(
      `Registro ${codNormalizado} creado correctamente en ${tipoActivo}.`,
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