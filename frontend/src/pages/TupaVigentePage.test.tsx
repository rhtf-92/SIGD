import "@testing-library/jest-dom/vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TupaVigentePage from "./TupaVigentePage";

vi.mock("../services/tupaApi", () => ({
  tupaApi: {
    vigente: vi.fn().mockResolvedValue({ version_id: "v1", codigo: "TUPA-1", nombre: "Versión actual" }),
    listarVigente: vi.fn().mockResolvedValue({ tramites: [], total: 0, pagina: 1, porPagina: 20, rubros: [] }),
    detalle: vi.fn(),
  },
  mensajeError: vi.fn(() => "Error"),
}));

import { tupaApi } from "../services/tupaApi";

describe("TupaVigentePage", () => {
  it("precarga la consulta q de la URL en la búsqueda del servicio", async () => {
    render(<MemoryRouter initialEntries={["/tupa?q=certificado"]}><TupaVigentePage /></MemoryRouter>);
    await waitFor(() => expect(tupaApi.listarVigente).toHaveBeenCalledWith({
      q: "certificado",
      rubro: "",
      pagina: 1,
    }));
  });
});
