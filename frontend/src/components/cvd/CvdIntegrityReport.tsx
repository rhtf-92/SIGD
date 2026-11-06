/**
 * CvdIntegrityReport — F_ADRIANO / ENT-M04-05 / T-FE-DOC-04.
 * Dictamen visual de autenticidad CVD con valor probatorio formal:
 * escudo institucional, firma PAdES-BES, titular del certificado RENIEC,
 * fecha/hora de sellado TSA (RFC 3161) y descarga del documento cotejado.
 * Responsive Web Design (RWD) Full-Width Fluid Container sin restricciones laterales.
 */
import type { ValidacionCVDResult } from "../../types/validadorCvd";

interface CvdIntegrityReportProps {
  resultado: ValidacionCVDResult;
}

function formatoFechaHora(valor: string | null): string {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Lima",
  }).format(d);
}

function descargarDocumentoOriginal(resultado: ValidacionCVDResult) {
  const doc = resultado.documento;
  const lineas = [
    "CERTIFICADO DE AUTENTICIDAD CVD — IESTP SUIZA (PUCALLPA)",
    "D.S. N° 070-2013-PCM · Ley N° 27269 (Firmas y Certificados Digitales)",
    "=".repeat(60),
    "",
    `CVD verificado            : ${resultado.cvd}`,
    `Dictamen                  : ${resultado.esValido ? "AUTÉNTICO Y VIGENTE" : "NO RECONOCIDO / ADULTERADO"}`,
    `Estándar de firma         : PAdES-BES`,
    `Sellado de tiempo TSA     : ${formatoFechaHora(resultado.selloTiempoTsa)} (RFC 3161, America/Lima)`,
  ];
  if (doc) {
    lineas.push(
      "",
      `Documento                 : ${doc.numeroDocumento} (${doc.tipo})`,
      `Asunto                    : ${doc.asunto}`,
      `Fecha de emisión          : ${formatoFechaHora(doc.fechaEmision)}`,
      "",
      "Titulares del certificado digital (RENIEC / IOFE INDECOPI):",
      ...doc.firmantes.map(
        (f) => `  • ${f.nombre} — ${f.cargo} — firma: ${formatoFechaHora(f.fechaFirma)} [${f.entidadCertificadora}]`,
      ),
      "",
      `Hash SHA-256 de integridad : ${doc.hashIntegridadSha256}`,
      `Descarga del original       : ${doc.urlDescargaAutentica}`,
    );
  }
  lineas.push("", resultado.mensajeSeguridad);
  const blob = new Blob([lineas.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dictamen-cvd-${resultado.cvd}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function EscudoSuiza() {
  return (
    <span
      className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-full border-2 border-blue-800 bg-white text-lg sm:text-xl font-black text-blue-800 shadow-xs"
      aria-hidden="true"
      title="Escudo institucional IESTP Suiza"
    >
      S
    </span>
  );
}

export default function CvdIntegrityReport({ resultado }: CvdIntegrityReportProps) {
  const { documento } = resultado;

  if (!resultado.esValido || !documento) {
    return (
      <section
        role="alert"
        aria-live="assertive"
        className="w-full overflow-hidden rounded-2xl border-2 border-red-600 bg-white shadow-md transition-all"
      >
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-red-700 to-red-800 p-5 sm:px-6 lg:px-8 text-white">
          <div className="flex items-center gap-4">
            <EscudoSuiza />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-200">
                IESTP Suiza · Dictamen de verificación CVD
              </p>
              <h2 className="text-xl sm:text-2xl font-black text-white">Documento no reconocido o adulterado</h2>
              <p className="font-mono text-xs sm:text-sm text-red-100">
                CVD {resultado.cvd} · sin validez legal. No lo use como sustento.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-red-100 px-3.5 py-1 text-xs font-black text-red-800 shadow-xs border border-red-300">
            ✕ ALERTA DE INTEGRIDAD
          </span>
        </header>
        <div className="p-5 sm:p-6 lg:p-8 space-y-4">
          <p className="text-sm sm:text-base leading-6 text-slate-800 font-medium">{resultado.mensajeSeguridad}</p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5 text-xs sm:text-sm text-amber-900 flex items-start gap-3">
            <span className="text-amber-600 text-xl shrink-0" aria-hidden="true">⚠️</span>
            <div className="space-y-1">
              <p className="font-bold">Advertencia de seguridad documental:</p>
              <p>
                Posible documento apócrifo o alterado tras su emisión. Apersónese a la Secretaría
                Académica del instituto en Pucallpa con el ejemplar físico para el cotejo manual.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      aria-label={`Dictamen de autenticidad del CVD ${resultado.cvd}`}
      className="w-full overflow-hidden rounded-2xl border-2 border-emerald-600 bg-white shadow-md transition-all"
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-800 to-emerald-900 p-5 sm:px-6 lg:px-8 text-white">
        <div className="flex items-center gap-4">
          <EscudoSuiza />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">
              IESTP Suiza · Certificado de autenticidad · D.S. N° 070-2013-PCM
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-white">Documento auténtico y vigente</h2>
            <p className="font-mono text-xs sm:text-sm text-emerald-100 font-semibold">CVD {resultado.cvd}</p>
          </div>
        </div>
        <div className="self-start sm:self-auto flex items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-black text-emerald-900 shadow-xs border border-emerald-300">
            ✓ PAdES-BES VERIFICADO
          </span>
        </div>
      </header>

      <div className="grid gap-6 p-5 sm:p-6 lg:p-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {/* Columna 1: Metadatos del Documento */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-200 pb-2">
            <span>📋</span> Datos Generales del Documento
          </h3>
          <dl className="space-y-3.5 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Documento emitido
              </dt>
              <dd className="mt-1 font-bold text-slate-900 text-sm sm:text-base">{documento.numeroDocumento}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Asunto</dt>
              <dd className="mt-1 leading-5 text-slate-700 text-xs sm:text-sm">{documento.asunto}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Fecha y hora de emisión
              </dt>
              <dd className="mt-1 text-slate-800 font-medium text-xs sm:text-sm">{formatoFechaHora(documento.fechaEmision)}</dd>
            </div>
          </dl>
        </div>

        {/* Columna 2: Integridad Criptográfica y Sellado TSA */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-200 pb-2">
            <span>🛡️</span> Integridad y Sello Temporal
          </h3>
          <dl className="space-y-3.5 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Sellado de tiempo TSA (RFC 3161)
              </dt>
              <dd className="mt-1 font-bold text-emerald-800 text-xs sm:text-sm">
                {formatoFechaHora(resultado.selloTiempoTsa)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Hash SHA-256 (integridad)
              </dt>
              <dd className="mt-1 break-all font-mono text-[11px] sm:text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs select-all">
                {documento.hashIntegridadSha256}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Estándar de Firma Digital
              </dt>
              <dd className="mt-1 text-xs text-slate-700">
                PAdES-BES con sellado de tiempo de autoridad certificada
              </dd>
            </div>
          </dl>
        </div>

        {/* Columna 3: Titulares del Certificado Digital (RENIEC) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4 md:col-span-2 xl:col-span-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-200 pb-2">
            <span>✍️</span> Titulares del certificado digital (RENIEC)
          </h3>
          <ul className="space-y-3">
            {documento.firmantes.map((f) => (
              <li
                key={`${f.nombre}-${f.cargo}`}
                className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs"
              >
                <p className="font-bold text-slate-900 text-xs sm:text-sm">{f.nombre}</p>
                <p className="text-xs text-slate-600 font-medium">{f.cargo}</p>
                <p className="mt-1.5 text-[11px] text-slate-500 font-mono">
                  Firma: {formatoFechaHora(f.fechaFirma)} · {f.entidadCertificadora}
                </p>
              </li>
            ))}
          </ul>
          {(() => {
            const href = documento.urlDescargaAutentica;
            const esInterna = href.startsWith("/");
            return (
              <a
                href={href}
                {...(esInterna
                  ? {}
                  : { target: "_blank", rel: "noreferrer" })}
                className="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-700 hover:text-blue-900 underline transition"
              >
                <span>Abrir documento original cotejado</span>
                <span>↗</span>
              </a>
            );
          })()}
        </div>
      </div>

      <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-emerald-100 bg-emerald-50/80 px-5 sm:px-6 lg:px-8 py-4">
        <p className="text-xs sm:text-sm text-emerald-900 font-medium text-center sm:text-left">{resultado.mensajeSeguridad}</p>
        <button
          type="button"
          onClick={() => descargarDocumentoOriginal(resultado)}
          className="w-full sm:w-auto shrink-0 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
        >
          Descargar dictamen cotejado
        </button>
      </footer>
    </section>
  );
}
