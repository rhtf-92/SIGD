import { useEffect, useState } from "react";

const DURACION_MS = 1800;

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [saliendo, setSaliendo] = useState(false);
  const [progreso, setProgreso] = useState(0);

  useEffect(() => {
    const t0 = window.setTimeout(() => setProgreso(100), 60);
    const t1 = window.setTimeout(() => setSaliendo(true), DURACION_MS - 400);
    const t2 = window.setTimeout(() => setVisible(false), DURACION_MS);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Cargando SIGD"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-slate-900 text-white transition-opacity duration-300 ${
        saliendo ? "opacity-0" : "opacity-100"
      }`}
    >
      <style>{`
        @keyframes sigd-flotar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes sigd-anillo { to { transform: rotate(360deg); } }
        @keyframes sigd-rayas { to { background-position: 32px 0; } }
        @keyframes sigd-puntos { 0% { opacity: .2; } 50% { opacity: 1; } 100% { opacity: .2; } }
        @keyframes sigd-brillo { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
        @keyframes sigd-pulso { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      `}</style>

      {/* destellos de fondo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      </div>

      {/* logo fijo */}
      <span
        className="grid h-20 w-20 place-items-center rounded-3xl bg-white text-4xl font-black text-blue-800 shadow-2xl"
        aria-hidden="true"
      >
        S
      </span>

      <h1 className="mt-5 text-4xl font-black tracking-[0.2em]">SIGD</h1>
      <p className="mt-1 max-w-xs text-center text-xs font-medium text-blue-100">
        Sistema Integral de Gestión Documentaria
      </p>
      <p className="mt-0.5 text-[11px] text-blue-200">IESTP “Suiza” · Pucallpa</p>

      {/* barra con rayas en movimiento + brillo */}
      <div
        className="relative mt-6 h-2.5 w-56 overflow-hidden rounded-full bg-white/20"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-white to-cyan-300"
          style={{
            width: `${progreso}%`,
            transition: `width ${DURACION_MS - 200}ms linear`,
            backgroundSize: "32px 100%",
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 8px, transparent 8px 16px)",
            animation: "sigd-rayas 0.7s linear infinite",
          }}
        />
        <div
          className="absolute inset-y-0 w-1/3 bg-white/40 blur-sm"
          style={{ animation: "sigd-brillo 1.4s ease-in-out infinite" }}
        />
      </div>

      {/* puntos animados + porcentaje */}
      <p className="mt-3 text-[11px] font-semibold text-blue-100">
        Cargando
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{ animation: `sigd-puntos 1s ease-in-out ${i * 0.2}s infinite` }}
          >
            .
          </span>
        ))}{" "}
        <span className="font-mono">{progreso}%</span>
      </p>
    </div>
  );
}
