import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../src/api/client";
import ConsultaPublicaPage, { type DtoConsultaPublica } from "../../../src/pages/tramite/ConsultaPublicaPage";
import { ApiHttpError } from "../../../src/types/api";
import { useAuthStore } from "../../../src/stores/authStore";

const mockRespuestaConsulta: DtoConsultaPublica = {
  cut: "EXP-2026-000104",
  anioFiscal: 2026,
  estadoTramite: "EN_TRAMITE",
  tipoTramite: "TUPA-01 · Emisión de Certificado de Estudios Oficial",
  asunto: "Solicitud de Certificado de Estudios de DSI",
  fechaEnvioReal: "2026-03-15T09:30:00.000Z",
  fechaRadicacionLegal: "2026-03-15T09:30:00.000Z",
  fueraDeHorario: false,
  canalRecepcion: "MESA_VIRTUAL",
  totalFolios: 3,
  administrado: {
    nombreEnmascarado: "Carlos D*** R***",
    documentoEnmascarado: "74***238",
  },
  documentos: [
    {
      nombreArchivo: "solicitud_firmada.pdf",
      contentType: "application/pdf",
      hashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
  ],
  proveidos: [
    {
      numero: "PROV-001-2026-DIR",
      fechaEmision: "2026-03-16T10:00:00.000Z",
      resumen: "Pase a Secretaría Académica para verificación de requisitos",
    },
  ],
  mensajeLegal: "Informacion publica pursuant a la Ley N° 29733.",
};

describe("ConsultaPublicaPage (TramiCore · Consulta de Expediente)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
  });

  it("renderiza el formulario de consulta pública con campo de texto y botón", () => {
    render(
      <MemoryRouter initialEntries={["/consulta"]}>
        <Routes>
          <Route path="/consulta" element={<ConsultaPublicaPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Consulta Pública de Trámites y Expedientes/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/EXP-2026-000104/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Consultar Estado/i })).toBeInTheDocument();
  });

  it("muestra error de validación cuando el usuario intenta buscar sin ingresar un CUT", async () => {
    const getSpy = vi.spyOn(apiClient, "get");
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/consulta"]}>
        <Routes>
          <Route path="/consulta" element={<ConsultaPublicaPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const boton = screen.getByRole("button", { name: /Consultar Estado/i });
    await user.click(boton);

    // No debe llamar a la API
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("consulta el endpoint /api/v1/tramites/consulta-publica/:cut cuando se ingresa CUT por parámetro de ruta", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValueOnce({ data: mockRespuestaConsulta });

    render(
      <MemoryRouter initialEntries={["/consulta/EXP-2026-000104"]}>
        <Routes>
          <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("EXP-2026-000104")).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/v1/tramites/consulta-publica/EXP-2026-000104",
      { headers: {} },
    );

    // Verifica estado y petitorio
    expect(screen.getByText("EN_TRAMITE")).toBeInTheDocument();
    expect(screen.getByText("Solicitud de Certificado de Estudios de DSI")).toBeInTheDocument();
    expect(screen.getByText("TUPA-01 · Emisión de Certificado de Estudios Oficial")).toBeInTheDocument();

    // Verifica protección de datos personales (Ley 29733: enmascarado)
    expect(screen.getByText(/Carlos D\*\*\* R\*\*\*/)).toBeInTheDocument();
    expect(screen.getByText(/74\*\*\*238/)).toBeInTheDocument();

    // Verifica documentos adjuntos con hash SHA-256
    expect(screen.getByText("solicitud_firmada.pdf")).toBeInTheDocument();
    expect(screen.getByText(/SHA-256: e3b0c44298fc1c14/i)).toBeInTheDocument();

    // Verifica proveídos
    expect(screen.getByText("PROV-001-2026-DIR")).toBeInTheDocument();
    expect(screen.getByText("Pase a Secretaría Académica para verificación de requisitos")).toBeInTheDocument();
  });

  it("muestra mensaje de error claro cuando el CUT no existe (404 Not Found)", async () => {
    const error404 = new ApiHttpError({
      type: "https://httpstatuses.com/404",
      title: "Not Found",
      status: 404,
      detail: "No se encontró ningún expediente con ese CUT.",
      instance: "/api/v1/tramites/consulta-publica/EXP-2026-000000",
      code: "NOT_FOUND",
      category: "Business",
      correlationId: "corr-404",
      retryable: false,
    });

    vi.spyOn(apiClient, "get").mockRejectedValueOnce(error404);

    render(
      <MemoryRouter initialEntries={["/consulta/EXP-2026-000000"]}>
        <Routes>
          <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/No se encontró ningún expediente con el código CUT ingresado/i)).toBeInTheDocument();
    });

    expect(screen.queryByText("Expediente Encontrado")).not.toBeInTheDocument();
  });

  it("cuando el backend no expone proveídos internos (protección legal), la sección de proveídos se omite cleanly", async () => {
    const respuestaSinProveidos: DtoConsultaPublica = {
      ...mockRespuestaConsulta,
      proveidos: [],
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({ data: respuestaSinProveidos });

    render(
      <MemoryRouter initialEntries={["/consulta/EXP-2026-000104"]}>
        <Routes>
          <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("EXP-2026-000104")).toBeInTheDocument();
    });

    // La sección de proveídos no debe aparecer en pantalla
    expect(screen.queryByText("Actuaciones y Proveídos Públicos")).not.toBeInTheDocument();
  });

  it("muestra el historial devuelto para la cuenta ciudadana autenticada", async () => {
    useAuthStore.setState({
      accessToken: "token-test",
      isAuthenticated: true,
      usuario: { id: "11111111-2222-3333-4444-555555555555", nombreCompleto: "Titular", correo: "titular@example.invalid", rol: "CIUDADANO", roles: ["CIUDADANO"] },
    });
    vi.spyOn(apiClient, "get").mockImplementation(async (url) => {
      if (String(url) === "/api/v1/tramites/mis-expedientes") return { data: { items: [{
        cut: "EXP-2026-000104", fecha_radicacion: "2026-10-01T12:00:00Z", estado: "REGISTRADO",
        codigo_procedimiento: "SUZ26-035", procedimiento: "Certificado de Estudios", asunto: "Solicitud propia",
      }] } } as never;
      return { data: mockRespuestaConsulta } as never;
    });

    render(
      <MemoryRouter initialEntries={["/consulta"]}>
        <Routes><Route path="/consulta" element={<ConsultaPublicaPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Mis expedientes" })).toBeInTheDocument();
    expect(screen.getByText("EXP-2026-000104")).toBeInTheDocument();
    expect(screen.getByText("Certificado de Estudios")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver seguimiento" })).toHaveAttribute("href", "/consulta/EXP-2026-000104");
  });
  it('descarta respuestas privadas de la cuenta anterior al cambiar de ciudadano', async () => {
    const usuario = { id: '11111111-2222-4333-8444-555555555555', nombreCompleto: 'Titular A', correo: 'a@example.invalid', rol: 'CIUDADANO', roles: ['CIUDADANO'] };
    useAuthStore.setState({ isAuthenticated: true, usuario });
    let resolver: (value: { data: DtoConsultaPublica }) => void = () => {};
    let consultas = 0;
    vi.spyOn(apiClient, 'get').mockImplementation(async url => {
      if (String(url).includes('/mis-expedientes')) return { data: { items: [] } } as never;
      consultas++;
      if (consultas === 1) return new Promise(resolve => { resolver = resolve as typeof resolver; }) as never;
      throw new Error('Rechazo por titularidad');
    });
    render(<MemoryRouter initialEntries={['/consulta/EXP-2026-000104']}><Routes><Route path='/consulta/:cut' element={<ConsultaPublicaPage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(consultas).toBe(1));
    act(() => { useAuthStore.setState({ usuario: { ...usuario, id: '22222222-2222-4222-8222-222222222222', nombreCompleto: 'Titular B' } }); });
    await waitFor(() => expect(consultas).toBe(2));
    await act(async () => { resolver({ data: mockRespuestaConsulta }); });
    expect(screen.queryByText(mockRespuestaConsulta.asunto)).not.toBeInTheDocument();
  });
});
