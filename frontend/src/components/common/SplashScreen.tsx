import { useEffect, useState } from "react";

import Logo3D from "./Logo3D";

const DURACION_MS = 1100;
const CLAVE_VISTO = "sigd_splash_visto";

function yaVisto(): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE_VISTO) === "1";
  } catch {
    return false;
  }
}

export default function SplashScreen() {
  const [visible, setVisible] = useState(() => !yaVisto());
  const [saliendo, setSaliendo] = useState(false);
  const [progreso, setProgreso] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const t0 = window.setTimeout(() => setProgreso(100), 120);
    const t1 = window.setTimeout(() => setSaliendo(true), DURACION_MS - 320);
    const t2 = window.setTimeout(() => {
      setVisible(false);
      try {
        window.sessionStorage.setItem(CLAVE_VISTO, "1");
      } catch {
        // sin storage
      }
    }, DURACION_MS);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Cargando SIGD"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-white via-[#f4f8fb] to-[#eaf3fb] text-ink transition-opacity duration-500 ${
        saliendo ? "opacity-0" : "opacity-100"
      }`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(56,189,248,0.2),transparent_60%)]" />
        <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute -right-24 bottom-1/4 h-80 w-80 rounded-full bg-[#d7e9f7]/40 blur-3xl" />
        <div className="cyber-grid absolute inset-0 opacity-30" />
      </div>

      <Logo3D size={150} />

      <h1 className="mt-6 bg-gradient-to-r from-[#00539b] via-[#006ec7] to-[#38bdf8] bg-clip-text text-4xl font-black tracking-[0.32em] text-transparent">
        SIGD
      </h1>
      <p className="mt-2 max-w-xs text-center text-xs font-medium text-slate-600">
        Sistema Integral de Gestión Documentaria
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-400">
        IESTP “Suiza” · Pucallpa
      </p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="mt-5 rounded-full border border-[#bfe0f7] bg-white px-4 py-1 text-[11px] font-semibold text-[#00539b] transition hover:border-[#006ec7] hover:bg-[#e8f4ff]"
      >
        Omitir
      </button>

      <div className="relative mt-7 h-2 w-64 overflow-hidden rounded-full border border-[#bfe0f7] bg-white">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#00539b] via-[#006ec7] to-[#38bdf8]"
          style={{
            width: `${progreso}%`,
            transition: `width ${DURACION_MS - 200}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          }}
        />
        <div className="absolute inset-y-0 w-1/3 animate-shimmer bg-white/50 blur-sm" />
      </div>

      <p className="mt-3 font-mono text-[11px] font-semibold tracking-[0.18em] text-[#00539b]/80">
        INICIALIZANDO · {progreso}%
      </p>
    </div>
  );
}
