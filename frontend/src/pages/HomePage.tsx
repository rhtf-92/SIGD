import HeroInstitucional from "../components/landing/HeroInstitucional";
import SeccionAccesoSigd from "../components/landing/SeccionAccesoSigd";
import SeccionBienvenida from "../components/landing/SeccionBienvenida";
import SeccionCampus from "../components/landing/SeccionCampus";
import SeccionPlataformas from "../components/landing/SeccionPlataformas";
import SeccionProgramas from "../components/landing/SeccionProgramas";

export default function HomePage() {
  return (
    <main className="bg-white text-slate-900">
      <HeroInstitucional />
      <SeccionBienvenida />
      <SeccionProgramas />
      <SeccionPlataformas />
      <SeccionAccesoSigd />
      <SeccionCampus />
    
      <section id="apartado-modulos" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Apartado de Módulos</h2>
          <p className="mt-1 text-slate-600">Cada módulo con su presentación, secciones y guía paso a paso.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Inicio / Presentación</h3><p className="mt-1 text-sm text-slate-600">Bienvenida, accesos rápidos y vista general según tu rol.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Mesa de Partes Virtual</h3><p className="mt-1 text-sm text-slate-600">Radicación TUPA, anexos y obtención de CUT.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Casilla Electrónica</h3><p className="mt-1 text-sm text-slate-600">Notificaciones con validez legal.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Expedientes</h3><p className="mt-1 text-sm text-slate-600">Trazabilidad, derivaciones y providencias.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Validador CVD</h3><p className="mt-1 text-sm text-slate-600">Verificación con código CVD o QR.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-bold text-slate-900">Firma / Titulación / Reportes</h3><p className="mt-1 text-sm text-slate-600">Flujos con validez legal, administración e indicadores.</p></article>
        </div>
      </section>
</main>
  );
}
