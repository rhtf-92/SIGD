import React from 'react';

export interface RecorridoTramiteStepperProps {
  estadoActual: string;
  tieneCostoTupa: boolean;
  pagoConfirmado: boolean;
  areaActualNombre?: string | null;
  especialistaAsignado?: string | null;
  esInasistenciaNsp?: boolean;
}

interface PasoWorkflow {
  numero: number;
  titulo: string;
  area: string;
  descripcion: string;
  estadoVisual: 'COMPLETADO' | 'ACTUAL' | 'PENDIENTE' | 'ERROR';
  responsable?: string;
}

export const RecorridoTramiteStepper: React.FC<RecorridoTramiteStepperProps> = ({
  estadoActual,
  tieneCostoTupa,
  pagoConfirmado,
  areaActualNombre,
  especialistaAsignado,
  esInasistenciaNsp = false,
}) => {
  // Determinar en qué etapa del flujo se encuentra el expediente según la máquina de estados FSM
  const estado = estadoActual.toUpperCase();

  const esAtendido =
    !esInasistenciaNsp &&
    (estado === 'RESUELTO' ||
      estado === 'ATENDIDO_NOTIFICADO' ||
      estado === 'FINALIZADO' ||
      estado === 'ARCHIVADO');

  const esFirma =
    estado === 'EN_FIRMA' ||
    estado === 'FIRMADO' ||
    estado === 'APROBADO_CON_RESOLUCION';

  const esEvaluacion =
    estado === 'EVALUACION_PROGRAMADA' ||
    estado === 'EVALUADO' ||
    estado === 'INFORME_EMITIDO' ||
    estado === 'EN_EVALUACION' ||
    (estado === 'EN_REVISION' && Boolean(especialistaAsignado || areaActualNombre?.toLowerCase().includes('idioma')));

  const esSubdireccion =
    estado === 'DERIVADO_SDA' ||
    estado === 'EN_TRAMITE' ||
    estado === 'ASIGNADO_ESPECIALISTA' ||
    (estado === 'EN_REVISION' && !esEvaluacion);

  const esTesoreria = estado === 'PENDIENTE_PAGO';
  const esMesaPartes = estado === 'REGISTRADO' || estado === 'EN_RECEPCION' || estado === 'OBSERVADO';

  // Asignar el número de paso activo (1 al 6) de forma estrictamente secuencial y ordenada
  let pasoActivo = 1;
  if (esInasistenciaNsp) {
    pasoActivo = 4; // Concluido en Paso 4 (Evaluación y Calificación) por Inasistencia NSP
  } else if (esAtendido) {
    pasoActivo = 6;
  } else if (esFirma) {
    pasoActivo = 5;
  } else if (esEvaluacion) {
    pasoActivo = 4;
  } else if (esSubdireccion) {
    pasoActivo = 3;
  } else if (tieneCostoTupa && (!pagoConfirmado || esTesoreria)) {
    pasoActivo = 2; // Bloqueado en Tesorería esperando confirmación de pago
  } else if (pagoConfirmado && esMesaPartes) {
    pasoActivo = 1; // Listo para ser derivado por Mesa de Partes
  }

  const pasos: PasoWorkflow[] = [
    {
      numero: 1,
      titulo: 'Recepción y Admisibilidad',
      area: 'Mesa de Partes',
      descripcion: 'Cotejo de requisitos y asignación de CUT correlativo.',
      estadoVisual: pasoActivo > 1 ? 'COMPLETADO' : pasoActivo === 1 ? 'ACTUAL' : 'PENDIENTE',
      responsable: 'Operador de Mesa de Partes',
    },
    {
      numero: 2,
      titulo: 'Pago de Tasa TUPA',
      area: 'Tesorería y Caja',
      descripcion: tieneCostoTupa
        ? pagoConfirmado
          ? 'Tasa oficial cancelada y confirmada en caja.'
          : 'Pendiente de pago en Tesorería (Efectivo / Yape / QR).'
        : 'Trámite gratuito sin arancel previo.',
      estadoVisual:
        !tieneCostoTupa || pagoConfirmado || pasoActivo > 2
          ? 'COMPLETADO'
          : pasoActivo === 2
            ? 'ACTUAL'
            : 'PENDIENTE',
      responsable: 'Cajero / Tesorería',
    },
    {
      numero: 3,
      titulo: 'Derivación y Control',
      area: 'Subdirección Académica',
      descripcion: 'Revisión académica y asignación al Especialista evaluador.',
      estadoVisual: pasoActivo > 3 ? 'COMPLETADO' : pasoActivo === 3 ? 'ACTUAL' : 'PENDIENTE',
      responsable: 'Secretario / Subdirector Académico',
    },
    {
      numero: 4,
      titulo: 'Evaluación y Calificación',
      area: 'Centro de Idiomas',
      descripcion: esInasistenciaNsp
        ? 'No se presentó a la evaluación (NSP). Memorándum de Inasistencia emitido.'
        : 'Programación de examen, calificación y emisión de informe.',
      estadoVisual: esInasistenciaNsp
        ? 'ERROR'
        : pasoActivo > 4
          ? 'COMPLETADO'
          : pasoActivo === 4
            ? 'ACTUAL'
            : 'PENDIENTE',
      responsable: especialistaAsignado || 'Especialista / Docente Evaluador',
    },
    {
      numero: 5,
      titulo: 'Firma Digital y V/B',
      area: 'Dirección General',
      descripcion: esInasistenciaNsp
        ? 'No aplica: trámite desestimado en evaluación por inasistencia (NSP).'
        : 'Visación y suscripción con Firma Digital oficial.',
      estadoVisual: esInasistenciaNsp
        ? 'PENDIENTE'
        : pasoActivo > 5
          ? 'COMPLETADO'
          : pasoActivo === 5
            ? 'ACTUAL'
            : 'PENDIENTE',
      responsable: 'Director General',
    },
    {
      numero: 6,
      titulo: 'Notificación y Entrega',
      area: 'Atención al Usuario',
      descripcion: esInasistenciaNsp
        ? 'Memorándum de Inasistencia (NSP) remitido al correo electrónico.'
        : 'Emisión final. Descarga de certificado digital.',
      estadoVisual: esInasistenciaNsp
        ? 'ERROR'
        : pasoActivo === 6
          ? 'COMPLETADO'
          : 'PENDIENTE',
      responsable: 'Administrado / Interesado',
    },
  ];

  return (
    <section
      aria-label="Pasos que deben seguir para completar el trámite"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${esInasistenciaNsp ? 'bg-rose-600' : 'bg-blue-600 animate-pulse'}`} />
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Pasos del Procedimiento (Recorrido Institucional)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Etapas oficiales del flujo de atención desde la radicación hasta la firma y entrega final
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
            esInasistenciaNsp
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : esAtendido
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          <span>
            {esInasistenciaNsp
              ? '⚠️ Concluido en Paso 4 · Improcedente por Inasistencia (NSP)'
              : esAtendido
                ? '✓ Paso 6 de 6 · Resuelto y Notificado'
                : `Paso ${pasoActivo} de 6 en curso`}
          </span>
        </div>
      </div>

      {/* Stepper Grid Visual */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {pasos.map((p) => {
          const esActual = p.estadoVisual === 'ACTUAL';
          const esCompletado = p.estadoVisual === 'COMPLETADO';
          const esError = p.estadoVisual === 'ERROR';

          return (
            <div
              key={p.numero}
              className={`rounded-xl border p-3.5 transition-all relative overflow-hidden ${
                esError
                  ? 'border-rose-400 bg-rose-50/70 shadow-xs ring-1 ring-rose-500/20'
                  : esActual
                    ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-500/30'
                    : esCompletado
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-slate-200 bg-slate-50/40 opacity-75'
              }`}
            >
              {esActual && (
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">
                  Etapa Actual
                </div>
              )}
              {esError && (
                <div className="absolute top-0 right-0 bg-rose-700 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">
                  Inasistencia (NSP)
                </div>
              )}

              <div className="flex items-start gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                    esError
                      ? 'bg-rose-700 text-white shadow-2xs'
                      : esCompletado
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : esActual
                          ? 'bg-blue-600 text-white shadow-xs animate-pulse'
                          : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {esError ? '✕' : esCompletado ? '✓' : p.numero}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {p.titulo}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-blue-950">
                    📍 {p.area}
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {p.descripcion}
                  </p>
                  {p.responsable && (
                    <p className="text-[10px] text-slate-400 font-medium pt-0.5">
                      👤 {p.responsable}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default RecorridoTramiteStepper;
