/**
 * CvdIntegrityReport — F_ADRIANO / ENT-M04-05 / T-FE-DOC-04.
 * Dictamen visual de autenticidad CVD con valor probatorio formal:
 * escudo institucional, firma PAdES-BES, titular del certificado RENIEC,
 * fecha/hora de sellado TSA (RFC 3161) y descarga del documento cotejado.
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
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-blue-800 bg-white text-xl font-black text-blue-800"
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
        className="overflow-hidden rounded-xl border-2 border-red-600 bg-white shadow-sm"
      >
        <header className="flex items-center gap-4 bg-red-700 p-5 text-white">
          <EscudoSuiza />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">
              IESTP Suiza · Dictamen de verificación CVD
            </p>
            <h2 className="text-xl font-black">Documento no reconocido o adulterado</h2>
            <p className="text-sm opacity-90">
              CVD {resultado.cvd} · sin validez legal. No lo use como sustento.
            </p>
          </div>
        </header>
        <div className="p-6">
          <p className="text-sm leading-6 text-slate-700">{resultado.mensajeSeguridad}</p>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Posible documento apócrifo o alterado tras su emisión. Apersónese a la Secretaría
            Académica del instituto en Pucallpa con el ejemplar físico para el cotejo manual.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      aria-label={`Dictamen de autenticidad del CVD ${resultado.cvd}`}
      className="overflow-hidden rounded-xl border-2 border-emerald-700 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-4 bg-emerald-800 p-5 text-white">
        <EscudoSuiza />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">
            IESTP Suiza · Certificado de autenticidad · D.S. N° 070-2013-PCM
          </p>
          <h2 className="text-xl font-black">Documento auténtico y vigente</h2>
          <p className="font-mono text-sm opacity-90">CVD {resultado.cvd}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800">
          ✓ PAdES-BES VERIFICADO
        </span>
      </header>

      <div className="grid gap-6 p-6 md:grid-cols-2">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Documento emitido
            </dt>
            <dd className="mt-1 font-bold text-slate-800">{documento.numeroDocumento}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Asunto</dt>
            <dd className="mt-1 leading-5 text-slate-700">{documento.asunto}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Fecha y hora de emisión
            </dt>
            <dd className="mt-1 text-slate-700">{formatoFechaHora(documento.fechaEmision)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Sellado de tiempo TSA (RFC 3161)
            </dt>
            <dd className="mt-1 font-bold text-slate-800">
              {formatoFechaHora(resultado.selloTiempoTsa)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Hash SHA-256 (integridad)
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-slate-600">
              {documento.hashIntegridadSha256}
            </dd>
          </div>
        </dl>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Titulares del certificado digital (RENIEC)
          </h3>
          <ul className="mt-3 space-y-3">
            {documento.firmantes.map((f) => (
              <li
                key={`${f.nombre}-${f.cargo}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <p className="font-bold text-slate-800">{f.nombre}</p>
                <p className="text-xs text-slate-500">{f.cargo}</p>
                <p className="mt-1 text-xs text-slate-500">
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
                className="mt-3 inline-block text-sm font-bold text-blue-700 underline"
              >
                Abrir documento original cotejado ↗
              </a>
            );
          })()}
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-emerald-100 bg-emerald-50 px-6 py-4">
        <p className="mr-auto text-sm text-emerald-800">{resultado.mensajeSeguridad}</p>
        <button
          type="button"
          onClick={() => descargarDocumentoOriginal(resultado)}
          className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
        >
          Descargar dictamen cotejado
        </button>
      </footer>
    </section>
  );
}
