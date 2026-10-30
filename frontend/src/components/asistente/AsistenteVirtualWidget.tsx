/**
 * Módulo: Widget del Asistente Virtual Institucional (AsistenteCore)
 * Botón flotante + panel de chat accesible (WCAG 2.1 AA) para atención al
 * administrado. Se monta una única vez en el MainLayout de la SPA.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { Bot, MessageCircle, RotateCcw, Send, User, X } from "lucide-react";
import { useAsistente } from "../../hooks/useAsistente";
import type { MensajeAsistente } from "../../types/asistente";

function BurbujaMensaje({
  mensaje,
  onNavegar,
}: {
  mensaje: MensajeAsistente;
  onNavegar?: () => void;
}) {
  const esUsuario = mensaje.rol === "usuario";
  const enRouter = useInRouterContext();
  return (
    <div className={`flex gap-2 ${esUsuario ? "flex-row-reverse" : "flex-row"}`}>
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          esUsuario ? "bg-cyan-600 text-white" : "bg-blue-800 text-white"
        }`}
        aria-hidden="true"
      >
        {esUsuario ? <User size={16} /> : <Bot size={16} />}
      </span>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
          esUsuario
            ? "bg-cyan-600 text-white"
            : "bg-white text-slate-800 ring-1 ring-slate-200"
        }`}
      >
        <p style={{ whiteSpace: "pre-line" }}>{mensaje.texto}</p>
        {mensaje.enlaces && mensaje.enlaces.length > 0 ? (
          <ul className="sigd-asistente-enlaces" aria-label="Enlaces relacionados">
            {mensaje.enlaces.map((enlace) => (
              <li key={`${enlace.ruta}-${enlace.etiqueta}`}>
                {enRouter ? (
                  <Link
                    className="sigd-asistente-enlace"
                    to={enlace.ruta}
                    title={enlace.descripcion}
                    onClick={onNavegar}
                  >
                    {enlace.etiqueta} →
                  </Link>
                ) : (
                  <a
                    className="sigd-asistente-enlace"
                    href={enlace.ruta}
                    title={enlace.descripcion}
                    onClick={onNavegar}
                  >
                    {enlace.etiqueta} →
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export default function AsistenteVirtualWidget() {
  const [abierto, setAbierto] = useState(false);
  const { mensajes, cargando, error, enviar, reiniciar } = useAsistente();
  const [texto, setTexto] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (contenedorRef.current) {
      contenedorRef.current.scrollTop = contenedorRef.current.scrollHeight;
    }
  }, [mensajes, cargando, abierto]);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  const enviarMensaje = async (evento: FormEvent) => {
    evento.preventDefault();
    const mensaje = texto;
    setTexto("");
    await enviar(mensaje);
  };

  const ultimasSugerencias = mensajes[mensajes.length - 1]?.sugerencias ?? [];

  return (
    <div className="sigd-asistente print:hidden">
      {abierto ? (
        <section
          className="sigd-asistente-panel"
          aria-label="Asistente virtual del SIGD"
        >
          <header className="sigd-asistente-header">
            <div className="flex items-center gap-2">
              <span
                className="grid h-9 w-9 place-items-center rounded-full bg-blue-800 text-white"
                aria-hidden="true"
              >
                <Bot size={18} />
              </span>
              <div>
                <p className="text-sm font-bold text-white">Asistente SIGD</p>
                <p className="text-[11px] text-blue-200">IESTP “Suiza” · en línea</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="sigd-asistente-icono"
                onClick={reiniciar}
                aria-label="Reiniciar conversación"
                title="Reiniciar conversación"
              >
                <RotateCcw size={17} />
              </button>
              <button
                type="button"
                className="sigd-asistente-icono"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar asistente"
                title="Cerrar asistente"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div
            ref={contenedorRef}
            className="sigd-asistente-mensajes"
            role="log"
            aria-live="polite"
            aria-label="Historial de conversación"
          >
            {mensajes.map((mensaje) => (
              <BurbujaMensaje
                key={mensaje.id}
                mensaje={mensaje}
                onNavegar={() => setAbierto(false)}
              />
            ))}
            {cargando ? (
              <div className="flex gap-2">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-800 text-white"
                  aria-hidden="true"
                >
                  <Bot size={16} />
                </span>
                <div className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200">
                  Escribiendo
                  <span className="sigd-asistente-puntos" aria-hidden="true">
                    .
                  </span>
                  <span className="sigd-asistente-puntos" aria-hidden="true">
                    .
                  </span>
                  <span className="sigd-asistente-puntos" aria-hidden="true">
                    .
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="px-3 pb-1 text-xs font-medium text-red-300" role="alert">
              {error}
            </p>
          ) : null}

          {ultimasSugerencias.length > 0 && !cargando ? (
            <div className="sigd-asistente-sugerencias">
              {ultimasSugerencias.map((sugerencia) => (
                <button
                  key={sugerencia}
                  type="button"
                  className="sigd-asistente-sugerencia"
                  onClick={() => enviar(sugerencia)}
                >
                  {sugerencia}
                </button>
              ))}
            </div>
          ) : null}

          <form className="sigd-asistente-form" onSubmit={enviarMensaje}>
            <label htmlFor="sigd-asistente-input" className="sr-only">
              Escribe tu consulta al asistente
            </label>
            <input
              id="sigd-asistente-input"
              ref={inputRef}
              type="text"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Escribe tu consulta…"
              maxLength={500}
              disabled={cargando}
              className="sigd-asistente-input"
            />
            <button
              type="submit"
              className="sigd-asistente-enviar"
              aria-label="Enviar consulta"
              disabled={cargando || texto.trim().length === 0}
            >
              <Send size={17} />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="sigd-asistente-boton"
        onClick={() => setAbierto((valor) => !valor)}
        aria-label={abierto ? "Cerrar asistente virtual" : "Abrir asistente virtual"}
        aria-expanded={abierto}
      >
        {abierto ? <X size={22} /> : <MessageCircle size={22} />}
        {!abierto ? <span className="sigd-asistente-badge">1</span> : null}
      </button>
    </div>
  );
}
