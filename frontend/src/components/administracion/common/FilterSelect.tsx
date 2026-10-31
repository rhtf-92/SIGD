import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface FilterSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: Array<{ value: string; label: string }>;
  containerClassName?: string;
}

export default function FilterSelect({
  label,
  options,
  children,
  className = "",
  containerClassName = "",
  id,
  ...props
}: FilterSelectProps) {
  return (
    <div className={`relative flex flex-col ${containerClassName}`}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-slate-400"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          {...props}
          className={`w-full appearance-none rounded-xl border border-slate-700/70 bg-slate-900/70 py-2.5 pl-3.5 pr-9 text-sm text-slate-100 backdrop-blur-md transition-all duration-200 focus:border-cyan-400 focus:bg-slate-900/90 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 ${className}`}
        >
          {options
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-slate-900 text-slate-100"
                >
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
