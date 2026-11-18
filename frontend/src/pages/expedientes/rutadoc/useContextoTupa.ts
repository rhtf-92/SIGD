import { useQuery } from "@tanstack/react-query";

import { obtenerContextoTupa } from "./tupa.service";

/** Consulta de solo lectura del contexto TUPA del expediente. */
export function useContextoTupa(expedienteId: string | undefined) {
  return useQuery({
    queryKey: ["tramicore", expedienteId, "tupa"],
    queryFn: ({ signal }) => obtenerContextoTupa(expedienteId!, signal),
    enabled: Boolean(expedienteId),
    retry: false,
  });
}
