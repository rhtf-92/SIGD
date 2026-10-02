import { useId, useState } from "react";

import type { DocumentoExpediente, FoliadoDocumentoViewerProps } from "../../types/ccdArchivistica";
import { validarFoliado, validarUrlDocumento } from "../../utils/foliado";
import "./expedientes.css";

export default function FoliadoDocumentoViewer({ recurso, origenesPermitidos = [] }: FoliadoDocumentoViewerProps) {
  if (recurso.estado === "cargando") return <div className="m03 m03-panel" role="status">Cargando documentos y folios…</div>;
  if (recurso.estado === "error") return <div className="m03 m03-alert" role="alert">{recurso.mensaje}</div>;
  if (recurso.estado === "vacio" || recurso.datos.length === 0) return <div className="m03 m03-panel" role="status">El expediente no tiene documentos.</div>;
  const documentos = recurso.datos;
  const resultado = validarFoliado(documentos.flatMap((documento) => documento.folios.map((folio) => folio.numero)));
  if (!resultado.valido) return <div className="m03 m03-alert" role="alert">Foliación no válida: {resultado.mensaje} Solicite la revisión del registro; el visor no modifica los folios.</div>;
  if (new Set(documentos.map((documento) => documento.id)).size !== documentos.length || documentos.some((documento) => !documento.id.trim() || documento.folios.length === 0 || documento.folios.some((folio, indice) => folio.pagina !== indice + 1))) {
    return <div className="m03 m03-alert" role="alert">Documentos o páginas inconsistentes. Solicite la revisión del registro documental.</div>;
  }
  return <VisorFolios documentos={documentos} origenesPermitidos={origenesPermitidos} />;
}

function VisorFolios({ documentos, origenesPermitidos }: { documentos: readonly DocumentoExpediente[]; origenesPermitidos: readonly string[] }) {
  const id = useId();
  const [indice, setIndice] = useState(0);
  const paginas = documentos.flatMap((documento) => documento.folios.map((folio) => ({ documento, folio })));
  const actual = Math.min(indice, paginas.length - 1);
  const { documento, folio } = paginas[actual];
  const original = documento.urlOriginal ? validarUrlDocumento(documento.urlOriginal, window.location.origin, origenesPermitidos) : null;
  const imagen = folio.urlImagen ? validarUrlDocumento(folio.urlImagen, window.location.origin, origenesPermitidos) : null;
  const urlInsegura = Boolean((documento.urlOriginal && !original) || (folio.urlImagen && !imagen));
  return <section className="m03 m03-panel" aria-labelledby={`${id}-titulo`}>
    <h2 className="m03-heading" id={`${id}-titulo`}>Foliado documental</h2>
    <p className="m03-help">Foliación continua de solo lectura. El sello visual no altera el archivo original.</p>
    <p role="status" className="mb-3">{documento.nombre} · Página {folio.pagina} · Folio {folio.numero} de {paginas.length}</p>
    <div className="m03-folio-page">
      <span className="m03-folio-stamp" aria-hidden="true">F. {folio.numero}</span>
      {urlInsegura ? <p role="alert" className="m03-alert">La dirección del documento no es segura o no está autorizada.</p> : imagen ?
        <ImagenFolio key={`${documento.id}-${folio.pagina}-${imagen}`} url={imagen} descripcion={`${documento.nombre}, página ${folio.pagina}, folio ${folio.numero}`} /> :
        <p className="m03-notice">Vista previa de esta página no disponible. {original ? "Puede consultar el documento original con el enlace inferior." : "Solicite una copia disponible al área responsable."}</p>}
    </div>
    {original && !urlInsegura ? <a className="mt-3 inline-block underline" href={original} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir documento original (nueva pestaña)</a> : null}
    <div className="m03-actions" role="group" aria-label="Navegación de folios">
      <button type="button" className="btn-secondary" disabled={actual === 0} onClick={() => setIndice(actual - 1)}>Folio anterior</button>
      <button type="button" className="btn-primary" disabled={actual === paginas.length - 1} onClick={() => setIndice(actual + 1)}>Folio siguiente</button>
    </div>
  </section>;
}

function ImagenFolio({ url, descripcion }: { url: string; descripcion: string }) {
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  if (estado === "error") return <p role="alert" className="m03-alert">No se pudo cargar la página del documento.</p>;
  return <>
    {estado === "cargando" ? <p role="status">Cargando página…</p> : null}
    <img src={url} alt={descripcion} referrerPolicy="no-referrer" onLoad={() => setEstado("listo")} onError={() => setEstado("error")} />
  </>;
}
