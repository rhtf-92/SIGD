// Servicio del directorio de administración (usuarios, roles y permisos).
// Habla con /api/v1/administracion/*, que exige sesión con rol ADMINISTRADOR.
import { apiClient } from "../api/client";

const BASE = "/api/v1/administracion";

export interface UsuarioDirectorio {
  idUsuario: string;
  usuario: string;
  correo: string;
  activo: boolean;
  ultimoAcceso: string | null;
  creadoEn: string | null;
  documento: string | null;
  nombres: string | null;
  apellidos: string | null;
  nombreCompleto: string | null;
  celular: string | null;
  rolId: string | null;
  rolCodigo: string | null;
  rolNombre: string | null;
}

export interface ListaUsuariosDirectorio {
  items: UsuarioDirectorio[];
  total: number;
  pagina: number;
  limite: number;
}

export interface RolDirectorio {
  rolId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  vigente: boolean;
  totalPermisos?: number;
}

export interface PermisoDirectorio {
  permisoId: string;
  codigo: string;
  nombre: string;
  ambito: string;
}

export interface FiltrosDirectorio {
  busqueda: string;
  estado: "" | "activo" | "inactivo";
  rolId: string;
  pagina: number;
  limite: number;
}

export interface NuevoUsuarioDirectorio {
  usuario: string;
  correo: string;
  password: string;
  nombres: string;
  apellidos: string;
  dni: string;
  celular?: string;
  rolId?: string;
}

export interface CambiosUsuarioDirectorio {
  correo?: string;
  nombres?: string;
  apellidos?: string;
  celular?: string;
  rolId?: string;
  activo?: boolean;
}

export interface CambiosRolDirectorio {
  nombre?: string;
  descripcion?: string;
  vigente?: boolean;
}

export async function listarUsuariosDirectorio(
  filtros: FiltrosDirectorio,
): Promise<ListaUsuariosDirectorio> {
  const params: Record<string, string | number> = {
    pagina: filtros.pagina,
    limite: filtros.limite,
  };
  if (filtros.busqueda) params.busqueda = filtros.busqueda;
  if (filtros.estado) params.estado = filtros.estado;
  if (filtros.rolId) params.rolId = filtros.rolId;
  const { data } = await apiClient.get<ListaUsuariosDirectorio>(`${BASE}/usuarios`, { params });
  return data;
}

export async function crearUsuarioDirectorio(
  cuerpo: NuevoUsuarioDirectorio,
): Promise<UsuarioDirectorio> {
  const { data } = await apiClient.post<UsuarioDirectorio>(`${BASE}/usuarios`, cuerpo);
  return data;
}

export async function actualizarUsuarioDirectorio(
  idUsuario: string,
  cambios: CambiosUsuarioDirectorio,
): Promise<UsuarioDirectorio> {
  const { data } = await apiClient.put<UsuarioDirectorio>(`${BASE}/usuarios/${idUsuario}`, cambios);
  return data;
}

export async function listarRolesDirectorio(): Promise<RolDirectorio[]> {
  const { data } = await apiClient.get<{ items: RolDirectorio[] }>(`${BASE}/roles`);
  return data.items;
}

export async function actualizarRolDirectorio(
  rolId: string,
  cambios: CambiosRolDirectorio,
): Promise<RolDirectorio> {
  const { data } = await apiClient.put<RolDirectorio>(`${BASE}/roles/${rolId}`, cambios);
  return data;
}

export async function listarPermisosDirectorio(): Promise<PermisoDirectorio[]> {
  const { data } = await apiClient.get<{ items: PermisoDirectorio[] }>(`${BASE}/permisos`);
  return data.items;
}

export async function obtenerPermisosDeRol(rolId: string): Promise<string[]> {
  const { data } = await apiClient.get<{ rolId: string; permisoIds: string[] }>(
    `${BASE}/roles/${rolId}/permisos`,
  );
  return data.permisoIds;
}

export async function guardarPermisosDeRol(rolId: string, permisoIds: string[]): Promise<string[]> {
  const { data } = await apiClient.put<{ rolId: string; permisoIds: string[] }>(
    `${BASE}/roles/${rolId}/permisos`,
    { permisoIds },
  );
  return data.permisoIds;
}

export function mensajeDeError(error: unknown): string {
  const e = error as {
    response?: { data?: { error?: { mensaje?: string } } };
    problemDetails?: { detail?: string; title?: string };
    message?: string;
  } | null;
  return (
    e?.response?.data?.error?.mensaje ??
    e?.problemDetails?.detail ??
    e?.problemDetails?.title ??
    e?.message ??
    "No se pudo completar la operación."
  );
}