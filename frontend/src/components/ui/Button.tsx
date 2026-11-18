import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-suiza-primary text-white hover:bg-suiza-primary/90 active:bg-suiza-primary/80 border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-suiza-primary/30",
  secondary:
    "bg-surface-card text-text-primary hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 border border-border-default shadow-2xs focus-visible:ring-2 focus-visible:ring-slate-400/20",
  danger:
    "bg-danger text-white hover:bg-danger/90 active:bg-danger/80 border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-danger/30",
  ghost:
    "bg-transparent text-text-secondary hover:bg-slate-100 hover:text-text-primary active:bg-slate-200 border border-transparent focus-visible:ring-2 focus-visible:ring-slate-400/20",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs rounded-lg gap-1.5",
  md: "h-11 min-h-[44px] px-4 text-sm rounded-lg gap-2",
  lg: "h-12 min-h-[48px] px-5 text-base rounded-xl gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      disabled,
      className = "",
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading ? "true" : undefined}
        className={`inline-flex items-center justify-center font-semibold transition cursor-pointer select-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
            <span>{loadingText ?? children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0" aria-hidden="true">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="shrink-0" aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
