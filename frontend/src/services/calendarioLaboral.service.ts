/**
 * Capa de servicio del calendario laboral oficial (T-BE-OC-13 / T-BE-OC-14).
 *
 * Reutiliza el cliente HTTP único del proyecto (`src/api/client.ts`), que ya
 * inyecta `X-Correlation-ID` y `Authorization` y normaliza los errores a
 * `ApiHttpError` (RFC 7807). No se crea cliente nuevo ni canal nuevo.
 *
 * Rutas relativas al `baseURL`, que ya termina en `/api` (ver `src/config/env.ts`):
 * usar `"/v1/..."` evita el `"/api/api/v1/..."` que arrastran otros hooks del repo.
 */

import { apiClient } from "../api/client";
import type {
  ConsultaCalendario,
  FeriadoExcepcionalInput,
  FeriadoRegistrado,
  VistaCalendario,
} from "../types/calendarioLaboral";

export const CALENDARIO_ENDPOINTS = {
  /** GET /api/v1/admin/calendario-laboral — calendario oficial por año o rango. */
  LISTAR: "/v1/admin/calendario-laboral",
  /** POST /api/v1/admin/calendario-laboral/feriado-excepcional — alta de excepción. */
  REGISTRAR_FERIADO: "/v1/admin/calendario-laboral/feriado-excepcional",
} as const;

/**
 * Consulta el calendario laboral oficial.
 *
 * @param filtros `anio` o el rango `desde`/`hasta` (ambos `YYYY-MM-DD`).
 */
export async function obtenerCalendarioLaboral(
  filtros: ConsultaCalendario = {},
): Promise<VistaCalendario> {
  const { data } = await apiClient.get<VistaCalendario>(CALENDARIO_ENDPOINTS.LISTAR, {
    params: filtros,
  });
  return data;
}

/**
 * Da de alta un feriado o habilitación excepcional.
 *
 * El backend escribe la fila, el asiento en la bitácora WORM y el evento del
 * outbox en una sola transacción, e invalida su caché antes de responder. El
 * llamador debe invalidar la query del calendario para que los semáforos SLA
 * se recalculen (ver `useCalendarioOficial`).
 */
export async function registrarFeriadoExcepcional(
  entrada: FeriadoExcepcionalInput,
): Promise<FeriadoRegistrado> {
  const { data } = await apiClient.post<FeriadoRegistrado>(
    CALENDARIO_ENDPOINTS.REGISTRAR_FERIADO,
    entrada,
  );
  return data;
}
