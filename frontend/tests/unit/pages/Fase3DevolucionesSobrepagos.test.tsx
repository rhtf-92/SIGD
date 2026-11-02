import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExpedienteDetallePage from '../../../src/pages/expedientes/ExpedienteDetallePage';
import TesoreriaPage from '../../../src/pages/tesoreria/TesoreriaPage';
import { apiClient } from '../../../src/api/client';
import { useAuthStore } from '../../../src/stores/authStore';

describe('SIGD 2026 — FASE 3: Devoluciones, Sobrepagos y Prevención de Pagos Duplicados (Frontend)', () => {
  let queryClient: QueryClient;
  const mockExpedienteId = '88888888-4444-4888-8444-888888888888';

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    useAuthStore.setState({
      accessToken: 'jwt-mesa-partes',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-mp',
        idPersona: 'p-mp',
        nombreCompleto: 'Operador Mesa de Partes',
        correo: 'mp@suiza.edu.pe',
        rol: 'MESA_PARTES',
      },
    });
  });

  it('1. Control anti-duplicados: alerta de Nivel 1 y Nivel 2 con justificación obligatoria al intentar pagar de nuevo', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/resumen')) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: 'EXP-2026-000088',
              asunto: 'Trámite TUPA con Pago Existente',
              fechaRadicacion: '2026-10-30T10:00:00Z',
              estadoActual: 'REGISTRADO',
              areaActualId: 'Mesa de Partes',
              solicitanteId: 'sol-88',
              resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 2 },
            },
            estado: 'REGISTRADO',
            slaResumen: null,
            foliacionResumen: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 0 },
            tupaResumen: {
              codigo: 'TUPA-01',
              denominacion: 'Constancia de Estudios',
              costo: 50.0,
              plazoDiasHabiles: 5,
            },
            solicitanteResumen: {
              idPersona: 'sol-88',
              nombreCompleto: 'Ana García',
              tipoDocumento: 'DNI',
              numeroDocumento: '87654321',
              documentoEnmascarado: '87***321',
            },
            documentos: [],
            pago: {
              ordenPagoId: 'ord-88-1',
              codigoPago: 'PAG-2026-000088',
              expedienteId: mockExpedienteId,
              codigoExpediente: 'EXP-2026-000088',
              solicitanteId: 'sol-88',
              solicitanteNombre: 'Ana García',
              documentoEnmascarado: '87***321',
              concepto: 'Constancia de Estudios',
              codigoTupa: 'TUPA-01',
              monto: 50.0,
              moneda: 'PEN',
              estado: 'CONFIRMADO',
              metodoPago: 'EFECTIVO',
              referenciaOperacion: null,
              montoRecibido: 50.0,
              vuelto: 0.0,
              codigoRecibo: 'REC-2026-000088',
              fechaCreacion: '2026-10-30T10:00:00Z',
              fechaVencimiento: '2026-11-06T10:00:00Z',
              fechaPago: '2026-10-30T10:05:00Z',
              tesoreroId: 'tes-1',
              motivoRechazo: null,
            },
          },
        } as any;
      }
      return { data: null } as any;
    });

    vi.spyOn(apiClient, 'post').mockImplementation(async (url: string, body: any) => {
      if (url.includes('/orden-pago')) {
        if (!body?.confirmarPagoAdicional) {
          const err: any = new Error('Pago ya confirmado');
          err.response = {
            status: 409,
            data: {
              ok: false,
              codigo: 'PAGO_YA_CONFIRMADO',
              mensaje: 'Este expediente ya cuenta con un pago verificado y confirmado (REC-2026-000088).',
              detalles: {
                codigoRecibo: 'REC-2026-000088',
                monto: 50.0,
                totalPagado: 50.0,
                requiereConfirmacionAdicional: true,
              },
            },
          };
          throw err;
        }
        return {
          data: {
            ordenPagoId: 'ord-88-2',
            codigoPago: 'PAG-2026-000089',
            expedienteId: mockExpedienteId,
            codigoExpediente: 'EXP-2026-000088',
            monto: 50.0,
            tipoOrden: 'ADICIONAL',
            motivoAdicional: body.motivoAdicional,
            estado: 'PENDIENTE',
          },
        } as any;
      }
      return { data: null } as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/expedientes/${mockExpedienteId}`]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('EXP-2026-000088')).toBeInTheDocument();

    // Intentar abrir flujo de pago adicional
    const btnPagoAdic = screen.getByRole('button', { name: /Registrar Pago Adicional/i });
    fireEvent.click(btnPagoAdic);

    // El flujo directo también debe comenzar por la primera advertencia.
    expect(await screen.findByText(/Nivel 1: Pago Ya Confirmado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Deseo solicitar un Pago Adicional/i }));
    expect(await screen.findByText(/Nivel 2: Confirmación de Pago Adicional/i)).toBeInTheDocument();
    expect(screen.getByText(/Está a punto de emitir una orden de PAGO ADICIONAL/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Ingrese la causal formal de la orden de pago adicional/i);
    fireEvent.change(textarea, { target: { value: 'Arancel complementario para rectificación formal' } });

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar y Generar Pago Adicional/i });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/v1/expedientes/${mockExpedienteId}/orden-pago`,
        {
          confirmarPagoAdicional: true,
          motivoAdicional: 'Arancel complementario para rectificación formal',
        },
        expect.anything()
      );
    });
  });

  it('2. Detección de Sobrepago y Solicitud de Devolución DEV desde Expediente', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/resumen')) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: 'EXP-2026-000088',
              asunto: 'Trámite con Sobrepago',
              fechaRadicacion: '2026-10-30T10:00:00Z',
              estadoActual: 'REGISTRADO',
              tupaResumen: { costo: 50.0 },
              pago: {
                ordenPagoId: 'ord-1',
                codigoPago: 'PAG-001',
                estado: 'CONFIRMADO',
                monto: 80.0,
                codigoRecibo: 'REC-001',
              },
            },
            tupaResumen: { costo: 50.0 },
            pago: {
              ordenPagoId: 'ord-1',
              codigoPago: 'PAG-001',
              estado: 'CONFIRMADO',
              monto: 80.0,
              codigoRecibo: 'REC-001',
            },
          },
        } as any;
      }
      if (url.includes('/saldos')) {
        return {
          data: {
            expedienteId: mockExpedienteId,
            codigoExpediente: 'EXP-2026-000088',
            costoOficial: 50.0,
            totalPagado: 80.0,
            diferencia: 30.0,
            posibleSobrepago: true,
            ordenes: [
              {
                ordenPagoId: 'ord-1',
                codigoPago: 'PAG-001',
                codigoRecibo: 'REC-001',
                tipoOrden: 'PRINCIPAL',
                monto: 80.0,
                estado: 'CONFIRMADO',
                saldoDevolvible: 30.0,
              },
            ],
            devoluciones: [],
          },
        } as any;
      }
      if (url.includes('/devoluciones')) {
        return { data: { items: [], total: 0 } } as any;
      }
      return { data: null } as any;
    });

    vi.spyOn(apiClient, 'post').mockImplementation(async (url: string, body: any) => {
      if (url === '/api/v1/devoluciones') {
        return {
          data: {
            ok: true,
            mensaje: 'Solicitud DEV registrada',
            devolucion: {
              solicitudDevolucionId: 'dev-1',
              codigoDev: 'DEV-2026-000001',
              expedienteId: mockExpedienteId,
              ordenPagoId: body.ordenPagoId,
              causal: body.causal,
              montoSolicitado: body.montoSolicitado,
              motivo: body.motivo,
              estado: 'SOLICITADA',
            },
          },
        } as any;
      }
      return { data: null } as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/expedientes/${mockExpedienteId}`]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Abrir detalle de saldos y devoluciones
    const btnConsultar = await screen.findByRole('button', { name: /Ver Detalle de Saldos y DEV/i });
    fireEvent.click(btnConsultar);

    // Se detecta y muestra la tarjeta de posible sobrepago
    expect(await screen.findByText(/Alerta de Posible Sobrepago Detectada/i)).toBeInTheDocument();
    expect(screen.getByText(/supera el arancel oficial del TUPA/i)).toBeInTheDocument();

    // Pulsar botón de solicitar devolución
    const btnDevolucion = screen.getAllByRole('button', { name: /Solicitar Devolución/i })[0];
    fireEvent.click(btnDevolucion);

    // Modal de solicitud DEV abierto
    expect(await screen.findByText(/Solicitar Devolución de Pago \(Ticket DEV\)/i)).toBeInTheDocument();

    const textareaMotivo = screen.getByPlaceholderText(/Explique detalladamente el motivo de la devolución/i);
    fireEvent.change(textareaMotivo, { target: { value: 'Pago de exceso de S/ 30 abonado por error' } });

    const btnRegistrarDev = screen.getByRole('button', { name: /Registrar Solicitud DEV/i });
    fireEvent.click(btnRegistrarDev);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/devoluciones',
        expect.objectContaining({
          expedienteId: mockExpedienteId,
          ordenPagoId: 'ord-1',
          montoSolicitado: 30,
          motivo: 'Pago de exceso de S/ 30 abonado por error',
        }),
        expect.anything()
      );
    });
  });

  it('3. Módulo de Tesorería: pestaña de Devoluciones y ejecución de desembolso emitiendo CDEV', async () => {
    useAuthStore.setState({
      usuario: {
        id: 'u-tes',
        idPersona: 'p-tes',
        nombreCompleto: 'Tesorero Oficial',
        correo: 'tes@suiza.edu.pe',
        rol: 'TESORERIA',
      },
    });

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/tesoreria/dashboard')) {
        return { data: { pendientes: 2, confirmadosHoy: 5, vencidos: 1 } } as any;
      }
      if (url.includes('/tesoreria/ordenes')) {
        return { data: { items: [], total: 0, page: 1, totalPages: 1 } } as any;
      }
      if (url.includes('/devoluciones')) {
        return {
          data: {
            items: [
              {
                solicitudDevolucionId: 'dev-99',
                codigoDev: 'DEV-2026-000099',
                expedienteId: mockExpedienteId,
                codigoExpediente: 'EXP-2026-000088',
                ordenPagoId: 'ord-1',
                codigoPago: 'PAG-001',
                codigoRecibo: 'REC-001',
                solicitanteId: 'sol-88',
                solicitanteNombre: 'Ana García',
                solicitanteDocumento: '87654321',
                causal: 'SOBREPAGO',
                motivo: 'Devolución aprobada por excedente',
                montoSolicitado: 30.0,
                montoAutorizado: 30.0,
                estado: 'PENDIENTE_TESORERIA',
                constanciaDevolucionCodigo: null,
              },
            ],
            total: 1,
            page: 1,
            totalPages: 1,
          },
        } as any;
      }
      return { data: null } as any;
    });

    vi.spyOn(apiClient, 'post').mockImplementation(async (url: string, _body: any) => {
      if (url.includes('/ejecutar')) {
        return {
          data: {
            ok: true,
            mensaje: 'Desembolso ejecutado con éxito',
            constanciaDevolucionCodigo: 'CDEV-2026-000001',
            devolucion: {
              solicitudDevolucionId: 'dev-99',
              codigoDev: 'DEV-2026-000099',
              estado: 'DEVUELTA',
              constanciaDevolucionCodigo: 'CDEV-2026-000001',
            },
          },
        } as any;
      }
      return { data: null } as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/tesoreria']}>
          <Routes>
            <Route path="/tesoreria" element={<TesoreriaPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Cambiar a la pestaña de Devoluciones
    const tabDevoluciones = await screen.findByRole('button', { name: /Devoluciones de Pago \(DEV\)/i });
    fireEvent.click(tabDevoluciones);

    // Debe renderizar la solicitud DEV-2026-000099
    expect(await screen.findByText('DEV-2026-000099')).toBeInTheDocument();
    expect(screen.getByText('EXP-2026-000088')).toBeInTheDocument();
    expect(screen.getByText('Ana García')).toBeInTheDocument();

    // Botón Ejecutar Desembolso
    const btnEjecutar = screen.getByRole('button', { name: /Ejecutar Desembolso/i });
    fireEvent.click(btnEjecutar);

    // Modal de desembolso abierto
    expect(await screen.findByText(/Tesorería \/ Desembolso Financiero/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmar Desembolso y Emitir CDEV/i)).toBeInTheDocument();

    const btnConfirmarDesembolso = screen.getByRole('button', { name: /Confirmar Desembolso y Emitir CDEV/i });
    fireEvent.click(btnConfirmarDesembolso);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/devoluciones/dev-99/ejecutar',
        expect.objectContaining({ metodoDevolucion: 'EFECTIVO' }),
        expect.anything()
      );
    });

    // Muestra la constancia CDEV emitida
    expect(await screen.findByText(/CDEV-2026-000001/i)).toBeInTheDocument();
  });
});
