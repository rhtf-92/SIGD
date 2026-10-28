import type { Sla } from "./rutadoc.dto";
import { FechaRutaDoc } from "./RutaDocEstado";
export default function RutaDocSla({ datos }: { datos: Sla }) {
  return <>
    <p role="note" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      Calendario SLA provisional: el calendario institucional definitivo está pendiente de aprobación.
      Los valores mostrados proceden del backend.
    </p>
    <dl aria-label="SLA del backend" className="rounded border p-3">
    <dt>Estado SLA</dt><dd>{datos.estado}</dd>
    <dt>Inicio</dt><dd><FechaRutaDoc valor={datos.fechaInicio} /></dd>
    <dt>Calculado</dt><dd><FechaRutaDoc valor={datos.fechaCalculo} /></dd>
    <dt>Fecha límite</dt><dd><FechaRutaDoc valor={datos.fechaLimite} /></dd>
    <dt>Plazo hábil</dt><dd>{datos.diasHabilesLimite}</dd>
    <dt>Días transcurridos</dt><dd>{datos.diasHabilesTranscurridos}</dd>
    <dt>Días restantes</dt><dd>{datos.diasHabilesRestantes}</dd>
    <dt>Porcentaje</dt><dd>{datos.porcentaje}%</dd>
    </dl>
  </>;
}
