// Hook de administración del Directorio de Usuarios (ENT-M05-02 / T-FE-ADM-01)
// Desacoplado del mock `usuariosIniciales`: delega la carga en
// `adminUsuariosService` (TanStack Query) y aplica debounce de 300 ms al
// buscador para evitar peticiones redundantes al servidor.
import { useEffect, useMemo, useState } from "react";

import {
  useActualizarUsuarioMutation,
  useConmutarEstadoMutation,
  useUsuariosQuery,
} from "../services/adminUsuariosService";
import {
  DEBOUNCE_BUSQUEDA_MS,
  FILTROS_USUARIOS_INICIALES,
  type EstadoUsuario,
  type FiltrosUsuarios,
  type Usuario,
} from "../types/usuarioAdmin";

export const CATALOGO_ROLES_USUARIOS = [
  "Administrador",
  "Responsable de Área",
  "Operador",
  "Consulta",
];

export const CATALOGO_AREAS = [
  "Dirección General",
  "Secretaría Académica",
  "Mesa de Partes",
  "Administración",
  "Archivo Central",
  "Coordinación DSI",
];

export const CATALOGO_SEDES = ["Sede Principal"];

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
  const [area, setArea] = useState(FILTROS_USUARIOS_INICIALES.area);
  const [sede, setSede] = useState(FILTROS_USUARIOS_INICIALES.sede);
  const [rol, setRol] = useState(FILTROS_USUARIOS_INICIALES.rol);
  const [estado, setEstado] = useState<EstadoUsuario | "Todos">(
    FILTROS_USUARIOS_INICIALES.estado,
  );
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);

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
    () => ({ busqueda: busquedaAplicada, area, sede, rol, estado }),
    [busquedaAplicada, area, sede, rol, estado],
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

  function conmutarEstado(id: number) {
    const usuario = usuarios.find((item) => item.id === id);
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
    area,
    setArea,
    sede,
    setSede,
    rol,
    setRol,
    estado,
    setEstado,
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
