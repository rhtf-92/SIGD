import { useCallback, useMemo, useState } from "react";

import { Link } from "react-router-dom";
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

const tarjetaGlass =
  "rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7";

const etiquetaPaso =
  "inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-black tracking-widest text-cyan-300 uppercase";

const campoEntrada =
  "mt-1.5 w-full rounded-xl border border-white/40 bg-white/95 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40";

const etiquetaCampo =
  "block text-sm font-semibold text-blue-100";

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
    <main className="relative min-h-screen overflow-hidden bg-[#070b19] px-4 py-8 text-white sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl space-y-6">
        <header className={tarjetaGlass}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-black tracking-[0.2em] text-cyan-300 uppercase">
                SIGD · Demostración Módulo 2
              </span>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Mesa de Partes Virtual — SIGD
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/85 sm:text-base">
                Pantalla única para demostrar carga documentaria segura y
                control de horario legal LPAG.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              >
                ← Volver al inicio
              </Link>
              <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-2 text-xs font-semibold text-amber-200">
                API DE PRESIGNED URL REQUERIDA
              </span>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-blue-400/30 bg-blue-400/10 p-4 text-sm leading-6 text-blue-100 backdrop-blur">
          Magic Bytes y SHA-256 se calculan en el navegador. La carga solicita
          POST /v1/storage/presigned-url al backend y transfiere el PDF
          directamente a la URL firmada devuelta por el servicio.
        </section>

        <section className={tarjetaGlass}>
          <div className="mb-5">
            <p className={etiquetaPaso}>1 · Datos del trámite</p>
            <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">
              Identificación de la solicitud
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={etiquetaCampo}>
              Solicitante
              <input
                value={solicitante}
                onChange={(event) => setSolicitante(event.target.value)}
                placeholder="Nombre del administrado"
                className={campoEntrada}
              />
            </label>
            <label className={etiquetaCampo}>
              Asunto
              <input
                value={asunto}
                onChange={(event) => setAsunto(event.target.value)}
                placeholder="Descripción breve del trámite"
                className={campoEntrada}
              />
            </label>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className={tarjetaGlass}>
            <div className="mb-5">
              <p className={etiquetaPaso}>2 · Carga documentaria</p>
              <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">
                Magic Bytes, SHA-256 y MinIO/S3
              </h2>
            </div>
            <div className="rounded-2xl border border-white/25 bg-white/95 p-4 text-slate-900 shadow-inner">
              <FileUploadDropzone
                categoria="EXPEDIENTE_INGRESO"
                onUploaded={setUploaded}
                onStatusChange={handleUploadStatus}
              />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
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
              <EvidenceItem label="AbortController disponible" complete />
            </div>
          </section>

          <section className={tarjetaGlass}>
            <div className="mb-5">
              <p className={etiquetaPaso}>3 · Control de horario LPAG</p>
              <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">
                Recepción legal
              </h2>
            </div>
            <label className={etiquetaCampo}>
              <span className="block">Fecha y hora de simulación</span>
              <input
                type="datetime-local"
                value={simulationTime}
                onChange={(event) => setSimulationTime(event.target.value)}
                className={campoEntrada}
              />
            </label>
            <p className="mt-2 text-xs text-blue-200/80">
              Zona horaria oficial: <strong>America/Lima</strong> · Corte:
              <strong> 16:30</strong>
            </p>
            {simulationTime && (
              <button
                type="button"
                className="mt-3 rounded-xl border border-white/30 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                onClick={() => setSimulationTime("")}
              >
                Usar hora actual
              </button>
            )}
            <div className="mt-4">
              <HorarioCorteNotice horario={horario} />
            </div>
            <dl className="mt-4 grid gap-2">
              <SummaryRow
                label="Condición"
                value={
                  horario.requiresProjection
                    ? "Corte o día inhábil: proyectar"
                    : "Dentro del horario: mismo día"
                }
              />
              <SummaryRow label="Siguiente día hábil" value={horario.legalDate} />
              <SummaryRow
                label="Hora legal"
                value={horario.legalTimestamp.slice(11)}
              />
            </dl>
          </section>
        </div>

        <section className={tarjetaGlass}>
          <div className="mb-5">
            <p className={etiquetaPaso}>4 · Resultado de radicación</p>
            <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">
              Evidencia de la demostración
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryRow label="Estado de carga" value={formatStatus(uploadStatus)} />
            <SummaryRow
              label="Resultado"
              value={uploaded ? "Documento validado y cargado (demo)" : "Pendiente"}
            />
            <SummaryRow
              label="Timestamp técnico"
              value={horario.technicalTimestamp}
            />
            <SummaryRow
              label="Timestamp legal"
              value={horario.legalTimestamp}
            />
            <SummaryRow label="Solicitante" value={solicitante || "No ingresado"} />
            <SummaryRow label="Asunto" value={asunto || "No ingresado"} />
          </div>
          {uploaded && (
            <div className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-400/15 p-4 text-sm text-emerald-100">
              <strong>Documento cargado:</strong> el archivo{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">
                {uploaded.file.name}
              </code>{" "}
              pasó Magic Bytes, generó SHA-256 y obtuvo una clave del
              almacenamiento{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">
                {uploaded.s3Key}
              </code>
              .
            </div>
          )}
        </section>

        <footer className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-6 text-blue-100/75 backdrop-blur">
          <strong>Evidencia / estado de pruebas:</strong> suite M2 disponible
          en <code className="rounded bg-white/10 px-1.5 py-0.5">tests/unit</code>{" "}
          y{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5">
            tests/integration/m2
          </code>
          . Ejecuta{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5">npm test</code>{" "}
          para verificar Magic Bytes, SHA-256, cancelación y casos 16:29, 16:30,
          posterior y día inhábil.
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
    <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-blue-100">
      <span
        aria-hidden="true"
        className={complete ? "text-emerald-300" : "text-blue-200/60"}
      >
        {complete ? "✓" : "○"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-3.5">
      <dt className="text-[11px] font-bold tracking-wider text-blue-200/80 uppercase">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-white">
        {value}
      </dd>
    </div>
  );
}
