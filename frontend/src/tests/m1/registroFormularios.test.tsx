import { useState } from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import RegistroCiudadanoPage from "../../pages/registro/RegistroCiudadanoPage";
import PersonaNaturalForm from "../../components/registro/PersonaNaturalForm";
import PersonaJuridicaForm from "../../components/registro/PersonaJuridicaForm";
import { DeclaracionJuradaCheckbox } from "../../components/registro/DeclaracionJuradaCheckbox";
import { ConsentimientoLey29733Modal } from "../../components/registro/ConsentimientoLey29733Modal";
import { consentimientoLey29733Schema } from "../../schemas/consentimiento.schema";

describe("Suite de Pruebas de Formularios de Registro Ciudadano (ENT-M01-01 / ENT-M01-04 / ENT-M01-05)", () => {
  it("a) RegistroCiudadanoPage: el conmutador role=\"tablist\" alterna entre Persona Natural y Persona Jurídica sin recargar, y cambia los campos visibles", async () => {
    const user = userEvent.setup();
    render(<RegistroCiudadanoPage />);

    // Verificar existencia del conmutador con role="tablist"
    const tablist = screen.getByRole("tablist", { name: /Tipo de persona/i });
    expect(tablist).toBeInTheDocument();

    const tabNatural = screen.getByRole("tab", { name: /Persona Natural/i });
    const tabJuridica = screen.getByRole("tab", { name: /Persona Jurídica/i });

    // Estado inicial: Persona Natural activo
    expect(tabNatural).toHaveAttribute("aria-selected", "true");
    expect(tabJuridica).toHaveAttribute("aria-selected", "false");

    // Campos visibles de Persona Natural
    expect(screen.getByLabelText(/Fecha de Nacimiento \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Apellidos \*/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/RUC \*/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Razón Social \*/i)).not.toBeInTheDocument();

    // Alternar a Persona Jurídica
    await user.click(tabJuridica);

    expect(tabNatural).toHaveAttribute("aria-selected", "false");
    expect(tabJuridica).toHaveAttribute("aria-selected", "true");

    // Campos visibles de Persona Jurídica
    expect(screen.getByLabelText(/RUC \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Razón Social \*/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Fecha de Nacimiento \*/i),
    ).not.toBeInTheDocument();

    // Alternar nuevamente a Persona Natural
    await user.click(tabNatural);
    expect(tabNatural).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/Fecha de Nacimiento \*/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/RUC \*/i)).not.toBeInTheDocument();
  });

  it("b) PersonaNaturalForm: al escribir un DNI inválido y hacer blur, aparece el mensaje de error inline debajo del campo", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<PersonaNaturalForm onSubmit={handleSubmit} />);

    const inputDni = screen.getByLabelText(/Número de Documento \*/i);
    const checkDeclaracion = screen.getByRole("checkbox", {
      name: /Declaro bajo juramento/i,
    });
    const checkConsentimiento = screen.getByRole("checkbox", {
      name: /conforme a la Ley N° 29733/i,
    });
    const botonSubmit = screen.getByRole("button", {
      name: /Registrar y Crear Casilla/i,
    });

    // Marcar consentimientos requeridos para habilitar botón de envío
    await user.click(checkDeclaracion);
    await user.click(checkConsentimiento);
    expect(botonSubmit).toBeEnabled();

    // Ingresar DNI inválido (menos de 8 dígitos)
    await user.type(inputDni, "12345");
    await user.tab(); // Blur
    await user.click(botonSubmit);

    // Verificación de mensaje de error inline emitido por el schema Zod
    const mensajeError = await screen.findByText(
      /DNI debe tener exactamente 8 dígitos o CE de 9-12 caracteres alfanuméricos/i,
    );
    expect(mensajeError).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("c) PersonaNaturalForm: un celular que no inicia en 9 muestra error inline", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<PersonaNaturalForm onSubmit={handleSubmit} />);

    const inputCelular = screen.getByLabelText(/Celular \*/i);
    const checkDeclaracion = screen.getByRole("checkbox", {
      name: /Declaro bajo juramento/i,
    });
    const checkConsentimiento = screen.getByRole("checkbox", {
      name: /conforme a la Ley N° 29733/i,
    });
    const botonSubmit = screen.getByRole("button", {
      name: /Registrar y Crear Casilla/i,
    });

    await user.click(checkDeclaracion);
    await user.click(checkConsentimiento);

    // Celular que no empieza en 9 (ej. 812345678)
    await user.type(inputCelular, "812345678");
    await user.tab();
    await user.click(botonSubmit);

    const mensajeError = await screen.findByText(
      /Celular debe tener exactamente 9 dígitos empezando en 9/i,
    );
    expect(mensajeError).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("d) PersonaJuridicaForm: un RUC con dígito verificador incorrecto muestra error inline; uno válido no lo muestra", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<PersonaJuridicaForm onSubmit={handleSubmit} />);

    const inputRuc = screen.getByLabelText(/RUC \*/i);
    const checkDeclaracion = screen.getByRole("checkbox", {
      name: /Declaro bajo juramento/i,
    });
    const checkConsentimiento = screen.getByRole("checkbox", {
      name: /conforme a la Ley N° 29733/i,
    });
    const botonSubmit = screen.getByRole("button", {
      name: /Registrar Empresa y Crear Casilla/i,
    });

    await user.click(checkDeclaracion);
    await user.click(checkConsentimiento);

    // 1. RUC con dígito verificador erróneo según algoritmo Módulo 11 (20131312956)
    await user.type(inputRuc, "20131312956");
    await user.tab();
    await user.click(botonSubmit);

    const errorRuc = await screen.findByText(
      /RUC debe tener 11 dígitos iniciar en 10 o 20 y dígito verifier MODULO 11 SUNAT/i,
    );
    expect(errorRuc).toBeInTheDocument();

    // 2. RUC válido con dígito verificador correcto (20131312955)
    await user.clear(inputRuc);
    await user.type(inputRuc, "20131312955");
    await user.tab();
    await user.click(botonSubmit);

    // El error de RUC ya no debe existir en el DOM
    expect(
      screen.queryByText(
        /RUC debe tener 11 dígitos iniciar en 10 o 20 y dígito verifier MODULO 11 SUNAT/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("e) DeclaracionJuradaCheckbox: el botón de envío está deshabilitado mientras el checkbox esté desmarcado, y se habilita al marcarlo (criterio PEN-04)", async () => {
    const user = userEvent.setup();

    function ComponenteContenedorPrueba() {
      const [declaracionAceptada, setDeclaracionAceptada] = useState(false);

      return (
        <div>
          <DeclaracionJuradaCheckbox
            checked={declaracionAceptada}
            onChange={setDeclaracionAceptada}
            id="test-declaracion"
          />
          <button type="submit" disabled={!declaracionAceptada}>
            Continuar Registro
          </button>
        </div>
      );
    }

    render(<ComponenteContenedorPrueba />);

    const boton = screen.getByRole("button", { name: /Continuar Registro/i });
    const checkbox = screen.getByRole("checkbox");

    // Desmarcado: botón deshabilitado (criterio PEN-04)
    expect(checkbox).not.toBeChecked();
    expect(boton).toBeDisabled();

    // Marcar checkbox: botón se habilita
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(boton).toBeEnabled();

    // Desmarcar: vuelve a deshabilitarse
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(boton).toBeDisabled();
  });

  it("f) ConsentimientoLey29733Modal: abre, es accesible (role=\"dialog\", aria-modal=\"true\"), cierra con Escape y con el botón de cierre", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    // 1. Render abierto
    const { rerender } = render(
      <ConsentimientoLey29733Modal isOpen={true} onClose={handleClose} />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "consentimiento-modal-title");

    // Verificar título y contenido legal
    expect(
      screen.getByText(/Política de Tratamiento de Datos Personales/i),
    ).toBeInTheDocument();

    // Cerrar con tecla Escape
    await user.keyboard("{Escape}");
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Cerrar con botón de cierre (icono ×)
    const botonesCerrar = screen.getAllByRole("button", { name: "Cerrar" });
    expect(botonesCerrar.length).toBeGreaterThanOrEqual(1);
    await user.click(botonesCerrar[0]);
    expect(handleClose).toHaveBeenCalledTimes(2);

    // 2. Render cerrado: no debe existir en el DOM
    rerender(<ConsentimientoLey29733Modal isOpen={false} onClose={handleClose} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("g) Valida correctamente el schema de Consentimiento Ley N° 29733", () => {
    const valido = consentimientoLey29733Schema.safeParse({
      consentimientoLey29733: true,
      version: "1.0",
      fechaAceptacion: "2026-09-16T20:00:00.000Z",
    });
    expect(valido.success).toBe(true);

    const invalido = consentimientoLey29733Schema.safeParse({
      consentimientoLey29733: false,
      version: "1.0",
      fechaAceptacion: "fecha-invalida",
    });
    expect(invalido.success).toBe(false);
  });

  it("h) RegistroCiudadanoPage: completa el flujo exitoso de registro para Persona Natural y muestra la casilla creada", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<RegistroCiudadanoPage />);

    // Llenar campos de Persona Natural
    await user.type(screen.getByLabelText(/Número de Documento \*/i), "74561238");
    await user.type(screen.getByLabelText(/Nombres \*/i), "Sergio");
    await user.type(screen.getByLabelText(/Apellidos \*/i), "Serruche Panduro");
    await user.type(screen.getByLabelText(/Fecha de Nacimiento \*/i), "1998-05-15");
    await user.type(screen.getByLabelText(/Correo Electrónico \*/i), "sergio@example.com");
    await user.type(screen.getByLabelText(/Celular \*/i), "961234567");

    // Seleccionar Ubigeo
    await user.selectOptions(
      screen.getByLabelText(/Seleccionar Provincia de Ucayali/i),
      "2501",
    );
    await user.selectOptions(screen.getByLabelText(/Seleccionar Distrito/i), "250101");

    // Llenar dirección exacta
    await user.type(
      screen.getByLabelText(/Dirección Exacta/i),
      "Jr. Tarapacá N° 645",
    );

    // Aceptar declaraciones
    await user.click(
      screen.getByRole("checkbox", { name: /Declaro bajo juramento/i }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /conforme a la Ley N° 29733/i,
      }),
    );

    const botonSubmit = screen.getByRole("button", {
      name: /Registrar y Crear Casilla/i,
    });
    await user.click(botonSubmit);

    // Mensaje de éxito tras registro
    const mensajeExito = await screen.findByRole(
      "status",
      {},
      { timeout: 3000 },
    );
    expect(mensajeExito).toHaveTextContent(
      "74561238@casilla.iestpsuiza.edu.pe",
    );

    // Aserción de que el payload capturado en el mock de POST contiene domicilio.direccionExacta con ese valor exacto (no vacío)
    expect(consoleSpy).toHaveBeenCalledWith(
      "POST /api/v1/auth/registro-ciudadano",
      expect.objectContaining({
        domicilio: expect.objectContaining({
          direccionExacta: "Jr. Tarapacá N° 645",
        }),
      }),
    );

    const postCall = consoleSpy.mock.calls.find(
      (call) => call[0] === "POST /api/v1/auth/registro-ciudadano",
    );
    expect(postCall).toBeDefined();
    if (!postCall) {
      throw new Error("No se encontró la llamada POST a registro-ciudadano en el mock");
    }
    const payload = postCall[1];
    expect(payload.domicilio.direccionExacta).toBe("Jr. Tarapacá N° 645");
    expect(payload.domicilio.direccionExacta).not.toBe("");

    consoleSpy.mockRestore();

    // Cerrar mensaje de éxito
    const botonCerrarExito = screen.getByLabelText(/Cerrar mensaje de éxito/i);
    await user.click(botonCerrarExito);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("i) RegistroCiudadanoPage: completa el flujo exitoso de registro para Persona Jurídica y muestra la casilla creada", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<RegistroCiudadanoPage />);

    // Cambiar a Persona Jurídica
    await user.click(screen.getByRole("tab", { name: /Persona Jurídica/i }));

    // Llenar campos de Persona Jurídica
    await user.type(screen.getByLabelText(/RUC \*/i), "20131312955");
    await user.type(screen.getByLabelText(/Razón Social \*/i), "Amazonas Soft SAC");
    await user.type(
      screen.getByLabelText(/Número de Documento \*/i),
      "74561238",
    );
    await user.type(screen.getByLabelText(/Nombres \*/i), "Carlos");
    await user.type(screen.getByLabelText(/Apellidos \*/i), "Dávila Ruiz");
    await user.type(screen.getByLabelText(/Cargo \*/i), "Gerente General");
    await user.type(screen.getByLabelText(/Partida SUNARP/i), "11029384");
    await user.type(
      screen.getByLabelText(/Correo Corporativo \*/i),
      "contacto@amazonassoft.pe",
    );
    await user.type(screen.getByLabelText(/Celular de Contacto \*/i), "961234567");

    // Seleccionar Ubigeo
    await user.selectOptions(
      screen.getByLabelText(/Seleccionar Provincia de Ucayali/i),
      "2501",
    );
    await user.selectOptions(screen.getByLabelText(/Seleccionar Distrito/i), "250101");

    // Llenar dirección exacta
    await user.type(
      screen.getByLabelText(/Dirección Exacta/i),
      "Jr. Tarapacá N° 645",
    );

    // Aceptar declaraciones
    await user.click(
      screen.getByRole("checkbox", { name: /Declaro bajo juramento/i }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /conforme a la Ley N° 29733/i,
      }),
    );

    const botonSubmit = screen.getByRole("button", {
      name: /Registrar Empresa y Crear Casilla/i,
    });
    await user.click(botonSubmit);

    // Mensaje de éxito tras registro
    const mensajeExito = await screen.findByRole(
      "status",
      {},
      { timeout: 3000 },
    );
    expect(mensajeExito).toHaveTextContent(
      "20131312955@casilla.iestpsuiza.edu.pe",
    );

    // Aserción de que el payload capturado en el mock de POST contiene domicilio.direccionExacta con ese valor exacto (no vacío)
    expect(consoleSpy).toHaveBeenCalledWith(
      "POST /api/v1/auth/registro-ciudadano",
      expect.objectContaining({
        domicilio: expect.objectContaining({
          direccionExacta: "Jr. Tarapacá N° 645",
        }),
      }),
    );

    const postCall = consoleSpy.mock.calls.find(
      (call) => call[0] === "POST /api/v1/auth/registro-ciudadano",
    );
    expect(postCall).toBeDefined();
    if (!postCall) {
      throw new Error("No se encontró la llamada POST a registro-ciudadano en el mock");
    }
    const payload = postCall[1];
    expect(payload.domicilio.direccionExacta).toBe("Jr. Tarapacá N° 645");
    expect(payload.domicilio.direccionExacta).not.toBe("");

    consoleSpy.mockRestore();
  });
});
