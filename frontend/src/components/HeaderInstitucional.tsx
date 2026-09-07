export default function HeaderInstitucional() {
  return (
    <header className="header-sigd bg-[#006EC7] text-white">
      <div className="h-1 bg-[#E6007E]" />

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-white font-black text-[#006EC7] shadow-md sm:h-20 sm:w-20 sm:text-xl">
            IS
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100">
              Instituto de Educación Superior Tecnológico Público
            </p>
            <h1 className="mt-1 text-lg font-black uppercase tracking-[0.12em] text-white sm:text-xl">
              Suiza de Pucallpa
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-auto">
          <div className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-white">
            SIGD
          </div>

          <div className="text-left lg:text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sky-100">
              Sistema Integral
            </p>
            <p className="text-sm font-semibold text-white">Gestión Documentaria</p>
          </div>
        </div>
      </div>
    </header>
  );
}
