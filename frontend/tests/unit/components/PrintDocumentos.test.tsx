import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReciboPagoPrintable } from "../../../src/components/tesoreria/ReciboPagoPrintable";
import CargoDigitalModal from "../../../src/components/tramite/CargoDigitalModal";
import { ThermalTicketPreview } from "../../../src/components/tramite/ThermalTicketPreview";
import type { DtoOrdenPago } from "../../../src/services/tesoreria.service";
import type { CargoDigitalResponse } from "../../../src/types/tramiteWizardState";

function buildOrden(overrides: Partial<DtoOrdenPago> = {}): DtoOrdenPago {
  return {
    ordenPagoId: "ord-1",
    codigoPago: "PAG-2026-000101",
    expedienteId: "exp-1",
    codigoExpediente: "EXP-2026-000101",
    solicitanteId: "sol-1",
    solicitanteNombre: "Ciudadano de Prueba",
    documentoEnmascarado: "DNI ****1234",
    concepto: "Certificado de Inglés (TUPA p1-fila-06)",
    codigoTupa: "p1-fila-06",
    monto: 45,
    moneda: "PEN",
    estado: "CONFIRMADO",
    metodoPago: "EFECTIVO",
    referenciaOperacion: "OP-998877",
    montoRecibido: 50,
    vuelto: 5,
    codigoRecibo: "REC-2026-000101",
    fechaCreacion: "2026-11-18T10:00:00Z",
    fechaVencimiento: "2026-11-25T23:59:59Z",
    fechaPago: "2026-11-18T10:15:00Z",
    tesoreroId: "tes-1",
    tesoreroNombre: "Tesorería Demo",
    motivoRechazo: null,
    ...overrides,
  };
}

describe("Reglas de impresión institucional (@media print, Tesorería, Cargo Digital y Ticket Térmico)", () => {
  it("Tesorería CONFIRMADO: muestra escudo, correlativo, importe y botón Imprimir Recibo oculto en impresión", () => {
    const { container } = render(
      <div data-print-target="recibo-voucher">
        <div data-print-target="recibo-card">
          <ReciboPagoPrintable
            orden={buildOrden({ estado: "CONFIRMADO" })}
            formatearFecha={() => "18/11/2026, 10:15 a. m."}
            onClose={() => {}}
          />
        </div>
      </div>,
    );

    expect(screen.getByText("PAGO CONFIRMADO")).toBeInTheDocument();
    expect(screen.getByText("CONSTANCIA DE PAGO")).toBeInTheDocument();
    expect(screen.getByText(/N° COMPROBANTE: REC-2026-000101/)).toBeInTheDocument();
    expect(screen.getByText(/TOTAL PAGADO:/i)).toBeInTheDocument();
    expect(screen.getByText(/S\/ 45\.00 \(PEN\)/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Escudo IESTP "Suiza"/i)).toBeInTheDocument();

    const btn = screen.getByRole("button", { name: /Imprimir Recibo/i });
    expect(btn.closest("div")).toHaveClass("print:hidden");
    expect(container.querySelector('[data-print-target="recibo-voucher"]')).not.toBeNull();
  });

  it("Tesorería PENDIENTE: nunca muestra constancia cancelada ni pago validado", () => {
    render(
      <ReciboPagoPrintable
        orden={buildOrden({
          estado: "PENDIENTE",
          codigoRecibo: null,
          fechaPago: null,
          metodoPago: null,
          referenciaOperacion: null,
        })}
        formatearFecha={() => "18/11/2026, 10:00 a. m."}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("PENDIENTE DE PAGO")).toBeInTheDocument();
    expect(screen.getByText("ORDEN DE PAGO DE TESORERÍA")).toBeInTheDocument();
    expect(screen.getByText(/NO VÁLIDO COMO CONSTANCIA DE PAGO/i)).toBeInTheDocument();
    expect(screen.getByText(/IMPORTE POR PAGAR:/i)).toBeInTheDocument();
    expect(screen.queryByText(/^CONSTANCIA DE PAGO$/i)).toBeNull();
    expect(screen.queryByText(/TOTAL CANCELADO/i)).toBeNull();
    expect(screen.queryByText(/REC-2026-PENDIENTE/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Imprimir Orden/i })).toBeInTheDocument();
  });

  it("Tesorería RECHAZADO y ANULADO: refleja estado no acreditado y motivo cuando existe", () => {
    const { rerender } = render(
      <ReciboPagoPrintable
        orden={buildOrden({
          estado: "RECHAZADO",
          codigoRecibo: null,
          motivoRechazo: "Voucher ilegible",
        })}
        formatearFecha={() => "18/11/2026"}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("ORDEN RECHAZADA")).toBeInTheDocument();
    expect(screen.getByText("Voucher ilegible")).toBeInTheDocument();
    expect(screen.getByText(/No acredita pago confirmado/i)).toBeInTheDocument();

    rerender(
      <ReciboPagoPrintable
        orden={buildOrden({ estado: "ANULADO", codigoRecibo: null, motivoRechazo: null })}
        formatearFecha={() => "18/11/2026"}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("ORDEN ANULADA")).toBeInTheDocument();
    expect(screen.getByText(/IMPORTE DE LA ORDEN:/i)).toBeInTheDocument();
  });

  it("CargoDigitalModal: identifica Mesa de Partes Digital (sin Ventanilla Presencial) y aísla impresión", () => {
    const cargo: CargoDigitalResponse = {
      cut: "EXP-2026-900001",
      remitente: "Ana Torres",
      asunto: "Solicitud de Certificado de Inglés",
      fechaRecepcionOficial: "2026-11-18T12:00:00Z",
      fechaRadicacion: "2026-11-18T12:00:00Z",
      qrValidationUrl: "https://sigd.iestp-suiza.edu.pe/consulta/EXP-2026-900001",
      hashTransaccion: "a".repeat(64),
    };

    const { container } = render(
      <CargoDigitalModal isOpen={true} onClose={() => {}} cargo={cargo} />,
    );

    expect(screen.getAllByText(/Mesa de Partes Digital \(Virtual\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Ventanilla Presencial/i)).toBeNull();
    expect(screen.getByText("EXP-2026-900001")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR para seguimiento/i })).toBeInTheDocument();
    expect(container.querySelector('[data-print-target="cargo-voucher"]')).not.toBeNull();
    expect(container.querySelector('[data-print-target="cargo-card"]')).not.toBeNull();
    expect(container.querySelector("header, nav")).toBeNull();
  });

  it("ThermalTicketPreview: soporta 58mm y 80mm sin deformar escudo y con ajuste de texto", () => {
    const data = {
      codigoCUT: "EXP-2026-888888",
      administrado: "Carlos Alberto Pérez Mendoza",
      dni: "****4321",
      tramite: "Certificado de Idioma Inglés Técnico",
      folios: 4,
      fecha: "18/11/2026 11:00",
    };

    const { container, rerender } = render(
      <ThermalTicketPreview paperWidth="58mm" ticketData={data} />,
    );
    const ticket58 = container.querySelector('#thermal-ticket[data-print-target="thermal-ticket"]');
    expect(ticket58).not.toBeNull();
    expect(ticket58?.className).toContain("w-[58mm]");
    expect(ticket58?.className).toContain("break-inside-avoid");
    expect(ticket58?.className).toContain("break-words");
    const img58 = screen.getByAltText(/Escudo IESTP "Suiza"/i);
    expect(img58.className).toContain("object-contain");
    expect(img58.className).toContain("aspect-square");

    rerender(<ThermalTicketPreview paperWidth="80mm" ticketData={data} />);
    expect(ticket58?.className).toContain("w-[80mm]");
  });

  it("theme.css @media print aísla vouchers/cargos/tickets y oculta navegación y botones", () => {
    const cssPath = path.resolve(process.cwd(), "src/styles/theme.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    expect(css).toContain("@media print");
    expect(css).toContain("size: A4 portrait");
    expect(css).toContain("header, footer, nav, aside, .header-sigd, .sigd-footer, .header-bar, .print\\:hidden");
    expect(css).toContain('[data-print-target="recibo-voucher"]');
    expect(css).toContain('[data-print-target="cargo-voucher"]');
    expect(css).toContain('[data-print-target="thermal-ticket"]');
    expect(css).toContain("break-inside: avoid");
  });
});
