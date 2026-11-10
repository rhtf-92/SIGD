import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Fingerprint,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Logo3D from "../common/Logo3D";
import { useSesion } from "../../config/accesoModulos";
import { DIAPOSITIVAS_PORTADA } from "../../data/carruselPortada";

const INTERVALO_MS = 6500;

const INDICADORES = [
  { valor: "CUT", rotulo: "Seguimiento inmediato" },
  { valor: "24/7", rotulo: "Mesa de partes" },
  { valor: "100%", rotulo: "Trazabilidad" },
];

const CAPACIDADES = [
  { icono: ScanLine, texto: "Lectura DNIe" },
  { icono: ShieldCheck, texto: "Firma digital" },
  { icono: Sparkles, texto: "Asistente SIGI" },
];

const ACCESOS_PLATAFORMA = [
  {
    icono: FileSearch,
    titulo: "Mesa de partes digital",
    descripcion: "Radica y sigue tus trámites con tu CUT.",
  },
  {
    icono: ShieldCheck,
    titulo: "Casilla electrónica",
    descripcion: "Recibe notificaciones con validez legal.",
  },
  {
    icono: ScanLine,
    titulo: "Verificación y firma",
    descripcion: "Valida documentos y firmas digitales.",
  },
];

export default function HeroInstitucional() {
  const { rol } = useSesion();
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = DIAPOSITIVAS_PORTADA.length;
  const diapositiva = DIAPOSITIVAS_PORTADA[indice];
  const esEstudiante = rol === "ESTUDIANTE";

  useEffect(() => {
    if (pausado) return;
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const temporizador = window.setTimeout(() => {
      setIndice((actual) => (actual + 1) % total);
    }, INTERVALO_MS);
    return () => window.clearTimeout(temporizador);
  }, [indice, pausado, total]);

  const abrirLectorDni = () => {
    window.dispatchEvent(new Event("sigd:abrir-lector-dni"));
  };

  return (
    <section
      className="relative overflow-hidden border-b border-[#d7e9f7] bg-gradient-to-b from-white via-[#f4f8fb] to-[#eaf3fb] text-ink"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_-10%,rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_0%,rgba(0,110,199,0.1),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(0,110,199,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,110,199,0.06)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#bfe0f7] to-transparent" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#bfe0f7] bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00539b] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#006ec7] animate-pulse-soft" />
            {esEstudiante ? "Sesión de estudiante activa" : "IESTP Público “Suiza” · Pucallpa"}
          </span>

          <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.04] tracking-[-0.045em] text-ink sm:text-5xl lg:text-6xl">
            Trámites documentales
            <span className="mt-1 block bg-gradient-to-r from-[#00539b] via-[#006ec7] to-[#38bdf8] bg-clip-text text-transparent">
              simples y con validez legal.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            El SIGD del IESTP Público “Suiza” reúne identidad digital, mesa de partes,
            expedientes y verificación en un solo sistema trazable, seguro y disponible
            para toda la comunidad institucional.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link to="/tramite" className="btn-primary group px-6 py-3 text-sm">
              <FileSearch className="h-4 w-4" />
              Iniciar un trámite
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/consulta" className="btn-secondary px-6 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Consultar con CUT
            </Link>
            <button
              type="button"
              onClick={abrirLectorDni}
              className="inline-flex items-center justify-center gap-2 px-2 py-3 text-sm font-semibold text-[#00539b] transition hover:text-[#006ec7]"
            >
              <Fingerprint className="h-4 w-4" />
              Escanear DNI digital
            </button>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {INDICADORES.map((item) => (
              <div
                key={item.rotulo}
                className="rounded-xl border border-[#d7e9f7] bg-white px-3 py-3 shadow-sm"
              >
                <dt className="font-mono text-xl font-bold text-[#00539b] sm:text-2xl">
                  {item.valor}
                </dt>
                <dd className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-slate-500">
                  {item.rotulo}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex justify-start">
            <Logo3D
              size={112}
              estatico
              className="drop-shadow-[0_18px_45px_rgba(0,110,199,0.24)]"
            />
          </div>
        </div>

        <div className="relative animate-fade-up [animation-delay:150ms]">
          <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-sky-300/20 blur-3xl" />

          {esEstudiante ? (
            <div className="relative z-10 overflow-hidden rounded-2xl border border-[#d7e9f7] bg-white shadow-[0_30px_80px_-40px_rgba(0,110,199,0.45)]">
              <div className="relative aspect-[16/11] overflow-hidden bg-[#eaf3fb]">
                <img
                  key={diapositiva.id}
                  src={diapositiva.src}
                  alt={diapositiva.titulo}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />

                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-[#bfe0f7] bg-white/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#00539b] shadow-sm backdrop-blur">
                  <Sparkles className="h-3 w-3" />
                  Portada institucional
                </span>
              </div>

              <div className="p-5">
                <p className="text-lg font-bold tracking-tight text-ink">{diapositiva.titulo}</p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-600">
                  {diapositiva.descripcion}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {DIAPOSITIVAS_PORTADA.map((item, posicion) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setIndice(posicion)}
                      aria-label={`Ver portada ${posicion + 1}: ${item.titulo}`}
                      aria-current={posicion === indice}
                      className={`h-1.5 rounded-full transition-all ${
                        posicion === indice
                          ? "w-8 bg-[#006ec7]"
                          : "w-3 bg-[#d7e9f7] hover:bg-[#8cc8f0]"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[#eaf3fb] border-t border-[#eaf3fb] bg-[#f4f8fb]">
                {CAPACIDADES.map(({ icono: Icono, texto }) => (
                  <div key={texto} className="flex flex-col items-center gap-1.5 px-2 py-3 text-center">
                    <Icono className="h-4 w-4 text-[#006ec7]" aria-hidden="true" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      {texto}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative z-10 overflow-hidden rounded-2xl border border-[#d7e9f7] bg-white shadow-[0_30px_80px_-40px_rgba(0,110,199,0.4)]">
              <div className="border-b border-[#eaf3fb] bg-[#eaf3fb] p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#bfe0f7] bg-white text-[#006ec7]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <p className="mt-3 text-lg font-bold tracking-tight text-ink">
                  Plataforma institucional
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Accede con tu cuenta institucional para ver los módulos habilitados
                  para tu rol.
                </p>
              </div>
              <ul className="space-y-3 p-5">
                {ACCESOS_PLATAFORMA.map(({ icono: Icono, titulo, descripcion }) => (
                  <li key={titulo} className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#bfe0f7] bg-[#e8f4ff] text-[#006ec7]">
                      <Icono className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold text-ink">{titulo}</span>
                      <span className="block text-[11px] leading-4 text-slate-500">
                        {descripcion}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-[#eaf3fb] bg-[#f4f8fb] p-5">
                <Link to="/login" className="btn-primary w-full px-5 py-2.5 text-sm">
                  Ingresar al sistema
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          <div className="absolute -bottom-5 left-4 hidden items-center gap-3 rounded-xl border border-[#d7e9f7] bg-white px-4 py-3 shadow-xl sm:flex">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e8f4ff] text-[#006ec7]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-bold text-ink">Verificación segura</p>
              <p className="text-[10px] text-slate-500">RENIEC · datos en tu dispositivo</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
