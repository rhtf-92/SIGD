import type { ValidacionCVDResult } from "../../types/validadorCvd";

interface CvdVerificationResultProps {
  resultado: ValidacionCVDResult;
}

function formatoFecha(valor: string): string {
  return new Date(valor).toLocaleString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}

function descargarCopiaAutentica(resultado: ValidacionCVDResult) {
  const documento = resultado.documento;
  const lineas = [
    "COPIA AUTÉNTICA DE DOCUMENTO ELECTRÓNICO — IESTP SUIZA",
    "============================================================",
    "",
    `CVD de verificación  : ${resultado.cvd}`,
  ];

  if (documento) {
    lineas.push(
      `Número de documento   : ${documento.numeroDocumento}`,
      `Tipo                  : ${documento.tipo}`,
      `Fecha de emisión      : ${formatoFecha(documento.fechaEmision)}`,
      `Asunto                : ${documento.asunto}`,
      "",
      "Firmantes digitales:",
      ...documento.firmantes.map(
        (firmante) =>
          `  - ${firmante.nombre} (${firmante.cargo}) — ${formatoFecha(firmante.fechaFirma)} [${firmante.entidadCertificadora}]`,
      ),
      "",
      `Hash SHA-256 de integridad: ${documento.hashIntegridadSha256}`,
      `Sello temporal TSA (RFC 3161): ${resultado.selloTiempoTsa ? formatoFecha(resultado.selloTiempoTsa) : "—"}`,
    );
  }

  const contenido = lineas.join("\n");
  const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `copia-autentica-${resultado.cvd}.txt`;
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function CvdVerificationResult({
  resultado,
}: CvdVerificationResultProps) {
  const { documento } = resultado;

  if (resultado.esValido && documento) {
    return (
      <section
        aria-live="polite"
        className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm"
      >
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 bg-emerald-50 p-5">
          <div className="flex items-center gap-3">
            <span
              className="grid h-11 w-11 place-items-center rounded-full bg-emerald-600 text-lg font-bold text-white"
              aria-hidden="true"
            >
              ✓
            </span>
            <div>
              <h2 className="text-lg font-bold text-emerald-900">
                Documento válido y vigente
              </h2>
              <p className="text-sm text-emerald-700">
                CVD {resultado.cvd} · autenticado por firma digital con plena
                validez legal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => descargarCopiaAutentica(resultado)}
            className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
          >
            Descargar copia auténtica
          </button>
        </header>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Documento emitido
              </dt>
              <dd className="mt-1 font-bold text-slate-800">
                {documento.numeroDocumento}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Fecha de emisión
              </dt>
              <dd className="mt-1 text-slate-700">
                {formatoFecha(documento.fechaEmision)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Asunto
              </dt>
              <dd className="mt-1 leading-5 text-slate-700">{documento.asunto}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Hash SHA-256 (integridad)
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-600">
                {documento.hashIntegridadSha256}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Sello de tiempo TSA
              </dt>
              <dd className="mt-1 text-slate-700">
                {resultado.selloTiempoTsa
                  ? formatoFecha(resultado.selloTiempoTsa)
                  : "No aplica"}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Firmantes digitales
            </h3>
            <ul className="mt-3 space-y-3">
              {documento.firmantes.map((firmante) => (
                <li
                  key={`${firmante.nombre}-${firmante.cargo}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="font-bold text-slate-800">{firmante.nombre}</p>
                  <p className="text-xs text-slate-500">{firmante.cargo}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Firma: {formatoFecha(firmante.fechaFirma)} ·{" "}
                    {firmante.entidadCertificadora}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="border-t border-emerald-100 bg-emerald-50/50 px-6 py-4 text-sm text-emerald-800">
          {resultado.mensajeSeguridad}
        </footer>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      role="alert"
      className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm"
    >
      <header className="flex items-center gap-3 border-b border-red-100 bg-red-50 p-5">
        <span
          className="grid h-11 w-11 place-items-center rounded-full bg-red-600 text-lg font-bold text-white"
          aria-hidden="true"
        >
          ✕
        </span>
        <div>
          <h2 className="text-lg font-bold text-red-900">
            Documento no verificado
          </h2>
          <p className="text-sm text-red-700">
            El código {resultado.cvd} no corresponde a un documento oficial
            legítimo.
          </p>
        </div>
      </header>

      <div className="p-6">
        <p className="text-sm leading-5 text-slate-700">
          {resultado.mensajeSeguridad}
        </p>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Si usted recibió este documento por correo, evite usarlo como
          sustento legal o académico. Comuníquese con la Secretaría Académica
          del IESTP Suiza para verificar la emisión original en el expediente
          institucional.
        </p>
      </div>
    </section>
  );
}