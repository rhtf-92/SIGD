import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import type { ExpedienteDetalleRutaDoc } from "../../types/expediente";

export interface SemestreAcreditado {
  semestre: string;
  periodo: string;
  creditos: number;
  horas: number;
  promedioSemestre: number;
  condicion: "APROBADO" | "DESAPROBADO" | "CONVALIDADO";
}

export interface RegistroEstudiosSuperiores {
  registroEstudioId: string;
  tipoDocumentoIdentidad: string;
  numeroDocumentoIdentidad: string;
  personaId: string | null;
  apellidosNombres: string;
  codigoMatricula: string | null;
  programaEstudios: string;
  planEstudios: string;
  modalidadEstudio: string;
  semestresAprobados: SemestreAcreditado[];
  horasAcademicasTotales: number;
  creditosTotales: number;
  promedioFinal: number;
  notaMinimaAprobatoria: number;
  periodoIngreso: string;
  periodoEgreso: string | null;
  culminado: boolean;
  aprobado: boolean;
  numeroActaFinal: string | null;
  estadoAcademico: "CULMINADO_APROBADO" | "INCOMPLETO" | "DESAPROBADO" | "ANULADO";
  observaciones: string | null;
}

export interface VerificacionAcademicaEstudios {
  verificacionId: string;
  expedienteId: string;
  registroEstudioId: string | null;
  dniVerificado: string;
  semestresVerificados: number;
  culminadoVerificado: boolean;
  aprobadoVerificado: boolean;
  pagoTesoreriaVerificado: boolean;
  numeroReciboTesoreria: string | null;
  numeroActaReferencia: string | null;
  programaEstudios: string | null;
  planEstudios: string | null;
  creditosTotales: number | null;
  horasAcademicas: number | null;
  promedioFinal: number | null;
  detalleSemestresVerificados: SemestreAcreditado[];
  resultado: "FAVORABLE" | "OBSERVADO" | "IMPROCEDENTE";
  observacionesAcademicas: string;
  verificadorNombre: string | null;
  verificadoEn: string;
}

export interface CertificadoEstudiosSuperiores {
  certificadoId: string;
  expedienteId: string;
  verificacionId: string;
  numeroBorrador: string;
  numeroCertificado: string | null;
  titularNombre: string;
  titularDocumento: string;
  programaEstudios: string;
  planEstudios: string;
  semestresAcreditados: SemestreAcreditado[];
  horasAcademicas: number;
  creditosTotales: number;
  promedioFinal: number;
  periodoEstudios: string;
  numeroActa: string;
  asunto: string;
  estado: "BORRADOR_PENDIENTE_FIRMA" | "EN_FIRMA" | "EMITIDO_FIRMADO" | "NOTIFICADO" | "ANULADO";
  documentoAdjuntoId: string | null;
  proyectadoPor: string;
  fechaProyeccion: string;
  firmadoPor: string | null;
  firmanteNombre?: string | null;
  firmadoEn: string | null;
  hashPades: string | null;
  cvd: string | null;
}

export interface EstadoCertificadoEstudiosResponse {
  esCertificadoEstudios: boolean;
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
  registrosAcademicosDisponibles: RegistroEstudiosSuperiores[];
  verificacionAcademica: VerificacionAcademicaEstudios | null;
  certificado: CertificadoEstudiosSuperiores | null;
}

export interface CertificadoEstudiosPanelProps {
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

export function CertificadoEstudiosPanel({
  expediente,
  esSecretarioAcademico,
  esDirectorAutorizado,
  onElevarAFirma,
  onAbrirDerivacion,
}: CertificadoEstudiosPanelProps) {
  const queryClient = useQueryClient();
  const [registroSeleccionadoId, setRegistroSeleccionadoId] = useState<string>("");
  const [resultadoVerificacion, setResultadoVerificacion] = useState<"FAVORABLE" | "OBSERVADO" | "IMPROCEDENTE">("FAVORABLE");
  const [observacionesAcademicas, setObservacionesAcademicas] = useState("");
  const [mensajeLocal, setMensajeLocal] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [elevando, setElevando] = useState(false);

  const { data, isLoading, error } = useQuery<EstadoCertificadoEstudiosResponse>({
    queryKey: ["certificado-estudios", expediente.idExpediente],
    queryFn: async () => {
      const res = await apiClient.get<EstadoCertificadoEstudiosResponse>(
        `/api/v1/certificados-estudios/expediente/${encodeURIComponent(expediente.idExpediente)}`
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
        `/api/v1/certificados-estudios/expediente/${encodeURIComponent(expediente.idExpediente)}/verificar-antecedentes`,
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
        texto: "Verificación de los 6 semestres académicos registrada con trazabilidad WORM.",
      });
      void queryClient.invalidateQueries({ queryKey: ["certificado-estudios", expediente.idExpediente] });
      void queryClient.invalidateQueries({ queryKey: ["expediente", expediente.idExpediente] });
      void queryClient.invalidateQueries({ queryKey: ["trazabilidad", expediente.idExpediente] });
    },
    onError: (err) => {
      setMensajeLocal({
        tipo: "error",
        texto: extraerMensajeError(err, "No fue posible registrar la verificación de antecedentes académicos."),
      });
    },
  });

  const proyectarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(
        `/api/v1/certificados-estudios/expediente/${encodeURIComponent(expediente.idExpediente)}/proyectar`,
        {}
      );
      return res.data;
    },
    onSuccess: () => {
      setMensajeLocal({
        tipo: "exito",
        texto: "Borrador oficial del Certificado de Estudios Superiores (PDF A4) generado, foliado y almacenado.",
      });
      void queryClient.invalidateQueries({ queryKey: ["certificado-estudios", expediente.idExpediente] });
      void queryClient.invalidateQueries({ queryKey: ["expediente", expediente.idExpediente] });
      void queryClient.invalidateQueries({ queryKey: ["trazabilidad", expediente.idExpediente] });
    },
    onError: (err) => {
      setMensajeLocal({
        tipo: "error",
        texto: extraerMensajeError(err, "No se pudo proyectar el Certificado de Estudios Superiores."),
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
      <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Consultando antecedentes académicos de estudios superiores…</p>
      </section>
    );
  }

  if (error || !data || !data.esCertificadoEstudios) {
    return null;
  }

  const areaEsSec = data.expediente.areaActualCodigo === "SEC";
  const areaEsDg = data.expediente.areaActualCodigo === "DG";
  const estadoEnRevision = data.expediente.estadoActual === "EN_REVISION";
  const puedeVerificarSec = esSecretarioAcademico && areaEsSec && estadoEnRevision;
  const cert = data.certificado;
  const certBloqueadoParaCambio = cert && ["EN_FIRMA", "EMITIDO_FIRMADO", "NOTIFICADO"].includes(cert.estado);
  const verif = data.verificacionAcademica;
  const verifFavorable = Boolean(
    verif &&
      verif.resultado === "FAVORABLE" &&
      verif.culminadoVerificado &&
      verif.aprobadoVerificado &&
      verif.semestresVerificados === 6
  );
  const registroAptoDefault = data.registrosAcademicosDisponibles.find((r) => r.estadoAcademico === "CULMINADO_APROBADO");

  return (
    <section
      aria-labelledby="titulo-certificado-estudios"
      className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id="titulo-certificado-estudios" className="text-base font-bold text-slate-900">
              Procedimiento TUPA SUZ26-034 — Certificado de Estudios Superiores (6 semestres)
            </h2>
            {cert?.estado === "EMITIDO_FIRMADO" || cert?.estado === "NOTIFICADO" ? (
              <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                Emitido y Firmado Digitalmente (PAdES)
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
            Acreditación de 6 semestres académicos de formación tecnológica superior cursados en el IESTP &ldquo;Suiza&rdquo;.
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

      {/* 1. Bloque de Validación de Pagos y Requisitos TUPA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div
          className={`rounded-xl border p-3.5 ${
            data.pagoTesoreria.estado === "VERIFICADO"
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-amber-200 bg-amber-50/70"
          }`}
        >
          <span className="block font-bold uppercase tracking-wider text-slate-500 text-[11px]">
            Derecho de Trámite TUPA (S/ 124.00 · 2.24% UIT)
          </span>
          <p className="mt-1 font-bold text-slate-900">
            {data.pagoTesoreria.estado === "VERIFICADO"
              ? `PAGO VERIFICADO (S/ ${data.pagoTesoreria.importe ?? "124.00"})`
              : data.pagoTesoreria.estado === "PENDIENTE_PAGO"
              ? `PENDIENTE DE COBRO (${data.pagoTesoreria.ordenCodigo})`
              : "SIN ORDEN DE PAGO"}
          </p>
          {data.pagoTesoreria.numeroRecibo && (
            <p className="mt-0.5 text-emerald-800 font-mono">Recibo de Caja N° {data.pagoTesoreria.numeroRecibo}</p>
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
            Requisitos TUPA 2026 (FUT + Comprobante)
          </span>
          <p className="mt-1 font-bold text-slate-900">
            {data.checklistObligatorioCompleto
              ? "Requisitos institucionales conformes"
              : "Calificación administrativa en trámite"}
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
            Verificación de 6 Semestres (SEC)
          </span>
          <p className="mt-1 font-bold text-slate-900">
            {verif ? `Dictamen: ${verif.resultado} (${verif.semestresVerificados} semestres)` : "Pendiente de calificación académica"}
          </p>
          {verif?.numeroActaReferencia && (
            <p className="mt-0.5 font-mono text-slate-700">Acta Final: {verif.numeroActaReferencia}</p>
          )}
        </div>
      </div>

      {/* 2. Registros de Antecedentes Académicos en IESTP Suiza */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            Historial de Estudios Superiores en el IESTP &ldquo;Suiza&rdquo; (Archivo y Secretaría Académica)
          </h3>
          <span className="text-xs font-mono text-slate-600">
            Titular: {data.expediente.solicitanteNombre} · DNI: {data.expediente.solicitanteDocumento || "—"}
          </span>
        </div>

        {data.registrosAcademicosDisponibles.length === 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            No se identificaron registros académicos de 6 semestres culminados para este solicitante en la base institucional. Corresponde formular observación de conformidad con el TUO de la LPAG (D.S. 004-2019-JUS).
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
                    seleccionado ? "border-blue-500 ring-1 ring-blue-300" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      {puedeVerificarSec && !certBloqueadoParaCambio && (
                        <input
                          type="radio"
                          name="registro-estudio-superiores"
                          checked={seleccionado}
                          onChange={() => setRegistroSeleccionadoId(reg.registroEstudioId)}
                          aria-label={`Seleccionar historial ${reg.programaEstudios}`}
                          className="mt-1 accent-blue-600"
                        />
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {reg.programaEstudios} ({reg.planEstudios}) · Modalidad {reg.modalidadEstudio}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Matrícula: <span className="font-mono">{reg.codigoMatricula || "—"}</span> · Acta Consolidada:{" "}
                          <span className="font-mono font-semibold">{reg.numeroActaFinal || "—"}</span> · Periodo:{" "}
                          {reg.periodoIngreso} a {reg.periodoEgreso || "En curso"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-700">{reg.creditosTotales.toFixed(2)} Créditos</span>
                      <span className="font-semibold text-slate-700">{reg.horasAcademicasTotales} Horas</span>
                      <span className="font-semibold text-slate-700">Promedio: {reg.promedioFinal.toFixed(2)}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          esApto ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {reg.estadoAcademico}
                      </span>
                    </div>
                  </div>

                  {reg.semestresAprobados.length > 0 && (
                    <div className="mt-3 overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-[11px]">
                        <thead className="bg-slate-50 text-slate-600 font-semibold">
                          <tr>
                            <th className="px-2.5 py-1.5 text-left">Semestre</th>
                            <th className="px-2.5 py-1.5 text-left">Periodo</th>
                            <th className="px-2.5 py-1.5 text-right">Créditos</th>
                            <th className="px-2.5 py-1.5 text-right">Horas</th>
                            <th className="px-2.5 py-1.5 text-right">Promedio Semestral</th>
                            <th className="px-2.5 py-1.5 text-center">Condición</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {reg.semestresAprobados.map((sem, idx) => (
                            <tr key={`${reg.registroEstudioId}-${idx}`}>
                              <td className="px-2.5 py-1.5 font-bold text-slate-800">Semestre {sem.semestre}</td>
                              <td className="px-2.5 py-1.5 text-slate-600">{sem.periodo}</td>
                              <td className="px-2.5 py-1.5 text-right text-slate-700">{Number(sem.creditos).toFixed(1)}</td>
                              <td className="px-2.5 py-1.5 text-right text-slate-700">{sem.horas}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-slate-800">
                                {Number(sem.promedioSemestre).toFixed(2)}
                              </td>
                              <td className="px-2.5 py-1.5 text-center">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    sem.condicion === "APROBADO"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-amber-50 text-amber-800"
                                  }`}
                                >
                                  {sem.condicion}
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

      {/* 3. Dictamen de Verificación Registrado */}
      {verif && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-900">Verificación de Secretaría Académica Registrada</span>
            <span className="text-slate-500">
              Por {verif.verificadorNombre || "Secretaría Académica"} · {new Date(verif.verificadoEn).toLocaleString("es-PE")}
            </span>
          </div>
          <p className="text-slate-700">{verif.observacionesAcademicas}</p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className={`px-2 py-0.5 rounded font-semibold ${verif.semestresVerificados === 6 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              {verif.semestresVerificados === 6 ? "✓ 6 semestres verificados" : `✗ ${verif.semestresVerificados} semestres verificados`}
            </span>
            <span className={`px-2 py-0.5 rounded font-semibold ${verif.culminadoVerificado ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              {verif.culminadoVerificado ? "✓ Plan de estudios culminado" : "✗ Incompleto"}
            </span>
            <span className={`px-2 py-0.5 rounded font-semibold ${verif.aprobadoVerificado ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              {verif.aprobadoVerificado ? "✓ Aprobado (Prom: " + (verif.promedioFinal?.toFixed(2) ?? "—") + ")" : "✗ No aprobado"}
            </span>
            <span className={`px-2 py-0.5 rounded font-semibold ${verif.pagoTesoreriaVerificado ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              {verif.pagoTesoreriaVerificado ? "✓ Pago de S/ 124.00 verificado" : "✗ Pago pendiente"}
            </span>
          </div>
        </div>
      )}

      {/* 4. Formulario de Secretaría Académica (SEC) */}
      {puedeVerificarSec && !certBloqueadoParaCambio && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950">
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
                <option value="FAVORABLE">FAVORABLE — 6 semestres culminados y aprobados</option>
                <option value="OBSERVADO">OBSERVADO — Expediente incompleto / requiere subsanación</option>
                <option value="IMPROCEDENTE">IMPROCEDENTE — No acredita 6 semestres en el IESTP Suiza</option>
              </select>
            </label>

            <label className="md:col-span-2 block font-semibold text-slate-700">
              Informe Técnico de Secretaría Académica (mín. 10 caracteres)
              <input
                type="text"
                value={observacionesAcademicas}
                onChange={(e) => setObservacionesAcademicas(e.target.value)}
                placeholder="Ej. Verificado en Actas Consolidadas IESTP Suiza: 6 semestres aprobados, 130 créditos y promedio 16.85."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={verificarMutation.isPending || observacionesAcademicas.trim().length < 10}
              onClick={() => verificarMutation.mutate()}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50 cursor-pointer transition"
            >
              {verificarMutation.isPending ? "Registrando verificación..." : "Confirmar Verificación Académica (6 Semestres)"}
            </button>

            {verifFavorable && (
              <button
                type="button"
                disabled={proyectarMutation.isPending}
                onClick={() => proyectarMutation.mutate()}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 cursor-pointer transition"
              >
                {proyectarMutation.isPending
                  ? "Generando PDF A4 oficial..."
                  : cert
                  ? "Actualizar Borrador de Certificado (PDF A4)"
                  : "Proyectar Certificado de Estudios Superiores (PDF A4)"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Certificado Proyectado / Elevación a DG / Firma Digital */}
      {cert && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {cert.numeroCertificado ? "Certificado Oficial de Estudios Superiores" : "Borrador de Certificado de Estudios Superiores"}
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
                          `Aprobación directoral del Certificado de Estudios Superiores ${cert.numeroBorrador} para suscripción digital ReFirma`
                        );
                        void queryClient.invalidateQueries({ queryKey: ["certificado-estudios", expediente.idExpediente] });
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
              <span className="text-slate-400 block">Programa de Estudios</span>
              <span className="font-semibold text-slate-800">{cert.programaEstudios}</span>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <span className="text-slate-400 block">Créditos / Horas / Promedio</span>
              <span className="font-semibold text-slate-800">
                {cert.creditosTotales.toFixed(2)} crd · {cert.horasAcademicas} h · Prom {cert.promedioFinal.toFixed(2)}
              </span>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <span className="text-slate-400 block">Acta Consolidada</span>
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
