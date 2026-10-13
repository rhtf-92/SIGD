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
      setFeriados(await obtenerFeriados());
    } catch (causa) {
      setError(causa instanceof Error ? causa : new Error("No se pudo cargar el calendario."));
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    let activo = true;
    void obtenerFeriados()
      .then((resultado) => { if (activo) setFeriados(resultado); })
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

  function guardarConfiguracion(): ConfiguracionJornada {
    const configuracion = { horaInicio, horaFin, horaCorteRecepcion, zonaHoraria, diasLaborales: dias, feriados };
    setMensaje("Los feriados están persistidos. La jornada mostrada es una referencia normativa local.");
    return configuracion;
  }

  return {
    dias, alternarDia, horaInicio, setHoraInicio, horaFin, setHoraFin,
    horaCorteRecepcion, setHoraCorteRecepcion, zonaHoraria, setZonaHoraria,
    feriados, agregarFeriado, quitarFeriado, fechaNueva, setFechaNueva,
    nombreNuevo, setNombreNuevo, guardarConfiguracion, mensaje, setMensaje,
    error, isLoading, isSaving, recargar: cargar,
  };
}
