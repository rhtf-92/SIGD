import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MainLayout from "./MainLayout";

describe("MainLayout", () => {
  it("muestra el asistente en el flujo público de inicio de sesión", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <MainLayout>
          <main>Inicio de sesión</main>
        </MainLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText("Inicio de sesión")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir asistente virtual" }),
    ).toBeInTheDocument();
  });
});
