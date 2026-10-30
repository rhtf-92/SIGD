import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useSesion } from "../../config/accesoModulos";
import { ROLES_INTERNOS } from "../../config/accesoModulos";
import { DIAPOSITIVAS_PORTADA } from "../../data/carruselPortada";

const INTERVALO_MS = 5000;

export default function HeroInstitucional() {
  const { rol } = useSesion();
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = DIAPOSITIVAS_PORTADA.length;
  const diapositiva = DIAPOSITIVAS_PORTADA[indice];

  // Las imágenes de portada SOLO se renderizan para: invitado (sin sesión),
  // estudiante / usuario externo. Cualquier otro rol interno o administrativo
  // (SUPER_ADMIN, DIRECTOR, director_general, DOCENTE, MESA_PARTES,
  // mesa_de_partes, etc.) recibe una portada limpia sin imágenes.
  const rolStr = (rol ?? "") as import("../../config/accesoModulos").RolCanonico;
  const mostrarImagen =
    !rolStr ||
    rolStr === "ESTUDIANTE" ||
    rolStr === "OTROS" ||
    !ROLES_INTERNOS.includes(rolStr);

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
    <section className="relative bg-[#04213f] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-[-10%] h-[600px] w-[600px] rounded-full bg-[#006EC7]/35 blur-[120px]" />
        <div className="absolute -right-20 bottom-[-10%] h-[600px] w-[600px] rounded-full bg-[#E6007E]/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[#04213f]/40" />
      </div>

      {/* ---------- BANNER CORPORATIVO (solo roles externos) ---------- */}
      {mostrarImagen && (
        <div
          role="region"
          aria-roledescription="carrusel"
          aria-label="Portada institucional IESTP Suiza"
          className="relative w-full overflow-hidden border-b border-white/10"
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
          <div className="relative h-[520px] sm:h-[620px] lg:h-[720px] w-full">
            {/* Imagen de fondo (contiene toda la diapositiva sin recortes laterales) */}
            <img
              key={`fondo-${diapositiva.id}`}
              src={diapositiva.src}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />

            {/* Gradiente oscuro sobre la imagen para que el texto contraste */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#04213f]/90 via-[#04213f]/60 to-transparent"
            />

            {/* Layout tipo banner: 2 columnas en desktop, 1 columna apilada en mobile */}
            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-full w-full">
              <div
                className={`grid h-full items-center gap-6 lg:gap-10 ${
                  mostrarImagen ? "lg:grid-cols-[45%_55%]" : "grid-cols-1"
                }`}
              >
                {/* Columna Izquierda: Imagen tipo máscara con borde celeste marino */}
                <div
                  className="relative flex items-center justify-center lg:pr-4"
                >
                  <div className="relative z-10 flex h-full w-full flex-col items-center justify-center">
                    <div
                      className={`relative h-[340px] sm:h-[420px] lg:h-[560px] w-full max-w-md sm:max-w-lg lg:max-w-xl rounded-[3rem] overflow-hidden border-4 border-[#00AEEF]/60 bg-[#04213f] shadow-[0_0_40px_rgba(0,174,239,0.35)]`}
                    >
                      <img
                        key={diapositiva.id}
                        src={diapositiva.src}
                        alt={diapositiva.titulo}
                        className="h-full w-full object-cover object-center"
                        loading={indice === 0 ? "eager" : "lazy"}
                      />
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-cyan-300/90 text-xs font-semibold uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00AEEF]" aria-hidden="true" />
                      IESTP Pública “Suiza” · Pucallpa
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Fondo oscuro con títulos y botones de acción */}
                <div className="flex flex-col justify-center lg:pl-8 text-white">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100 mb-2">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F9E000]" />
                    IESTP Suiza · Gestión Documental
                  </span>
                  <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
                    {diapositiva.titulo}
                  </h1>
                  <p className="mt-3 max-w-lg text-base leading-relaxed text-blue-100/90 sm:text-lg lg:text-xl">
                    {diapositiva.descripcion}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      to="/tramite"
                      className="inline-flex items-center gap-2.5 rounded-lg bg-[#00AEEF] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#00AEEF]/30 transition hover:bg-[#0072CE] sm:px-6 sm:py-3.5 sm:text-base"
                    >
                      Iniciar un trámite
                      <ArrowRight aria-hidden="true" className="h-5 w-5" />
                    </Link>
                    <Link
                      to="/consulta"
                      className="inline-flex items-center gap-2.5 rounded-lg border border-white/30 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:border-white/60 hover:bg-white/10 sm:px-6 sm:py-3.5 sm:text-base"
                    >
                      Consultar con CUT
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Indicadores de diapositiva */}
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30 pointer-events-auto"
            >
              {DIAPOSITIVAS_PORTADA.map((item, posicion) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndice(posicion)}
                  aria-label={`Ir a la diapositiva ${posicion + 1}: ${item.titulo}`}
                  aria-current={posicion === indice}
                  className={`h-1.5 rounded-full transition-all ${
                    posicion === indice ? "w-10 bg-[#F9E000]" : "w-2.5 bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>

            {/* Controles de navegación manual */}
            <div className="absolute inset-y-0 left-4 right-4 flex justify-between items-center z-30 pointer-events-none">
              <button
                type="button"
                onClick={() => mover(-1)}
                aria-label="Diapositiva anterior"
                className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/30 text-white/80 backdrop-blur-md transition hover:border-white/60 hover:text-white"
              >
                <ChevronLeft aria-hidden="true" className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => mover(1)}
                aria-label="Diapositiva siguiente"
                className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/30 text-white/80 backdrop-blur-md transition hover:border-white/60 hover:text-white"
              >
                <ChevronRight aria-hidden="true" className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- PORTADA LIMPIA para roles internos (sin imágenes) ---------- */}
      {!mostrarImagen && (
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F9E000]" />
            IESTP Suiza · Gestión Documental
          </span>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
            {diapositiva.titulo}
          </h1>
          <p className="mt-3 max-w-lg mx-auto text-base leading-relaxed text-blue-100/90 sm:text-lg lg:text-xl">
            {diapositiva.descripcion}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/tramite"
              className="inline-flex items-center gap-2.5 rounded-lg bg-[#E6007E] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#E6007E]/30 transition hover:bg-[#c90070] sm:px-6 sm:py-3.5 sm:text-base"
            >
              Iniciar un trámite
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
            <Link
              to="/consulta"
              className="inline-flex items-center gap-2.5 rounded-lg border border-white/30 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:border-white/60 hover:bg-white/10 sm:px-6 sm:py-3.5 sm:text-base"
            >
              Consultar con CUT
            </Link>
          </div>
          <div
            role="group"
            aria-label="Seleccionar diapositiva"
            className="mt-8 flex items-center gap-2"
          >
            {DIAPOSITIVAS_PORTADA.map((item, posicion) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndice(posicion)}
                aria-label={`Ir a la diapositiva ${posicion + 1}: ${item.titulo}`}
                aria-current={posicion === indice}
                className={`h-1.5 rounded-full transition-all ${
                  posicion === indice ? "w-10 bg-[#F9E000]" : "w-2.5 bg-white/20 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
