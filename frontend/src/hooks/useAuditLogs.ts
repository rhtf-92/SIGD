// Hook del Visor Forense de Logs Inmutables WORM (ENT-M05-04)
import { useMemo, useState } from "react";

import type {
  RegistroAuditoria,
  ResultadoAuditoria,
} from "../types/auditoriaForense";

const registrosIniciales: RegistroAuditoria[] = [
  {
    id: "AUD-000145",
    fecha: "29/08/2026 10:15:22",
    usuario: "María Fernanda López",
    rol: "Responsable de Área",
    area: "Secretaría Académica",
    accion: "Derivó expediente",
    modulo: "Expedientes",
    registro: "EXP-2026-000184",
    resultado: "Exitoso",
    ip: "192.168.1.25",
    correlationId: "d8f3a1c2-4b5e-4c7f-9a1d-2e3f4a5b6c7d",
    detallesTecnicos: {
      anterior: { areaOrigen: "Mesa de Partes", estado: "En revisión" },
      nuevo: {
        areaOrigen: "Mesa de Partes",
        estado: "Derivado a Secretaría Académica",
      },
    },
  },
  {
    id: "AUD-000144",
    fecha: "29/08/2026 09:57:10",
    usuario: "Ana Torres García",
    rol: "Administrador",
    area: "Administración",
    accion: "Intento de inicio de sesión",
    modulo: "Autenticación",
    registro: "Cuenta de usuario",
    resultado: "Denegado",
    ip: "192.168.1.42",
    correlationId: "7c9e1f2a-b3d4-4e5f-8a1b-2c3d4e5f6a7b",
    detallesTecnicos: {
      status: 403,
      problemDetails: "Credenciales inválidas",
    },
  },
  {
    id: "AUD-000143",
    fecha: "29/08/2026 09:45:03",
    usuario: "Juan Carlos Pérez",
    rol: "Operador",
    area: "Mesa de Partes",
    accion: "Registró documento",
    modulo: "Documentos",
    registro: "DOC-2026-000322",
    resultado: "Exitoso",
    ip: "192.168.1.18",
    correlationId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    detallesTecnicos: {
      anterior: null,
      nuevo: { radicado: "MP-2026-000322", folio: 322 },
    },
  },
  {
    id: "AUD-000142",
    fecha: "29/08/2026 09:10:34",
    usuario: "Sistema",
    rol: "Sistema",
    area: "Seguridad",
    accion: "Bloqueó cuenta",
    modulo: "Seguridad",
    registro: "Usuario ATG-004",
    resultado: "Exitoso",
    ip: "127.0.0.1",
    correlationId: "f4e5d6c7-b8a9-4c1d-9e2f-3a4b5c6d7e8f",
    detallesTecnicos: {
      anterior: { estado: "Activo" },
      nuevo: { estado: "Bloqueado", motivo: "Exceso de intentos fallidos" },
    },
  },
  {
    id: "AUD-000141",
    fecha: "28/08/2026 16:31:55",
    usuario: "Luis Alberto Ramos",
    rol: "Consulta",
    area: "Archivo Central",
    accion: "Consultó expediente",
    modulo: "Expedientes",
    registro: "EXP-2026-000165",
    resultado: "Denegado",
    ip: "192.168.1.31",
    correlationId: "5b6a7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
  },
  {
    id: "AUD-000140",
    fecha: "28/08/2026 15:20:11",
    usuario: "Juan Carlos Pérez",
    rol: "Operador",
    area: "Mesa de Partes",
    accion: "Archivó expediente",
    modulo: "Expedientes",
    registro: "EXP-2026-000165",
    resultado: "Error",
    ip: "192.168.1.18",
    correlationId: "9a8b7c6d-5e4f-4d3c-8b2a-1f0e9d8c7b6a",
    detallesTecnicos: {
      status: 500,
      problemDetails: "Timeout en microservicio de foliado",
    },
  },
];

// Envoltorio para JSON.stringify de tipos desconocidos en el diff
export function serializar(valor: unknown): Record<string, unknown> {
  if (valor === null || typeof valor !== "object") return { valor };
  return valor as Record<string, unknown>;
}

export function useAuditLogs() {
  const [registros] = useState(registrosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [modulo, setModulo] = useState("Todos");
  const [resultado, setResultado] = useState<ResultadoAuditoria | "Todos">(
    "Todos",
  );
  const [seleccionado, setSeleccionado] =
    useState<RegistroAuditoria | null>(null);

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
  }, [busqueda, modulo, resultado, registros]);

  const resumen = useMemo(
    () => ({
      exitosos: filtrados.filter((r) => r.resultado === "Exitoso").length,
      denegados: filtrados.filter((r) => r.resultado === "Denegado").length,
      errores: filtrados.filter((r) => r.resultado === "Error").length,
    }),
    [filtrados],
  );

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
    ]);

    const escapar = (valor: string) => `"${valor.replaceAll('"', '""')}"`;
    const csv = [cabecera, ...filas]
      .map((fila) => fila.map(escapar).join(","))
      .join("\n");

    // BOM UTF-8 para evitar caracteres corruptos en MS Excel (D3 del módulo)
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
    resumen,
    busqueda,
    setBusqueda,
    modulo,
    setModulo,
    resultado,
    setResultado,
    seleccionado,
    setSeleccionado,
    exportarCsv,
  };
}