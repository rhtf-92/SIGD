import { ArrowRight, FileSearch, Fingerprint, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { filtrarModulosPorRol, useSesion } from "../config/accesoModulos";
import { elementoIconoModulo } from "../config/iconosModulos";
import HeroInstitucional from "../components/landing/HeroInstitucional";
import SeccionBienvenida from "../components/landing/SeccionBienvenida";
import LectorDniDigital from "../components/dni/LectorDniDigital";

const ROLES_ADMIN: string[] = [
  "SUPER_ADMIN",
  "DIRECTOR",
  "director_general",
  "DOCENTE",
  "MESA_PARTES",
  "mesa_de_partes",
];

function AccesosModulosInternos() {
  const { rol, autenticado } = useSesion();
  const navigate = useNavigate();
  const visibles = filtrarModulosPorRol(rol, autenticado);
  const esInterno = Boolean(rol) && ROLES_ADMIN.includes(rol as string);

  if (!esInterno || visibles.length === 0) return null;

  return (
    <section className="relative border-t border-white/10 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="cyber-chip">
              <Sparkles className="h-3.5 w-3.5" />
              Módulos de acceso directo
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
              Tu panel institucional
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-zinc-400">
            Accesos filtrados según tu rol. Cada módulo conserva trazabilidad y permisos
            granulares.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((modulo, indice) => (
            <button
              key={modulo.id}
              type="button"
              onClick={() => navigate(modulo.ruta)}
              className="glass-card group flex flex-col items-start p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <div className="flex w-full items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/12 bg-white/[0.04] text-white transition group-hover:bg-white group-hover:text-black">
                  {elementoIconoModulo(modulo.id, "h-5 w-5")}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                  {String(indice + 1).padStart(2, "0")}
                </span>
              </div>
              <span className="mt-4 block text-sm font-bold text-white">{modulo.titulo}</span>
              <span className="mt-1.5 block text-xs leading-relaxed text-zinc-400">
                {modulo.descripcion}
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition group-hover:text-white">
                Abrir módulo
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccesosCiudadano() {
  return (
    <section id="accesos" className="relative border-t border-white/10 py-14 sm:py-16">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="glass-card flex flex-col justify-between p-6 lg:col-span-2">
          <div>
            <span className="cyber-chip">
              <Fingerprint className="h-3.5 w-3.5" />
              Identidad digital
            </span>
            <h2 className="mt-5 max-w-xl text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
              Tus datos, listos en segundos.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
              El lector reconoce el código PDF417 del DNI electrónico, muestra la identidad
              completa y guarda los datos en tu dispositivo para agilizar el registro y los
              trámites.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <LectorDniDigital variant="solid" label="Escanear DNI ahora" />
            <Link to="/registro" className="btn-ghost-cyber">
              Ir al registro
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <Link
            to="/tramite"
            className="glass-card group flex flex-col justify-between p-5 transition hover:border-white/30"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/12 bg-white/[0.04] text-white transition group-hover:bg-white group-hover:text-black">
              <FileSearch className="h-5 w-5" />
            </span>
            <div className="mt-5">
              <p className="text-sm font-bold text-white">Mesa de partes virtual</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Inicia un trámite y obtén tu CUT al instante.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition group-hover:text-white">
              Iniciar
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          <Link
            to="/login"
            className="glass-card group flex flex-col justify-between p-5 transition hover:border-white/30"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/12 bg-white/[0.04] text-white transition group-hover:bg-white group-hover:text-black">
              <LogIn className="h-5 w-5" />
            </span>
            <div className="mt-5">
              <p className="text-sm font-bold text-white">Acceso institucional</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Personal administrativo y docentes con roles habilitados.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition group-hover:text-white">
              Ingresar
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-7xl items-center gap-2 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600 sm:px-6 lg:px-8">
        <ShieldCheck className="h-3.5 w-3.5" />
        Lector en modo demostración · los datos se almacenan solo en este dispositivo
      </div>
    </section>
  );
}

export default function HomePage() {
  const { rol } = useSesion();
  const esInterno = Boolean(rol) && ROLES_ADMIN.includes(rol as string);

  return (
    <main className="relative bg-transparent text-zinc-100">
      <HeroInstitucional />
      {!esInterno && <AccesosCiudadano />}
      <AccesosModulosInternos />
      <SeccionBienvenida />
      <LectorDniDigital hideTrigger />
    </main>
  );
}
