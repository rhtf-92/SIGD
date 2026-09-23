import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { UbigeoSelector } from "../../components/common/UbigeoSelector";
import { PROVINCIAS_UCAYALI } from "../../data/ucayali";

describe("Suite de Pruebas de Renderizado de UbigeoSelector (ENT-M01-02 / ENT-M01-05)", () => {
  it("Render de UbigeoSelector; al recorrer las 4 provincias, el total de <option> de distrito emitidas debe ser exactamente 17", async () => {
    const user = userEvent.setup();
    render(<UbigeoSelector />);

    const selectProvincia = screen.getByLabelText(
      /Seleccionar Provincia de Ucayali/i,
    );
    const selectDistrito = screen.getByLabelText(/Seleccionar Distrito/i);

    const distritosVistos = new Set<string>();
    let conteoTotalOpcionesDistrito = 0;

    for (const provincia of PROVINCIAS_UCAYALI) {
      await user.selectOptions(selectProvincia, provincia.id);

      // Obtener todas las opciones de distrito emitidas para esta provincia (excluyendo el placeholder con value="")
      const opciones = Array.from(
        selectDistrito.querySelectorAll("option"),
      ).filter((opt) => opt.value !== "");

      conteoTotalOpcionesDistrito += opciones.length;
      opciones.forEach((opt) => distritosVistos.add(opt.value));
    }

    // El criterio 3 del DoD exige: "al recorrer las 4 provincias, el total de <option> de distrito emitidas debe ser exactamente 17"
    expect(conteoTotalOpcionesDistrito).toBe(17);
    expect(distritosVistos.size).toBe(17);
  });

  it('Al cambiar de provincia, el distrito seleccionado se resetea a ""', async () => {
    const user = userEvent.setup();
    render(<UbigeoSelector />);

    const selectProvincia = screen.getByLabelText(
      /Seleccionar Provincia de Ucayali/i,
    );
    const selectDistrito = screen.getByLabelText(/Seleccionar Distrito/i);

    // 1. Seleccionar provincia Coronel Portillo (2501)
    await user.selectOptions(selectProvincia, "2501");
    expect(selectProvincia).toHaveValue("2501");

    // 2. Seleccionar distrito dentro de Coronel Portillo (Callería: 250101)
    await user.selectOptions(selectDistrito, "250101");
    expect(selectDistrito).toHaveValue("250101");

    // 3. Cambiar de provincia a Atalaya (2502)
    await user.selectOptions(selectProvincia, "2502");
    expect(selectProvincia).toHaveValue("2502");

    // 4. Verificar que el distrito seleccionado se resetea a ""
    expect(selectDistrito).toHaveValue("");
  });

  it("Al hacer clic en el botón 'Limpiar Selección' (aria-label='Restablecer selección de Ubigeo'), la provincia y el distrito seleccionados vuelven a estado vacío en el DOM.", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <UbigeoSelector
        initialProvinciaId="2501"
        initialDistritoId="250101"
        onChange={handleChange}
      />,
    );

    const selectProvincia = screen.getByLabelText(
      /Seleccionar Provincia de Ucayali/i,
    );
    const selectDistrito = screen.getByLabelText(/Seleccionar Distrito/i);

    expect(selectProvincia).toHaveValue("2501");
    expect(selectDistrito).toHaveValue("250101");

    const botonLimpiar = screen.getByRole("button", {
      name: "Restablecer selección de Ubigeo",
    });
    await user.click(botonLimpiar);

    expect(selectProvincia).toHaveValue("");
    expect(selectDistrito).toHaveValue("");
    expect(handleChange).toHaveBeenCalledWith(
      "250000",
      expect.objectContaining({
        provincia: null,
        distrito: null,
        ubigeoCod: "250000",
      }),
    );
  });
});
