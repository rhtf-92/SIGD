import type { HorarioCorteResult } from "../../hooks/useHorarioCorte";

interface HorarioCorteNoticeProps {
  horario: HorarioCorteResult;
}

export default function HorarioCorteNotice({
  horario,
}: HorarioCorteNoticeProps) {
  if (!horario.requiresProjection) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Su trámite será considerado recibido el mismo día hábil.
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <strong className="block">Aviso legal de horario</strong>
      Toda solicitud ingresada desde las 16:30 hrs o en un día inhábil se
      considera presentada a las 08:00 hrs del siguiente día hábil. Fecha legal
      proyectada: <strong>{horario.legalTimestamp}</strong>.
    </div>
  );
}
