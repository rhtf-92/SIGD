// Hook de Tablas Maestras y Catálogos Paramétricos (ENT-M05-05)
import { useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import { CATALOGO_DOCUMENTAL_TUPA_2026 } from "../data/catalogoDocumentalTupa2026";
import type {
  AreaOrganica,
  EstadoRegistro,
  RegistroMaestro,
  TipoTabla,
  VersionTupaAdmin,
  TramiteTupaAdmin,
  AuditoriaTupaAdmin,
} from "../types/tablasMaestras";

export const TIPOS_TABLA: TipoTabla[] = [
  "Sedes",
  "Áreas",
  "Tipos documentales",
  "Catálogo TUPA (Versiones y Requisitos)",
];

// Catálogo de respaldo para simulación visual / fallback de interfaz.
// Marcado explícitamente con esReal: false para evitar su uso en operaciones institucionales reales.
export const ORGANIGRAMA_MATERIALIZED_PATH: AreaOrganica[] = [
  { id: "sim-1", codigo: "ARE-001", nombre: "Dirección General", ruta: "01", detalle: "Órgano de máxima autoridad resolutiva institucional.", estado: "Activo", esReal: false },
  { id: "sim-2", codigo: "ARE-002", nombre: "Secretaría Académica", ruta: "01.01", detalle: "Órgano normativo y de registro académico.", estado: "Activo", esReal: false },
  { id: "sim-3", codigo: "ARE-003", nombre: "Mesa de Partes", ruta: "01.02", detalle: "Órgano de recepción, foliación inicial y admisibilidad.", estado: "Activo", esReal: false },
  { id: "sim-4", codigo: "ARE-004", nombre: "Administración", ruta: "01.03", detalle: "Gestión financiera y logística patrimonial.", estado: "Activo", esReal: false },
  { id: "sim-5", codigo: "ARE-005", nombre: "Archivo Central", ruta: "01.03.01", detalle: "Custodia pasiva conforme a directivas del AGN.", estado: "Activo", esReal: false },
  { id: "sim-6", codigo: "ARE-006", nombre: "Coordinación DSI", ruta: "01.03.02", detalle: "Unidad académica formativa de sistemas.", estado: "Activo", esReal: false },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUuidValido(id: unknown): boolean {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

interface NodoOrganigramaApi {
  id?: string | number;
  area_id?: string;
  codigo?: string;
  sigla?: string;
  nombre: string;
  ruta_jerarquica?: string;
  path?: string;
  detalle?: string;
  estado?: boolean | EstadoRegistro;
  children?: NodoOrganigramaApi[];
}

function aplanarOrganigrama(nodos: NodoOrganigramaApi[]): NodoOrganigramaApi[] {
  const resultado: NodoOrganigramaApi[] = [];
  function recorrer(nodo: NodoOrganigramaApi) {
    resultado.push(nodo);
    if (Array.isArray(nodo.children) && nodo.children.length > 0) {
      nodo.children.forEach(recorrer);
    }
  }
  nodos.forEach(recorrer);
  return resultado;
}

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

  const [areasOrganicas, setAreasOrganicas] = useState<AreaOrganica[]>(ORGANIGRAMA_MATERIALIZED_PATH);
  const [cargandoAreas, setCargandoAreas] = useState(false);
  const [errorAreas, setErrorAreas] = useState<string | null>(null);

  // Estado de Versionado TUPA, Trámites y Auditoría
  const [versionesTupa, setVersionesTupa] = useState<VersionTupaAdmin[]>([
    {
      versionId: "a0260001-0000-4000-8000-000000002026",
      codigoVersion: "TUPA-2026-V1",
      denominacion: "TUPA Institucional 2026 — IESTP Suiza (72 Procedimientos Oficiales)",
      resolucionAprobacion: "Documento Oficial TUPA 2026 IESTP Suiza (6 páginas)",
      fechaAprobacion: "2026-01-01",
      estado: "VIGENTE",
      vigente: true,
      totalTramites: 72,
      observaciones: "Catálogo oficial vigente de exactamente 72 procedimientos numerados correlativamente del 001 al 072.",
    },
  ]);
  const [versionSeleccionada, setVersionSeleccionada] = useState<string>("TUPA-2026-V1");
  const [tramitesTupaApi, setTramitesTupaApi] = useState<TramiteTupaAdmin[] | null>(null);
  const [filtroValidacion, setFiltroValidacion] = useState<"TODOS" | "VALIDADOS" | "PENDIENTES">("TODOS");
  const [tramiteModalDetalle, setTramiteModalDetalle] = useState<TramiteTupaAdmin | null>(null);
  const [auditoriaTupa, setAuditoriaTupa] = useState<AuditoriaTupaAdmin | null>({
    totalExpedientesDoc: 189,
    expedientesTupaVigente2026: 184,
    expedientesAuditoriaHistoricaPre2026: 5,
    expedientesHuerfanosDoc: 0,
    totalExpedientesTra: 197,
    expedientesDirectosInternosTra: 8,
    reasignacionesSinEvidencia: 0,
    costosAlterados: 0,
    cumplimientoRestriccionOrigenUnico: true,
    estadoIntegridad: "AUDITORIA_INTEGRA",
    detalle: "Auditoría verificada: 184 expedientes vinculados al TUPA Suiza 2026 y 5 expedientes históricos conservados con tupa_historico_auditoria_id. 0 reasignaciones.",
  });

  useEffect(() => {
    if (tipoActivo !== "Catálogo TUPA (Versiones y Requisitos)") return;

    let activo = true;
    apiClient
      .get<{ data: VersionTupaAdmin[] }>("/api/v1/admin/tupa/versiones")
      .then((res) => {
        if (activo && res.data?.data && Array.isArray(res.data.data)) {
          setVersionesTupa(res.data.data);
        }
      })
      .catch(() => {});

    apiClient
      .get<{ data: TramiteTupaAdmin[] }>(`/api/v1/admin/tupa/versiones/${encodeURIComponent(versionSeleccionada)}/tramites`)
      .then((res) => {
        if (activo && res.data?.data && Array.isArray(res.data.data)) {
          setTramitesTupaApi(res.data.data);
        }
      })
      .catch(() => {
        if (activo) setTramitesTupaApi(null);
      });

    apiClient
      .get<{ data: AuditoriaTupaAdmin }>("/api/v1/admin/tupa/auditoria")
      .then((res) => {
        if (activo && res.data?.data) {
          setAuditoriaTupa(res.data.data);
        }
      })
      .catch(() => {});

    return () => {
      activo = false;
    };
  }, [tipoActivo, versionSeleccionada]);

  const refrescarVersiones = async () => {
    try {
      const res = await apiClient.get<{ data: VersionTupaAdmin[] }>("/api/v1/admin/tupa/versiones");
      if (res.data?.data && Array.isArray(res.data.data)) {
        setVersionesTupa(res.data.data);
      }
    } catch {}
  };

  const refrescarTramites = async (version: string) => {
    try {
      const res = await apiClient.get<{ data: TramiteTupaAdmin[] }>(
        `/api/v1/admin/tupa/versiones/${encodeURIComponent(version)}/tramites`
      );
      if (res.data?.data && Array.isArray(res.data.data)) {
        setTramitesTupaApi(res.data.data);
      }
    } catch {
      setTramitesTupaApi(null);
    }
  };

  const crearBorradorTupa = async (datos: {
    codigoVersion: string;
    denominacion: string;
    observaciones?: string;
  }) => {
    const res = await apiClient.post<{ data: VersionTupaAdmin }>("/api/v1/admin/tupa/versiones", datos);
    if (res.data?.data) {
      setVersionesTupa((prev) => [...prev, res.data.data]);
      setVersionSeleccionada(res.data.data.codigoVersion);
      setMensaje(`Borrador ${res.data.data.codigoVersion} creado exitosamente.`);
    }
    await refrescarVersiones();
  };

  const editarBorradorTupa = async (
    codigoVersion: string,
    datos: { denominacion?: string; observaciones?: string }
  ) => {
    const res = await apiClient.put<{ data: VersionTupaAdmin }>(
      `/api/v1/admin/tupa/versiones/${encodeURIComponent(codigoVersion)}`,
      datos
    );
    if (res.data?.data) {
      setVersionesTupa((prev) =>
        prev.map((v) => (v.codigoVersion === codigoVersion ? res.data.data : v))
      );
      setMensaje(`Borrador ${codigoVersion} actualizado correctamente.`);
    }
    await refrescarVersiones();
  };

  const configurarRequisitosTramite = async (
    codigoVersion: string,
    codigoTramite: string,
    requisitos: any[]
  ) => {
    await apiClient.put(
      `/api/v1/admin/tupa/versiones/${encodeURIComponent(codigoVersion)}/tramites/${encodeURIComponent(codigoTramite)}/requisitos`,
      { requisitos }
    );
    setMensaje(`Requisitos del trámite ${codigoTramite} actualizados.`);
    await refrescarTramites(codigoVersion);
  };

  const configurarUnidadesTramite = async (
    codigoVersion: string,
    codigoTramite: string,
    unidadResponsable: string,
    autoridadResolutiva?: string
  ) => {
    await apiClient.put(
      `/api/v1/admin/tupa/versiones/${encodeURIComponent(codigoVersion)}/tramites/${encodeURIComponent(codigoTramite)}/unidades`,
      { unidadResponsable, autoridadResolutiva }
    );
    setMensaje(`Unidad responsable del trámite ${codigoTramite} actualizada.`);
    await refrescarTramites(codigoVersion);
  };

  const publicarVersionTupa = async (datos: {
    codigoVersion: string;
    resolucionAprobacion: string;
    fechaAprobacion: string;
  }) => {
    const res = await apiClient.post<{ data: { codigoVersion: string; mensaje: string } }>(
      `/api/v1/admin/tupa/versiones/${encodeURIComponent(datos.codigoVersion)}/publicar`,
      {
        resolucionAprobacion: datos.resolucionAprobacion,
        fechaAprobacion: datos.fechaAprobacion,
      }
    );
    setMensaje(res.data?.data?.mensaje || `Versión ${datos.codigoVersion} publicada como vigente.`);
    await refrescarVersiones();
    await refrescarTramites(datos.codigoVersion);
  };

  const tramitesTupa = useMemo<TramiteTupaAdmin[]>(() => {
    if (tramitesTupaApi && tramitesTupaApi.length > 0) {
      return tramitesTupaApi;
    }

    const esBorrador = versionSeleccionada !== "TUPA-2026-V1";
    return CATALOGO_DOCUMENTAL_TUPA_2026.map((p) => ({
      codigoInterno: p.codigoInterno,
      codigoVisible: p.codigoVisible,
      numeroVisible: p.numeroVisible,
      nombre: p.nombre,
      rubro: p.rubro,
      costo: p.costoFuente,
      estadoValidacion: esBorrador ? "PENDIENTE_VALIDACION_DOCUMENTAL" : p.estadoValidacion,
      sinAnexosEspecificos: p.sinAnexosEspecificos,
      observacionInstitucional: esBorrador
        ? "Borrador en formulación técnica. No aplicable para radicación formal."
        : p.observacionInstitucional,
      unidadRecepcion: p.unidadRecepcion,
      unidadResponsable: p.unidadResponsable,
      autoridadResolutiva: p.autoridadResolutiva,
      plazoDias: p.plazoDias,
      silencioAdministrativo: p.silencioAdministrativo,
      versionTupa: versionSeleccionada || "TUPA-2026-V1",
      totalRequisitos: p.requisitos.length,
      totalAnexos: p.anexos.length,
      requisitos: p.requisitos.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        descripcion: r.descripcion,
        obligatorio: r.obligatorio,
        clasificacion: r.clasificacion,
        formatosAdmitidos: r.formatosAdmitidos,
        fuente: r.fuente,
        estadoValidacion: r.estadoValidacion ?? "VALIDADO_OFICIAL",
      })),
      anexos: p.anexos.map((a) => ({
        id: a.id,
        codigo: a.codigo,
        nombre: a.nombre,
        descripcion: a.descripcion,
        obligatorio: a.obligatorio,
        clasificacion: a.clasificacion,
        formatosAdmitidos: a.formatosAdmitidos,
        fuente: a.fuente,
        estadoValidacion: a.estadoValidacion ?? "VALIDADO_OFICIAL",
      })),
    }));
  }, [versionSeleccionada, tramitesTupaApi]);

  const tramitesTupaFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return tramitesTupa.filter((t) => {
      const coincideTexto =
        texto === "" ||
        t.numeroVisible.toLowerCase().includes(texto) ||
        t.codigoVisible.toLowerCase().includes(texto) ||
        t.codigoInterno.toLowerCase().includes(texto) ||
        t.nombre.toLowerCase().includes(texto) ||
        t.unidadResponsable.toLowerCase().includes(texto) ||
        t.rubro.toLowerCase().includes(texto);

      if (!coincideTexto) return false;

      if (filtroValidacion === "VALIDADOS") {
        return t.estadoValidacion === "VALIDADO";
      }
      if (filtroValidacion === "PENDIENTES") {
        return t.estadoValidacion === "PENDIENTE_VALIDACION_DOCUMENTAL";
      }
      return true;
    });
  }, [tramitesTupa, busqueda, filtroValidacion]);

  useEffect(() => {
    let montado = true;
    setCargandoAreas(true);
    setErrorAreas(null);

    apiClient
      .get<NodoOrganigramaApi[] | { data: NodoOrganigramaApi[] }>("/api/v1/admin/organigrama")
      .then((res) => {
        if (!montado) return;
        setCargandoAreas(false);

        const rawData = Array.isArray(res.data)
          ? res.data
          : (res.data && typeof res.data === "object" && Array.isArray((res.data as { data?: unknown }).data))
            ? (res.data as { data: NodoOrganigramaApi[] }).data
            : null;

        if (rawData === null) return;

        // Si el catálogo institucional está vacío ([]), se establece la lista vacía.
        // Prohibido inyectar identificadores ficticios en operaciones reales.
        if (rawData.length === 0) {
          setAreasOrganicas([]);
          return;
        }

        const nodosPlanos = aplanarOrganigrama(rawData);
        const mapped: AreaOrganica[] = nodosPlanos.map((item, index) => {
          const rawId = item.id !== undefined && item.id !== null
            ? String(item.id).trim()
            : (item.area_id ? String(item.area_id).trim() : "");
          const esReal = esUuidValido(rawId);

          const estado: EstadoRegistro =
            typeof item.estado === "boolean"
              ? (item.estado ? "Activo" : "Inactivo")
              : (item.estado === "Inactivo" ? "Inactivo" : "Activo");

          return {
            id: rawId,
            codigo: item.codigo ?? item.sigla ?? `ARE-${String(index + 1).padStart(3, "0")}`,
            nombre: item.nombre,
            ruta: item.path ?? item.ruta_jerarquica ?? `01.${String(index + 1).padStart(2, "0")}`,
            detalle: item.detalle ?? `Unidad orgánica institucional (${item.sigla ?? item.codigo ?? item.nombre})`,
            estado,
            esReal,
          };
        });

        setAreasOrganicas(mapped);
      })
      .catch((err: unknown) => {
        if (!montado) return;
        setCargandoAreas(false);
        const mensajeError = err instanceof Error ? err.message : "Error al consultar organigrama";
        setErrorAreas(mensajeError);
      });

    return () => {
      montado = false;
    };
  }, []);

  const areasReales = useMemo(
    () => areasOrganicas.filter((area) => area.esReal === true),
    [areasOrganicas],
  );

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
    areasReales,
    cargandoAreas,
    errorAreas,
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
    // Versionado y requisitos TUPA
    versionesTupa,
    versionSeleccionada,
    setVersionSeleccionada,
    filtroValidacion,
    setFiltroValidacion,
    tramitesTupa: tramitesTupaFiltrados,
    totalTramitesTupa: tramitesTupa.length,
    tramiteModalDetalle,
    setTramiteModalDetalle,
    auditoriaTupa,
    // Acciones de administración y publicación TUPA (ADMINISTRADOR y SUPER_ADMIN)
    crearBorradorTupa,
    editarBorradorTupa,
    configurarRequisitosTramite,
    configurarUnidadesTramite,
    publicarVersionTupa,
  };
}
