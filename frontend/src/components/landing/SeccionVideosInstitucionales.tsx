import { Maximize2, PlayCircle, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { VIDEOS_INSTITUCIONALES, type VideoInstitucional } from "../../data/carruselPortada";

export default function SeccionVideosInstitucionales() {
  const [destacado, setDestacado] = useState<VideoInstitucional | null>(null);
  const videosRef = useRef<Record<string, HTMLVideoElement | null>>({});
  const playerRef = useRef<HTMLVideoElement>(null);
  const tiempoRef = useRef(0);

  const abrirConSonido = useCallback((video: VideoInstitucional) => {
    const elemento = videosRef.current[video.id];
    if (elemento) {
      tiempoRef.current = elemento.currentTime;
      elemento.muted = true;
      elemento.pause();
    }
    setDestacado(video);
  }, []);

  const cerrar = useCallback(() => {
    const id = destacado?.id;
    setDestacado(null);
    if (!id) return;
    const elemento = videosRef.current[id];
    if (elemento) {
      elemento.muted = true;
      void elemento.play().catch(() => undefined);
    }
  }, [destacado]);

  useEffect(() => {
    if (!destacado) return;

    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
    };
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", alPresionarTecla);

    return () => {
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener("keydown", alPresionarTecla);
    };
  }, [destacado, cerrar]);

  return (
    <section id="videos" className="scroll-mt-24 bg-slate-50 py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-[#E6007E]">
            <PlayCircle aria-hidden="true" className="h-4 w-4" />
            Galería audiovisual
          </span>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[#003366] sm:text-3xl">
            Videos institucionales
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Se reproducen en silencio. Activa el sonido para verlos centrados y luego ampliarlos si lo deseas.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {VIDEOS_INSTITUCIONALES.map((video) => (
            <article
              key={video.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative aspect-video w-full bg-black">
                <video
                  ref={(elemento) => {
                    videosRef.current[video.id] = elemento;
                  }}
                  src={video.src}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                  muted
                  autoPlay
                  loop
                  preload="metadata"
                  onVolumeChange={(evento) => {
                    const elemento = evento.currentTarget;
                    if (!elemento.muted && elemento.volume > 0 && destacado?.id !== video.id) {
                      abrirConSonido(video);
                    }
                  }}
                >
                  Tu navegador no admite la reproducción de video.
                </video>

                <button
                  type="button"
                  onClick={() => abrirConSonido(video)}
                  className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur transition hover:bg-black/75"
                >
                  <Volume2 aria-hidden="true" className="h-3.5 w-3.5" />
                  Activar sonido
                </button>
              </div>

              <div className="p-4 sm:p-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#003366]/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#003366]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#E6007E]" />
                  {video.categoria}
                </span>
                <h3 className="mt-2 text-lg font-black tracking-tight text-[#003366]">{video.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{video.descripcion}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {destacado &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Reproduciendo ${destacado.titulo} con sonido`}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={cerrar}
          >
            <div
              className="w-full max-w-lg animate-[video-centrar_320ms_ease-out] overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/60"
              onClick={(evento) => evento.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 bg-[#04213f] px-4 py-2.5 text-white">
                <span className="truncate text-xs font-bold">{destacado.titulo}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void playerRef.current?.requestFullscreen?.()}
                    aria-label="Ver en pantalla completa"
                    className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    <Maximize2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cerrar}
                    aria-label="Cerrar y volver a la sección"
                    className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <video
                ref={playerRef}
                src={destacado.src}
                className="max-h-[60vh] w-full object-contain"
                autoPlay
                controls
                playsInline
                onLoadedMetadata={(evento) => {
                  if (tiempoRef.current > 0) {
                    evento.currentTarget.currentTime = tiempoRef.current;
                  }
                }}
              >
                Tu navegador no admite la reproducción de video.
              </video>

              <p className="px-4 py-2 text-center text-[11px] leading-snug text-slate-300">
                Reproduciendo con sonido. Usa el botón de pantalla completa si quieres verlo más grande.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
