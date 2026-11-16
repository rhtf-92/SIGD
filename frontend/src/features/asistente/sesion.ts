import { BIENVENIDA, type RespuestaOrientacion } from './conocimiento';

export interface MensajeOrientacion {
  id: number;
  autor: 'asistente' | 'ciudadano';
  contenido: RespuestaOrientacion;
}

// Solo memoria de esta pestaña; recargar la página elimina la conversación.
// No se utilizan cookies, localStorage, backend ni telemetría.
let secuencia = 1;
let historial: MensajeOrientacion[] = [{ id: 0, autor: 'asistente', contenido: BIENVENIDA }];

export function leerHistorial(): MensajeOrientacion[] { return historial; }
export function borrarHistorial(): MensajeOrientacion[] {
  historial = [{ id: secuencia++, autor: 'asistente', contenido: BIENVENIDA }];
  return historial;
}
export function agregarIntercambio(textoSeguro: string, respuesta: RespuestaOrientacion): MensajeOrientacion[] {
  const nuevos: MensajeOrientacion[] = [
    { id: secuencia++, autor: 'ciudadano', contenido: { texto: textoSeguro } },
    { id: secuencia++, autor: 'asistente', contenido: respuesta },
  ];
  historial = [historial[0], ...historial.slice(1).concat(nuevos).slice(-58)];
  return historial;
}
