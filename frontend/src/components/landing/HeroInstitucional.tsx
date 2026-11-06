import {
  Activity,
  ArrowRight,
  Cpu,
  FileCheck2,
  Fingerprint,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useSesion } from "../../config/accesoModulos";
import { DIAPOSITIVAS_PORTADA } from "../../data/carruselPortada";

const INTERVALO_MS = 6000;

const INDICADORES = [
  { valor: "12", rotulo: "Módulos integrados" },
  { valor: "24/7", rotulo: "Mesa de partes" },
  { valor: "100%", rotulo: "Trazabilidad" },
];

const CAPACIDADES = [
  { icono: ScanLine, texto: "Lectura de DNI digital" },
  { icono: ShieldCheck, texto: "Firma y validez legal" },
  { icono: Cpu, texto: "Asistente IA institucional" },
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
      className="relative overflow-hidden"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.11),transparent_55%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full border border-white/10 animate-spin-slow" />
        <div className="absolute -right-10 top-24 h-40 w-40 rounded-full border border-dashed border-white/10 animate-spin-slow" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24">
        <div className="animate-fade-up">
          <span className="cyber-chip">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-soft" />
            {esInterno ? "Sesión institucional activa" : "Plataforma documental inteligente"}
          </span>

          <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            Gestión documentaria
            <span className="block text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.55)]">
              del futuro.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            El SIGD del IESTP Público “Suiza” conecta trámites, expedientes, casillas
            electrónicas y verificación pública en una sola experiencia. Simple, trazable y
            diseñada para las personas.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/tramite" className="btn-cyber group px-6 py-3 text-sm">
              Iniciar un trámite
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <button type="button" onClick={abrirLectorDni} className="btn-ghost-cyber px-6 py-3 text-sm">
              <Fingerprint className="h-4 w-4" />
              Escanear DNI digital
            </button>
            <Link
              to="/consulta"
              className="inline-flex items-center gap-2 px-2 py-3 text-sm font-semibold text-zinc-400 transition hover:text-white"
            >
              Consultar con CUT
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {INDICADORES.map((item) => (
              <div
                key={item.rotulo}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 backdrop-blur-sm"
              >
                <p className="font-mono text-xl font-bold text-white sm:text-2xl">{item.valor}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {item.rotulo}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-fade-up [animation-delay:150ms]">
          <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-white/[0.04] blur-2xl" />
          <div className="cyber-panel relative overflow-hidden p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/80 animate-pulse-soft" />
                <span className="h-2 w-2 rounded-full bg-white/25" />
                <span className="h-2 w-2 rounded-full bg-white/25" />
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                  sigd · terminal
                </span>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                <Activity className="h-3 w-3" />
                en línea
              </span>
            </div>

            <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/12 bg-black/50 p-5">
              <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent animate-scan" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                    Documento nacional de identidad
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold tracking-[0.18em] text-white">
                    7 4 5 6 • • • •
                  </p>
                </div>
                <span className="grid h-14 w-14 place-items-center rounded-xl border border-white/15 bg-white/[0.04]">
                  <Fingerprint className="h-7 w-7 text-white/80" />
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Verificación
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    RENIEC · demo
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Estado
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-soft" />
                    Datos listos
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 font-mono text-[11px] text-zinc-500">
                <p className="flex items-center gap-2">
                  <FileCheck2 className="h-3.5 w-3.5 text-white/60" />
                  &gt; vinculando identidad al expediente…
                </p>
                <p className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-white/60" />
                  &gt; caché local cifrada · ok
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {CAPACIDADES.map(({ icono: Icono, texto }) => (
                <div key={texto} className="flex items-center gap-3 text-sm text-zinc-300">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <Icono className="h-4 w-4" />
                  </span>
                  {texto}
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                    activo
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                Portada institucional
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DIAPOSITIVAS_PORTADA.map((item, posicion) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndice(posicion)}
                    aria-label={`Ver portada ${posicion + 1}: ${item.titulo}`}
                    aria-current={posicion === indice}
                    className={`h-1.5 rounded-full transition-all ${
                      posicion === indice ? "w-8 bg-white" : "w-3 bg-white/25 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                {diapositiva.descripcion}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
