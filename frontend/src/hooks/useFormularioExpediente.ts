import { useRef, useState } from "react";
import type { AccionExpediente } from "../types/expedienteActions";
import { adaptarErrorAccion } from "../utils/expedienteActions";

export function useFormularioExpediente<Entrada, Salida>(accion: AccionExpediente<Entrada, Salida>) {
  const enviando = useRef(false);
  const [procesando, setProcesando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  return {
    pending: procesando || accion.pending,
    error: errorLocal ?? accion.error?.message,
    enviar: async (entrada: Entrada, completado: () => void) => {
      if (enviando.current || accion.pending || !accion.disponible) return;
      enviando.current = true;
      setProcesando(true);
      setErrorLocal(null);
      try {
        if (await accion.ejecutar(entrada)) { accion.restablecer(); completado(); }
      } catch (error) {
        setErrorLocal(adaptarErrorAccion(error).message);
      } finally { enviando.current = false; setProcesando(false); }
    },
  };
}
