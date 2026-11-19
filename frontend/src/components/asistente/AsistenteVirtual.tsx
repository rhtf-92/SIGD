import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowUp, Minus, X } from 'lucide-react';
import { BIENVENIDA, GUIAS, OPCIONES, type RespuestaOrientacion, type Tema } from '../../features/asistente/conocimiento';
import { responderPregunta } from '../../features/asistente/intenciones';
import { agregarIntercambio, borrarHistorial, leerHistorial, type MensajeOrientacion } from '../../features/asistente/sesion';
import CatalogoOrientacion from './CatalogoOrientacion';
import './asistente.css';

const ROBOT = '/images/asistente-virtual-suiza.png';

function OpcionesOrientacion({ elegir }: { elegir: (tema: Tema, texto: string) => void }) {
  return <div className="sigd-assistant-options" aria-label="Opciones de orientación">
    {OPCIONES.map((opcion) => <button type="button" key={opcion.tema}
      onClick={() => elegir(opcion.tema, opcion.texto)}>{opcion.texto}<span aria-hidden="true">›</span></button>)}
  </div>;
}

function MensajeConversacion({ mensaje, ultimo, elegir }: {
  mensaje: MensajeOrientacion; ultimo: boolean; elegir: (tema: Tema, texto: string) => void;
}) {
  return <article className={`sigd-assistant-message sigd-assistant-message-${mensaje.autor}`}>
    <span className="sigd-assistant-author">{mensaje.autor === 'asistente' ? 'Asistente SIGD' : 'Tú'}</span>
    <p>{mensaje.contenido.texto}</p>
    {mensaje.contenido.enlace && <Link className="sigd-assistant-link" to={mensaje.contenido.enlace.ruta}>
      {mensaje.contenido.enlace.texto}<span aria-hidden="true"> ↗</span>
    </Link>}
    {ultimo && mensaje.contenido.menu && <OpcionesOrientacion elegir={elegir} />}
    {ultimo && mensaje.contenido.catalogo && <CatalogoOrientacion />}
  </article>;
}

export default function AsistenteVirtual() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState(leerHistorial);
  const [pregunta, setPregunta] = useState('');
  const lanzadorRef = useRef<HTMLButtonElement>(null);
  const entradaRef = useRef<HTMLTextAreaElement>(null);
  const mensajesRef = useRef<HTMLDivElement>(null);
  const ultimoEnvio = useRef({ texto: '', fecha: 0 });

  useEffect(() => {
    if (abierto) entradaRef.current?.focus({ preventScroll: true });
  }, [abierto]);
  useEffect(() => {
    if (!abierto || !mensajesRef.current) return;
    const contenedor = mensajesRef.current;
    if (mensajes.length === 1) { contenedor.scrollTop = 0; return; }
    const ultimo = contenedor.lastElementChild;
    if (ultimo) contenedor.scrollTop += ultimo.getBoundingClientRect().top - contenedor.getBoundingClientRect().top - 8;
  }, [mensajes, abierto]);

  function ocultar() {
    setAbierto(false);
    setPregunta('');
    requestAnimationFrame(() => lanzadorRef.current?.focus({ preventScroll: true }));
  }
  function agregar(texto: string, respuesta: RespuestaOrientacion) {
    if (ultimoEnvio.current.texto === texto && Date.now() - ultimoEnvio.current.fecha < 500) return;
    ultimoEnvio.current = { texto, fecha: Date.now() };
    setMensajes(agregarIntercambio(texto, respuesta));
  }
  function elegir(tema: Tema, texto: string) { agregar(texto, GUIAS[tema]); }
  function enviar() {
    const texto = pregunta.trim();
    if (!texto) return;
    const { intencion, respuesta } = responderPregunta(texto);
    agregar(intencion === 'privacidad' ? 'Consulta omitida por privacidad.' : texto, respuesta);
    setPregunta('');
  }

  return createPortal(
    <aside className="sigd-assistant" aria-label="Asistente de orientación ciudadana">
      <button ref={lanzadorRef} type="button" className="sigd-assistant-launcher" hidden={abierto}
        aria-label="Asistente virtual. Conversar ahora" aria-controls="sigd-assistant-panel" aria-expanded={abierto}
        onClick={() => setAbierto(true)}>
        <img src={ROBOT} alt="Asistente virtual. Conversar ahora" width="1169" height="1345" draggable={false} />
      </button>
      <section id="sigd-assistant-panel" role="dialog" aria-modal="false" aria-labelledby="sigd-assistant-title"
        className="sigd-assistant-panel" hidden={!abierto} onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); ocultar(); }
        }}>
        <header className="sigd-assistant-header">
          <img src={ROBOT} alt="Robot oficial del SIGD" width="44" height="51" />
          <div className="sigd-assistant-heading">
            <h2 id="sigd-assistant-title">Asistente virtual SIGD</h2>
            <p>Orientación ciudadana</p>
          </div>
          <button type="button" aria-label="Minimizar asistente" onClick={ocultar}><Minus size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Cerrar asistente" onClick={ocultar}><X size={18} aria-hidden="true" /></button>
        </header>
        <p className="sigd-assistant-notice">Guía de los cuatro servicios públicos. No compartas datos personales ni contraseñas.</p>
        <div ref={mensajesRef} className="sigd-assistant-messages" role="log" aria-label="Conversación" aria-live="polite" aria-relevant="additions" tabIndex={0}>
          {mensajes.map((mensaje, indice) => <MensajeConversacion key={mensaje.id} mensaje={mensaje}
            ultimo={abierto && indice === mensajes.length - 1} elegir={elegir} />)}
        </div>
        <div className="sigd-assistant-tools">
          <button type="button" onClick={() => agregar('Menú principal', BIENVENIDA)}>Menú principal</button>
          <button type="button" onClick={() => {
            setMensajes(borrarHistorial()); setPregunta('');
          }}>Borrar conversación</button>
        </div>
        <form className="sigd-assistant-composer" onSubmit={(event) => { event.preventDefault(); enviar(); }}>
          <label htmlFor="sigd-assistant-question" className="sigd-assistant-sr-only">Tu pregunta sobre el SIGD</label>
          <textarea id="sigd-assistant-question" ref={entradaRef} value={pregunta} maxLength={600} rows={2}
            placeholder="Escribe tu pregunta aquí..." onChange={(event) => setPregunta(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); enviar();
              }
            }} />
          <button type="submit" aria-label="Enviar pregunta" disabled={!pregunta.trim()}><ArrowUp size={20} aria-hidden="true" /></button>
        </form>
        <p className="sigd-assistant-footer">Orientación automática con información del SIGD. No realiza trámites.</p>
      </section>
    </aside>, document.body,
  );
}
