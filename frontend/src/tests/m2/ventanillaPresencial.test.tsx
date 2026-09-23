import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import VentanillaPresencialPage from "../../pages/tramite/VentanillaPresencialPage";
import CargoDigitalModal from "../../components/tramite/CargoDigitalModal";
import type { CargoOficialTramite } from "../../types/cargoOficial";

const cargoMuestra: CargoOficialTramite = {
  codigoExpediente: "EXP-2026-000155",
  fechaRecepcionIso: "2026-09-23T10:30:00.000Z",
  fechaIngresoFormalIso: "2026-09-23T10:30:00.000Z",
  horaRecepcion: "10:30:00",
  operadorVentanillaNombre: "Operador de Mesa de Partes (Ventanilla 1)",
  sedeInstitucional: "Sede Central - Jr. Tarapacá N° 645, Pucallpa",
  solicitante: {
    tipoPersona: "NATURAL",
    tipoDocumento: "DNI",
    numeroDocumento: "74561238",
    nombreOrazonSocial: "Carlos Mendoza Ríos",
    correoElectronico: "carlos@gmail.com",
    telefono: "961234567",
  },
  asunto: "Solicitud de Certificado de Estudios",
  documentoPrincipalTipo: "SOLICITUD",
  cantidadFolios: 3,
  hashSha256Recepcion: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  horaCorteAplicada: "16:30",
  radicadoDiaSiguiente: false,
  urlSeguimiento: "https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000155",
};

describe("Suite de Pruebas de Ventanilla Presencial y Ticket Cargo CUT (ENT-M02-05)", () => {
  it("renderiza el formulario de ventanilla presencial con campos obligatorios y conmutador de persona", () => {
    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /Ventanilla Presencial de Atención al Ciudadano/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Persona Natural/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Persona Jurídica/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Número de Documento \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cantidad de Folios Físicos \*/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i })).toBeInTheDocument();
  });

  it("CargoDigitalModal: renderiza el ticket térmico con CUT, QR y datos del solicitante", () => {
    render(
      <CargoDigitalModal
        isOpen={true}
        onClose={() => {}}
        cargo={cargoMuestra}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("EXP-2026-000155")).toBeInTheDocument();
    expect(screen.getByText(/Carlos Mendoza Ríos/i)).toBeInTheDocument();
    expect(screen.getByText(/3 foja\(s\)/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR para seguimiento del trámite/i })).toBeInTheDocument();
    expect(screen.getByText(/🖨️ Imprimir Ticket Térmico/i)).toBeInTheDocument();
  });

  it("completa el flujo de registro en ventanilla y despliega el modal de cargo con CUT generado", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/Número de Documento \*/i), "74561238");
    await user.type(screen.getByLabelText(/Apellidos y Nombres \*/i), "Sergio Serruche");
    await user.type(screen.getByLabelText(/Correo Electrónico para Notificación \*/i), "sergio@correo.pe");
    await user.type(screen.getByLabelText(/Teléfono \/ Celular de Contacto \*/i), "961234567");
    await user.type(screen.getByLabelText(/Asunto \/ Petitorio Concreto \*/i), "Solicitud de convalidación académica");

    const botonRegistrar = screen.getByRole("button", { name: /✓ Registrar y Emitir Cargo CUT/i });
    await user.click(botonRegistrar);

    // Debe abrir el modal de cargo con el CUT generado
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Sergio Serruche/i)).toBeInTheDocument();
    expect(screen.getByText(/EXP-2026-/i)).toBeInTheDocument();
  });
});
