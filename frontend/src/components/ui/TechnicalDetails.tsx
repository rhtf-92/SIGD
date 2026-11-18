import { useState, type ReactNode } from "react";
import { ChevronDown, ShieldCheck, Copy, Check } from "lucide-react";

export interface TechnicalDetailItem {
  label: string;
  value: string;
  copyable?: boolean;
}

export interface TechnicalDetailsProps {
  title?: string;
  items?: TechnicalDetailItem[];
  children?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function TechnicalDetails({
  title = "Detalles Técnicos y Auditoría Criptográfica",
  items,
  children,
  defaultOpen = false,
  className = "",
}: TechnicalDetailsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, value: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1800);
      }
    } catch {
      // Manejo silencioso
    }
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden text-xs transition ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100/70 transition cursor-pointer select-none"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-suiza-primary" aria-hidden="true" />
          <span>{title}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="border-t border-slate-200/80 bg-white p-4 space-y-3 animate-in fade-in duration-150">
          {items && items.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-slate-50 border border-slate-200/70 p-2.5 flex flex-col justify-between"
                >
                  <dt className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {item.label}
                  </dt>
                  <dd className="mt-1 flex items-center justify-between gap-2 text-slate-800 break-all text-[11px]">
                    <span className="select-all">{item.value}</span>
                    {item.copyable && (
                      <button
                        type="button"
                        onClick={() => handleCopy(item.label, item.value)}
                        className="shrink-0 p-1 text-slate-400 hover:text-suiza-primary rounded transition cursor-pointer"
                        title={`Copiar ${item.label}`}
                        aria-label={`Copiar ${item.label}`}
                      >
                        {copiedKey === item.label ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {children}
        </div>
      )}
    </div>
  );
}

export default TechnicalDetails;
