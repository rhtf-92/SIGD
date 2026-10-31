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
    contenedor: "bg-emerald-950/75 text-emerald-200 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.22)]",
    puntoIndicador: "bg-emerald-400",
    etiquetaTexto: "Al día",
  },
  ALERTA: {
    contenedor: "bg-amber-950/80 text-amber-200 border-amber-400/60 shadow-[0_0_14px_rgba(245,158,11,0.24)]",
    puntoIndicador: "bg-amber-300",
    etiquetaTexto: "Atención",
  },
  CRITICO: {
    contenedor: "bg-fuchsia-950/80 text-fuchsia-200 border-fuchsia-400/60 shadow-[0_0_16px_rgba(232,121,249,0.34)]",
    puntoIndicador: "bg-rose-400",
    etiquetaTexto: "Crítico",
  },
  VENCIDO: {
    contenedor: "bg-red-950/80 text-red-200 border-red-400/70 animate-pulse font-bold shadow-[0_0_16px_rgba(239,68,68,0.28)]",
    puntoIndicador: "bg-red-400",
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
