import type { HTMLAttributes } from "react";
import { Badge, type BadgeSize, type BadgeVariant } from "./Badge";

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: string;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

interface StatusConfig {
  variant: BadgeVariant;
  label: string;
}

const STATUS_DICTIONARY: Record<string, StatusConfig> = {
  // Success
  RESUELTO: { variant: "success", label: "Resuelto" },
  PAGADO: { variant: "success", label: "Pagado" },
  CONFIRMADO: { variant: "success", label: "Confirmado" },
  APROBADO: { variant: "success", label: "Aprobado" },
  VALIDO: { variant: "success", label: "Válido" },
  "VÁLIDO": { variant: "success", label: "Válido" },
  DESEMBOLSADO: { variant: "success", label: "Desembolsado" },
  ATENDIDO: { variant: "success", label: "Atendido" },

  // Warning
  PENDIENTE: { variant: "warning", label: "Pendiente" },
  EN_TRAMITE: { variant: "warning", label: "En Trámite" },
  "EN TRÁMITE": { variant: "warning", label: "En Trámite" },
  EN_CALIFICACION: { variant: "warning", label: "En Calificación" },
  "EN CALIFICACIÓN": { variant: "warning", label: "En Calificación" },
  EN_REVISION: { variant: "warning", label: "En Revisión" },
  "EN REVISIÓN": { variant: "warning", label: "En Revisión" },
  EN_FIRMA: { variant: "warning", label: "En Firma" },
  PENDIENTE_PAGO: { variant: "warning", label: "Pendiente de Pago" },

  // Attention
  OBSERVADO: { variant: "attention", label: "Observado" },
  SUBSANACION: { variant: "attention", label: "Subsanación" },
  "SUBSANACIÓN": { variant: "attention", label: "Subsanación" },
  PAGO_PENDIENTE: { variant: "attention", label: "Pago Pendiente" },
  SOLICITADA: { variant: "attention", label: "Solicitada" },
  EN_PROCESO: { variant: "attention", label: "En Proceso" },

  // Danger
  RECHAZADO: { variant: "danger", label: "Rechazado" },
  IMPROCEDENTE_NSP: { variant: "danger", label: "Improcedente (NSP)" },
  IMPROCEDENTE: { variant: "danger", label: "Improcedente" },
  ANULADO: { variant: "danger", label: "Anulado" },
  DESESTIMADO: { variant: "danger", label: "Desestimado" },
  VENCIDO: { variant: "danger", label: "Vencido" },
  ALTERADO: { variant: "danger", label: "Alterado" },
  ERROR: { variant: "danger", label: "Error" },

  // Neutral
  ARCHIVADO: { variant: "neutral", label: "Archivado" },
  HISTORICO: { variant: "neutral", label: "Histórico" },
  "HISTÓRICO": { variant: "neutral", label: "Histórico" },
  INACTIVO: { variant: "neutral", label: "Inactivo" },
  CERRADO: { variant: "neutral", label: "Cerrado" },
  DESCONOCIDO: { variant: "neutral", label: "Sin Estado" },
};

export function StatusBadge({
  status,
  size = "md",
  dot = true,
  className = "",
  ...props
}: StatusBadgeProps) {
  const normalizedKey = (status || "").trim().toUpperCase().replace(/\s+/g, "_");
  const config = STATUS_DICTIONARY[normalizedKey] ?? {
    variant: "neutral" as BadgeVariant,
    label: status || "Sin Estado",
  };

  return (
    <Badge
      variant={config.variant}
      size={size}
      dot={dot}
      className={className}
      {...props}
    >
      {config.label}
    </Badge>
  );
}
