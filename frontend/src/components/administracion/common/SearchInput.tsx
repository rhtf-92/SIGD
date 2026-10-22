import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  className?: string;
  containerClassName?: string;
}

export default function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Buscar...",
  className = "",
  containerClassName = "",
  ...props
}: SearchInputProps) {
  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  return (
    <div className={`relative flex items-center ${containerClassName}`}>
      <Search
        className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
        aria-hidden="true"
      />
      <input
        {...props}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-700/70 bg-slate-900/70 py-2.5 pl-10 pr-9 text-sm text-slate-100 placeholder-slate-500 backdrop-blur-md transition-all duration-200 focus:border-cyan-400 focus:bg-slate-900/90 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 ${className}`}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-3 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-white transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
