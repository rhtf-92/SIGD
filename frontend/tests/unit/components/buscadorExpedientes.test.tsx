/**
 * Suite ENT-M04-01 · Buscador de expedientes académicos para revisión.
 */
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BuscadorExpedientes from "../../components/flujos/BuscadorExpedientes";
import {
  EXPEDIENTES_DEMO,
  useWorkflowAcademico,
} from "../../hooks/useWorkflowAcademico";

describe("Buscador de expedientes — ENT-M04-01", () => {
  it("lista la bandeja demo y filtra por CUT", async () => {
    const user = userEvent.setup();
    const onSeleccionar = vi.fn();
    render(
      <BuscadorExpedientes
        expedientes={EXPEDIENTES_DEMO}
        expedienteActualId={412}
        onSeleccionar={onSeleccionar}
      />,
    );

    expect(screen.getByText(/EXP-2026-000412/)).toBeInTheDocument();
    expect(screen.getByText(/EXP-2026-000413/)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/Buscar expediente por número/i),
      "000413",
    );
    expect(screen.queryByText(/EXP-2026-000412/)).not.toBeInTheDocument();
    expect(screen.getByText(/EXP-2026-000413/)).toBeInTheDocument();
  });

  it("muestra estado vacío sin resultados", async () => {
    const user = userEvent.setup();
    render(
      <BuscadorExpedientes
        expedientes={EXPEDIENTES_DEMO}
        expedienteActualId={412}
        onSeleccionar={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/Buscar expediente/i), "ZZZ-999");
    expect(screen.getByRole("status")).toHaveTextContent(/Sin resultados/);
  });

  it("cargarExpediente + tomarEnRevision: el expediente 413 pasa a EN_REVISION", () => {
    const { result } = renderHook(() => useWorkflowAcademico());
    expect(result.current.workflow.idTramite).toBe(412);

    act(() => {
      result.current.cargarExpediente(413);
    });
    expect(result.current.workflow.idTramite).toBe(413);
    expect(result.current.workflow.cut).toBe("EXP-2026-000413");
    expect(result.current.puedeTomar).toBe(true);

    act(() => {
      result.current.tomarEnRevision();
    });
    expect(result.current.estado).toBe("EN_REVISION");
  });

  it("cargarExpediente inexistente reporta error FSM sin romper el visualizador", () => {
    const { result } = renderHook(() => useWorkflowAcademico());
    act(() => {
      result.current.cargarExpediente(999999);
    });
    expect(result.current.errorFsm).toMatch(/no encontrado/);
    expect(result.current.workflow.idTramite).toBe(412);
  });
});
