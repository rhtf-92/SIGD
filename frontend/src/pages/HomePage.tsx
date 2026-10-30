import { filtrarModulosPorRol, useSesion } from "../config/accesoModulos";
import { elementoIconoModulo } from "../config/iconosModulos";
import { useNavigate } from "react-router-dom";
import HeroInstitucional from "../components/landing/HeroInstitucional";
import SeccionBienvenida from "../components/landing/SeccionBienvenida";

const ROLES_ADMIN: string[] = ["SUPER_ADMIN", "DIRECTOR", "director_general", "DOCENTE", "MESA_PARTES", "mesa_de_partes"];

function AccesosModulosInternos() {
  const { rol, autenticado } = useSesion();
  const navigate = useNavigate();
  const visibles = filtrarModulosPorRol(rol, autenticado);
  const esInterno = Boolean(rol) && ROLES_ADMIN.includes(rol as string);

  if (!esInterno || visibles.length === 0) return null;

  const irA = (ruta: string) => navigate(ruta);

  return (
    <section className="bg-[#0D1B2A]/30 py-10 sm:py-12 border-t border-vault-papel-2/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">
            Módulos de acceso directo
          </span>
          <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-vault-tinta sm:text-3xl">
            Acceso rápido a módulos
          </h2>
          <p className="mt-2 text-sm text-tinta-500">
            Selecciona el módulo que necesitas. El acceso está filtrado por tu rol institucional.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibles.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => irA(m.ruta)}
              className="group relative flex flex-col items-center justify-between rounded-2xl border border-vault-papel-3 bg-white p-5 text-left transition hover:border-vault-azul hover:bg-white hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-vault-papel-2 bg-white/50 mb-3 group-hover:bg-vault-azul/10 group-hover:border-vault-azul transition-colors">
                {elementoIconoModulo(m.id, "h-6 w-6")}
              </div>
              <div className="min-w-0 text-center">
                <span className="block truncate font-semibold text-vault-tinta text-sm">
                  {m.titulo}
                </span>
                <span className="block mt-1 text-[11px] text-tinta-400 leading-tight">
                  {m.descripcion}
                </span>
              </div>
              <span
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-vault-azul text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { rol } = useSesion();
  const esInterno = Boolean(rol) && ROLES_ADMIN.includes(rol as string);

  return (
    <main className="bg-white text-slate-900">
      <HeroInstitucional />
      {!esInterno && <SeccionBienvenida />}
      <AccesosModulosInternos />
      {esInterno && <SeccionBienvenida />}
    </main>
  );
}
