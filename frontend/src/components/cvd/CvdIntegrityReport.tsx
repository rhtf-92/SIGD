import type { ValidacionCVDResult } from "../../types/validadorCvd";

interface CvdIntegrityReportProps { resultado: ValidacionCVDResult }
function fecha(valor: string | null): string {
  if (!valor || !Number.isFinite(new Date(valor).getTime())) return "No disponible";
  return new Date(valor).toLocaleString("es-PE", { timeZone: "America/Lima" });
}
function descargaSegura(valor: string): string | null {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))
      ? url.href : null;
  } catch { return null; }
}
export default function CvdIntegrityReport({ resultado }: CvdIntegrityReportProps) {
  const documento = resultado.esValido ? resultado.documento : null;
  if (!documento) return <section role="alert" aria-live="assertive" className="overflow-hidden rounded-xl border-2 border-red-600 bg-white shadow-sm">
    <header className="bg-red-700 p-5 text-white">
      <h2 className="text-xl font-black">Documento no verificable</h2>
      <p className="text-sm">CVD {resultado.cvd}</p>
    </header>
    <div className="p-6"><p className="text-sm text-slate-700">{resultado.mensajeSeguridad}</p></div>
  </section>;
  const url = descargaSegura(documento.urlDescargaAutentica);
  return <section aria-live="polite" aria-label={`Resultado del CVD ${resultado.cvd}`}
    className="overflow-hidden rounded-xl border-2 border-emerald-700 bg-white shadow-sm">
    <header className="bg-emerald-800 p-5 text-white">
      <p className="text-xs font-bold uppercase tracking-widest">IESTP Suiza · Consulta CVD</p>
      <h2 className="text-xl font-black">Integridad documental cotejada</h2>
      <p className="text-sm">CVD {resultado.cvd}</p>
    </header>
    <div className="grid gap-6 p-6 md:grid-cols-2">
      <dl className="space-y-3 text-sm">
        <div><dt>Número de documento</dt><dd>{documento.numeroDocumento ?? "No disponible"}</dd></div>
        <div><dt>Asunto</dt><dd>{documento.asunto ?? "No disponible"}</dd></div>
        <div><dt>Fecha registrada</dt><dd>{fecha(documento.fechaEmision)}</dd></div>
        <div><dt>Sellado de tiempo TSA registrado</dt><dd>{fecha(resultado.selloTiempoTsa)}</dd></div>
        <div><dt>Hash SHA-256 cotejado</dt><dd className="break-all font-mono text-xs">{documento.hashIntegridadSha256}</dd></div>
      </dl>
      <div>
        <h3 className="text-sm font-bold">Firmantes registrados</h3>
        <ul className="mt-3 space-y-3">{documento.firmantes.map((firmante, indice) => <li key={indice} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-bold">{firmante.nombre}</p>
          {firmante.cargo && <p>{firmante.cargo}</p>}
          <p>Fecha registrada: {fecha(firmante.fechaFirma)}</p>
          {firmante.entidadCertificadora && <p>{firmante.entidadCertificadora}</p>}
        </li>)}</ul>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
          className="mt-3 inline-block font-bold text-blue-700 underline">Abrir documento original</a>}
      </div>
    </div>
    <footer className="border-t border-emerald-100 bg-emerald-50 px-6 py-4 text-sm text-emerald-800">{resultado.mensajeSeguridad}</footer>
  </section>;
}