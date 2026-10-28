import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, ShieldCheck, UserRound } from "lucide-react";

import TarjetaModulo from "../components/common/TarjetaModulo";
import { filtrarModulosPorRol, useSesion } from "../config/accesoModulos";
import { useAuthStore } from "../stores/authStore";

export default function HomePage() {
  const { rol, autenticado } = useSesion();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const secciones = filtrarModulosPorRol(rol, autenticado);
  const publicos = secciones.filter((modulo) => modulo.publico).length;
  const prioritarios = secciones.filter((modulo) => modulo.destacado).length;

  return (
    <main className="lienzo-oficio min-h-[calc(100vh_-_var(--sigd-altura-cabecera))]">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        {/* ------------------------------------------------------------------
            Portada institucional
        ------------------------------------------------------------------ */}
        <section className="portada">
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-10">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-vault-azul-tinta">
                IESTP Público “Suiza” · Pucallpa
              </p>

              <h1 className="mt-3 text-3xl font-extrabold leading-[1.15] tracking-tight text-vault-tinta sm:text-4xl lg:text-[2.6rem]">
                Sistema Integral de
                <span className="block">Gestión Documentaria</span>
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-6 text-tinta-500">
                Bandeja de expedientes, mesa de partes, casilla electrónica y
                firma digital con plena validez legal.
              </p>

              {/* Estado de la sesión vigente */}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {autenticado && rol ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-estado-ok/25 bg-estado-ok-lavado px-2.5 py-1.5 text-[11px] font-semibold text-estado-ok">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Sesión activa · {rol}
                    </span>
                    <span className="rounded-md border border-vault-papel-3 bg-white px-2.5 py-1.5 text-[11px] font-medium text-tinta-600">
                      {secciones.length} módulos asignados
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        navigate("/login");
                      }}
                      className="rounded-md border border-vault-papel-3 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-tinta-600 transition hover:border-tinta-300 hover:text-vault-tinta"
                    >
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-estado-alerta/25 bg-estado-alerta-lavado px-2.5 py-1.5 text-[11px] font-semibold text-estado-alerta">
                      <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                      Sin sesión: sólo módulos públicos
                    </span>
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1.5 rounded-md bg-vault-azul px-4 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-white transition hover:bg-vault-azul-profundo"
                    >
                      Iniciar Sesión
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Datos de la institución */}
            <div className="w-full lg:w-64">
              <p className="border-b border-vault-papel-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-tinta-400">
                Datos de la institución
              </p>
              <dl className="mt-1">
                <div className="dato-institucion">
                  <dt className="text-tinta-500">Sede</dt>
                  <dd className="font-semibold text-vault-tinta">Pucallpa</dd>
                </div>
                <div className="dato-institucion">
                  <dt className="text-tinta-500">Alcance</dt>
                  <dd className="font-semibold text-vault-tinta">
                    {autenticado ? "Interno" : "Ciudadano"}
                  </dd>
                </div>
                <div className="dato-institucion">
                  <dt className="text-tinta-500">Módulos</dt>
                  <dd className="font-semibold text-vault-tinta">
                    {String(secciones.length).padStart(2, "0")}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            Resumen
        ------------------------------------------------------------------ */}
        <section
          aria-label="Resumen del catálogo"
          className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <div className="dato-resumen">
            <span className="dato-cifra">{String(secciones.length).padStart(2, "0")}</span>
            <span className="dato-rotulo">Módulos habilitados</span>
          </div>
          <div className="dato-resumen">
            <span className="dato-cifra">{String(publicos).padStart(2, "0")}</span>
            <span className="dato-rotulo">Accesos públicos</span>
          </div>
          <div className="dato-resumen">
            <span className="dato-cifra">{String(prioritarios).padStart(2, "0")}</span>
            <span className="dato-rotulo">Accesos prioritarios</span>
          </div>
          <div className="dato-resumen">
            <span className="text-[13px] font-bold uppercase tracking-wide text-vault-tinta">
              {autenticado && rol ? rol : "Visitante"}
            </span>
            <span className="dato-rotulo">Perfil vigente</span>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            Catálogo de módulos
        ------------------------------------------------------------------ */}
        <section className="mt-9">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-vault-papel-3 pb-3">
            <div>
              <h2 className="section-title">Catálogo de módulos</h2>
              <p className="mt-1 text-xs leading-5 text-tinta-500">
                Accesos disponibles para su perfil institucional.
              </p>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tinta-400">
              {secciones.length} accesos ·{" "}
              {autenticado ? "orden por rol" : "acceso público"}
            </p>
          </div>

          {secciones.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-vault-papel-3 bg-white/60 px-6 py-10 text-center text-sm text-tinta-500">
              No hay módulos habilitados para su perfil institucional.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {secciones.map((modulo, indice) => (
                <TarjetaModulo
                  key={modulo.id}
                  modulo={modulo}
                  indice={indice}
                />
              ))}
            </div>
          )}
        </section>

        <p className="mt-9 border-t border-vault-papel-3 pt-4 text-[11px] leading-5 text-tinta-400">
          La visibilidad de cada módulo se resuelve contra la matriz RBAC
          institucional (ENT-M05-03). Al iniciar sesión se muestran únicamente
          los módulos asignados a su rol.
        </p>
      </div>
    </main>
  );
}
