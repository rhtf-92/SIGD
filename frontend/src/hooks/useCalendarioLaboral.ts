import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";

export interface Feriado {
  fecha: string;
  nombre: string;
}

interface DiaCalendarioApi {
  fecha: string;
  descripcion: string;
  es_laborable: boolean;
}

interface RespuestaCalendarioApi {
  calendario: DiaCalendarioApi[];
}

export function useCalendarioLaboral() {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarFeriados = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const { data } = await apiClient.get<RespuestaCalendarioApi>(
        "/api/v1/admin/calendario-laboral",
      );
      if (!Array.isArray(data.calendario)) {
        throw new Error("La respuesta del calendario laboral no tiene un formato válido.");
      }

      setFeriados(
        data.calendario
          .filter((dia) => !dia.es_laborable)
          .map((dia) => ({ fecha: dia.fecha, nombre: dia.descripcion })),
      );
    } catch (error) {
      setFeriados([]);
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el calendario laboral.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarFeriados();
  }, [cargarFeriados]);

  return { feriados, cargando, error, cargarFeriados };
}
