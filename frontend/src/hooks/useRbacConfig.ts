// Configuración del RBAC institucional persistido (ENT-M05-03).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";
import type { ClavePermiso, PermisoModulo } from "../types/rbacRoles";

export const MODULOS_SISTEMA = ["Expedientes", "Documentos", "Administración", "Auditoría"] as const;
export const MODULOS_PERMISOS = MODULOS_SISTEMA;
export const CLAVE_STORAGE_PERMISOS = "sigd_permisos";
export const ACCIONES_INMUTABLES_AUDITORIA: ClavePermiso[] = ["crear", "editar", "derivar", "archivar", "eliminar"];

export interface RolInstitucional {
  id: string; codigo: string; nombre: string; descripcion: string | null;
  vigente: boolean; usuarios: number; permisos: string[];
}
export interface PermisoInstitucional {
  id: string;
  codigo: string;
  nombre: string;
  ambito: "GLOBAL" | "AREA";
  modulo?: string;
  descripcion?: string;
}

export function resolverModulo(permiso: { codigo: string; modulo?: string }): string {
  if (permiso.modulo) return permiso.modulo;
  if (permiso.codigo === "ADMIN_USUARIOS") return "Administración";
  if (permiso.codigo === "TRAMICORE_DEVOLUCION_EVALUAR") return "Mesa de Partes";
  if (permiso.codigo.startsWith("EXPEDIENTE_")) return "Trámite Documentario y RutaDoc";
  if (permiso.codigo.startsWith("FIRMA_")) return "Gestión Documentaria";
  if (permiso.codigo.startsWith("TESORERIA_")) return "Tesorería";
  if (permiso.codigo.startsWith("REPORTE_")) return "Reportes";
  return "General";
}

export function resolverDescripcion(permiso: { codigo: string; nombre: string; descripcion?: string }): string {
  if (permiso.descripcion) return permiso.descripcion;
  const catalogoDescripciones: Record<string, string> = {
    ADMIN_USUARIOS: "Administración integral de cuentas de usuario, asignación de roles y control de acceso institucional.",
    EXPEDIENTE_DERIVAR: "Derivación y transferencia de expedientes hacia otras dependencias u oficinas del instituto.",
    EXPEDIENTE_LEER: "Consulta, lectura y seguimiento del estado de expedientes y trámites institucionales.",
    EXPEDIENTE_RESOLVER: "Resolución, atención final y emisión de dictamen o proveído sobre expedientes asignados al área.",
    FIRMA_FIRMAR: "Emisión y firmado digital con validez legal de documentos oficiales y resoluciones.",
    REPORTE_LEER: "Acceso y consulta a paneles estadísticos, indicadores MGD y reportes consolidados.",
    TRAMICORE_DEVOLUCION_EVALUAR: "Recepción, examen preliminar y evaluación de solicitudes de devolución y trámites ciudadanos.",
    TESORERIA_DEVOLUCION_APROBAR: "Aprobación y autorización formal de devoluciones financieras solicitadas.",
    TESORERIA_DEVOLUCION_EJECUTAR: "Ejecución contable y registro de desembolsos de devolución.",
    TESORERIA_DEVOLUCION_EVALUAR: "Evaluación presupuestal y liquidación de importes sujetos a devolución.",
    TESORERIA_LEER: "Visualización de estados de caja, comprobantes de pago y operaciones de recaudación.",
    TESORERIA_PAGO_REGISTRAR: "Registro de ingresos directos en ventanilla y cobro de tasas educativas y TUPA.",
    TESORERIA_PAGO_VERIFICAR: "Validación de constancias de depósito y conciliación bancaria de pagos recibidos.",
    TESORERIA_REPORTES: "Generación de reportes de recaudación, balances de caja y libros de tesorería.",
    TESORERIA_TARIFA_PROPONER: "Formulación y propuesta de nuevos aranceles, tasas y derechos de tramitación.",
    TESORERIA_TARIFA_VALIDAR: "Revisión técnica y validación reglamentaria del tarifario institucional.",
  };
  return catalogoDescripciones[permiso.codigo] ?? permiso.nombre;
}
interface ConfiguracionRbac { roles: RolInstitucional[]; catalogoPermisos: PermisoInstitucional[] }

export function useRbacConfig() {
  const [config, setConfig] = useState<ConfiguracionRbac>({ roles: [], catalogoPermisos: [] });
  const [rolSeleccionado, setRolSeleccionado] = useState("");
  const [selecciones, setSelecciones] = useState<Record<string, string[]>>({});
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const enviando = useRef(false);

  const aplicar = useCallback((datos: ConfiguracionRbac) => {
    if (!Array.isArray(datos.roles) || !Array.isArray(datos.catalogoPermisos)) {
      throw new Error("La API no devolvió el catálogo institucional de roles y permisos.");
    }
    setConfig(datos);
    setRolSeleccionado(actual => datos.roles.some(r => r.id === actual) ? actual : datos.roles[0]?.id ?? "");
    setSelecciones(Object.fromEntries(datos.roles.map(r => [
      r.id, datos.catalogoPermisos.filter(p => r.permisos.includes(p.codigo)).map(p => p.id),
    ])));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const { data } = await apiClient.get<ConfiguracionRbac>("/api/v1/admin/roles-permisos");
      aplicar(data);
    } catch (e) {
      setConfig({ roles: [], catalogoPermisos: [] });
      setError(e instanceof Error ? e.message : "No se pudieron consultar los roles institucionales.");
    } finally { setCargando(false); }
  }, [aplicar]);
  useEffect(() => { void cargar(); }, [cargar]);

  function alternarPermiso(id: string) {
    if (enviando.current || !config.catalogoPermisos.some(p => p.id === id)) return;
    const rolActualObj = config.roles.find(r => r.id === rolSeleccionado);
    if (rolActualObj?.codigo === 'CIUDADANO') return;
    const permiso = config.catalogoPermisos.find(p => p.id === id);
    const ids = selecciones[rolSeleccionado] ?? [];
    const yaSeleccionado = ids.includes(id);
    if (rolActualObj?.codigo === 'ADMINISTRADOR' && permiso?.codigo === 'ADMIN_USUARIOS' && yaSeleccionado) {
      // Bloqueado: ADMIN_USUARIOS es obligatorio para el Administrador
      return;
    }
    setMensaje("");
    setSelecciones(actual => {
      const currentIds = actual[rolSeleccionado] ?? [];
      return { ...actual, [rolSeleccionado]: currentIds.includes(id) ? currentIds.filter(p => p !== id) : [...currentIds, id] };
    });
  }

  async function guardarPermisos() {
    if (enviando.current || !rolSeleccionado) return;
    const rolActualObj = config.roles.find(r => r.id === rolSeleccionado);
    if (rolActualObj?.codigo === 'CIUDADANO') {
      setError("El rol Ciudadano corresponde a servicios externos y no admite modificación de permisos.");
      return;
    }
    enviando.current = true; setGuardando(true); setError(""); setMensaje("");
    try {
      const respuesta = await apiClient.put("/api/v1/roles/" + rolSeleccionado + "/permisos", {
        permisos: selecciones[rolSeleccionado] ?? [],
      });
      if (respuesta.status !== 200) throw new Error("El servidor no confirmó la actualización.");
      const { data } = await apiClient.get<ConfiguracionRbac>("/api/v1/admin/roles-permisos");
      aplicar(data);
      setMensaje("Permisos confirmados por el servidor y consultados nuevamente.");
    } catch (e: any) {
      const mensajeServidor = e?.response?.data?.message || (e instanceof Error ? e.message : "No se pudo confirmar la actualización. Consulte el estado antes de reintentar.");
      setError(mensajeServidor);
    } finally { enviando.current = false; setGuardando(false); }
  }

  const rolActualObj = config.roles.find(r => r.id === rolSeleccionado) ?? null;
  const permisosOriginalesIds = useMemo(() => {
    if (!rolActualObj) return [];
    return config.catalogoPermisos
      .filter(p => rolActualObj.permisos.includes(p.codigo))
      .map(p => p.id);
  }, [rolActualObj, config.catalogoPermisos]);

  const permisosSeleccionados = selecciones[rolSeleccionado] ?? [];

  const hayCambios = useMemo(() => {
    if (!rolActualObj || rolActualObj.codigo === 'CIUDADANO') return false;
    if (permisosSeleccionados.length !== permisosOriginalesIds.length) return true;
    const setOriginal = new Set(permisosOriginalesIds);
    return permisosSeleccionados.some(id => !setOriginal.has(id));
  }, [rolActualObj, permisosSeleccionados, permisosOriginalesIds]);

  const descartarCambios = useCallback(() => {
    if (!rolSeleccionado || !rolActualObj) return;
    setSelecciones(actual => ({
      ...actual,
      [rolSeleccionado]: permisosOriginalesIds,
    }));
    setMensaje("");
    setError("");
  }, [rolSeleccionado, rolActualObj, permisosOriginalesIds]);

  return {
    roles: config.roles,
    catalogoPermisos: config.catalogoPermisos,
    rolSeleccionado,
    setRolSeleccionado,
    rolActual: rolActualObj,
    permisosSeleccionados,
    alternarPermiso,
    guardarPermisos,
    descartarCambios,
    hayCambios,
    mensaje,
    setMensaje,
    error,
    cargando,
    guardando,
    recargar: cargar,
  };
}

export function permissionsByModule(filas: PermisoModulo[]): Record<string, PermisoModulo> {
  return Object.fromEntries(filas.map(fila => [fila.modulo, fila]));
}
