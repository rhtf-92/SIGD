// Hook de administración del Directorio de Usuarios (ENT-M05-02 / T-FE-ADM-01 / H-05)
// Desacoplado del mock: consulta /api/v1/admin/usuarios con areaId y rolId canónicos (UUID),
// y carga dinámicamente los catálogos reales de roles y áreas del servidor.
import { useEffect, useMemo, useState } from "react";

import {
  useActualizarUsuarioMutation,
  useConmutarEstadoMutation,
  useOrganigramaAreasQuery,
  useRolesPermisosQuery,
  useUsuariosQuery,
  type AreaCatalogo,
  type RolCatalogo,
} from "../services/adminUsuariosService";
import {
  DEBOUNCE_BUSQUEDA_MS,
  FILTROS_USUARIOS_INICIALES,
  type EstadoUsuario,
  type FiltrosUsuarios,
  type Usuario,
} from "../types/usuarioAdmin";

function siguienteEstado(estado: EstadoUsuario): EstadoUsuario {
  if (estado === "Activo") return "Inactivo";
  if (estado === "Inactivo") return "Bloqueado";
  return "Activo";
}

export function useUsuariosAdmin() {
  const [busqueda, setBusqueda] = useState(FILTROS_USUARIOS_INICIALES.busqueda);
  const [busquedaAplicada, setBusquedaAplicada] = useState(
    FILTROS_USUARIOS_INICIALES.busqueda,
  );
  const [areaId, setAreaId] = useState<string | undefined>(FILTROS_USUARIOS_INICIALES.areaId);
  const [rolId, setRolId] = useState<string | undefined>(FILTROS_USUARIOS_INICIALES.rolId);
  const [estado, setEstado] = useState<EstadoUsuario | "Todos">(
    FILTROS_USUARIOS_INICIALES.estado,
  );
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);

  // Consultas a catálogos relacionales canónicos
  const rolesQuery = useRolesPermisosQuery();
  const areasQuery = useOrganigramaAreasQuery();

  const roles = useMemo<RolCatalogo[]>(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const areas = useMemo<AreaCatalogo[]>(() => areasQuery.data ?? [], [areasQuery.data]);

  // Debounce de 300 ms: el texto tecleado no dispara peticiones hasta 300 ms
  // después de la última pulsación, reduciendo el tráfico hacia el backend.
  useEffect(() => {
    if (busqueda === busquedaAplicada) return;
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busqueda);
    }, DEBOUNCE_BUSQUEDA_MS);

    return () => clearTimeout(temporizador);
  }, [busqueda, busquedaAplicada]);

  const filtros = useMemo<FiltrosUsuarios>(
    () => ({ busqueda: busquedaAplicada, areaId, rolId, estado }),
    [busquedaAplicada, areaId, rolId, estado],
  );

  const consulta = useUsuariosQuery(filtros);
  const mutacionActualizacion = useActualizarUsuarioMutation();
  const mutacionEstado = useConmutarEstadoMutation();

  const usuarios = useMemo(() => consulta.data ?? [], [consulta.data]);

  function actualizarUsuario(usuarioActualizado: Usuario) {
    return mutacionActualizacion.mutateAsync({
      id: usuarioActualizado.id,
      cambios: {
        area: usuarioActualizado.area,
        sede: usuarioActualizado.sede,
        cargo: usuarioActualizado.cargo,
        rol: usuarioActualizado.rol,
      },
    });
  }

  function conmutarEstado(id: string | number) {
    const usuario = usuarios.find((item) => String(item.id) === String(id));
    if (!usuario) return undefined;

    return mutacionEstado.mutateAsync({
      id,
      estado: siguienteEstado(usuario.estado),
    });
  }

  return {
    usuarios,
    totalUsuarios: usuarios.length,
    busqueda,
    setBusqueda,
    areaId,
    setAreaId,
    area: areaId ?? "",
    setArea: (v: string) => setAreaId(v || undefined),
    rolId,
    setRolId,
    rol: rolId ?? "",
    setRol: (v: string) => setRolId(v || undefined),
    sede: "",
    setSede: (_: string) => {},
    estado,
    setEstado,
    roles,
    areas,
    isLoadingRoles: rolesQuery.isLoading,
    isLoadingAreas: areasQuery.isLoading,
    usuarioEditando,
    setUsuarioEditando,
    actualizarUsuario,
    conmutarEstado,
    isLoading: consulta.isLoading,
    isFetching: consulta.isFetching,
    error: consulta.error,
    guardarPendiente: mutacionActualizacion.isPending,
    estadoPendiente: mutacionEstado.isPending,
  };
}
