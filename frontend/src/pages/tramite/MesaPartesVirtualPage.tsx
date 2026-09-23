import { useCallback, useMemo, useState } from "react";

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
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
                SIGD · Demostración Módulo 2
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                Mesa de Partes Virtual — SIGD
              </h1>
              <p className="mt-2 max-w-3xl text-slate-300">
                Pantalla única para demostrar carga documentaria segura y
                control de horario legal LPAG.
              </p>
            </div>
            <span className="rounded-full border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200">
              DEMO CONTROLADA · BACKEND NO DISPONIBLE
            </span>
          </div>
        </header>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          La URL prefirmada y la transferencia MinIO/S3 se simulan localmente
          para la demostración. Las validaciones Magic Bytes, SHA-256,
          cancelación y cálculo horario se ejecutan realmente en el navegador.
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
              1 · Datos del trámite
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              Identificación de la solicitud
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Solicitante
              <input
                value={solicitante}
                onChange={(event) => setSolicitante(event.target.value)}
                placeholder="Nombre del administrado"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium">
              Asunto
              <input
                value={asunto}
                onChange={(event) => setAsunto(event.target.value)}
                placeholder="Descripción breve del trámite"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                2 · Carga documentaria
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                Magic Bytes, SHA-256 y MinIO/S3
              </h2>
            </div>
            <FileUploadDropzone
              categoria="EXPEDIENTE_INGRESO"
              demoMode
              onUploaded={setUploaded}
              onStatusChange={handleUploadStatus}
            />
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
              <EvidenceItem
                label="AbortController disponible"
                complete
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                3 · Control de horario LPAG
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                Recepción legal
              </h2>
            </div>
            <label className="block text-sm font-medium">
              Fecha y hora de simulación
              <input
                type="datetime-local"
                value={simulationTime}
                onChange={(event) => setSimulationTime(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Zona horaria oficial: <strong>America/Lima</strong> · Corte:
              <strong> 16:30</strong>
            </p>
            {simulationTime && (
              <button
                type="button"
                className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setSimulationTime("")}
              >
                Usar hora actual
              </button>
            )}
            <div className="mt-4">
              <HorarioCorteNotice horario={horario} />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
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

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
              4 · Resultado de radicación
            </p>
            <h2 className="mt-1 text-xl font-semibold">
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
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <strong>Demostración completada:</strong> el archivo{" "}
              <code>{uploaded.file.name}</code> pasó Magic Bytes, generó
              SHA-256 y obtuvo una clave simulada{" "}
              <code>{uploaded.s3Key}</code>.
            </div>
          )}
        </section>

        <footer className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <strong>Evidencia / estado de pruebas:</strong> suite M2 disponible
          en <code>src/tests/m2</code>. Ejecuta <code>npm test</code> para
          verificar Magic Bytes, SHA-256, cancelación y casos 16:29, 16:30,
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
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <span
        aria-hidden="true"
        className={complete ? "text-emerald-600" : "text-slate-400"}
      >
        {complete ? "✓" : "○"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-slate-900">{value}</dd>
    </div>
  );
}
