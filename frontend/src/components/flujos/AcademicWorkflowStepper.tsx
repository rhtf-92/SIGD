/**
 * AcademicWorkflowStepper (compat) — delega en el componente canónico
 * `src/components/academico/EtapasStepper.tsx` (F_ADRIANO / T-FE-DOC-02).
 * Se conserva la ruta histórica usada por WorkflowAcademicoPage.
 */
import EtapasStepper from "../academico/EtapasStepper";
import type {
  EstadoTramite,
  EtapaWorkflowVisual,
} from "../../types/workflowAcademico";

interface AcademicWorkflowStepperProps {
  etapas: EtapaWorkflowVisual[];
  estadoTramite: EstadoTramite;
}

export default function AcademicWorkflowStepper({
  etapas,
  estadoTramite,
}: AcademicWorkflowStepperProps) {
  return <EtapasStepper etapas={etapas} estadoTramite={estadoTramite} />;
}
