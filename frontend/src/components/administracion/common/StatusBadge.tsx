interface StatusBadgeProps {
  status: string;
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
  size?: "sm" | "md";
  className?: string;
  withDot?: boolean;
}

export function inferVariant(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const normalized = status.trim().toLowerCase();
  if (["activo", "exitoso", "correcto", "aprobado", "habilitado", "conectado"].includes(normalized)) {
    return "success";
  }
  if (["denegado", "advertencia", "pendiente", "observado"].includes(normalized)) {
    return "warning";
  }
  if (["bloqueado", "error", "fallido", "rechazado", "deshabilitado"].includes(normalized)) {
    return "danger";
  }
  if (["derivado", "en trámite", "info"].includes(normalized)) {
    return "info";
  }
  return "neutral";
}

const BADGE_STYLES = {
  success: {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  },
  warning: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
  },
  danger: {
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    dot: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]",
  },
  info: {
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]",
  },
  neutral: {
    badge: "bg-slate-700/30 text-slate-300 border-slate-600/40",
    dot: "bg-slate-400",
  },
};

export default function StatusBadge({
  status,
  variant,
  size = "md",
  className = "",
  withDot = true,
}: StatusBadgeProps) {
  const chosenVariant = variant ?? inferVariant(status);
  const styles = BADGE_STYLES[chosenVariant];

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border backdrop-blur-md ${styles.badge} ${sizeClasses} ${className}`}
    >
      {withDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{status}</span>
    </span>
  );
}
