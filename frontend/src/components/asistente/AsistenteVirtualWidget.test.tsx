/**
 * Pruebas del Widget del Asistente Virtual Institucional (AsistenteCore)
 * Cubre: renderizado del botón, apertura del panel, bienvenida, envío de una
 * consulta, recepción de la respuesta y manejo de errores.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AsistenteVirtualWidget from "./AsistenteVirtualWidget";
import { apiClient } from "../../api/client";

describe("AsistenteCore - Widget del Asistente Virtual", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza el botón flotante y abre el panel con la bienvenida", async () => {
    const user = userEvent.setup();
    render(<AsistenteVirtualWidget />);

    const boton = screen.getByRole("button", { name: "Abrir asistente virtual" });
    expect(boton).toBeInTheDocument();

    await user.click(boton);

    expect(
      screen.getByRole("button", { name: "Cerrar asistente virtual" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Soy el asistente virtual del SIGD/i)).toBeInTheDocument();
  });

  it("envía una consulta y muestra la respuesta del servidor", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        respuesta: "El plazo máximo es de 30 días hábiles.",
        intencion: "plazo_sla",
        confianza: 0.9,
        fuentes: ["TUO de la Ley N° 27444 (LPAG)"],
        sugerencias: ["¿Cómo radico un trámite?"],
        enlaces: [
          { etiqueta: "Radicar en Mesa de Partes Virtual", ruta: "/tramite" },
        ],
        motor: "faq",
        correlationId: "corr-1",
      },
    } as never);

    const user = userEvent.setup();
    render(<AsistenteVirtualWidget />);
    await user.click(screen.getByRole("button", { name: "Abrir asistente virtual" }));

    const input = screen.getByLabelText("Escribe tu consulta al asistente");
    await user.type(input, "¿Cuánto tarda mi trámite?");
    await user.click(screen.getByRole("button", { name: "Enviar consulta" }));

    await waitFor(() => {
      expect(screen.getByText("El plazo máximo es de 30 días hábiles.")).toBeInTheDocument();
    });
    expect(screen.getByText("¿Cuánto tarda mi trámite?")).toBeInTheDocument();
    expect(screen.queryByText(/Fuente:/i)).not.toBeInTheDocument();
    const enlace = screen.getByRole("link", {
      name: /Radicar en Mesa de Partes Virtual/i,
    });
    expect(enlace).toHaveAttribute("href", "/tramite");
  });

  it("muestra un mensaje de error cuando el servicio no responde", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue(new Error("red no disponible"));

    const user = userEvent.setup();
    render(<AsistenteVirtualWidget />);
    await user.click(screen.getByRole("button", { name: "Abrir asistente virtual" }));

    const input = screen.getByLabelText("Escribe tu consulta al asistente");
    await user.type(input, "consulta de prueba");
    await user.click(screen.getByRole("button", { name: "Enviar consulta" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/No pude conectarme/i);
    });
  });

  it("permite reiniciar la conversación", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        respuesta: "Respuesta de prueba",
        intencion: "saludo",
        confianza: 1,
        fuentes: [],
        sugerencias: [],
        motor: "faq",
        correlationId: "corr-2",
      },
    } as never);

    const user = userEvent.setup();
    render(<AsistenteVirtualWidget />);
    await user.click(screen.getByRole("button", { name: "Abrir asistente virtual" }));

    const input = screen.getByLabelText("Escribe tu consulta al asistente");
    await user.type(input, "hola");
    await user.click(screen.getByRole("button", { name: "Enviar consulta" }));
    await waitFor(() => {
      expect(screen.getByText("Respuesta de prueba")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Reiniciar conversación" }));
    expect(screen.getByText(/Soy el asistente virtual del SIGD/i)).toBeInTheDocument();
    expect(screen.queryByText("Respuesta de prueba")).not.toBeInTheDocument();
  });
});
