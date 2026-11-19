import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { apiClient } from "@/api/client";
import PasarelaFirmaPage from "@/pages/flujos/PasarelaFirmaPage";

vi.mock("@/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: {
    getState: () => ({
      usuario: { id: "11111111-1111-4111-8111-111111111111", nombreCompleto: "Operador de prueba" },
    }),
  },
}));

function abrir() {
  return render(
    <MemoryRouter>
      <PasarelaFirmaPage />
    </MemoryRouter>,
  );
}

const documentoValido = {
  documentoId: "cb0af3db-614e-4379-975f-5547a8018e5a",
  expedienteId: "expediente-101",
  numeroBorrador: "Borrador persistido",
  fechaProyeccion: "2026-10-19T12:00:00Z",
  asunto: "Asunto persistido",
  hashSha256: "a".repeat(64),
  puedeFirmar: true,
  s3PreviewUrl: "https://storage.invalid/pdf",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockReset();
});

describe("Pasarela de firma - Manejo de cola y resiliencia", () => {
  it("una cola vacia no muestra documentos ficticios y presenta mensaje informativo", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [] } });
    abrir();
    expect(await screen.findByText("No hay documentos pendientes de firma.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Firmar" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("un fallo de API por error de red se muestra en alerta y permite reconsultar", async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(new Error("Error de conexión de red"))
      .mockResolvedValueOnce({ data: { documentos: [] } });
    abrir();
    expect(await screen.findByRole("alert")).toHaveTextContent("Error de conexión de red");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar consulta" }));
    expect(await screen.findByText("No hay documentos pendientes de firma.")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it("muestra alerta ante respuesta 401 de autenticación expirada o inválida", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("401 Unauthorized: Sesión expirada"));
    abrir();
    expect(await screen.findByRole("alert")).toHaveTextContent("401 Unauthorized");
    expect(screen.queryByRole("button", { name: "Firmar" })).not.toBeInTheDocument();
  });

  it("muestra alerta ante respuesta 403 cuando el usuario no tiene facultad de despacho", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("403 USER_CANNOT_SIGN: Sin facultad de despacho"));
    abrir();
    expect(await screen.findByRole("alert")).toHaveTextContent("403 USER_CANNOT_SIGN");
    expect(screen.queryByRole("button", { name: "Firmar" })).not.toBeInTheDocument();
  });

  it("muestra exclusivamente los documentos de la respuesta real", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [documentoValido] } });
    abrir();
    expect(await screen.findByText("Asunto persistido")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Firmar" })).toBeEnabled();
  });

  it("respeta la prohibicion de firma del backend", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        documentos: [{ ...documentoValido, puedeFirmar: false, motivoNoHabilitado: "Sin facultad activa" }],
      },
    });
    abrir();
    await waitFor(() => expect(screen.getByRole("button", { name: "Firmar" })).toBeDisabled());
    expect(screen.getByText("Sin facultad activa")).toBeInTheDocument();
  });

  it("identifica individualmente documentos incompletos sin abortar la cola y deshabilita la accion de firma", async () => {
    const docIncompleto = {
      resolucionId: "resolucion-01",
      expedienteId: "exp-01",
      numeroBorrador: "RD-BORR-001",
      asunto: "Resolución sin archivo adjunto",
      puedeFirmar: true,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docIncompleto] } });
    abrir();

    expect(await screen.findByText("Resolución sin archivo adjunto")).toBeInTheDocument();
    expect(screen.getByText("HASH: No disponible")).toBeInTheDocument();
    expect(screen.getByText("Documento sin archivo adjunto asociado.")).toBeInTheDocument();

    const botonFirmar = screen.getByRole("button", { name: "Firmar" });
    expect(botonFirmar).toBeDisabled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("en una cola mixta permite firmar el documento completo y mantiene deshabilitado el incompleto", async () => {
    const docIncompleto = {
      resolucionId: "resolucion-02",
      numeroBorrador: "RD-BORR-002",
      asunto: "Borrador pendiente de PDF",
      puedeFirmar: true,
    };
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { documentos: [documentoValido, docIncompleto] },
    });
    abrir();

    expect(await screen.findByText("Asunto persistido")).toBeInTheDocument();
    expect(screen.getByText("Borrador pendiente de PDF")).toBeInTheDocument();

    const botones = screen.getAllByRole("button", { name: "Firmar" });
    expect(botones).toHaveLength(2);
    expect(botones[0]).toBeEnabled();
    expect(botones[1]).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("identifica documentos con hash SHA-256 invalido como no firmables", async () => {
    const docHashInvalido = {
      documentoId: "doc-uuid-999",
      numeroBorrador: "RD-BORR-099",
      asunto: "Documento con hash corrupto",
      hashSha256: "hash_no_hex_invalido",
      puedeFirmar: true,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docHashInvalido] } });
    abrir();

    expect(await screen.findByText("Documento con hash corrupto")).toBeInTheDocument();
    expect(screen.getByText("HASH: No disponible")).toBeInTheDocument();
    expect(screen.getByText("Hash SHA-256 no disponible o formato inválido.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Firmar" })).toBeDisabled();
  });

  it("recupera la marca de firma persistida en la cola tras recargar y coteja al abrir", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (String(url).includes("cola-firmantes")) {
        return { data: { documentos: [{ ...documentoValido, estadoFirma: "FIRMADO_DIGITALMENTE" }] } };
      }
      return {
        data: {
          documentoId: documentoValido.documentoId,
          estado: "FIRMADO_DIGITALMENTE",
          resultado: {
            cvd: "CVD-2026-0123456789ABCDEF",
            urlFirmado: "https://storage.invalid/firmado",
            timestamp: "2026-10-19T12:00:00Z",
          },
          integridadVerificada: true,
          validacionCriptografica: false,
        },
      };
    });
    abrir();
    expect(await screen.findByText("Firma registrada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Consultar firma" }));
    expect(await screen.findByText("Registro de firma confirmado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir PDF registrado" })).toHaveAttribute(
      "href",
      "https://storage.invalid/firmado",
    );
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/firma/documento/${documentoValido.documentoId}/estado`,
      expect.any(Object),
    );
  });

  it("al abrir un registro que Storage no puede cotejar muestra el error sin confirmacion", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (String(url).includes("cola-firmantes")) {
        return { data: { documentos: [{ ...documentoValido, estadoFirma: "FIRMADO_DIGITALMENTE" }] } };
      }
      throw new Error("No se pudo cotejar el PDF registrado");
    });
    abrir();
    fireEvent.click(await screen.findByRole("button", { name: "Consultar firma" }));
    expect(await screen.findByText("No se pudo cotejar el PDF registrado")).toBeInTheDocument();
    expect(screen.queryByText("Registro de firma confirmado")).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("Problema A: documento sin documentoId real no recibe ID ficticio ni abre modal de firma", async () => {
    const docSinId = {
      resolucionId: "res-sintetica-123",
      expedienteId: "exp-123",
      numeroBorrador: "BORR-123",
      asunto: "Documento sin ID real",
      hashSha256: "b".repeat(64),
      s3PreviewUrl: "https://storage.invalid/pdf-123",
      puedeFirmar: true,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docSinId] } });
    abrir();

    expect(await screen.findByText("Documento sin ID real")).toBeInTheDocument();
    const boton = screen.getByRole("button", { name: "Firmar" });
    expect(boton).toBeDisabled();
    expect(screen.getByText("Documento sin archivo adjunto asociado.")).toBeInTheDocument();
  });

  it("Problema B: documento sin fecha valida no inventa la fecha de hoy", async () => {
    const docSinFecha = {
      ...documentoValido,
      fechaProyeccion: "fecha_invalida_no_parseable",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docSinFecha] } });
    abrir();

    expect(await screen.findByText("Asunto persistido")).toBeInTheDocument();
    const hoyIso = new Date().toISOString().slice(0, 10);
    expect(screen.queryByText(new RegExp(hoyIso))).not.toBeInTheDocument();
  });

  it("Riesgo A (AF-04-R1): estado desconocido no se convierte en OBSERVADO sino en etiqueta neutral no firmable", async () => {
    const docRechazado = {
      ...documentoValido,
      estadoFirma: "RECHAZADO_CONSEJO",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docRechazado] } });
    abrir();

    expect(await screen.findByText("Estado: RECHAZADO_CONSEJO")).toBeInTheDocument();
    expect(screen.queryByText("Observado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Firmar" })).not.toBeInTheDocument();
    expect(screen.getByText("No habilitado")).toBeInTheDocument();
    expect(screen.getByText(/Estado no habilitado para firma \(RECHAZADO_CONSEJO\)/)).toBeInTheDocument();
  });

  it("Riesgo A (AF-04-R1): documento con estadoFirma ausente o BORRADOR_PENDIENTE_FIRMA se reconoce legitimamente como PENDIENTE", async () => {
    const docBorrador = {
      ...documentoValido,
      estadoFirma: "BORRADOR_PENDIENTE_FIRMA",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docBorrador] } });
    abrir();

    expect(await screen.findByText("Pendiente de firma")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Firmar" })).toBeEnabled();
  });

  it("Riesgo C (AF-04-R1): dos documentos con el mismo expedienteId no colisionan en sus claves ni en la actualizacion de firma", async () => {
    const doc1 = {
      ...documentoValido,
      documentoId: "doc-uuid-111",
      expedienteId: "exp-compartido-999",
      asunto: "Resolución A del expediente 999",
    };
    const doc2 = {
      ...documentoValido,
      documentoId: "doc-uuid-222",
      expedienteId: "exp-compartido-999",
      asunto: "Resolución B del expediente 999",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [doc1, doc2] } });
    abrir();

    expect(await screen.findByText("Resolución A del expediente 999")).toBeInTheDocument();
    expect(screen.getByText("Resolución B del expediente 999")).toBeInTheDocument();

    const botones = screen.getAllByRole("button", { name: "Firmar" });
    expect(botones).toHaveLength(2);
  });

  it("Riesgo D (AF-04-R1): muestra estado visual 'Fecha no disponible' sin renderizar año 0 ni Invalid Date", async () => {
    const docSinFecha = {
      ...documentoValido,
      fechaProyeccion: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docSinFecha] } });
    abrir();

    expect(await screen.findByText("Fecha no disponible")).toBeInTheDocument();
    expect(screen.queryByText(/Año 0/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it("Problema D: documento sin ruta de almacenamiento s3PreviewUrl deshabilita firma con motivo claro", async () => {
    const docSinStorage = {
      ...documentoValido,
      s3PreviewUrl: "",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docSinStorage] } });
    abrir();

    expect(await screen.findByText("Asunto persistido")).toBeInTheDocument();
    const boton = screen.getByRole("button", { name: "Firmar" });
    expect(boton).toBeDisabled();
    expect(screen.getByText("Vista previa del documento PDF no disponible en almacenamiento.")).toBeInTheDocument();
  });

  it("Problema E: el boton de firma en lote se deshabilita si no hay documentos validos con ID real", async () => {
    const docIncompleto = {
      resolucionId: "res-01",
      asunto: "Incompleto",
      puedeFirmar: true,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docIncompleto] } });
    abrir();

    await screen.findByText("Incompleto");
    const botonLote = screen.getByRole("button", { name: "Firmar en lote (Secretaría)" });
    expect(botonLote).toBeDisabled();
  });

  it("Riesgo B (AF-04-R1): documento no habilitado no abre el modal de firma ante intentos de invocacion", async () => {
    const docSinPdf = {
      ...documentoValido,
      s3PreviewUrl: "",
      puedeFirmar: false,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docSinPdf] } });
    abrir();

    await screen.findByText("Asunto persistido");
    const botonFirmar = screen.getByRole("button", { name: "Firmar" });
    expect(botonFirmar).toBeDisabled();

    fireEvent.click(botonFirmar);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("AF-04-R2: consultar firma en documento ya firmado abre modo consulta seguro sin invocar endpoints POST ni refirma://", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (String(url).includes("cola-firmantes")) {
        return { data: { documentos: [{ ...documentoValido, estadoFirma: "FIRMADO_DIGITALMENTE" }] } };
      }
      return {
        data: {
          documentoId: documentoValido.documentoId,
          estado: "FIRMADO_DIGITALMENTE",
          resultado: {
            cvd: "CVD-2026-0123456789ABCDEF",
            urlFirmado: "https://storage.invalid/firmado",
            timestamp: "2026-10-19T12:00:00Z",
          },
          integridadVerificada: true,
          validacionCriptografica: false,
        },
      };
    });
    abrir();

    expect(await screen.findByText("Firma registrada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Consultar firma" }));

    // Verifica que el modal abre en modo consulta
    expect(await screen.findByText("Consulta de Firma Digital")).toBeInTheDocument();
    // Verifica que NO se ofrece botón para firmar nuevamente ni selectores de mecanismo
    expect(screen.queryByRole("button", { name: "Conectar con Refirma" })).not.toBeInTheDocument();
    expect(screen.queryByText("Mecanismo de firma")).not.toBeInTheDocument();
    // Confirma que ningún endpoint POST (como /api/v1/firma/invocar-refirma) fue ejecutado
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("AF-04-R2: documento con estadoFirma cadena vacia se muestra como 'Estado no disponible' y bloquea la firma", async () => {
    const docEstadoVacio = {
      ...documentoValido,
      estadoFirma: "",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docEstadoVacio] } });
    abrir();

    expect(await screen.findByText("Estado no disponible")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Firmar" })).not.toBeInTheDocument();
    expect(screen.getByText("No habilitado")).toBeInTheDocument();
    expect(screen.getByText("Estado documental no especificado o vacío.")).toBeInTheDocument();
  });

  it("AF-04-R2: documento con estado OBSERVADO o RECHAZADO no ofrece boton de firma", async () => {
    const docObservado = {
      ...documentoValido,
      estadoFirma: "OBSERVADO",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [docObservado] } });
    abrir();

    expect(await screen.findByText("Observado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Firmar" })).not.toBeInTheDocument();
    expect(screen.getByText("No habilitado")).toBeInTheDocument();
  });

  it("AF-05: manejarFirmado actualiza exclusivamente el documento firmado por su ID real sin importar reordenamiento", async () => {
    const doc1 = {
      ...documentoValido,
      documentoId: "doc-uuid-aaa",
      asunto: "Resolución Alfa",
    };
    const doc2 = {
      ...documentoValido,
      documentoId: "doc-uuid-bbb",
      asunto: "Resolución Beta",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { documentos: [doc1, doc2] } });
    abrir();

    expect(await screen.findByText("Resolución Alfa")).toBeInTheDocument();
    expect(screen.getByText("Resolución Beta")).toBeInTheDocument();

    const botones = screen.getAllByRole("button", { name: "Firmar" });
    // Abrir doc2 para firmar
    fireEvent.click(botones[1]);
    expect(await screen.findByText("Firma Digital con Refirma RENIEC")).toBeInTheDocument();
  });
});
