import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import EscenaErrorConexion from "./EscenaErrorConexion";

type TipoError = "internet" | "bug" | "hack" | "intentos" | "general";

interface EstadoGlobal {
  tipo: TipoError | null;
  motivo?: string;
}

const EVENTO = "sigd:mostrar-error-sistema";

function obtenerTipo(motivo?: string): TipoError {
  const m = (motivo || "").toLowerCase();
  if (m.includes("conexion") || m.includes("offline") || m.includes("network")) return "internet";
  if (m.includes("hack") || m.includes("ataque") || m.includes("intrusion") || m.includes("xss") || m.includes("sql")) return "hack";
  if (m.includes("intento") || m.includes("bloqueo") || m.includes("brute") || m.includes("fallidos") || m.includes("contrasena")) return "intentos";
  if (m.includes("bug") || m.includes("error") || m.includes("crash") || m.includes("exception")) return "bug";
  return "general";
}

function obtenerContenido(tipo: TipoError) {
  switch (tipo) {
    case "internet":
      return {
        codigo: "Sin conexión",
        titulo: "Problemas de conectividad",
        descripcion: "Se perdió la conexión con el servidor o a internet. La página ha sido bloqueada por seguridad y para evitar inconsistencias.",
      };
    case "hack":
      return {
        codigo: "Alerta de seguridad",
        titulo: "Intento sospechoso detectado",
        descripcion: "Se ha detectado un posible intento de intrusión o manipulación. Por seguridad, el sistema ha activado el modo de protección.",
      };
    case "intentos":
      return {
        codigo: "Bloqueo por seguridad",
        titulo: "Demasiados intentos fallidos",
        descripcion: "Se detectaron múltiples intentos fallidos al iniciar sesión o al validar credenciales. El acceso ha sido restringido temporalmente.",
      };
    case "bug":
      return {
        codigo: "Error del sistema",
        titulo: "Fallo o bug detectado",
        descripcion: "La página presenta problemas o errores inesperados. Se activó la pantalla de recuperación para proteger la integridad del sistema.",
      };
    default:
      return {
        codigo: "Sistema en protección",
        titulo: "Se presentó un problema en el sistema",
        descripcion: "Se ha activado el protocolo de protección por fallas, detección de anomalías o pérdida de conectividad.",
      };
  }
}

export default function PantallaErroresSistema() {
  const [estado, setEstado] = useState<EstadoGlobal>({ tipo: null });
  const [visible, setVisible] = useState(false);
  const prev = useRef<TipoError | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<EstadoGlobal>)?.detail || {};
      const tipo = detail.tipo || obtenerTipo(detail.motivo);
      setEstado({ tipo, motivo: detail.motivo });
      if (prev.current !== tipo) {
        prev.current = tipo;
      }
      setVisible(true);
    };

    window.addEventListener(EVENTO, handler as EventListener);

    const onOffline = () => {
      window.dispatchEvent(new CustomEvent(EVENTO, { detail: { tipo: "internet", motivo: "offline" } }));
    };
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener(EVENTO, handler as EventListener);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

  if (!visible || !estado.tipo) return null;

  const c = obtenerContenido(estado.tipo);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[200] flex overflow-y-auto bg-[#060f24]/98 px-4 py-8"
    >
      <div className="m-auto w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl shadow-black/70">
        <EscenaErrorConexion codigo={c.codigo} titulo={c.titulo} descripcion={c.descripcion}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.location.reload()}
          >
            Recargar sistema
          </button>
          <Link to="/" className="btn-secondary">
            Volver al inicio
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setVisible(false)}
          >
            Entendido
          </button>
        </EscenaErrorConexion>
      </div>
    </div>
  );
}

export function mostrarErrorSistema(motivo: string, tipo?: TipoError) {
  window.dispatchEvent(new CustomEvent("sigd:mostrar-error-sistema", { detail: { tipo: tipo || obtenerTipo(motivo), motivo } }));
}
