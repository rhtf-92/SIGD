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
  detalle: (id: number) => ["admin", "usuarios", "detalle", id] as const,
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

/**
 * Normaliza el elemento recibido del backend. El servidor puede serializar en
 * `camelCase` o en `snake_case` (convención de PostgreSQL / Express), por lo que
 * ambos se aceptan sin perder información.
 */
function normalizarUsuario(valor: unknown): Usuario | null {
  if (typeof valor !== "object" || valor === null) return null;
  const registro = valor as Record<string, unknown>;

  const idCrudo = registro.id ?? registro.idUsuario ?? registro.id_usuario;
  const id = typeof idCrudo === "number" ? idCrudo : Number(idCrudo);
  if (!Number.isFinite(id)) return null;

  const nombre = toStringValue(registro.nombre ?? registro.nombreCompleto ?? registro.nombre_completo);
  if (nombre === "") return null;

  return {
    id,
    nombre,
    dni: toStringValue(registro.dni),
    correo: toStringValue(registro.correo ?? registro.correoInstitucional ?? registro.correo_institucional),
    sede: toStringValue(registro.sede),
    area: toStringValue(registro.area ?? registro.areaOrganica ?? registro.area_organica),
    cargo: toStringValue(registro.cargo),
    rol: toStringValue(registro.rol),
    estado: toEstadoUsuario(registro.estado),
    ultimoAcceso: toStringValue(registro.ultimoAcceso ?? registro.ultimo_acceso, "—"),
  };
}

/** Extrae el arreglo de usuarios tanto de una respuesta plana como envuelta en `data`. */
function extraerUsuarios(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object" && payload !== null) {
    const envuelto = payload as Record<string, unknown>;
    if (Array.isArray(envuelto.data)) return envuelto.data;
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
      area: filtros.area || undefined,
      sede: filtros.sede || undefined,
      rol: filtros.rol || undefined,
      estado: filtros.estado === "Todos" ? undefined : filtros.estado,
    },
    signal,
  });

  return extraerUsuarios(response.data)
    .map((valor) => normalizarUsuario(valor))
    .filter((usuario): usuario is Usuario => usuario !== null);
}

export async function actualizarUsuario(
  id: number,
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
  id: number,
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

type VariablesActualizacion = { id: number; cambios: UpdateUsuarioDTO };

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
    onMutate: async ({ id, cambios }: VariablesActualizacion) => {
      // 1. Cancelar consultas salientes para evitar sobrescrituras de la caché
      await queryClient.cancelQueries({ queryKey: usuariosAdminKeys.todos });

      // 2. Snapshot del estado previo para poder revertir
      const instantanea = queryClient.getQueriesData<Usuario[]>({
        queryKey: usuariosAdminKeys.todos,
      });

      // 3. Actualización optimista de la caché con los cambios aún no confirmados
      queryClient.setQueriesData<Usuario[]>(
        { queryKey: usuariosAdminKeys.todos },
        (actuales) =>
          actuales?.map((usuario) =>
            usuario.id === id ? { ...usuario, ...cambios } : usuario,
          ),
      );

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
  { id: number; estado: EstadoUsuario }
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
