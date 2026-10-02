// Hook de Políticas de Seguridad de Acceso (ENT-M05-06)
// Directivas: 5 intentos fallidos, bloqueo 30 min, sesión 30 min, desbloqueo supervisado
import { useMemo, useState } from "react";

export interface CuentaBloqueada {
  id: number;
  usuario: string;
  correo: string;
  motivo: string;
  fecha: string;
}

export interface IntentoAcceso {
  id: number;
  fecha: string;
  usuario: string;
  ip: string;
  resultado: "Correcto" | "Fallido";
}

export interface PoliticasSeguridad {
  maxIntentosFallidos: number;
  minutosBloqueo: number;
  minutosSesion: number;
}

export const MAX_INTENTOS_DEFECTO = 5;
export const MINUTOS_BLOQUEO_DEFECTO = 30;
export const MINUTOS_SESION_DEFECTO = 30;

const intentosIniciales: IntentoAcceso[] = [
  { id: 1, fecha: "29/08/2026 10:20", usuario: "jperez@institutosuiza.edu.pe", ip: "192.168.1.18", resultado: "Correcto" },
  { id: 2, fecha: "29/08/2026 09:57", usuario: "atorres@institutosuiza.edu.pe", ip: "192.168.1.42", resultado: "Fallido" },
  { id: 3, fecha: "29/08/2026 09:56", usuario: "atorres@institutosuiza.edu.pe", ip: "192.168.1.42", resultado: "Fallido" },
  { id: 4, fecha: "29/08/2026 09:55", usuario: "atorres@institutosuiza.edu.pe", ip: "192.168.1.42", resultado: "Fallido" },
  { id: 5, fecha: "29/08/2026 08:35", usuario: "mlopez@institutosuiza.edu.pe", ip: "192.168.1.25", resultado: "Correcto" },
];

const cuentasIniciales: CuentaBloqueada[] = [
  {
    id: 1,
    usuario: "Ana Torres García",
    correo: "atorres@institutosuiza.edu.pe",
    motivo: "Exceso de intentos fallidos",
    fecha: "29/08/2026 09:57",
  },
];

export function useSeguridadPolicies() {
  const [maxIntentos, setMaxIntentos] = useState(MAX_INTENTOS_DEFECTO);
  const [minutosBloqueo, setMinutosBloqueo] = useState(MINUTOS_BLOQUEO_DEFECTO);
  const [minutosSesion, setMinutosSesion] = useState(MINUTOS_SESION_DEFECTO);
  const [cuentasBloqueadas, setCuentasBloqueadas] =
    useState<CuentaBloqueada[]>(cuentasIniciales);
  const [mensaje, setMensaje] = useState("");

  const intentosFallidos = useMemo(
    () => intentosIniciales.filter((intento) => intento.resultado === "Fallido").length,
    [],
  );

  function guardarPoliticas(): PoliticasSeguridad {
    const politicas: PoliticasSeguridad = {
      maxIntentosFallidos: maxIntentos,
      minutosBloqueo,
      minutosSesion,
    };

    setMensaje(
      `Políticas preparadas: ${maxIntentos} intentos fallidos máximo, ${minutosBloqueo} min de bloqueo y ${minutosSesion} min de sesión.`,
    );

    return politicas;
  }

  // Desbloqueo supervisado con justificación forense obligatoria
  // (la acción debe registrarse en la bitácora de auditoría WORM)
  function desbloquearCuenta(id: number, justificacion: string) {
    const justificacionOk = justificacion.trim();
    if (!justificacionOk) {
      setMensaje(
        "Desbloqueo rechazado: la justificación forense es obligatoria.",
      );
      return;
    }

    const cuenta = cuentasBloqueadas.find((item) => item.id === id);
    if (!cuenta) return;

    setCuentasBloqueadas((actuales) =>
      actuales.filter((item) => item.id !== id),
    );
    setMensaje(
      `Cuenta de ${cuenta.usuario} desbloqueada con justificación: "${justificacionOk}". Evento registrado en auditoría WORM.`,
    );
  }

  return {
    maxIntentos,
    setMaxIntentos,
    minutosBloqueo,
    setMinutosBloqueo,
    minutosSesion,
    setMinutosSesion,
    cuentasBloqueadas,
    desbloquearCuenta,
    intentosFallidos,
    intentosIniciales,
    guardarPoliticas,
    mensaje,
    setMensaje,
  };
}