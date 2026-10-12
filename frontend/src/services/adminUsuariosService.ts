// Servicio REST de administración de usuarios institucionales (ENT-M05-02 / T-FE-ADM-03)
// Sustituye el mock en memoria `usuariosIniciales` por la ruta canónica
// `GET /api/v1/usuarios` y centraliza el estado servidor con TanStack Query v5.
//
// Problema que resuelve: la vista de usuarios carecía de sincronización de caché
// entre las pantallas de administración y los selectores de usuario de las
// derivaciones. Las mutaciones se gestionan con `useMutation` e invalidación
// selectiva de `['admin', 'usuarios']`, de modo que la lista se refresca
// instantáneamente tras guardar, sin recargar la página.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { ApiHttpError, type InvalidParamDetail } from "../types/api";
import type {
  CrearUsuarioDTO,
  EstadoUsuario,
  FiltrosUsuarios,
  UpdateEstadoDTO,
  UpdateUsuarioDTO,
  Usuario,
} from "../types/usuarioAdmin";

const RUTA_CANONICA_USUARIOS = "/api/v1/admin/usuarios";

export const usuariosAdminKeys = {
  todos: ["admin", "usuarios"] as const,
  lista: (filtros: FiltrosUsuarios) => ["admin", "usuarios", filtros] as const,
  detalle: (id: string) => ["admin", "usuarios", "detalle", id] as const,
};

function toStringValue(value: unknown, porDefecto = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return porDefecto;
}

function toEstadoUsuario(value: unknown): EstadoUsuario {
  const normalizado = toStringValue(value).trim().toLowerCase();
  if (normalizado === "inactivo" || normalizado === "inactiva") return "Inactivo";
  if (normalizado === "bloqueado" || normalizado === "bloqueada") return "Bloqueado";
  return "Activo";
}

function referencia(value: unknown): { id: string | null; nombre: string } {
  if (typeof value !== "object" || value === null) return { id: null, nombre: "—" };
  const item = value as Record<string, unknown>;
  return { id: toStringValue(item.id) || null, nombre: toStringValue(item.nombre, "—") };
}

/**
 * Normaliza el elemento recibido del backend. El servidor puede serializar en
 * `camelCase` o en `snake_case` (convención de PostgreSQL / Express), por lo que
 * ambos se aceptan sin perder información.
 */
function normalizarUsuario(valor: unknown): Usuario | null {
  if (typeof valor !== "object" || valor === null) return null;
  const registro = valor as Record<string, unknown>;

  const idCrudo = registro.id ?? registro.idUsuario ?? registro.id_usuario;
  const id = toStringValue(idCrudo);
  if (!id) return null;

  const nombre = toStringValue(registro.nombre ?? registro.nombreCompleto ?? registro.nombre_completo);
  if (nombre === "") return null;

  const area = typeof registro.area === "string"
    ? { id: toStringValue(registro.areaId) || null, nombre: registro.area }
    : referencia(registro.area);
  const cargo = typeof registro.cargo === "string"
    ? { id: toStringValue(registro.cargoId) || null, nombre: registro.cargo }
    : referencia(registro.cargo);
  const rol = typeof registro.rol === "string"
    ? { id: toStringValue(registro.rolId) || null, nombre: registro.rol }
    : referencia(registro.rol);
  const roles = Array.isArray(registro.roles)
    ? registro.roles.map(referencia).filter((item): item is { id: string; nombre: string } => Boolean(item.id))
    : rol.id ? [{ id: rol.id, nombre: rol.nombre }] : [];
  return {
    id,
    idPersona: toStringValue(registro.idPersona ?? registro.id_persona),
    nombre,
    documento: toStringValue(registro.documento ?? registro.dni),
    correo: toStringValue(registro.correo ?? registro.correoInstitucional ?? registro.correo_institucional),
    areaId: area.id,
    area: area.nombre,
    cargoId: cargo.id,
    cargo: cargo.nombre,
    rolId: rol.id,
    rol: rol.nombre,
    rolIds: roles.map((item) => item.id),
    roles,
    estado: toEstadoUsuario(registro.estado),
    ultimoAcceso: toStringValue(registro.ultimoAcceso ?? registro.ultimo_acceso, "—"),
  };
}

export async function crearUsuario(datos: CrearUsuarioDTO): Promise<Usuario> {
  const response = await apiClient.post(RUTA_CANONICA_USUARIOS, datos);
  const normalizado = normalizarUsuario(response.data);
  if (!normalizado) {
    throw new ApiHttpError({
      type: "about:blank", title: "Respuesta incompleta del servidor", status: 502,
      detail: "El servidor no devolvió el usuario creado.", instance: RUTA_CANONICA_USUARIOS,
      code: "ERR_USUARIO_INVALIDO", category: "System", correlationId: "", retryable: true,
    });
  }
  return normalizado;
}

/** Extrae el arreglo de usuarios tanto de una respuesta plana como envuelta en `data`. */
function extraerUsuarios(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object" && payload !== null) {
    const envuelto = payload as Record<string, unknown>;
    if (Array.isArray(envuelto.data)) return envuelto.data;
    if (Array.isArray(envuelto.datos)) return envuelto.datos;
    if (Array.isArray(envuelto.usuarios)) return envuelto.usuarios;
    if (Array.isArray(envuelto.items)) return envuelto.items;
  }
  return [];
}

export async function listarUsuarios(
  filtros: FiltrosUsuarios,
  signal?: AbortSignal,
): Promise<Usuario[]> {
  const response = await apiClient.get(RUTA_CANONICA_USUARIOS, {
    params: {
      busqueda: filtros.busqueda || undefined,
      areaId: filtros.areaId || undefined,
      rolId: filtros.rolId || undefined,
      estado: filtros.estado === "Todos" ? undefined : filtros.estado.toUpperCase(),
    },
    signal,
  });

  return extraerUsuarios(response.data)
    .map((valor) => normalizarUsuario(valor))
    .filter((usuario): usuario is Usuario => usuario !== null);
}

export async function actualizarUsuario(
  id: string,
  cambios: UpdateUsuarioDTO,
): Promise<Usuario> {
  const response = await apiClient.put(`${RUTA_CANONICA_USUARIOS}/${id}`, cambios);
  const normalizado = normalizarUsuario(response.data);

  if (!normalizado) {
    throw new ApiHttpError({
      type: "about:blank",
      title: "Respuesta incompleta del servidor",
      status: 502,
      detail: "El servidor no devolvió el detalle del usuario actualizado.",
      instance: `${RUTA_CANONICA_USUARIOS}/${id}`,
      code: "ERR_USUARIO_INVALIDO",
      category: "System",
      correlationId: "",
      retryable: true,
    });
  }

  return normalizado;
}

export async function conmutarEstadoUsuario(
  id: string,
  cambios: UpdateEstadoDTO,
): Promise<Usuario> {
  const estadoBackend = cambios.estado.toUpperCase();
  const response = await apiClient.put(
    `${RUTA_CANONICA_USUARIOS}/${id}`,
    { estado: estadoBackend },
  );
  const normalizado = normalizarUsuario(response.data);

  if (!normalizado) {
    throw new ApiHttpError({
      type: "about:blank",
      title: "Respuesta incompleta del servidor",
      status: 502,
      detail: "El servidor no devolvió el detalle del usuario con el nuevo estado.",
      instance: `${RUTA_CANONICA_USUARIOS}/${id}`,
      code: "ERR_USUARIO_ESTADO",
      category: "System",
      correlationId: "",
      retryable: true,
    });
  }

  return normalizado;
}

export function useUsuariosQuery(
  filtros: FiltrosUsuarios,
): UseQueryResult<Usuario[], Error> {
  return useQuery({
    queryKey: usuariosAdminKeys.lista(filtros),
    queryFn: ({ signal }) => listarUsuarios(filtros, signal),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

type VariablesActualizacion = { id: string; cambios: UpdateUsuarioDTO };

export function useCrearUsuarioMutation(): UseMutationResult<Usuario, ApiHttpError, CrearUsuarioDTO> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: crearUsuario,
    onSettled: () => queryClient.invalidateQueries({ queryKey: usuariosAdminKeys.todos }),
  });
}

// El snapshot guarda cada lista por su propia clave: la tabla vive en varias
// claves (una por combinación de filtros) y revertir exige restaurarlas todas.
type ContextoActualizacion = {
  instantanea: Array<[readonly unknown[], Usuario[] | undefined]>;
};

export function useActualizarUsuarioMutation(): UseMutationResult<
  Usuario,
  ApiHttpError,
  VariablesActualizacion,
  ContextoActualizacion
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, cambios }: VariablesActualizacion) =>
      actualizarUsuario(id, cambios),
    onMutate: async () => {
      // 1. Cancelar consultas salientes para evitar sobrescrituras de la caché
      await queryClient.cancelQueries({ queryKey: usuariosAdminKeys.todos });

      // 2. Snapshot del estado previo para poder revertir
      const instantanea = queryClient.getQueriesData<Usuario[]>({
        queryKey: usuariosAdminKeys.todos,
      });

      return { instantanea };
    },
    onError: (
      _error: ApiHttpError,
      _variables: VariablesActualizacion,
      contexto: ContextoActualizacion | undefined,
    ) => {
      // 4. Reversión ante fallo: se restaura cada lista a su valor previo
      contexto?.instantanea.forEach(([clave, datos]) => {
        queryClient.setQueryData(clave, datos);
      });
    },
    onSettled: () => {
      // 5. Invalidación y refresco con el estado real del servidor
      queryClient.invalidateQueries({ queryKey: usuariosAdminKeys.todos });
    },
  });
}

export function useConmutarEstadoMutation(): UseMutationResult<
  Usuario,
  ApiHttpError,
  { id: string; estado: EstadoUsuario }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, estado }) =>
      conmutarEstadoUsuario(id, { estado }),
    onSuccess: (actualizado) => {
      queryClient.setQueryData(usuariosAdminKeys.detalle(actualizado.id), actualizado);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: usuariosAdminKeys.todos });
    },
  });
}

/**
 * Extrae los parámetros inválidos de una respuesta RFC 7807 / RFC 9457 para
 * mapearlos al campo infractor del formulario (plan maestro §3.2).
 */
export function extraerInvalidParams(error: unknown): InvalidParamDetail[] {
  if (error instanceof ApiHttpError) {
    return error.problemDetails.invalidParams ?? [];
  }
  return [];
}
