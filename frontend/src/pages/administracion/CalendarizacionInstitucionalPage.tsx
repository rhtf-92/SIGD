import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import { apiClient } from "../../api/client";

export interface ActividadCalendarizacion {
  numero: number;
  actividad: string;
  fechaInicio: string;
  fechaFin: string;
  fechaTextoOriginal: string;
  responsables: string;
  anio: number;
  referenciaSeccion: string;
}

export interface RespuestaCalendarizacion {
  fuente: {
    nombre: string;
    anio: number;
    referenciaSeccion: string;
    hashExtraccionSha256: string;
  };
  total: number;
  actividades: ActividadCalendarizacion[];
}

export default function CalendarizacionInstitucionalPage() {
  const [datos, setDatos] = useState<RespuestaCalendarizacion | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState<string>("");

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const respuesta = await apiClient.get<RespuestaCalendarizacion>(
          "/api/v1/admin/calendarizacion-institucional"
        );
        if (!cancelado) {
          setDatos(respuesta.data);
        }
      } catch (err: unknown) {
        if (!cancelado) {
          const mensajeError =
            err instanceof Error ? err.message : "Error al consultar la calendarización institucional";
          setError(mensajeError);
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  const actividadesFiltradas = (datos?.actividades ?? []).filter((act) => {
    if (!busqueda.trim()) return true;
    const query = busqueda.toLowerCase();
    return (
      act.actividad.toLowerCase().includes(query) ||
      act.responsables.toLowerCase().includes(query) ||
      act.fechaTextoOriginal.toLowerCase().includes(query) ||
      act.numero.toString() === query.trim()
    );
  });

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminPageHeader
        title="Calendarización Institucional 2026"
        description="Programación académica e institucional aprobada para el año lectivo 2026 (Sección 7.2)."
      />

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Banner informativo de separación estricta con SLA */}
        <div
          role="note"
          aria-label="Aviso normativo de calendarización"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-xs"
        >
          <p className="font-semibold">Información Institucional — No vinculada al cómputo SLA</p>
          <p className="mt-1 text-xs text-amber-800">
            La presente calendarización corresponde a la agenda académica e hitos institucionales 2026 del
            IESTP &ldquo;Suiza&rdquo;. Esta información es de carácter exclusivamente informativo para la comunidad
            educativa y <strong>no altera los plazos legales de atención, feriados ni el cálculo de días hábiles del SLA</strong>.
          </p>
        </div>

        {/* Buscador */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar por actividad, responsable o fecha..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm shadow-xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
          {datos && (
            <span className="text-xs font-mono text-slate-500">
              Mostrando {actividadesFiltradas.length} de {datos.total} actividades registradas
            </span>
          )}
        </div>

        {/* Estados de carga y error */}
        {cargando && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
            Cargando actividades institucionales...
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm"
          >
            <p className="font-semibold">No se pudo cargar la calendarización institucional.</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}

        {/* Tabla de Actividades */}
        {!cargando && !error && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3.5 w-16 text-center">N°</th>
                  <th scope="col" className="px-4 py-3.5">Actividad</th>
                  <th scope="col" className="px-4 py-3.5 w-44">Período</th>
                  <th scope="col" className="px-4 py-3.5 w-52">Fechas (Texto Original)</th>
                  <th scope="col" className="px-4 py-3.5">Responsables</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {actividadesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No se encontraron actividades que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  actividadesFiltradas.map((act) => (
                    <tr key={act.numero} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-center font-bold font-mono text-slate-600">
                        {act.numero}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {act.actividad}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {act.fechaInicio} al {act.fechaFin}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {act.fechaTextoOriginal}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {act.responsables}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
