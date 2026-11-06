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
        className="w-full overflow-hidden rounded-2xl border-2 border-emerald-600 bg-white shadow-md transition-all"
      >
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 bg-emerald-50/90 p-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-lg font-bold text-white shadow-xs"
              aria-hidden="true"
            >
              ✓
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-emerald-950">
                Documento válido y vigente
              </h2>
              <p className="text-xs sm:text-sm text-emerald-700">
                CVD {resultado.cvd} · autenticado por firma digital con plena
                validez legal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => descargarCopiaAutentica(resultado)}
            className="w-full sm:w-auto shrink-0 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
          >
            Descargar copia auténtica
          </button>
        </header>

        <div className="grid gap-6 p-5 sm:p-6 lg:p-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <dl className="space-y-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50/70 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
              Datos Generales
            </h3>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Documento emitido
              </dt>
              <dd className="mt-1 font-bold text-slate-900 text-sm sm:text-base">
                {documento.numeroDocumento}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Fecha de emisión
              </dt>
              <dd className="mt-1 text-slate-800 font-medium text-xs sm:text-sm">
                {formatoFecha(documento.fechaEmision)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Asunto
              </dt>
              <dd className="mt-1 leading-5 text-slate-700 text-xs sm:text-sm">{documento.asunto}</dd>
            </div>
          </dl>

          <div className="space-y-3.5 text-sm rounded-xl border border-slate-200 bg-slate-50/70 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
              Integridad Criptográfica
            </h3>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Hash SHA-256 (integridad)
              </dt>
              <dd className="mt-1 break-all font-mono text-[11px] sm:text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 select-all">
                {documento.hashIntegridadSha256}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Sello de tiempo TSA
              </dt>
              <dd className="mt-1 font-bold text-emerald-800 text-xs sm:text-sm">
                {resultado.selloTiempoTsa
                  ? formatoFecha(resultado.selloTiempoTsa)
                  : "No aplica"}
              </dd>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 md:col-span-2 xl:col-span-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
              Firmantes digitales
            </h3>
            <ul className="mt-3 space-y-3">
              {documento.firmantes.map((firmante) => (
                <li
                  key={`${firmante.nombre}-${firmante.cargo}`}
                  className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs"
                >
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{firmante.nombre}</p>
                  <p className="text-xs text-slate-600 font-medium">{firmante.cargo}</p>
                  <p className="mt-1.5 text-[11px] text-slate-500 font-mono">
                    Firma: {formatoFecha(firmante.fechaFirma)} ·{" "}
                    {firmante.entidadCertificadora}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="border-t border-emerald-100 bg-emerald-50/80 px-5 sm:px-6 lg:px-8 py-4 text-xs sm:text-sm text-emerald-900 font-medium">
          {resultado.mensajeSeguridad}
        </footer>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      role="alert"
      className="w-full overflow-hidden rounded-2xl border-2 border-red-600 bg-white shadow-md transition-all"
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-100 bg-red-50/90 p-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-600 text-lg font-bold text-white shadow-xs"
            aria-hidden="true"
          >
            ✕
          </span>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-red-950">
              Documento no verificado
            </h2>
            <p className="text-xs sm:text-sm text-red-700">
              El código {resultado.cvd} no corresponde a un documento oficial
              legítimo.
            </p>
          </div>
        </div>
        <span className="self-start sm:self-auto rounded-full bg-red-100 px-3.5 py-1 text-xs font-black text-red-800 shadow-xs border border-red-300">
          ✕ ALERTA DE INTEGRIDAD
        </span>
      </header>

      <div className="p-5 sm:p-6 lg:p-8 space-y-4">
        <p className="text-sm sm:text-base leading-6 text-slate-800 font-medium">
          {resultado.mensajeSeguridad}
        </p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5 text-xs sm:text-sm text-amber-900 flex items-start gap-3">
          <span className="text-amber-600 text-xl shrink-0" aria-hidden="true">⚠️</span>
          <div className="space-y-1">
            <p className="font-bold">Advertencia de seguridad documental:</p>
            <p>
              Si usted recibió este documento por correo, evite usarlo como
              sustento legal o académico. Comuníquese con la Secretaría Académica
              del IESTP Suiza para verificar la emisión original en el expediente
              institucional.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
