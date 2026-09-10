import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import type {
  AccionOperativa,
  PermisoDetalleDTO,
  RoleDetailDTO,
  UpdatePermisosDTO,
} from "../types/rbacRoles";

interface FetchRolesResponse {
  data: RoleDetailDTO[];
}

interface UpdatePermisosResponse {
  data: RoleDetailDTO;
}

export interface RbacConfigHook {
  roles: RoleDetailDTO[];
  permisos: PermisoDetalleDTO[];
  selectedRole: RoleDetailDTO | null;
  selectedRoleId: string | null;
  loading: boolean;
  saving: boolean;
  saved: boolean;
  hasUnsavedChanges: boolean;
  error: string | null;
  selectRole: (roleId: string) => void;
  updatePermiso: (
    modulo: string,
    accion: AccionOperativa,
    valor: boolean,
  ) => void;
  savePermisos: () => Promise<void>;
  discardChanges: () => void;
  loadRoles: () => Promise<void>;
}

const RESPUESTA_VACIA: RoleDetailDTO[] = [];

export function useRbacConfig(): RbacConfigHook {
  const [roles, setRoles] = useState<RoleDetailDTO[]>(RESPUESTA_VACIA);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [permisosBorrador, setPermisosBorrador] = useState<
    Record<string, PermisoDetalleDTO[]>
  >({});

  const cargarRoles = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const respuesta = await apiClient.get<FetchRolesResponse>("/roles");
      const rolesObtenidos = respuesta.data.data;
      setRoles(rolesObtenidos);
      setPermisosBorrador(
        rolesObtenidos.reduce<Record<string, PermisoDetalleDTO[]>>(
          (acumulador, rol) => {
            acumulador[rol.id] = rol.permisos;
            return acumulador;
          },
          {},
        ),
      );
      if (rolesObtenidos.length > 0 && selectedRoleId === null) {
        setSelectedRoleId(rolesObtenidos[0].id);
      }
    } catch (err) {
      setError("No se pudieron cargar los roles. Verifica la conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    void cargarRoles();
  }, [cargarRoles]);

  const selectedRole = useMemo<RoleDetailDTO | null>(() => {
    if (selectedRoleId === null) {
      return null;
    }
    return roles.find((rol) => rol.id === selectedRoleId) ?? null;
  }, [roles, selectedRoleId]);

  const permisosActuales = useMemo<PermisoDetalleDTO[]>(() => {
    if (selectedRoleId === null) {
      return [];
    }
    return permisosBorrador[selectedRoleId] ?? [];
  }, [permisosBorrador, selectedRoleId]);

  const tieneCambiosSinGuardar = useMemo<boolean>(() => {
    if (selectedRole === null) {
      return false;
    }
    return !sonPermisosIguales(
      selectedRole.permisos,
      permisosActuales,
    );
  }, [selectedRole, permisosActuales]);

  const actualizarPermiso = useCallback(
    (modulo: string, accion: AccionOperativa, valor: boolean): void => {
      if (selectedRoleId === null) {
        return;
      }
      setPermisosBorrador((borrador) => {
        const permisosDelRol = borrador[selectedRoleId] ?? [];
        return {
          ...borrador,
          [selectedRoleId]: permisosDelRol.map((permiso) =>
            permiso.modulo === modulo ? { ...permiso, [accion]: valor } : permiso,
          ),
        };
      });
      setSaved(false);
    },
    [selectedRoleId],
  );

  const guardarPermisos = useCallback(async (): Promise<void> => {
    if (selectedRoleId === null || !tieneCambiosSinGuardar) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const cuerpo: UpdatePermisosDTO = {
        permisos: permisosActuales,
      };
      const respuesta = await apiClient.put<UpdatePermisosResponse>(
        `/roles/${selectedRoleId}/permisos`,
        cuerpo,
      );
      const rolActualizado = respuesta.data.data;
      setRoles((actuales) =>
        actuales.map((rol) => (rol.id === rolActualizado.id ? rolActualizado : rol)),
      );
      setPermisosBorrador((borrador) => ({
        ...borrador,
        [rolActualizado.id]: rolActualizado.permisos,
      }));
      setSaved(true);
    } catch (err) {
      setError("No se pudieron guardar los permisos. Verifica la conexión con el servidor.");
    } finally {
      setSaving(false);
    }
  }, [selectedRoleId, tieneCambiosSinGuardar, permisosActuales]);

  const descartarCambios = useCallback((): void => {
    if (selectedRole === null) {
      return;
    }
    setPermisosBorrador((borrador) => ({
      ...borrador,
      [selectedRole.id]: selectedRole.permisos,
    }));
    setSaved(false);
  }, [selectedRole]);

  const seleccionarRol = useCallback((roleId: string): void => {
    setSelectedRoleId(roleId);
    setError(null);
    setSaved(false);
  }, []);

  return {
    roles,
    permisos: permisosActuales,
    selectedRole,
    selectedRoleId,
    loading,
    saving,
    saved,
    hasUnsavedChanges: tieneCambiosSinGuardar,
    error,
    selectRole: seleccionarRol,
    updatePermiso: actualizarPermiso,
    savePermisos: guardarPermisos,
    discardChanges: descartarCambios,
    loadRoles: cargarRoles,
  };
}

function sonPermisosIguales(
  originales: PermisoDetalleDTO[],
  borrador: PermisoDetalleDTO[],
): boolean {
  if (originales.length !== borrador.length) {
    return false;
  }
  return originales.every((permisoOriginal, indice) => {
    const permisoBorrador = borrador[indice];
    if (permisoBorrador === undefined || permisoBorrador.modulo !== permisoOriginal.modulo) {
      return false;
    }
    return (
      permisoOriginal.ver === permisoBorrador.ver &&
      permisoOriginal.crear === permisoBorrador.crear &&
      permisoOriginal.editar === permisoBorrador.editar &&
      permisoOriginal.derivar === permisoBorrador.derivar &&
      permisoOriginal.archivar === permisoBorrador.archivar &&
      permisoOriginal.eliminar === permisoBorrador.eliminar &&
      permisoOriginal.exportar === permisoBorrador.exportar
    );
  });
}

export default useRbacConfig;
