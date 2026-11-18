import React from "react";
import logoSuiza from "../../assets/sigd/logo-suiza.png";
import type { DtoOrdenPago } from "../../services/tesoreria.service";

interface ReciboPagoPrintableProps {
  orden: DtoOrdenPago;
  formatearFecha: (valor: string | null | undefined) => string;
  onClose: () => void;
  headingId?: string;
}

const ETIQUETAS_ESTADO: Record<string, { label: string; badge: string }> = {
  CONFIRMADO: {
    label: "PAGO CONFIRMADO",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  PENDIENTE: {
    label: "PENDIENTE DE PAGO",
    badge: "bg-amber-50 text-amber-800 border-amber-300",
  },
  RECHAZADO: {
    label: "ORDEN RECHAZADA",
    badge: "bg-red-50 text-red-800 border-red-200",
  },
  VENCIDO: {
    label: "ORDEN VENCIDA",
    badge: "bg-slate-100 text-slate-700 border-slate-300",
  },
  ANULADO: {
    label: "ORDEN ANULADA",
    badge: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

function describirMedioPago(orden: DtoOrdenPago): string {
  if (!orden.metodoPago) return "Por definir / Ventanilla";
  if (orden.metodoPago === "EFECTIVO") return "Efectivo en Ventanilla";
  if (orden.metodoPago === "YAPE") return "Yape / Transferencia Digital";
  if (orden.paymentProvider === "DEMO_QR") return "QR Automático — Simulador (sin dinero real)";
  return "QR Automático — TAYPI Sandbox";
}

/**
 * Componente imprimible estandarizado para órdenes y recibos internos de Tesorería del IESTP "Suiza".
 * Distingue explícitamente órdenes pendientes de pagos confirmados y aclara que es un comprobante
 * de control interno (no sustituye comprobantes de pago SUNAT).
 */
export const ReciboPagoPrintable: React.FC<ReciboPagoPrintableProps> = ({
  orden,
  formatearFecha,
  onClose,
  headingId = "recibo-modal-titulo",
}) => {
  const estado = String(orden.estado || "PENDIENTE").toUpperCase();
  const esConfirmado = estado === "CONFIRMADO";
  const esPendiente = estado === "PENDIENTE";
  const badgeInfo = ETIQUETAS_ESTADO[estado] ?? {
    label: estado,
    badge: "bg-slate-100 text-slate-800 border-slate-300",
  };
  const monedaSimbolo = orden.moneda === "PEN" || !orden.moneda ? "S/" : orden.moneda;
  const transaccionRef = orden.referenciaOperacion || orden.providerReference || orden.providerPaymentId;

  return (
    <>
      <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
        <img
          src={logoSuiza}
          alt='Escudo IESTP "Suiza"'
          className="h-10 w-10 mx-auto mb-1 object-contain"
        />
        <p className="text-[11px] font-bold text-blue-950 tracking-wide uppercase">
          INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO &ldquo;SUIZA&rdquo;
        </p>
        <p className="text-[10px] text-slate-500">Av. Túpac Amaru s/n, Pucallpa – Ucayali</p>
        <div className="pt-1">
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeInfo.badge}`}
          >
            {badgeInfo.label}
          </span>
        </div>
        <h3 id={headingId} className="text-base font-extrabold text-slate-900 tracking-tight pt-1">
          {esConfirmado ? "CONSTANCIA DE PAGO" : "ORDEN DE PAGO DE TESORERÍA"}
        </h3>
        <p className="text-[11px] font-semibold text-slate-600">
          {esConfirmado
            ? "RECIBO INTERNO DE TESORERÍA — NO ES COMPROBANTE SUNAT"
            : "DOCUMENTO DE CONTROL INTERNO — NO VÁLIDO COMO CONSTANCIA DE PAGO"}
        </p>
        {esConfirmado && orden.codigoRecibo ? (
          <p className="text-xs font-mono font-bold text-emerald-800">
            N° COMPROBANTE: {orden.codigoRecibo}
          </p>
        ) : (
          <p className="text-xs font-mono font-bold text-slate-800">
            N° ORDEN DE PAGO: {orden.codigoPago}
          </p>
        )}
      </div>

      <div className="space-y-2 text-xs text-slate-700 border-b border-dashed border-slate-300 pb-3">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 shrink-0">
            {esConfirmado ? "Fecha y hora de pago:" : "Fecha de emisión:"}
          </span>
          <span className="font-semibold text-slate-800 text-right">
            {formatearFecha(esConfirmado && orden.fechaPago ? orden.fechaPago : orden.fechaCreacion)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 shrink-0">Código de Orden:</span>
          <span className="font-mono font-bold text-slate-900 text-right">{orden.codigoPago}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 shrink-0">Expediente CUT:</span>
          <span className="font-mono font-semibold text-blue-800 text-right">{orden.codigoExpediente}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 shrink-0">Administrado:</span>
          <span className="font-semibold text-slate-900 text-right break-words">
            {orden.solicitanteNombre}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 shrink-0">Documento:</span>
          <span className="font-mono text-slate-700 text-right">{orden.documentoEnmascarado}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 shrink-0">Concepto:</span>
          <span className="font-medium text-slate-800 text-right break-words">{orden.concepto}</span>
        </div>
        {orden.codigoTupa && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Procedimiento TUPA:</span>
            <span className="font-mono text-slate-800 text-right">{orden.codigoTupa}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 shrink-0">Medio de Pago:</span>
          <span className="font-semibold text-slate-900 text-right">{describirMedioPago(orden)}</span>
        </div>
        {orden.metodoPago === "QR_AUTOMATICO_SANDBOX" && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Origen confirmación:</span>
            <span className="font-mono font-bold text-amber-900 text-right">
              {orden.paymentProvider === "DEMO_QR" ? "Webhook del simulador" : "Webhook TAYPI"}
            </span>
          </div>
        )}
        {transaccionRef && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Referencia Transacción:</span>
            <span className="font-mono font-semibold text-slate-800 text-right break-all">
              {transaccionRef}
            </span>
          </div>
        )}
        {orden.metodoPago === "EFECTIVO" && orden.montoRecibido !== null && Number(orden.montoRecibido) > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Efectivo Entregado:</span>
            <span className="font-mono text-right">
              {monedaSimbolo} {Number(orden.montoRecibido).toFixed(2)}
            </span>
          </div>
        )}
        {orden.metodoPago === "EFECTIVO" && orden.vuelto !== null && Number(orden.vuelto) > 0 && (
          <div className="flex justify-between gap-4 text-emerald-800 font-semibold">
            <span className="shrink-0">Vuelto:</span>
            <span className="font-mono text-right">
              {monedaSimbolo} {Number(orden.vuelto).toFixed(2)}
            </span>
          </div>
        )}
        {orden.motivoRechazo && !esConfirmado && (
          <div className="flex justify-between gap-4 text-red-700">
            <span className="shrink-0">Observación / Motivo:</span>
            <span className="text-right break-words">{orden.motivoRechazo}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 shrink-0">Unidad / Operador:</span>
          <span className="font-semibold text-slate-800 text-right">
            {orden.tesoreroNombre || "Tesorería — IESTP Suiza"}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
        <span className="font-bold text-slate-900 text-sm">
          {esConfirmado ? "TOTAL PAGADO:" : esPendiente ? "IMPORTE POR PAGAR:" : "IMPORTE DE LA ORDEN:"}
        </span>
        <span className="font-mono text-lg font-extrabold text-blue-900">
          {monedaSimbolo} {Number(orden.monto).toFixed(2)} ({orden.moneda || "PEN"})
        </span>
      </div>

      <div
        className={`text-center text-[10px] rounded-lg px-3 py-2 border ${
          esConfirmado
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
            : esPendiente
              ? "bg-amber-50/80 border-amber-200 text-amber-900"
              : "bg-slate-50 border-slate-200 text-slate-600"
        }`}
      >
        {esConfirmado
          ? "Pago validado en Tesorería del IESTP «Suiza». Comprobante de control interno SIGD (no es comprobante fiscal SUNAT)."
          : esPendiente
            ? `Esta orden permanece PENDIENTE DE PAGO hasta su confirmación en Tesorería. Vence el ${formatearFecha(orden.fechaVencimiento).replace(/\.+$/, "")}.`
            : `Orden en estado ${estado}. No acredita pago confirmado.`}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 print:hidden">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-blue-800 px-4 py-2 text-xs font-bold text-white hover:bg-blue-900 shadow-xs"
        >
          {esConfirmado ? "Imprimir Recibo" : "Imprimir Orden"}
        </button>
      </div>
    </>
  );
};
