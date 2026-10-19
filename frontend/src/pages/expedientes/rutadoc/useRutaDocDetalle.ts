import { useQuery } from "@tanstack/react-query";
import { rutaDoc } from "./rutadoc.service";

export function useRutaDocDetalle(id: string | undefined) {
  const detalle = useQuery({ queryKey: ["rutadoc", id, "detalle"],
    queryFn: ({ signal }) => rutaDoc.detalle(id!, signal), enabled: Boolean(id), retry: false });
  const foliacion = useQuery({ queryKey: ["rutadoc", id, "foliacion"],
    queryFn: ({ signal }) => rutaDoc.foliacion(id!, signal), enabled: Boolean(id), retry: false });
  const sla = useQuery({ queryKey: ["rutadoc", id, "sla"],
    queryFn: ({ signal }) => rutaDoc.sla(id!, signal), enabled: Boolean(id), retry: false });
  return { detalle, foliacion, sla };
}
