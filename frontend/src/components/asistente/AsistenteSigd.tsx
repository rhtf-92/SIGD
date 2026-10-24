import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";

import {
  SUGERENCIAS_INICIALES,
  type EnlaceAsistente,
} from "../../data/asistenteConocimiento";
import { responderAsistente } from "../../services/asistenteSigd";

interface Mensaje {
  id: number;
  de: "usuario" | "asistente";
  texto: string;
  titulo?: string;
  enlaces?: EnlaceAsistente[];
  sugerencias?: string[];
}

let contadorId = 0;
function siguienteId(): number {
  contadorId += 1;
  return contadorId;
}

const SALUDO_INICIAL: Mensaje = {
  id: 0,
  de: "asistente",
  titulo: "Hola, soy Sigi, tu asistente SIGD",
  texto:
    "Te ayudo con cualquier duda de la página: trámites, CUT, CVD, casilla, login y más. Escríbeme o toca una sugerencia.",
  enlaces: [{ etiqueta: "Mesa de Partes Virtual", to: "/tramite/mesa-partes-virtual" }],
  sugerencias: SUGERENCIAS_INICIALES.slice(0, 4),
};

export default function AsistenteSigd() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([SALUDO_INICIAL]);
  const [entrada, setEntrada] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const temporizador = useRef<number | null>(null);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, escribiendo, abierto]);

  useEffect(() => {
    if (abierto) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [abierto]);

  useEffect(
    () => () => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    },
    [],
  );

  const enviarPregunta = (textoCrudo: string) => {
    const texto = textoCrudo.trim();
    if (!texto || escribiendo) return;
    const pregunta: Mensaje = { id: siguienteId(), de: "usuario", texto };
    setMensajes((prev) => [...prev, pregunta]);
    setEntrada("");
    setEscribiendo(true);
    temporizador.current = window.setTimeout(() => {
      const tema = responderAsistente(texto);
      const respuesta: Mensaje = {
        id: siguienteId(),
        de: "asistente",
        titulo: tema.titulo,
        texto: tema.respuesta,
        enlaces: tema.enlaces,
        sugerencias: tema.sugerencias,
      };
      setMensajes((prev) => [...prev, respuesta]);
      setEscribiendo(false);
    }, 450);
  };

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    enviarPregunta(entrada);
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar asistente SIGD" : "Abrir asistente SIGD"}
        className="fixed bottom-28 right-6 z-[90] grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#006EC7] to-[#B8912A] text-white shadow-2xl shadow-slate-900/30 transition duration-300 hover:-translate-y-1 hover:shadow-slate-900/40"
      >
        {abierto ? <X size={22} /> : <MessageCircle size={22} />}
        {!abierto && (
          <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-white text-[#006EC7] shadow">
            <Sparkles size={13} />
          </span>
        )}
      </button>

      {abierto && (
        <section
          aria-label="Asistente de ayuda SIGD"
          className="fixed bottom-44 right-6 z-[90] flex h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/25 animate-scale-in"
        >
          {/* cabecera */}
          <header className="flex items-center gap-3 bg-gradient-to-r from-[#0a4a83] via-[#006EC7] to-[#B8912A] px-4 py-3 text-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/20">
              <Bot size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold leading-tight">Sigi · Asistente SIGD</p>
              <p className="text-xs text-blue-100/90">Responde al instante · sin salir de la página</p>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar asistente"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/90 transition hover:bg-white/20 hover:text-white"
            >
              <X size={16} />
            </button>
          </header>

          {/* mensajes */}
          <div ref={listaRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4">
            {mensajes.map((m) =>
              m.de === "usuario" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[#006EC7] px-3.5 py-2.5 text-sm font-medium text-white shadow">
                    {m.texto}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
                    {m.titulo && (
                      <p className="mb-1 flex items-center gap-1.5 text-[13px] font-extrabold text-[#0a4a83]">
                        <Bot size={14} className="text-[#B8912A]" />
                        {m.titulo}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed text-slate-700">{m.texto}</p>
                    {m.enlaces && m.enlaces.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.enlaces.map((e) => (
                          <Link
                            key={e.to + e.etiqueta}
                            to={e.to}
                            onClick={() => setAbierto(false)}
                            className="rounded-full bg-[#eef7ff] px-3 py-1.5 text-xs font-bold text-[#0a4a83] transition hover:bg-[#006EC7] hover:text-white"
                          >
                            {e.etiqueta} →
                          </Link>
                        ))}
                      </div>
                    )}
                    {m.sugerencias && m.sugerencias.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-dashed border-slate-200 pt-2.5">
                        {m.sugerencias.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => enviarPregunta(s)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-[#006EC7] hover:text-[#006EC7]"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {escribiendo && (
              <div className="flex justify-start">
                <p
                  aria-live="polite"
                  className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm"
                >
                  <span className="animate-pulse">Sigi está escribiendo…</span>
                </p>
              </div>
            )}
          </div>

          {/* entrada */}
          <form onSubmit={alEnviar} className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
            <label htmlFor="asistente-sigd-entrada" className="sr-only">
              Escribe tu duda sobre la página
            </label>
            <input
              ref={inputRef}
              id="asistente-sigd-entrada"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="Ej. ¿Cómo verifico un CVD?"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#006EC7] focus:bg-white focus:ring-2 focus:ring-[#006EC7]/20"
            />
            <button
              type="submit"
              disabled={!entrada.trim() || escribiendo}
              aria-label="Enviar pregunta"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#006EC7] to-[#B8912A] text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
