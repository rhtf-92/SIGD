import { Link } from "react-router-dom";

import DocumentoCvdViewer from "../../components/firma/DocumentoCvdViewer";

/**
 * ENT-M04-04 · Mayra (R).
 * Visor Documental y Códigos QR: representación impresa A4 con estampa
 * lateral CVD de 20mm (D.S. 070-2013-PCM) + QR 200px nivel M.
 */
export default function VisorCvdPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 print:min-h-0 print:bg-white">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Volver al inicio
            </Link>
            <Link
              to="/flujo-validez-legal"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Volver al módulo
            </Link>
          </div>
          <p className="text-sm font-bold text-blue-700">ENT-M04-04 · Mayra (R)</p>
          <h1 className="text-2xl font-bold">Visor Documental y Códigos QR</h1>
          <p className="mt-1 text-sm text-slate-500">
            Copia auténtica imprimible con estampa lateral CVD y QR de cotejo
            (D.S. N.° 070-2013-PCM · Ley N.° 27269).
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8 print:mx-0 print:max-w-none print:p-0">
        <DocumentoCvdViewer />
      </section>
    </main>
  );
}
