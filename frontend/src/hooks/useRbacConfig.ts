// Hook de configuración RBAC de la Matriz de Control de Acceso (ENT-M05-03)
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import { useAuthStore } from "../stores/authStore";

import type {
  ClavePermiso,
  MatrizPermisos,
  PermisoModulo,
  Rol,
  RoleRBACPayload,
} from "../types/rbacRoles";
import { PERMISOS, esSuperAdmin } from "../auth/permissions";

export const MODULOS_SISTEMA = [
  "Expedientes",
  "Documentos",
  "Reportes",
  "Administración",
  "Auditoría",
  "Usuarios",
  "Roles y Permisos",
  "Organigrama",
  "Tablas Maestras",
  "Calendario Laboral",
] as const;

export const CLAVE_STORAGE_PERMISOS = "sigd_permisos";

export const CODIGO_PERMISO_BACKEND: Partial<Record<string, string>> = {
  "Expedientes.ver": "EXPEDIENTE_LEER",
  "Expedientes.derivar": "EXPEDIENTE_DERIVAR",
  "Expedientes.editar": "EXPEDIENTE_RESOLVER",
  "Documentos.editar": "FIRMA_FIRMAR",
  "Reportes.ver": "REPORTE_LEER",
  "Administración.ver": PERMISOS.ADMIN_ACCESO,
  "Auditoría.ver": PERMISOS.AUDITORIA_LEER,
  "Usuarios.ver": PERMISOS.USUARIOS_LEER,
  "Usuarios.gestionar": PERMISOS.USUARIOS_GESTIONAR,
  "Roles y Permisos.ver": PERMISOS.ROLES_LEER,
  "Organigrama.ver": PERMISOS.ORGANIGRAMA_LEER,
  "Organigrama.gestionar": PERMISOS.ORGANIGRAMA_GESTIONAR,
  "Tablas Maestras.ver": PERMISOS.MAESTRAS_LEER,
  "Tablas Maestras.gestionar": PERMISOS.MAESTRAS_GESTIONAR,
  "Calendario Laboral.ver": PERMISOS.CALENDARIO_LEER,
  "Calendario Laboral.gestionar": PERMISOS.CALENDARIO_GESTIONAR,
};

const ROLES_BACKEND: Record<string, string[]> = {
  SUPER_ADMIN: ["ADMINISTRADOR"],
  DIRECTOR: ["DIRECTOR"],
  DOCENTE: ["SECRETARIO", "ESPECIALISTA"],
  MESA_PARTES: ["MESA_PARTES"],
  ESTUDIANTE: ["CIUDADANO"],
};

const CODIGOS_CANONICOS_DB = new Set(Object.values(ROLES_BACKEND).flat());

interface RolBackend {
  codigo: string;
  nombre?: string;
  descripcion?: string | null;
  vigente?: boolean;
  permisos: string[];
  usuarios?: number;
}

const rolesIniciales: Rol[] = [
  {
    id: "SUPER_ADMIN",
    nombre: "Super Administrador",
    descripcion: "Gobernanza global, auditoría forense WORM y configuración institucional.",
    alcance: "Institución y Servidores",
    usuarios: null,
  },
  {
    id: "DIRECTOR",
    nombre: "Director General",
    descripcion: "Firma digital de Resoluciones Directorales, visado y reportes estratégicos.",
    alcance: "Despacho de Dirección",
    usuarios: null,
  },
  {
    id: "DOCENTE",
    nombre: "Docente / Coordinador",
    descripcion: "Evaluación académica de proyectos de titulación y derivación de actuados.",
    alcance: "Programas de Estudio",
    usuarios: null,
  },
  {
    id: "MESA_PARTES",
    nombre: "Mesa de Partes / Ventanilla",
    descripcion: "Recepción ciudadana virtual y presencial, foliado y asignación de CUT.",
    alcance: "Mesa de Partes",
    usuarios: null,
  },
  {
    id: "ESTUDIANTE",
    nombre: "Estudiante / Administrado",
    descripcion: "Presentación de solicitudes académicas y consulta de Casilla Electrónica.",
    alcance: "Trámites propios",
    usuarios: null,
  },
];

export const permisosIniciales: MatrizPermisos = {
  SUPER_ADMIN: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: true, exportar: true },
    { modulo: "Documentos", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: true, exportar: true },
    { modulo: "Administración", ver: true, crear: true, editar: true, derivar: false, archivar: false, eliminar: true, exportar: true },
    { modulo: "Auditoría", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: true },
  ],
  DIRECTOR: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: false, exportar: true },
    { modulo: "Documentos", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: false, exportar: true },
    { modulo: "Administración", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: true },
    { modulo: "Auditoría", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: true },
  ],
  DOCENTE: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: false, eliminar: false, exportar: true },
    { modulo: "Documentos", ver: true, crear: true, editar: true, derivar: true, archivar: false, eliminar: false, exportar: true },
    { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Auditoría", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
  ],
  MESA_PARTES: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: false, eliminar: false, exportar: true },
    { modulo: "Documentos", ver: true, crear: true, editar: false, derivar: true, archivar: false, eliminar: false, exportar: false },
    { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Auditoría", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
  ],
  ESTUDIANTE: [
    { modulo: "Expedientes", ver: true, crear: true, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Documentos", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Auditoría", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
  ],
  admin: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: true, exportar: true },
    { modulo: "Documentos", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: true, exportar: true },
    { modulo: "Administración", ver: true, crear: true, editar: true, derivar: false, archivar: false, eliminar: true, exportar: true },
    { modulo: "Auditoría", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: true },
  ],
  responsable: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: false, exportar: true },
    { modulo: "Documentos", ver: true, crear: true, editar: true, derivar: true, archivar: true, eliminar: false, exportar: true },
    { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Auditoría", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
  ],
  operador: [
    { modulo: "Expedientes", ver: true, crear: true, editar: true, derivar: true, archivar: false, eliminar: false, exportar: false },
    { modulo: "Documentos", ver: true, crear: true, editar: true, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Auditoría", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
  ],
  consulta: [
    { modulo: "Expedientes", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Documentos", ver: true, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Administración", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
    { modulo: "Auditoría", ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false },
  ],
};

const MODULOS_RBAC_NUEVOS = MODULOS_SISTEMA.filter(
  (modulo) => !["Expedientes", "Documentos", "Administración", "Auditoría"].includes(modulo),
);
for (const filas of Object.values(permisosIniciales)) {
  for (const modulo of MODULOS_RBAC_NUEVOS) {
    filas.push({
      modulo,
      ver: false,
      gestionar: false,
      crear: false,
      editar: false,
      derivar: false,
      archivar: false,
      eliminar: false,
      exportar: false,
    });
  }
}

// Invariante WORM: el módulo Auditoría jamás admite mutaciones, ni para admin
export const ACCIONES_INMUTABLES_AUDITORIA: ClavePermiso[] = [
  "crear",
  "gestionar",
  "editar",
  "derivar",
  "archivar",
  "eliminar",
];

export function useRbacConfig() {
  const [rolSeleccionado, setRolSeleccionado] = useState("SUPER_ADMIN");
  const [roles, setRoles] = useState<Rol[]>(rolesIniciales);
  const [permisos, setPermisos] = useState<MatrizPermisos>(permisosIniciales);
  const [permisosPersistidos, setPermisosPersistidos] = useState<MatrizPermisos>(permisosIniciales);
  const [mensaje, setMensaje] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [codigosPorRol, setCodigosPorRol] = useState<Record<string, string[]>>({});
  const rolUsuario = useAuthStore((state) => state.usuario?.rol);

  const recargar = useCallback(async () => {
    if (!window.localStorage.getItem("sigd_token") && !window.localStorage.getItem("token")) return;
    setIsLoading(true);
    setIsError(false);
    setIsLoaded(false);
    try {
        const { data } = await apiClient.get<{ roles: RolBackend[] }>("/api/v1/admin/roles-permisos", {
          params: { incluirInactivos: true },
        });
        const rolesBackend = data.roles ?? [];
        const rolesBaseActualizados: Rol[] = rolesIniciales.map((rol) => {
          const codigos = ROLES_BACKEND[rol.id] ?? [rol.id];
          const asociados = rolesBackend.filter((item) => codigos.includes(item.codigo));
          const principal = asociados[0];
          return {
            ...rol,
            nombre: principal?.nombre && codigos.length === 1 ? principal.nombre : rol.nombre,
            descripcion: principal?.descripcion && codigos.length === 1 ? principal.descripcion : rol.descripcion,
            vigente: asociados.length > 0 ? asociados.some((item) => item.vigente !== false) : true,
            usuarios: asociados.reduce((total, item) => total + Number(item.usuarios ?? 0), 0),
          };
        });
        const rolesPersonalizados: Rol[] = rolesBackend
          .filter((item) => !CODIGOS_CANONICOS_DB.has(item.codigo))
          .map((item) => ({
            id: item.codigo,
            nombre: item.nombre ?? item.codigo,
            descripcion: item.descripcion ?? "Rol institucional personalizado.",
            alcance: "Configurado por administración",
            usuarios: Number(item.usuarios ?? 0),
            vigente: item.vigente !== false,
            personalizado: true,
          }));
        setRoles([...rolesBaseActualizados, ...rolesPersonalizados]);

        const sincronizados: MatrizPermisos = Object.fromEntries(
          Object.entries(permisosIniciales).map(([rol, filas]) => [rol, filas.map((fila) => ({ ...fila }))]),
        );
        const codigosPorRolActual: Record<string, string[]> = {};
        const construirFilas = (permisosRol: Set<string>) =>
          MODULOS_SISTEMA.map((modulo) => {
            const fila = { modulo, ver: false, gestionar: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false };
            for (const clave of Object.keys(fila) as Array<keyof typeof fila>) {
              if (clave === "modulo") continue;
              const codigo = CODIGO_PERMISO_BACKEND[`${modulo}.${clave}`];
              if (codigo) fila[clave] = permisosRol.has(codigo);
            }
            return fila;
          });
        for (const [rolCanonico, codigos] of Object.entries(ROLES_BACKEND)) {
          const permisosBrutos = rolesBackend.filter((rol) => codigos.includes(rol.codigo)).flatMap((rol) => rol.permisos);
          codigosPorRolActual[rolCanonico] = [...new Set(permisosBrutos)];
          sincronizados[rolCanonico] = construirFilas(new Set(permisosBrutos));
        }
        for (const extra of rolesPersonalizados) {
          const fuente = rolesBackend.find((item) => item.codigo === extra.id);
          const permisosBrutos = fuente?.permisos ?? [];
          codigosPorRolActual[extra.id] = [...new Set(permisosBrutos)];
          sincronizados[extra.id] = construirFilas(new Set(permisosBrutos));
        }
        setCodigosPorRol(codigosPorRolActual);
        setPermisos(sincronizados);
        setPermisosPersistidos(sincronizados);
        setIsLoaded(true);
    } catch {
      setIsError(true);
      setIsLoaded(false);
      setMensaje("No fue posible cargar la matriz RBAC desde PostgreSQL.");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    let cancelado = false;
    queueMicrotask(() => {
      if (!cancelado) void recargar();
    });
    return () => { cancelado = true; };
  }, [recargar]);

  const rolActual: Rol = useMemo(
    () => roles.find((rol) => rol.id === rolSeleccionado) ?? roles[0],
    [roles, rolSeleccionado],
  );

  const permisosRolActual = permisos[rolSeleccionado] ?? [];

  function alternarPermiso(indice: number, clave: ClavePermiso) {
    setMensaje("");
    setPermisos((actuales) => ({
      ...actuales,
      [rolSeleccionado]: actuales[rolSeleccionado].map((fila, posicion) =>
        posicion === indice ? { ...fila, [clave]: !fila[clave] } : fila,
      ),
    }));
  }

  function construirPayload(): RoleRBACPayload {
    const permissions = permissionsByModule(
      permisos[rolSeleccionado] ?? [],
    );
    return { roleId: rolSeleccionado, permissions };
  }

  async function guardarPermisos() {
    if (!esSuperAdmin(rolUsuario) || !isLoaded) {
      setIsError(true);
      setMensaje(!esSuperAdmin(rolUsuario)
        ? "Solo SUPER_ADMIN puede modificar permisos de roles."
        : "Carga la matriz desde el servidor antes de guardar cambios.");
      return;
    }
    const payload = construirPayload();
    const codigos = Object.values(payload.permissions).flatMap((fila) =>
      (Object.keys(fila) as Array<keyof PermisoModulo>)
        .filter((clave) => clave !== "modulo" && fila[clave] === true)
        .map((clave) => CODIGO_PERMISO_BACKEND[`${fila.modulo}.${String(clave)}`])
        .filter((codigo): codigo is string => Boolean(codigo)),
    );
    const codigosRepresentados = new Set(Object.values(CODIGO_PERMISO_BACKEND));
    const codigosNoRepresentados = (codigosPorRol[payload.roleId] ?? []).filter(
      (codigo) => !codigosRepresentados.has(codigo),
    );
    const permisosGuardar = [...new Set([...codigosNoRepresentados, ...codigos])];
    try {
      await apiClient.put(`/api/v1/admin/roles/${payload.roleId}/permisos`, {
        permisos: permisosGuardar,
      });
      setCodigosPorRol((actual) => ({ ...actual, [payload.roleId]: permisosGuardar }));
      setPermisosPersistidos((actual) => ({
        ...actual,
        [payload.roleId]: (permisos[payload.roleId] ?? []).map((fila) => ({ ...fila })),
      }));
      setIsError(false);
      setMensaje(`Matriz guardada en PostgreSQL para ${rolActual.nombre}.`);
    } catch {
      const restaurar = permisosPersistidos[payload.roleId];
      if (restaurar) setPermisos((actual) => ({ ...actual, [payload.roleId]: restaurar.map((fila) => ({ ...fila })) }));
      setIsError(true);
      setMensaje(`No fue posible guardar la matriz de ${rolActual.nombre}.`);
    }
  }

  async function crearRol(datos: { codigo: string; nombre: string; descripcion?: string }): Promise<boolean> {
    if (!esSuperAdmin(rolUsuario)) {
      setIsError(true);
      setMensaje("Solo SUPER_ADMIN puede crear roles.");
      return false;
    }
    try {
      const codigo = datos.codigo.trim().toUpperCase();
      await apiClient.post("/api/v1/admin/roles", {
        codigo,
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
        permisos: [],
      });
      await recargar();
      setRolSeleccionado(codigo);
      setIsError(false);
      setMensaje(`Rol ${codigo} creado correctamente.`);
      return true;
    } catch (error) {
      setIsError(true);
      setMensaje(error instanceof Error ? error.message : "No fue posible crear el rol.");
      return false;
    }
  }

  async function editarRol(codigo: string, datos: { nombre: string; descripcion?: string }): Promise<boolean> {
    if (!esSuperAdmin(rolUsuario)) {
      setIsError(true);
      setMensaje("Solo SUPER_ADMIN puede editar roles.");
      return false;
    }
    try {
      await apiClient.put(`/api/v1/admin/roles/${codigo}`, {
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
      });
      await recargar();
      setIsError(false);
      setMensaje(`Rol ${datos.nombre.trim()} actualizado correctamente.`);
      return true;
    } catch (error) {
      setIsError(true);
      setMensaje(error instanceof Error ? error.message : "No fue posible actualizar el rol.");
      return false;
    }
  }

  async function cambiarVigenciaRol(codigo: string, vigente: boolean): Promise<boolean> {
    if (!esSuperAdmin(rolUsuario)) {
      setIsError(true);
      setMensaje("Solo SUPER_ADMIN puede cambiar la vigencia de roles.");
      return false;
    }
    try {
      await apiClient.patch(`/api/v1/admin/roles/${codigo}/vigencia`, { vigente });
      await recargar();
      setIsError(false);
      setMensaje(`Rol ${codigo} ${vigente ? "activado" : "desactivado"} correctamente.`);
      return true;
    } catch (error) {
      setIsError(true);
      setMensaje(error instanceof Error ? error.message : "No fue posible cambiar el estado del rol.");
      return false;
    }
  }

  return {
    roles,
    rolSeleccionado,
    setRolSeleccionado,
    rolActual,
    permisosRolActual,
    alternarPermiso,
    guardarPermisos,
    crearRol,
    editarRol,
    cambiarVigenciaRol,
    mensaje,
    setMensaje,
    isLoading,
    isError,
    isLoaded,
    canEdit: esSuperAdmin(rolUsuario),
    recargar,
  };
}

export function permissionsByModule(
  filas: PermisoModulo[],
): Record<string, PermisoModulo> {
  return filas.reduce<Record<string, PermisoModulo>>((acumulado, fila) => {
    acumulado[fila.modulo] = fila;
    return acumulado;
  }, {});
}

export function obtenerPermisosAlmacenados(): MatrizPermisos | null {
  const crudo = window.localStorage.getItem(CLAVE_STORAGE_PERMISOS);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as MatrizPermisos;
  } catch {
    return null;
  }
}

export { MODULOS_SISTEMA as MODULOS_PERMISOS };
