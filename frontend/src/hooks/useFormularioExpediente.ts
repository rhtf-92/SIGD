import { useRef, useState } from "react";
import type { AccionExpediente } from "../types/expedienteActions";
import { adaptarErrorAccion } from "../utils/expedienteActions";
import {
  generarClaveIdempotencia,
  establecerClaveIdempotenciaActiva,
  limpiarClaveIdempotenciaActiva,
} from "../utils/idempotency";

export function useFormularioExpediente<Entrada, Salida>(accion: AccionExpediente<Entrada, Salida>) {
  const enviando = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Inicializar clave estable para la intención actual del formulario
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current = generarClaveIdempotencia();
  }

  return {
    pending: procesando || accion.pending,
    error: errorLocal ?? accion.error?.message,
    idempotencyKey: idempotencyKeyRef.current,
    enviar: async (entrada: Entrada, completado: () => void) => {
      if (enviando.current || accion.pending || !accion.disponible) return;
      enviando.current = true;
      setProcesando(true);
      setErrorLocal(null);

      // Asegurar que los reintentos usen la misma clave de la intención en curso
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = generarClaveIdempotencia();
      }
      establecerClaveIdempotenciaActiva(idempotencyKeyRef.current);

      try {
        if (await accion.ejecutar(entrada)) {
          // Éxito: purgar clave activa y renovar para intenciones posteriores
          limpiarClaveIdempotenciaActiva();
          idempotencyKeyRef.current = null;
          accion.restablecer();
          completado();
        }
      } catch (error) {
        // En caso de fallo, NO borramos idempotencyKeyRef.current
        // El reintento usará exactamente la misma clave
        setErrorLocal(adaptarErrorAccion(error).message);
      } finally {
        enviando.current = false;
        setProcesando(false);
      }
    },
    regenerarClave: () => {
      idempotencyKeyRef.current = generarClaveIdempotencia();
      establecerClaveIdempotenciaActiva(idempotencyKeyRef.current);
    },
  };
}
