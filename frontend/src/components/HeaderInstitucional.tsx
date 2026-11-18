import { useNavigate } from "react-router-dom";

export default function HeaderInstitucional() {
  const navigate = useNavigate();

  return (
    <header className="header-sigd relative z-30 overflow-hidden bg-gradient-to-r from-[#00223D] via-[#003865] to-[#005088] shadow-2xl shadow-slate-950/50 text-white print:hidden">
      {/* CAPA DE TEXTURA TÉCNICA AMBIENTAL (REJILLA DE NODOS Y LÍNEAS GEOMÉTRICAS) */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="sigd-navbar-nodes"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32 M 0 16 L 32 16 M 16 0 L 16 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
            />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
            <circle cx="0" cy="0" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sigd-navbar-nodes)" />
      </svg>

      {/* RESPLANDOR SUPERIOR DIFUSO */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-b from-cyan-400/10 to-transparent pointer-events-none blur-xl"
      />

      <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* IZQUIERDA: LOGO E IDENTIDAD */}
        <div className="flex items-center">
          <div
            className="flex cursor-pointer items-center gap-3.5 group"
            onClick={() => navigate("/")}
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-xl shadow-inner shadow-white/20 transition-transform duration-200 group-hover:scale-105">
              S
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-white font-extrabold tracking-tight text-lg">
                  SIGD SUIZA
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-xs">
                  v1.0
                </span>
              </div>
              <p className="text-blue-200/80 text-xs font-medium tracking-wide hidden sm:block">
                Instituto de Educación Superior Tecnológico Público "Suiza"
              </p>
            </div>
          </div>
        </div>

        {/* CENTRO-DERECHA: PÍLDORA DE CAMPUS + BOTONERA */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex px-3.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-400/40 text-cyan-200 text-xs font-semibold items-center gap-2 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>IESTP - SUIZA — PUCALLPA</span>
          </div>

          <nav className="flex items-center gap-2.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => navigate("/casilla")}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 border border-blue-400/30 transition shadow-xs cursor-pointer"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5 text-cyan-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>Código de Usuario</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/administracion")}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/20 transition shadow-xs cursor-pointer"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5 text-cyan-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Administración</span>
            </button>
            <div className="relative flex items-center bg-white/10 hover:bg-white/15 border border-white/20 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/30 rounded-full pl-3 pr-1 py-1 transition-all">
              <span className="text-cyan-300 mr-2 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Consultar CUT..."
                className="bg-transparent text-xs text-white placeholder:text-blue-200/60 focus:outline-hidden w-28 sm:w-36"
              />
              <button
                type="button"
                title="Buscar trámite o expediente"
                className="w-6 h-6 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold flex items-center justify-center text-xs shadow-xs transition-transform active:scale-95 cursor-pointer ml-1"
              >
                →
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* Línea divisoria tecnológica con resplandor neón */}
      <div className="absolute bottom-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" aria-hidden="true" />
      <div className="absolute bottom-0 inset-x-0 h-[6px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent blur-xs pointer-events-none" aria-hidden="true" />

      {/* Punto focal de luz central (micro destello) */}
      <div className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-32 h-[3px] bg-cyan-300 blur-[1px] rounded-full pointer-events-none" aria-hidden="true" />
    </header>
  );
}
