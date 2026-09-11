export default function HeaderInstitucional() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-bold tracking-wide text-blue-700">SIGD</p>
          <p className="text-sm font-semibold text-slate-900">
            Instituto Suiza
          </p>
        </div>
        <p className="hidden text-right text-xs font-medium text-slate-500 sm:block">
          Sistema Integral de Gestion Documentaria
        </p>
      </div>
    </header>
  );
}