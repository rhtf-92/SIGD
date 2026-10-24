import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  EstadoResolucion,
  ResolucionDirectoral,
} from "../types/resolucionAcademica";

const CLAVE_LISTA = "sigd_rd_proyectos";
const CLAVE_CORRELATIVO = "sigd_rd_correlativo_2026";

export const FLUJO_ESTADOS: EstadoResolucion[] = [
  "BORRADOR",
  "EN_REVISION",
  "APROBADO_PARA_FIRMA",
  "FIRMADO_DIGITALMENTE",
];

const ESTADO_SIGUIENTE: Partial<Record<EstadoResolucion, EstadoResolucion>> = {
  BORRADOR: "EN_REVISION",
  EN_REVISION: "APROBADO_PARA_FIRMA",
  APROBADO_PARA_FIRMA: "FIRMADO_DIGITALMENTE",
};

function leerLista(): ResolucionDirectoral[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE_LISTA);
    if (!crudo) return [];
    const parsed = JSON.parse(crudo) as ResolucionDirectoral[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function leerCorrelativo(): number {
  try {
    const crudo = window.localStorage.getItem(CLAVE_CORRELATIVO);
    const n = crudo ? Number.parseInt(crudo, 10) : 412;
    return Number.isFinite(n) ? n : 412;
  } catch {
    return 412;
  }
}

export function generarNumeroResolucion(secuencia: number, anio = 2026): string {
  return `RD N.° ${String(secuencia).padStart(4, "0")}-${anio}-DG-IESTP-SUIZA`;
}

export function crearProyectoNuevo(
  secuencia: number,
  parcial?: Partial<ResolucionDirectoral>,
): ResolucionDirectoral {
  const ahora = new Date().toISOString();
  const idFinal = parcial?.id ?? `RD-2026-${String(secuencia).padStart(4, "0")}`;
  const numeroFinal = parcial?.numeroResolucion ?? generarNumeroResolucion(secuencia);
  const { id: _omitId, numeroResolucion: _omitNumero, ...restoParcial } = parcial ?? {};
  void _omitId;
  void _omitNumero;
  return {
    anio: 2026,
    tipo: "TITULACION",
    asunto: "",
    unidadOrganica: "Dirección General",
    fechaEmision: ahora,
    expedienteRelacionado: "",
    administradoNombre: "",
    administradoDocumento: "",
    programaEstudios: "Desarrollo de Sistemas de Información",
    visto: "",
    considerandos: [
      "Que, la Ley N.° 30512, Ley de Institutos y Escuelas de Educación Superior, establece las condiciones para el otorgamiento de títulos profesionales técnicos.",
    ],
    articulos: [
      {
        id: `art-${Date.now()}`,
        numero: 1,
        texto: "ARTÍCULO 1°. DISPONER el cumplimiento de lo resuelto.",
      },
    ],
    firmanteCargo: "Director General",
    firmanteNombre: "Lic. Julio César Mori Paredes",
    estado: "BORRADOR",
    ...restoParcial,
    id: idFinal,
    numeroResolucion: numeroFinal,
  };
}

export function useProyectosResolucion() {
  const [proyectos, setProyectos] = useState<ResolucionDirectoral[]>(() => {
    try {
      return leerLista();
    } catch {
      return [];
    }
  });
  const [correlativo, setCorrelativo] = useState(() => {
    try {
      return leerCorrelativo();
    } catch {
      return 412;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_LISTA, JSON.stringify(proyectos));
    } catch {
      // sin storage
    }
  }, [proyectos]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_CORRELATIVO, String(correlativo));
    } catch {
      // sin storage
    }
  }, [correlativo]);

  const guardar = useCallback((resolucion: ResolucionDirectoral) => {
    setProyectos((prev) => {
      const idx = prev.findIndex((p) => p.id === resolucion.id);
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = resolucion;
        return copia;
      }
      return [resolucion, ...prev];
    });
  }, []);

  const crearNuevo = useCallback(() => {
    const siguiente = correlativo + 1;
    setCorrelativo(siguiente);
    return crearProyectoNuevo(siguiente);
  }, [correlativo]);

  const avanzarEstado = useCallback((id: string) => {
    setProyectos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const siguiente = ESTADO_SIGUIENTE[p.estado];
        return siguiente ? { ...p, estado: siguiente } : p;
      }),
    );
  }, []);

  const retrocederEstado = useCallback((id: string) => {
    setProyectos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.estado === "EN_REVISION") return { ...p, estado: "BORRADOR" };
        if (p.estado === "APROBADO_PARA_FIRMA") return { ...p, estado: "EN_REVISION" };
        return p;
      }),
    );
  }, []);

  const eliminar = useCallback((id: string) => {
    setProyectos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const resumen = useMemo(() => {
    const porEstado = Object.fromEntries(
      FLUJO_ESTADOS.map((e) => [e, proyectos.filter((p) => p.estado === e).length]),
    ) as Record<EstadoResolucion, number>;
    return { total: proyectos.length, porEstado };
  }, [proyectos]);

  return {
    proyectos,
    resumen,
    correlativo,
    guardar,
    crearNuevo,
    avanzarEstado,
    retrocederEstado,
    eliminar,
  };
}
