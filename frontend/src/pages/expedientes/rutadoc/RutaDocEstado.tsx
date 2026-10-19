import type { ReactNode } from "react";
import { ApiHttpError } from "../../../types/api";
import { fechaExpediente } from "../../../utils/expedientePresentacion";

export function FechaRutaDoc({ valor }: { valor: string }) {
  // Una fecha civil no representa medianoche UTC: conservar su día literal.
  const civil = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  const etiqueta = civil ? `${civil[3]}/${civil[2]}/${civil[1]}` : fechaExpediente(valor, true);
  return <time dateTime={valor}>{etiqueta}</time>;
}

export function IdentificadorRutaDoc({ valor }: { valor: string | null }) {
  if (!valor) return <span>No disponible</span>;
  if (valor.length <= 16) return <span className="break-all font-mono text-sm">{valor}</span>;
  return <details className="inline-block max-w-full align-top">
    <summary className="cursor-pointer rounded font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
      {valor.slice(0, 8)}…{valor.slice(-4)} <span className="font-sans">(ver identificador completo)</span>
    </summary>
    <code className="block break-all text-sm">{valor}</code>
  </details>;
}

export function mensajeError(error: unknown): string {
  if (error instanceof ApiHttpError) {
    const mensajes: Record<number, string> = { 400: "Solicitud inválida", 401: "Sesión requerida",
      403: "Acceso denegado", 404: "No encontrado" };
    const detail = error.problemDetails.detail;
    if (/network|failed to fetch|conexión|timeout/i.test(detail)) return "Error de red. No se pudo consultar el servidor.";
    return `${error.status}: ${mensajes[error.status] ?? "Error del servidor"}. ${detail}`;
  }
  return error instanceof Error ? error.message : "No se pudo completar la consulta.";
}
export default function RutaDocEstado({ pendiente, error, children, reintentar }: {
  pendiente: boolean; error: unknown; children: ReactNode; reintentar?: () => void;
}) {
  if (pendiente) return <p role="status">Cargando…</p>;
  if (error) return <div><p role="alert">{mensajeError(error)}</p>
    {reintentar && <button type="button" className="rounded border border-blue-800 px-3 py-2 text-blue-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" onClick={reintentar}>Reintentar consulta</button>}</div>;
  return <>{children}</>;
}
