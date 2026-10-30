import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useSesion } from "../../config/accesoModulos";
import { DIAPOSITIVAS_PORTADA } from "../../data/carruselPortada";

const INTERVALO_MS = 6500;

export default function HeroInstitucional() {
  const { rol } = useSesion();
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = DIAPOSITIVAS_PORTADA.length;
  const diapositiva = DIAPOSITIVAS_PORTADA[indice];

  // El rol "usuario externo" se normaliza a ESTUDIANTE en authStore. Solo ese
  // perfil ve las imágenes principales; administradores, personal interno e
  // invitados reciben una portada sin imágenes para evitar espacios vacíos.
  const mostrarImagen = rol === "ESTUDIANTE";

  useEffect(() => {
    if (pausado) return;
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const temporizador = window.setTimeout(() => {
      setIndice((actual) => (actual + 1) % total);
    }, INTERVALO_MS);

    return () => window.clearTimeout(temporizador);
  }, [indice, pausado, total]);

  const mover = (paso: number) => {
    setIndice((actual) => (actual + paso + total) % total);
  };

  return (
    <section className="relative overflow-hidden bg-[#04213f] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-[#006EC7]/40 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#E6007E]/25 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(4,33,63,0.2),rgba(4,33,63,0.9))]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div
          className={`grid items-center gap-6 ${
            mostrarImagen ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "lg:grid-cols-1"
          }`}
        >
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F9E000]" />
              IESTP Suiza · Gestión Documental
            </span>
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              {diapositiva.titulo}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100/90 sm:text-base">
              {diapositiva.descripcion}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                to="/tramite"
                className="inline-flex items-center gap-2 rounded-lg bg-[#E6007E] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#E6007E]/25 transition hover:bg-[#c90070] sm:text-sm"
              >
                Iniciar un trámite
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                to="/consulta"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition hover:border-white/60 hover:bg-white/10 sm:text-sm"
              >
                Consultar con CUT
              </Link>
            </div>

            <div role="group" aria-label="Seleccionar diapositiva" className="mt-5 flex items-center gap-2">
              {DIAPOSITIVAS_PORTADA.map((item, posicion) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndice(posicion)}
                  aria-label={`Ir a la diapositiva ${posicion + 1}: ${item.titulo}`}
                  aria-current={posicion === indice}
                  className={`h-1.5 rounded-full transition-all ${
                    posicion === indice ? "w-8 bg-[#F9E000]" : "w-3 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>

            <p aria-live="polite" className="sr-only">
              Diapositiva {indice + 1} de {total}: {diapositiva.titulo}
            </p>
          </div>

          {mostrarImagen && (
            <div
              role="region"
              aria-roledescription="carrusel"
              aria-label="Portada institucional IESTP Suiza"
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl shadow-black/40"
              onMouseEnter={() => setPausado(true)}
              onMouseLeave={() => setPausado(false)}
              onFocusCapture={() => setPausado(true)}
              onBlurCapture={() => setPausado(false)}
              onKeyDown={(evento) => {
                if (evento.key === "ArrowLeft") {
                  evento.preventDefault();
                  mover(-1);
                }
                if (evento.key === "ArrowRight") {
                  evento.preventDefault();
                  mover(1);
                }
              }}
            >
              <div className="relative aspect-[4/3] w-full sm:aspect-video lg:aspect-[4/3]">
                <img
                  key={`fondo-${diapositiva.id}`}
                  src={diapositiva.src}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
                />

                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#04213f]/80 via-[#04213f]/10 to-transparent"
                />

                <img
                  key={diapositiva.id}
                  src={diapositiva.src}
                  alt={diapositiva.titulo}
                  className="relative z-10 h-full w-full animate-[portada-fade_500ms_ease-out] object-cover object-center"
                  loading={indice === 0 ? "eager" : "lazy"}
                />

                <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => mover(-1)}
                    aria-label="Diapositiva anterior"
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/30 text-white/80 backdrop-blur transition hover:border-white/60 hover:text-white"
                  >
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(1)}
                    aria-label="Diapositiva siguiente"
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/30 text-white/80 backdrop-blur transition hover:border-white/60 hover:text-white"
                  >
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
