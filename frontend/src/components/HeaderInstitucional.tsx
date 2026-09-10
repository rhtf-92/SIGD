export default function HeaderInstitucional() {
  return (
    <header className="border-b border-slate-200 bg-[#1E40AF] text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
            IESTP "Suiza"
          </p>
          <h1 className="text-lg font-bold text-white">SIGD</h1>
        </div>
        <nav aria-label="Navegación principal" className="flex items-center gap-4 text-sm">
          <a href="/" className="rounded px-3 py-2 text-blue-50 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Inicio
          </a>
          <a href="/administracion" className="rounded px-3 py-2 text-blue-50 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Administración
          </a>
        </nav>
      </div>
    </header>
  );
}
