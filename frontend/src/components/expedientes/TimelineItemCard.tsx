import type { EventoTrazabilidadExpediente } from "../../types/trazabilidadExpediente";
import "./expedientes.css";

interface TimelineItemCardProps {
  readonly evento: EventoTrazabilidadExpediente;
}

function formatearFecha(fechaHora: string): string {
  const fecha = new Date(fechaHora);
  if (Number.isNaN(fecha.getTime())) return fechaHora;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fecha);
}

export default function TimelineItemCard({ evento }: TimelineItemCardProps) {
  return (
    <article className="m03-timeline-card" aria-labelledby={`evento-${evento.id}`}>
      <header className="m03-timeline-card-header">
        <div>
          <p className="m03-timeline-date">{formatearFecha(evento.fechaHora)}</p>
          <h3 id={`evento-${evento.id}`} className="m03-heading">
            {evento.tipoMovimiento}
          </h3>
        </div>
        <span className="m03-timeline-readonly">Solo lectura</span>
      </header>

      <dl className="m03-timeline-details">
        <div>
          <dt>Área emisora</dt>
          <dd>{evento.unidadEmisora}</dd>
        </div>
        <div>
          <dt>Área receptora</dt>
          <dd>{evento.unidadReceptora}</dd>
        </div>
        <div>
          <dt>Servidor responsable</dt>
          <dd>{evento.servidorResponsable}</dd>
        </div>
        <div>
          <dt>Proveído</dt>
          <dd className="whitespace-pre-wrap">{evento.proveido}</dd>
        </div>
        <div className="m03-timeline-hash">
          <dt>Hash de integridad SHA-256</dt>
          <dd className="font-mono text-xs break-all">{evento.hashIntegridad}</dd>
        </div>
        {evento.documentoAsociado ? (
          <div>
            <dt>Documento asociado</dt>
            <dd>
              {evento.documentoAsociado.url ? (
                <a
                  href={evento.documentoAsociado.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {evento.documentoAsociado.nombre}
                </a>
              ) : (
                evento.documentoAsociado.nombre
              )}
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

