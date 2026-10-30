import React from "react";
import { Clock, Mail } from "lucide-react";

export default function LoginFooter(): React.JSX.Element {
  const anioActual = new Date().getFullYear();

  return (
    <footer className="mt-8 w-full border-t border-slate-200/80 pt-6 text-center text-xs text-slate-500">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <div className="inline-flex items-center gap-1.5 font-medium text-slate-600">
          <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span>Atención: Lun - Vie 08:00 a 16:30 hrs</span>
        </div>

        <span className="hidden sm:inline text-slate-300" aria-hidden="true">•</span>

        <a
          href="mailto:soporte.sigd@iestpsuiza.edu.pe"
          className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-[#0c2340] hover:underline transition-colors"
          title="Contactar a soporte técnico"
        >
          <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span>soporte.sigd@iestpsuiza.edu.pe</span>
        </a>
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        © {anioActual} IESTP "Suiza" — Pucallpa, Ucayali. Todos los derechos reservados.
      </p>
    </footer>
  );
}
