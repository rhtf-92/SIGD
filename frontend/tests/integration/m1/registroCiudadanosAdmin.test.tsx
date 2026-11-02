import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../src/api/client";
import RegistrosCiudadanosPage from "../../../src/pages/administracion/RegistrosCiudadanosPage";

describe("RegistrosCiudadanosPage", () => {
  it("muestra los registros recibidos desde el backend y su paginación", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        total: 2,
        pagina: 1,
        porPagina: 20,
        totalPaginas: 1,
        registros: [
          {
            id_persona: "persona-1",
            tipo: "NATURAL",
            tipo_documento: "DNI",
            ubigeo_distrito_nombre: "Callería",
            ubigeo_provincia_nombre: "Coronel Portillo",
            id_documento: "74561238",
            nombre_completo: "Sergio Serruche Panduro",
            correo: "sergio@example.com",
            telefono: "961234567",
            direccion: "Jr. Masisea 460",
            ubigeo_distrito: "250101",
            referencia_domicilio: "Por la plaza",
            fecha_nacimiento: "1998-05-15",
            razon_social: null,
            representante_legal: null,
            representante_tipo_documento: null,
            representante_documento: null,
            representante_cargo: null,
            partida_registral_sunarp: null,
            declaracion_jurada_aceptada: true,
            consentimiento_ley_29733: true,
            acepta_notificaciones: true,
            creado_en: "2026-10-30T12:00:00.000Z",
          },
          {
            id_persona: "persona-2",
            tipo: "JURIDICA",
            tipo_documento: "RUC",
            ubigeo_distrito_nombre: "Yarinacocha",
            ubigeo_provincia_nombre: "Coronel Portillo",
            id_documento: "20131312955",
            nombre_completo: "Empresa de prueba S.A.C.",
            correo: "empresa@example.com",
            telefono: "961111222",
            direccion: "Av. Principal 123",
            ubigeo_distrito: "250105",
            referencia_domicilio: "Al costado del mercado",
            fecha_nacimiento: null,
            razon_social: "Empresa de prueba S.A.C.",
            representante_legal: "Ana Perez Rojas",
            representante_tipo_documento: "DNI",
            representante_documento: "12345678",
            representante_cargo: "Gerente General",
            partida_registral_sunarp: "12345678",
            declaracion_jurada_aceptada: true,
            consentimiento_ley_29733: true,
            acepta_notificaciones: true,
            creado_en: "2026-10-29T12:00:00.000Z",
          },
        ],
      },
    } as never);

    render(
      <MemoryRouter>
        <RegistrosCiudadanosPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Sergio Serruche Panduro")).toBeInTheDocument();
    expect(screen.getByText("DNI 74561238")).toBeInTheDocument();
    expect(screen.getByText("Jr. Masisea 460")).toBeInTheDocument();
    expect(screen.getByText("Nacimiento: 15/05/1998")).toBeInTheDocument();
    expect(screen.getByText("Callería, Coronel Portillo")).toBeInTheDocument();
    expect(screen.getByText("Referencia: Por la plaza")).toBeInTheDocument();
    expect(screen.getByText("DNI 12345678 · Gerente General")).toBeInTheDocument();
    expect(screen.getByText("Partida SUNARP: 12345678")).toBeInTheDocument();
    expect(screen.getAllByText("Declaración jurada: Aceptada")).toHaveLength(2);
    expect(screen.getByText(/2 registros · Página 1 de 1/)).toBeInTheDocument();
  });

  it("muestra claramente el error cuando la consulta al backend falla", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new Error("Sin conexión"));

    render(
      <MemoryRouter>
        <RegistrosCiudadanosPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", {
      name: "No se pudieron cargar los registros",
    })).toBeInTheDocument();
    expect(
      screen.getByText(/No se pudieron cargar los registros\. Verifica la conexión/i),
    ).toBeInTheDocument();
  });
});
