import { useQuery } from "@tanstack/react-query";
import { rutaDoc } from "../pages/expedientes/rutadoc/rutadoc.service";
import type { Filtros } from "../pages/expedientes/rutadoc/rutadoc.dto";

export function useBandejaExpedientes(filtros: Filtros) {
  return useQuery({ queryKey: ["rutadoc", "bandeja", filtros],
    queryFn: ({ signal }) => rutaDoc.bandeja(filtros, signal), retry: false });
}
