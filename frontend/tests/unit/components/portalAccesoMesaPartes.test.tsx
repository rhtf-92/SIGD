import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortalSigdSuiza from "../../../src/components/portal/PortalSigdSuiza";

function renderPortal() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <PortalSigdSuiza />
      <Routes>
        <Route
          path="/tramite/mesa-partes-virtual"
          element={<div>VISTA INTERNA MESA DE PARTES</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Acceso a Mesa de Partes Virtual desde el portal", () => {
  it("no entra directo: abre el modal de autenticación al pulsar Ingresar", () => {
    renderPortal();

    fireEvent.click(
      screen.getByRole("button", { name: /Mesa de Partes Virtual/ }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByText("VISTA INTERNA MESA DE PARTES"),
    ).toBeNull();
  });

  it("valida usuario y contraseña antes de conceder el acceso", () => {
    renderPortal();

    fireEvent.click(
      screen.getByRole("button", { name: /Mesa de Partes Virtual/ }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Ingrese su usuario institucional.");
    expect(
      screen.queryByText("VISTA INTERNA MESA DE PARTES"),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText(/usuario institucional/i), {
      target: { value: "admin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ingrese su contraseña.",
    );
    expect(
      screen.queryByText("VISTA INTERNA MESA DE PARTES"),
    ).toBeNull();
  });

  it("concede el acceso y navega a la vista interna con credenciales válidas", () => {
    renderPortal();

    fireEvent.click(
      screen.getByRole("button", { name: /Mesa de Partes Virtual/ }),
    );

    fireEvent.change(screen.getByLabelText(/usuario institucional/i), {
      target: { value: "administrador" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "secreta123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByText("VISTA INTERNA MESA DE PARTES"),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("sigd_rol")).toBe("MESA_PARTES");
  });

  it("permite cerrar el modal sin conceder acceso", () => {
    renderPortal();

    fireEvent.click(
      screen.getByRole("button", { name: /Mesa de Partes Virtual/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Cancelar" }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByText("VISTA INTERNA MESA DE PARTES"),
    ).toBeNull();
  });
});
