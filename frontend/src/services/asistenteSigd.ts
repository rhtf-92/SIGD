// Motor de respuesta local del Asistente SIGD.
// Sin red, sin API key: normaliza la pregunta y elige el tema con más
// coincidencias de palabras clave.

import {
  TEMAS_ASISTENTE,
  TEMA_POR_DEFECTO,
  type TemaAsistente,
} from "../data/asistenteConocimiento";

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñü /:.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function responderAsistente(pregunta: string): TemaAsistente {
  const normalizada = normalizarTexto(pregunta);
  if (!normalizada) return TEMA_POR_DEFECTO;

  let mejor: TemaAsistente | null = null;
  let mejorPuntaje = 0;

  for (const tema of TEMAS_ASISTENTE) {
    let puntaje = 0;
    for (const clave of tema.claves) {
      const claveNormalizada = normalizarTexto(clave);
      if (!claveNormalizada) continue;
      if (normalizada.includes(claveNormalizada)) {
        // Las claves multi-palabra ("firma digital", "run dev") valen más.
        puntaje += claveNormalizada.includes(" ") ? 3 : 1;
      }
    }
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = tema;
    }
  }

  return mejor ?? TEMA_POR_DEFECTO;
}
