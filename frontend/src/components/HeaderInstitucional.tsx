import { useNavigate } from "react-router-dom";

interface HeaderInstitucionalProps {
  darkTheme?: boolean;
}

export default function HeaderInstitucional({
  darkTheme = false,
}: HeaderInstitucionalProps) {
  const navigate = useNavigate();

  return (
    <header className={`header-sigd text-white shadow-md print:hidden ${
      darkTheme
        ? "border-b border-cyan-300/20 bg-gradient-to-r from-[#071a25] via-[#0b1725] to-[#1a1024]"
        : "bg-gradient-to-r from-blue-800 to-blue-900"
    }`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <div
          className="flex cursor-pointer items-center gap-3"
          onClick={() => navigate("/")}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border font-black text-base shadow-sm ${
            darkTheme
              ? "border-amber-300/60 bg-slate-950 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.18)]"
              : "border-transparent bg-white text-blue-800"
          }`}>
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider uppercase text-white">
                SIGD SUIZA
              </span>
              <span className={`rounded px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                darkTheme ? "bg-cyan-400/10 text-cyan-200" : "bg-blue-600/60 text-blue-100"
              }`}>
                v1.0
              </span>
            </div>
            <p className={`text-xs font-medium ${darkTheme ? "text-slate-300" : "text-blue-100"}`}>
              Instituto de Educación Superior Tecnológico Público "Suiza"
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => navigate("/casilla")}
            className={`rounded-lg px-3 py-1.5 text-white transition ${
              darkTheme
                ? "border border-cyan-300/20 bg-cyan-400/5 hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-100"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Casilla Electrónica
          </button>
          <button
            type="button"
            onClick={() => navigate("/administracion")}
            className={`rounded-lg px-3 py-1.5 text-white transition ${
              darkTheme
                ? "border border-cyan-300/20 bg-cyan-400/5 hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-100"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Administración
          </button>
        </nav>
      </div>
      <div className={`h-1 w-full ${
        darkTheme
          ? "bg-gradient-to-r from-amber-400 via-cyan-400 to-fuchsia-500"
          : "bg-gradient-to-r from-blue-400 via-rose-500 to-amber-400"
      }`} />
    </header>
  );
}