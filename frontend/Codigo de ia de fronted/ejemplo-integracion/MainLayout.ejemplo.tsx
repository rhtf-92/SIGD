import type { ReactNode } from "react";
// Ajusta el import según dónde pegaste el archivo:
// Si lo pegaste en src/components/asistente/AsistenteIA.tsx:
import AsistenteIA from "../components/asistente/AsistenteIA";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
      {/* El asistente debe estar dentro de <BrowserRouter> */}
      <AsistenteIA />
    </div>
  );
}

// Abrirlo desde cualquier botón/perfil:
// window.dispatchEvent(new Event("sigd:abrir-ayuda"));
