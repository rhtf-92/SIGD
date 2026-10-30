import { useCallback, useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

/* --------------------------------------------------------------------------
   Pantalla de "Error de conexión con el servidor".
   Se monta a nivel de aplicación: en cuanto el navegador pierde la salida a
   internet se muestra esta pantalla, y al recuperar la señal se desvanece
   sola sin bloquear el renderizado general ni las llamadas internas de la API.
   -------------------------------------------------------------------------- */
export function ErrorConexion() {
  const [hayConexion, setHayConexion] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  const [montada, setMontada] = useState(!hayConexion);

  useEffect(() => {
    const alConectar = () => setHayConexion(true);
    const alDesconectar = () => setHayConexion(false);
    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setHayConexion(false);
    }

    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
    };
  }, []);

  // Montaje/desmontaje diferidos para transición fluida.
  useEffect(() => {
    if (!hayConexion) {
      const id = window.setTimeout(() => setMontada(true), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setMontada(false), 450);
    return () => window.clearTimeout(id);
  }, [hayConexion]);

  // Evita desplazamiento de fondo mientras la pantalla está activa.
  useEffect(() => {
    if (!montada) return;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowPrevio;
    };
  }, [montada]);

  const reintentar = useCallback(() => {
    window.location.reload();
  }, []);

  if (!montada) return null;

  return (
    <div
      role="alert"
      aria-label="Error de conexión con el servidor"
      className="fixed inset-0 z-[120] flex overflow-y-auto bg-[#060f24]/95 px-4 py-8 backdrop-blur-sm transition-opacity duration-500"
    >
      <div className="m-auto w-full max-w-3xl shrink-0 overflow-hidden rounded-2xl shadow-2xl shadow-black/50 border border-amber-500/30">
        <div className="p-8 bg-[#04213f]/40 rounded-xl border border-amber-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-900 animate-ping">
              <RefreshCw className="h-4 w-4 text-amber-300 animate-spin" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold uppercase tracking-wider text-amber-100">
              Error de conexión con el servidor
            </span>
          </div>
          <p className="text-sm text-amber-200/90 mb-6 leading-relaxed">
            El navegador se quedó sin salida a internet o el servidor no responde.
            Revisa tu conexión (router, cable de red o datos móviles). La pantalla
            se cerrará sola en cuanto vuelva la red.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={reintentar}
              className="btn-primary w-full sm:w-auto"
            >
              <WifiOff size={16} strokeWidth={2.75} className="mr-2" />
              Reintentar conexión
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 font-semibold text-sm hover:bg-amber-500/20"
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
