# -*- coding: utf-8 -*-
with open(r'src\components\FooterInstitucional.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''import { Link } from "react-router-dom";

import { CENTRO_AYUDA, COLUMNAS_PIE, CONTACTO, NAVEGACION_PIE } from "../data/landingInstitucional";

export default function FooterInstitucional() {
  return (
    <footer className="border-t border-slate-200 bg-[#00264d] text-white print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p className="text-lg font-bold">SIGD</p>
            <p className="mt-1 text-xs text-white/80">{CONTACTO.sistema}</p>
            <p className="mt-3 text-xs text-white/70">{CONTACTO.ubicacion}</p>
          </div>

          {COLUMNAS_PIE.map((columna) => (
            <div key={columna.titulo}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">{columna.titulo}</h3>
              <ul className="mt-3 space-y-2">
                {columna.enlaces.map((enlace) => (
                  <li key={enlace.etiqueta}>
                    {enlace.to ? (
                      <Link to={enlace.to} className="text-xs text-white/80 hover:text-white">
                        {enlace.etiqueta}
                      </Link>
                    ) : (
                      <a href={enlace.href} className="text-xs text-white/80 hover:text-white">
                        {enlace.etiqueta}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Centro de ayuda</h3>
            <ul className="mt-3 space-y-2">
              {CENTRO_AYUDA.slice(0, 5).map((tema) => (
                <li key={tema.id}>
                  <Link to="/login" className="text-xs text-white/80 hover:text-white">
                    {tema.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/15 pt-6 text-xs text-white/70">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p>
              {CONTACTO.institucion} · {CONTACTO.sistema}
            </p>
            <nav aria-label="Navegación de pie">
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {NAVEGACION_PIE.map((enlace) => (
                  <li key={enlace.etiqueta}>
                    <Link to={enlace.to ?? "/"} className="hover:text-white">
                      {enlace.etiqueta}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p>© 2026</p>
          </div>
        </div>
      </div>
    </footer>
  );
}'''

new = '''import { CONTACTO, NAVEGACION_PIE } from "../data/landingInstitucional";

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
}'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\components\FooterInstitucional.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
