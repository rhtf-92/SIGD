import { useMemo } from "react";
import { Link } from "react-router-dom";

import AcademicWorkflowStepper from "../../components/flujos/AcademicWorkflowStepper";
import StageDetailCard from "../../components/flujos/StageDetailCard";
import { useWorkflowAcademico } from "../../hooks/useWorkflowAcademico";
import type { EstadoTramite } from "../../types/workflowAcademico";
import { ETIQUETA_ESTADO_TRAMITE } from "../../types/workflowAcademico";

const ESTILOS_INSIGNIA_TRAMITE: Record<EstadoTramite, string> = {
  BORRADOR: "border-slate-200 bg-slate-100 text-slate-600",
  REGISTRADO: "border-blue-200 bg-blue-50 text-blue-700",
  EN_TRAMITE: "border-indigo-200 bg-indigo-50 text-indigo-700",
  EN_REVISION: "border-purple-200 bg-purple-50 text-purple-700",
  OBSERVADO: "border-amber-200 bg-amber-50 text-amber-700",
  SUBSANADO: "border-cyan-200 bg-cyan-50 text-cyan-700",
  APROBADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PARA_FIRMA: "border-rose-200 bg-rose-50 text-rose-700",
  RESUELTO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ANULADO: "border-red-200 bg-red-50 text-red-700",
};

const OBSERVACION_DEFAULT =
  "Omisión formal: remitir constancia de no adeudo vigente y voucher de pago actualizado. Plazo de subsanación: 10 días hábiles (Art. 136 LPAG).";

function formatoFecha(fecha: string): string {
  const fechaLocal = new Date(fecha);
  if (Number.isNaN(fechaLocal.getTime())) return fecha;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(fechaLocal);
}

export default function WorkflowAcademicoPage() {
  const {
    workflow,
    etapas,
    estado,
    errorFsm,
    puedeTomar,
    puedeAprobar,
    puedeObservar,
    puedeSubsanar,
    puedeReanudar,
    puedeFirmar,
    puedeAnular,
    tomarEnRevision,
    aprobarEtapaActual,
    observarEtapaActual,
    subsanar,
    reanudarRevision,
    firmarDocumento,
    anularTramite,
  } = useWorkflowAcademico();

  const semaforoClase = useMemo(() => {
    if (estado === "RESUELTO" || estado === "ANULADO") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    const inicio = new Date(workflow.fechaRegistro).getTime();
    const limite = new Date(workflow.fechaLimiteSla).getTime();
    if (inicio >= limite) {
      return "border-red-200 bg-red-50 text-red-700";
    }
    const consumo = ((Date.now() - inicio) / (limite - inicio)) * 100;
    if (consumo < 60) {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (consumo <= 85) {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-red-200 bg-red-50 text-red-700";
  }, [workflow.fechaRegistro, workflow.fechaLimiteSla, estado]);

  const semaforoTexto = useMemo(() => {
    if (estado === "RESUELTO") return "Culminado";
    if (estado === "ANULADO") return "Anulado";
    const inicio = new Date(workflow.fechaRegistro).getTime();
    const limite = new Date(workflow.fechaLimiteSla).getTime();
    if (inicio >= limite) return "Vencido / riesgo de silencio";
    const consumo = ((Date.now() - inicio) / (limite - inicio)) * 100;
    if (consumo < 60) return "En plazo (SLA < 60%)";
    if (consumo <= 85) return "Próximo a vencer (60%–85%)";
    return "Vencido / riesgo (SLA > 85%)";
  }, [workflow.fechaRegistro, workflow.fechaLimiteSla, estado]);

  const acciones = [
    {
      etiqueta: "Tomar en revisión",
      habilitada: puedeTomar,
      onClick: tomarEnRevision,
      clases: "bg-blue-700 hover:bg-blue-800 text-white",
    },
    {
      etiqueta: "Aprobar etapa",
      habilitada: puedeAprobar,
      onClick: aprobarEtapaActual,
      clases: "bg-blue-700 hover:bg-blue-800 text-white",
    },
    {
      etiqueta: "Observar",
      habilitada: puedeObservar,
      onClick: () => observarEtapaActual(OBSERVACION_DEFAULT),
      clases: "bg-amber-500 hover:bg-amber-600 text-white",
    },
    {
      etiqueta: "Registrar subsanación",
      habilitada: puedeSubsanar,
      onClick: subsanar,
      clases: "bg-blue-700 hover:bg-blue-800 text-white",
    },
    {
      etiqueta: "Reanudar revisión",
      habilitada: puedeReanudar,
      onClick: reanudarRevision,
      clases: "bg-blue-700 hover:bg-blue-800 text-white",
    },
    {
      etiqueta: "Firmar documento (PAdES-BES)",
      habilitada: puedeFirmar,
      onClick: firmarDocumento,
      clases: "bg-emerald-700 hover:bg-emerald-800 text-white",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <Link
            to="/flujo-validez-legal"
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Volver al módulo
          </Link>
          <p className="text-sm font-bold text-blue-700">
            ENT-M04-01 · Adriano David Espinoza Ramírez
          </p>
          <h1 className="text-2xl font-bold">
            Visualizador de Workflows Académicos de 5 Etapas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Máquina de Estados Finitos (FSM) de 10 estados · Procedimiento
            PROC-ACA-01 de Titulación Profesional Técnica.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Expediente
            </p>
            <p className="mt-1 text-lg font-bold">{workflow.cut}</p>
            <p className="text-xs text-slate-500">{workflow.nombreTramite}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Solicitante
            </p>
            <p className="mt-1 text-lg font-bold">
              {workflow.solicitante.nombres} {workflow.solicitante.apellidos}
            </p>
            <p className="text-xs text-slate-500">
              DNI {workflow.solicitante.numeroDocumento} · {workflow.programa}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Estado del trámite
            </p>
            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${ESTILOS_INSIGNIA_TRAMITE[estado]}`}
            >
              {ETIQUETA_ESTADO_TRAMITE[estado]}
            </span>
            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${semaforoClase}`}
            >
              {semaforoTexto}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Plazo legal (LPAG)
            </p>
            <p className="mt-1 text-sm font-bold">Límite: {formatoFecha(workflow.fechaLimiteSla)}</p>
            <p className="text-xs text-slate-500">
              {workflow.slaDiasTotales} días hábiles · 08:00–17:00 America/Lima
            </p>
          </div>
        </div>

        {workflow.certificado && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-bold">
              Documento resuelto con validez legal
            </p>
            <p className="mt-1">
              CVD: {workflow.certificado.cvd} · HASH SHA-256:{" "}
              <code className="break-all">{workflow.certificado.hashSha256}</code>
            </p>
            <Link
              to="/validador-cvd"
              className="mt-2 inline-block text-sm font-bold underline"
            >
              Verificar públicamente en el Portal Validador →
            </Link>
          </div>
        )}

        <div className="mb-6">
          <AcademicWorkflowStepper etapas={etapas} estadoTramite={estado} />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mr-auto text-lg font-bold">Acciones de la FSM</h2>

          {acciones.map((accion) => (
            <button
              key={accion.etiqueta}
              type="button"
              onClick={accion.onClick}
              disabled={!accion.habilitada}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${accion.clases} ${accion.habilitada ? "" : "cursor-not-allowed opacity-40"}`}
            >
              {accion.etiqueta}
            </button>
          ))}

          <button
            type="button"
            onClick={anularTramite}
            disabled={!puedeAnular}
            className={`rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none ${puedeAnular ? "" : "cursor-not-allowed opacity-40"}`}
          >
            Anular trámite
          </button>
        </div>

        {errorFsm && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorFsm}
          </div>
        )}

        <h2 className="mb-3 text-lg font-bold">Detalle por etapa</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {etapas.map((etapa, indice) => (
            <StageDetailCard
              key={etapa.idEtapa}
              etapa={etapa}
              indice={indice}
              esActual={etapa.idEtapa === workflow.etapaActualId}
            />
          ))}
        </div>

        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
          Transiciones permitidas por la FSM:{" "}
          <code className="text-slate-700">
            REGISTRADO → EN_TRAMITE → EN_REVISION → (OBSERVADO ⇄ SUBSANADO) →
            APROBADO → PARA_FIRMA → RESUELTO
          </code>
          . Si se observa una inconformidad en cualquier etapa, el trámite se
          transfiere a OBSERVADO con plazo perentorio de subsanación (Art. 136
          del TUO de la Ley N° 27444).
        </p>
      </section>
    </main>
  );
}