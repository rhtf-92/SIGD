import { CONTACTO, NAVEGACION_PIE } from "../data/landingInstitucional";

export default function FooterInstitucional() {
  return (
    <footer className="border-t border-slate-200 bg-[#00264d] text-white print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-white/80">
            {CONTACTO.institucion} · {CONTACTO.sistema}
          </p>
          <nav aria-label="Navegación de pie">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {NAVEGACION_PIE.map((enlace) => (
                <li key={enlace.etiqueta}>
                  {enlace.to ? (
                    <a href={enlace.to} className="text-xs text-white/80 hover:text-white">
                      {enlace.etiqueta}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-xs text-white/70">© 2026</p>
        </div>
      </div>
    </footer>
  );
}