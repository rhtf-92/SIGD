import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../api/client";
import { ApiHttpError, type InvalidParamDetail } from "../types/api";
import { useAuthStore } from "../stores/authStore";
import type { CrearUsuarioDTO, FiltrosUsuarios, UpdateEstadoDTO, UpdateUsuarioDTO, Usuario, DirectorioUsuarios } from "../types/usuarioAdmin";

const RUTA_CANONICA_USUARIOS = "/api/v1/admin/usuarios";
export const usuariosAdminKeys = {
  todos: ["admin", "usuarios"] as const,
  lista: (filtros: FiltrosUsuarios, cuenta: string | null) => ["admin", "usuarios", cuenta, filtros] as const,
  detalle: (id: string) => ["admin", "usuarios", "detalle", id] as const,
};
const uuidPg = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Identificador UUID no válido"
);
const opcion = z.object({ id: uuidPg, nombre: z.string() });
// El identificador de tipos_documento es SMALLINT/INTEGER en PostgreSQL,
// no UUID como las áreas, cargos y roles.
const tipoDocumentoOpcion = z.object({ id: z.string().min(1), nombre: z.string(), codigo: z.string() });
const usuarioSchema = z.object({
  id: uuidPg, nombre: z.string().min(1),
  nombres: z.string().nullable().transform(v => v ?? ""),
  apellidos: z.string().nullable().transform(v => v ?? ""),
  tipoPersona: z.enum(["NATURAL", "JURIDICA"]),
  dni: z.string(), correo: z.string(),
  sede: z.string().nullable().transform(v => v ?? ""),
  area: z.string().nullable().transform(v => v ?? ""),
  cargo: z.string().nullable().transform(v => v ?? ""),
  rol: z.string().nullable().transform(v => v ?? ""),
  estado: z.enum(["ACTIVO", "INACTIVO"]).transform(v => v === "ACTIVO" ? "Activo" as const : "Inactivo" as const),
  ultimoAcceso: z.string().nullable().transform(v => v ?? ""),
  asignaciones: z.array(z.object({ id: uuidPg, cargoId: uuidPg, areaId: uuidPg, cargo: z.string(), area: z.string() })),
  roles: z.array(z.object({
    id: uuidPg,
    rolId: uuidPg,
    areaId: uuidPg.nullable(),
    nombre: z.string(),
    codigo: z.string().optional(),
    ambito: z.enum(["GLOBAL", "AREA"]).optional(),
    vigenteDesde: z.string().optional(),
    vigenteHasta: z.string().nullable().optional(),
    activo: z.boolean().optional(),
  })), username: z.string().optional().nullable().transform(v => v ?? undefined),
});
const directorioSchema = z.object({
  datos: z.array(usuarioSchema),
  paginacion: z.object({ pagina: z.number().int().positive(), limite: z.number().int().positive(),
    total: z.number().int().nonnegative(), totalPaginas: z.number().int().nonnegative() }),
  catalogos: z.object({ areas: z.array(opcion), cargos: z.array(opcion), roles: z.array(opcion), tiposDocumento: z.array(tipoDocumentoOpcion) }),
});
function respuestaInvalida(): ApiHttpError {
  return new ApiHttpError({ type: "about:blank", title: "Respuesta incompleta del servidor", status: 502,
    detail: "El servidor no devolvió el contrato del directorio institucional.",
    instance: RUTA_CANONICA_USUARIOS, code: "ERR_USUARIO_INVALIDO", category: "System", correlationId: "", retryable: false });
}
export async function listarUsuarios(filtros: FiltrosUsuarios, signal?: AbortSignal): Promise<DirectorioUsuarios> {
  const response = await apiClient.get(RUTA_CANONICA_USUARIOS, {
    params: { busqueda: filtros.busqueda || undefined, areaId: filtros.area || undefined,
      sedeId: filtros.sede || undefined, rolId: filtros.rol || undefined,
      estado: filtros.estado === "Todos" ? undefined : filtros.estado.toUpperCase(),
      pagina: filtros.pagina ?? 1, limite: filtros.limite ?? 20 }, signal,
  });
  const parsed = directorioSchema.safeParse(response.data);
  if (!parsed.success) throw respuestaInvalida();
  return parsed.data;
}
export async function consultarUsuario(id: string): Promise<Usuario> {
  uuidPg.parse(id);
  const response = await apiClient.get(RUTA_CANONICA_USUARIOS + "/" + id);
  const parsed = usuarioSchema.safeParse(response.data);
  if (!parsed.success || parsed.data.id !== id) throw respuestaInvalida();
  return parsed.data;
}
export async function crearUsuario(cambios: CrearUsuarioDTO): Promise<Usuario> {
  const response = await apiClient.post(RUTA_CANONICA_USUARIOS, cambios);
  const parsed = usuarioSchema.safeParse(response.data);
  if (!parsed.success) throw respuestaInvalida();
  return parsed.data;
}
export async function restablecerCredencialesUsuario(id: string, passwordInicial: string): Promise<void> {
  uuidPg.parse(id);
  await apiClient.post(RUTA_CANONICA_USUARIOS + "/" + id + "/restablecer-credenciales", { passwordInicial });
}
export async function actualizarUsuario(id: string, cambios: UpdateUsuarioDTO): Promise<Usuario> {
  uuidPg.parse(id);
  const response = await apiClient.put(RUTA_CANONICA_USUARIOS + "/" + id, cambios);
  const parsed = usuarioSchema.safeParse(response.data);
  if (!parsed.success || parsed.data.id !== id) throw respuestaInvalida();
  return parsed.data;
}
export async function conmutarEstadoUsuario(id: string, cambios: UpdateEstadoDTO): Promise<Usuario> {
  if (cambios.estado === "Bloqueado") throw new Error("El modelo original no dispone de un estado de bloqueo independiente.");
  return actualizarUsuario(id, { estado: cambios.estado === "Activo" ? "ACTIVO" : "INACTIVO" });
}
export function useUsuariosQuery(filtros: FiltrosUsuarios) {
  const cuenta = useAuthStore(s => s.usuario?.id ?? null);
  return useQuery({ queryKey: usuariosAdminKeys.lista(filtros, cuenta),
    queryFn: ({ signal }) => listarUsuarios(filtros, signal), staleTime: 30_000,
    retry: (fallos, error) => !(error instanceof ApiHttpError && (error.status < 500 || !error.problemDetails.retryable)) && fallos < 1,
    refetchOnWindowFocus: false });
}
export function useActualizarUsuarioMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: UpdateUsuarioDTO }) => actualizarUsuario(id, cambios),
    onSuccess: actualizado => { queryClient.setQueryData(usuariosAdminKeys.detalle(actualizado.id), actualizado); },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: usuariosAdminKeys.todos }); },
  });
}
export function useCrearUsuarioMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: crearUsuario,
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: usuariosAdminKeys.todos }); } });
}
export function useRestablecerCredencialesMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, passwordInicial }: { id: string; passwordInicial: string }) => restablecerCredencialesUsuario(id, passwordInicial),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: usuariosAdminKeys.todos }); } });
}

export async function asignarRolUsuario(id: string, rolId: string): Promise<Usuario> {
  uuidPg.parse(id);
  uuidPg.parse(rolId);
  const response = await apiClient.post(`${RUTA_CANONICA_USUARIOS}/${id}/roles`, { rolId });
  const parsed = usuarioSchema.safeParse(response.data);
  if (!parsed.success) throw respuestaInvalida();
  return parsed.data;
}

export async function revocarRolUsuario(id: string, usuarioRolId: string): Promise<Usuario> {
  uuidPg.parse(id);
  uuidPg.parse(usuarioRolId);
  const response = await apiClient.delete(`${RUTA_CANONICA_USUARIOS}/${id}/roles/${usuarioRolId}`);
  const parsed = usuarioSchema.safeParse(response.data);
  if (!parsed.success) throw respuestaInvalida();
  return parsed.data;
}

export function useAsignarRolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rolId }: { id: string; rolId: string }) => asignarRolUsuario(id, rolId),
    onSuccess: actualizado => { queryClient.setQueryData(usuariosAdminKeys.detalle(actualizado.id), actualizado); },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: usuariosAdminKeys.todos }); },
  });
}

export function useRevocarRolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, usuarioRolId }: { id: string; usuarioRolId: string }) => revocarRolUsuario(id, usuarioRolId),
    onSuccess: actualizado => { queryClient.setQueryData(usuariosAdminKeys.detalle(actualizado.id), actualizado); },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: usuariosAdminKeys.todos }); },
  });
}

export function useConmutarEstadoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: UpdateEstadoDTO["estado"] }) => conmutarEstadoUsuario(id, { estado }),
    onSuccess: actualizado => { queryClient.setQueryData(usuariosAdminKeys.detalle(actualizado.id), actualizado); },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: usuariosAdminKeys.todos }); },
  });
}
export function extraerInvalidParams(error: unknown): InvalidParamDetail[] {
  return error instanceof ApiHttpError ? error.problemDetails.invalidParams ?? [] : [];
}
