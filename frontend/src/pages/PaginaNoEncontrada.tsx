// Página 404 del SIGD.
// Sustituye al redireccionamiento silencioso a "/" del router: la ruta
// solicitada no corresponde a ningún módulo y se informa con la escena del
// cavernícola desenchufando el cable de la red.
import { ArrowLeft, House } from "lucide-react";
import { Link } from "react-router-dom";

import EscenaErrorConexion from "../components/common/EscenaErrorConexion";

export default function PaginaNoEncontrada() {
  return (
    <main className="flex w-full items-center justify-center py-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <EscenaErrorConexion
          codigo="Error 404"
          titulo="Esta página no existe en la caverna"
          descripcion="La dirección solicitada no corresponde a ningún módulo del Sistema Integral de Gestión Documentaria. Es posible que el enlace esté incompleto o que el documento haya sido reubicado."
        >
          <Link to="/" className="btn-primary">
            <House size={16} strokeWidth={2.75} /> Volver al inicio
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.history.back()}
          >
            <ArrowLeft size={16} strokeWidth={2.75} /> Regresar
          </button>
        </EscenaErrorConexion>
      </div>
    </main>
  );
}
