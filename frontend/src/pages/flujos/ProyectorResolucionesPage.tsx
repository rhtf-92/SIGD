import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PlantillaResolucionEditor from "../../components/flujos/PlantillaResolucionEditor";
import { useProyectosResolucion } from "../../hooks/useProyectosResolucion";
import type {
  EstadoResolucion,
  ResolucionDirectoral,
  TipoResolucion,
} from "../../types/resolucionAcademica";

const ETIQUETA_ESTADO: Record<EstadoResolucion, string> = {
  BORRADOR: "Borrador",
  EN_REVISION: "En revisión",
  APROBADO_PARA_FIRMA: "Aprobado p/firma",
  FIRMADO_DIGITALMENTE: "Firmado",
};

const COLOR_ESTADO: Record<EstadoResolucion, string> = {
  BORRADOR: "border-slate-200 bg-slate-100 text-slate-700",
  EN_REVISION: "border-amber-200 bg-amber-50 text-amber-700",
  APROBADO_PARA_FIRMA: "border-blue-200 bg-blue-50 text-blue-700",
  FIRMADO_DIGITALMENTE: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function ProyectorResolucionesPage() {
  const navigate = useNavigate();
  const {
    proyectos,
    resumen,
    guardar,
    crearNuevo,
    avanzarEstado,
    retrocederEstado,
    eliminar,
  } = useProyectosResolucion();

  const [alerta, setAlerta] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | EstadoResolucion>("TODOS");
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | TipoResolucion>("TODOS");
  const [editando, setEditando] = useState<ResolucionDirectoral | null>(null);

  function mostrarAviso(texto: string) {
    setAlerta(texto);
    window.setTimeout(() => setAlerta(null), 4000);
  }

  function handleNuevo() {
    setEditando(crearNuevo());
  }

  function handleGuardarBorrador(resolucion: ResolucionDirectoral) {
    try {
      localStorage.setItem(`sigd_rd_borrador_${resolucion.id}`, JSON.stringify(resolucion));
    } catch {
      // sin storage
    }
    guardar(resolucion);
    setEditando(null);
    mostrarAviso(`Borrador ${resolucion.numeroResolucion} guardado en la bandeja.`);
  }

  function handleProcederFirma(resolucion: ResolucionDirectoral) {
    guardar({ ...resolucion, estado: "APROBADO_PARA_FIRMA" });
    setEditando(null);
    navigate("/flujo-validez-legal/firma", {
      state: {
        documentoParaFirma: {
          id: resolucion.id,
          nombreArchivo: `${resolucion.numeroResolucion.replace(/\s+/g, "_")}.pdf`,
          tipo: "RESOLUCION_DIRECTORAL",
          numeroDocumento: resolucion.numeroResolucion,
          asunto: resolucion.asunto || "Resolución directoral",
          tamanoBytes: 245760,
          hashSha256: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
        },
      },
    });
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      if (filtroEstado !== "TODOS" && p.estado !== filtroEstado) return false;
      if (filtroTipo !== "TODOS" && p.tipo !== filtroTipo) return false;
      if (!q) return true;
      return [p.numeroResolucion, p.administradoNombre, p.expedienteRelacionado ?? "", p.asunto]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [proyectos, busqueda, filtroEstado, filtroTipo]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <nav className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link to="/" className="hover:text-blue-700">Inicio</Link>
            <span>/</span>
            <Link to="/flujo-validez-legal" className="hover:text-blue-700">Flujo de Validez Legal</Link>
            <span>/</span>
            <span className="text-slate-800">Proyector de Resoluciones</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Módulo 04 · Validez Legal y Firma Digital
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Proyector de Resoluciones Directorales y Actas
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Redacción estructurada, generación de correlativo institucional y previsualización WYSIWYG oficial (ENT-M04-02).
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                {resumen.total} proyecto(s) · Borrador: {resumen.porEstado.BORRADOR} · Revisión:{" "}
                {resumen.porEstado.EN_REVISION} · Aprobados: {resumen.porEstado.APROBADO_PARA_FIRMA} ·{" "}
                Firmados: {resumen.porEstado.FIRMADO_DIGITALMENTE}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNuevo}
                className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                + Nuevo proyecto
              </button>
              <Link
                to="/flujo-validez-legal/firma"
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ir a Pasarela de Firma Refirma →
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {alerta && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm"
          >
            ✓ {alerta}
          </div>
        )}

        {editando ? (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">
                Editando {editando.numeroResolucion}
              </p>
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                ← Volver a la bandeja
              </button>
            </div>
            <PlantillaResolucionEditor
              key={editando.id}
              resolucionInicial={editando}
              onGuardarBorrador={handleGuardarBorrador}
              onProcederFirma={handleProcederFirma}
            />
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="grid gap-3 md:grid-cols-4">
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por RD, administrado, CUT…"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none md:col-span-2"
              />
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as "TODOS" | EstadoResolucion)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="BORRADOR">Borrador</option>
                <option value="EN_REVISION">En revisión</option>
                <option value="APROBADO_PARA_FIRMA">Aprobado p/firma</option>
                <option value="FIRMADO_DIGITALMENTE">Firmado</option>
              </select>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as "TODOS" | TipoResolucion)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="TODOS">Todos los tipos</option>
                <option value="TITULACION">Titulación</option>
                <option value="GRADO_ACADEMICO">Grado académico</option>
                <option value="CONVALIDACION">Convalidación</option>
                <option value="RECTIFICACION_NOTA">Rectificación</option>
                <option value="DISPOSICION_GENERAL">Disposición general</option>
              </select>
            </div>

            {filtrados.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-bold text-slate-700">Sin proyectos en la bandeja</p>
                <p className="mt-1 text-xs text-slate-500">
                  Crea el primer proyecto de resolución con correlativo anual automático.
                </p>
                <button
                  type="button"
                  onClick={handleNuevo}
                  className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  + Nuevo proyecto
                </button>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-slate-200">
                {filtrados.map((p) => (
                  <li key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700">{p.numeroResolucion}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${COLOR_ESTADO[p.estado]}`}>
                          {ETIQUETA_ESTADO[p.estado]}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {p.tipo}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {p.administradoNombre || "(sin administrado)"} · {p.expedienteRelacionado || "sin CUT"}
                      </p>
                      <p className="text-xs text-slate-500">{p.asunto || "Sin asunto"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditando(p)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      {p.estado !== "FIRMADO_DIGITALMENTE" && (
                        <button
                          type="button"
                          onClick={() => {
                            avanzarEstado(p.id);
                            mostrarAviso(`${p.numeroResolucion} avanzó a ${ETIQUETA_ESTADO[p.estado]}.`);
                          }}
                          className="rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Avanzar →
                        </button>
                      )}
                      {(p.estado === "EN_REVISION" || p.estado === "APROBADO_PARA_FIRMA") && (
                        <button
                          type="button"
                          onClick={() => retrocederEstado(p.id)}
                          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        >
                          ← Devolver
                        </button>
                      )}
                      {p.estado === "BORRADOR" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Eliminar ${p.numeroResolucion}?`)) eliminar(p.id);
                          }}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      )}
                      {(p.estado === "APROBADO_PARA_FIRMA" || p.estado === "EN_REVISION") && (
                        <button
                          type="button"
                          onClick={() => handleProcederFirma(p)}
                          className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                        >
                          A firma →
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
