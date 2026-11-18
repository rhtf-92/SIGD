import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Hook isomorfo para ejecutar layout effect en cliente sin advertencias de SSR.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * ScrollToTop: Componente centralizado de restauración y sincronización de scroll.
 *
 * Cumple los requerimientos globales del SIGD 2026:
 * 1. Resetea la posición vertical al tope (top: 0, left: 0) en toda navegación a un módulo o ruta nueva.
 * 2. Si la ruta incluye hash (#ancla), localiza el elemento y se desplaza con scrollIntoView.
 * 3. Aplica a navegación por enlaces, botones, navigate(), redirecciones post-login/logout
 *    y navegación histórica de navegador (Back/Forward).
 * 4. Ejecuta de forma síncrona pre-pintado (useLayoutEffect) para evitar saltos perceptibles.
 */
export default function ScrollToTop() {
  const { pathname, hash, search } = useLocation();

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;

    // Caso 1: Navegación intencional por hash (#privacidad, #terminos, etc.)
    if (hash) {
      const elementId = decodeURIComponent(hash.replace(/^#/, ""));
      const getTargetElement = () =>
        document.getElementById(elementId) ||
        document.querySelector(`[name="${elementId}"]`);

      const target = getTargetElement();
      if (target) {
        target.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }

      // Si el elemento aún no está en el DOM (render diferido o tab), intentar en el siguiente frame
      const frameId = requestAnimationFrame(() => {
        const delayedTarget = getTargetElement();
        if (delayedTarget) {
          delayedTarget.scrollIntoView({ behavior: "auto", block: "start" });
        } else {
          // Fallback seguro si el ancla no existe
          resetWindowScroll();
        }
      });

      return () => cancelAnimationFrame(frameId);
    }

    // Caso 2: Navegación estándar a nueva página -> Inicio superior absoluto
    resetWindowScroll();
  }, [pathname, hash, search]);

  return null;
}

function resetWindowScroll() {
  if (typeof window.scrollTo === "function") {
    try {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    } catch {
      window.scrollTo(0, 0);
    }
  }

  // Resguardo defensivo para navegadores y contenedores con scroll de documento
  if (typeof document !== "undefined") {
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    }
  }
}
