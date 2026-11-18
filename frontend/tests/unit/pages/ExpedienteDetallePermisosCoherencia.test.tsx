import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExpedienteDetallePage from "@/pages/expedientes/ExpedienteDetallePage";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";

const EXP_ID = "11111111-2222-4333-8444-555555555599";
const AREA_SDA = "a0000000-0000-0000-0000-000000000001";
const AREA_DIR = "a0000000-0000-0000-0000-000000000002";

function crearResumenBase(overrides?: {
  estadoActual?: string;
  areaActualId?: string | null;
  pagoEstado?: "PENDIENTE" | "CONFIRMADO" | null;
  flujoAtencion?: {
    requiereAtencionTecnica: boolean;
    atencionTecnicaCompletada: boolean;
    areaResponsableId: string | null;
    areaResolutivaId: string | null;
  } | null;
}) {
  const estadoActual = overrides?.estadoActual ?? "EN_REVISION";
  const areaActualId = overrides?.areaActualId === undefined ? AREA_SDA : overrides.areaActualId;
  return {
    expediente: {
      idExpediente: EXP_ID,
      cut: "EXP-2026-000999",
      asunto: "Certificado de Idioma Inglés",
      fechaRadicacion: "2026-11-10T10:00:00Z",
      estadoActual,
      areaActualId,
      solicitanteId: "99999999-8888-4777-8666-555555555555",
      resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 1 },
    },
    estado: estadoActual,
    slaResumen: null,
    foliacionResumen: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 1 },
    tupaResumen: {
      registroVersionId: "11720d13-da80-433c-8a24-d02cfd2cb5de",
      codigo: "p1-fila-06",
      denominacion: "Certificado de Suficiencia de Idioma Inglés",
      clasificacion: "PROCEDIMIENTO_APROBADO",
      plazoDias: 15,
      costo: 100,
    },
    solicitanteResumen: {
      idPersona: "99999999-8888-4777-8666-555555555555",
      nombreCompleto: "Lucía Administrada",
      tipoDocumento: "DNI",
      numeroDocumento: "45678912",
      documentoEnmascarado: "45***912",
    },
    documentos: [],
    pago: overrides?.pagoEstado
      ? {
          ordenPagoId: "ord-999",
          codigoPago: "PAG-2026-000999",
          expedienteId: EXP_ID,
          codigoExpediente: "EXP-2026-000999",
          solicitanteId: "99999999-8888-4777-8666-555555555555",
          solicitanteNombre: "Lucía Administrada",
          documentoEnmascarado: "45***912",
          concepto: "Certificado de Suficiencia de Idioma Inglés",
          codigoTupa: "p1-fila-06",
          monto: 100,
          moneda: "PEN",
          estado: overrides.pagoEstado,
          metodoPago: overrides.pagoEstado === "CONFIRMADO" ? "EFECTIVO" : null,
          referenciaOperacion: null,
          montoRecibido: overrides.pagoEstado === "CONFIRMADO" ? 100 : null,
          vuelto: 0,
          codigoRecibo: overrides.pagoEstado === "CONFIRMADO" ? "REC-2026-000999" : null,
          fechaCreacion: "2026-11-10T10:00:00Z",
          fechaVencimiento: "2026-11-20T10:00:00Z",
          fechaPago: overrides.pagoEstado === "CONFIRMADO" ? "2026-11-10T10:15:00Z" : null,
          tesoreroId: "tes-1",
          motivoRechazo: null,
        }
      : null,
    flujoAtencion: overrides?.flujoAtencion ?? {
      requiereAtencionTecnica: true,
      atencionTecnicaCompletada: false,
      areaResponsableId: AREA_SDA,
      areaResolutivaId: AREA_DIR,
    },
  };
}

describe("ExpedienteDetallePage — Coherencia de permisos e impresión de recibo", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  function renderDetalle() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/expedientes/${EXP_ID}`]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it("bloquea acciones de custodia cuando el expediente pertenece a otra área y no abre modales", async () => {
    useAuthStore.setState({
      accessToken: "jwt-esp-sda",
      refreshToken: null,
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      contextosDisponibles: [
        { tipo: "INSTITUCIONAL", descripcion: "Institucional", rol: "ESPECIALISTA", areaId: AREA_SDA },
      ],
      usuario: {
        id: "u-esp-sda",
        idPersona: "p-esp-sda",
        nombreCompleto: "Especialista SDA",
        correo: "esp@iestp-suiza.edu.pe",
        rol: "ESPECIALISTA",
        areaId: AREA_SDA,
      },
    });

    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/resumen")) {
        return {
          data: crearResumenBase({
            estadoActual: "EN_REVISION",
            areaActualId: AREA_DIR,
            pagoEstado: "CONFIRMADO",
          }),
        } as any;
      }
      if (url.includes("/asignacion")) {
        return { data: { ok: true, activa: null, historial: [], candidatos: [] } } as any;
      }
      return { data: [] } as any;
    });

    renderDetalle();
    expect(await screen.findByText("EXP-2026-000999")).toBeInTheDocument();

    const btnDerivar = screen.getByRole("button", { name: "Derivar" });
    const btnAtender = screen.getByRole("button", { name: "Atender" });
    const btnObservar = screen.getByRole("button", { name: "Observar" });

    expect(btnDerivar).toBeDisabled();
    expect(btnAtender).toBeDisabled();
    expect(btnObservar).toBeDisabled();
    expect(btnDerivar).toHaveAccessibleDescription(/área de custodia actual \(Dirección General\)/i);
    expect(btnAtender).toHaveAccessibleDescription(/área actual \(Dirección General\)/i);

    fireEvent.click(btnDerivar);
    fireEvent.click(btnAtender);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exige asignación activa al ESPECIALISTA para Atender y la habilita cuando está asignado", async () => {
    useAuthStore.setState({
      accessToken: "jwt-esp-sda",
      refreshToken: null,
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      contextosDisponibles: [
        { tipo: "INSTITUCIONAL", descripcion: "Institucional", rol: "ESPECIALISTA", areaId: AREA_SDA },
      ],
      usuario: {
        id: "u-esp-sda",
        idPersona: "p-esp-sda",
        nombreCompleto: "Especialista SDA",
        correo: "esp@iestp-suiza.edu.pe",
        rol: "ESPECIALISTA",
        areaId: AREA_SDA,
      },
    });

    let asignadoAEspecialista = false;
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/resumen")) {
        return {
          data: crearResumenBase({
            estadoActual: "EN_REVISION",
            areaActualId: AREA_SDA,
            pagoEstado: "CONFIRMADO",
          }),
        } as any;
      }
      if (url.includes("/asignacion")) {
        return {
          data: {
            ok: true,
            activa: asignadoAEspecialista
              ? {
                  idAsignacion: "asig-1",
                  idPersona: "p-esp-sda",
                  idUsuario: "u-esp-sda",
                  usuario: "esp_sda",
                  nombreCompleto: "Especialista SDA",
                  motivo: "Evaluación técnica",
                  asignadoEn: "2026-11-10T11:00:00Z",
                }
              : null,
            historial: [],
            candidatos: [],
          },
        } as any;
      }
      return { data: [] } as any;
    });

    const vista = renderDetalle();
    expect(await screen.findByText("EXP-2026-000999")).toBeInTheDocument();

    const btnAtender = screen.getByRole("button", { name: "Atender" });
    await waitFor(() => expect(btnAtender).toBeDisabled());
    expect(btnAtender).toHaveAccessibleDescription(/no ha sido asignado formalmente/i);

    // Ahora asignado al mismo especialista
    vista.unmount();
    queryClient.clear();
    asignadoAEspecialista = true;
    renderDetalle();
    expect(await screen.findByText("EXP-2026-000999")).toBeInTheDocument();

    const btnAtenderHabilitado = screen.getByRole("button", { name: "Atender" });
    await waitFor(() => expect(btnAtenderHabilitado).toBeEnabled());
    fireEvent.click(btnAtenderHabilitado);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("restringe Enviar a Firma en ADMINISTRADOR y habilita impresión limpia de recibo en ExpedienteDetallePage", async () => {
    useAuthStore.setState({
      accessToken: "jwt-admin",
      refreshToken: null,
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      contextosDisponibles: [
        { tipo: "INSTITUCIONAL", descripcion: "Institucional", rol: "ADMINISTRADOR", areaId: AREA_DIR },
      ],
      usuario: {
        id: "u-admin",
        idPersona: "p-admin",
        nombreCompleto: "Admin Técnico",
        correo: "admin@iestp-suiza.edu.pe",
        rol: "ADMINISTRADOR",
        areaId: AREA_DIR,
      },
    });

    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/resumen")) {
        return {
          data: crearResumenBase({
            estadoActual: "EN_REVISION",
            areaActualId: AREA_DIR,
            pagoEstado: "CONFIRMADO",
            flujoAtencion: {
              requiereAtencionTecnica: false,
              atencionTecnicaCompletada: false,
              areaResponsableId: AREA_DIR,
              areaResolutivaId: AREA_DIR,
            },
          }),
        } as any;
      }
      if (url.includes("/asignacion")) {
        return { data: { ok: true, activa: null, historial: [], candidatos: [] } } as any;
      }
      return { data: [] } as any;
    });

    renderDetalle();
    expect(await screen.findByText("EXP-2026-000999")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Atender" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar a Firma" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resolver con Firma" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Asignar" })).toBeDisabled();

    // Abrir recibo oficial y verificar atributos de impresión A4 limpia
    const btnVerRecibo = screen.getByRole("button", { name: "Ver Recibo Oficial" });
    fireEvent.click(btnVerRecibo);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-print-target", "recibo-voucher");
    const card = dialog.querySelector('[data-print-target="recibo-card"]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass("break-inside-avoid");
    const printBtn = screen.getByRole("button", { name: /Imprimir Recibo/i });
    expect(printBtn.closest(".print\\:hidden")).not.toBeNull();
  });

  it("muestra acciones y siguiente acción reales en todas las etapas de Certificado de Inglés (DIR sin dictamen -> SDA -> firma)", async () => {
    // 1. DIR sin dictamen (caso EXP-2026-000149): DIRECTOR ve Derivar a SDA, NO "Evaluar expediente y emitir documento de resolución" ni "Atender y Emitir Resolución"
    useAuthStore.setState({
      accessToken: "jwt-dir",
      refreshToken: null,
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      contextosDisponibles: [{ tipo: "INSTITUCIONAL", descripcion: "Institucional", rol: "DIRECTOR", areaId: AREA_DIR }],
      usuario: { id: "u-dir", idPersona: "p-dir", nombreCompleto: "Director General", correo: "dir@iestp-suiza.edu.pe", rol: "DIRECTOR", areaId: AREA_DIR },
    });
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/resumen")) {
        return {
          data: crearResumenBase({
            estadoActual: "EN_REVISION",
            areaActualId: AREA_DIR,
            pagoEstado: "CONFIRMADO",
            flujoAtencion: { requiereAtencionTecnica: true, atencionTecnicaCompletada: false, areaResponsableId: AREA_SDA, areaResolutivaId: AREA_DIR },
          }),
        } as any;
      }
      if (url.includes("/asignacion")) return { data: { ok: true, activa: null, historial: [], candidatos: [] } } as any;
      return { data: [] } as any;
    });

    const vista1 = renderDetalle();
    expect(await screen.findByText(/Derivar a Subdirección Académica \(SDA\) para evaluación académica/i)).toBeInTheDocument();
    expect(screen.queryByText(/Evaluar expediente y emitir documento de resolución/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Atender y Emitir Resolución/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Derivar a SDA/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Atender" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar a Firma" })).toBeDisabled();
    vista1.unmount();
    queryClient.clear();

    // 2. SDA pendiente de asignación (SECRETARIO): muestra "Asignar especialista", Asignar habilitado, Enviar a Firma deshabilitado
    useAuthStore.setState({
      usuario: { id: "u-sec", idPersona: "p-sec", nombreCompleto: "Secretario SDA", correo: "sec@iestp-suiza.edu.pe", rol: "SECRETARIO", areaId: AREA_SDA },
    });
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/resumen")) {
        return {
          data: crearResumenBase({
            estadoActual: "EN_REVISION",
            areaActualId: AREA_SDA,
            pagoEstado: "CONFIRMADO",
            flujoAtencion: { requiereAtencionTecnica: true, atencionTecnicaCompletada: false, areaResponsableId: AREA_SDA, areaResolutivaId: AREA_DIR },
          }),
        } as any;
      }
      if (url.includes("/asignacion")) return { data: { ok: true, activa: null, historial: [], candidatos: [] } } as any;
      return { data: [] } as any;
    });

    const vista2 = renderDetalle();
    expect(await screen.findByText(/Asignar especialista en Subdirección Académica/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Asignar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Enviar a Firma" })).toBeDisabled();
    vista2.unmount();
    queryClient.clear();

    // 3. Especialista asignado en SDA: muestra "Registrar dictamen técnico"
    useAuthStore.setState({
      usuario: { id: "u-esp-ing", idPersona: "p-esp-ing", nombreCompleto: "Resp. Inglés", correo: "ing@iestp-suiza.edu.pe", rol: "ESPECIALISTA", areaId: AREA_SDA },
    });
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/resumen")) {
        return {
          data: crearResumenBase({
            estadoActual: "EN_REVISION",
            areaActualId: AREA_SDA,
            pagoEstado: "CONFIRMADO",
            flujoAtencion: { requiereAtencionTecnica: true, atencionTecnicaCompletada: false, areaResponsableId: AREA_SDA, areaResolutivaId: AREA_DIR },
          }),
        } as any;
      }
      if (url.includes("/asignacion")) {
        return {
          data: {
            ok: true,
            activa: { idAsignacion: "asig-ing", idPersona: "p-esp-ing", idUsuario: "u-esp-ing", usuario: "resp_ingles", nombreCompleto: "Resp. Inglés", motivo: "Dictamen", asignadoEn: "2026-11-10T11:00:00Z" },
            historial: [],
            candidatos: [],
          },
        } as any;
      }
      return { data: [] } as any;
    });

    const vista3 = renderDetalle();
    expect(await screen.findByText(/Registrar dictamen técnico \(Especialista asignado\)/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Atender" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Enviar a Firma" })).toBeDisabled();
    vista3.unmount();
    queryClient.clear();

    // 4. SDA con dictamen completado (SECRETARIO): muestra "Elevar a Dirección (Enviar a Firma)"
    useAuthStore.setState({
      usuario: { id: "u-sec", idPersona: "p-sec", nombreCompleto: "Secretario SDA", correo: "sec@iestp-suiza.edu.pe", rol: "SECRETARIO", areaId: AREA_SDA },
    });
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/resumen")) {
        return {
          data: crearResumenBase({
            estadoActual: "EN_REVISION",
            areaActualId: AREA_SDA,
            pagoEstado: "CONFIRMADO",
            flujoAtencion: { requiereAtencionTecnica: true, atencionTecnicaCompletada: true, areaResponsableId: AREA_SDA, areaResolutivaId: AREA_DIR },
          }),
        } as any;
      }
      if (url.includes("/asignacion")) return { data: { ok: true, activa: null, historial: [], candidatos: [] } } as any;
      return { data: [] } as any;
    });

    const vista4 = renderDetalle();
    expect(await screen.findByText(/Elevar a Dirección \(Enviar a Firma\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar a Firma" })).toBeEnabled();
    vista4.unmount();
    queryClient.clear();

    // 5. DIR en EN_FIRMA con dictamen (DIRECTOR): muestra "Firmar y resolver" y Resolver habilitado
    useAuthStore.setState({
      usuario: { id: "u-dir", idPersona: "p-dir", nombreCompleto: "Director General", correo: "dir@iestp-suiza.edu.pe", rol: "DIRECTOR", areaId: AREA_DIR },
    });
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/resumen")) {
        return {
          data: crearResumenBase({
            estadoActual: "EN_FIRMA",
            areaActualId: AREA_DIR,
            pagoEstado: "CONFIRMADO",
            flujoAtencion: { requiereAtencionTecnica: true, atencionTecnicaCompletada: true, areaResponsableId: AREA_SDA, areaResolutivaId: AREA_DIR },
          }),
        } as any;
      }
      return { data: [] } as any;
    });

    renderDetalle();
    expect(await screen.findByText(/Firmar y resolver/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolver con Firma" })).toBeEnabled();
  });
});
