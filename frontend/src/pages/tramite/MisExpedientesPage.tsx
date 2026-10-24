import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { useAuthStore } from "../../stores/authStore";

export interface DtoExpedienteCiudadano {
  expedienteId: string;
  cut: string;
  codigoExpediente: string;
  numero: string;
  asunto: string;
  tipoDocumento: string;
  tipoTramite: string | null;
  estado: string;
  fechaRadicacion: string;
  canalIngreso: string;
  totalFolios: number;
}

export default function MisExpedientesPage() {
  const navigate = useNavigate();
  const usuario = useAuthStore((state) => state.usuario);
  const [expedientes, setExpedientes] = useState<DtoExpedienteCiudadano[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cargarExpedientes = async () => {
    setCargando(true);
    setError(null);
    try {
      const response = await apiClient.get<DtoExpedienteCiudadano[]>(
        "/api/v1/tramites/mis-expedientes"
      );
      setExpedientes(response.data);
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "Error al cargar sus expedientes.";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarExpedientes();
  }, []);

  const formatFecha = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getBadgeEstado = (estado: string) => {
    const norm = estado.toUpperCase();
    if (norm.includes("REGISTRADO") || norm.includes("INICIADO")) {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }
    if (norm.includes("TRAMITE") || norm.includes("REVISION") || norm.includes("DERIVADO")) {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }
    if (norm.includes("ATENDIDO") || norm.includes("FINALIZADO") || norm.includes("CONCLUIDO")) {
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
    if (norm.includes("OBSERVADO")) {
      return "bg-rose-100 text-rose-800 border-rose-200";
    }
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  return (
    <main className="min-h-screen bg-slate-50 py-6 px-3.5 sm:px-6 sm:py-8 lg:px-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Cabecera del Portal Ciudadano */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 mb-1">
              Portal del Ciudadano
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Mis Expedientes
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Bienvenido(a), <span className="font-semibold text-slate-700">{usuario?.nombreCompleto || "Ciudadano"}</span>. Aquí puedes consultar y dar seguimiento a todos tus trámites registrados.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/casilla"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              Casilla Electrónica
            </Link>
            <Link
              to="/tramite"
              className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition"
            >
              + Nuevo Trámite
            </Link>
          </div>
        </div>

        {/* Estados de carga y error */}
        {cargando && (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-3 text-sm text-slate-600 font-medium">Cargando tus expedientes...</p>
          </div>
        )}

        {error && !cargando && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">No se pudieron cargar los expedientes</h3>
                <p className="text-xs mt-1 text-rose-700">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void cargarExpedientes()}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 transition"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Contenido principal: listado o estado vacío */}
        {!cargando && !error && (
          <>
            {expedientes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-2xl font-bold">
                  📄
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  Aún no tienes expedientes radicados
                </h3>
                <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                  Todos los trámites que presentes a través de la Mesa de Partes Virtual aparecerán aquí con su estado y seguimiento en vivo.
                </p>
                <div className="mt-6">
                  <Link
                    to="/tramite"
                    className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition"
                  >
                    Presentar Primer Trámite
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase font-semibold text-slate-700">
                      <tr>
                        <th scope="col" className="px-5 py-3.5">CUT</th>
                        <th scope="col" className="px-5 py-3.5">Fecha</th>
                        <th scope="col" className="px-5 py-3.5">Asunto / Tipo</th>
                        <th scope="col" className="px-5 py-3.5 text-center">Folios</th>
                        <th scope="col" className="px-5 py-3.5">Canal</th>
                        <th scope="col" className="px-5 py-3.5">Estado</th>
                        <th scope="col" className="px-5 py-3.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expedientes.map((exp) => (
                        <tr key={exp.expedienteId} className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {exp.cut}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                            {formatFecha(exp.fechaRadicacion)}
                          </td>
                          <td className="px-5 py-4 max-w-xs">
                            <p className="font-semibold text-slate-800 line-clamp-1">{exp.asunto}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {exp.tipoTramite || exp.tipoDocumento}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-center whitespace-nowrap font-mono text-xs">
                            {exp.totalFolios}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {exp.canalIngreso}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getBadgeEstado(
                                exp.estado
                              )}`}
                            >
                              {exp.estado}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/consulta/${encodeURIComponent(exp.cut)}`)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                            >
                              Seguimiento →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 flex items-center justify-between">
                  <span>Total de expedientes: <strong>{expedientes.length}</strong></span>
                  <span>Actualizado en tiempo real</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
