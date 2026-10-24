import { useEffect, useRef, type ReactNode } from "react";

import escenaUnificada from "../../assets/error-404-unificado.svg?inline";

interface EscenaErrorConexionProps {
  codigo: string;
  titulo: string;
  descripcion: string;
  secuencia?: number;
  children?: ReactNode;
}

export default function EscenaErrorConexion({
  codigo,
  titulo,
  descripcion,
  secuencia = 0,
  children,
}: EscenaErrorConexionProps) {
  const imagenRef = useRef<HTMLImageElement>(null);
  const destelloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const imagen = imagenRef.current;
    const destello = destelloRef.current;
    if (!imagen || !destello) return;

    destello.style.animation = "none";

    const reducido =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducido) return;

    let cancelado = false;
    let cuadro = 0;

    const encender = () => {
      if (cancelado) return;
      destello.style.animation = "none";
      void destello.offsetWidth;
      destello.style.animation = "page-404-destello 5.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both";
    };

    const alPintar = () => {
      if (cancelado) return;
      cuadro = window.requestAnimationFrame(encender);
    };

    if (imagen.complete && imagen.naturalWidth > 0) {
      alPintar();
    } else if (typeof imagen.decode === "function") {
      void imagen.decode().then(alPintar, alPintar);
    } else {
      imagen.addEventListener("load", alPintar, { once: true });
    }

    return () => {
      cancelado = true;
      if (cuadro) window.cancelAnimationFrame(cuadro);
    };
  }, [secuencia]);

  return (
    <section className="page_404 page_404_unificado">
      <div className="page_404_escena">
        <img
          key={secuencia}
          ref={imagenRef}
          className="page_404_escena_img"
          src={escenaUnificada}
          alt="Cueva prehistórica con cavernícola desenchufando el cable y recibiendo descarga eléctrica"
          width={600}
          height={360}
        />
      </div>
      <div ref={destelloRef} className="page_404_destello" aria-hidden="true" />
      <div className="page_404_contenido page_404_contenido_fusion">
        <p className="page_404_codigo">{codigo}</p>
        <h1 className="page_404_titulo">{titulo}</h1>
        <p className="page_404_texto">{descripcion}</p>
        {children ? <div className="page_404_acciones">{children}</div> : null}
      </div>
    </section>
  );
}
