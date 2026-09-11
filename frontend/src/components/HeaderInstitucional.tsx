export default function HeaderInstitucional() {
  return (
    <header className="border-b border-slate-200 bg-blue-900 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
            IESTP “Suiza”
          </p>
          <h1 className="mt-1 text-lg font-bold">Sistema Integral de Gestión Documentaria</h1>
        </div>
        <nav aria-label="Navegación principal" className="hidden gap-4 text-sm font-medium md:flex">
          <a href="/" className="text-blue-100 hover:text-white">Inicio</a>
          <a href="/reportes/dashboard" className="text-blue-100 hover:text-white">Dashboard</a>
        </nav>
      </div>
    </header>
  );
}
