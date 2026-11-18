import { Loader2 } from "lucide-react";

export interface InlineLoadingProps {
  message?: string;
  size?: "sm" | "md";
  className?: string;
}

export function InlineLoading({
  message = "Cargando...",
  size = "md",
  className = "",
}: InlineLoadingProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 font-medium text-slate-600 ${className}`}
    >
      <Loader2
        className={`${iconSize} animate-spin text-suiza-primary shrink-0`}
        aria-hidden="true"
      />
      <span className={textSize}>{message}</span>
    </div>
  );
}

export default InlineLoading;
