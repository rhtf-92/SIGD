import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import FileUploadDropzone from "../../components/common/FileUploadDropzone";
import HorarioCorteNotice from "../../components/tramite/HorarioCorteNotice";
import {
  calculateHorarioCorte,
  useHorarioCorte,
} from "../../hooks/useHorarioCorte";
import type {
  UploadedFile,
  UploadStatus,
} from "../../hooks/usePresignedUpload";

const FERIADOS_CONFIGURADOS: string[] = [];

function formatStatus(status: UploadStatus): string {
  const labels: Record<UploadStatus, string> = {
    idle: "Pendiente de archivo",
    validating: "Validando archivo",
    hashing: "Calculando SHA-256 local",
    "requesting-url": "Solicitando URL prefirmada",
    uploading: "Subiendo a almacenamiento",
    success: "Carga validada y completada",
    cancelled: "Carga cancelada",
    error: "Error de carga",
  };

  return labels[status];
}

export default function MesaPartesVirtualPage() {
  const [simulationTime, setSimulationTime] = useState("");
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [asunto, setAsunto] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const liveHorario = useHorarioCorte(new Date(), FERIADOS_CONFIGURADOS);
  const horario = useMemo(
    () =>
      simulationTime
        ? calculateHorarioCorte(
            new Date(simulationTime),
            FERIADOS_CONFIGURADOS,
          )
        : liveHorario,
    [simulationTime, liveHorario],
  );

  const handleUploadStatus = useCallback((status: UploadStatus) => {
    setUploadStatus(status);
    if (status !== "success") {
      setUploaded(null);
    }
  }, []);

  return (
    <main className="min-h-screen px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Executive Header Banner */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-[#0A192F] p-7 text-white shadow-xl shadow-slate-950/20 border border-slate-800">
          <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-500/20 border border-blue-400/30 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-300">
                  SIGD · Módulo 2
                </span>
                <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-0.5 text-xs font-bold text-amber-200">
                  API Presigned S3
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Mesa de Partes Virtual
              </h1>
              <p className="mt-2 max-w-3xl text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                Recepción y radicación digital con verificación de integridad Magic Bytes (%PDF), hash criptográfico local SHA-256 y control normativo de horario LPAG (Ley 27444).
              </p>
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white shadow-sm backdrop-blur-md transition-all hover:bg-white/20 hover:border-white/30"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al inicio</span>
            </Link>
          </div>
        </header>

        {/* Security & Protocol notice */}
        <section className="flex items-start gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/70 p-4 text-xs font-medium text-blue-900 shadow-sm backdrop-blur-sm">
          <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Arquitectura de Cero Confianza:</strong> Los Magic Bytes y el hash SHA-256 se calculan directamente en su navegador antes de la transmisión. La carga solicita una URL firmada (<code className="font-mono bg-blue-100/70 px-1 py-0.5 rounded text-blue-800">POST /v1/storage/presigned-url</code>) y transfiere el documento de forma cifrada al bucket de almacenamiento.
          </p>
        </section>

        {/* Step 1: Form Information */}
        <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">
                Paso 01 · Datos del trámite
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                Identificación de la solicitud
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 p-2 text-slate-500">
              <FileText className="h-4 w-4" />
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="solicitante-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Solicitante / Administrado
              </label>
              <input
                id="solicitante-input"
                value={solicitante}
                onChange={(event) => setSolicitante(event.target.value)}
                placeholder="Nombre completo o razón social del administrado"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>
            <div>
              <label htmlFor="asunto-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Asunto del Trámite
              </label>
              <input
                id="asunto-input"
                value={asunto}
                onChange={(event) => setAsunto(event.target.value)}
                placeholder="Descripción breve del trámite o petición formal"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        </section>

        {/* 2-column layout: Upload & LPAG Timing */}
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Step 2: Upload dropzone */}
          <section className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">
                    Paso 02 · Carga documentaria
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                    Magic Bytes, SHA-256 y MinIO/S3
                  </h2>
                </div>
                <span className="rounded-full bg-blue-50 p-2 text-blue-600">
                  <UploadCloud className="h-4 w-4" />
                </span>
              </div>

              <FileUploadDropzone
                categoria="EXPEDIENTE_INGRESO"
                onUploaded={setUploaded}
                onStatusChange={handleUploadStatus}
              />
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 pt-4 border-t border-slate-100">
              <EvidenceItem
                label="Firma binaria %PDF"
                complete={uploadStatus === "success"}
              />
              <EvidenceItem
                label="SHA-256 local"
                complete={Boolean(uploaded?.sha256)}
              />
              <EvidenceItem
                label="URL PUT prefirmada"
                complete={Boolean(uploaded?.s3Key)}
              />
              <EvidenceItem
                label="AbortController activo"
                complete
              />
            </div>
          </section>

          {/* Step 3: LPAG Court Control */}
          <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">
                  Paso 03 · Control de horario LPAG
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  Cómputo Legal (Art. 33)
                </h2>
              </div>
              <span className="rounded-full bg-amber-50 p-2 text-amber-600">
                <Clock className="h-4 w-4" />
              </span>
            </div>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Simular fecha y hora de recepción
              <div className="relative mt-1.5 flex items-center">
                <Calendar className="absolute left-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="datetime-local"
                  value={simulationTime}
                  onChange={(event) => setSimulationTime(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-xs font-medium text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>
            </label>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>Huso oficial: <strong>America/Lima</strong></span>
              <span>Corte LPAG: <strong className="text-blue-700">16:30 hrs</strong></span>
            </div>

            {simulationTime && (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={() => setSimulationTime("")}
              >
                Restablecer a hora actual
              </button>
            )}

            <div className="mt-4">
              <HorarioCorteNotice horario={horario} />
            </div>

            <dl className="mt-4 space-y-2 text-xs">
              <SummaryRow
                label="Condición del trámite"
                value={
                  horario.requiresProjection
                    ? "Posterior al corte o día inhábil: proyectado al siguiente día hábil"
                    : "Dentro del horario legal: ingresado el mismo día hábil"
                }
              />
              <SummaryRow label="Fecha legal de cómputo" value={horario.legalDate} />
              <SummaryRow
                label="Hora legal registrada"
                value={horario.legalTimestamp.slice(11)}
              />
            </dl>
          </section>
        </div>

        {/* Step 4: Results and Evidence */}
        <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">
                Paso 04 · Resultado de radicación
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                Trazabilidad y Evidencia Criptográfica
              </h2>
            </div>
            <span className="rounded-full bg-emerald-50 p-2 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <SummaryRow label="Estado del Archivo" value={formatStatus(uploadStatus)} />
            <SummaryRow
              label="Resultado del Proceso"
              value={uploaded ? "Documento validado y cargado" : "Pendiente de archivo"}
            />
            <SummaryRow
              label="Timestamp Técnico"
              value={horario.technicalTimestamp}
            />
            <SummaryRow
              label="Timestamp Legal LPAG"
              value={horario.legalTimestamp}
            />
            <SummaryRow label="Solicitante" value={solicitante || "No ingresado"} />
            <SummaryRow label="Asunto" value={asunto || "No ingresado"} />
          </div>

          {uploaded && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-medium text-emerald-900 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>Documento verificado y archivado exitosamente</span>
              </div>
              <p className="leading-relaxed">
                El archivo <strong>{uploaded.file.name}</strong> superó la validación binaria (%PDF), generó un hash SHA-256 de integridad local y se transmitió a la clave de almacenamiento seguro <code>{uploaded.s3Key}</code>.
              </p>
            </div>
          )}
        </section>

        {/* Information badge */}
        <footer className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 text-xs text-slate-500 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span>
              <strong>Validación Normativa:</strong> Control riguroso de acuerdo a los estándares del Modelo de Gestión Documental (MGD) y la Ley de Procedimiento Administrativo General (LPAG Ley N° 27444).
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}

function EvidenceItem({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
      complete 
        ? "border-emerald-200 bg-emerald-50/70 text-emerald-800" 
        : "border-slate-200 bg-slate-50/80 text-slate-500"
    }`}>
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          complete ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"
        }`}
      >
        {complete ? "✓" : "○"}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-xs font-semibold text-slate-800">{value}</dd>
    </div>
  );
}
