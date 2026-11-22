import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoSuiza from '../../assets/sigd/logo-suiza.webp';
import { formatearSoles, montoEnLetras } from '../../utils/monedaUtils';

export interface DatosReciboOficial {
  codigoRecibo?: string | null;
  codigoPago: string;
  codigoExpediente: string;
  solicitanteNombre: string;
  documentoEnmascarado: string;
  concepto: string;
  codigoTupa?: string | null;
  monto: number;
  metodoPago?: string | null;
  referenciaOperacion?: string | null;
  paymentProvider?: string | null;
  montoRecibido?: number | null;
  vuelto?: number | null;
  tesoreroNombre?: string | null;
  fechaPago?: string | null;
  fechaCreacion?: string | null;
}

interface ReciboOficialTesoreriaModalProps {
  abierto: boolean;
  onCerrar: () => void;
  datos: DatosReciboOficial | null;
}

export const ReciboOficialTesoreriaModal: React.FC<ReciboOficialTesoreriaModalProps> = ({
  abierto,
  onCerrar,
  datos,
}) => {
  if (!abierto || !datos) return null;

  const fechaMostrar = datos.fechaPago || datos.fechaCreacion || new Date().toISOString();
  const fechaFormateada = new Date(fechaMostrar).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const textoEnLetras = montoEnLetras(datos.monto);
  const montoFormateado = formatearSoles(datos.monto);
  const numRecibo = datos.codigoRecibo || 'REC-2026-OFICIAL';
  const qrValidationUrl = `https://sigd.iestp-suiza.edu.pe/verificar-recibo/${encodeURIComponent(numRecibo)}?exp=${encodeURIComponent(datos.codigoExpediente)}`;

  const metodoPagoTexto =
    datos.metodoPago === 'EFECTIVO'
      ? 'Efectivo en Ventanilla'
      : datos.metodoPago === 'YAPE'
        ? `Yape (Op. ${datos.referenciaOperacion || datos.codigoPago})`
        : datos.paymentProvider === 'DEMO_QR'
          ? 'QR Automático (Sandbox)'
          : 'QR Digital';

  return (
    <div
      data-print-target="recibo-voucher"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 print:static print:inset-auto print:bg-transparent print:p-0 print:block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recibo-titulo-modal"
    >
      <div
        data-print-target="recibo-card"
        className="w-full max-w-xl rounded-xl border border-slate-300 bg-white shadow-xl p-6 sm:p-7 space-y-4 print:max-w-xl print:mx-auto print:border print:border-slate-800 print:shadow-none print:p-5 break-inside-avoid text-slate-900"
      >
        {/* Cabecera Oficial Institucional Sobria */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-300 pb-3">
          <div className="flex items-center gap-3 text-left">
            <img
              src={logoSuiza}
              alt="Logo IESTP Suiza"
              className="w-14 h-14 object-contain shrink-0"
            />
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Gobierno Regional de Ucayali · DRE Ucayali
              </p>
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                IESTP «SUIZA» — PUCALLPA
              </h1>
              <p className="text-[10px] text-slate-600">
                Área de Tesorería y Caja · R.D. N° 0778-2006-ED
              </p>
              <p className="text-[9px] text-slate-400 font-mono">
                Av. Túpac Amaru s/n, Coronel Portillo, Ucayali
              </p>
            </div>
          </div>

          {/* Recuadro Formal de RUC y Número de Recibo */}
          <div className="border border-slate-400 rounded-lg p-2.5 text-center min-w-[180px] bg-slate-50/70 shrink-0">
            <p className="text-[11px] font-mono font-bold text-slate-700">R.U.C. 20496155601</p>
            <p id="recibo-titulo-modal" className="text-xs font-bold uppercase text-slate-900 my-0.5 tracking-wider">
              RECIBO DE CAJA
            </p>
            <p className="text-xs font-mono font-bold text-slate-900 border-t border-slate-300 pt-0.5">
              N° {numRecibo}
            </p>
          </div>
        </div>

        {/* Datos Generales del Administrado y Expediente */}
        <div className="border border-slate-200 rounded-lg p-3 text-xs bg-slate-50/40 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Fecha y Hora de Emisión:</span>
              <span className="font-semibold text-slate-800">{fechaFormateada}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">N° Orden de Pago:</span>
              <span className="font-mono font-bold text-slate-900">{datos.codigoPago}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200/80 pt-1.5">
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Expediente (CUT):</span>
              <span className="font-mono font-bold text-slate-900">{datos.codigoExpediente}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Doc. Identidad:</span>
              <span className="font-mono font-semibold text-slate-800">{datos.documentoEnmascarado}</span>
            </div>
          </div>

          <div className="border-t border-slate-200/80 pt-1.5 flex flex-col sm:flex-row sm:justify-between gap-1">
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Administrado(a) / Solicitante:</span>
              <span className="font-bold text-slate-900 uppercase">{datos.solicitanteNombre}</span>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-slate-500 font-medium block text-[11px]">Modalidad de Pago:</span>
              <span className="font-semibold text-slate-800">{metodoPagoTexto}</span>
            </div>
          </div>
        </div>

        {/* Tabla Detalle de Concepto TUPA */}
        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                <th className="py-1.5 px-3 w-12 text-center">Cant.</th>
                <th className="py-1.5 px-3 w-28">Código TUPA</th>
                <th className="py-1.5 px-3">Descripción del Concepto</th>
                <th className="py-1.5 px-3 text-right w-24">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 px-3 text-center font-mono">1</td>
                <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                  {datos.codigoTupa || 'TUPA-2026'}
                </td>
                <td className="py-2.5 px-3 font-medium text-slate-900">
                  {datos.concepto}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                  {montoFormateado}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={3} className="py-2 px-3 text-[11px] font-bold text-slate-600 uppercase">
                  {textoEnLetras}
                </td>
                <td className="py-2 px-3 text-right font-mono font-black text-sm text-slate-900 whitespace-nowrap">
                  {montoFormateado}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Detalle Efectivo recibido si aplica */}
        {datos.metodoPago === 'EFECTIVO' && datos.montoRecibido && (
          <div className="flex justify-between text-xs px-2 text-slate-600 font-mono">
            <span>Efectivo entregado: {formatearSoles(datos.montoRecibido)}</span>
            <span>Vuelto: {formatearSoles(datos.vuelto || 0)}</span>
          </div>
        )}

        {/* Pie de Recibo: QR Discreto + Sello Formal */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2.5 text-left">
            <div className="border border-slate-300 p-1 rounded bg-white shrink-0">
              <QRCodeSVG value={qrValidationUrl} size={54} level="M" />
            </div>
            <div className="text-[9px] text-slate-500 leading-tight">
              <p className="font-bold text-slate-700">Constancia Digital SIGD</p>
              <p>Verificable en la plataforma institucional.</p>
              <p className="font-mono text-slate-400">Ley N° 27444 · LPAG</p>
            </div>
          </div>

          <div className="text-center sm:text-right text-[10px] text-slate-600 min-w-[200px]">
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
              {datos.tesoreroNombre || 'Responsable de Tesorería'}
            </div>
            <p className="text-[9px] text-slate-500">Caja y Recaudación · IESTP «Suiza»</p>
          </div>
        </div>

        <p className="text-[9px] text-slate-400 text-center italic pt-1 border-t border-slate-100">
          Documento interno emitido como comprobante formal de pago para la tramitación académica y administrativa.
        </p>

        {/* Botones de Acción (ocultos al imprimir) */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 print:hidden">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-900 transition shadow-xs"
          >
            <span>🖨️</span>
            <span>Imprimir Comprobante</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReciboOficialTesoreriaModal;
