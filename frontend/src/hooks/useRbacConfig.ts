// Hook de configuración RBAC de la Matriz de Control de Acceso (ENT-M05-03)
import { useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";

import type {
  ClavePermiso,
  MatrizPermisos,
  PermisoModulo,
  Rol,
  RoleRBACPayload,
} from "../types/rbacRoles";

export const MODULOS_SISTEMA = [
  "Expedientes",
  "Documentos",
  "Administración",
  "Auditoría",
] as const;

export const CLAVE_STORAGE_PERMISOS = "sigd_permisos";

export const CODIGO_PERMISO_BACKEND: Partial<Record<string, string>> = {
  "Expedientes.ver": "EXPEDIENTE_LEER",
  "Expedientes.derivar": "EXPEDIENTE_DERIVAR",
  "Expedientes.editar": "EXPEDIENTE_RESOLVER",
  "Documentos.editar": "FIRMA_FIRMAR",
  "Administración.editar": "ADMIN_USUARIOS",
  "Auditoría.exportar": "REPORTE_LEER",
};

const ROLES_BACKEND: Record<string, string[]> = {
  SUPER_ADMIN: ["ADMINISTRADOR"],
  DIRECTOR: ["DIRECTOR"],
  DOCENTE: ["SECRETARIO", "ESPECIALISTA"],
  MESA_PARTES: ["MESA_PARTES"],
  ESTUDIANTE: ["CIUDADANO"],
};

interface RolBackend {
  codigo: string;
  permisos: string[];
}

const roles: Rol[] = [
  {
    id: "SUPER_ADMIN",
    nombre: "Super Administrador",
    descripcion: "Gobernanza global, auditoría forense WORM y configuración institucional.",
    alcance: "Institución y Servidores",
    usuarios: 2,
  },
  {
    id: "DIRECTOR",
    nombre: "Director General",
    descripcion: "Firma digital de Resoluciones Directorales, visado y reportes estratégicos.",
    alcance: "Despacho de Dirección",
    usuarios: 1,
  },
  {
    id: "DOCENTE",
    nombre: "Docente / Coordinador",
    descripcion: "Evaluación académica de proyectos de titulación y derivación de actuados.",
    alcance: "Programas de Estudio",
    usuarios: 12,
  },
  {
    id: "MESA_PARTES",
    nombre: "Mesa de Partes / Ventanilla",
    descripcion: "Recepción ciudadana virtual y presencial, foliado y asignación de CUT.",
    alcance: "Mesa de Partes",
    usuarios: 4,
  },
  {
    id: "ESTUDIANTE",
    nombre: "Estudiante / Administrado",
    descripcion: "Presentación de solicitudes académicas y consulta de Casilla Electrónica.",
    alcance: "Trámites propios",
    usuarios: 450,
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

// Invariante WORM: el módulo Auditoría jamás admite mutaciones, ni para admin
export const ACCIONES_INMUTABLES_AUDITORIA: ClavePermiso[] = [
  "crear",
  "editar",
  "derivar",
  "archivar",
  "eliminar",
];

export function useRbacConfig() {
  const [rolSeleccionado, setRolSeleccionado] = useState("SUPER_ADMIN");
  const [permisos, setPermisos] = useState<MatrizPermisos>(permisosIniciales);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (!window.localStorage.getItem("sigd_token") && !window.localStorage.getItem("token")) return;
    let vigente = true;
    apiClient.get<{ roles: RolBackend[] }>("/api/v1/admin/roles-permisos")
      .then(({ data }) => {
        if (!vigente) return;
        setPermisos((actuales) => {
          const sincronizados = { ...actuales };
          for (const [rolCanonico, codigos] of Object.entries(ROLES_BACKEND)) {
            const permisosRol = new Set(
              data.roles.filter((rol) => codigos.includes(rol.codigo)).flatMap((rol) => rol.permisos),
            );
            sincronizados[rolCanonico] = MODULOS_SISTEMA.map((modulo) => {
              const fila = { modulo, ver: false, crear: false, editar: false, derivar: false, archivar: false, eliminar: false, exportar: false };
              for (const clave of Object.keys(fila) as Array<keyof typeof fila>) {
                if (clave === "modulo") continue;
                const codigo = CODIGO_PERMISO_BACKEND[`${modulo}.${clave}`];
                if (codigo) fila[clave] = permisosRol.has(codigo);
              }
              return fila;
            });
          }
          return sincronizados;
        });
      })
      .catch(() => vigente && setMensaje("No fue posible cargar la matriz RBAC desde PostgreSQL."));
    return () => { vigente = false; };
  }, []);

  const rolActual: Rol = useMemo(
    () => roles.find((rol) => rol.id === rolSeleccionado) ?? roles[0],
    [rolSeleccionado],
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
    const payload = construirPayload();
    const codigos = Object.values(payload.permissions).flatMap((fila) =>
      (Object.keys(fila) as Array<keyof PermisoModulo>)
        .filter((clave) => clave !== "modulo" && fila[clave] === true)
        .map((clave) => CODIGO_PERMISO_BACKEND[`${fila.modulo}.${String(clave)}`])
        .filter((codigo): codigo is string => Boolean(codigo)),
    );
    try {
      await apiClient.put(`/api/v1/admin/roles/${payload.roleId}/permisos`, {
        permisos: [...new Set(codigos)],
      });
      setMensaje(`Matriz guardada en PostgreSQL para ${rolActual.nombre}.`);
    } catch {
      setMensaje(`No fue posible guardar la matriz de ${rolActual.nombre}.`);
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
    mensaje,
    setMensaje,
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
