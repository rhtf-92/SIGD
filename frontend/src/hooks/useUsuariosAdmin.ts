import { useEffect, useMemo, useState } from "react";
import {
  consultarUsuario,
  useActualizarUsuarioMutation,
  useConmutarEstadoMutation,
  useCrearUsuarioMutation,
  useRestablecerCredencialesMutation,
  useUsuariosQuery,
  useAsignarRolMutation,
  useRevocarRolMutation,
} from "../services/adminUsuariosService";
import { useAuthStore } from "../stores/authStore";
import {
  DEBOUNCE_BUSQUEDA_MS,
  FILTROS_USUARIOS_INICIALES,
  type EstadoUsuario,
  type FiltrosUsuarios,
  type Usuario,
  type UpdateUsuarioDTO,
} from "../types/usuarioAdmin";

export function useUsuariosAdmin() {
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [area, cambiarArea] = useState("");
  const [sede, cambiarSede] = useState("");
  const [rol, cambiarRol] = useState("");
  const [estado, cambiarEstado] = useState<EstadoUsuario | "Todos">("Todos");
  const [pagina, setPagina] = useState(1);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const cuenta = useAuthStore(s => s.usuario?.id ?? null);
  useEffect(() => { setUsuarioEditando(null); }, [cuenta]);
  useEffect(() => {
    if (busqueda === busquedaAplicada) return;
    const temporizador = setTimeout(() => { setBusquedaAplicada(busqueda); setPagina(1); }, DEBOUNCE_BUSQUEDA_MS);
    return () => clearTimeout(temporizador);
  }, [busqueda, busquedaAplicada]);
  const filtros = useMemo<FiltrosUsuarios>(() => ({ ...FILTROS_USUARIOS_INICIALES,
    busqueda: busquedaAplicada, area, sede, rol, estado, pagina }), [busquedaAplicada, area, sede, rol, estado, pagina]);
  const consulta = useUsuariosQuery(filtros);
  useEffect(() => { if (consulta.isError) setUsuarioEditando(null); }, [consulta.isError]);
  const mutacionActualizacion = useActualizarUsuarioMutation();
  const mutacionCreacion = useCrearUsuarioMutation();
  const mutacionCredenciales = useRestablecerCredencialesMutation();
  const mutacionEstado = useConmutarEstadoMutation();
  const mutacionAsignarRol = useAsignarRolMutation();
  const mutacionRevocarRol = useRevocarRolMutation();

  const usuarios = consulta.isError ? [] : consulta.data?.datos ?? [];
  async function conmutarEstado(id: string) {
    const usuario = usuarios.find(item => item.id === id);
    if (!usuario) throw new Error("El usuario seleccionado ya no está disponible.");
    return mutacionEstado.mutateAsync({ id, estado: usuario.estado === "Activo" ? "Inactivo" : "Activo" });
  }

  return {
    usuarios, totalUsuarios: consulta.isError ? 0 : consulta.data?.paginacion.total ?? 0,
    paginacion: consulta.isError ? undefined : consulta.data?.paginacion, pagina, setPagina,
    catalogos: (!consulta.isError && consulta.data?.catalogos) || { areas: [], cargos: [], roles: [], tiposDocumento: [] },
    busqueda, setBusqueda, area, setArea: (v: string) => { cambiarArea(v); setPagina(1); },
    sede, setSede: (v: string) => { cambiarSede(v); setPagina(1); },
    rol, setRol: (v: string) => { cambiarRol(v); setPagina(1); },
    estado, setEstado: (v: EstadoUsuario | "Todos") => { cambiarEstado(v); setPagina(1); },
    usuarioEditando, setUsuarioEditando,
    actualizarUsuario: (id: string, cambios: UpdateUsuarioDTO) => mutacionActualizacion.mutateAsync({ id, cambios }),
    crearUsuario: (cambios: Parameters<typeof mutacionCreacion.mutateAsync>[0]) => mutacionCreacion.mutateAsync(cambios),
    restablecerCredenciales: (id: string, passwordInicial: string) => mutacionCredenciales.mutateAsync({ id, passwordInicial }),
    asignarRol: (id: string, rolId: string) => mutacionAsignarRol.mutateAsync({ id, rolId }),
    revocarRol: (id: string, usuarioRolId: string) => mutacionRevocarRol.mutateAsync({ id, usuarioRolId }),
    consultarUsuario,
    conmutarEstado, isLoading: consulta.isLoading, isFetching: consulta.isFetching, error: consulta.error,
    guardarPendiente: mutacionActualizacion.isPending, crearPendiente: mutacionCreacion.isPending,
    credencialesPendiente: mutacionCredenciales.isPending, estadoPendiente: mutacionEstado.isPending,
    asignarRolPendiente: mutacionAsignarRol.isPending, revocarRolPendiente: mutacionRevocarRol.isPending,
  };
}
