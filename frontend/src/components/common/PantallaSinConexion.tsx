// Pantalla de "sin conexión a internet".
// Se monta a nivel de aplicación (App.tsx): en cuanto el navegador pierde la
// salida a internet se muestra la escena del cavernícola desenchufando el
// cable y, al recuperar la señal, se desvanece y la aplicación vuelve a la
// normalidad refrescando los datos cacheados.
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useEstadoConexion } from "../../hooks/useEstadoConexion";
import EscenaErrorConexion from "./EscenaErrorConexion";

const DESPLAZE_SALIDA_MS = 450;

export default function PantallaSinConexion() {
  const { hayConexion, reconectando, reintentar } = useEstadoConexion();
  const queryClient = useQueryClient();

  const [montada, setMontada] = useState(!hayConexion);
  // Clave de la secuencia animada: se incrementa cada vez que se pierde la
  // conexión para que la animación del cavernícola arranque desde el principio.
  const [secuencia, setSecuencia] = useState(0);
  const habiaConexion = useRef(hayConexion);

  // Al recuperar la conexión se invalidan las consultas cacheadas: el
  // usuario vuelve a ver información al día y no datos congelados.
  useEffect(() => {
    if (habiaConexion.current === hayConexion) return;
    habiaConexion.current = hayConexion;
    if (hayConexion) void queryClient.invalidateQueries();
  }, [hayConexion, queryClient]);

  // Montaje/desmontaje diferidos: la pantalla aparece en cuanto se pierde la
  // señal y se desmonta después de la transición de salida, para que el
  // desvaneo se vea fluido.
  useEffect(() => {
    if (!hayConexion) {
      const id = window.setTimeout(() => setMontada(true), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setMontada(false), DESPLAZE_SALIDA_MS);
    return () => window.clearTimeout(id);
  }, [hayConexion]);

  // Evita que el fondo siga desplazándose mientras la pantalla está activa.
  useEffect(() => {
    if (!montada) return;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowPrevio;
    };
  }, [montada]);

  // Cada caída de conexión reinicia la secuencia animada del cavernícola.
  useEffect(() => {
    if (hayConexion) return;
    const id = window.setTimeout(() => setSecuencia((n) => n + 1), 0);
    return () => window.clearTimeout(id);
  }, [hayConexion]);

  return (
    <>
      <p role="status" className="sr-only">
        {hayConexion ? "Conexión a internet restablecida." : ""}
      </p>

      {montada && (
        <div
          role="alert"
          aria-label="Error: sin conexión a internet"
          className={`fixed inset-0 z-[120] flex overflow-y-auto bg-[#060f24]/95 px-4 py-8 backdrop-blur-sm transition-opacity duration-500 ${
            hayConexion ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {/* `m-auto` centra la tarjeta cuando hay espacio y, si no cabe,
              la deja arriba para que el overlay pueda desplazarse. */}
          <div className="m-auto w-full max-w-3xl shrink-0 overflow-hidden rounded-2xl shadow-2xl shadow-black/50">
            <EscenaErrorConexion
              codigo="Sin conexión a internet"
              titulo="El cavernícola desenchufó el cable"
              descripcion="El navegador se quedó sin salida a internet, así que el SIGD no puede cargar ni enviar información. Revisa tu conexión (router, cable de red o datos móviles): la pantalla se cerrará sola en cuanto vuelva la red."
              secuencia={secuencia}
            >
              <button
                type="button"
                className="btn-primary"
                onClick={() => void reintentar()}
                disabled={reconectando}
                aria-busy={reconectando}
              >
                {reconectando ? (
                  <LoaderCircle size={16} strokeWidth={2.75} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} strokeWidth={2.75} />
                )}
                {reconectando ? "Reconectando…" : "Reintentar conexión"}
              </button>

              <Link to="/" className="btn-secondary">
                <WifiOff size={16} strokeWidth={2.75} /> Ir al inicio
              </Link>
            </EscenaErrorConexion>
          </div>
        </div>
      )}
    </>
  );
}
