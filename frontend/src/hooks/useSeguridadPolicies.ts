import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";

export interface CuentaBloqueada {
  id: string; usuario: string; correo: string; motivo: string; fecha: string;
}
export interface IntentoAcceso {
  id: string; fecha: string; usuario: string; ip: string; resultado: "Correcto" | "Fallido" | "Bloqueado";
}
export interface PoliticasSeguridad {
  maxIntentosFallidos: number; minutosBloqueo: number; minutosSesion: number;
}
export const MAX_INTENTOS_DEFECTO = 5;
export const MINUTOS_BLOQUEO_DEFECTO = 30;
export const MINUTOS_SESION_DEFECTO = 30;

interface PoliticasDto { max_intentos_fallidos: number; minutos_bloqueo: number; minutos_sesion: number }
interface BloqueoDto { id_usuario: string; nombre_completo: string; correo: string; intentos_fallidos: number; bloqueado_hasta: string }
interface IntentoDto { id_auditoria: string; fecha_hora: string; ip_origen?: string | null; datos_despues: Record<string, unknown> }

function formatoFecha(valor: string): string {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleString("es-PE");
}

export function useSeguridadPolicies() {
  const queryClient = useQueryClient();
  const [borrador, setBorrador] = useState<Partial<PoliticasDto>>({});
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const politicasQuery = useQuery({
    queryKey: ["admin-security-policies"],
    queryFn: async () => (await apiClient.get<{ politicas: PoliticasDto }>("/api/v1/admin/seguridad/politicas")).data.politicas,
  });
  const blockedQuery = useQuery({
    queryKey: ["admin-blocked-accounts"],
    queryFn: async () => (await apiClient.get<{ cuentas: BloqueoDto[] }>("/api/v1/admin/seguridad/cuentas-bloqueadas")).data.cuentas,
  });
  const attemptsQuery = useQuery({
    queryKey: ["admin-access-attempts"],
    queryFn: async () => (await apiClient.get<{ intentos: IntentoDto[] }>("/api/v1/admin/seguridad/intentos", { params: { limite: 50, offset: 0 } })).data.intentos,
  });

  const maxIntentos = borrador.max_intentos_fallidos ?? politicasQuery.data?.max_intentos_fallidos ?? MAX_INTENTOS_DEFECTO;
  const minutosBloqueo = borrador.minutos_bloqueo ?? politicasQuery.data?.minutos_bloqueo ?? MINUTOS_BLOQUEO_DEFECTO;
  const minutosSesion = borrador.minutos_sesion ?? politicasQuery.data?.minutos_sesion ?? MINUTOS_SESION_DEFECTO;
  const setMaxIntentos = (value: number) => setBorrador((actual) => ({ ...actual, max_intentos_fallidos: value }));
  const setMinutosBloqueo = (value: number) => setBorrador((actual) => ({ ...actual, minutos_bloqueo: value }));
  const setMinutosSesion = (value: number) => setBorrador((actual) => ({ ...actual, minutos_sesion: value }));

  const cuentasBloqueadas: CuentaBloqueada[] = (blockedQuery.data ?? []).map((row) => ({
    id: row.id_usuario, usuario: row.nombre_completo, correo: row.correo,
    motivo: `${row.intentos_fallidos} intentos fallidos`, fecha: formatoFecha(row.bloqueado_hasta),
  }));
  const intentosIniciales: IntentoAcceso[] = (attemptsQuery.data ?? []).map((row) => {
    const evento = String(row.datos_despues.evento ?? "");
    return {
      id: row.id_auditoria, fecha: formatoFecha(row.fecha_hora),
      usuario: String(row.datos_despues.identificador ?? "No disponible"),
      ip: row.ip_origen ?? "No disponible",
      resultado: evento === "CORRECTO" ? "Correcto" : evento === "BLOQUEADO" ? "Bloqueado" : "Fallido",
    };
  });
  const intentosFallidos = intentosIniciales.filter((item) => item.resultado === "Fallido").length;

  async function guardarPoliticas(): Promise<boolean> {
    setError(null); setMensaje("");
    if (!Number.isInteger(maxIntentos) || maxIntentos < 1 || maxIntentos > 20 || !Number.isInteger(minutosBloqueo) || minutosBloqueo < 1 || minutosBloqueo > 1440 || !Number.isInteger(minutosSesion) || minutosSesion < 5 || minutosSesion > 1440) {
      setError(new Error("Intentos: 1–20; bloqueo: 1–1440 minutos; sesión: 5–1440 minutos."));
      return false;
    }
    setIsSaving(true);
    try {
      await apiClient.put("/api/v1/admin/seguridad/politicas", { maxIntentosFallidos: maxIntentos, minutosBloqueo, minutosSesion });
      await queryClient.invalidateQueries({ queryKey: ["admin-security-policies"] });
      setMensaje("Políticas de acceso guardadas en el servidor.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("No se pudieron guardar las políticas."));
      return false;
    } finally { setIsSaving(false); }
  }

  async function desbloquearCuenta(id: string, justificacion: string): Promise<boolean> {
    setError(null); setMensaje("");
    if (justificacion.trim().length < 10) {
      setError(new Error("La justificación forense debe tener al menos 10 caracteres."));
      return false;
    }
    setIsSaving(true);
    try {
      await apiClient.post(`/api/v1/admin/seguridad/cuentas/${id}/desbloquear`, { justificacion: justificacion.trim() });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-blocked-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-access-attempts"] }),
      ]);
      setMensaje("Cuenta desbloqueada y acción registrada en la bitácora.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("No se pudo desbloquear la cuenta."));
      return false;
    } finally { setIsSaving(false); }
  }

  async function recargar() {
    await Promise.all([politicasQuery.refetch(), blockedQuery.refetch(), attemptsQuery.refetch()]);
  }

  return {
    maxIntentos, setMaxIntentos, minutosBloqueo, setMinutosBloqueo, minutosSesion, setMinutosSesion,
    cuentasBloqueadas, desbloquearCuenta, intentosFallidos, intentosIniciales,
    guardarPoliticas, mensaje, setMensaje, error: error ?? politicasQuery.error ?? blockedQuery.error ?? attemptsQuery.error ?? null,
    isLoading: politicasQuery.isPending || blockedQuery.isPending || attemptsQuery.isPending,
    isSaving, isError: politicasQuery.isError || blockedQuery.isError || attemptsQuery.isError,
    recargar,
  };
}
