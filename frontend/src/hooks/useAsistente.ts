/**
 * Módulo: Hook del Asistente Virtual Institucional (AsistenteCore)
 * Orquesta el estado de la conversación del widget de chat.
 */

import { useCallback, useMemo, useState } from "react";
import { asistenteService } from "../services/asistenteService";
import type { MensajeAsistente } from "../types/asistente";

const MENSAJE_BIENVENIDA =
  "¡Hola! Soy el asistente virtual del SIGD del IESTP “Suiza”. Puedo explicarte qué es esta web, cómo usarla y " +
  "cómo llegar a la sede, además de orientarte sobre el TUPA, requisitos, tarifas, horarios, plazos legales, " +
  "seguimiento de trámites, casilla electrónica, firma digital y validación de documentos. ¿En qué necesitas ayuda?";

const LIMITE_MENSAJES = 100;

function generarId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function crearMensaje(
  rol: MensajeAsistente["rol"],
  texto: string,
  extras: Partial<MensajeAsistente> = {},
): MensajeAsistente {
  return {
    id: generarId(),
    rol,
    texto,
    fecha: new Date().toISOString(),
    ...extras,
  };
}

export interface UseAsistenteResult {
  mensajes: MensajeAsistente[];
  cargando: boolean;
  error: string | null;
  enviar: (mensaje: string) => Promise<void>;
  reiniciar: () => void;
}

export function useAsistente(): UseAsistenteResult {
  const [mensajes, setMensajes] = useState<MensajeAsistente[]>(() => [
    crearMensaje("asistente", MENSAJE_BIENVENIDA),
  ]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = useCallback(async (mensaje: string) => {
    const texto = mensaje.trim();
    if (texto.length === 0 || cargando) return;

    setError(null);
    setMensajes((previa) => {
      const siguiente = [...previa, crearMensaje("usuario", texto)];
      return siguiente.slice(-LIMITE_MENSAJES);
    });
    setCargando(true);

    try {
      const respuesta = await asistenteService.consultar({ mensaje: texto });
      setMensajes((previa) => {
        const siguiente = [
          ...previa,
          crearMensaje("asistente", respuesta.respuesta, {
            fuentes: respuesta.fuentes,
            sugerencias: respuesta.sugerencias,
            enlaces: respuesta.enlaces ?? [],
          }),
        ];
        return siguiente.slice(-LIMITE_MENSAJES);
      });
    } catch {
      setError(
        "No pude conectarme con el asistente en este momento. Inténtalo nuevamente en unos instantes.",
      );
    } finally {
      setCargando(false);
    }
  }, [cargando]);

  const reiniciar = useCallback(() => {
    setMensajes([crearMensaje("asistente", MENSAJE_BIENVENIDA)]);
    setError(null);
  }, []);

  return useMemo(
    () => ({ mensajes, cargando, error, enviar, reiniciar }),
    [mensajes, cargando, error, enviar, reiniciar],
  );
}
