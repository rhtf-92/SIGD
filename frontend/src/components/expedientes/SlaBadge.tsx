import { useMemo } from "react";
import {
  calculateSlaStatus,
  type SlaStatus,
} from "../../utils/slaCalculator";
import SlaIndicatorTooltip from "./SlaIndicatorTooltip";

export interface SlaBadgeProps {
  fechaIngreso: string | Date;
  fechaLimiteAtencion?: string | Date;
  plazoMaximoDiasHabiles?: number;
  fechaReferencia?: Date;
  mostrarTooltip?: boolean;
  className?: string;
}

const ESTILOS_ESTADO: Record<
  SlaStatus,
  {
    contenedor: string;
    puntoIndicador: string;
    etiquetaTexto: string;
  }
> = {
  NORMAL: {
    contenedor: "bg-slate-50 text-slate-700 border-slate-300",
    puntoIndicador: "bg-slate-500",
    etiquetaTexto: "Al día",
  },
  ALERTA: {
    contenedor: "bg-amber-50 text-amber-800 border-amber-200",
    puntoIndicador: "bg-amber-500",
    etiquetaTexto: "Atención",
  },
  CRITICO: {
    contenedor: "bg-orange-50 text-orange-800 border-orange-200",
    puntoIndicador: "bg-orange-500",
    etiquetaTexto: "Crítico",
  },
  VENCIDO: {
    contenedor: "bg-red-50 text-red-800 border-red-200 font-bold",
    puntoIndicador: "bg-red-600",
    etiquetaTexto: "Vencido",
  },
};

export default function SlaBadge({
  fechaIngreso,
  plazoMaximoDiasHabiles = 30,
  fechaReferencia,
  mostrarTooltip = true,
  className = "",
}: SlaBadgeProps) {
  const slaResult = useMemo(
    () =>
      calculateSlaStatus(
        fechaIngreso,
        fechaReferencia,
        plazoMaximoDiasHabiles,
      ),
    [fechaIngreso, fechaReferencia, plazoMaximoDiasHabiles],
  );

  const {
    estado,
    diasHabilesRestantes,
    diasHabilesConsumidos,
    plazoMaximoDiasHabiles: maxDias,
    fechaVencimientoCalculada,
    mensajeExplicativo,
    estaVencido,
  } = slaResult;

  const estilo = ESTILOS_ESTADO[estado];

  const etiquetaTexto = estaVencido
    ? `Vencido (${Math.abs(diasHabilesRestantes)}d hábiles)`
    : `${diasHabilesRestantes}d hábiles [${estilo.etiquetaTexto}]`;

  const badgeContent = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-tight transition-colors ${estilo.contenedor} ${className}`}
      aria-label={`${etiquetaTexto} - ${mensajeExplicativo}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${estilo.puntoIndicador}`}
        aria-hidden="true"
      />
      <span>{etiquetaTexto}</span>
    </span>
  );

  if (!mostrarTooltip) {
    return badgeContent;
  }

  return (
    <SlaIndicatorTooltip
      mensaje={mensajeExplicativo}
      diasConsumidos={diasHabilesConsumidos}
      diasRestantes={diasHabilesRestantes}
      plazoMaximo={maxDias}
      fechaVencimiento={fechaVencimientoCalculada}
    >
      {badgeContent}
    </SlaIndicatorTooltip>
  );
}
