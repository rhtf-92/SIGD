import { useMemo, useState } from "react";

import type {
  EstadoExpediente,
  Expediente,
  MovimientoExpediente,
} from "../../types/expediente";

const estados: EstadoExpediente[] = [
  "Pendiente",
  "En Proceso",
  "Observado",
  "Derivado",
  "Notificado",
  "Archivado",
];

const etiquetasEstado: Record<EstadoExpediente, string> = {
  Pendiente: "Pendientes",
  "En Proceso": "En Proceso",
  Observado: "Observados",
  Derivado: "Derivados",
  Notificado: "Notificados",
  Archivado: "Archivados",
};

const expedientesPrueba: Expediente[] = [
  {
    id: 1,
    codigo: "EXP-2026-000001",
    solicitante: "Juan Carlos Pérez",
    documento: "71234567",
    asunto: "Solicitud de certificado de estudios",
    fecha: "2026-08-28",
    estado: "Pendiente",
    movimiento: "Entrada",
    area: "Secretaría Académica",
  },
  {
    id: 2,
    codigo: "EXP-2026-000002",
    solicitante: "María Fernanda López",
    documento: "74561238",
    asunto: "Solicitud de constancia de matrícula",
    fecha: "2026-08-27",
    estado: "Pendiente",
    movimiento: "Entrada",
    area: "Secretaría Académica",
  },
  {
    id: 3,
    codigo: "EXP-2026-000003",
    solicitante: "Luis Alberto Ramos",
    documento: "70124589",
    asunto: "Actualización de datos académicos",
    fecha: "2026-08-26",
    estado: "En Proceso",
    movimiento: "Entrada",
    area: "Registros Académicos",
  },
  {
    id: 4,
    codigo: "EXP-2026-000004",
    solicitante: "Ana Torres García",
    documento: "73654821",
    asunto: "Rectificación de nombres",
    fecha: "2026-08-25",
    estado: "Observado",
    movimiento: "Entrada",
    area: "Registros Académicos",
  },
  {
    id: 5,
    codigo: "EXP-2026-000005",
    solicitante: "Carlos Mendoza Ruiz",
    documento: "76895412",
    asunto: "Solicitud de récord académico",
    fecha: "2026-08-24",
    estado: "Derivado",
    movimiento: "Salida",
    area: "Dirección Académica",
  },
  {
    id: 6,
    codigo: "EXP-2026-000006",
    solicitante: "Rosa Elena Salazar",
    documento: "72369854",
    asunto: "Solicitud de certificado modular",
    fecha: "2026-08-23",
    estado: "Notificado",
    movimiento: "Salida",
    area: "Secretaría Académica",
  },
  {
    id: 7,
    codigo: "EXP-2026-000007",
    solicitante: "José Manuel Díaz",
    documento: "74125896",
    asunto: "Solicitud de duplicado de documento",
    fecha: "2026-08-22",
    estado: "Archivado",
    movimiento: "Entrada",
    area: "Archivo Central",
  },
];

function estiloEstado(estado: EstadoExpediente) {
  const estilos: Record<EstadoExpediente, string> = {
    Pendiente: "bg-amber-100 text-amber-800",
    "En Proceso": "bg-blue-100 text-blue-800",
    Observado: "bg-red-100 text-red-800",
    Derivado: "bg-purple-100 text-purple-800",
    Notificado: "bg-emerald-100 text-emerald-800",
    Archivado: "bg-slate-200 text-slate-700",
  };

  return estilos[estado];
}

function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function BandejaExpedientesPage() {
  const [estadoActivo, setEstadoActivo] =
    useState<EstadoExpediente>("Pendiente");

  const [codigo, setCodigo] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [movimiento, setMovimiento] = useState<
    MovimientoExpediente | "Todos"
  >("Todos");

  const expedientesFiltrados = useMemo(() => {
    return expedientesPrueba.filter((expediente) => {
      const coincideEstado = expediente.estado === estadoActivo;

      const coincideCodigo =
        codigo.trim() === "" ||
        expediente.codigo
          .toLowerCase()
          .includes(codigo.trim().toLowerCase());

      const busquedaSolicitante =
        solicitante.trim().toLowerCase();

      const coincideSolicitante =
        busquedaSolicitante === "" ||
        expediente.solicitante
          .toLowerCase()
          .includes(busquedaSolicitante) ||
        expediente.documento.includes(busquedaSolicitante);

      const coincideDesde =
        fechaDesde === "" || expediente.fecha >= fechaDesde;

      const coincideHasta =
        fechaHasta === "" || expediente.fecha <= fechaHasta;

      const coincideMovimiento =
        movimiento === "Todos" ||
        expediente.movimiento === movimiento;

      return (
        coincideEstado &&
        coincideCodigo &&
        coincideSolicitante &&
        coincideDesde &&
        coincideHasta &&
        coincideMovimiento
      );
    });
  }, [
    estadoActivo,
    codigo,
    solicitante,
    fechaDesde,
    fechaHasta,
    movimiento,
  ]);

  const limpiarFiltros = () => {
    setCodigo("");
    setSolicitante("");
    setFechaDesde("");
    setFechaHasta("");
    setMovimiento("Todos");
  };

  const cantidadPorEstado = (estado: EstadoExpediente) =>
    expedientesPrueba.filter(
      (expediente) => expediente.estado === estado,
    ).length;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-bold text-blue-700">
              SIGD
            </p>

            <h1 className="text-xl font-bold">
              Sistema Integral de Gestión Documentaria
            </h1>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold">
              Área / Oficina
            </p>

            <p className="text-xs text-slate-500">
              Bandeja de trabajo
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-7">
          <h2 className="text-3xl font-bold">
            Bandeja de Expedientes
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Consulta los expedientes asignados a tu área u oficina.
          </p>
        </div>

        <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex min-w-max gap-2">
            {estados.map((estado) => (
              <button
                key={estado}
                type="button"
                onClick={() => setEstadoActivo(estado)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  estadoActivo === estado
                    ? "bg-blue-700 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {etiquetasEstado[estado]}

                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    estadoActivo === estado
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {cantidadPorEstado(estado)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">
            Búsqueda avanzada
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Filtra por código, solicitante, movimiento y rango de fechas.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label
                htmlFor="codigo"
                className="mb-2 block text-sm font-semibold"
              >
                Código de expediente
              </label>

              <input
                id="codigo"
                value={codigo}
                onChange={(event) =>
                  setCodigo(event.target.value.toUpperCase())
                }
                placeholder="EXP-2026-000001"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="solicitante"
                className="mb-2 block text-sm font-semibold"
              >
                Solicitante
              </label>

              <input
                id="solicitante"
                value={solicitante}
                onChange={(event) =>
                  setSolicitante(event.target.value)
                }
                placeholder="Nombre o DNI"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="movimiento"
                className="mb-2 block text-sm font-semibold"
              >
                Entrada / Salida
              </label>

              <select
                id="movimiento"
                value={movimiento}
                onChange={(event) =>
                  setMovimiento(
                    event.target.value as
                      | MovimientoExpediente
                      | "Todos",
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="Todos">Todos</option>
                <option value="Entrada">Entrada</option>
                <option value="Salida">Salida</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="desde"
                className="mb-2 block text-sm font-semibold"
              >
                Desde
              </label>

              <input
                id="desde"
                type="date"
                value={fechaDesde}
                onChange={(event) =>
                  setFechaDesde(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="hasta"
                className="mb-2 block text-sm font-semibold"
              >
                Hasta
              </label>

              <input
                id="hasta"
                type="date"
                value={fechaHasta}
                onChange={(event) =>
                  setFechaHasta(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={limpiarFiltros}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-100"
            >
              Limpiar filtros
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="font-bold">
              {etiquetasEstado[estadoActivo]}
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              {expedientesFiltrados.length} expediente
              {expedientesFiltrados.length === 1 ? "" : "s"} encontrado
              {expedientesFiltrados.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Código</th>
                  <th className="px-6 py-3">Solicitante</th>
                  <th className="px-6 py-3">Asunto</th>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Movimiento</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Área</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {expedientesFiltrados.length > 0 ? (
                  expedientesFiltrados.map((expediente) => (
                    <tr
                      key={expediente.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 text-sm font-bold text-blue-700">
                        {expediente.codigo}
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold">
                          {expediente.solicitante}
                        </p>

                        <p className="text-xs text-slate-500">
                          DNI: {expediente.documento}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {expediente.asunto}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {formatearFecha(expediente.fecha)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            expediente.movimiento === "Entrada"
                              ? "bg-cyan-100 text-cyan-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {expediente.movimiento}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estiloEstado(
                            expediente.estado,
                          )}`}
                        >
                          {expediente.estado}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {expediente.area}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-14 text-center"
                    >
                      <p className="font-semibold">
                        No se encontraron expedientes
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Modifica los filtros e intenta nuevamente.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}