import { Clock3, Info, TriangleAlert } from "lucide-react";

import {
  formatFechaJuridicaRecepcion,
  useHorarioCorte,
} from "../../hooks/useHorarioCorte";

const NO_HOLIDAYS: readonly string[] = [];

interface HorarioCorteBannerProps {
  holidays?: readonly string[];
}

export default function HorarioCorteBanner({
  holidays = NO_HOLIDAYS,
}: HorarioCorteBannerProps) {
  const horario = useHorarioCorte(undefined, holidays);

  if (horario.isClockSyncUnavailable) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950"
      >
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="font-medium">
          No se pudo verificar la hora oficial del servidor. La fecha de recepción
          no está disponible; vuelva a intentarlo cuando se restablezca la conexión.
        </p>
      </div>
    );
  }

  if (!horario.isClockSynchronized) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-800"
      >
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="font-medium">
          Verificando la hora oficial del servidor para determinar la fecha de recepción.
        </p>
      </div>
    );
  }

  if (horario.isExtemporaneo) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950"
      >
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">
            Horario Extemporáneo (Art. 138 Ley N° 27444): Su solicitud será
            registrada con fecha formal del próximo día hábil a las 08:00 hrs.
          </p>
          <p className="mt-1">
            Fecha jurídica de recepción: {formatFechaJuridicaRecepcion(horario.fechaJuridicaRecepcion)}
          </p>
        </div>
      </div>
    );
  }

  if (horario.isUltimosMinutos) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="font-medium">
          Quedan pocos minutos para el cierre de recepción regular (16:30 hrs).
          Finalice su trámite para registrarlo hoy.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex gap-3 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="font-medium">
        Recepción Regular: Los trámites presentados antes de las 16:30 hrs se
        registran con fecha de hoy.
      </p>
    </div>
  );
}
