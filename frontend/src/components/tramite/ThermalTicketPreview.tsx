import React from 'react';
import logoSuiza from '../../assets/sigd/logo-suiza.png';

interface ThermalTicketPreviewProps {
  paperWidth?: '80mm' | '58mm';
  canal?: string;
  ticketData: {
    codigoCUT: string;
    administrado: string;
    dni: string;
    tramite: string;
    folios: number;
    fecha: string;
  };
}

export const ThermalTicketPreview: React.FC<ThermalTicketPreviewProps> = ({
  paperWidth = '80mm',
  canal = 'Mesa de Partes Presencial',
  ticketData,
}) => {
  const widthClass =
    paperWidth === '80mm'
      ? 'w-[80mm] print:w-[80mm]'
      : 'w-[58mm] print:w-[58mm]';
  const textSizeClass = paperWidth === '58mm' ? 'text-[10px]' : 'text-xs';

  return (
    <div
      id="thermal-ticket"
      data-print-target="thermal-ticket"
      className={`${widthClass} max-w-full overflow-hidden break-words break-inside-avoid bg-white p-2 text-black font-mono ${textSizeClass} leading-snug border border-gray-200 mx-auto print:border-none print:p-1`}
    >
      <div className="text-center font-bold border-b pb-1.5 mb-2 space-y-0.5">
        <img
          src={logoSuiza}
          alt='Escudo IESTP "Suiza"'
          className="h-8 w-8 shrink-0 aspect-square mx-auto object-contain"
        />
        <p className="text-xs uppercase">IESTP &ldquo;SUIZA&rdquo; — PUCALLPA</p>
        <p className="text-[10px] font-semibold">Sistema Integral SIGD · {canal}</p>
      </div>

      <div className="space-y-1 mb-2 break-words">
        <p className="break-all"><strong>CUT:</strong> {ticketData.codigoCUT}</p>
        <p><strong>FECHA:</strong> {ticketData.fecha}</p>
        <p className="break-all"><strong>DOC.:</strong> {ticketData.dni}</p>
        <p><strong>NOMBRE:</strong> {ticketData.administrado}</p>
        <p><strong>TRÁMITE:</strong> {ticketData.tramite}</p>
        <p><strong>FOLIOS:</strong> {ticketData.folios}</p>
      </div>

      <div className="text-center border-t pt-2 my-2">
        <div className="bg-gray-100 p-1.5 font-bold tracking-wider text-center break-all">
          ||||| {ticketData.codigoCUT} |||||
        </div>
      </div>

      <div className="text-center text-[9px] mt-2 border-t pt-1">
        Conserve este ticket para consultar el estado de su trámite en el portal institucional.
      </div>
    </div>
  );
};
