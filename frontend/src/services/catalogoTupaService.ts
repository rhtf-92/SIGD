import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { CatalogoTupa, CatalogoTupaInput, VersionCatalogoInput } from "../types/catalogoTupa";

const ruta = "/api/v1/admin/catalogo-tupa";
export const catalogoTupaKeys = { all: ["admin", "catalogo-tupa"] as const };

function registros(data: unknown): CatalogoTupa[] {
  if (typeof data !== "object" || data === null) return [];
  const value = data as { registros?: CatalogoTupa[] };
  return Array.isArray(value.registros) ? value.registros : [];
}

export async function listarCatalogoTupa(signal?: AbortSignal): Promise<CatalogoTupa[]> {
  return registros((await apiClient.get(ruta, { signal })).data);
}

export function useCatalogoTupa() {
  return useQuery({ queryKey: catalogoTupaKeys.all, queryFn: ({ signal }) => listarCatalogoTupa(signal) });
}

export function useCrearCatalogoTupa() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: CatalogoTupaInput) => apiClient.post(ruta, input), onSuccess: () => client.invalidateQueries({ queryKey: catalogoTupaKeys.all }) });
}

export function useEditarCatalogoTupa() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Omit<CatalogoTupaInput, "codigo" | "tipo_catalogo"> }) => apiClient.patch(`${ruta}/${id}`, input), onSuccess: () => client.invalidateQueries({ queryKey: catalogoTupaKeys.all }) });
}

export function useCrearVersionCatalogoTupa() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: VersionCatalogoInput }) => apiClient.post(`${ruta}/${id}/versiones`, input), onSuccess: () => client.invalidateQueries({ queryKey: catalogoTupaKeys.all }) });
}

export function useCambiarEstadoCatalogoTupa() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, vigente, motivo }: { id: string; vigente: boolean; motivo: string }) => apiClient.patch(`${ruta}/${id}/estado`, { vigente, motivo }), onSuccess: () => client.invalidateQueries({ queryKey: catalogoTupaKeys.all }) });
}
