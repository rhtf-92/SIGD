import {
  forwardRef,
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  options?: SelectOption[];
  isLoading?: boolean;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      options,
      isLoading = false,
      required,
      disabled,
      children,
      className = "",
      id: customId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = customId ?? generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

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
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-slate-700 tracking-tight"
          >
            {label}
            {required && <span className="ml-1 text-red-500 font-bold" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            required={required}
            disabled={isDisabled}
            aria-invalid={hasError ? "true" : undefined}
            aria-describedby={describedBy}
            className={`w-full h-11 min-h-[44px] appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm text-slate-900 transition focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
              hasError
                ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20"
                : "border-slate-300 focus:border-suiza-primary focus:ring-2 focus:ring-suiza-primary/20"
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="pointer-events-none absolute right-3 flex items-center text-slate-400">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-suiza-primary" aria-hidden="true" />
            ) : hasError ? (
              <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
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

Select.displayName = "Select";
