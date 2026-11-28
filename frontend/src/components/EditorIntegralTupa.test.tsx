import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditorIntegralTupa from "./EditorIntegralTupa";
import type { TupaTramite, TupaVersion } from "../services/tupaApi";

vi.mock("../services/tupaApi", () => ({
  tupaApi: {
    actualizarTramite: vi.fn(),
    agregarRequisito: vi.fn(),
    actualizarRequisito: vi.fn(),
    eliminarRequisito: vi.fn(),
    actualizarVersion: vi.fn(),
    activarVersion: vi.fn(),
  },
  mensajeError: vi.fn(() => "Error de prueba"),
}));

import { tupaApi } from "../services/tupaApi";

const version: TupaVersion = {
  version_id: "version-1",
  codigo: "TUPA-2026-v2",
  nombre: "TUPA Institucional 2026",
  fecha_vigencia: "2026-01-01",
  uit_vigente: 5500,
  resolucion_numero: null,
  resolucion_fecha: null,
  estado: "BORRADOR",
  version_anterior_id: null,
  creado_en: "2026-01-01T00:00:00.000Z",
};

function crearTramite(): TupaTramite {
  return {
    tramite_version_id: "tramite-1",
    codigo: "TRA-001",
    denominacion: "Constancia de egresado",
    rubro: "Secretaría Académica",
    descripcion: "Emite constancia",
    derecho_monto: 100,
    derecho_porcentaje_uit: 1.82,
    derecho_texto: "S/ 100.00",
    cuenta_pago: "Caja",
    plazo_texto: "3 días hábiles",
    plazo_dias_habiles: 3,
    calificacion: "EVALUACION_PREVIA",
    silencio_administrativo: "NEGATIVO",
    unidad_recibe: "Mesa de Partes",
    autoridad_resuelve: "Dirección General",
    recursos: "Reconsideración",
    base_legal: "Ley 30512",
    observaciones: "Sin observaciones",
    requisitos: [{ requisito_id: "req-1", orden: 1, texto: "DNI vigente" }],
  };
}

describe("EditorIntegralTupa", () => {
  const onGuardado = vi.fn(async () => {});
  const onActivarVersion = vi.fn(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderEditor(activarCallback?: (v: TupaVersion) => Promise<void>) {
    return render(
      <EditorIntegralTupa
        version={version}
        tramites={[crearTramite()]}
        uitVersion={5500}
        token="token"
        onCerrar={() => {}}
        onGuardado={onGuardado}
        onError={() => {}}
        onActivarVersion={activarCallback ?? onActivarVersion}
      />
    );
  }

  it("edita los metadatos de la versión (título, código, UIT, resolución) y los guarda", async () => {
    const user = userEvent.setup();
    renderEditor();

    const tituloInput = screen.getByLabelText(/Título Oficial de la Versión del TUPA \*/i);
    await user.clear(tituloInput);
    await user.type(tituloInput, "TUPA Institucional Modificado 2026");

    const resolucionInput = screen.getByLabelText(/N° de Resolución/i);
    await user.clear(resolucionInput);
    await user.type(resolucionInput, "R.D. N° 099-2026");

    const botonGuardarVersion = screen.getByRole("button", {
      name: /Guardar Parámetros de Versión/i,
    });
    await user.click(botonGuardarVersion);

    expect(tupaApi.actualizarVersion).toHaveBeenCalledTimes(1);
    expect(tupaApi.actualizarVersion).toHaveBeenCalledWith(
      "token",
      "version-1",
      expect.objectContaining({
        nombre: "TUPA Institucional Modificado 2026",
        codigo: "TUPA-2026-v2",
        uit_vigente: 5500,
        resolucion_numero: "R.D. N° 099-2026",
      })
    );
    expect(onGuardado).toHaveBeenCalled();
  });

  it("edita todos los parámetros visibles y guarda el trámite con los 17 campos", async () => {
    const user = userEvent.setup();
    renderEditor();

    const denominacion = screen.getByLabelText(/Denominación \*/i);
    await user.clear(denominacion);
    await user.type(denominacion, "Constancia actualizada");

    const recursos = screen.getByLabelText(/Recursos/i);
    await user.clear(recursos);
    await user.type(recursos, "Apelación");

    await user.click(screen.getByRole("button", { name: "Guardar este trámite" }));

    expect(tupaApi.actualizarTramite).toHaveBeenCalledTimes(1);
    expect(tupaApi.actualizarTramite).toHaveBeenCalledWith(
      "token",
      "version-1",
      "tramite-1",
      expect.objectContaining({
        denominacion: "Constancia actualizada",
        recursos: "Apelación",
        observaciones: "Sin observaciones",
        calificacion: "EVALUACION_PREVIA",
        plazo_dias_habiles: 3,
        derecho_porcentaje_uit: 1.82,
      })
    );
    expect(onGuardado).toHaveBeenCalled();
  });

  it("permite guardar todos los cambios pendientes de forma secuencial", async () => {
    const user = userEvent.setup();
    renderEditor();

    const rubro = screen.getByLabelText(/Rubro \*/i);
    await user.clear(rubro);
    await user.type(rubro, "Tesorería");

    await user.click(screen.getByRole("button", { name: /Guardar todos/ }));

    expect(tupaApi.actualizarTramite).toHaveBeenCalledTimes(1);
    expect(tupaApi.actualizarTramite).toHaveBeenCalledWith(
      "token",
      "version-1",
      "tramite-1",
      expect.objectContaining({ rubro: "Tesorería" })
    );
  });

  it("guarda el texto de un requisito al perder el foco", async () => {
    const user = userEvent.setup();
    renderEditor();

    const requisito = screen.getByDisplayValue("DNI vigente");
    await user.clear(requisito);
    await user.type(requisito, "DNI vigente y copia");
    await user.tab();

    expect(tupaApi.actualizarRequisito).toHaveBeenCalledWith(
      "token",
      "version-1",
      "tramite-1",
      "req-1",
      { texto: "DNI vigente y copia" }
    );
  });

  it("permite conmutar y publicar como vigente directamente con confirmación", async () => {
    const user = userEvent.setup();
    const mockConfirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderEditor();

    const botonActivar = screen.getByRole("button", {
      name: /Publicar y Activar como Vigente/i,
    });
    await user.click(botonActivar);

    expect(mockConfirm).toHaveBeenCalled();
    expect(onActivarVersion).toHaveBeenCalledTimes(1);
    expect(onActivarVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: "TUPA-2026-v2",
        nombre: "TUPA Institucional 2026",
      })
    );

    mockConfirm.mockRestore();
  });
});
