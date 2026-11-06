import DocumentoCvdViewer from "../../components/firma/DocumentoCvdViewer";
import FlujoPageHeader from "../../components/flujos/FlujoPageHeader";

/**
 * ENT-M04-04 · Mayra (R).
 * Visor Documental y Códigos QR: representación impresa A4 con estampa
 * lateral CVD de 20mm (D.S. 070-2013-PCM) + QR 200px nivel M.
 */
export default function VisorCvdPage() {
  return (
    <div className="flex-1 w-full bg-slate-100 text-slate-900 print:min-h-0 print:bg-white">
      <FlujoPageHeader
        faseTag="IESTP &quot;Suiza&quot; · Visualización Documental Institucional"
        title="Visor Documental y Códigos QR"
        breadcrumbLabel="Visor CVD"
        description="Copia auténtica imprimible con estampa lateral CVD y QR de cotejo (D.S. N.° 070-2013-PCM · Ley N.° 27269)."
      />

      <section className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8 print:mx-0 print:max-w-none print:p-0">
        <DocumentoCvdViewer />
      </section>
    </div>
  );
}
