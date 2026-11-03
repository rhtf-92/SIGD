import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { RegistroAuditoria, ResultadoAuditoria } from "../types/auditoriaForense";

interface AuditDto {
  id_auditoria: string | number;
  correlation_id?: string | null;
  usuario_id?: string | null;
  ip_origen?: string | null;
  esquema?: string | null;
  tabla?: string | null;
  operacion?: string | null;
  creado_en: string;
  datos_antes?: unknown;
  datos_despues?: Record<string, unknown>;
}

const PAGE_SIZE = 50;

export function serializar(valor: unknown): Record<string, unknown> {
  if (valor === null || typeof valor !== "object") return { valor };
  return valor as Record<string, unknown>;
}

function mapearRegistro(row: AuditDto): RegistroAuditoria {
  const esquema = row.esquema ?? "";
  const tabla = row.tabla ?? "";
  const detalle = row.datos_despues ?? {};
  const evento = String(detalle.evento ?? "");
  const resultado: ResultadoAuditoria = evento === "CORRECTO" ? "Exitoso"
    : evento === "FALLIDO" || evento === "BLOQUEADO" ? "Denegado"
      : evento === "ERROR" ? "Error" : "Registrado";
  return {
    id: String(row.id_auditoria), fecha: new Date(row.creado_en).toLocaleString("es-PE"),
    usuario: String(detalle.identificador ?? row.usuario_id ?? "No disponible"),
    rol: "No disponible", area: "No disponible", accion: evento || row.operacion || "Evento registrado",
    modulo: esquema || "Sistema", registro: [esquema, tabla].filter(Boolean).join("."), resultado,
    ip: row.ip_origen ?? "No disponible", correlationId: row.correlation_id ?? undefined,
    detallesTecnicos: { anterior: row.datos_antes ?? null, nuevo: detalle, esquema, tabla, operacion: row.operacion },
  };
}

export function useAuditLogs() {
  const [busqueda, setBusqueda] = useState("");
  const [modulo, setModulo] = useState("Todos");
  const [resultado, setResultado] = useState<ResultadoAuditoria | "Todos">("Todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [seleccionado, setSeleccionado] = useState<RegistroAuditoria | null>(null);
  const [pagina, setPagina] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const filtrosServidor = {
    ...(busqueda.trim() ? { q: busqueda.trim() } : {}),
    ...(modulo !== "Todos" ? { esquema: modulo } : {}),
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
    ...(resultado === "Exitoso" ? { resultado: "CORRECTO" }
      : resultado === "Denegado" ? { resultado: "DENEGADO" }
        : resultado === "Error" ? { resultado: "ERROR" } : {}),
  };
  const query = useQuery({
    queryKey: ["admin-audit-log", pagina, filtrosServidor],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; modulos?: string[]; registros: AuditDto[] }>(
        "/api/v1/admin/auditoria/bitacora",
        { params: { ...filtrosServidor, limite: PAGE_SIZE, offset: pagina * PAGE_SIZE } },
      );
      const registros = (data.registros ?? []).map(mapearRegistro);
      return { total: data.total ?? registros.length, modulos: data.modulos ?? [], registros };
    },
  });

  const filtrados = query.data?.registros ?? [];

  const resumen = useMemo(() => ({
    exitosos: filtrados.filter((row) => row.resultado === "Exitoso").length,
    denegados: filtrados.filter((row) => row.resultado === "Denegado").length,
    errores: filtrados.filter((row) => row.resultado === "Error").length,
  }), [filtrados]);
  const modulos = useMemo(() => Array.from(new Set([...(query.data?.modulos ?? []), ...(query.data?.registros ?? []).map((row) => row.modulo)])).sort(), [query.data]);

  async function exportarCsv() {
    setExportError(null);
    const cabecera = ["ID", "Fecha", "Usuario", "Rol", "Área", "Acción", "Módulo", "Registro", "Resultado", "IP", "X-Correlation-ID"];
    const todos: RegistroAuditoria[] = [];
    let total = Number.POSITIVE_INFINITY;
    try {
      for (let offset = 0; offset < total; offset += 100) {
        const { data } = await apiClient.get<{ total: number; registros: AuditDto[] }>("/api/v1/admin/auditoria/bitacora", { params: { ...filtrosServidor, limite: 100, offset } });
        const batch = (data.registros ?? []).map(mapearRegistro);
        todos.push(...batch);
        total = data.total ?? todos.length;
        if (batch.length === 0) break;
      }
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "No se pudo exportar la bitácora.");
      return;
    }
    const filas = todos.map((row) => [row.id, row.fecha, row.usuario, row.rol, row.area, row.accion, row.modulo, row.registro, row.resultado, row.ip, row.correlationId ?? ""]);
    const escapar = (valor: string) => `"${valor.replaceAll('"', '""')}"`;
    const blob = new Blob(["\uFEFF" + [cabecera, ...filas].map((fila) => fila.map(escapar).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = "auditoria-sigd.csv";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return {
    filtrados, resumen, busqueda, setBusqueda, modulo, setModulo, resultado, setResultado, desde, setDesde, hasta, setHasta,
    seleccionado, setSeleccionado, exportarCsv,
    total: query.data?.total ?? 0, pagina, setPagina, pageSize: PAGE_SIZE,
    modulos, exportError,
    isLoading: query.isPending, isError: query.isError,
    errorMessage: query.error instanceof Error ? query.error.message : undefined,
    refetch: query.refetch,
  };
}
