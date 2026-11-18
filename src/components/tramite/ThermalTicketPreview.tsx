import React from 'react';

interface ThermalTicketPreviewProps {
  paperWidth?: '80mm' | '58mm';
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
  ticketData,
}) => {
  const widthClass = paperWidth === '80mm' ? 'w-[80mm]' : 'w-[58mm]';

  return (
    <div
      id="thermal-ticket"
      className={`${widthClass} bg-white p-2 text-black font-mono text-xs border border-gray-200 mx-auto print:border-none print:p-0`}
    >
      <div className="text-center font-bold uppercase border-b pb-1 mb-2">
        <p className="text-sm">UNIVERSIDAD / SIGD</p>
        <p className="text-[10px]">Mesa de Partes Presencial</p>
      </div>

      <div className="space-y-1 mb-2">
        <p><strong>CUT:</strong> {ticketData.codigoCUT}</p>
        <p><strong>FECHA:</strong> {ticketData.fecha}</p>
        <p><strong>DNI:</strong> {ticketData.dni}</p>
        <p><strong>NOMBRE:</strong> {ticketData.administrado}</p>
        <p><strong>TRAMITE:</strong> {ticketData.tramite}</p>
        <p><strong>FOLIOS:</strong> {ticketData.folios}</p>
      </div>

      <div className="text-center border-t pt-2 my-2">
        {/* Espacio para Código de Barras / QR */}
        <div className="bg-gray-100 p-2 font-bold tracking-widest text-center">
          ||||| {ticketData.codigoCUT} |||||
        </div>
      </div>

      <div className="text-center text-[9px] mt-2 border-t pt-1">
        Conserve este ticket para consultar el estado de su trámite en el portal web.
      </div>
    </div>
  );
};