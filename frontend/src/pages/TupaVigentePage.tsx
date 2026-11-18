import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Skeleton from "../components/Skeleton";
import { normalizarTexto, textoCoincideBusqueda } from "../services/normalizarTexto";
import { mensajeError, tupaApi, type TupaTramite, type TupaVersion } from "../services/tupaApi";

function formatoMonto(tramite: TupaTramite): string {
  if (tramite.derecho_monto !== null) {
    return `S/ ${Number(tramite.derecho_monto).toFixed(2)}`;
  }
  return tramite.derecho_texto || "No especificado";
}

function tramiteCoincideBusqueda(tramite: TupaTramite, consulta: string): boolean {
  return [tramite.codigo, tramite.denominacion, tramite.rubro, tramite.descripcion ?? ""]
    .some((campo) => textoCoincideBusqueda(campo, consulta));
}

export default function TupaVigentePage() {
  const [searchParams] = useSearchParams();
  const [version, setVersion] = useState<TupaVersion | null>(null);
  const [tramites, setTramites] = useState<TupaTramite[]>([]);
  const [rubros, setRubros] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [porPagina, setPorPagina] = useState(20);
  const [pagina, setPagina] = useState(1);
  const [rubro, setRubro] = useState("");
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [seleccionado, setSeleccionado] = useState<TupaTramite | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    const qNormalizado = normalizarTexto(q);
    Promise.all([tupaApi.vigente(), tupaApi.listarVigente({ q: qNormalizado, rubro, pagina })])
      .then(async ([versionActual, respuesta]) => {
        if (!activo) return;
        setVersion(versionActual);
        setRubros(respuesta.rubros);
        setPorPagina(respuesta.porPagina);
        let lista = respuesta.tramites;
        let totalLista = respuesta.total;
        if (qNormalizado && lista.length === 0) {
          const amplia = await tupaApi.listarVigente({ q: "", rubro, pagina: 1 });
          if (!activo) return;
          lista = amplia.tramites.filter((tramite) => tramiteCoincideBusqueda(tramite, qNormalizado));
          totalLista = lista.length;
        }
        setTramites(lista);
        setTotal(totalLista);
      })
      .catch((motivo: unknown) => {
        if (activo) setError(mensajeError(motivo));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [q, rubro, pagina]);

  useEffect(() => {
    const codigo = searchParams.get("codigo");
    if (!codigo) return;
    let activo = true;
    tupaApi.detalle(codigo)
      .then((tramite) => {
        if (activo) setSeleccionado(tramite);
      })
      .catch((motivo: unknown) => {
        if (activo) setError(mensajeError(motivo));
      });
    return () => {
      activo = false;
    };
  }, [searchParams]);

  async function mostrarDetalle(codigo: string) {
    setError("");
    try {
      setSeleccionado(await tupaApi.detalle(codigo));
    } catch (motivo) {
      setError(mensajeError(motivo));
    }
  }

  return (
    <main className="sigd-tupa mx-auto min-h-screen max-w-7xl px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">IESTP &quot;Suiza&quot; · Pucallpa</p>
          <h1 className="mt-1 text-3xl font-bold">TUPA vigente</h1>
          <p className="mt-2 text-sm text-slate-600">
            {version ? `${version.nombre} · ${version.codigo}` : "Información pública de trámites y servicios."}
          </p>
        </div>
        <Link className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50" to="/tupa/gestion">
          Gestión de versiones
        </Link>
      </div>

      <section className="sigd-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_20rem]">
          <label className="text-sm font-medium text-slate-700">
            Buscar trámite
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(evento) => { setCargando(true); setError(""); setPagina(1); setQ(evento.target.value); }}
              placeholder="Código o denominación"
              value={q}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Rubro
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(evento) => { setCargando(true); setError(""); setPagina(1); setRubro(evento.target.value); }} value={rubro}>
              <option value="">Todos los rubros</option>
              {rubros.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
            </select>
          </label>
        </div>

        {error && <p className="sigd-alert-error mt-4" role="alert">{error}</p>}
        {cargando ? (
          <div className="py-6 space-y-3" role="status" aria-busy="true" aria-label="Cargando trámites">
            <span className="sr-only">Cargando trámites desde el servicio institucional…</span>
            <Skeleton variant="lines" lines={5} />
          </div>
        ) : tramites.length === 0 ? (
          <p className="sigd-empty py-8 text-sm">No se encontraron trámites para esos filtros.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="sigd-table w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr><th className="p-3">Código</th><th className="p-3">Trámite</th><th className="p-3">Plazo</th></tr>
              </thead>
              <tbody>
                {tramites.map((tramite) => (
                  <tr className="border-t border-slate-100 hover:bg-blue-50/50" key={tramite.tramite_version_id}>
                    <td className="p-3 font-mono text-xs">{tramite.codigo}</td>
                    <td className="p-3"><button className="text-left font-semibold text-blue-800 hover:underline" onClick={() => void mostrarDetalle(tramite.codigo)}>{tramite.denominacion}</button></td>
                    <td className="p-3">{tramite.plazo_texto || "No especificado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!cargando && total > porPagina && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-600">{total} trámites · página {pagina} de {Math.ceil(total / porPagina)}</span>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-1.5 disabled:opacity-40" disabled={pagina <= 1} onClick={() => setPagina((actual) => actual - 1)} type="button">Anterior</button>
              <button className="rounded-md border px-3 py-1.5 disabled:opacity-40" disabled={pagina >= Math.ceil(total / porPagina)} onClick={() => setPagina((actual) => actual + 1)} type="button">Siguiente</button>
            </div>
          </div>
        )}
      </section>

      {seleccionado && (
        <section className="sigd-card mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Detalle del trámite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-mono text-xs text-blue-700">{seleccionado.codigo}</p><h2 className="mt-1 text-xl font-bold">{seleccionado.denominacion}</h2></div>
            <button className="rounded-md border px-3 py-1 text-sm" onClick={() => setSeleccionado(null)}>Cerrar detalle</button>
          </div>
          {seleccionado.observaciones?.includes("[VALIDAR]") && <p className="sigd-badge sigd-badge-borrador mt-4">Pendiente de validación</p>}
          {seleccionado.observaciones && /\[REVISAR(?:\s*:|\])/i.test(seleccionado.observaciones) && <p className="sigd-alert-warning mt-3">Esta ficha contiene datos transcritos que deben revisarse con el documento fuente.</p>}
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Requisitos</dt><dd className="mt-1">{seleccionado.requisitos.length ? <ol className="list-decimal space-y-1 pl-5">{seleccionado.requisitos.map((requisito) => <li key={requisito.requisito_id}>{requisito.texto}</li>)}</ol> : "No figuran requisitos."}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Derecho de tramitación</dt><dd className="mt-1">{formatoMonto(seleccionado)}{seleccionado.derecho_porcentaje_uit != null && ` (${seleccionado.derecho_porcentaje_uit} % UIT)`}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Plazo</dt><dd className="mt-1">{seleccionado.plazo_texto || "No especificado"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Rubro</dt><dd className="mt-1">{seleccionado.rubro}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Cuenta de pago</dt><dd className="mt-1">{seleccionado.cuenta_pago || "No especificada"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Calificación / silencio</dt><dd className="mt-1">{seleccionado.calificacion} / {seleccionado.silencio_administrativo}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Unidad que recibe</dt><dd className="mt-1">{seleccionado.unidad_recibe || "No especificada"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Autoridad que resuelve</dt><dd className="mt-1">{seleccionado.autoridad_resuelve || "No especificada"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Recursos</dt><dd className="mt-1 whitespace-pre-wrap">{seleccionado.recursos || "No especificados"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Base legal</dt><dd className="mt-1 whitespace-pre-wrap">{seleccionado.base_legal || "No especificada"}</dd></div>
          </dl>
        </section>
      )}
    </main>
  );
}
