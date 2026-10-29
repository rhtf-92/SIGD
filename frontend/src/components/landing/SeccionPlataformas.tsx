<<<<<<< Updated upstream
import {
=======
﻿import {
>>>>>>> Stashed changes
  ArrowRight,
  ExternalLink,
  FileCheck2,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useSesion } from "../../config/accesoModulos";
import {
  MODULOS_SIGD,
  imagenPlaceholder,
} from "../../data/landingInstitucional";

/** Accesos directos a servicios del SIGD (requieren sesión). */
const ACCESOS_SIGD = MODULOS_SIGD.filter((m) => m.publico);

export default function SeccionPlataformas() {
  const { autenticado } = useSesion();

  return (
    <section id="plataformas" className="scroll-mt-24 bg-slate-50 py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#003366] via-[#004a8f] to-[#006EC7] text-white shadow-xl">
          <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                <FileCheck2 aria-hidden="true" className="h-3.5 w-3.5" />
                Gestión documental
              </span>
              <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">Gestiona tus documentos con el SIGD</h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-blue-100/90">
                Presenta tus trámites, recibe notificaciones en tu casilla electrónica y verifica documentos con validez
                legal, todo desde una sola plataforma segura y trazable.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to={autenticado ? "/tramite" : "/login"}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F9E000] px-5 py-2.5 text-sm font-black text-[#003366] transition hover:bg-[#e6cf00]"
                >
                  Ir a Mesa de Partes
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  to={autenticado ? "/consulta" : "/login"}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Consultar por CUT
                </Link>
              </div>
            </div>
            <img
              src={imagenPlaceholder("SIGD", 700, 460)}
              alt="Panel del sistema de gestión documental SIGD"
              loading="lazy"
              className="aspect-[4/3] w-full rounded-xl border border-white/15 object-cover shadow-lg"
            />
          </div>
        </div>

        <div className="mt-14">
          <div className="max-w-2xl">
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#E6007E]">Accesos directos</span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#003366] sm:text-3xl">Servicios del SIGD</h2>
            <p className="mt-1 text-sm text-slate-500">
              Inicia sesión para abrir estos servicios y módulos del SIGD.
            </p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ACCESOS_SIGD.map((modulo) => (
              <Link
                key={modulo.id}
                to={autenticado ? modulo.ruta : "/login"}
                className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#006EC7]/40 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-[#003366]">
                    <FileCheck2 aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#006EC7]"
                  />
                </div>
                <h3 className="mt-3 text-sm font-black text-[#003366]">{modulo.titulo}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{modulo.descripcion}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#006EC7]">
                  Abrir en el SIGD
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export type { LucideIcon };
