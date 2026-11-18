import type { Folios } from "./rutadoc.dto";
import { IdentificadorRutaDoc } from "./RutaDocEstado";
export default function RutaDocFoliacion({ datos }: { datos: Folios }) {
  if (!datos.length) return <p>Sin documentos foliados.</p>;
  return <ul>{datos.map(f => <li key={f.idDocumento} className="rounded border p-3">
    <p>{f.nombre ?? "Nombre no disponible"}</p><div>Documento UUID: <IdentificadorRutaDoc valor={f.idDocumento} /></div>
    <p>{f.rango} · {f.cantidadFolios} folios</p>
    <p>Tipo: {f.tipo ?? "No disponible"}</p>
    <div>SHA-256: <IdentificadorRutaDoc valor={f.checksumSha256} /></div>
  </li>)}</ul>;
}
