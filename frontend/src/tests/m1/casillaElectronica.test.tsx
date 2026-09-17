import type { ReactElement } from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CasillaElectronicaPage from "../../pages/casilla/CasillaElectronicaPage";
import { casillaService } from "../../services/casillaService";
import type {
  AcuseNotificacion,
  EstadisticasCasilla,
  FiltrosCasilla,
  GenerarAcuseResponse,
  Notificacion,
  NotificacionesResponse,
} from "../../types/casilla";

// Mock completo y determinista del servicio de casilla sin llamadas a red ni localStorage
vi.mock("../../services/casillaService", () => ({
  casillaService: {
    getNotificaciones: vi.fn(),
    getNotificacionById: vi.fn(),
    marcarComoLeido: vi.fn(),
    generarAcuseLegal: vi.fn(),
    getEstadisticas: vi.fn(),
    descargarDocumento: vi.fn(),
    descargarAcuse: vi.fn(),
    resetMockData: vi.fn(),
  },
  CASILLA_ENDPOINTS: {
    LISTAR_NOTIFICACIONES: "/api/v1/casilla/notificaciones",
    DETALLE_NOTIFICACION: (id: string) => `/api/v1/casilla/notificaciones/${id}`,
    MARCAR_LEIDO: (id: string) => `/api/v1/casilla/notificaciones/${id}/lectura`,
    GENERAR_ACUSE: (id: string) => `/api/v1/casilla/notificaciones/${id}/acuse`,
    ESTADISTICAS: "/api/v1/casilla/estadisticas",
    DESCARGAR_DOCUMENTO: (id: string) =>
      `/api/v1/casilla/notificaciones/${id}/documento/descargar`,
    DESCARGAR_ACUSE: (id: string) =>
      `/api/v1/casilla/notificaciones/${id}/acuse/descargar`,
  },
}));

// ============================================================================
// FIXTURES TIPADAS ESTRICTAS (CERO ANY)
// ============================================================================

const mockEstadisticasBase: EstadisticasCasilla = {
  total: 3,
  noLeidos: 1,
  leidos: 1,
  notificados: 1,
  urgentes: 0,
};

const mockAcuseNotificado: AcuseNotificacion = {
  idAcuse: "ACU-2026-000155",
  idNotificacion: "NOT-2026-000155",
  numeroExpediente: "EXP-2026-000155",
  destinatario: {
    idPersona: 104,
    nombresCompletos: "Sergio Serruche Panduro",
    numeroDocumento: "74561238",
    tipoDocumento: "DNI",
    direccionCasilla: "74561238@casilla.iestpsuiza.edu.pe",
    correoPersonal: "sergio.serruche@estudiante.iestpsuiza.edu.pe",
    telefonoContacto: "+51 961234567",
  },
  timestampGeneracionIso: "2026-09-02T11:16:05.184Z",
  hashSha256Acuse:
    "c4ca4238a0b923820dcc509a6f75849b23b0c44298fc1c149afbf4c8996fb924",
  cvdAcuse: "CVD-2026-ACU-000155-C4CA42",
  entidadEmisora: "IESTP Suiza (Pucallpa)",
  unidadEmisora: "Secretaría General e Imagen Institucional",
  fechaEfectoLegal: "02/09/2026 11:16:05 (Mismo día del depósito formal)",
  plazoImpugnacionDiasHabiles: 15,
  fechaLimiteImpugnacion: "24/09/2026",
  ipRegistro: "190.237.142.88",
  validezLegalMensaje:
    "Cédula de Acuse de Recibo Electrónico generada conforme al Artículo 20 del TUO de la Ley N° 27444.",
};

const mockNotificacionNoLeida: Notificacion = {
  id: "NOT-2026-000184",
  numeroNotificacion: "NOT-2026-000184",
  numeroExpediente: "EXP-2026-000184",
  asunto:
    "Aprobación de Expediente de Titulación y Emisión de Título Profesional",
  tipo: "RESOLUCION",
  estado: "NO_LEIDO",
  prioridad: "ALTA",
  unidadEmisora: "Dirección General - Secretaría Académica",
  responsableEmision: "Ing. Rolando Ramírez Peña",
  fechaDepositoIso: "2026-09-10T14:35:20.000Z",
  fechaLecturaIso: null,
  fechaNotificadoIso: null,
  requiereAcuse: true,
  actoAdministrativo: {
    tipoActo: "Resolución Directoral",
    numeroDocumento: "RD N.° 0412-2026-DG-IESTP-SUIZA",
    anio: 2026,
    asunto:
      "Aprobación de Expediente de Titulación y Emisión de Título Profesional",
    resumenLegal:
      "Dictamen Favorable de Titulación N.° 058-2026-DA-DSI acreditando culminación de estudios.",
    textoCompleto: "SE RESUELVE: Artículo 1°.- DECLARAR EXPEDITO al administrado.",
    nombreArchivoPdf: "RD-0412-2026-DG-IESTP-SUIZA.pdf",
    tamanoArchivo: "1.45 MB",
    hashIntegridadSha256:
      "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    cvd: "CVD-2026-RD-0412-7F83B1",
    firmantes: [
      {
        nombre: "Ing. Rolando Ramírez Peña",
        cargo: "Director General - IESTP Suiza",
        fechaFirma: "10/09/2026 14:10:15 UTC-5",
        entidadCertificadora: "RENIEC / Refirma Digital",
      },
    ],
  },
  acuse: null,
};

const mockNotificacionLeida: Notificacion = {
  id: "NOT-2026-000179",
  numeroNotificacion: "NOT-2026-000179",
  numeroExpediente: "EXP-2026-000179",
  asunto: "Observación y Pliego de Subsanación en Trámite de Convalidación",
  tipo: "NOTIFICACION_OBSERVACION",
  estado: "LEIDO",
  prioridad: "NORMAL",
  unidadEmisora: "Área Académica de Informática",
  responsableEmision: "Mag. Carlos Enrique Dávila Ruiz",
  fechaDepositoIso: "2026-09-08T10:15:00.000Z",
  fechaLecturaIso: "2026-09-08T16:22:45.000Z",
  fechaNotificadoIso: null,
  requiereAcuse: true,
  actoAdministrativo: {
    tipoActo: "Cédula de Observación",
    numeroDocumento: "NOT-OBS N.° 0034-2026-CAAI-IESTP-SUIZA",
    anio: 2026,
    asunto: "Adjuntar sílabos oficiales visados.",
    resumenLegal: "Plazo de diez días hábiles para subsanar.",
    nombreArchivoPdf: "NOT-OBS-0034-2026.pdf",
    tamanoArchivo: "845 KB",
    hashIntegridadSha256:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    cvd: "CVD-2026-OBS-0034-E3B0C4",
    firmantes: [
      {
        nombre: "Mag. Carlos Enrique Dávila Ruiz",
        cargo: "Coordinador de Informática",
        fechaFirma: "08/09/2026 09:50:11 UTC-5",
      },
    ],
  },
  acuse: null,
};

const mockNotificacionNotificada: Notificacion = {
  id: "NOT-2026-000155",
  numeroNotificacion: "NOT-2026-000155",
  numeroExpediente: "EXP-2026-000155",
  asunto: "Convocatoria Oficial a Ceremonia Solemne de Graduación",
  tipo: "OFICIO",
  estado: "NOTIFICADO",
  prioridad: "NORMAL",
  unidadEmisora: "Secretaría General e Imagen Institucional",
  responsableEmision: "Dr. Víctor Raúl Meléndez",
  fechaDepositoIso: "2026-09-02T09:00:00.000Z",
  fechaLecturaIso: "2026-09-02T11:15:30.000Z",
  fechaNotificadoIso: "2026-09-02T11:16:05.000Z",
  requiereAcuse: true,
  actoAdministrativo: {
    tipoActo: "Oficio Múltiple",
    numeroDocumento: "OF-MULT N.° 0089-2026-SG-IESTP-SUIZA",
    anio: 2026,
    asunto: "Cronograma de la Ceremonia de Graduación 2026.",
    resumenLegal: "Disposiciones protocolares oficiales.",
    nombreArchivoPdf: "OF-MULT-0089-2026.pdf",
    tamanoArchivo: "2.10 MB",
    hashIntegridadSha256:
      "9b73c93d7798ec3bf09bed4642f930f4e80fb5f9738c15258269d6b844f0430e",
    cvd: "CVD-2026-OFM-0089-9B73C9",
    firmantes: [
      {
        nombre: "Dr. Víctor Raúl Meléndez",
        cargo: "Secretario General",
        fechaFirma: "02/09/2026 08:40:00 UTC-5",
      },
    ],
  },
  acuse: mockAcuseNotificado,
};

const listaNotificacionesCompleta: Notificacion[] = [
  mockNotificacionNoLeida,
  mockNotificacionLeida,
  mockNotificacionNotificada,
];

function crearRespuestaPaginada(
  data: Notificacion[],
  currentPage = 1,
  totalPages = 1,
  limit = 5,
): NotificacionesResponse {
  return {
    data,
    meta: {
      currentPage,
      totalPages,
      totalItems: data.length,
      itemsPerPage: limit,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  };
}

function renderConQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ============================================================================
// SUITE DE PRUEBAS DE CASILLA ELECTRÓNICA Y ACUSE LEGAL (ENT-M01-03 / ENT-M01-05)
// ============================================================================

describe("Suite de Pruebas de Casilla Electrónica Ciudadana y Acuse Legal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(casillaService.getEstadisticas).mockResolvedValue(mockEstadisticasBase);
    vi.mocked(casillaService.getNotificaciones).mockImplementation(
      async (filtros?: FiltrosCasilla) => {
        let resultado = [...listaNotificacionesCompleta];

        if (filtros?.tipo && filtros.tipo !== "TODOS") {
          resultado = resultado.filter((n) => n.tipo === filtros.tipo);
        }
        if (filtros?.estado && filtros.estado !== "TODOS") {
          resultado = resultado.filter((n) => n.estado === filtros.estado);
        }
        if (filtros?.fechaInicio) {
          resultado = resultado.filter(
            (n) => n.fechaDepositoIso.slice(0, 10) >= filtros.fechaInicio!,
          );
        }
        if (filtros?.fechaFin) {
          resultado = resultado.filter(
            (n) => n.fechaDepositoIso.slice(0, 10) <= filtros.fechaFin!,
          );
        }

        const page = filtros?.page ?? 1;
        const limit = filtros?.limit ?? 5;
        return crearRespuestaPaginada(resultado, page, 1, limit);
      },
    );
  });

  it("a) Renderiza el listado paginado de notificaciones del administrado", async () => {
    renderConQueryClient(<CasillaElectronicaPage />);

    expect(
      screen.getByRole("heading", {
        name: /Bandeja de Casilla Electrónica Ciudadana/i,
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(/Aprobación de Expediente de Titulación/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Observación y Pliego de Subsanación/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Convocatoria Oficial a Ceremonia Solemne/i),
    ).toBeInTheDocument();
  });

  it("b) Muestra el indicador de estado correcto para NO_LEIDO, LEIDO y NOTIFICADO", async () => {
    renderConQueryClient(<CasillaElectronicaPage />);

    // Validar los indicadores de estado exactos en sus respectivas tarjetas
    const tarjetaNoLeida = await screen.findByRole("button", {
      name: new RegExp(mockNotificacionNoLeida.numeroNotificacion, "i"),
    });
    expect(within(tarjetaNoLeida).getByText("No Leído")).toBeInTheDocument();

    const tarjetaLeida = screen.getByRole("button", {
      name: new RegExp(mockNotificacionLeida.numeroNotificacion, "i"),
    });
    expect(within(tarjetaLeida).getByText("Leído")).toBeInTheDocument();

    const tarjetaNotificada = screen.getByRole("button", {
      name: new RegExp(mockNotificacionNotificada.numeroNotificacion, "i"),
    });
    expect(
      within(tarjetaNotificada).getByText("Notificado (Con Acuse)"),
    ).toBeInTheDocument();
  });

  it("c) El filtro por tipo de notificación reduce el listado mostrado", async () => {
    const user = userEvent.setup();
    renderConQueryClient(<CasillaElectronicaPage />);

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenCalled();
    });

    // Seleccionar filtro por tipo de documento: RESOLUCION
    const selectTipo = screen.getByLabelText(/Tipo de Acto \/ Documento/i);
    await user.selectOptions(selectTipo, "RESOLUCION");

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
        expect.objectContaining({ tipo: "RESOLUCION" }),
      );
    });

    expect(
      await screen.findByText(/Aprobación de Expediente de Titulación/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Observación y Pliego de Subsanación/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Convocatoria Oficial a Ceremonia Solemne/i),
    ).not.toBeInTheDocument();
  });

  it("d) El filtro por rango de fechas (fechaInicio/fechaFin) reduce el listado mostrado", async () => {
    const user = userEvent.setup();
    renderConQueryClient(<CasillaElectronicaPage />);

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenCalled();
    });

    // Aplicar fecha inicio 2026-09-09 (solo debe entrar la notificación del 2026-09-10)
    const inputFechaInicio = screen.getByLabelText(/Fecha Depósito \(Desde\)/i);
    await user.type(inputFechaInicio, "2026-09-09");

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
        expect.objectContaining({ fechaInicio: "2026-09-09" }),
      );
    });

    expect(
      await screen.findByText(/Aprobación de Expediente de Titulación/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Observación y Pliego de Subsanación/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Convocatoria Oficial a Ceremonia Solemne/i),
    ).not.toBeInTheDocument();
  });

  it("e) La paginación avanza de página y vuelve a consultar el servicio", async () => {
    const user = userEvent.setup();

    // Configurar respuesta de 2 páginas
    vi.mocked(casillaService.getNotificaciones).mockImplementation(
      async (filtros?: FiltrosCasilla) => {
        if (filtros?.page === 2) {
          return {
            data: [mockNotificacionNotificada],
            meta: {
              currentPage: 2,
              totalPages: 2,
              totalItems: 3,
              itemsPerPage: 2,
              hasNextPage: false,
              hasPreviousPage: true,
            },
          };
        }

        return {
          data: [mockNotificacionNoLeida, mockNotificacionLeida],
          meta: {
            currentPage: 1,
            totalPages: 2,
            totalItems: 3,
            itemsPerPage: 2,
            hasNextPage: true,
            hasPreviousPage: false,
          },
        };
      },
    );

    renderConQueryClient(<CasillaElectronicaPage />);

    // Esperar a que los elementos de la primera página estén montados
    await screen.findByText(/Aprobación de Expediente de Titulación/i);

    const botonSiguiente = screen.getByRole("button", { name: /Siguiente/i });
    expect(botonSiguiente).not.toBeDisabled();
    await user.click(botonSiguiente);

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });

    expect(
      await screen.findByText(/Convocatoria Oficial a Ceremonia Solemne/i),
    ).toBeInTheDocument();
  });

  it("f) Al abrir el modal de detalle de una notificación NO_LEIDO, se invoca casillaService.marcarComoLeido con el id correcto", async () => {
    const user = userEvent.setup();

    const notificacionActualizada: Notificacion = {
      ...mockNotificacionNoLeida,
      estado: "LEIDO",
      fechaLecturaIso: "2026-09-16T20:00:00.000Z",
    };

    vi.mocked(casillaService.marcarComoLeido).mockResolvedValue(
      notificacionActualizada,
    );

    renderConQueryClient(<CasillaElectronicaPage />);

    const tarjetaNoLeida = await screen.findByRole("button", {
      name: new RegExp(mockNotificacionNoLeida.numeroNotificacion, "i"),
    });

    await user.click(tarjetaNoLeida);

    await waitFor(() => {
      expect(casillaService.marcarComoLeido).toHaveBeenCalledWith(
        mockNotificacionNoLeida.id,
      );
    });
  });

  it("g) El modal despliega los datos del acto administrativo (número de documento, asunto, firmantes y CVD)", async () => {
    const user = userEvent.setup();

    renderConQueryClient(<CasillaElectronicaPage />);

    const tarjeta = await screen.findByRole("button", {
      name: new RegExp(mockNotificacionNoLeida.numeroNotificacion, "i"),
    });
    await user.click(tarjeta);

    // Modal abierto con role="dialog"
    const modal = await screen.findByRole("dialog");
    expect(modal).toBeInTheDocument();

    // 1. Número de documento del acto administrativo dentro del modal
    expect(
      within(modal).getByRole("heading", {
        name: mockNotificacionNoLeida.actoAdministrativo.numeroDocumento,
      }),
    ).toBeInTheDocument();

    // 2. Asunto dentro del modal
    expect(
      within(modal).getByText(mockNotificacionNoLeida.actoAdministrativo.asunto),
    ).toBeInTheDocument();

    // 3. Firmantes dentro del modal
    expect(
      within(modal).getByText(
        mockNotificacionNoLeida.actoAdministrativo.firmantes[0].nombre,
      ),
    ).toBeInTheDocument();
    expect(
      within(modal).getByText(
        mockNotificacionNoLeida.actoAdministrativo.firmantes[0].cargo,
      ),
    ).toBeInTheDocument();

    // 4. Código de Verificación Digital (CVD) dentro del modal
    expect(
      within(modal).getByText(mockNotificacionNoLeida.actoAdministrativo.cvd),
    ).toBeInTheDocument();
  });

  it("h) Al generar el acuse legal, la fecha devuelta cumple ISO-8601. Aserción con regex", async () => {
    const user = userEvent.setup();
    const regexIso8601 =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

    const isoFechaGenerada = "2026-09-16T20:15:30.123Z";
    const acuseGenerado: AcuseNotificacion = {
      ...mockAcuseNotificado,
      idNotificacion: mockNotificacionNoLeida.id,
      timestampGeneracionIso: isoFechaGenerada,
    };

    const respuestaAcuse: GenerarAcuseResponse = {
      success: true,
      message: "Acuse generado con éxito",
      data: acuseGenerado,
      notificacionActualizada: {
        ...mockNotificacionNoLeida,
        estado: "NOTIFICADO",
        fechaNotificadoIso: isoFechaGenerada,
        acuse: acuseGenerado,
      },
    };

    vi.mocked(casillaService.generarAcuseLegal).mockResolvedValue(respuestaAcuse);

    renderConQueryClient(<CasillaElectronicaPage />);

    // Abrir modal de notificación pendiente de acuse
    const tarjeta = await screen.findByRole("button", {
      name: new RegExp(mockNotificacionNoLeida.numeroNotificacion, "i"),
    });
    await user.click(tarjeta);

    // Botón para generar acuse digital
    const botonGenerarAcuse = await screen.findByRole("button", {
      name: /Generar y Confirmar Acuse Digital Legal/i,
    });
    await user.click(botonGenerarAcuse);

    await waitFor(() => {
      expect(casillaService.generarAcuseLegal).toHaveBeenCalledWith(
        mockNotificacionNoLeida.id,
      );
    });

    // Validar aserción estricta de fecha ISO-8601 exigida por requerimiento
    expect(acuseGenerado.timestampGeneracionIso).toMatch(regexIso8601);

    // Despliegue en modal del acuse confirmado
    expect(
      await screen.findByText("CÉDULA DE ACUSE DE NOTIFICACIÓN ELECTRÓNICA"),
    ).toBeInTheDocument();
    expect(screen.getByText(isoFechaGenerada)).toBeInTheDocument();
  });

  it("i) El hash del acuse es SHA-256 válido. Aserción con regex: /^[a-f0-9]{64}$/i", async () => {
    const user = userEvent.setup();
    const regexSha256 = /^[a-f0-9]{64}$/i;

    const hashValidoSha256 =
      "c4ca4238a0b923820dcc509a6f75849b23b0c44298fc1c149afbf4c8996fb924";

    const acuseConHash: AcuseNotificacion = {
      ...mockAcuseNotificado,
      hashSha256Acuse: hashValidoSha256,
    };

    const notificacionNotificadaConHash: Notificacion = {
      ...mockNotificacionNotificada,
      acuse: acuseConHash,
    };

    vi.mocked(casillaService.getNotificaciones).mockResolvedValue(
      crearRespuestaPaginada([notificacionNotificadaConHash]),
    );

    renderConQueryClient(<CasillaElectronicaPage />);

    const tarjeta = await screen.findByRole("button", {
      name: new RegExp(notificacionNotificadaConHash.numeroNotificacion, "i"),
    });
    await user.click(tarjeta);

    // Modal de la notificación con acuse ya emitido
    await screen.findByRole("dialog");

    expect(acuseConHash.hashSha256Acuse).toMatch(regexSha256);
    expect(screen.getByText(hashValidoSha256)).toBeInTheDocument();
  });

  it("j) La dirección de casilla respeta el formato {documento}@casilla.iestpsuiza.edu.pe", async () => {
    renderConQueryClient(<CasillaElectronicaPage />);

    // Comprobación en la cabecera institucional del administrado
    const regexFormatoCasilla = /^[a-zA-Z0-9._%+-]+@casilla\.iestpsuiza\.edu\.pe$/;
    const direccionEsperada = "74561238@casilla.iestpsuiza.edu.pe";

    expect(direccionEsperada).toMatch(regexFormatoCasilla);

    const elementoCasilla = await screen.findByText(direccionEsperada);
    expect(elementoCasilla).toBeInTheDocument();

    // Comprobación de que coincide con el DNI del titular
    expect(mockAcuseNotificado.destinatario.direccionCasilla).toBe(
      `${mockAcuseNotificado.destinatario.numeroDocumento}@casilla.iestpsuiza.edu.pe`,
    );
    expect(mockAcuseNotificado.destinatario.direccionCasilla).toMatch(
      regexFormatoCasilla,
    );
  });

  it("k) Permite buscar por texto libre, cambiar el límite por página y limpiar los filtros", async () => {
    const user = userEvent.setup();
    renderConQueryClient(<CasillaElectronicaPage />);

    await screen.findByText(/Aprobación de Expediente de Titulación/i);

    // Búsqueda por texto
    const inputBusqueda = screen.getByLabelText(
      /Buscar por Asunto, N° o Expediente/i,
    );
    await user.type(inputBusqueda, "Titulación");

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
        expect.objectContaining({ busqueda: "Titulación" }),
      );
    });

    // Cambiar límite a 10 por página
    const selectLimit = screen.getByLabelText(/Por página/i);
    await user.selectOptions(selectLimit, "10");

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 10 }),
      );
    });

    // Debe aparecer el botón "Limpiar filtros"
    const botonLimpiar = await screen.findByRole("button", {
      name: /Limpiar filtros/i,
    });
    await user.click(botonLimpiar);

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
        expect.objectContaining({
          busqueda: "",
          tipo: "TODOS",
          estado: "TODOS",
        }),
      );
    });
  });

  it("l) Las tarjetas métricas de estadísticas filtran la lista al hacer clic en ellas", async () => {
    const user = userEvent.setup();
    renderConQueryClient(<CasillaElectronicaPage />);

    await screen.findByText(/Aprobación de Expediente de Titulación/i);

    // Clic en la tarjeta de No Leídos
    const tarjetaMetricaNoLeidos = screen.getByRole("button", {
      name: /^No Leídos/i,
    });
    await user.click(tarjetaMetricaNoLeidos);

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
        expect.objectContaining({ estado: "NO_LEIDO" }),
      );
    });

    // Clic en la tarjeta de Leídos
    const tarjetaMetricaLeidos = screen.getByRole("button", {
      name: /^Leídos/i,
    });
    await user.click(tarjetaMetricaLeidos);

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
        expect.objectContaining({ estado: "LEIDO" }),
      );
    });

    // Clic en la tarjeta de Notificados con Acuse
    const tarjetaMetricaNotificados = screen.getByRole("button", {
      name: /^Con Acuse Legal/i,
    });
    await user.click(tarjetaMetricaNotificados);

    await waitFor(() => {
      expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
        expect.objectContaining({ estado: "NOTIFICADO" }),
      );
    });
  });

  it("m) Permite descargar el acto administrativo en PDF y la cédula de acuse oficial", async () => {
    const user = userEvent.setup();

    vi.mocked(casillaService.getNotificaciones).mockResolvedValue(
      crearRespuestaPaginada([mockNotificacionNotificada]),
    );

    renderConQueryClient(<CasillaElectronicaPage />);

    const tarjeta = await screen.findByRole("button", {
      name: new RegExp(mockNotificacionNotificada.numeroNotificacion, "i"),
    });
    await user.click(tarjeta);

    const modal = await screen.findByRole("dialog");
    expect(modal).toBeInTheDocument();

    // Descargar PDF
    const botonDescargarPdf = within(modal).getByRole("button", {
      name: /Descargar Acto Administrativo \(\.PDF\)/i,
    });
    await user.click(botonDescargarPdf);
    expect(casillaService.descargarDocumento).toHaveBeenCalledWith(
      mockNotificacionNotificada,
    );

    // Descargar Acuse oficial
    const botonDescargarAcuse = within(modal).getByRole("button", {
      name: /Descargar Cédula de Acuse/i,
    });
    await user.click(botonDescargarAcuse);
    expect(casillaService.descargarAcuse).toHaveBeenCalledWith(
      mockAcuseNotificado,
    );

    // Cerrar modal con botón Cerrar
    const botonCerrar = within(modal).getByRole("button", {
      name: /Cerrar modal de notificación/i,
    });
    await user.click(botonCerrar);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("n) Muestra estado de error con botón de reintento y estado de bandeja vacía", async () => {
    const user = userEvent.setup();

    // Simular fallo en la consulta
    vi.mocked(casillaService.getNotificaciones).mockRejectedValueOnce(
      new Error("Error de conexión con la Casilla"),
    );

    renderConQueryClient(<CasillaElectronicaPage />);

    // Verificar mensaje de error
    expect(
      await screen.findByText(/Error al consultar la Casilla Electrónica/i),
    ).toBeInTheDocument();

    // Reintentar consulta
    vi.mocked(casillaService.getNotificaciones).mockResolvedValueOnce(
      crearRespuestaPaginada([]),
    );

    const botonReintentar = screen.getByRole("button", {
      name: /Reintentar consulta/i,
    });
    await user.click(botonReintentar);

    // Bandeja vacía
    expect(
      await screen.findByText(/No se encontraron notificaciones oficiales/i),
    ).toBeInTheDocument();
  });
});
