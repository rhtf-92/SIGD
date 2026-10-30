import HeroInstitucional from "../components/landing/HeroInstitucional";
import SeccionAccesoSigd from "../components/landing/SeccionAccesoSigd";
import SeccionBienvenida from "../components/landing/SeccionBienvenida";
import SeccionPlataformas from "../components/landing/SeccionPlataformas";
import SeccionProgramas from "../components/landing/SeccionProgramas";

export default function HomePage() {
  return (
    <main className="bg-white text-slate-900">
      <HeroInstitucional />
      <SeccionAccesoSigd />
      <SeccionBienvenida />
      <SeccionProgramas />
      <SeccionPlataformas />
    </main>
  );
}
