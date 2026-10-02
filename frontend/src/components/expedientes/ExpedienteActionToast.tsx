import type { NotificacionExpediente } from "../../types/expedienteActions";
import "./expedientes.css";

export default function ExpedienteActionToast({ notificacion, onClose }: { notificacion: NotificacionExpediente | null; onClose: () => void }) {
  return <div className="m03" aria-live="polite" aria-atomic="true">
    {notificacion ? <div className="m03-toast" data-tipo={notificacion.tipo} role={notificacion.tipo === "error" ? "alert" : "status"}>
      <p>{notificacion.mensaje}</p><button type="button" className="mt-2 underline" onClick={onClose}>Cerrar notificación</button>
    </div> : null}
  </div>;
}
