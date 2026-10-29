import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Inbox,
  Search,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { filtrarModulosPorRol, useSesion } from "../../config/accesoModulos";
import { DIAPOSITIVAS_PORTADA } from "../../data/carruselPortada";

const INTERVALO_MS = 6500;

const ICONOS_ACCESO: Record<string, LucideIcon> = {
  "mesa-virtual": ClipboardList,
  consulta: Search,
  validador: ShieldCheck,
  casilla: Inbox,
};

const CLASE_ENTRADA =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#006EC7] focus:ring-2 focus:ring-[#006EC7]/20";

export default function HeroInstitucional() {
  const { rol, autenticado } = useSesion();
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [formulario, setFormulario] = useState({ nombre: "", email: "", mensaje: "" });
  const [enviado, setEnviado] = useState(false);
  const total = DIAPOSITIVAS_PORTADA.length;
  const diapositiva = DIAPOSITIVAS_PORTADA[indice];

  const accesosRapidos = filtrarModulosPorRol(rol, autenticado).filter((modulo) =>
    ICONOS_ACCESO[modulo.id],
  );

  useEffect(() => {
    if (pausado) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const temporizador = window.setTimeout(() => {
      setIndice((actual) => (actual + 1) % total);
    }, INTERVALO_MS);

    return () => window.clearTimeout(temporizador);
  }, [indice, pausado, total]);

  const mover = (paso: number) => {
    setIndice((actual) => (actual + paso + total) % total);
  };

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setEnviado(true);
  };

  return (
    <section className="relative overflow-hidden bg-[#04213f] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-[#006EC7]/40 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#E6007E]/25 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(4,33,63,0.2),rgba(4,33,63,0.9))]" />
      </div>

      <div className="relative mx-auto max-w-[1536px] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
          <div
            role="region"
            aria-roledescription="carrusel"
            aria-label="Portada institucional IESTP Suiza"
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl shadow-black/40"
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
            onFocusCapture={() => setPausado(true)}
            onBlurCapture={() => setPausado(false)}
            onKeyDown={(evento) => {
              if (evento.key === "ArrowLeft") {
                evento.preventDefault();
                mover(-1);
              }
              if (evento.key === "ArrowRight") {
                evento.preventDefault();
                mover(1);
              }
            }}
          >
            <div className="relative min-h-[380px] w-full sm:min-h-[480px] lg:h-full lg:min-h-[620px]">
              <img
                key={`fondo-${diapositiva.id}`}
                src={diapositiva.src}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
              />

              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#04213f]/95 via-[#04213f]/35 to-[#04213f]/20"
              />

              <img
                key={diapositiva.id}
                src={diapositiva.src}
                alt={diapositiva.titulo}
                className="relative z-10 h-full w-full animate-[portada-fade_500ms_ease-out] object-contain object-center p-0 sm:p-1 lg:max-h-[640px] lg:object-cover"
                loading={indice === 0 ? "eager" : "lazy"}
              />

              <div className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-6 lg:p-8">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F9E000]" />
                  IESTP Suiza · Gestión Documental
                </span>
                <h1 className="mt-2 max-w-2xl text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                  {diapositiva.titulo}
                </h1>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-blue-100/90 sm:text-sm">
                  {diapositiva.descripcion}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <Link
                    to="/tramite"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#E6007E] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#E6007E]/25 transition hover:bg-[#c90070] sm:text-sm"
                  >
                    Iniciar un trámite
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/consulta"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition hover:border-white/60 hover:bg-white/10 sm:text-sm"
                  >
                    Consultar con CUT
                  </Link>
                </div>
              </div>

              <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => mover(-1)}
                  aria-label="Diapositiva anterior"
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/30 text-white/80 backdrop-blur transition hover:border-white/60 hover:text-white"
                >
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(1)}
                  aria-label="Diapositiva siguiente"
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/30 text-white/80 backdrop-blur transition hover:border-white/60 hover:text-white"
                >
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 justify-center gap-2">
                {DIAPOSITIVAS_PORTADA.map((item, posicion) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndice(posicion)}
                    aria-label={`Ir a la diapositiva ${posicion + 1}: ${item.titulo}`}
                    aria-current={posicion === indice}
                    className={`h-1.5 rounded-full transition-all ${
                      posicion === indice ? "w-8 bg-[#F9E000]" : "w-3 bg-white/40 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>

              <p aria-live="polite" className="sr-only">
                Diapositiva {indice + 1} de {total}: {diapositiva.titulo}
              </p>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                Accesos rápidos
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {accesosRapidos.map((modulo) => {
                  const Icono = ICONOS_ACCESO[modulo.id] ?? ClipboardList;
                  return (
                    <Link
                      key={modulo.id}
                      to={modulo.ruta}
                      className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] font-bold text-white transition hover:border-cyan-300/50 hover:bg-white/10"
                    >
                      <Icono aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                      <span className="truncate">{modulo.titulo}</span>
                    </Link>
                  );
                })}
              </div>
              <Link
                to="/accesos"
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-200 transition hover:text-white"
              >
                Ver panel de módulos
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="flex-1 rounded-2xl bg-white p-5 text-slate-900 shadow-2xl shadow-black/30 sm:p-6">
              {enviado ? (
                <div className="flex h-full flex-col items-center justify-center py-6 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 aria-hidden="true" className="h-7 w-7" />
                  </span>
                  <h2 className="mt-4 text-lg font-black text-[#003366]">Mensaje registrado</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Gracias por escribirnos, {formulario.nombre || "estimado estudiante"}. Te contactaremos a la brevedad.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormulario({ nombre: "", email: "", mensaje: "" });
                      setEnviado(false);
                    }}
                    className="mt-5 text-sm font-bold text-[#006EC7] hover:underline"
                  >
                    Enviar otro mensaje
                  </button>
                </div>
              ) : (
                <form onSubmit={enviar} className="space-y-3">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-[#003366]">Escríbenos</h2>
                    <p className="text-xs text-slate-500">Déjanos tus datos y te contactamos.</p>
                  </div>
                  <div>
                    <label htmlFor="hero-nombre" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Nombre completo
                    </label>
                    <input
                      id="hero-nombre"
                      name="nombre"
                      required
                      autoComplete="name"
                      value={formulario.nombre}
                      onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
                      placeholder="Nombres y apellidos"
                      className={CLASE_ENTRADA}
                    />
                  </div>
                  <div>
                    <label htmlFor="hero-email" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Correo electrónico
                    </label>
                    <input
                      id="hero-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={formulario.email}
                      onChange={(e) => setFormulario({ ...formulario, email: e.target.value })}
                      placeholder="tucorreo@ejemplo.com"
                      className={CLASE_ENTRADA}
                    />
                  </div>
                  <div>
                    <label htmlFor="hero-mensaje" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Mensaje
                    </label>
                    <textarea
                      id="hero-mensaje"
                      name="mensaje"
                      required
                      rows={2}
                      value={formulario.mensaje}
                      onChange={(e) => setFormulario({ ...formulario, mensaje: e.target.value })}
                      placeholder="Cuéntanos en qué podemos ayudarte"
                      className={`${CLASE_ENTRADA} resize-none`}
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E6007E] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#c90070]"
                  >
                    Enviar mensaje
                    <Send aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <p className="text-center text-[10px] leading-snug text-slate-400">
                    Tus datos se tratan conforme a la Ley N.º 29733 de Protección de Datos Personales.
                  </p>
                </form>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
