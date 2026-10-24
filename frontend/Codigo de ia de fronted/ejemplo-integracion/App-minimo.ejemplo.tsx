import { BrowserRouter } from "react-router-dom";
import AsistenteIA from "../src/components/asistente/AsistenteIA";

// App mínima solo para probar el chat IA aislado
export default function AppMinimo() {
  return (
    <BrowserRouter>
      <div style={{ padding: 24 }}>
        <h1>Prueba Asistente IA</h1>
        <p>Escribe: "llevame a mi casilla", "perdi mi CUT", "como valido un CVD"</p>
      </div>
      <AsistenteIA />
    </BrowserRouter>
  );
}
