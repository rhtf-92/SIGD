import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import EnlaceLanding from "./EnlaceLanding";

interface Diapositiva {
  etiqueta: string;
  titulo: string;
  descripcion: string;
  cta: { texto: string; to: string };
  secundario: { texto: string; to: string };
}

const DIAPOSITIVAS: Diapositiva[] = [
  {
    etiqueta: "Sistema de Gestión Documental",
    titulo: "Trámites digitales, seguros y con validez legal",
    descripcion:
      "El SIGD centraliza la mesa de partes, la casilla electrónica y el seguimiento de expedientes para que gestiones tus documentos sin salir de casa.",
    cta: { texto: "Iniciar un trámite", to: "/tramite" },
    secundario: { texto: "Consultar con CUT", to: "/consulta" },
  },
  {
    etiqueta: "Gobierno digital",
    titulo: "Presenta y haz seguimiento a tus expedientes en línea",
    descripcion:
      "Registra tus documentos, obtén tu Código Único de Trámite (CUT) y sigue el estado de cada expediente en tiempo real desde cualquier dispositivo.",
    cta: { texto: "Mesa de Partes Virtual", to: "/tramite" },
    secundario: { texto: "Consultar estado", to: "/consulta" },
  },
  {
    etiqueta: "Firma y validez legal",
    titulo: "Documentos firmados digitalmente y verificables con CVD",
    descripcion:
      "Solicita, firma y valida documentos electrónicos con Certificado de Validez Digital, asegurando su autenticidad e integridad.",
    cta: { texto: "Validar documento", to: "/validador-cvd" },
    secundario: { texto: "Acceder al sistema", to: "/login" },
  },
];

const CLASE_ENTRADA =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#006EC7] focus:ring-2 focus:ring-[#006EC7]/20";

export default function HeroInstitucional() {
  const [indice, setIndice] = useState(0);
  const [formulario, setFormulario] = useState({ nombre: "", email: "", mensaje: "" });
  const [enviado, setEnviado] = useState(false);
  const diapositiva = DIAPOSITIVAS[indice];

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      setIndice((actual) => (actual + 1) % DIAPOSITIVAS.length);
    }, 7000);
    return () => window.clearInterval(intervalo);
  }, []);

  const mover = (paso: number) => {
    setIndice((actual) => (actual + paso + DIAPOSITIVAS.length) % DIAPOSITIVAS.length);
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

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:px-8 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F9E000]" />
            {diapositiva.etiqueta}
          </span>

          <h1 className="mt-4 max-w-2xl text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl lg:text-[52px]">
            {diapositiva.titulo}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-blue-100/90 sm:text-base">
            {diapositiva.descripcion}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <EnlaceLanding
              enlace={{ etiqueta: diapositiva.cta.texto, to: diapositiva.cta.to }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#E6007E] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#E6007E]/25 transition hover:bg-[#c90070]"
            >
              {diapositiva.cta.texto}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </EnlaceLanding>
            <EnlaceLanding
              enlace={{ etiqueta: diapositiva.secundario.texto, to: diapositiva.secundario.to }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:border-white/60 hover:bg-white/10"
            >
              {diapositiva.secundario.texto}
            </EnlaceLanding>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              onClick={() => mover(-1)}
              aria-label="Diapositiva anterior"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/25 text-white/80 transition hover:border-white/60 hover:text-white"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              {DIAPOSITIVAS.map((item, posicion) => (
                <button
                  key={item.etiqueta}
                  type="button"
                  onClick={() => setIndice(posicion)}
                  aria-label={`Ir a la diapositiva ${posicion + 1}: ${item.etiqueta}`}
                  aria-current={posicion === indice}
                  className={`h-1.5 rounded-full transition-all ${
                    posicion === indice ? "w-8 bg-[#F9E000]" : "w-3 bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => mover(1)}
              aria-label="Diapositiva siguiente"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/25 text-white/80 transition hover:border-white/60 hover:text-white"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-2xl shadow-black/30 sm:p-7">
            {enviado ? (
              <div className="flex flex-col items-center py-6 text-center">
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
                  <h2 className="text-xl font-black tracking-tight text-[#003366]">Escríbenos</h2>
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
                    rows={3}
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
        </div>
      </div>
    </section>
  );
}
