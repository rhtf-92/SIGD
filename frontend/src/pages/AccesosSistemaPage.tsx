import { LayoutGrid } from "lucide-react";

import SeccionAccesoSigd from "../components/landing/SeccionAccesoSigd";
import { useSesion } from "../config/accesoModulos";

export default function AccesosSistemaPage() {
  const { rol, autenticado } = useSesion();

  return (
    <main className="min-h-[60vh] bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#006EC7]">
            <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />
            Panel principal
          </span>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[#003366] sm:text-3xl">
            {autenticado && rol ? `Bienvenido, ${rol}` : "Bienvenido al SIGD"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {autenticado && rol
              ? "Selecciona un módulo para continuar. Solo verás las opciones asignadas a tu rol."
              : "El modo invitado no permite abrir módulos. Inicia sesión para acceder al SIGD o crea una cuenta ciudadana."}
          </p>
        </div>
      </section>

      <SeccionAccesoSigd />
    </main>
  );
}
