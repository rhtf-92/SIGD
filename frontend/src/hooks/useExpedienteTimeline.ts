import { useQuery } from "@tanstack/react-query";
import { rutaDoc } from "../pages/expedientes/rutadoc/rutadoc.service";

export function useExpedienteTimeline(id: string | undefined) {
  return useQuery({ queryKey: ["rutadoc", id, "trazabilidad"],
    queryFn: ({ signal }) => rutaDoc.trazabilidad(id!, signal), enabled: Boolean(id), retry: false });
}
