// Hook del Visor Forense de Logs Inmutables WORM (ENT-M05-04)
// Consume la API real de auditoría del backend (GET /api/v1/auditoria/logs).
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import type {
  RegistroAuditoria,
  ResultadoAuditoria,
} from "../types/auditoriaForense";

interface LogsApiResponse {
  total: number;
  pagina: number;
  por_pagina: number;
  registros: RegistroAuditoria[];
}

interface ResumenApiResponse {
  total: number;
  exitosos: number;
  denegados: number;
  errores: number;
  por_modulo: Array<{ modulo: string; total: number }>;
  por_accion: Array<{ accion: string; total: number }>;
  por_usuario: Array<{ usuario_id: string; total: number }>;
}

const PAGE_SIZE = 50;

export function serializar(valor: unknown): Record<string, unknown> {
  if (valor === null || typeof valor !== "object") return { valor };
  return valor as Record<string, unknown>;
}

export function useAuditLogs() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<ResumenApiResponse>({
    total: 0,
    exitosos: 0,
    denegados: 0,
    errores: 0,
    por_modulo: [],
    por_accion: [],
    por_usuario: [],
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [modulo, setModulo] = useState("Todos");
  const [resultado, setResultado] = useState<ResultadoAuditoria | "Todos">(
    "Todos",
  );
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] =
    useState<RegistroAuditoria | null>(null);

  /**
   * Carga los logs de auditoría desde el backend aplicando los filtros
   * actuales (búsqueda se aplica localmente; módulo y resultado se envían al
   * servidor para reducir el volumen transferido).
   */
  const cargarLogs = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        pagina: String(pagina),
        por_pagina: String(PAGE_SIZE),
      };
      if (modulo !== "Todos") params.modulo = modulo;
      if (resultado !== "Todos") params.resultado = resultado;

      const { data } = await apiClient.get<Partial<LogsApiResponse>>("/api/v1/auditoria/logs", {
        params,
      });

      const registros = Array.isArray(data?.registros) ? data.registros : Array.isArray((data as any)?.logs) ? (data as any).logs : [];
      setRegistros(registros as RegistroAuditoria[]);
      setTotal(typeof data?.total === "number" ? data.total : registros.length);
    } catch (err: unknown) {
      console.error("[useAuditLogs] Error cargando logs:", err);
      setError(
        err instanceof Error ? err.message : "No se pudieron cargar los logs de auditoría.",
      );
      setRegistros([]);
      setTotal(0);
    } finally {
      setCargando(false);
    }
  }, [pagina, modulo, resultado]);

  /**
   * Carga el resumen estadístico desde el backend.
   */
  const cargarResumen = useCallback(async () => {
    try {
      const { data } = await apiClient.get<ResumenApiResponse>(
        "/api/v1/auditoria/resumen",
      );
      setResumen(data);
    } catch {
      // No bloqueamos la UI si falla el resumen: se calcula localmente abajo.
    }
  }, []);

  useEffect(() => {
    cargarLogs();
    cargarResumen();
  }, [cargarLogs, cargarResumen]);

  // Filtro local de búsqueda (texto libre sobre usuario, acción, registro, ID, X-Correlation-ID)
  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return registros.filter((registro) => {
      const coincideTexto =
        texto === "" ||
        registro.usuario.toLowerCase().includes(texto) ||
        registro.accion.toLowerCase().includes(texto) ||
        registro.registro.toLowerCase().includes(texto) ||
        registro.id.toLowerCase().includes(texto) ||
        (registro.correlationId !== undefined &&
          registro.correlationId.toLowerCase().includes(texto));

      const coincideModulo = modulo === "Todos" || registro.modulo === modulo;
      const coincideResultado =
        resultado === "Todos" || registro.resultado === resultado;

      return coincideTexto && coincideModulo && coincideResultado;
    });
  }, [registros, busqueda, modulo, resultado]);

  // Resumen calculado localmente (fallback si el backend no respondió)
  const resumenCalculado = useMemo(() => {
    const datos = filtrados;
    return {
      exitosos: datos.filter((r) => r.resultado === "Exitoso").length,
      denegados: datos.filter((r) => r.resultado === "Denegado").length,
      errores: datos.filter((r) => r.resultado === "Error").length,
    };
  }, [filtrados]);

  const resumenFinal = resumen.total > 0
    ? {
        exitosos: resumen.exitosos,
        denegados: resumen.denegados,
        errores: resumen.errores,
      }
    : resumenCalculado;

  function exportarCsv() {
    const cabecera = [
      "ID",
      "Fecha",
      "Usuario",
      "Rol",
      "Área",
      "Acción",
      "Módulo",
      "Registro",
      "Resultado",
      "IP",
      "X-Correlation-ID",
      "Hash WORM",
      "Hash Anterior",
    ];

    const filas = filtrados.map((registro) => [
      registro.id,
      registro.fecha,
      registro.usuario,
      registro.rol,
      registro.area,
      registro.accion,
      registro.modulo,
      registro.registro,
      registro.resultado,
      registro.ip,
      registro.correlationId ?? "",
      registro.hash ?? "",
      registro.hashAnterior ?? "",
    ]);

    const escapar = (valor: string) => `"${valor.replaceAll('"', '""')}"`;
    const csv = [cabecera, ...filas]
      .map((fila) => fila.map(escapar).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = "auditoria-sigd.csv";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return {
    filtrados,
    resumen: resumenFinal,
    total,
    cargando,
    error,
    busqueda,
    setBusqueda,
    modulo,
    setModulo,
    resultado,
    setResultado,
    pagina,
    setPagina,
    seleccionado,
    setSeleccionado,
    exportarCsv,
    recargar: cargarLogs,
  };
}
