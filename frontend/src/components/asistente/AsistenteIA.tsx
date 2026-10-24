import { useEffect, useRef, useState, type FormEvent } from "react";
import { SUGERENCIAS_INICIALES } from "../../data/asistenteConocimiento";
import { useAsistenteIA } from "../../hooks/useAsistenteIA";

type ReconocimientoVoz = {
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  lang: string;
  interimResults: boolean;
};

function crearReconocimiento(onTexto: (t: string) => void, onFin: () => void): ReconocimientoVoz | null {
  try {
    const w = window as unknown as Record<string, new () => ReconocimientoVoz>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = "es-PE";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const texto = e.results?.[0]?.[0]?.transcript;
      if (texto) onTexto(texto);
    };
    rec.onerror = () => onFin();
    rec.onend = () => onFin();
    return rec;
  } catch {
    return null;
  }
}

function formatoHora(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function AsistenteIA() {
  const [abierto, setAbierto] = useState(false);
  const [entrada, setEntrada] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>(() => {
    try {
      const crudo = window.localStorage.getItem("sigd_asistente_feedback_v1");
      return crudo ? (JSON.parse(crudo) as Record<string, "up" | "down">) : {};
    } catch {
      return {};
    }
  });
  const { mensajes, escribiendo, enviar, elegirSugerencia, irA, limpiar, fuenteIA, sugerenciasRuta, iaDisponible } =
    useAsistenteIA();
  const finRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<ReconocimientoVoz | null>(null);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes.length, abierto, escribiendo]);

  // El menú del perfil (Ayuda/Soporte) puede abrir el chat con el evento "sigd:abrir-ayuda".
  useEffect(() => {
    const abrir = () => setAbierto(true);
    const abrirSoporte = () => {
      setAbierto(true);
      try {
        setTimeout(() => {
          if (typeof enviar === "function") {
            enviar("Necesito soporte técnico: tengo un bug, error o la página se congeló. Por favor guíame paso a paso para solucionarlo.");
          }
        }, 250);
      } catch {}
    };
    window.addEventListener("sigd:abrir-ayuda", abrir);
    window.addEventListener("sigd:abrir-soporte", abrirSoporte as EventListener);
    return () => {
      window.removeEventListener("sigd:abrir-ayuda", abrir);
      window.removeEventListener("sigd:abrir-soporte", abrirSoporte as EventListener);
    };
  }, [enviar]);

  const votar = (id: string, voto: "up" | "down") => {
    setFeedback((prev) => {
      const next = { ...prev, [id]: voto };
      try {
        window.localStorage.setItem("sigd_asistente_feedback_v1", JSON.stringify(next));
      } catch { /* noop */ }
      return next;
    });
  };

  const onEnviar = (e?: FormEvent) => {
    e?.preventDefault();
    if (!entrada.trim()) return;
    enviar(entrada);
    setEntrada("");
  };

  const alternarVoz = () => {
    if (escuchando) {
      recRef.current?.stop();
      setEscuchando(false);
      return;
    }
    const rec = crearReconocimiento(
      (t) => {
        setEntrada(t);
        setEscuchando(false);
      },
      () => setEscuchando(false),
    );
    if (!rec) return;
    recRef.current = rec;
    setEscuchando(true);
    rec.start();
  };

  const atajos = mensajes.length <= 2 ? SUGERENCIAS_INICIALES.slice(0, 4) : sugerenciasRuta.map((s) => s.ejemplo).slice(0, 3);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar asistente" : "Abrir asistente de ayuda y soporte"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-blue-900 text-2xl text-white shadow-xl transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 print:hidden"
      >
        {abierto ? "✕" : "🤖"}
      </button>

      {abierto && (
        <section
          aria-label="Asistente virtual SIGD - Soporte y Ayuda"
          className="fixed right-5 z-50 flex h-[560px] max-h-[85vh] w-[min(94vw,400px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl print:hidden"
          style={{ bottom: "5.5rem" }}
        >
          <header className="flex items-center justify-between gap-2 bg-gradient-to-r from-blue-800 to-blue-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg">
                🤖
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold leading-tight">
                  JARVIS • Soporte IA SIGD
                  <span
                    title={iaDisponible ? "IA en la nube disponible + respaldo local" : "Modo local (sin clave de IA)"}
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${iaDisponible ? "bg-emerald-400/20 text-emerald-100" : "bg-white/15 text-blue-100"}`}
                  >
                    {iaDisponible ? "IA + Local" : "Local"}
                  </span>
                </p>
                <p className="flex items-center gap-1 text-[11px] text-emerald-200">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {fuenteIA === "ia" ? "Respuesta con IA en la nube" : "Soporte y orientación en tiempo real"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={limpiar}
              title="Reiniciar conversación"
              className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
            >
              ↻
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {mensajes.map((m) => (
              <div key={m.id} className={`flex ${m.rol === "usuario" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-5 shadow-sm ${
                    m.rol === "usuario"
                      ? "rounded-br-sm bg-blue-700 text-white"
                      : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-line">{m.texto}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] opacity-60">{formatoHora(m.hora)}</span>
                    {m.rol === "asistente" && m.origen && (
                      <span className="rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-500">
                        {m.origen === "ia" ? "IA nube" : "Local"}
                      </span>
                    )}
                  </div>
                  {m.enlaces && m.enlaces.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.enlaces.map((e) => (
                        <button
                          key={e.ruta + e.etiqueta}
                          type="button"
                          onClick={() => irA(e.ruta)}
                          className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
                        >
                          {e.etiqueta} →
                        </button>
                      ))}
                    </div>
                  )}
                  {m.rol === "asistente" && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        title="Respuesta útil"
                        aria-label="Respuesta útil"
                        onClick={() => votar(m.id, "up")}
                        className={`rounded px-1.5 py-0.5 text-xs ${feedback[m.id] === "up" ? "bg-emerald-100" : "hover:bg-slate-100"}`}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        title="Respuesta no útil"
                        aria-label="Respuesta no útil"
                        onClick={() => votar(m.id, "down")}
                        className={`rounded px-1.5 py-0.5 text-xs ${feedback[m.id] === "down" ? "bg-rose-100" : "hover:bg-slate-100"}`}
                      >
                        👎
                      </button>
                    </div>
                  )}
                  {m.sugerencias && m.sugerencias.length > 0 && (
                    <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Quizás quisiste decir:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.sugerencias.map((s) => (
                          <button
                            key={s.titulo + s.ejemplo}
                            type="button"
                            onClick={() => elegirSugerencia(s.ejemplo)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-800"
                          >
                            {s.ejemplo}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {escribiendo && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-500">
                  <span className="animate-pulse">JARVIS está escribiendo…</span>
                </div>
              </div>
            )}
            <div ref={finRef} />
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-t border-slate-100 bg-white px-3 py-2">
            {atajos.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => elegirSugerencia(s)}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-800"
              >
                {s}
              </button>
            ))}
          </div>

          <form onSubmit={onEnviar} className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
            <input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder={escuchando ? "Escuchando… hable ahora" : "Escriba o dicte su consulta…"}
              aria-label="Escribe tu pregunta"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={alternarVoz}
              title="Dictar por voz"
              aria-label="Dictar por voz"
              className={`rounded-xl px-3 py-2 text-sm font-bold ${escuchando ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              🎙
            </button>
            <button
              type="submit"
              disabled={!entrada.trim() || escribiendo}
              className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-40"
            >
              ➤
            </button>
          </form>
        </section>
      )}
    </>
  );
}
