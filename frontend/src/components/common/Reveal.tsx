// Revelado al hacer scroll: envuelve secciones para animarlas cuando
// entran al viewport (una sola vez). Respeta `prefers-reduced-motion`
// mediante CSS (se muestra directo sin animación).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Retardo escalonado en ms */
  delay?: number;
  variant?: "up" | "scale" | "left";
  className?: string;
  id?: string;
}

const VARIANTES: Record<NonNullable<RevealProps["variant"]>, string> = {
  up: "",
  scale: "reveal-io-scale",
  left: "reveal-io-left",
};

export default function Reveal({ children, delay = 0, variant = "up", className = "", id }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Sin IntersectionObserver (SSR/tests antiguos): visible desde el inicio.
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
      className={`reveal-io ${VARIANTES[variant]} ${visible ? "is-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
