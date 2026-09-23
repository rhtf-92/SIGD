import { Link } from "react-router-dom";
import CvdStampBadge from "./CvdStampBadge";
import type { EstampaCvdData } from "../../types/cvdVerificacion";

export interface DocumentoCvdViewerProps {
  tituloDocumento?: string;
  numeroDocumento?: string;
  estampa?: EstampaCvdData;
  contenidoHtml?: string;
}

const ESTAMPA_DEMO_DEFAULT: EstampaCvdData = {
  codigoCvd: "CVD-2026-RD-000412-892F",
  urlValidacion: "https://sigd.iestpsuiza.edu.pe/validador-cvd",
  numeroDocumento: "RD N.° 0412-2026-DG-IESTP-SUIZA",
  fechaFirmaIso: "2026-09-05T11:42:15-05:00",
  firmanteNombre: "Lic. Julio César Mori Paredes",
  firmanteCargo: "Director General",
  entidadCertificadora: "RENIEC / IOFE INDECOPI",
  hashSha256: "9b73c93d7798ec3bf09bed4642f930f4e80fb5f9738c15258269d6b844f0430e",
};

export default function DocumentoCvdViewer({
  tituloDocumento = "Resolución Directoral N.° 0412-2026-DG-IESTP-SUIZA",
  numeroDocumento = "RD N.° 0412-2026-DG-IESTP-SUIZA",
  estampa = ESTAMPA_DEMO_DEFAULT,
}: DocumentoCvdViewerProps) {
  function handleImprimir() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div>
          <h2 className="text-base font-bold text-slate-900">{tituloDocumento}</h2>
          <p className="text-xs text-slate-500">
            Documento electrónico firmado digitalmente con valor legal pleno (Ley N.° 27269).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/validador-cvd?cvd=${encodeURIComponent(estampa.codigoCvd)}`}
            className="rounded-lg border border-blue-600 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
          >
            Verificar en Portal Público CVD →
          </Link>
          <button
            type="button"
            onClick={handleImprimir}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            🖨️ Imprimir Representación
          </button>
        </div>
      </div>

      {/* Contenedor Hoja A4 con Estampa Marginal */}
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-300 bg-white shadow-lg overflow-hidden">
        <div className="flex min-h-[750px]">
          {/* Cuerpo principal del documento */}
          <article className="flex-1 p-8 sm:p-12 space-y-6 text-slate-900 font-serif text-xs leading-relaxed">
            {/* Membrete Institucional */}
            <div className="text-center border-b-2 border-slate-800 pb-3">
              <p className="font-sans font-bold text-xs uppercase tracking-wide text-slate-700">
                Gobierno Regional de Ucayali · Dirección Regional de Educación
              </p>
              <h3 className="font-sans font-extrabold text-sm uppercase tracking-wider text-slate-900 mt-1">
                Instituto de Educación Superior Tecnológico Público "Suiza"
              </h3>
              <p className="text-[10px] text-slate-500 font-sans">
                Pucallpa — Ucayali · Creado por D.S. N.° 017-80-ED · Revalidado R.D. N.° 0192-2006-ED
              </p>
            </div>

            <div className="text-center py-2">
              <h4 className="font-bold text-sm underline tracking-wide">
                {numeroDocumento}
              </h4>
              <p className="text-[11px] text-slate-600 mt-1 italic">
                Pucallpa, 05 de setiembre de 2026
              </p>
            </div>

            <div className="text-justify indent-6">
              <span className="font-bold">VISTO: </span>
              El Expediente N.° EXP-2026-000155 y el Informe Técnico Favorable N.° 045-2026-SA-IESTP-SUIZA,
              relativo a la solicitud de titulación profesional técnica presentada por el administrado
              don Carlos Enrique Mendoza Ríos.
            </div>

            <div className="space-y-2">
              <p className="font-bold uppercase tracking-wider">Considerando:</p>
              <p className="text-justify indent-6">
                Que, conforme a lo establecido en la Ley N.° 30512 y el Reglamento Institucional,
                el egresado ha sustentado satisfactoriamente su proyecto aplicativo de fin de carrera,
                acreditando las competencias profesionales requeridas.
              </p>
              <p className="text-justify indent-6">
                Que, habiéndose cumplido con los requisitos de ley y contando con opinión técnica favorable,
                corresponde emitir el acto resolutivo que confiera el grado respectivo.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <p className="font-bold uppercase tracking-wider text-center">Se Resuelve:</p>
              <p className="text-justify">
                <span className="font-bold">ARTÍCULO 1°.- </span>
                CONFERIR el Título Profesional Técnico en Desarrollo de Sistemas de Información
                a don CARLOS ENRIQUE MENDOZA RÍOS.
              </p>
              <p className="text-justify">
                <span className="font-bold">ARTÍCULO 2°.- </span>
                REGÍSTRESE en el Libro de Títulos Institucional y notifíquese a los interesados.
              </p>
            </div>

            <div className="pt-8 text-center">
              <div className="mx-auto w-56 border-t border-slate-700 pt-1">
                <p className="font-sans font-bold text-xs uppercase">{estampa.firmanteNombre}</p>
                <p className="font-sans text-[11px] text-slate-600">{estampa.firmanteCargo}</p>
                <p className="font-sans text-[10px] text-slate-500">IESTP "Suiza" — Pucallpa</p>
              </div>
            </div>
          </article>

          {/* Estampa Marginal Lateral Derecha */}
          <CvdStampBadge estampa={estampa} variante="lateral" />
        </div>
      </div>
    </div>
  );
}
