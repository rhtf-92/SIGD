import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import AdminPageHeader from "../../components/administracion/AdminPageHeader";
import GlassCard from "../../components/administracion/common/GlassCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/administracion/common/StateViews";
import { apiClient } from "../../api/client";
import { ApiHttpError } from "../../types/api";

interface RegistroCiudadano {
  id_persona: string;
  tipo: "NATURAL" | "JURIDICA";
  tipo_documento: string | null;
  ubigeo_distrito_nombre: string | null;
  ubigeo_provincia_nombre: string | null;
  id_documento: string;
  nombre_completo: string;
  correo: string | null;
  telefono: string | null;
  direccion: string | null;
  ubigeo_distrito: string | null;
  referencia_domicilio: string | null;
  fecha_nacimiento: string | null;
  razon_social: string | null;
  representante_legal: string | null;
  representante_tipo_documento: string | null;
  representante_documento: string | null;
  representante_cargo: string | null;
  partida_registral_sunarp: string | null;
  declaracion_jurada_aceptada: boolean;
  consentimiento_ley_29733: boolean;
  acepta_notificaciones: boolean;
  creado_en: string;
}

interface RegistroCiudadanoResponse {
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
  registros: RegistroCiudadano[];
}

const POR_PAGINA = 20;

export default function RegistrosCiudadanosPage() {
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<RegistroCiudadanoResponse | null>(
    null,
  );
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    apiClient
      .get<RegistroCiudadanoResponse>(
        "/api/v1/auth/registro-ciudadanos",
        { params: { pagina, porPagina: POR_PAGINA } },
      )
      .then(({ data }) => {
        if (!vigente) return;
        setResultado(data);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!vigente) return;
        setError(
          requestError instanceof ApiHttpError
            ? requestError.problemDetails.detail
            : "No se pudieron cargar los registros. Verifica la conexión e inténtalo nuevamente.",
        );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [pagina, recarga]);

  const registros = resultado?.registros ?? [];
  const totalPaginas = resultado?.totalPaginas ?? 0;
  const formatearFecha = (fecha: string | null) => {
    if (!fecha) return "No registrada";
    const [anio, mes, dia] = fecha.slice(0, 10).split("-");
    return `${dia}/${mes}/${anio}`;
  };

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Registros Ciudadanos"
        description="Consulta los registros de personas naturales y jurídicas guardados en la base de datos institucional."
        icon={Users}
        badge={`${resultado?.total ?? 0} registros`}
      />

      <section className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <GlassCard>
          {cargando ? (
            <LoadingState message="Cargando registros ciudadanos..." />
          ) : error ? (
            <ErrorState
              title="No se pudieron cargar los registros"
              description={error}
              onRetry={() => {
                setError("");
                setCargando(true);
                setRecarga((actual) => actual + 1);
              }}
            />
          ) : registros.length === 0 ? (
            <EmptyState
              title="Aún no hay registros"
              description="Los registros completados correctamente aparecerán aquí."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1450px] text-left text-sm">
                  <thead className="border-b border-slate-700 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Persona y documento</th>
                      <th className="px-4 py-3">Tipo y nacimiento</th>
                      <th className="px-4 py-3">Contacto</th>
                      <th className="px-4 py-3">Domicilio completo</th>
                      <th className="px-4 py-3">Datos de empresa</th>
                      <th className="px-4 py-3">Fecha de registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {registros.map((registro) => (
                      <tr key={registro.id_persona} className="text-slate-200">
                        <td className="px-4 py-4">
                          <p className="font-semibold">
                            {registro.razon_social ?? registro.nombre_completo}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {registro.tipo_documento ?? "Documento"} {registro.id_documento}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p>{registro.tipo === "NATURAL" ? "Persona natural" : "Persona jurídica"}</p>
                          {registro.tipo === "NATURAL" && (
                            <p className="mt-1 text-xs text-slate-400">
                              Nacimiento: {formatearFecha(registro.fecha_nacimiento)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <p>{registro.correo ?? "Sin correo"}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {registro.telefono ?? "Sin celular"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p>{registro.direccion ?? "Sin dirección"}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {[
                              registro.ubigeo_distrito_nombre ?? registro.ubigeo_distrito,
                              registro.ubigeo_provincia_nombre,
                            ]
                              .filter(Boolean)
                              .join(", ") || "Sin distrito"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Referencia: {registro.referencia_domicilio ?? "Sin referencia"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {registro.tipo === "JURIDICA" ? (
                            <>
                              <p className="font-medium">{registro.razon_social ?? "Sin razón social"}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                Representante: {registro.representante_legal ?? "No registrado"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {registro.representante_tipo_documento ?? "Documento"}{" "}
                                {registro.representante_documento ?? ""}
                                {registro.representante_cargo
                                  ? ` · ${registro.representante_cargo}`
                                  : ""}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Partida SUNARP: {registro.partida_registral_sunarp ?? "No registrada"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Declaración jurada: {registro.declaracion_jurada_aceptada ? "Aceptada" : "No registrada"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Ley 29733: {registro.consentimiento_ley_29733 ? "Aceptado" : "No registrado"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Notificaciones: {registro.acepta_notificaciones ? "Aceptadas" : "No aceptadas"}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-slate-500">Sin datos de persona jurídica</p>
                              <p className="mt-1 text-xs text-slate-400">
                                Declaración jurada: {registro.declaracion_jurada_aceptada ? "Aceptada" : "No registrada"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Ley 29733: {registro.consentimiento_ley_29733 ? "Aceptado" : "No registrado"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                Notificaciones: {registro.acepta_notificaciones ? "Aceptadas" : "No aceptadas"}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {new Date(registro.creado_en).toLocaleString("es-PE")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-4 text-sm text-slate-400">
                <span>
                  {resultado?.total ?? 0} registros · Página {pagina} de{" "}
                  {totalPaginas}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagina <= 1 || cargando}
                    onClick={() => {
                      setCargando(true);
                      setPagina((actual) => actual - 1);
                    }}
                    className="rounded-lg border border-slate-700 px-3 py-2 font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={pagina >= totalPaginas || cargando}
                    onClick={() => {
                      setCargando(true);
                      setPagina((actual) => actual + 1);
                    }}
                    className="rounded-lg border border-slate-700 px-3 py-2 font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </GlassCard>
      </section>
    </div>
  );
}
