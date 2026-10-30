import HeroInstitucional from "../components/landing/HeroInstitucional";
import SeccionBienvenida from "../components/landing/SeccionBienvenida";

export default function HomePage() {
  return (
    <main className="bg-white text-slate-900">
      <HeroInstitucional />
      <SeccionBienvenida />
    </main>
  );
}
