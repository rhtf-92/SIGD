import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ConsentimientoLey29733Modal,
  registrarConConsentimiento,
} from "../../../src/components/auth/ConsentimientoLey29733Modal";

describe("ConsentimientoLey29733Modal", () => {
  it("rechaza el registro cuando consentimiento_ley_29733 no es true", async () => {
    const registrar = vi.fn();

    await expect(
      registrarConConsentimiento(
        { consentimiento_ley_29733: false },
        registrar,
      ),
    ).rejects.toThrow(/consentimiento informado/i);
    expect(registrar).not.toHaveBeenCalled();
  });

  it("no llama el registro cuando el consentimiento es false", async () => {
    const registrar = vi.fn();

    await expect(
      registrarConConsentimiento(
        { consentimiento_ley_29733: false },
        registrar,
      ),
    ).rejects.toThrow();
    expect(registrar).not.toHaveBeenCalled();
  });

  it("registra si consentimiento_ley_29733 es true", async () => {
    const registrar = vi.fn().mockResolvedValue("registrado");

    await expect(
      registrarConConsentimiento(
        { consentimiento_ley_29733: true },
        registrar,
      ),
    ).resolves.toBe("registrado");
    expect(registrar).toHaveBeenCalledOnce();
  });

  it("mantiene bloqueado el botón sin marcar el checkbox", () => {
    render(
      <ConsentimientoLey29733Modal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /aceptar y continuar/i }),
    ).toBeDisabled();
  });

  it("habilita el botón al marcar el checkbox", async () => {
    const user = userEvent.setup();
    render(
      <ConsentimientoLey29733Modal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("checkbox"));

    expect(
      screen.getByRole("button", { name: /aceptar y continuar/i }),
    ).toBeEnabled();
  });

  it("envía el valor true y cierra luego de aceptar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(
      <ConsentimientoLey29733Modal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /aceptar y continuar/i }));

    expect(onSubmit).toHaveBeenCalledWith({ consentimiento_ley_29733: true });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
