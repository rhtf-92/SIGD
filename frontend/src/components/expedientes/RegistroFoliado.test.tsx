import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import RegistroFoliado from "./RegistroFoliado";
it("bloquea solapamientos, ofrece el rango correcto y confirma solo datos válidos", async () => {
  const user = userEvent.setup();
  const guardar = vi.fn().mockResolvedValue(undefined);
  render(<RegistroFoliado ultimoFolio={10} onConfirmar={guardar} />);
  const paginas = screen.getByLabelText("Cantidad de páginas");
  await user.clear(paginas); await user.type(paginas, "5");
  const inicio = screen.getByLabelText("Folio inicial");
  await user.clear(inicio); await user.type(inicio, "1");
  expect(screen.getByRole("button", { name: "Confirmar documento" })).toBeDisabled();
  expect(guardar).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Revisar inconsistencia" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("F. 11 a F. 15");
  await user.click(screen.getByRole("button", { name: "Aplicar rango sugerido" }));
  expect(inicio).toHaveValue(11);
  await user.click(screen.getByRole("button", { name: "Confirmar documento" }));
  expect(guardar).toHaveBeenCalledWith({ inicio: 11, fin: 15 });
});
it("revalida si el último folio cambia antes de confirmar", () => {
  const guardar = vi.fn();
  const { rerender } = render(<RegistroFoliado ultimoFolio={10} onConfirmar={guardar} />);
  rerender(<RegistroFoliado ultimoFolio={12} onConfirmar={guardar} />);
  expect(screen.getByRole("button", { name: "Confirmar documento" })).toBeDisabled();
});
