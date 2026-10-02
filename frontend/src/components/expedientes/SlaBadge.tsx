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
    contenedor: "bg-emerald-50 text-emerald-800 border-emerald-300",
    puntoIndicador: "bg-emerald-600",
    etiquetaTexto: "Al día",
  },
  ALERTA: {
    contenedor: "bg-amber-50 text-amber-900 border-amber-300",
    puntoIndicador: "bg-amber-500",
    etiquetaTexto: "Atención",
  },
  CRITICO: {
    contenedor: "bg-rose-50 text-rose-800 border-rose-300",
    puntoIndicador: "bg-rose-600",
    etiquetaTexto: "Crítico",
  },
  VENCIDO: {
    contenedor: "bg-red-100 text-red-900 border-red-500 animate-pulse font-bold shadow-sm",
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
