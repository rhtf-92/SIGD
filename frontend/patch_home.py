# -*- coding: utf-8 -*-
with open(r'src\pages\HomePage.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''import HeroInstitucional from "../components/landing/HeroInstitucional";
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
}'''

new = '''import HeroInstitucional from "../components/landing/HeroInstitucional";
import SeccionAccesoSigd from "../components/landing/SeccionAccesoSigd";
import SeccionBienvenida from "../components/landing/SeccionBienvenida";

export default function HomePage() {
  return (
    <main className="bg-white text-slate-900">
      <HeroInstitucional />
      <SeccionAccesoSigd />
      <SeccionBienvenida />
    </main>
  );
}'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\pages\HomePage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
