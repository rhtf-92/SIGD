import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

/* --------------------------------------------------------------------------
   Imagen de la portada de animación de carga.
   Archivo existente en:
     Codigo de ia de fronted/PORTADA DE ANIMACION/Gemini_Generated_Image_so5gx6so5gx6so5g.jpg
   -------------------------------------------------------------------------- */
import logoPortadaAnimacion from "../../../Codigo de ia de fronted/PORTADA DE ANIMACION/Gemini_Generated_Image_so5gx6so5gx6so5g.jpg";

export const LOGO_PORTADA = [logoPortadaAnimacion];

/* --------------------------------------------------------------------------
   Detecta si la carga actual es un recarga de página (Ctrl+R / F5),
   no una navegación interna de React Router.
   -------------------------------------------------------------------------- */
export function esRecargaPagina(): boolean {
  try {
    const entradas = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (entradas.length > 0) {
      return entradas[0].type === "reload";
    }
  } catch { /* entorno sin Performance API */ }
  return false;
}

/* ============================================================================
   Animación de carga de página principal (solo en recarga Ctrl+R / F5).
   Ligera y rápida: rotación de logos cada 300 ms, total 1000 ms (máx. 1 s).
   No bloquea la interacción (pointer-events-none en el contenedor).
   ============================================================================ */
export function PageLoader({ onReady }: { onReady?: () => void }) {
  const [listo, setListo] = useState(false);
  const [indiceLogo, setIndiceLogo] = useState(0);
  const [logoActual, setLogoActual] = useState<string | null>(null);
  const temporizadorRef = useRef<number | null>(null);
  const finRef = useRef<number | null>(null);

  const esReload = esRecargaPagina();
  const yaMostrado =
    typeof sessionStorage !== "undefined" &&
    sessionStorage.getItem("sigd_carga_mostrada") === "1";

  const debeMostrar = esReload && !yaMostrado;

  useEffect(() => {
    if (!debeMostrar) {
      setListo(true);
      onReady?.();
      return undefined;
    }

    setLogoActual(LOGO_PORTADA[0] ?? null);

    const rotar = () => {
      const siguiente = (indiceLogo + 1) % LOGO_PORTADA.length;
      setIndiceLogo(siguiente);
      setLogoActual(LOGO_PORTADA[siguiente] ?? null);
    };

    temporizadorRef.current = window.setInterval(rotar, 300);

    // Máximo 1 segundo: si algo falla, nunca deja la pantalla congelada.
    finRef.current = window.setTimeout(() => {
      if (temporizadorRef.current) {
        window.clearInterval(temporizadorRef.current);
        temporizadorRef.current = null;
      }
      setListo(true);
      try {
        sessionStorage.setItem("sigd_carga_mostrada", "1");
      } catch {}
      onReady?.();
    }, 1000);

    return () => {
      // Limpieza obligatoria al desmontar (p. ej. navegar a /login) para evitar congelados.
      if (temporizadorRef.current) {
        window.clearInterval(temporizadorRef.current);
        temporizadorRef.current = null;
      }
      if (finRef.current) {
        window.clearTimeout(finRef.current);
        finRef.current = null;
      }
    };
  }, [debeMostrar, indiceLogo, onReady]);

  if (listo || !debeMostrar) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#04213f] pointer-events-none"
      aria-hidden="true"
    >
      <div className="relative flex flex-col items-center gap-4 pointer-events-auto">
        {logoActual && (
          <div
            className="relative h-32 w-32 overflow-hidden rounded-2xl border-2 border-[#F9E000]/40 bg-[#003366]/20 shadow-[0_0_40px_rgba(249,224,0,0.25)] animate-[logo-fade_900ms_ease-in-out]"
          >
            <img
              src={logoActual}
              alt="Logo institucional"
              className="h-full w-full object-contain p-2 opacity-0 animate-[logo-fade-in_700ms_ease-out]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#04213f]/10 to-[#04213f]/60" />
          </div>
        )}
        {!logoActual && (
          <div className="relative h-16 w-16">
            <svg
              className="absolute inset-0 w-full h-full animate-spin text-vault-azul"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
        <h2 className="text-xl font-extrabold tracking-tight text-white">
          Cargando SIGD
        </h2>
        <p className="text-[12px] font-medium text-blue-100/80 uppercase tracking-[0.15em]">
          Sistema Integral de Gestión Documentaria
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   Animación de ERROR DE CONEXIÓN (diferente a la de carga).
   Se muestra cuando el navegador detecta que no hay internet.
   ============================================================================ */
export function ErrorConexion() {
  const [sinConexion, setSinConexion] = useState(!navigator.onLine);
  const [parpadeo, setParpadeo] = useState(false);

  useEffect(() => {
    const onOnline = () => setSinConexion(false);
    const onOffline = () => setSinConexion(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const p = window.setInterval(() => setParpadeo((v) => !v), 1200);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(p);
    };
  }, []);

  if (!sinConexion) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[95] flex items-center gap-3 px-4 py-3 bg-amber-950/95 text-amber-50 backdrop-blur-md border-b border-amber-500/40 shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-900 ${parpadeo ? "animate-ping" : ""}`}
      >
        <RefreshCw className="h-3 w-3 text-amber-300 animate-spin" aria-hidden="true" />
      </div>
      <span className="text-sm font-bold uppercase tracking-wider">
        Error de conexión
      </span>
      <span className="ml-auto text-[11px] font-medium text-amber-200/90">
        Revisá tu red — el sistema se sincronizará al recuperar internet.
      </span>
    </div>
  );
}

/* ============================================================================
   Botón de inicio de sesión con animación de carga.
   ============================================================================ */
export function BotonIngresar({
  cargando,
  disabled,
  onClick,
  children,
}: {
  cargando: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || cargando}
      onClick={onClick}
      className="relative btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden group"
    >
      <span className="flex items-center justify-center gap-2 transition-opacity duration-200 opacity-100 group-data-[cargando=true]:opacity-0 group-data-[cargando=true]:pointer-events-none" data-cargando={String(cargando)}>
        {children}
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-data-[cargando=true]:opacity-100 transition-opacity duration-200 pointer-events-none group-data-[cargando=true]:pointer-events-auto ${cargando ? "animate-ping" : ""}`}
      >
        <Loader2 className="h-5 w-5 text-vault-azul animate-spin" aria-hidden="true" />
        <span className="text-sm font-bold text-vault-azul">Verificando…</span>
      </span>
    </button>
  );
}
