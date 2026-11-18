// Hook del Calendario Laboral y Jornada LPAG (ENT-M05-06)
import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

export interface DiaLaboral {
  nombre: string;
  activo: boolean;
}

export interface Feriado {
  id: number;
  fecha: string;
  nombre: string;
}

export interface ConfiguracionJornada {
  horaInicio: string;
  horaFin: string;
  horaCorteRecepcion: string;
  zonaHoraria: string;
  diasLaborales: DiaLaboral[];
  feriados: Feriado[];
}

// Corte normativo no negociable (Art. 138 TUO Ley N° 27444)
export const HORA_INICIO_REFERENCIA = "08:00";
export const HORA_FIN_REFERENCIA = "16:30";
export const HORA_CORTE_LPAG = "16:30";

const diasIniciales: DiaLaboral[] = [
  { nombre: "Lunes", activo: true },
  { nombre: "Martes", activo: true },
  { nombre: "Miércoles", activo: true },
  { nombre: "Jueves", activo: true },
  { nombre: "Viernes", activo: true },
  { nombre: "Sábado", activo: false },
  { nombre: "Domingo", activo: false },
];

// Catálogo oficial de feriados conforme a D. Leg. N° 713 y Ucayali
const feriadosIniciales: Feriado[] = [
  { id: 1, fecha: "2026-01-01", nombre: "Año Nuevo" },
  { id: 2, fecha: "2026-05-01", nombre: "Día del Trabajo" },
  { id: 3, fecha: "2026-06-07", nombre: "Batalla de Arica y Día de la Bandera" },
  { id: 4, fecha: "2026-06-24", nombre: "Fiesta Patronal de San Juan Bautista (Ucayali)" },
  { id: 5, fecha: "2026-06-29", nombre: "San Pedro y San Pablo" },
  { id: 6, fecha: "2026-07-23", nombre: "Día de la Fuerza Aérea del Perú" },
  { id: 7, fecha: "2026-07-28", nombre: "Fiestas Patrias" },
  { id: 8, fecha: "2026-07-29", nombre: "Fiestas Patrias" },
  { id: 9, fecha: "2026-08-06", nombre: "Batalla de Junín" },
  { id: 10, fecha: "2026-08-30", nombre: "Santa Rosa de Lima" },
  { id: 11, fecha: "2026-10-08", nombre: "Combate de Angamos" },
  { id: 12, fecha: "2026-10-13", nombre: "Aniversario de la Provincia de Coronel Portillo (Pucallpa)" },
  { id: 13, fecha: "2026-11-01", nombre: "Día de Todos los Santos" },
  { id: 14, fecha: "2026-12-08", nombre: "Inmaculada Concepción" },
  { id: 15, fecha: "2026-12-09", nombre: "Batalla de Ayacucho" },
  { id: 16, fecha: "2026-12-25", nombre: "Navidad del Señor" },
];

export function useCalendarioLaboral() {
  const [dias, setDias] = useState(diasIniciales);
  const [horaInicio, setHoraInicio] = useState(HORA_INICIO_REFERENCIA);
  const [horaFin, setHoraFin] = useState(HORA_FIN_REFERENCIA);
  const [horaCorteRecepcion, setHoraCorteRecepcion] = useState(HORA_CORTE_LPAG);
  const [zonaHoraria, setZonaHoraria] = useState("America/Lima");
  const [feriados, setFeriados] = useState(feriadosIniciales);
  const [fechaNueva, setFechaNueva] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let montado = true;
    apiClient
      .get<
        | {
            feriados?: Array<{
              id?: number | string;
              fecha: string;
              nombre?: string;
              descripcion?: string;
            }>;
          }
        | Array<{ id?: number | string; fecha: string; nombre?: string; descripcion?: string }>
      >("/api/v1/admin/calendario-laboral")
      .then((res) => {
        if (!montado || !res.data) return;
        const lista = Array.isArray(res.data) ? res.data : (res.data.feriados ?? []);
        if (lista.length === 0) return;
        const mapped: Feriado[] = lista.map((f, idx) => ({
          id: typeof f.id === "number" ? f.id : idx + 1,
          fecha: f.fecha,
          nombre: f.nombre ?? f.descripcion ?? "Feriado Institucional",
        }));
        setFeriados(mapped);
      })
      .catch(() => {
        // Fallback al catálogo oficial
      });

    return () => {
      montado = false;
    };
  }, []);

  function alternarDia(indice: number) {
    setMensaje("");
    setDias((actuales) =>
      actuales.map((dia, posicion) =>
        posicion === indice ? { ...dia, activo: !dia.activo } : dia,
      ),
    );
  }

  function agregarFeriado() {
    if (!fechaNueva || !nombreNuevo.trim()) return;

    const nuevoFeriado: Feriado = {
      id: Math.max(0, ...feriados.map((feriado) => feriado.id)) + 1,
      fecha: fechaNueva,
      nombre: nombreNuevo.trim(),
    };

    setFeriados((actuales) => [...actuales, nuevoFeriado]);

    apiClient
      .post("/api/v1/admin/calendario-laboral/feriado-excepcional", {
        fecha: fechaNueva,
        motivo: nombreNuevo.trim(),
        descripcion: nombreNuevo.trim(),
      })
      .catch(() => {});

    setFechaNueva("");
    setNombreNuevo("");
    setMensaje("Feriado registrado en el calendario.");
  }

  function quitarFeriado(id: number) {
    setFeriados((actuales) => actuales.filter((item) => item.id !== id));
    setMensaje("");
  }

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
        horaCorteRecepcion
      } hrs (${
        corteOk
          ? "conforme a la LPAG Ley N° 27444"
          : "ADVERTENCIA: el corte no coincide con las 16:30 hrs normativas"
      }), zona ${zonaHoraria}. Falta persistencia del backend.`,
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
    quitarFeriado,
    fechaNueva,
    setFechaNueva,
    nombreNuevo,
    setNombreNuevo,
    guardarConfiguracion,
    mensaje,
    setMensaje,
  };
}