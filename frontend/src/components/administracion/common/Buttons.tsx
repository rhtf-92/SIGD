import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_STYLES = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-5 py-3 text-base rounded-xl gap-2.5",
};

export function PrimaryButton({
  children,
  icon: Icon,
  iconPosition = "left",
  isLoading = false,
  size = "md",
  className = "",
  disabled,
  ...props
}: BaseButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-semibold tracking-wide text-white transition-all duration-200 cursor-pointer ${
        SIZE_STYLES[size]
      } bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-500 hover:via-sky-500 hover:to-cyan-500 border border-cyan-400/30 shadow-md shadow-blue-500/20 hover:shadow-cyan-500/30 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-white" />
      ) : (
        Icon && iconPosition === "left" && <Icon className="h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
      {!isLoading && Icon && iconPosition === "right" && (
        <Icon className="h-4 w-4 shrink-0" />
      )}
    </button>
  );
}

export function SecondaryButton({
  children,
  icon: Icon,
  iconPosition = "left",
  isLoading = false,
  size = "md",
  className = "",
  disabled,
  ...props
}: BaseButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-semibold tracking-wide text-slate-200 hover:text-white transition-all duration-200 cursor-pointer ${
        SIZE_STYLES[size]
      } bg-slate-800/70 hover:bg-slate-700/80 active:bg-slate-800 border border-slate-700/80 hover:border-slate-500/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
      ) : (
        Icon && iconPosition === "left" && <Icon className="h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
      {!isLoading && Icon && iconPosition === "right" && (
        <Icon className="h-4 w-4 shrink-0" />
      )}
    </button>
  );
}
