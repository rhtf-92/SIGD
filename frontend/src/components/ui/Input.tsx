import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { AlertCircle, Loader2 } from "lucide-react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  labelSuffix?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      labelSuffix,
      helperText,
      error,
      leftIcon,
      rightIcon,
      isLoading = false,
      required,
      disabled,
      className = "",
      id: customId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = customId ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const hasError = Boolean(error);
    const isDisabled = disabled || isLoading;

    const describedBy = [
      hasError ? errorId : null,
      helperText ? helperId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <div className="flex items-center">
            <label
              htmlFor={inputId}
              className="text-xs font-semibold text-slate-700 tracking-tight"
            >
              {label}
              {required && <span className="ml-1 text-red-500 font-bold" aria-hidden="true">*</span>}
            </label>
            {labelSuffix}
          </div>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            disabled={isDisabled}
            aria-invalid={hasError ? "true" : undefined}
            aria-describedby={describedBy}
            className={`w-full h-11 min-h-[44px] rounded-lg border bg-white px-3 text-sm text-slate-900 transition placeholder:text-slate-400 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
              leftIcon ? "pl-9" : ""
            } ${rightIcon || isLoading || hasError ? "pr-9" : ""} ${
              hasError
                ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20"
                : "border-slate-300 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20"
            } ${className}`}
            {...props}
          />

          <div className="pointer-events-none absolute right-3 flex items-center text-slate-400">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-suiza-primary" aria-hidden="true" />
            ) : hasError ? (
              <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
            ) : rightIcon ? (
              rightIcon
            ) : null}
          </div>
        </div>

        {hasError && (
          <p id={errorId} className="flex items-center gap-1 text-xs font-medium text-red-600">
            <span>{error}</span>
          </p>
        )}

        {!hasError && helperText && (
          <p id={helperId} className="text-[11px] text-slate-500 font-medium">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
