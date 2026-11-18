import { useNavigate } from "react-router-dom";

export default function HeaderInstitucional() {
  const navigate = useNavigate();

  return (
    <header className="w-full bg-[#05224a] border-b-2 border-sky-400 text-white shadow-md print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Izquierda: Ícono cuadrado azul redondeado con letra 'S', título y subtítulo */}
        <div
          className="flex cursor-pointer items-center gap-3.5 select-none"
          onClick={() => navigate("/")}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1877f2] text-white font-black text-xl shadow-md border border-white/20 shrink-0">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-wider uppercase text-white">
                SIGD SUIZA
              </span>
              <span className="rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide">
                v1.0
              </span>
            </div>
            <p className="text-xs text-blue-100/90 font-normal">
              Instituto de Educación Superior Tecnológico Público &ldquo;Suiza&rdquo;
            </p>
          </div>
        </div>

        {/* Derecha: Dos botones redondeados semitransparentes (Inicio e Iniciar Sesión) */}
        <nav className="flex items-center gap-2.5 sm:gap-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2 text-white transition cursor-pointer backdrop-blur-xs"
          >
            <svg className="w-4 h-4 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Inicio</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2 text-white transition cursor-pointer backdrop-blur-xs"
          >
            <svg className="w-4 h-4 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Iniciar Sesión</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
