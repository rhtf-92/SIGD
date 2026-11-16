import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ProyectorResolucionesPage from "../../../src/pages/flujos/ProyectorResolucionesPage";
import { useAuthStore } from "../../../src/stores/authStore";
import { apiClient } from "../../../src/api/client";

function DestinoFirma() {
  const location = useLocation();
  return (
    <div data-testid="pagina-firma">
      <p data-testid="ruta-actual">{location.pathname}</p>
      <p data-testid="state-actual">{JSON.stringify(location.state)}</p>
    </div>
  );
}

describe("SIGD — Fase 6: Validación y Auditoría del Pase a Firma Digital (DocuCore ↔ RutaDoc)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    useAuthStore.setState({
      usuario: {
        id: "d8e27c19-6f91-4cf5-992a-360d80dcfb01",
        nombreCompleto: "Lic. María Elena Ramos Morales",
        correo: "secretaria.academica@iestpsuiza.edu.pe",
        rol: "SECRETARIA_ACADEMICA",
        areaId: "a0000000-0000-4000-8000-000000000002",
      },
      isAuthenticated: true,
      accessToken: "mock-jwt-token-sa",
    });
  });

  it("1. Borrador inexistente / no persistido: bloquea el pase a firma y muestra advertencia", async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/proyector"]}>
          <Routes>
            <Route path="/proyector" element={<ProyectorResolucionesPage />} />
            <Route path="/flujo-validez-legal/firma" element={<DestinoFirma />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const botonPasarFirma = screen.getByRole("button", {
      name: /Aprobar y Pasar a Firma Digital/i,
    });
    await user.click(botonPasarFirma);

    // Debe mostrar advertencia y NO navegar a la pasarela de firma
    expect(
      screen.getByText(/Debe guardar y generar la resolución institucional en base de datos antes de proceder/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pagina-firma")).not.toBeInTheDocument();
  });

  it("2. Expediente no identificado: bloquea la transición si no existe ID de expediente válido", async () => {
    const user = userEvent.setup();
    const resolucionUuid = "a1111111-2222-4333-8444-555555555555";

    // Solo se proporciona el id de resolución pero ningún expedienteId válido
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        id: resolucionUuid,
        numero: "RD N.° 0412-2026-DG-IESTP-SUIZA",
        expedienteId: undefined,
        tipoResolucion: "DIRECTORAL_TITULACION",
        visto: "Visto institucional válido.",
        considerandos: ["Considerando normativo."],
        articulos: [{ numero: 1, texto: "Artículo resolutivo." }],
      },
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/proyector?id=${resolucionUuid}`]}>
          <Routes>
            <Route path="/proyector" element={<ProyectorResolucionesPage />} />
            <Route path="/flujo-validez-legal/firma" element={<DestinoFirma />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const botonPasarFirma = screen.getByRole("button", {
      name: /Aprobar y Pasar a Firma Digital/i,
    });
    await user.click(botonPasarFirma);

    expect(
      screen.getByText(/No se identificó un expediente institucional asociado válido/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pagina-firma")).not.toBeInTheDocument();
  });

  it("3. Operador no autorizado (403 Forbidden): muestra error institucional y rechaza navegación", async () => {
    const user = userEvent.setup();
    const resolucionUuid = "a1111111-2222-4333-8444-555555555555";
    const expedienteUuid = "b1111111-2222-4333-8444-555555555555";

    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        id: resolucionUuid,
        numero: "RD N.° 0412-2026-DG-IESTP-SUIZA",
        expedienteId: expedienteUuid,
        tipoResolucion: "DIRECTORAL_TITULACION",
        visto: "Visto institucional.",
        considerandos: ["Considerando legal."],
        articulos: [{ numero: 1, texto: "Artículo resolutivo." }],
      },
    } as any);

    vi.spyOn(apiClient, "post").mockRejectedValue({
      response: {
        status: 403,
        data: {
          code: "FORBIDDEN",
          detail: "El usuario no pertenece al área donde se encuentra el expediente o carece de facultades resolutivas.",
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/proyector?id=${resolucionUuid}&expedienteId=${expedienteUuid}`]}>
          <Routes>
            <Route path="/proyector" element={<ProyectorResolucionesPage />} />
            <Route path="/flujo-validez-legal/firma" element={<DestinoFirma />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const botonPasarFirma = screen.getByRole("button", {
      name: /Aprobar y Pasar a Firma Digital/i,
    });
    await user.click(botonPasarFirma);

    await waitFor(() => {
      expect(
        screen.getByText(/El usuario no pertenece al área donde se encuentra el expediente/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("pagina-firma")).not.toBeInTheDocument();
  });

  it("4. Expediente en estado inválido (409 Conflict): no transiciona si backend rechaza precondición FSM", async () => {
    const user = userEvent.setup();
    const resolucionUuid = "a1111111-2222-4333-8444-555555555555";
    const expedienteUuid = "b1111111-2222-4333-8444-555555555555";

    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        id: resolucionUuid,
        numero: "RD N.° 0412-2026-DG-IESTP-SUIZA",
        expedienteId: expedienteUuid,
        tipoResolucion: "DIRECTORAL_TITULACION",
        visto: "Visto institucional.",
        considerandos: ["Considerando legal."],
        articulos: [{ numero: 1, texto: "Artículo resolutivo." }],
      },
    } as any);

    vi.spyOn(apiClient, "post").mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: "ESTADO_INCOMPATIBLE",
          detail: "El expediente no se encuentra en estado apto para atención resolutiva. Estado actual: REGISTRADO.",
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/proyector?id=${resolucionUuid}&expedienteId=${expedienteUuid}`]}>
          <Routes>
            <Route path="/proyector" element={<ProyectorResolucionesPage />} />
            <Route path="/flujo-validez-legal/firma" element={<DestinoFirma />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const botonPasarFirma = screen.getByRole("button", {
      name: /Aprobar y Pasar a Firma Digital/i,
    });
    await user.click(botonPasarFirma);

    await waitFor(() => {
      expect(
        screen.getByText(/El expediente no se encuentra en estado apto para atención resolutiva/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("pagina-firma")).not.toBeInTheDocument();
  });

  it("5. Documento válido y operador autorizado: flujo permitido, llama a /atender y navega", async () => {
    const user = userEvent.setup();
    const resolucionUuid = "a1111111-2222-4333-8444-555555555555";
    const expedienteUuid = "b1111111-2222-4333-8444-555555555555";

    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        id: resolucionUuid,
        numero: "RD N.° 0412-2026-DG-IESTP-SUIZA",
        expedienteId: expedienteUuid,
        tipoResolucion: "DIRECTORAL_TITULACION",
        visto: "El Expediente N.° EXP-2026-000155.",
        considerandos: ["Que la ley 30512 regula los institutos."],
        articulos: [{ numero: 1, texto: "CONFERIR el título profesional técnico." }],
      },
    } as any);

    const spyPost = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        ok: true,
        mensaje: "Atención resolutiva registrada exitosamente.",
        expediente_id: expedienteUuid,
      },
    } as any);

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/proyector?id=${resolucionUuid}&expedienteId=${expedienteUuid}`]}>
          <Routes>
            <Route path="/proyector" element={<ProyectorResolucionesPage />} />
            <Route path="/flujo-validez-legal/firma" element={<DestinoFirma />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const botonPasarFirma = screen.getByRole("button", {
      name: /Aprobar y Pasar a Firma Digital/i,
    });
    await user.click(botonPasarFirma);

    await waitFor(() => {
      expect(spyPost).toHaveBeenCalledWith(
        `/api/v1/expedientes/${expedienteUuid}/atender`,
        expect.objectContaining({
          resultado_resumen: expect.stringContaining("elevado a Despacho de Dirección General para firma digital"),
        })
      );
    });

    // Invalidación reactiva confirmada
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expediente", expedienteUuid] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["trazabilidad", expedienteUuid] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expedientes"] });

    // Navegación exitosa a la pasarela de firma
    await waitFor(() => {
      expect(screen.getByTestId("pagina-firma")).toBeInTheDocument();
      expect(screen.getByTestId("ruta-actual")).toHaveTextContent("/flujo-validez-legal/firma");
    });
  });

  it("6. Error de red / HTTP 500: no navega y muestra alerta de error institucional", async () => {
    const user = userEvent.setup();
    const resolucionUuid = "a1111111-2222-4333-8444-555555555555";
    const expedienteUuid = "b1111111-2222-4333-8444-555555555555";

    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        id: resolucionUuid,
        numero: "RD N.° 0412-2026-DG-IESTP-SUIZA",
        expedienteId: expedienteUuid,
        tipoResolucion: "DIRECTORAL_TITULACION",
        visto: "Visto.",
        considerandos: ["Considerando."],
        articulos: [{ numero: 1, texto: "Art." }],
      },
    } as any);

    vi.spyOn(apiClient, "post").mockRejectedValue(new Error("Network Error: Conexión con PostgreSQL interrumpida"));

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/proyector?id=${resolucionUuid}&expedienteId=${expedienteUuid}`]}>
          <Routes>
            <Route path="/proyector" element={<ProyectorResolucionesPage />} />
            <Route path="/flujo-validez-legal/firma" element={<DestinoFirma />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const botonPasarFirma = screen.getByRole("button", {
      name: /Aprobar y Pasar a Firma Digital/i,
    });
    await user.click(botonPasarFirma);

    await waitFor(() => {
      expect(
        screen.getByText(/Network Error: Conexión con PostgreSQL interrumpida/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("pagina-firma")).not.toBeInTheDocument();
  });

  it("7. Doble clic y concurrencia: deshabilita el botón durante el envío y previene doble pase", async () => {
    const user = userEvent.setup();
    const resolucionUuid = "a1111111-2222-4333-8444-555555555555";
    const expedienteUuid = "b1111111-2222-4333-8444-555555555555";

    let resolverPromesaPost!: (val: any) => void;
    const promesaPendiente = new Promise((resolve) => {
      resolverPromesaPost = resolve;
    });

    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        id: resolucionUuid,
        numero: "RD N.° 0412-2026-DG-IESTP-SUIZA",
        expedienteId: expedienteUuid,
        tipoResolucion: "DIRECTORAL_TITULACION",
        visto: "Visto.",
        considerandos: ["Considerando."],
        articulos: [{ numero: 1, texto: "Art." }],
      },
    } as any);

    const spyPost = vi.spyOn(apiClient, "post").mockImplementation(() => promesaPendiente as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/proyector?id=${resolucionUuid}&expedienteId=${expedienteUuid}`]}>
          <Routes>
            <Route path="/proyector" element={<ProyectorResolucionesPage />} />
            <Route path="/flujo-validez-legal/firma" element={<DestinoFirma />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const botonPasarFirma = screen.getByRole("button", {
      name: /Aprobar y Pasar a Firma Digital/i,
    });

    // Primer clic
    await user.click(botonPasarFirma);

    // Debe cambiar a estado deshabilitado
    expect(screen.getByRole("button", { name: /Elevando a Firma Digital/i })).toBeDisabled();

    // Intentar segundo clic mientras está deshabilitado
    await user.click(screen.getByRole("button", { name: /Elevando a Firma Digital/i }));

    // Solo se debe haber emitido una única solicitud HTTP
    expect(spyPost).toHaveBeenCalledTimes(1);

    // Resolver la llamada pendiente
    resolverPromesaPost({
      data: { ok: true, mensaje: "Atención registrada." },
    });

    await waitFor(() => {
      expect(screen.getByTestId("pagina-firma")).toBeInTheDocument();
    });
  });
});
