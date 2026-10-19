import type { ContextoTupa } from "./tupa.dto";
import { FechaRutaDoc, IdentificadorRutaDoc } from "./RutaDocEstado";

function ValorTexto({ valor }: { valor: string | null }) {
  return valor ? <span>{valor}</span> : <span>No disponible</span>;
}

function Requisitos({ requisitos }: { requisitos: ContextoTupa["requisitos"] }) {
  if (!requisitos || requisitos.length === 0) return <span>No disponible</span>;
  return <ul className="list-disc space-y-1 pl-5">
    {requisitos.map((requisito, indice) => <li key={indice}>
      {typeof requisito === "string" || typeof requisito === "number"
        ? String(requisito)
        : JSON.stringify(requisito)}
    </li>)}
  </ul>;
}

/**
 * Contexto TUPA de solo lectura. Muestra únicamente los datos persistidos del
 * vínculo raíz; no infiere código ni valores cuando el backend los omite.
 */
export default function RutaDocTupa({ datos }: { datos: ContextoTupa }) {
  return <>
    <dl aria-label="Contexto TUPA del expediente" className="rounded border p-3">
      <dt>Registro de versión TUPA (UUID)</dt>
      <dd><IdentificadorRutaDoc valor={datos.registroVersionId} /></dd>
      <dt>Código</dt>
      <dd>{datos.codigo ? <ValorTexto valor={datos.codigo} /> : <span>No disponible</span>}</dd>
      <dt>Denominación</dt>
      <dd>{datos.denominacion}</dd>
      <dt>Monto</dt>
      <dd><ValorTexto valor={datos.monto} /></dd>
      <dt>Requisitos</dt>
      <dd><Requisitos requisitos={datos.requisitos} /></dd>
      <dt>Fuente</dt>
      <dd>{datos.fuente}</dd>
      <dt>Página</dt>
      <dd>{datos.pagina}</dd>
      <dt>Revisión</dt>
      <dd>{datos.revision}</dd>
      <dt>Versión</dt>
      <dd><ValorTexto valor={datos.version} /></dd>
      <dt>Estado de validación</dt>
      <dd>{datos.estadoValidacion}</dd>
      <dt>Vinculado en</dt>
      <dd><FechaRutaDoc valor={datos.vinculadoEn} /></dd>
    </dl>
  </>;
}
