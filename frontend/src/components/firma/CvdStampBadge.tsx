import QrCodeView from "../common/QrCodeView";
import type { EstampaCvdData } from "../../types/cvdVerificacion";

interface CvdStampBadgeProps {
  estampa: EstampaCvdData;
  variante?: "lateral" | "tarjeta";
}

export default function CvdStampBadge({
  estampa,
  variante = "lateral",
}: CvdStampBadgeProps) {
  const urlCompleta = `${estampa.urlValidacion}?cvd=${encodeURIComponent(estampa.codigoCvd)}`;

  if (variante === "tarjeta") {
    return (
      <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 shadow-sm text-xs text-slate-800">
        <div className="flex gap-4 items-center">
          <QrCodeView value={urlCompleta} size={120} ariaLabel="QR de verificación de CVD" />
          <div className="space-y-1">
            <span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-800">
              {estampa.codigoCvd}
            </span>
            <p className="font-semibold text-slate-900">{estampa.firmanteNombre}</p>
            <p className="text-[11px] text-slate-600">{estampa.firmanteCargo}</p>
            <p className="text-[10px] text-slate-500">
              Certificado por: {estampa.entidadCertificadora}
            </p>
            <p className="text-[10px] font-mono text-slate-400">
              Hash: {estampa.hashSha256.slice(0, 16)}…{estampa.hashSha256.slice(-8)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Estampa lateral para margen derecho del documento oficial A4
  return (
    <aside
      className="w-48 border-l-2 border-slate-400 bg-slate-50 p-3 text-[10px] leading-tight text-slate-700 flex flex-col justify-between"
      aria-label="Estampa de Verificación Digital Oficial (CVD)"
    >
      <div className="space-y-2 text-center">
        <div className="border-b border-slate-300 pb-1.5">
          <p className="font-bold text-[9px] uppercase tracking-wider text-slate-900">
            Firma Digital Oficial
          </p>
          <p className="text-[8px] text-slate-500">IESTP "Suiza" — Pucallpa</p>
        </div>

        <div className="flex justify-center py-1">
          <QrCodeView value={urlCompleta} size={110} ariaLabel="QR de validación digital" />
        </div>

        <div className="rounded bg-white p-1 border border-slate-200">
          <p className="text-[8px] text-slate-500 uppercase font-bold">Código CVD</p>
          <p className="font-mono text-[10px] font-bold text-blue-800 break-all">
            {estampa.codigoCvd}
          </p>
        </div>

        <div className="text-left space-y-1 text-[8px] pt-1">
          <p>
            <span className="font-bold">Firmante:</span> {estampa.firmanteNombre}
          </p>
          <p>
            <span className="font-bold">Cargo:</span> {estampa.firmanteCargo}
          </p>
          <p>
            <span className="font-bold">Certificadora:</span> {estampa.entidadCertificadora}
          </p>
          <p>
            <span className="font-bold">Fecha:</span>{" "}
            {new Date(estampa.fechaFirmaIso).toLocaleString("es-PE")}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-300 pt-2 text-[7.5px] text-slate-500 text-justify">
        <p>
          Esta es una representación impresa cuya autenticidad e integridad puede ser
          contrastada a través de la siguiente dirección web:{" "}
          <span className="font-mono text-blue-700 underline">{estampa.urlValidacion}</span>{" "}
          ingresando la clave CVD indicada conforme al D.S. N.° 070-2013-PCM.
        </p>
      </div>
    </aside>
  );
}
