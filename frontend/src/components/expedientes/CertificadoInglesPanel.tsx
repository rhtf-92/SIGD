import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import type { ExpedienteDetalleRutaDoc } from "../../types/expediente";

interface ModuloInglesAcreditado {
  modulo: string;
  periodo: string;
  horas: number;
  nota: number;
  estado: string;
}

interface RegistroEstudiosIngles {
  registroEstudioId: string;
  tipoDocumentoIdentidad: string;
  numeroDocumentoIdentidad: string;
  apellidosNombres: string;
  codigoMatricula: string | null;
  programaEstudios: string;
  modalidadEstudio: string;
  nivelAlcanzado: string;
  ciclosModulosAprobados: ModuloInglesAcreditado[];
  horasAcademicasTotales: number;
  creditosTotales: number | null;
  promedioFinal: number;
  notaMinimaAprobatoria: number;
  fechaInicio: string;
  fechaTermino: string | null;
  culminado: boolean;
  aprobado: boolean;
  numeroActaFinal: string | null;
  estadoAcademico: "CULMINADO_APROBADO" | "INCOMPLETO" | "DESAPROBADO" | "ANULADO";
  observaciones: string | null;
}

interface EstadoCertificadoInglesResponse {
  esCertificadoIngles: boolean;
  codigoProcedimiento: string | null;
  procedimientoNombre: string | null;
  expediente: {
    expedienteId: string;
    cut: string;
    estadoActual: string;
    areaActualId: string | null;
    areaActualCodigo: string | null;
    solicitanteId: string;
    solicitanteNombre: string;
    solicitanteDocumento: string | null;
  };
  pagoTesoreria: {
    estado: "VERIFICADO" | "PENDIENTE_PAGO" | "SIN_ORDEN";
    ordenId: string | null;
    ordenCodigo: string | null;
    importe: string | null;
    moneda: string | null;
    numeroRecibo: string | null;
    verificadoEn: string | null;
  };
  checklistObligatorioCompleto: boolean;
  observacionesPendientes: number;
  registrosAcademicosDisponibles: RegistroEstudiosIngles[];
  verificacionAcademica: {
    verificacionId: string;
    registroEstudioId: string | null;
    dniVerificado: string;
    culminadoVerificado: boolean;
    aprobadoVerificado: boolean;
    pagoTesoreriaVerificado: boolean;
    numeroReciboTesoreria: string | null;
    numeroActaReferencia: string | null;
    nivelAcreditado: string | null;
    horasAcademicas: number | null;
    promedioFinal: number | null;
    detalleModulosVerificados: ModuloInglesAcreditado[];
    resultado: "FAVORABLE" | "OBSERVADO" | "IMPROCEDENTE";
    observacionesAcademicas: string;
    verificadorNombre: string | null;
    verificadoEn: string;
  } | null;
  certificado: {
    certificadoId: string;
    numeroBorrador: string;
    numeroCertificado: string | null;
    titularNombre: string;
    titularDocumento: string;
    programaOCentro: string;
    nivelEstudios: string;
    horasAcademicas: number;
    promedioFinal: number;
    periodoEstudios: string;
    numeroActa: string;
    asunto: string;
    estado: "BORRADOR_PENDIENTE_FIRMA" | "EN_FIRMA" | "EMITIDO_FIRMADO" | "NOTIFICADO" | "ANULADO";
    documentoAdjuntoId: string | null;
    fechaProyeccion: string;
    firmanteNombre: string | null;
    firmadoEn: string | null;
    hashPades: string | null;
    cvd: string | null;
  } | null;
}

export interface CertificadoInglesPanelProps {
  expediente: ExpedienteDetalleRutaDoc;
  esSecretarioAcademico: boolean;
  esDirectorAutorizado: boolean;
  onElevarAFirma: (resumen?: string) => Promise<void>;
  onAbrirDerivacion?: () => void;
}

function extraerMensajeError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
    return e.response?.data?.detail || e.response?.data?.message || e.message || fallback;
  }
  return fallback;
}

export function CertificadoInglesPanel({
  expediente,
  esSecretarioAcademico,
  esDirectorAutorizado,
  onElevarAFirma,
  onAbrirDerivacion,
}: CertificadoInglesPanelProps) {
  const queryClient = useQueryClient();
  const [registroSeleccionadoId, setRegistroSeleccionadoId] = useState<string>("");
  const [resultadoVerificacion, setResultadoVerificacion] = useState<"FAVORABLE" | "OBSERVADO" | "IMPROCEDENTE">("FAVORABLE");
  const [observacionesAcademicas, setObservacionesAcademicas] = useState("");
  const [mensajeLocal, setMensajeLocal] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [elevando, setElevando] = useState(false);

  const { data, isLoading, error } = useQuery<EstadoCertificadoInglesResponse>({
    queryKey: ["certificado-ingles", expediente.idExpediente],
    queryFn: async () => {
      const res = await apiClient.get<EstadoCertificadoInglesResponse>(
        `/api/v1/certificados-ingles/expediente/${encodeURIComponent(expediente.idExpediente)}`
      );
      return res.data;
    },
    retry: false,
  });

  const verificarMutation = useMutation({
    mutationFn: async () => {
      const idElegido =
        registroSeleccionadoId ||
        data?.registrosAcademicosDisponibles.find((r) => r.estadoAcademico === "CULMINADO_APROBADO")?.registroEstudioId ||
        data?.registrosAcademicosDisponibles[0]?.registroEstudioId ||
        null;

      const res = await apiClient.post(
        `/api/v1/certificados-ingles/expediente/${encodeURIComponent(expediente.idExpediente)}/verificar-antecedentes`,
        {
          registroEstudioId: idElegido,
          resultado: resultadoVerificacion,
          observacionesAcademicas: observacionesAcademicas.trim(),
        }
      );
      return res.data;
    },
    onSuccess: () => {
      setMensajeLocal({
        tipo: "exito",
        texto: "Verificación académica de idioma inglés registrada con trazabilidad WORM.",
      });
      void queryClient.invalidateQueries({ queryKey: ["certificado-ingles", expediente.idExpediente] });
      void queryClient.invalidateQueries({ queryKey: ["expediente", expediente.idExpediente] });
      void queryClient.invalidateQueries({ queryKey: ["trazabilidad", expediente.idExpediente] });
    },
    onError: (err) => {
      setMensajeLocal({
        tipo: "error",
        texto: extraerMensajeError(err, "No fue posible registrar la verificación académica."),
      });
    },
  });

  const proyectarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(
        `/api/v1/certificados-ingles/expediente/${encodeURIComponent(expediente.idExpediente)}/proyectar`,
        {}
      );
      return res.data;
    },
    onSuccess: () => {
      setMensajeLocal({
        tipo: "exito",
        texto: "Borrador oficial de Certificado de Inglés (PDF A4) generado, foliado y almacenado en MinIO.",
      });
      void queryClient.invalidateQueries({ queryKey: ["certificado-ingles", expediente.idExpediente] });
      void queryClient.invalidateQueries({ queryKey: ["expediente", expediente.idExpediente] });
      void queryClient.invalidateQueries({ queryKey: ["trazabilidad", expediente.idExpediente] });
    },
    onError: (err) => {
      setMensajeLocal({
        tipo: "error",
        texto: extraerMensajeError(err, "No se pudo proyectar el Certificado de Inglés."),
      });
    },
  });

  const descargarDocumentoPdf = async (documentoAdjuntoId: string, nombreArchivo: string) => {
    try {
      const res = await apiClient.get<{ downloadUrl: string }>(
        `/api/v1/storage/documentos/${encodeURIComponent(documentoAdjuntoId)}/download`
      );
      const respuesta = await fetch(res.data.downloadUrl, { credentials: "omit" });
      if (!respuesta.ok) throw new Error("Descarga no disponible.");
      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nombreArchivo;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setMensajeLocal({
        tipo: "error",
        texto: extraerMensajeError(err, "No se pudo descargar el PDF del certificado."),
      });
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Consultando verificación académica y estado del Certificado de Inglés…</p>
      </section>
    );
  }

  if (error || !data || !data.esCertificadoIngles) {
    return null;
  }

  const areaEsSec = data.expediente.areaActualCodigo === "SEC";
  const areaEsDg = data.expediente.areaActualCodigo === "DG";
  const estadoEnRevision = data.expediente.estadoActual === "EN_REVISION";
  const puedeVerificarSec = esSecretarioAcademico && areaEsSec && estadoEnRevision;
  const cert = data.certificado;
  const certBloqueadoParaCambio = cert && ["EN_FIRMA", "EMITIDO_FIRMADO", "NOTIFICADO"].includes(cert.estado);
  const verif = data.verificacionAcademica;
  const verifFavorable = Boolean(verif && verif.resultado === "FAVORABLE" && verif.culminadoVerificado && verif.aprobadoVerificado);
  const registroAptoDefault = data.registrosAcademicosDisponibles.find((r) => r.estadoAcademico === "CULMINADO_APROBADO");

  return (
    <section
      aria-labelledby="titulo-certificado-ingles"
      className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id="titulo-certificado-ingles" className="text-base font-bold text-slate-900">
              Tramitación Especializada SUZ26-006 — Certificado de Inglés (Opción A)
            </h2>
            {cert?.estado === "EMITIDO_FIRMADO" || cert?.estado === "NOTIFICADO" ? (
              <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                Emitido y Firmado Digitalmente
              </span>
            ) : cert?.estado === "EN_FIRMA" ? (
              <span className="rounded-full bg-indigo-100 border border-indigo-300 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                En Despacho DG para Firma Digital
              </span>
            ) : cert?.estado === "BORRADOR_PENDIENTE_FIRMA" ? (
              <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                Certificado Proyectado ({cert.numeroBorrador})
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Emisión por estudios de idioma inglés culminados y aprobados en el propio IESTP &ldquo;Suiza&rdquo;.
          </p>
        </div>
      </div>

      {mensajeLocal && (
        <div
          role="alert"
          className={`rounded-xl border p-3.5 text-xs font-semibold ${
            mensajeLocal.tipo === "exito"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {mensajeLocal.texto}
        </div>
      )}

      {/* 1. Estado de Tesorería y Requisitos Administrativos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div
          className={`rounded-xl border p-3.5 ${
            data.pagoTesoreria.estado === "VERIFICADO"
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-amber-200 bg-amber-50/70"
          }`}
        >
          <span className="block font-bold uppercase tracking-wider text-slate-500 text-[11px]">
            Pago TUPA en Tesorería (S/ 100.00)
          </span>
          <p className="mt-1 font-bold text-slate-900">
            {data.pagoTesoreria.estado === "VERIFICADO"
              ? `VERIFICADO (S/ ${data.pagoTesoreria.importe ?? "100.00"})`
              : data.pagoTesoreria.estado === "PENDIENTE_PAGO"
              ? `PENDIENTE DE COBRO (${data.pagoTesoreria.ordenCodigo})`
              : "SIN ORDEN DE PAGO"}
          </p>
          {data.pagoTesoreria.numeroRecibo && (
            <p className="mt-0.5 text-emerald-800 font-mono">Recibo Caja N° {data.pagoTesoreria.numeroRecibo}</p>
          )}
        </div>

        <div
          className={`rounded-xl border p-3.5 ${
            data.checklistObligatorioCompleto && data.observacionesPendientes === 0
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <span className="block font-bold uppercase tracking-wider text-slate-500 text-[11px]">
            Calificación TUPA (FUT + Pago)
          </span>
          <p className="mt-1 font-bold text-slate-900">
            {data.checklistObligatorioCompleto
              ? "Requisitos obligatorios cumplidos"
              : "Calificación administrativa pendiente"}
          </p>
          {data.observacionesPendientes > 0 && (
            <p className="mt-0.5 text-amber-800">{data.observacionesPendientes} observación(es) pendiente(s)</p>
          )}
        </div>

        <div
          className={`rounded-xl border p-3.5 ${
            verifFavorable
              ? "border-emerald-200 bg-emerald-50/70"
              : verif?.resultado === "OBSERVADO" || verif?.resultado === "IMPROCEDENTE"
              ? "border-red-200 bg-red-50/70"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <span className="block font-bold uppercase tracking-wider text-slate-500 text-[11px]">
            Verificación Académica (SEC)
          </span>
          <p className="mt-1 font-bold text-slate-900">
            {verif ? `Dictamen: ${verif.resultado}` : "Pendiente de verificación académica"}
          </p>
          {verif?.numeroActaReferencia && (
            <p className="mt-0.5 font-mono text-slate-700">Acta: {verif.numeroActaReferencia}</p>
          )}
        </div>
      </div>

      {/* 2. Antecedentes Académicos Institucionales (IESTP Suiza) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            Antecedentes de Estudios de Inglés en el IESTP &ldquo;Suiza&rdquo;
          </h3>
          <span className="text-xs font-mono text-slate-600">
            Titular: {data.expediente.solicitanteNombre} · Doc: {data.expediente.solicitanteDocumento || "—"}
          </span>
        </div>

        {data.registrosAcademicosDisponibles.length === 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            No se encontraron registros académicos de estudios de inglés culminados y aprobados en el IESTP Suiza asociados a este titular. Corresponde formular observación o declarar improcedente según corresponda.
          </div>
        ) : (
          <div className="space-y-3">
            {data.registrosAcademicosDisponibles.map((reg) => {
              const seleccionado =
                (registroSeleccionadoId || registroAptoDefault?.registroEstudioId || data.registrosAcademicosDisponibles[0]?.registroEstudioId) ===
                reg.registroEstudioId;
              const esApto = reg.estadoAcademico === "CULMINADO_APROBADO" && reg.culminado && reg.aprobado;

              return (
                <div
                  key={reg.registroEstudioId}
                  className={`rounded-lg border p-3.5 bg-white ${
                    seleccionado ? "border-indigo-400 ring-1 ring-indigo-300" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      {puedeVerificarSec && !certBloqueadoParaCambio && (
                        <input
                          type="radio"
                          name="registro-estudio-ingles"
                          checked={seleccionado}
                          onChange={() => setRegistroSeleccionadoId(reg.registroEstudioId)}
                          aria-label={`Seleccionar acta ${reg.numeroActaFinal ?? reg.registroEstudioId}`}
                          className="mt-1 accent-indigo-600"
                        />
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {reg.nivelAlcanzado} · {reg.programaEstudios}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Matrícula: <span className="font-mono">{reg.codigoMatricula || "—"}</span> · Acta:{" "}
                          <span className="font-mono font-semibold">{reg.numeroActaFinal || "—"}</span> · Periodo:{" "}
                          {reg.fechaInicio} a {reg.fechaTermino || "En curso"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-700">{reg.horasAcademicasTotales} h</span>
                      <span className="font-semibold text-slate-700">Prom: {reg.promedioFinal.toFixed(2)}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          esApto
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {reg.estadoAcademico}
                      </span>
                    </div>
                  </div>

                  {reg.ciclosModulosAprobados.length > 0 && (
                    <div className="mt-3 overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-[11px]">
                        <thead className="bg-slate-50 text-slate-600 font-semibold">
                          <tr>
                            <th className="px-2.5 py-1.5 text-left">Módulo / Nivel</th>
                            <th className="px-2.5 py-1.5 text-left">Periodo</th>
                            <th className="px-2.5 py-1.5 text-right">Horas</th>
                            <th className="px-2.5 py-1.5 text-right">Nota</th>
                            <th className="px-2.5 py-1.5 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {reg.ciclosModulosAprobados.map((m, idx) => (
                            <tr key={`${reg.registroEstudioId}-${idx}`}>
                              <td className="px-2.5 py-1.5 font-medium text-slate-800">{m.modulo}</td>
                              <td className="px-2.5 py-1.5 text-slate-600">{m.periodo}</td>
                              <td className="px-2.5 py-1.5 text-right text-slate-700">{m.horas}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-slate-800">
                                {Number(m.nota).toFixed(2)}
                              </td>
                              <td className="px-2.5 py-1.5 text-center">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    m.estado === "APROBADO"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-amber-50 text-amber-800"
                                  }`}
                                >
                                  {m.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Verificación Académica Registrada o Formulario de Secretaría Académica */}
      {verif && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-900">Verificación Académica Persistida</span>
            <span className="text-slate-500">
              Por {verif.verificadorNombre || "Secretaría Académica"} · {new Date(verif.verificadoEn).toLocaleString("es-PE")}
            </span>
          </div>
          <p className="text-slate-700">{verif.observacionesAcademicas}</p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className={`px-2 py-0.5 rounded font-semibold ${verif.culminadoVerificado ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              {verif.culminadoVerificado ? "✓ Estudios culminados" : "✗ No culminado"}
            </span>
            <span className={`px-2 py-0.5 rounded font-semibold ${verif.aprobadoVerificado ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              {verif.aprobadoVerificado ? "✓ Estudios aprobados" : "✗ No aprobado"}
            </span>
            <span className={`px-2 py-0.5 rounded font-semibold ${verif.pagoTesoreriaVerificado ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              {verif.pagoTesoreriaVerificado ? "✓ Pago Tesorería verificado" : "✗ Pago pendiente"}
            </span>
          </div>
        </div>
      )}

      {puedeVerificarSec && !certBloqueadoParaCambio && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
            Registro de Verificación Académica — Secretaría Académica (SEC)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <label className="block font-semibold text-slate-700">
              Resultado de verificación
              <select
                value={resultadoVerificacion}
                onChange={(e) => setResultadoVerificacion(e.target.value as "FAVORABLE" | "OBSERVADO" | "IMPROCEDENTE")}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="FAVORABLE">FAVORABLE — Estudios culminados y aprobados</option>
                <option value="OBSERVADO">OBSERVADO — Requiere subsanación / aclaración</option>
                <option value="IMPROCEDENTE">IMPROCEDENTE — No acredita estudios en IESTP Suiza</option>
              </select>
            </label>

            <label className="md:col-span-2 block font-semibold text-slate-700">
              Informe / Observaciones de Secretaría Académica (mín. 10 caracteres)
              <input
                type="text"
                value={observacionesAcademicas}
                onChange={(e) => setObservacionesAcademicas(e.target.value)}
                placeholder="Ej. Verificado el historial en Actas de Idiomas IESTP Suiza: 360 horas aprobadas con promedio 17.50."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={verificarMutation.isPending || observacionesAcademicas.trim().length < 10}
              onClick={() => verificarMutation.mutate()}
              className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-800 disabled:opacity-50 cursor-pointer transition"
            >
              {verificarMutation.isPending ? "Registrando verificación..." : "Confirmar Verificación Académica"}
            </button>

            {verifFavorable && (
              <button
                type="button"
                disabled={proyectarMutation.isPending}
                onClick={() => proyectarMutation.mutate()}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50 cursor-pointer transition"
              >
                {proyectarMutation.isPending
                  ? "Generando PDF A4..."
                  : cert
                  ? "Actualizar Borrador de Certificado (PDF A4)"
                  : "Proyectar Certificado de Inglés (PDF A4)"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Certificado Proyectado / Elevación a DG / Firma Digital */}
      {cert && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {cert.numeroCertificado ? "Certificado Oficial de Inglés Emitido" : "Borrador de Certificado de Inglés"}
              </p>
              <p className="text-sm font-mono font-bold text-blue-900 mt-0.5">
                {cert.numeroCertificado || cert.numeroBorrador}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {cert.documentoAdjuntoId && (
                <button
                  type="button"
                  onClick={() =>
                    void descargarDocumentoPdf(
                      cert.documentoAdjuntoId!,
                      `${cert.numeroCertificado || cert.numeroBorrador}.pdf`
                    )
                  }
                  className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50 cursor-pointer transition"
                >
                  Descargar PDF
                </button>
              )}

              {puedeVerificarSec && cert.estado === "BORRADOR_PENDIENTE_FIRMA" && onAbrirDerivacion && (
                <button
                  type="button"
                  onClick={onAbrirDerivacion}
                  className="rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-800 cursor-pointer transition"
                >
                  Derivar a Dirección General (DG) →
                </button>
              )}

              {esDirectorAutorizado &&
                areaEsDg &&
                estadoEnRevision &&
                cert.estado === "BORRADOR_PENDIENTE_FIRMA" && (
                  <button
                    type="button"
                    disabled={elevando}
                    onClick={async () => {
                      setElevando(true);
                      try {
                        await onElevarAFirma(
                          `Aprobación directoral del Certificado de Inglés ${cert.numeroBorrador} para suscripción digital ReFirma`
                        );
                        void queryClient.invalidateQueries({ queryKey: ["certificado-ingles", expediente.idExpediente] });
                      } finally {
                        setElevando(false);
                      }
                    }}
                    className="rounded-lg bg-indigo-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50 cursor-pointer transition"
                  >
                    {elevando ? "Elevando a firma..." : "Aprobar y Elevar a Firma Digital (DG)"}
                  </button>
                )}

              {esDirectorAutorizado && cert.estado === "EN_FIRMA" && (
                <Link
                  to="/flujo-validez-legal/firma"
                  className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
                >
                  Firmar Digitalmente en ReFirma →
                </Link>
              )}

              {(cert.estado === "EMITIDO_FIRMADO" || cert.estado === "NOTIFICADO") && cert.cvd && (
                <Link
                  to="/validador-cvd"
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  Validar CVD Público →
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <span className="text-slate-400 block">Nivel Acreditado</span>
              <span className="font-semibold text-slate-800">{cert.nivelEstudios}</span>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <span className="text-slate-400 block">Carga Horaria / Promedio</span>
              <span className="font-semibold text-slate-800">
                {cert.horasAcademicas} h · Nota {cert.promedioFinal.toFixed(2)}
              </span>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <span className="text-slate-400 block">Acta Académica</span>
              <span className="font-mono font-semibold text-slate-800">{cert.numeroActa}</span>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <span className="text-slate-400 block">Estado del Certificado</span>
              <span className="font-bold text-slate-800">{cert.estado}</span>
            </div>
          </div>

          {(cert.estado === "EMITIDO_FIRMADO" || cert.estado === "NOTIFICADO") && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-emerald-900">
                  Suscrito con Firma Digital PAdES — {cert.firmanteNombre || "Dirección General"}
                </span>
                {cert.cvd && (
                  <span className="font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                    CVD: {cert.cvd}
                  </span>
                )}
              </div>
              {cert.hashPades && (
                <p className="font-mono text-[11px] text-slate-700 break-all">
                  SHA-256 (PAdES): {cert.hashPades}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
