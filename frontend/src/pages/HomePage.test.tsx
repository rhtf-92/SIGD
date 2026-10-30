import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";

vi.mock("../services/tupaApi", () => ({
  tupaApi: {
    vigente: vi.fn(),
    listarVigente: vi.fn(),
  },
}));

import { tupaApi } from "../services/tupaApi";

function LocationText() {
  const location = useLocation();
  return <output>{location.pathname}{location.search}</output>;
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.mocked(tupaApi.vigente).mockResolvedValue({
      version_id: "version-1",
      codigo: "TUPA-BASE",
      nombre: "TUPA publicado",
      estado: "VIGENTE",
    } as never);
    vi.mocked(tupaApi.listarVigente).mockResolvedValue({
      tramites: [],
      total: 12,
      pagina: 1,
      porPagina: 20,
      rubros: [],
    });
  });

  it("envía la consulta a TUPA con el parámetro q codificado", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomePage />} path="/" />
          <Route element={<LocationText />} path="/tupa" />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Busca un trámite del TUPA"), {
      target: { value: "certificado de estudios" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByRole("status")).toHaveTextContent("/tupa?q=certificado%20de%20estudios");
  });

  it("muestra cifras provenientes de la API y solo los accesos públicos definidos", async () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByText("TUPA-BASE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mesa de partes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Consulta y seguimiento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Registro de usuarios externos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Iniciar sesión / Administración" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Mesa de Partes Virtual/ })[0]).toHaveAttribute("href", "/tramite/mesa-partes-virtual");
    expect(screen.getAllByRole("link", { name: /Consultar expediente/ })[0]).toHaveAttribute("href", "/consulta");
  });
});
