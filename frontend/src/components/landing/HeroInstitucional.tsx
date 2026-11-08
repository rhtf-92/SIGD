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

export default function HeroInstitucional() {
  const { rol } = useSesion();
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = DIAPOSITIVAS_PORTADA.length;
  const diapositiva = DIAPOSITIVAS_PORTADA[indice];
  const esInterno = Boolean(rol);

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
      className="relative overflow-hidden bg-[#07182b] text-white"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_-10%,rgba(0,110,199,0.45),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_0%,rgba(56,189,248,0.18),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.07] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
            {esInterno ? "Sesión institucional activa" : "IESTP Público “Suiza” · Pucallpa"}
          </span>

          <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            Trámites documentales
            <span className="mt-1 block bg-gradient-to-r from-sky-300 via-white to-cyan-200 bg-clip-text text-transparent">
              simples y con validez legal.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            El SIGD del IESTP Público “Suiza” reúne identidad digital, mesa de partes,
            expedientes y verificación en un solo sistema trazable, seguro y disponible
            para toda la comunidad institucional.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link to="/tramite" className="btn-cyber group px-6 py-3 text-sm">
              <FileSearch className="h-4 w-4" />
              Iniciar un trámite
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/consulta" className="btn-ghost-cyber px-6 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Consultar con CUT
            </Link>
            <button
              type="button"
              onClick={abrirLectorDni}
              className="inline-flex items-center justify-center gap-2 px-2 py-3 text-sm font-semibold text-sky-200 transition hover:text-white"
            >
              <Fingerprint className="h-4 w-4" />
              Escanear DNI digital
            </button>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {INDICADORES.map((item) => (
              <div
                key={item.rotulo}
                className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-3 backdrop-blur-sm"
              >
                <dt className="font-mono text-xl font-bold text-white sm:text-2xl">{item.valor}</dt>
                <dd className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-slate-400">
                  {item.rotulo}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative animate-fade-up [animation-delay:150ms]">
          <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-sky-400/10 blur-3xl" />

          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0a2136] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
            <div className="relative aspect-[16/11] overflow-hidden">
              <img
                key={diapositiva.id}
                src={diapositiva.src}
                alt={diapositiva.titulo}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#04101d] via-[#04101d]/35 to-transparent" />

              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
                <Sparkles className="h-3 w-3" />
                Portada institucional
              </span>

              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-lg font-bold tracking-tight text-white">{diapositiva.titulo}</p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-300">
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
                        posicion === indice ? "w-8 bg-white" : "w-3 bg-white/30 hover:bg-white/60"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 bg-[#081c31]">
              {CAPACIDADES.map(({ icono: Icono, texto }) => (
                <div key={texto} className="flex flex-col items-center gap-1.5 px-2 py-3 text-center">
                  <Icono className="h-4 w-4 text-sky-300" aria-hidden="true" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                    {texto}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute -bottom-5 left-4 hidden items-center gap-3 rounded-xl border border-white/15 bg-[#0a2136] px-4 py-3 shadow-xl sm:flex">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-400/15 text-sky-300">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-bold text-white">Verificación segura</p>
              <p className="text-[10px] text-slate-400">RENIEC · datos en tu dispositivo</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
