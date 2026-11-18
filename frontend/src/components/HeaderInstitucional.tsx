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
        ? "border-b border-blue-950 bg-blue-900"
        : "bg-gradient-to-r from-blue-800 to-blue-900"
    }`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <div
          className="flex cursor-pointer items-center gap-3"
          onClick={() => navigate("/")}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border font-black text-base shadow-sm ${
            darkTheme
              ? "border-white/20 bg-white text-blue-900"
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
                darkTheme ? "bg-white/10 text-blue-100" : "bg-blue-600/60 text-blue-100"
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
                ? "border border-white/20 bg-white/5 hover:bg-white/15"
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
                ? "border border-white/20 bg-white/5 hover:bg-white/15"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Administración
          </button>
        </nav>
      </div>
      <div className={`h-1 w-full ${
        darkTheme
          ? "bg-blue-700"
          : "bg-gradient-to-r from-blue-400 via-rose-500 to-amber-400"
      }`} />
    </header>
  );
}