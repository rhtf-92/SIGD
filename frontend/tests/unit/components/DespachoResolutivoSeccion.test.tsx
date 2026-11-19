import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { DespachoResolutivoSeccion } from "../../../src/components/expedientes/DespachoResolutivoSeccion";
import type { ExpedienteDetalleRutaDoc, ResolucionInfoRutaDoc } from "../../../src/types/expediente";

const mockExpedienteBase: ExpedienteDetalleRutaDoc = {
  idExpediente: "1833bd1c-cc36-485b-8413-62a4d9b01de9",
  cut: "EXP-2026-000018",
  asunto: "Certificado de Estudios Superiores",
  fechaRadicacion: "2026-10-30T10:00:00Z",
  estadoActual: "EN_REVISION",
  areaActualId: "area-sec-acad",
  solicitanteId: "user-123",
  resumenDocumentos: { cantidadDocumentos: 2, totalFolios: 5 },
  ultimoMovimiento: null,
  sla: null,
};

describe("DespachoResolutivoSeccion (TSK-DEV-05.1)", () => {
  it("1. Muestra estado 'Sin Resolución Directoral Proyectada' y botón proyectar si puedeResolver=true", () => {
    render(
      <BrowserRouter>
        <DespachoResolutivoSeccion
          expediente={mockExpedienteBase}
          resolucion={null}
          puedeResolver={true}
          esFirmanteAutorizado={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText("Sin Resolución Directoral Proyectada")).toBeDefined();
    expect(screen.getAllByText("+ Proyectar Resolución Directoral").length).toBeGreaterThan(0);
  });

  it("2. Oculta botón de proyectar resolución cuando puedeResolver=false (ej. GESTOR_APOYO_AREA)", () => {
    render(
      <BrowserRouter>
        <DespachoResolutivoSeccion
          expediente={mockExpedienteBase}
          resolucion={null}
          puedeResolver={false}
          esFirmanteAutorizado={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText("Sin Resolución Directoral Proyectada")).toBeDefined();
    expect(screen.queryByText("+ Proyectar Resolución Directoral")).toBeNull();
    expect(screen.queryByText("+ Proyectar Resolución Directoral Ahora")).toBeNull();
  });

  it("3. Renderiza resolución en estado BORRADOR_PENDIENTE_FIRMA con botón de elevación a despacho", () => {
    const mockResolucionBorrador: ResolucionInfoRutaDoc = {
      resolucionId: "e7812035-7b2d-4b64-be71-d36dd2666dd8",
      expedienteId: mockExpedienteBase.idExpediente,
      numeroBorrador: "RD-2026-000018",
      tipoResolucion: "DIRECTORAL_ADMINISTRATIVA",
      asunto: "Proyecto de resolución directoral de certificación",
      estado: "BORRADOR_PENDIENTE_FIRMA",
      fechaProyeccion: "2026-10-30",
      firmadoPor: null,
      firmanteNombre: null,
      firmadoEn: null,
      cvd: null,
      hashPades: null,
    };

    render(
      <BrowserRouter>
        <DespachoResolutivoSeccion
          expediente={mockExpedienteBase}
          resolucion={mockResolucionBorrador}
          puedeResolver={true}
          esFirmanteAutorizado={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText("Borrador Pendiente de Firma")).toBeDefined();
    expect(screen.getByText("RD-2026-000018")).toBeDefined();
    expect(screen.getByText("Proyecto de Resolución en Revisión Técnica")).toBeDefined();
    expect(screen.getByText("Editar Proyecto de Resolución")).toBeDefined();
    expect(screen.getByText("Elevar a Despacho para Firma")).toBeDefined();
  });

  it("4. Renderiza estado EN_FIRMA con banner de bloqueo de edición y acceso a firma para Director", () => {
    const mockResolucionEnFirma: ResolucionInfoRutaDoc = {
      resolucionId: "e7812035-7b2d-4b64-be71-d36dd2666dd8",
      expedienteId: mockExpedienteBase.idExpediente,
      numeroBorrador: "RD-2026-000018",
      tipoResolucion: "DIRECTORAL_ADMINISTRATIVA",
      asunto: "Proyecto de resolución directoral elevado a despacho",
      estado: "EN_FIRMA",
      fechaProyeccion: "2026-10-30",
      firmadoPor: null,
      firmanteNombre: null,
      firmadoEn: null,
      cvd: null,
      hashPades: null,
    };

    render(
      <BrowserRouter>
        <DespachoResolutivoSeccion
          expediente={{ ...mockExpedienteBase, estadoActual: "EN_FIRMA" }}
          resolucion={mockResolucionEnFirma}
          puedeResolver={true}
          esFirmanteAutorizado={true}
        />
      </BrowserRouter>
    );

    expect(screen.getByText("En Despacho para Firma")).toBeDefined();
    expect(screen.getByText("Expediente en Despacho de Dirección General")).toBeDefined();
    expect(screen.getAllByText(/Pasarela de Firma Refirma|Firmar Digitalmente/).length).toBeGreaterThan(0);
    // Edición bloqueada: no debe haber botón de editar
    expect(screen.queryByText("Editar Proyecto de Resolución")).toBeNull();
  });

  it("5. Renderiza estado FIRMADA con CVD, validez legal PAdES e inmutabilidad", () => {
    const mockResolucionFirmada: ResolucionInfoRutaDoc = {
      resolucionId: "e7812035-7b2d-4b64-be71-d36dd2666dd8",
      expedienteId: mockExpedienteBase.idExpediente,
      numeroBorrador: "RD-2026-000018",
      numeroResolucion: "RD-2026-000018",
      tipoResolucion: "DIRECTORAL_ADMINISTRATIVA",
      asunto: "Resolución Directoral oficial suscrita",
      estado: "FIRMADA",
      fechaProyeccion: "2026-10-30",
      firmadoPor: "00000000-0000-0000-0000-000000000020",
      firmanteNombre: "Dr. Director General Demo",
      firmadoEn: "2026-10-30T15:27:06.955Z",
      cvd: "CVD-2026-1D291D2EA24B8773",
      hashPades: "947d090a92e285de36ae3f561aee88008cdd38b44dfcc32d700b808766b7d70f",
    };

    render(
      <BrowserRouter>
        <DespachoResolutivoSeccion
          expediente={{ ...mockExpedienteBase, estadoActual: "RESUELTO" }}
          resolucion={mockResolucionFirmada}
          puedeResolver={true}
          esFirmanteAutorizado={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText("Firmada Digitalmente")).toBeDefined();
    expect(screen.getByText("Resolución Directoral Oficial Suscrita con Firma Digital")).toBeDefined();
    expect(screen.getByText("CVD-2026-1D291D2EA24B8773")).toBeDefined();
    expect(screen.getByText("947d090a92e285de36ae3f561aee88008cdd38b44dfcc32d700b808766b7d70f")).toBeDefined();
    expect(screen.getByText("Dr. Director General Demo")).toBeDefined();
    expect(screen.getAllByText("Verificar Autenticidad CVD").length).toBeGreaterThan(0);
    // Documento inmutable: no hay botones de editar ni de elevar
    expect(screen.queryByText("Editar Proyecto de Resolución")).toBeNull();
    expect(screen.queryByText("Elevar a Despacho para Firma")).toBeNull();
  });

  it("6. Ejecuta elevación a despacho cuando se confirma la acción", async () => {
    const mockOnElevar = vi.fn().mockResolvedValue(undefined);
    const mockResolucionBorrador: ResolucionInfoRutaDoc = {
      resolucionId: "e7812035-7b2d-4b64-be71-d36dd2666dd8",
      expedienteId: mockExpedienteBase.idExpediente,
      numeroBorrador: "RD-2026-000018",
      tipoResolucion: "DIRECTORAL_ADMINISTRATIVA",
      asunto: "Proyecto de resolución directoral de certificación",
      estado: "BORRADOR_PENDIENTE_FIRMA",
      fechaProyeccion: "2026-10-30",
    };

    render(
      <BrowserRouter>
        <DespachoResolutivoSeccion
          expediente={mockExpedienteBase}
          resolucion={mockResolucionBorrador}
          puedeResolver={true}
          esFirmanteAutorizado={false}
          onElevarAFirma={mockOnElevar}
        />
      </BrowserRouter>
    );

    const btnElevar = screen.getByText("Elevar a Despacho para Firma");
    fireEvent.click(btnElevar);

    const btnConfirmar = screen.getByText("Confirmar Elevación");
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(mockOnElevar).toHaveBeenCalled();
    });
  });
});
