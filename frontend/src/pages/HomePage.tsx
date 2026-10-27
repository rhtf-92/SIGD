import HeroInstitucional from "../components/landing/HeroInstitucional";
import SeccionAccesoSigd from "../components/landing/SeccionAccesoSigd";
import SeccionBienvenida from "../components/landing/SeccionBienvenida";
import SeccionCampus from "../components/landing/SeccionCampus";
import SeccionPlataformas from "../components/landing/SeccionPlataformas";
import SeccionProgramas from "../components/landing/SeccionProgramas";
import SeccionVideosInstitucionales from "../components/landing/SeccionVideosInstitucionales";

export default function HomePage() {
  return (
    <main className="bg-white text-slate-900">
      <HeroInstitucional />
      <SeccionAccesoSigd />
      <SeccionVideosInstitucionales />
      <SeccionBienvenida />
      <SeccionProgramas />
      <SeccionPlataformas />
      <SeccionCampus />
    </main>
  );
}
