import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../src/api/client";
import {
  esUuidValido,
  ORGANIGRAMA_MATERIALIZED_PATH,
  useTablasMaestras,
} from "../../../src/hooks/useTablasMaestras";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("esUuidValido", () => {
  it("valida correctamente UUIDs v4 canónicos en mayúsculas y minúsculas", () => {
    expect(esUuidValido("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(true);
    expect(esUuidValido("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11")).toBe(true);
  });

  it("rechaza identificadores numéricos, vacíos o cadenas no UUID", () => {
    expect(esUuidValido(123)).toBe(false);
    expect(esUuidValido("")).toBe(false);
    expect(esUuidValido("   ")).toBe(false);
    expect(esUuidValido("sim-1")).toBe(false);
    expect(esUuidValido("ARE-001")).toBe(false);
    expect(esUuidValido(null)).toBe(false);
    expect(esUuidValido(undefined)).toBe(false);
  });
});

describe("useTablasMaestras - compatibilidad de UUID y catálogo institucional", () => {
  it("los datos de simulación iniciales tienen IDs string y esReal: false", () => {
    ORGANIGRAMA_MATERIALIZED_PATH.forEach((item) => {
      expect(typeof item.id).toBe("string");
      expect(item.id.startsWith("sim-")).toBe(true);
      expect(item.esReal).toBe(false);
    });
  });

  it("preserva intactos los UUIDs reales devueltos por el backend sin convertirlos a números ni alterarlos", async () => {
    const mockUuid1 = "11111111-1111-4111-8111-111111111111";
    const mockUuid2 = "22222222-2222-4222-8222-222222222222";

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: [
        {
          id: mockUuid1,
          codigo: "DIR-GEN",
          nombre: "Dirección General",
          path: "01",
          estado: true,
          children: [
            {
              id: mockUuid2,
              codigo: "SEC-ACA",
              nombre: "Secretaría Académica",
              path: "01.01",
              estado: true,
              children: [],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useTablasMaestras());

    await waitFor(() => {
      expect(result.current.areasOrganicas.length).toBe(2);
    });

    // Validar nodo raíz
    expect(result.current.areasOrganicas[0].id).toBe(mockUuid1);
    expect(result.current.areasOrganicas[0].codigo).toBe("DIR-GEN");
    expect(result.current.areasOrganicas[0].esReal).toBe(true);
    expect(typeof result.current.areasOrganicas[0].id).toBe("string");

    // Validar nodo hijo aplanado
    expect(result.current.areasOrganicas[1].id).toBe(mockUuid2);
    expect(result.current.areasOrganicas[1].codigo).toBe("SEC-ACA");
    expect(result.current.areasOrganicas[1].esReal).toBe(true);
    expect(typeof result.current.areasOrganicas[1].id).toBe("string");

    // areasReales contiene ambos nodos con UUID verificado
    expect(result.current.areasReales.length).toBe(2);
    expect(result.current.areasReales[0].id).toBe(mockUuid1);
    expect(result.current.areasReales[1].id).toBe(mockUuid2);
  });

  it("gestiona catálogo vacío ([]) sin inyectar identificadores ficticios ni mocks", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: [],
    });

    const { result } = renderHook(() => useTablasMaestras());

    await waitFor(() => {
      expect(result.current.areasOrganicas).toEqual([]);
    });

    expect(result.current.areasOrganicas.length).toBe(0);
    expect(result.current.areasReales.length).toBe(0);
  });

  it("gestiona catálogo vacío cuando la respuesta viene en formato { data: [] }", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { data: [] },
    });

    const { result } = renderHook(() => useTablasMaestras());

    await waitFor(() => {
      expect(result.current.areasOrganicas).toEqual([]);
    });

    expect(result.current.areasOrganicas.length).toBe(0);
    expect(result.current.areasReales.length).toBe(0);
  });

  it("en caso de error de red o fallo de API, conserva el fallback marcado como esReal: false y expone error", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() => useTablasMaestras());

    await waitFor(() => {
      expect(result.current.errorAreas).toBe("Network Error");
    });

    // Se mantienen los datos simulados pero ninguno califica como esReal
    expect(result.current.areasOrganicas.length).toBe(ORGANIGRAMA_MATERIALIZED_PATH.length);
    expect(result.current.areasReales.length).toBe(0);
    result.current.areasOrganicas.forEach((area) => {
      expect(area.esReal).toBe(false);
    });
  });
});
