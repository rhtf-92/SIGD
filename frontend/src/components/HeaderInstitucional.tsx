import { useNavigate } from "react-router-dom";

export default function HeaderInstitucional() {
  const navigate = useNavigate();

  return (
    <header className="header-sigd bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <div
          className="flex cursor-pointer items-center gap-3"
          onClick={() => navigate("/")}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-800 font-black text-base shadow-sm">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider uppercase text-white">
                SIGD SUIZA
              </span>
              <span className="rounded bg-blue-600/60 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-100">
                v1.0
              </span>
            </div>
            <p className="text-xs text-blue-100 font-medium">
              Instituto de Educación Superior Tecnológico Público "Suiza"
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => navigate("/casilla")}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition"
          >
            Casilla Electrónica
          </button>
          <button
            type="button"
            onClick={() => navigate("/administracion")}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition"
          >
            Administración
          </button>
        </nav>
      </div>
      <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-rose-500 to-amber-400" />
    </header>
  );
}