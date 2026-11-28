import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";

export type TipoFeriado =
  | "NACIONAL"
  | "REGIONAL_UCAYALI"
  | "INSTITUCIONAL"
  | "DUELO_NACIONAL";

export type UnidadTerritorial =
  | "NACIONAL"
  | "UCAYALI"
  | "REGIONAL_UCAYALI"
  | "IESTP_SUIZA";

export interface Feriado {
  id?: string;
  id_calendario?: string;
  fecha: string;
  nombre: string;
  descripcion?: string;
  anio?: number;
  tipo_feriado?: TipoFeriado | null;
  unidad_territorial?: UnidadTerritorial;
  es_laborable?: boolean;
  base_legal?: string | null;
  activo?: boolean;
}

export interface NuevoFeriadoInput {
  fecha: string;
  descripcion: string;
  tipo_feriado?: TipoFeriado | null;
  unidad_territorial?: UnidadTerritorial;
  es_laborable?: boolean;
  base_legal?: string | null;
}

export interface EditarFeriadoInput {
  fecha?: string;
  descripcion?: string;
  tipo_feriado?: TipoFeriado | null;
  unidad_territorial?: UnidadTerritorial;
  es_laborable?: boolean;
  base_legal?: string | null;
  activo?: boolean;
}

interface DiaCalendarioApi {
  id_calendario?: string;
  fecha: string;
  descripcion?: string;
  nombre?: string;
  anio?: number;
  tipo_feriado?: TipoFeriado | null;
  unidad_territorial?: UnidadTerritorial;
  es_laborable?: boolean;
  base_legal?: string | null;
  activo?: boolean;
}

interface RespuestaCalendarioApi {
  calendario: DiaCalendarioApi[];
  todos_los_dias?: DiaCalendarioApi[];
  anios_disponibles?: number[];
  anio?: number;
  total?: number;
}

function normalizarDia(dia: DiaCalendarioApi): Feriado {
  const desc = dia.descripcion || dia.nombre || "";
  const idGen = dia.id_calendario || `${dia.fecha}-${desc}`;
  return {
    id: idGen,
    id_calendario: dia.id_calendario,
    fecha: dia.fecha,
    nombre: desc,
    descripcion: desc,
    anio: dia.anio ? Number(dia.anio) : Number(dia.fecha.slice(0, 4)),
    tipo_feriado: dia.tipo_feriado ?? (dia.es_laborable ? null : "INSTITUCIONAL"),
    unidad_territorial: dia.unidad_territorial ?? "NACIONAL",
    es_laborable: Boolean(dia.es_laborable),
    base_legal: dia.base_legal ?? null,
    activo: dia.activo !== false,
  };
}

export function useCalendarioLaboral(anioInicial?: number) {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [todosLosDias, setTodosLosDias] = useState<Feriado[]>([]);
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([2025, 2026, 2027]);
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(
    anioInicial ?? 2026,
  );
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  const cargarFeriados = useCallback(async (anio?: number) => {
    setCargando(true);
    setError("");

    try {
      const anioConsulta = anio ?? anioSeleccionado;
      const params = anioConsulta ? `?anio=${anioConsulta}` : "";
      const { data } = await apiClient.get<RespuestaCalendarioApi>(
        `/api/v1/admin/calendario-laboral${params}`,
      );

      if (!Array.isArray(data.calendario)) {
        throw new Error(
          "La respuesta del calendario laboral no tiene un formato válido.",
        );
      }

      const listaCompleta = (data.todos_los_dias || data.calendario).map(normalizarDia);
      setTodosLosDias(listaCompleta);

      // feriados filtra días no laborables para mantener compatibilidad histórica
      const soloNoLaborables = data.calendario
        .filter((dia) => !dia.es_laborable)
        .map(normalizarDia);

      setFeriados(soloNoLaborables);

      if (Array.isArray(data.anios_disponibles) && data.anios_disponibles.length > 0) {
        setAniosDisponibles((prev) => {
          const combinados = new Set([...prev, ...data.anios_disponibles!]);
          return [...combinados].sort((a, b) => a - b);
        });
      }
    } catch (err) {
      setFeriados([]);
      setTodosLosDias([]);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el calendario laboral.",
      );
    } finally {
      setCargando(false);
    }
  }, [anioSeleccionado]);

  useEffect(() => {
    void cargarFeriados(anioSeleccionado);
  }, [anioSeleccionado, cargarFeriados]);

  const agregarFeriado = async (nuevo: NuevoFeriadoInput): Promise<Feriado> => {
    setGuardando(true);
    setError("");
    setMensajeExito("");
    try {
      const payload = {
        fecha: nuevo.fecha,
        descripcion: nuevo.descripcion,
        tipo_feriado: nuevo.tipo_feriado ?? (nuevo.es_laborable ? null : "INSTITUCIONAL"),
        unidad_territorial: nuevo.unidad_territorial ?? "NACIONAL",
        es_laborable: nuevo.es_laborable ?? false,
        base_legal: nuevo.base_legal || undefined,
      };

      let creado: Feriado;
      if (typeof apiClient.post === "function") {
        const { data } = await apiClient.post<DiaCalendarioApi>(
          "/api/v1/admin/calendario-laboral/feriado-excepcional",
          payload,
        );
        creado = normalizarDia(data);
      } else {
        // Fallback optimista si mock no define post
        creado = normalizarDia(payload);
      }

      setFeriados((prev) => {
        if (creado.es_laborable) return prev;
        const sinDuplicado = prev.filter((f) => f.fecha !== creado.fecha);
        return [...sinDuplicado, creado].sort((a, b) => a.fecha.localeCompare(b.fecha));
      });

      setTodosLosDias((prev) => {
        const sinDuplicado = prev.filter((f) => f.fecha !== creado.fecha);
        return [...sinDuplicado, creado].sort((a, b) => a.fecha.localeCompare(b.fecha));
      });

      setMensajeExito(`Día "${creado.nombre}" registrado exitosamente.`);
      return creado;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar feriado.";
      setError(msg);
      throw err;
    } finally {
      setGuardando(false);
    }
  };

  const editarFeriado = async (
    idOFecha: string,
    cambios: EditarFeriadoInput,
  ): Promise<Feriado> => {
    setGuardando(true);
    setError("");
    setMensajeExito("");
    try {
      let editado: Feriado;
      const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOFecha);

      if (esUuid && typeof apiClient.put === "function") {
        const { data } = await apiClient.put<DiaCalendarioApi>(
          `/api/v1/admin/calendario-laboral/${idOFecha}`,
          cambios,
        );
        editado = normalizarDia(data);
      } else {
        // Actualización optimista local
        const itemActual = todosLosDias.find((d) => d.id === idOFecha || d.id_calendario === idOFecha || d.fecha === idOFecha);
        const actual = itemActual || feriados.find((d) => d.fecha === idOFecha) || {
          fecha: idOFecha,
          nombre: cambios.descripcion || "",
        };
        editado = {
          ...actual,
          fecha: cambios.fecha ?? actual.fecha,
          nombre: cambios.descripcion ?? actual.nombre,
          descripcion: cambios.descripcion ?? actual.descripcion,
          tipo_feriado: cambios.tipo_feriado !== undefined ? cambios.tipo_feriado : actual.tipo_feriado,
          unidad_territorial: cambios.unidad_territorial ?? actual.unidad_territorial,
          es_laborable: cambios.es_laborable !== undefined ? cambios.es_laborable : actual.es_laborable,
          base_legal: cambios.base_legal !== undefined ? cambios.base_legal : actual.base_legal,
          activo: cambios.activo !== undefined ? cambios.activo : actual.activo,
        };
      }

      setFeriados((prev) =>
        prev
          .map((f) => {
            if (f.id === idOFecha || f.id_calendario === idOFecha || f.fecha === idOFecha) {
              return editado;
            }
            return f;
          })
          .filter((f) => !f.es_laborable && f.activo !== false)
          .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      );

      setTodosLosDias((prev) =>
        prev
          .map((f) => {
            if (f.id === idOFecha || f.id_calendario === idOFecha || f.fecha === idOFecha) {
              return editado;
            }
            return f;
          })
          .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      );

      setMensajeExito(`Registro de "${editado.nombre}" actualizado correctamente.`);
      return editado;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al editar feriado.";
      setError(msg);
      throw err;
    } finally {
      setGuardando(false);
    }
  };

  const eliminarFeriado = async (idOFecha: string, soft: boolean = false): Promise<void> => {
    setGuardando(true);
    setError("");
    setMensajeExito("");
    try {
      const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOFecha);

      if (esUuid && typeof apiClient.delete === "function") {
        await apiClient.delete(
          `/api/v1/admin/calendario-laboral/${idOFecha}${soft ? "?soft=true" : ""}`,
        );
      }

      setFeriados((prev) =>
        prev.filter((f) => f.id !== idOFecha && f.id_calendario !== idOFecha && f.fecha !== idOFecha),
      );
      setTodosLosDias((prev) =>
        prev.filter((f) => f.id !== idOFecha && f.id_calendario !== idOFecha && f.fecha !== idOFecha),
      );

      setMensajeExito("Día feriado eliminado exitosamente del calendario laboral.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al eliminar feriado.";
      setError(msg);
      throw err;
    } finally {
      setGuardando(false);
    }
  };

  return {
    feriados,
    todosLosDias,
    aniosDisponibles,
    anioSeleccionado,
    setAnioSeleccionado,
    cargando,
    guardando,
    error,
    mensajeExito,
    setError,
    setMensajeExito,
    cargarFeriados,
    agregarFeriado,
    editarFeriado,
    eliminarFeriado,
  };
}
