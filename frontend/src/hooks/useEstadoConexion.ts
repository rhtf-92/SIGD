// Estado de conexión a internet del navegador.
// Escucha los eventos nativos `online` y `offline` y, al recuperar la señal,
// confirma con una sonda HTTP real que la red vuelve a responder antes de
// dar la aplicación por operativa.
import { useCallback, useEffect, useRef, useState } from "react";

import { hayConectividadReal } from "../utils/conectividad";

export type EstadoConexion = "en-linea" | "reconectando" | "sin-conexion";

export interface UseEstadoConexion {
  /** `false` mientras la aplicación no tiene salida a internet. */
  hayConexion: boolean;
  /** `true` mientras se verifica que la red recuperó la conectividad. */
  reconectando: boolean;
  /** Estado derivado, listo para pintar. */
  estado: EstadoConexion;
  /** Comprobación manual de conectividad (botón "Reintentar"). */
  reintentar: () => Promise<boolean>;
}

const MAX_INTENTOS_SONDA = 3;
const ESPERA_ENTRE_SONDAS_MS = 1500;
const ESPERA_TRAS_ONLINE_MS = 900;

/** Espera activa entre dos intentos de sonda. */
function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

/**
 * Hook que expone el estado de conexión a internet de la aplicación.
 * - `offline` → la aplicación queda sin salida a internet.
 * - `online`  → se confirma la red con una sonda y, si responde, se vuelve a la normalidad.
 */
export function useEstadoConexion(): UseEstadoConexion {
  const [hayConexion, setHayConexion] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  const [reconectando, setReconectando] = useState(false);

  const montado = useRef(true);
  const temporizadores = useRef<number[]>([]);

  useEffect(() => {
    montado.current = true;

    const programar = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      temporizadores.current.push(id);
      return id;
    };

    /** Confirma la salida a internet. Si la sonda insiste en fallar se
     *  confiaría en `navigator.onLine` (podría estar bloqueada por una CSP). */
    const confirmar = async (): Promise<boolean> => {
      for (let intento = 0; intento < MAX_INTENTOS_SONDA; intento += 1) {
        if (!montado.current) return false;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setHayConexion(false);
          setReconectando(false);
          return false;
        }

        const responde = await hayConectividadReal();
        if (!montado.current) return false;
        if (responde) {
          setHayConexion(true);
          setReconectando(false);
          return true;
        }

        if (intento < MAX_INTENTOS_SONDA - 1) {
          await esperar(ESPERA_ENTRE_SONDAS_MS);
        }
      }

      // La sonda no respondió: se delega en `navigator.onLine` para no dejar
      // la aplicación bloqueada por un bloqueo externo (CSP, proxy, etc.).
      const enLinea = typeof navigator === "undefined" ? true : navigator.onLine;
      setHayConexion(enLinea);
      setReconectando(false);
      return enLinea;
    };

    const alConectar = () => {
      setReconectando(true);
      setHayConexion(true);
      void confirmar();
      programar(() => setReconectando(false), ESPERA_TRAS_ONLINE_MS);
    };

    const alDesconectar = () => {
      setHayConexion(false);
      setReconectando(false);
    };

    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);

    // El estado pudo cambiar antes de que se registraran los listeners.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      alDesconectar();
    }

    return () => {
      montado.current = false;
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
      temporizadores.current.forEach((id) => window.clearTimeout(id));
      temporizadores.current = [];
    };
  }, []);

  const reintentar = useCallback(async () => {
    setReconectando(true);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setHayConexion(false);
      setReconectando(false);
      return false;
    }
    const responde = await hayConectividadReal();
    if (!montado.current) return responde;
    setHayConexion(responde || navigator.onLine);
    setReconectando(false);
    return responde;
  }, []);

  const estado: EstadoConexion = !hayConexion
    ? "sin-conexion"
    : reconectando
      ? "reconectando"
      : "en-linea";

  return { hayConexion, reconectando, estado, reintentar };
}

export default useEstadoConexion;
