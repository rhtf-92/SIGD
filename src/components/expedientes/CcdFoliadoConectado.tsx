import { useEffect, useState } from "react";
import { obtenerCatalogo, obtenerFoliacion, type NodoCatalogoCcd, type RangoServidor } from "../../api/ccdFoliado";
import FoliadoDocumentoViewer from "./FoliadoDocumentoViewer";
import RegistroFoliado from "./RegistroFoliado";
import "./expedientes.css";

/** Consultas reales; no fabrica catálogos, páginas ni confirmaciones de escritura. */
export default function CcdFoliadoConectado({ baseUrl, expedienteId }: { baseUrl: string; expedienteId: string }) {
  const [catalogo, setCatalogo] = useState<NodoCatalogoCcd[] | null>(null);
  const [rangos, setRangos] = useState<RangoServidor[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const control = new AbortController();
    setCatalogo(null); setRangos(null); setError("");
    Promise.all([obtenerCatalogo(baseUrl, control.signal), obtenerFoliacion(baseUrl, expedienteId, control.signal)])
      .then(([ccd, folios]) => { if (!control.signal.aborted) { setCatalogo(ccd); setRangos(folios); } })
      .catch((e: unknown) => { if (!control.signal.aborted) setError(e instanceof Error ? e.message : "Error de consulta."); });
    return () => control.abort();
  }, [baseUrl, expedienteId, revision]);
  if (error) return <section className="m03 m03-panel"><p role="alert">{error}</p><button type="button" className="btn-secondary" onClick={() => setRevision(x => x + 1)}>Reintentar consulta</button></section>;
  if (!catalogo || !rangos) return <p role="status">Consultando CCD y foliación del servidor…</p>;
  const ultimo = rangos.at(-1)?.folioFin ?? 0;
  return <div className="m03 grid gap-4">
    <section className="m03-panel"><h2 className="m03-heading">Catálogo CCD publicado por el servidor</h2>
      <p>La respuesta disponible contiene series y subseries. El servidor debe publicar el fondo y las secciones institucionales; no se asignan niveles ficticios.</p>
      {catalogo.length ? <ul aria-label="Series y subseries documentales">{catalogo.map(n => <Nodo key={n.id} nodo={n} />)}</ul> : <p role="status">El servidor no publicó un catálogo CCD.</p>}
    </section>
    <FoliadoDocumentoViewer recurso={{ estado: "listo", datos: rangos.map(r => ({ id: r.idDocumento, nombre: r.nombre ?? r.idDocumento, folios: Array.from({ length: r.cantidadFolios }, (_, i) => ({ numero: r.folioInicio + i, pagina: i + 1 })) })) }} />
    <p className="m03-notice">Las consultas provienen del servidor. El endpoint de foliación no proporciona imágenes de páginas. La escritura requiere que DocuCore publique su ruta de registro; esta pantalla permite revisar el rango pero no registra archivos.</p>
    <RegistroFoliado disponible={false} ultimoFolio={ultimo} onConfirmar={async () => { throw new Error("Ruta de escritura no montada en el backend proporcionado"); }} />
  </div>;
}
function Nodo({ nodo }: { nodo: NodoCatalogoCcd }) {
  return <li>{nodo.hijos.length ? <details><summary>{nodo.codigo} · {nodo.nombre}</summary><ul>{nodo.hijos.map(h => <Nodo key={h.id} nodo={h} />)}</ul></details> : <span>{nodo.codigo} · {nodo.nombre}</span>}</li>;
}
