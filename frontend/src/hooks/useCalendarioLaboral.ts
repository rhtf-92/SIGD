// Hook del Calendario Laboral y Jornada LPAG (ENT-M05-06) · T-BE-OC-14
import { useCallback, useMemo, useState } from "react";

import { useCalendarioOficial } from "./useCalendarioOficial";
import { CORTE_MINUTES } from "./useHorarioCorte";
import type { FeriadoExcepcionalInput } from "../types/calendarioLaboral";

export interface DiaLaboral {
  nombre: string;
  activo: boolean;
}

/**
 * Feriado o día no laborable tal como lo publica el backend
 * (`sigd_org.calendario_laboral`). Antes se declaraban 16 fechas fijas de 2026
 * escritas en el cliente; ahora provienen del calendario oficial.
 */
export interface Feriado {
  id: string;
  fecha: string;
  nombre: string;
  tipo_feriado: string | null;
  esLaborable: boolean;
  baseLegal: string | null;
}

export interface ConfiguracionJornada {
  horaInicio: string;
  horaFin: string;
  horaCorteRecepcion: string;
  zonaHoraria: string;
  diasLaborales: DiaLaboral[];
  feriados: Feriado[];
}

// Corte normativo no negociable (Art. 138 TUO Ley N° 27444).
// Se deriva de `CORTE_MINUTES` para no duplicar la constante normativa.
export const HORA_INICIO_REFERENCIA = "08:00";
export const HORA_FIN_REFERENCIA = "16:30";
export const HORA_CORTE_LPAG = `${String(Math.floor(CORTE_MINUTES / 60)).padStart(2, "0")}:${String(CORTE_MINUTES % 60).padStart(2, "0")}`;

const diasIniciales: DiaLaboral[] = [
  { nombre: "Lunes", activo: true },
  { nombre: "Martes", activo: true },
  { nombre: "Miércoles", activo: true },
  { nombre: "Jueves", activo: true },
  { nombre: "Viernes", activo: true },
  { nombre: "Sábado", activo: false },
  { nombre: "Domingo", activo: false },
];

export function useCalendarioLaboral() {
  const [dias, setDias] = useState(diasIniciales);
  const [horaInicio, setHoraInicio] = useState(HORA_INICIO_REFERENCIA);
  const [horaFin, setHoraFin] = useState(HORA_FIN_REFERENCIA);
  const [horaCorteRecepcion, setHoraCorteRecepcion] = useState(
    HORA_CORTE_LPAG,
  );
  const [zonaHoraria, setZonaHoraria] = useState("America/Lima");
  const [fechaNueva, setFechaNueva] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { vista, registrarFeriado, cargando } = useCalendarioOficial();

  // El listado de la consola se deriva del calendario oficial; la jornada y la
  // zona horaria siguen siendo configuración local de la interfaz.
  const feriados = useMemo<Feriado[]>(
    () =>
      vista.calendario.map((dia) => ({
        id: dia.id_calendario,
        fecha: dia.fecha,
        nombre: dia.descripcion,
        tipo_feriado: dia.tipo_feriado,
        esLaborable: dia.es_laborable,
        baseLegal: dia.base_legal,
      })),
    [vista.calendario],
  );

  function alternarDia(indice: number) {
    setMensaje("");
    setDias((actuales) =>
      actuales.map((dia, posicion) =>
        posicion === indice ? { ...dia, activo: !dia.activo } : dia,
      ),
    );
  }

  /**
   * Da de alta el feriado en el backend. Éste escribe la fila, el asiento en la
   * bitácora WORM y el evento del outbox en una sola transacción, invalida su
   * caché y devuelve; el hook invalida la query del calendario y la lista se
   * actualiza sola. Un duplicado responde 409 y se reporta como aviso.
   */
  const agregarFeriado = useCallback(async () => {
    if (!fechaNueva || !nombreNuevo.trim()) return;

    setGuardando(true);
    setMensaje("");
    const entrada: FeriadoExcepcionalInput = {
      fecha: fechaNueva,
      descripcion: nombreNuevo.trim(),
    };

    try {
      const registrado = await registrarFeriado(entrada);
      setFechaNueva("");
      setNombreNuevo("");
      setMensaje(
        `Feriado registrado (${registrado.fecha}). El semáforo SLA se recalculó con el nuevo calendario oficial.`,
      );
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : "Error desconocido";
      setMensaje(
        `No se pudo registrar el feriado: ${detalle}. Verifique que la fecha no esté duplicada.`,
      );
    } finally {
      setGuardando(false);
    }
  }, [fechaNueva, nombreNuevo, registrarFeriado]);

  function guardarConfiguracion(): ConfiguracionJornada {
    const configuracion: ConfiguracionJornada = {
      horaInicio,
      horaFin,
      horaCorteRecepcion,
      zonaHoraria,
      diasLaborales: dias,
      feriados,
    };

    const corteOk = horaCorteRecepcion === HORA_CORTE_LPAG;
    setMensaje(
      `Configuración preparada: ${horaInicio} - ${horaFin}, corte de recepción ${
        corteOk
          ? "conforme a la LPAG Ley N° 27444"
          : "ADVERTENCIA: el corte no coincide con las 16:30 hrs normativas"
      }, zona ${zonaHoraria}. Los ${feriados.length} feriados provienen del calendario oficial (sigd_org.calendario_laboral); la jornada aún no se persiste.`,
    );

    return configuracion;
  }

  return {
    dias,
    alternarDia,
    horaInicio,
    setHoraInicio,
    horaFin,
    setHoraFin,
    horaCorteRecepcion,
    setHoraCorteRecepcion,
    zonaHoraria,
    setZonaHoraria,
    feriados,
    agregarFeriado,
    cargando: cargando || guardando,
    fechaNueva,
    setFechaNueva,
    nombreNuevo,
    setNombreNuevo,
    guardarConfiguracion,
    mensaje,
    setMensaje,
  };
}
