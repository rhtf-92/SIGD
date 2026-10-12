import { useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
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
  type OpcionCatalogo,
  type Usuario,
} from "../types/usuarioAdmin";

interface CatalogosUsuario { areas: OpcionCatalogo[]; cargos: OpcionCatalogo[]; roles: OpcionCatalogo[] }
const VACIOS: CatalogosUsuario = { areas: [], cargos: [], roles: [] };

function siguienteEstado(estado: EstadoUsuario): EstadoUsuario {
  return estado === "Activo" ? "Inactivo" : "Activo";
}

export function useUsuariosAdmin() {
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [areaId, setAreaId] = useState("");
  const [rolId, setRolId] = useState("");
  const [estado, setEstado] = useState<EstadoUsuario | "Todos">("Todos");
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosUsuario>(VACIOS);
  const [errorCatalogos, setErrorCatalogos] = useState<Error | null>(null);

  useEffect(() => {
    if (busqueda === busquedaAplicada) return;
    const temporizador = setTimeout(() => setBusquedaAplicada(busqueda), DEBOUNCE_BUSQUEDA_MS);
    return () => clearTimeout(temporizador);
  }, [busqueda, busquedaAplicada]);

  useEffect(() => {
    let activo = true;
    apiClient.get("/api/v1/admin/tablas-maestras", { params: { solo_activos: true } })
      .then(({ data }) => {
        if (!activo) return;
        const lista = (data as { catalogos?: Array<{ clave: string; items: OpcionCatalogo[] }> }).catalogos ?? [];
        const items = (clave: string) => lista.find((catalogo) => catalogo.clave === clave)?.items ?? [];
        setCatalogos({ areas: items("areas"), cargos: items("cargos"), roles: items("roles") });
        setErrorCatalogos(null);
      })
      .catch((error: Error) => { if (activo) setErrorCatalogos(error); });
    return () => { activo = false; };
  }, []);

  const filtros = useMemo<FiltrosUsuarios>(
    () => ({ ...FILTROS_USUARIOS_INICIALES, busqueda: busquedaAplicada, areaId, rolId, estado }),
    [busquedaAplicada, areaId, rolId, estado],
  );
  const consulta = useUsuariosQuery(filtros);
  const mutacionActualizacion = useActualizarUsuarioMutation();
  const mutacionEstado = useConmutarEstadoMutation();
  const usuarios = useMemo(() => consulta.data ?? [], [consulta.data]);

  function actualizarUsuario(usuario: Usuario) {
    if (!usuario.areaId || !usuario.cargoId || !usuario.rolId) {
      return Promise.reject(new Error("Debe seleccionar área, cargo y rol."));
    }
    return mutacionActualizacion.mutateAsync({
      id: usuario.id,
      cambios: {
        correo: usuario.correo,
        areaId: usuario.areaId,
        cargoId: usuario.cargoId,
        rolId: usuario.rolId,
        estado: usuario.estado.toUpperCase() as "ACTIVO" | "INACTIVO",
      },
    });
  }

  function conmutarEstado(id: string) {
    const usuario = usuarios.find((item) => item.id === id);
    if (!usuario) return undefined;
    return mutacionEstado.mutateAsync({ id, estado: siguienteEstado(usuario.estado) });
  }

  return {
    usuarios, totalUsuarios: usuarios.length,
    busqueda, setBusqueda, areaId, setAreaId, rolId, setRolId, estado, setEstado,
    usuarioEditando, setUsuarioEditando, actualizarUsuario, conmutarEstado,
    catalogos,
    isLoading: consulta.isLoading, isFetching: consulta.isFetching,
    error: consulta.error ?? errorCatalogos,
    guardarPendiente: mutacionActualizacion.isPending,
    estadoPendiente: mutacionEstado.isPending,
  };
}
