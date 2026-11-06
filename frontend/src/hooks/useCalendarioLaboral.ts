import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";

export interface DiaLaboral { nombre: string; activo: boolean }
export interface Feriado { id: string; fecha: string; nombre: string }
export interface ConfiguracionJornada {
  horaInicio: string; horaFin: string; horaCorteRecepcion: string; zonaHoraria: string;
  diasLaborales: DiaLaboral[]; feriados: Feriado[];
}

export const HORA_INICIO_REFERENCIA = "08:00";
export const HORA_FIN_REFERENCIA = "16:30";
export const HORA_CORTE_LPAG = "16:30";

const diasIniciales: DiaLaboral[] = [
  "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
].map((nombre, indice) => ({ nombre, activo: indice < 5 }));

interface DiaApi { id_calendario: string; fecha: string; descripcion: string }

async function obtenerFeriados(): Promise<Feriado[]> {
  const { data } = await apiClient.get<{ calendario: DiaApi[] }>("/api/v1/admin/calendario-laboral", {
    params: { estado: "ACTIVO" },
  });
  return (data.calendario ?? []).map((dia) => ({
    id: dia.id_calendario, fecha: dia.fecha, nombre: dia.descripcion,
  }));
}

interface JornadaApi {
  hora_inicio: string; hora_fin: string; hora_corte: string; zona_horaria: string; dias_laborales: number[];
}

async function obtenerJornada(): Promise<JornadaApi> {
  const { data } = await apiClient.get<{ jornada: JornadaApi }>("/api/v1/admin/calendario-laboral/configuracion");
  return data.jornada;
}

export function useCalendarioLaboral() {
  const [dias, setDias] = useState(diasIniciales);
  const [horaInicio, setHoraInicio] = useState(HORA_INICIO_REFERENCIA);
  const [horaFin, setHoraFin] = useState(HORA_FIN_REFERENCIA);
  const [horaCorteRecepcion, setHoraCorteRecepcion] = useState(HORA_CORTE_LPAG);
  const [zonaHoraria, setZonaHoraria] = useState("America/Lima");
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [fechaNueva, setFechaNueva] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const cargar = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const [diasFeriado, jornada] = await Promise.all([obtenerFeriados(), obtenerJornada()]);
      setFeriados(diasFeriado);
      setHoraInicio(jornada.hora_inicio);
      setHoraFin(jornada.hora_fin);
      setHoraCorteRecepcion(jornada.hora_corte);
      setZonaHoraria(jornada.zona_horaria);
      setDias((actuales) => actuales.map((dia, indice) => ({ ...dia, activo: jornada.dias_laborales.includes(indice + 1) })));
    } catch (causa) {
      setError(causa instanceof Error ? causa : new Error("No se pudo cargar el calendario."));
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    let activo = true;
    void Promise.all([obtenerFeriados(), obtenerJornada()])
      .then(([resultado, jornada]) => {
        if (!activo) return;
        setFeriados(resultado);
        setHoraInicio(jornada.hora_inicio);
        setHoraFin(jornada.hora_fin);
        setHoraCorteRecepcion(jornada.hora_corte);
        setZonaHoraria(jornada.zona_horaria);
        setDias((actuales) => actuales.map((dia, indice) => ({ ...dia, activo: jornada.dias_laborales.includes(indice + 1) })));
      })
      .catch((causa) => {
        if (activo) setError(causa instanceof Error ? causa : new Error("No se pudo cargar el calendario."));
      })
      .finally(() => { if (activo) setIsLoading(false); });
    return () => { activo = false; };
  }, []);

  function alternarDia(indice: number) {
    setDias((actuales) => actuales.map((dia, posicion) => posicion === indice ? { ...dia, activo: !dia.activo } : dia));
  }

  async function agregarFeriado() {
    if (!fechaNueva || nombreNuevo.trim().length < 5) return;
    setIsSaving(true); setError(null); setMensaje("");
    try {
      await apiClient.post("/api/v1/admin/calendario-laboral/feriado-excepcional", {
        fecha: fechaNueva, descripcion: nombreNuevo.trim(), tipo_feriado: "INSTITUCIONAL",
      });
      await cargar();
      setFechaNueva(""); setNombreNuevo(""); setMensaje("Feriado guardado en PostgreSQL.");
    } catch (causa) {
      setError(causa instanceof Error ? causa : new Error("No se pudo guardar el feriado."));
    } finally { setIsSaving(false); }
  }

  async function quitarFeriado(id: string) {
    setIsSaving(true); setError(null); setMensaje("");
    try {
      await apiClient.patch(`/api/v1/admin/calendario-laboral/${id}/vigencia`, { vigente: false });
      await cargar();
      setMensaje("Feriado inactivado; se conservó su trazabilidad.");
    } catch (causa) {
      setError(causa instanceof Error ? causa : new Error("No se pudo inactivar el feriado."));
    } finally { setIsSaving(false); }
  }

  async function guardarConfiguracion(): Promise<boolean> {
    setError(null); setMensaje("");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaFin) || horaInicio >= horaFin || horaCorteRecepcion !== HORA_CORTE_LPAG || dias.every((dia) => !dia.activo)) {
      setError(new Error("Revisa el horario, conserva el corte normativo 16:30 y selecciona al menos un día laborable."));
      return false;
    }
    setIsSaving(true);
    try {
      await apiClient.put("/api/v1/admin/calendario-laboral/configuracion", {
        horaInicio, horaFin, horaCorte: HORA_CORTE_LPAG, zonaHoraria,
        diasLaborales: dias.flatMap((dia, indice) => dia.activo ? [indice + 1] : []),
      });
      await cargar();
      setMensaje("La jornada laboral quedó guardada en el servidor.");
      return true;
    } catch (causa) {
      setError(causa instanceof Error ? causa : new Error("No se pudo guardar la jornada laboral."));
      return false;
    } finally { setIsSaving(false); }
  }

  return {
    dias, alternarDia, horaInicio, setHoraInicio, horaFin, setHoraFin,
    horaCorteRecepcion, setHoraCorteRecepcion, zonaHoraria, setZonaHoraria,
    feriados, agregarFeriado, quitarFeriado, fechaNueva, setFechaNueva,
    nombreNuevo, setNombreNuevo, guardarConfiguracion, mensaje, setMensaje,
    error, isLoading, isSaving, recargar: cargar,
  };
}
