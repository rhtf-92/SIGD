import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import StepDocumentos from "../../../src/components/tramite/WizardSteps/StepDocumentos";
import { INITIAL_DOCUMENTOS } from "../../../src/types/tramiteWizardState";
import { apiClient } from "../../../src/api/client";

afterEach(() => vi.restoreAllMocks());

const endpoint = process.env.SIGD_LIVE_TUPA_URL;

(endpoint ? it : it.skip)("renderiza exactamente los procedimientos reales publicados por la API", async () => {
  const respuesta = await fetch(endpoint!);
  expect(respuesta.status).toBe(200);
  const catalogo = await respuesta.json() as Array<{
    registroVersionId: string;
    denominacion: string;
    estado: string;
    codigo: string | null;
  }>;
  expect(catalogo).toHaveLength(18);
  expect(catalogo.every((fila) => fila.estado === "APROBADO")).toBe(true);
  vi.spyOn(apiClient, "get").mockResolvedValue({ data: catalogo } as never);

  const { container } = render(<StepDocumentos data={INITIAL_DOCUMENTOS} dispatch={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />);
  await waitFor(() => expect(container.querySelectorAll("select[name='tipoTramiteId'] option")).toHaveLength(20));
  const opciones = Array.from(container.querySelectorAll<HTMLOptionElement>("select[name='tipoTramiteId'] option"));
  expect(opciones[1]).toHaveValue("NO_TUPA");
  expect(opciones[1]).toHaveTextContent("Trámite no TUPA / documentación general");
  for (const [indice, fila] of catalogo.entries()) {
    expect(fila.registroVersionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(opciones[indice + 2].value).toBe(fila.registroVersionId);
    expect(opciones[indice + 2].textContent).toBe(fila.denominacion);
  }
  expect(screen.queryByRole("option", { name: /TUPA-0[1-5]|LIBRE-01/i })).not.toBeInTheDocument();
});
