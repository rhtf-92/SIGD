import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TupaVersionComparator from "./TupaVersionComparator";
import type { TupaVersion } from "../services/tupaApi";

vi.mock("../services/tupaApi", () => ({
  tupaApi: { tramitesVersion: vi.fn() },
  mensajeError: vi.fn(() => "No se pudo cargar la comparación."),
}));

import { tupaApi } from "../services/tupaApi";

function tramite(codigo: string, plazo: string) {
  return {
    tramite_version_id: codigo,
    codigo,
    denominacion: `Trámite ${codigo}`,
    rubro: "Rubro",
    descripcion: null,
    derecho_monto: 10,
    derecho_porcentaje_uit: 1,
    derecho_texto: null,
    cuenta_pago: null,
    plazo_texto: plazo,
    plazo_dias_habiles: null,
    calificacion: "Evaluación",
    silencio_administrativo: "No aplica",
    unidad_recibe: null,
    autoridad_resuelve: "Dirección",
    recursos: null,
    base_legal: null,
    observaciones: null,
    requisitos: [],
  };
}

const versiones = [
  { version_id: "old", codigo: "TUPA-2024", nombre: "Anterior", fecha_vigencia: null, uit_vigente: null, estado: "SUPERSEDIDA", version_anterior_id: null, creado_en: "" },
  { version_id: "new", codigo: "TUPA-2026", nombre: "Nueva", fecha_vigencia: null, uit_vigente: null, estado: "VIGENTE", version_anterior_id: null, creado_en: "" },
] satisfies TupaVersion[];

describe("TupaVersionComparator", () => {
  beforeEach(() => {
    vi.mocked(tupaApi.tramitesVersion).mockImplementation(async (_token, id) => (
      id === "old"
        ? [tramite("A", "5 días"), tramite("B", "10 días")]
        : [tramite("A", "8 días"), tramite("C", "15 días")]
    ));
  });

  it("carga dos versiones y presenta agregados, retirados y cambios con valores anteriores y nuevos", async () => {
    const user = userEvent.setup();
    render(<TupaVersionComparator token="session" versiones={versiones} />);

    await user.selectOptions(screen.getByLabelText("Versión anterior"), "old");
    await user.selectOptions(screen.getByLabelText("Versión nueva"), "new");

    expect(await screen.findByText("Nuevo")).toBeInTheDocument();
    expect(screen.getByText("Retirado")).toBeInTheDocument();
    expect(screen.getByText("Modificado")).toBeInTheDocument();
    expect(screen.getByText("Antes: 5 días")).toBeInTheDocument();
    expect(screen.getByText("Después: 8 días")).toBeInTheDocument();
    await waitFor(() => expect(tupaApi.tramitesVersion).toHaveBeenCalledTimes(2));
  });
});
