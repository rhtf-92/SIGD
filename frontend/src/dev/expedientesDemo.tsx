import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import CcdTreeSelector from "../components/expedientes/CcdTreeSelector";
import FoliadoDocumentoViewer from "../components/expedientes/FoliadoDocumentoViewer";
import DerivacionModal from "../components/expedientes/DerivacionModal";
import ObservacionModal from "../components/expedientes/ObservacionModal";
import AcumulacionModal from "../components/expedientes/AcumulacionModal";
import ExpedienteActionToast from "../components/expedientes/ExpedienteActionToast";
import { useExpedienteActions } from "../hooks/useExpedienteActions";
import type { DocumentoExpediente, FondoDocumental, RutaCcdSeleccionada } from "../types/ccdArchivistica";
import "../index.css";

// URL del recurso local: evita que Vite lo convierta en data: (prohibido por el visor).
const folioEjemplo = "/src/dev/folio-ejemplo.svg";

// Taxonomía ilustrativa tomada de la documentación CCD; los ID no son del servidor.
const fondos: readonly FondoDocumental[] = [{ tipo: "fondo", id: "muestra-fondo", nombre: "IESTP_SUIZA", secciones: [
  { tipo: "seccion", id: "muestra-sa", nombre: "Secretaría Académica", series: [
    { tipo: "serie", id: "muestra-tit", nombre: "Expedientes de Titulación", codigo: "CCD-SA-TIT" },
    { tipo: "serie", id: "muestra-act", nombre: "Actas de Evaluación", codigo: "CCD-SA-ACTA" },
  ] },
  { tipo: "seccion", id: "muestra-dg", nombre: "Dirección General", series: [
    { tipo: "serie", id: "muestra-res", nombre: "Resoluciones Directorales", codigo: "CCD-DG-RES" },
  ] },
] }];
const documentos: readonly DocumentoExpediente[] = [
  { id: "muestra-doc-1", nombre: "Documento ilustrativo A", folios: [{ numero: 1, pagina: 1, urlImagen: folioEjemplo }, { numero: 2, pagina: 2, urlImagen: folioEjemplo }] },
  { id: "muestra-doc-2", nombre: "Documento ilustrativo B", folios: [{ numero: 3, pagina: 1, urlImagen: folioEjemplo }] },
];
const expediente = { id: "muestra-principal", codigo: "MUESTRA-LOCAL", unidadOrigenId: "muestra-origen" };
const unidades = [{ id: "muestra-origen", nombre: "Mesa de Partes", habilitada: true }, { id: "muestra-destino", nombre: "Secretaría Académica", habilitada: true }];

function Demostracion() {
  const [seleccion, setSeleccion] = useState<RutaCcdSeleccionada | null>(null);
  const [modal, setModal] = useState<"derivacion" | "observacion" | "acumulacion" | null>(null);
  const acciones = useExpedienteActions({ obtenerClavesAfectadas: () => [] });
  return <main className="m03 min-h-screen bg-slate-100">
    <header className="header-sigd px-6 py-8"><div className="mx-auto max-w-6xl"><p className="text-sm">SIGD · IESTP “Suiza”</p><h1 className="mt-2 text-2xl font-bold">CCD, foliado y acciones procesales</h1><p className="mt-2">ENT-M03-04 / ENT-M03-05 · Piero Bartra Montalvo</p></div></header>
    <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6">
      <p className="m03-notice">Vista local de revisión con documentos ilustrativos. No consulta expedientes reales ni registra operaciones. Las acciones requieren completar los contratos del servidor.</p>
      <div className="grid items-start gap-6 lg:grid-cols-2"><CcdTreeSelector recurso={{ estado: "listo", datos: fondos }} seleccion={seleccion} onSeleccionar={setSeleccion} /><FoliadoDocumentoViewer recurso={{ estado: "listo", datos: documentos }} /></div>
      <section className="m03-panel"><h2 className="m03-heading">Acciones del expediente {expediente.codigo}</h2><p>Revise campos, advertencias y navegación por teclado. Los botones de confirmación permanecen deshabilitados hasta disponer del contrato real.</p><div className="m03-actions">
        <button className="btn-primary" onClick={() => setModal("derivacion")}>Derivar</button><button className="btn-secondary" onClick={() => setModal("observacion")}>Observar</button><button className="btn-secondary" onClick={() => setModal("acumulacion")}>Acumular</button>
      </div></section>
      <ExpedienteActionToast notificacion={acciones.notificacion} onClose={acciones.limpiarNotificacion} />
      <DerivacionModal open={modal === "derivacion"} onClose={() => setModal(null)} expediente={expediente} unidades={{ estado: "listo", datos: unidades }} accion={acciones.derivacion} />
      <ObservacionModal open={modal === "observacion"} onClose={() => setModal(null)} expediente={expediente} accion={acciones.observacion} />
      <AcumulacionModal open={modal === "acumulacion"} onClose={() => setModal(null)} expediente={expediente} accion={acciones.acumulacion} />
    </div>
  </main>;
}

const raiz = document.getElementById("root");
if (import.meta.env.DEV && raiz) createRoot(raiz).render(<StrictMode><QueryClientProvider client={new QueryClient()}><Demostracion /></QueryClientProvider></StrictMode>);
