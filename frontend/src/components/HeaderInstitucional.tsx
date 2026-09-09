export default function HeaderInstitucional() {
  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
            SIGD
          </p>
          <h1 className="text-lg font-bold text-slate-900">
            Instituto Suiza
          </h1>
        </div>
        <nav aria-label="Navegación principal" className="flex gap-4 text-sm text-slate-600">
          <a href="/" className="hover:text-blue-700">Inicio</a>
          <a href="/administracion" className="hover:text-blue-700">Administración</a>
          <a href="/tramite/mesa-partes-virtual" className="hover:text-blue-700">
            Mesa de Partes
          </a>
        </nav>
      </div>
    </header>
  );
}
