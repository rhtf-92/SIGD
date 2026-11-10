import { CONTACTO, NAVEGACION_PIE } from "../data/landingInstitucional";

export default function FooterInstitucional() {
  return (
    <footer className="border-t border-[#d7e9f7] bg-white text-[#0b2a4a] print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-[#4b6b85]">
            {CONTACTO.institucion} · {CONTACTO.sistema}
          </p>
          <nav aria-label="Navegación de pie">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {NAVEGACION_PIE.map((enlace) => (
                <li key={enlace.etiqueta}>
                  {enlace.to ? (
                    <a href={enlace.to} className="text-xs text-[#4b6b85] hover:text-[#006ec7]">
                      {enlace.etiqueta}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-xs text-[#6b8aa5]">© 2026</p>
        </div>
      </div>
    </footer>
  );
}