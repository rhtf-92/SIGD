import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import CcdFoliadoConectado from "../components/expedientes/CcdFoliadoConectado";
import "../index.css";
function Pantalla() {
  const [id, setId] = useState(""); const [consulta, setConsulta] = useState("");
  return <main className="m03 mx-auto max-w-5xl p-6"><h1 className="m03-heading">Entrega individual · CCD y foliado · Piero Bartra</h1>
    <form onSubmit={e => { e.preventDefault(); setConsulta(id); }}><label>Identificador del expediente <input value={id} onChange={e => setId(e.target.value)} inputMode="numeric" required /></label><button className="btn-primary">Consultar servidor</button></form>
    {consulta ? <CcdFoliadoConectado key={consulta} baseUrl={import.meta.env.VITE_API_BASE_URL || window.location.origin} expedienteId={consulta} /> : null}
  </main>;
}
const raiz = document.getElementById("root"); if (raiz) createRoot(raiz).render(<StrictMode><Pantalla /></StrictMode>);
