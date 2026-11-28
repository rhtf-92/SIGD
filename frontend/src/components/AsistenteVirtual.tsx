import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { detalleAsistente, resolverConsultaAsistente } from "../services/asistente";
import { tupaApi, type TupaTramite } from "../services/tupaApi";

type AssistantMessage = {
  id: number;
  autor: "asistente" | "usuario";
  texto: string;
  tramites?: TupaTramite[];
  ficha?: TupaTramite;
  acciones?: { texto: string; tipo: "buscar" | "ruta"; ruta?: string; ayuda?: string }[];
};

const accionesIniciales: AssistantMessage["acciones"] = [
  { texto: "Buscar un trámite", tipo: "buscar" },
  { texto: "Consultar mi expediente", tipo: "ruta", ruta: "/consulta", ayuda: "Puedes consultar el estado en la página pública de expediente. Ingresa tu CUT allí, no en este chat." },
  { texto: "Registrarme", tipo: "ruta", ruta: "/registro", ayuda: "El registro ciudadano está disponible en su página institucional." },
  { texto: "Mi Casilla Electrónica", tipo: "ruta", ruta: "/casilla", ayuda: "La Casilla Electrónica requiere una sesión; si no la tienes, el sistema te llevará al inicio de sesión." },
];

export default function AsistenteVirtual() {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensajes, setMensajes] = useState<AssistantMessage[]>([
    {
      id: 0,
      autor: "asistente",
      texto: "¡Hola! Puedo ayudarte a encontrar información del TUPA o llevarte a una sección del SIGD.",
      acciones: accionesIniciales,
    },
  ]);
  const siguienteId = useRef(1);
  const botonAbrir = useRef<HTMLButtonElement>(null);
  const campoConsulta = useRef<HTMLInputElement>(null);
  const abiertoAntes = useRef(false);

  useEffect(() => {
    if (abierto) {
      abiertoAntes.current = true;
      campoConsulta.current?.focus();
    } else if (abiertoAntes.current) {
      abiertoAntes.current = false;
      botonAbrir.current?.focus();
    }
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function cerrarConEscape(evento: globalThis.KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", cerrarConEscape);
    return () => document.removeEventListener("keydown", cerrarConEscape);
  }, [abierto]);

  function agregarMensaje(mensaje: Omit<AssistantMessage, "id">) {
    setMensajes((actuales) => [...actuales, { ...mensaje, id: siguienteId.current++ }]);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = consulta.trim();
    if (!texto || cargando) return;
    setConsulta("");
    agregarMensaje({ autor: "usuario", texto });
    setCargando(true);
    try {
      const resultado = await resolverConsultaAsistente(texto);
      if (resultado.tipo === "ruta") {
        const textoAccion = resultado.ruta === "/casilla"
          ? "Abrir Mi Casilla Electrónica"
          : resultado.ruta === "/consulta"
            ? "Ir a Consulta de expediente"
            : "Ir a Registro ciudadano";
        agregarMensaje({
          autor: "asistente",
          texto: resultado.mensaje,
          acciones: [{ texto: textoAccion, tipo: "ruta", ruta: resultado.ruta }],
        });
      } else if (resultado.tipo === "desconocida") {
        agregarMensaje({ autor: "asistente", texto: resultado.mensaje, acciones: accionesIniciales });
      } else if (resultado.tipo === "conocimiento") {
        for (const respuesta of resultado.respuestas) {
          let texto = respuesta.texto;
          texto += `\n\nFuente: ${respuesta.fuente}`;
          if (!respuesta.validado) {
            texto += "\nPendiente de validación por la dirección.";
          }
          agregarMensaje({ autor: "asistente", texto, acciones: accionesIniciales });
        }
      } else if (resultado.tramites.length) {
        agregarMensaje({
          autor: "asistente",
          texto: `Encontré ${resultado.tramites.length} resultado(s) en el TUPA vigente. Elige uno para ver su ficha:`,
          tramites: resultado.tramites,
        });
      } else {
        agregarMensaje({
          autor: "asistente",
          texto: "No encontré coincidencias en el TUPA vigente. Prueba con otras palabras o elige una de las secciones disponibles.",
          acciones: accionesIniciales,
        });
      }
    } catch {
      agregarMensaje({
        autor: "asistente",
        texto: "No pude consultar el TUPA ahora. Inténtalo nuevamente más tarde.",
        acciones: accionesIniciales,
      });
    } finally {
      setCargando(false);
      campoConsulta.current?.focus();
    }
  }

  async function abrirFicha(codigo: string) {
    setCargando(true);
    try {
      const ficha = await tupaApi.detalle(codigo);
      agregarMensaje({ autor: "asistente", texto: detalleAsistente(ficha), ficha });
    } catch {
      agregarMensaje({ autor: "asistente", texto: "No pude cargar el detalle de ese trámite. Inténtalo nuevamente." });
    } finally {
      setCargando(false);
    }
  }

  function activarAccion(accion: NonNullable<AssistantMessage["acciones"]>[number]) {
    if (accion.tipo === "buscar") {
      campoConsulta.current?.focus();
      return;
    }
    if (accion.ruta) {
      if (accion.ayuda) {
        const textoAccion = accion.ruta === "/casilla"
          ? "Abrir Mi Casilla Electrónica"
          : accion.ruta === "/consulta"
            ? "Ir a Consulta de expediente"
            : "Ir a Registro ciudadano";
        agregarMensaje({
          autor: "asistente",
          texto: accion.ayuda,
          acciones: [{ texto: textoAccion, tipo: "ruta", ruta: accion.ruta }],
        });
        return;
      }
      navigate(accion.ruta);
      setAbierto(false);
    }
  }

  return (
    <div className="sigd-assistant">
      {abierto && (
        <section
          aria-labelledby="sigd-assistant-title"
          className="sigd-assistant-panel"
          role="dialog"
        >
          <header className="sigd-assistant-header">
            <div className="sigd-assistant-header-brand">
              <img
                alt="Escudo del Instituto Suiza"
                className="sigd-assistant-avatar"
                height={32}
                src="/img/logo.jpg"
                width={32}
              />
              <div>
                <h2 id="sigd-assistant-title">Asistente virtual del SIGD</h2>
                <p>Ayuda con información pública del TUPA</p>
              </div>
            </div>
            <button aria-label="Cerrar asistente" className="sigd-assistant-close" onClick={() => setAbierto(false)} type="button">×</button>
          </header>
          <p className="sigd-assistant-notice">
            Responde con datos del TUPA vigente. No reemplaza la atención de Mesa de Partes.
          </p>
          <div aria-live="polite" aria-relevant="additions text" className="sigd-assistant-messages">
            {mensajes.map((mensaje) => (
              <article className={`sigd-assistant-message sigd-assistant-${mensaje.autor}`} key={mensaje.id}>
                <p className="sigd-assistant-message-text">{mensaje.texto}</p>
                {mensaje.tramites && (
                  <div className="sigd-assistant-options">
                    {mensaje.tramites.map((tramite) => (
                      <button key={tramite.tramite_version_id} onClick={() => void abrirFicha(tramite.codigo)} type="button">
                        {tramite.codigo} · {tramite.denominacion}
                      </button>
                    ))}
                  </div>
                )}
                {mensaje.ficha && (
                  <Link className="sigd-assistant-ficha-link" to={`/tupa?codigo=${encodeURIComponent(mensaje.ficha.codigo)}`} onClick={() => setAbierto(false)}>
                    Ver ficha en el TUPA
                  </Link>
                )}
                {mensaje.acciones && (
                  <div className="sigd-assistant-options">
                    {mensaje.acciones.map((accion) => (
                      <button key={accion.texto} onClick={() => activarAccion(accion)} type="button">{accion.texto}</button>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {cargando && <p className="sigd-loading" role="status">Consultando información…</p>}
          </div>
          <form className="sigd-assistant-form" onSubmit={(evento) => void enviar(evento)}>
            <label htmlFor="sigd-assistant-input">Pregunta sobre un trámite (no ingreses datos personales)</label>
            <div>
              <input
                autoComplete="off"
                id="sigd-assistant-input"
                onChange={(evento) => setConsulta(evento.target.value)}
                ref={campoConsulta}
                value={consulta}
              />
              <button className="sigd-button sigd-button-primary" disabled={!consulta.trim() || cargando} type="submit">Enviar</button>
            </div>
          </form>
        </section>
      )}
      <button
        aria-expanded={abierto}
        aria-haspopup="dialog"
        className="sigd-assistant-trigger"
        onClick={() => setAbierto((actual) => !actual)}
        ref={botonAbrir}
        type="button"
      >
        ¿Necesitas ayuda?
      </button>
    </div>
  );
}
