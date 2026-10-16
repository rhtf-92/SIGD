import { beforeEach, describe, expect, it } from "vitest";

import {
  PREFERENCIAS_DEFAULT,
  usePreferenciasStore,
} from "./preferenciasStore";

describe("preferenciasStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePreferenciasStore.setState({ preferencias: { ...PREFERENCIAS_DEFAULT } });
  });

  it("inicia con las preferencias por omisión", () => {
    const { preferencias } = usePreferenciasStore.getState();
    expect(preferencias).toEqual(PREFERENCIAS_DEFAULT);
  });

  it("setPreferencia() actualiza una clave sin alterar las demás", () => {
    usePreferenciasStore.getState().setPreferencia("notifCasillaResumenDiario", true);

    const { preferencias } = usePreferenciasStore.getState();
    expect(preferencias.notifCasillaResumenDiario).toBe(true);
    expect(preferencias.notifCasillaEmail).toBe(PREFERENCIAS_DEFAULT.notifCasillaEmail);
    expect(preferencias.firmaPorDefecto).toBe(PREFERENCIAS_DEFAULT.firmaPorDefecto);
  });

  it("persiste las preferencias en localStorage", () => {
    usePreferenciasStore.getState().setPreferencia("notifCasillaEmail", false);

    const guardado = window.localStorage.getItem("sigd_preferencias");
    expect(guardado).not.toBeNull();
    expect(JSON.parse(guardado as string).notifCasillaEmail).toBe(false);
  });
});