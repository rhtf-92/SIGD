import type { ChangeEvent } from 'react';
import type { DocumentacionTramite, ClasificacionAdjunto } from '../../types/documentacionTramite';
import type { ArchivoTramite } from '../../types/tramiteWizardState';
import { autoAsociarArchivosRequisitos, evaluarRequisitosTramite } from '../../services/documentacionTramiteService';

export interface DestinoCarga {
  clasificacion: ClasificacionAdjunto;
  requisitoId?: string;
  sustituir?: string;
}

interface Props {
  detalle: DocumentacionTramite;
  archivos: ArchivoTramite[];
  disabled: boolean;
  adjuntar: (e: ChangeEvent<HTMLInputElement>, destino: DestinoCarga) => void;
}

export function DocumentacionRequisitos({ detalle, archivos, disabled, adjuntar }: Props) {
  const esPendienteValidacion = detalle.estadoValidacion === 'PENDIENTE_VALIDACION_DOCUMENTAL';
  const sinAnexos = Boolean(detalle.sinAnexosEspecificos || detalle.anexos.length === 0);
  const archivosAsociados = autoAsociarArchivosRequisitos(detalle, archivos);
  const evaluaciones = evaluarRequisitosTramite(detalle, archivosAsociados);

  return (
    <section className="mt-3 space-y-3 text-sm" aria-label="Requisitos y tarifa del procedimiento">
      {/* Tarjeta de Información General, Tarifa y Unidades Institucionales */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-blue-950">
            {detalle.numeroVisible ? `${detalle.numeroVisible} — ` : ''}{detalle.denominacion}
          </p>
          {esPendienteValidacion && (
            <span className="inline-block rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-900">
              Validación documental en curso
            </span>
          )}
        </div>

        <p className="font-semibold text-slate-900">
          {detalle.tarifa
            ? `Costo del trámite: S/ ${Number(detalle.tarifa.importe).toFixed(2)}`
            : 'Consulte el costo en Tesorería antes de realizar el pago.'}
        </p>

        {detalle.tarifa && (
          <p className="text-xs text-slate-600">
            {detalle.tarifa.concepto}. {detalle.condicionFinanciera === 'GRATUITO' ? 'Procedimiento gratuito.' : 'Pago presencial en efectivo en Tesorería tras radicar formalmente y obtener el CUT.'}
          </p>
        )}

        {/* Metadatos Institucionales de Tramitación y Enrutamiento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-blue-200/60 text-xs text-slate-700">
          <div>
            <span className="font-bold text-slate-900 block">Unidad de presentación:</span>
            <span>{detalle.unidadRecepcion || 'Mesa de Partes (MP)'}</span>
          </div>
          <div>
            <span className="font-bold text-slate-900 block">Unidad responsable:</span>
            <span>{detalle.unidadResponsable || 'Secretaría Académica (SEC)'}</span>
          </div>
          <div>
            <span className="font-bold text-slate-900 block">Autoridad resolutiva:</span>
            <span>{detalle.autoridadResolutiva || 'Pendiente de validación institucional'}</span>
          </div>
          <div>
            <span className="font-bold text-slate-900 block">Plazo de atención:</span>
            <span>{detalle.plazoDias ? `${detalle.plazoDias} días hábiles` : 'Sujeto a evaluación reglamentaria'}</span>
          </div>
          <div>
            <span className="font-bold text-slate-900 block">Silencio administrativo:</span>
            <span>{detalle.silencioAdministrativo || 'Según evaluación institucional'}</span>
          </div>
          <div>
            <span className="font-bold text-slate-900 block">Versión TUPA institucional:</span>
            <span>{detalle.versionTupa || 'TUPA Suiza 2026 (TUPA-2026-V1)'}</span>
          </div>
        </div>

        {detalle.observacionInstitucional && (
          <p className="mt-1.5 text-xs text-blue-900 bg-white/70 rounded p-2 border border-blue-100">
            <strong>Nota institucional:</strong> {detalle.observacionInstitucional}
          </p>
        )}
      </div>

      {(detalle.codigo === 'SUZ26-006' || detalle.codigoVisible === 'SUZ26-006') && (
        <div role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950 space-y-1">
          <p className="font-bold">Certificado de Inglés — Opción A (Estudios culminados y aprobados en el IESTP Suiza)</p>
          <p className="text-indigo-900">
            El solicitante únicamente debe adjuntar su Solicitud Única de Trámite (FUT) en PDF y realizar el pago del derecho de tramitación (S/ 100.00 en Tesorería) luego de obtener el CUT. Conforme al Principio de No Duplicación (TUO Ley N° 27444, Art. 48), no adjunte boletas de notas ni certificados previos: Secretaría Académica verificará internamente de oficio los antecedentes académicos de inglés registrados en la institución antes de la emisión y firma digital por Dirección General.
          </p>
        </div>
      )}

      {(detalle.codigo === 'SUZ26-034' || detalle.codigo === 'SUZ26-035' || detalle.codigoVisible === 'SUZ26-034') && (
        <div role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950 space-y-1">
          <p className="font-bold">Certificado de Estudios Superiores (6 semestres) — IESTP Suiza (TUPA 2026, Pág. 4)</p>
          <p className="text-indigo-900">
            El solicitante únicamente debe adjuntar su Solicitud Única de Trámite (FUT) en PDF y realizar el pago del derecho de tramitación (S/ 124.00 en Tesorería) luego de obtener el CUT. Conforme al Principio de No Duplicación (TUO Ley N° 27444, Art. 48), no debe adjuntar certificados de semestres anteriores ni actas de notas: Secretaría Académica verificará internamente de oficio los registros institucionales de los 6 semestres académicos cursados y aprobados antes de la emisión y firma digital por Dirección General.
          </p>
        </div>
      )}

      {/* Aviso transparente si está pendiente de validación */}
      {esPendienteValidacion && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold">Información TUPA en proceso de verificación reglamentaria</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              La presentación formal con Solicitud General (FUT) es admitida normalmente y no bloquea la radicación de su trámite.
            </p>
          </div>
        </div>
      )}

      {/* Secciones de Requisitos y Anexos */}
      {([
        ['Requisitos documentales', detalle.requisitos, 'EXPEDIENTE'],
        ['Anexos específicos', detalle.anexos, 'ANEXO'],
      ] as const).map(([titulo, requisitos, clasificacionDefault]) => (
        <div key={titulo} className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">{titulo}</h3>
            {titulo === 'Anexos específicos' && sinAnexos && (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Sin anexos obligatorios
              </span>
            )}
          </div>

          {!requisitos.length && (
            <p className="text-xs text-slate-600">
              {titulo === 'Anexos específicos'
                ? 'No se indican anexos específicos para este procedimiento en el TUPA institucional.'
                : 'Para orientación sobre los documentos de su solicitud, comuníquese con Mesa de Partes.'}
            </p>
          )}

          {requisitos.map((r) => {
            const adjuntos = archivosAsociados.filter((a) => a.requisitoId === r.id);
            const evaluacion = evaluaciones.find((e) => e.id === r.id);
            const nombre = r.nombre.replace(/\s*\(la fuente no establece obligatoriedad de adjuntarla\)\s*$/i, '');

            return (
              <div key={r.id} className="border-t border-slate-100 pt-2 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <p className="font-semibold text-slate-900">
                    {nombre}{' '}
                    <span className={r.obligatorio ? 'text-red-700 font-bold' : 'text-slate-500 font-medium'}>
                      ({r.obligatorio ? 'Obligatorio' : 'Opcional / Facultativo'})
                    </span>
                  </p>
                </div>

                {r.descripcion && (
                  <p className="text-xs text-slate-600">{r.descripcion}</p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span>
                    <strong>Formato:</strong> {r.formatosAdmitidos?.join(', ') || 'application/pdf'}
                  </span>
                  {r.fuente && (
                    <span>
                      <strong>Fuente oficial:</strong> {r.fuente}
                    </span>
                  )}
                </div>

                {r.observaciones && (
                  <p className="text-[11px] italic text-slate-500">
                    Obs: {r.observaciones}
                  </p>
                )}

                <div className="pt-0.5" role="status">
                  {evaluacion?.estado === 'PRESENTADO' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        PRESENTADO
                      </span>
                      <span className="text-xs text-emerald-900 font-medium">
                        Archivo: {adjuntos.map((a) => a.nombre).join(', ')} ({adjuntos.map((a) => `${a.paginas ?? 1} pág.`).join(', ')})
                      </span>
                    </div>
                  )}

                  {evaluacion?.estado === 'OBSERVADO' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                        ⚠️ OBSERVADO
                      </span>
                      <span className="text-xs text-amber-900 font-medium">
                        {evaluacion.motivoObservacion}
                      </span>
                    </div>
                  )}

                  {evaluacion?.estado === 'PENDIENTE' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-xs font-bold ${
                        r.obligatorio
                          ? 'bg-amber-100 border border-amber-300 text-amber-900'
                          : 'bg-slate-100 border border-slate-300 text-slate-700'
                      }`}>
                        {r.obligatorio ? '⚠️ PENDIENTE' : 'PENDIENTE (OPCIONAL)'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {r.obligatorio ? 'Documento obligatorio pendiente de adjuntar.' : 'Documento facultativo sin adjuntar.'}
                      </span>
                    </div>
                  )}
                </div>

                <label className="block mt-2 text-xs font-medium text-blue-800">
                  {adjuntos.length ? `Reemplazar / Adjuntar PDF: ${nombre}` : `Adjuntar PDF: ${nombre}`}
                  <input
                    aria-label={`Adjuntar PDF: ${nombre}`}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    disabled={disabled || r.tipos.length > 1 || r.tipos.some((t) => t.condicion !== null)}
                    className="block mt-1 w-full text-xs"
                    onChange={(e) => adjuntar(e, { clasificacion: r.clasificacion || clasificacionDefault, requisitoId: r.id })}
                  />
                </label>

                {(r.tipos.length > 1 || r.tipos.some((t) => t.condicion !== null)) && (
                  <p className="text-xs text-amber-800">
                    Comuníquese con Mesa de Partes para presentar este documento.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
