import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExpedienteDetallePage from '../../../src/pages/expedientes/ExpedienteDetallePage';
import { apiClient } from '../../../src/api/client';
import { useAuthStore } from '../../../src/stores/authStore';

describe('ExpedienteDetallePage — Control de Pago y Bloqueo de Derivación', () => {
  let queryClient: QueryClient;
  const mockExpedienteId = '11111111-2222-4333-8444-555555555555';

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
        nombreCompleto: 'Operador Mesa Partes',
        correo: 'mp@suiza.edu.pe',
        rol: 'MESA_PARTES',
      },
    });
  });

  it('1. Trámite con costo S/ 100 y sin orden: Derivar queda deshabilitado y permite generar orden', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/resumen')) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: 'EXP-2026-000014',
              asunto: 'Certificado de Inglés',
              fechaRadicacion: '2026-10-28T10:00:00Z',
              estadoActual: 'REGISTRADO',
              areaActualId: 'Mesa de Partes',
              solicitanteId: 'sol-1',
              resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 2 },
            },
            estado: 'REGISTRADO',
            slaResumen: null,
            foliacionResumen: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 0 },
            tupaResumen: {
              codigo: 'p1-fila-06',
              denominacion: 'Certificado de Inglés',
              tipoProcedimiento: 'APROBACION_AUTOMATICA',
              costo: 100.0,
              plazoDiasHabiles: 5,
            },
            solicitanteResumen: {
              idPersona: 'sol-1',
              nombreCompleto: 'Carlos Ruiz',
              tipoDocumento: 'DNI',
              numeroDocumento: '12345678',
              documentoEnmascarado: '12***678',
            },
            documentos: [],
            pago: null,
          },
        } as any;
      }
      return { data: null } as any;
    });

    vi.spyOn(apiClient, 'post').mockImplementation(async (url: string) => {
      if (url.includes('/orden-pago')) {
        return {
          data: {
            ordenPagoId: 'ord-100',
            codigoPago: 'PAG-2026-000014',
            expedienteId: mockExpedienteId,
            codigoExpediente: 'EXP-2026-000014',
            solicitanteId: 'sol-1',
            solicitanteNombre: 'Carlos Ruiz',
            documentoEnmascarado: '12***678',
            concepto: 'Certificado de Inglés',
            codigoTupa: 'p1-fila-06',
            monto: 100.0,
            moneda: 'PEN',
            estado: 'PENDIENTE',
            metodoPago: null,
            referenciaOperacion: null,
            montoRecibido: null,
            vuelto: null,
            codigoRecibo: null,
            fechaCreacion: '2026-10-28T10:00:00Z',
            fechaVencimiento: '2026-11-05T10:00:00Z',
            fechaPago: null,
            tesoreroId: null,
            motivoRechazo: null,
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

    expect(await screen.findByText('EXP-2026-000014')).toBeInTheDocument();

    // Sección Pago del Trámite visible
    expect(screen.getByText('Pago del Trámite (Tesorería)')).toBeInTheDocument();
    expect(screen.getAllByText(/100\.00/).length).toBeGreaterThanOrEqual(1);

    // Botón Derivar deshabilitado por requerir pago
    const btnDerivar = screen.getByRole('button', { name: 'Derivar' });
    expect(btnDerivar).toBeDisabled();
    expect(
      screen.getByText(/El expediente requiere pago confirmado en Tesorería antes de continuar/i)
    ).toBeInTheDocument();

    // Botón para generar orden de pago
    const btnGenerarOrden = screen.getByRole('button', { name: 'Generar orden de pago' });
    fireEvent.click(btnGenerarOrden);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/v1/expedientes/${mockExpedienteId}/orden-pago`,
        {},
        expect.anything()
      );
    });
  });

  it('2. Trámite con pago CONFIRMADO: Derivar se encuentra habilitado y muestra recibo oficial', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/resumen')) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: 'EXP-2026-000014',
              asunto: 'Certificado de Inglés',
              fechaRadicacion: '2026-10-28T10:00:00Z',
              estadoActual: 'REGISTRADO',
              areaActualId: 'Mesa de Partes',
              solicitanteId: 'sol-1',
              resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 2 },
            },
            estado: 'REGISTRADO',
            slaResumen: null,
            foliacionResumen: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 0 },
            tupaResumen: {
              codigo: 'p1-fila-06',
              denominacion: 'Certificado de Inglés',
              tipoProcedimiento: 'APROBACION_AUTOMATICA',
              costo: 100.0,
              plazoDiasHabiles: 5,
            },
            solicitanteResumen: {
              idPersona: 'sol-1',
              nombreCompleto: 'Carlos Ruiz',
              tipoDocumento: 'DNI',
              numeroDocumento: '12345678',
              documentoEnmascarado: '12***678',
            },
            documentos: [],
            pago: {
              ordenPagoId: 'ord-100',
              codigoPago: 'PAG-2026-000014',
              expedienteId: mockExpedienteId,
              codigoExpediente: 'EXP-2026-000014',
              solicitanteId: 'sol-1',
              solicitanteNombre: 'Carlos Ruiz',
              documentoEnmascarado: '12***678',
              concepto: 'Certificado de Inglés',
              codigoTupa: 'p1-fila-06',
              monto: 100.0,
              moneda: 'PEN',
              estado: 'CONFIRMADO',
              metodoPago: 'EFECTIVO',
              referenciaOperacion: null,
              montoRecibido: 100.0,
              vuelto: 0.0,
              codigoRecibo: 'REC-2026-000014',
              fechaCreacion: '2026-10-28T10:00:00Z',
              fechaVencimiento: '2026-11-05T10:00:00Z',
              fechaPago: '2026-10-28T10:15:00Z',
              tesoreroId: 'tes-1',
              motivoRechazo: null,
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

    expect(await screen.findByText('EXP-2026-000014')).toBeInTheDocument();

    // Verificación de pago confirmado
    expect(screen.getByText(/Pago verificado y liberado por Tesorería/i)).toBeInTheDocument();
    expect(screen.getByText(/REC-2026-000014/i)).toBeInTheDocument();

    // Botón Derivar debe estar habilitado
    const btnDerivar = screen.getByRole('button', { name: 'Derivar' });
    expect(btnDerivar).not.toBeDisabled();

    // Botón para ver recibo oficial
    const btnVerRecibo = screen.getByRole('button', { name: 'Ver Recibo Oficial' });
    fireEvent.click(btnVerRecibo);

    // Modal de recibo abierto
    expect(screen.getByText(/CONSTANCIA DE PAGO/i)).toBeInTheDocument();
    expect(screen.getByText(/RECIBO INTERNO DE TESORERÍA/i)).toBeInTheDocument();
    expect(screen.getByText(/N° COMPROBANTE: REC-2026-000014/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir Recibo/i })).toBeInTheDocument();
  });

  it('3. Trámite de control GRATUITO (costo S/ 0): Derivar habilitado y no requiere orden', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/resumen')) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: 'EXP-2026-000015',
              asunto: 'Trámite General Sin Costo',
              fechaRadicacion: '2026-10-28T10:00:00Z',
              estadoActual: 'REGISTRADO',
              areaActualId: 'Mesa de Partes',
              solicitanteId: 'sol-1',
              resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 2 },
            },
            estado: 'REGISTRADO',
            slaResumen: null,
            foliacionResumen: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 0 },
            tupaResumen: {
              codigo: 'p1-fila-01',
              denominacion: 'Trámite General',
              tipoProcedimiento: 'APROBACION_AUTOMATICA',
              costo: 0.0,
              plazoDiasHabiles: 30,
            },
            solicitanteResumen: {
              idPersona: 'sol-1',
              nombreCompleto: 'Carlos Ruiz',
              tipoDocumento: 'DNI',
              numeroDocumento: '12345678',
              documentoEnmascarado: '12***678',
            },
            documentos: [],
            pago: null,
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

    expect(await screen.findByText('EXP-2026-000015')).toBeInTheDocument();

    expect(screen.getByText('Trámite no sujeto a arancel')).toBeInTheDocument();
    expect(screen.getByText('S/ 0.00')).toBeInTheDocument();

    // Derivar habilitado inmediatamente
    const btnDerivar = screen.getByRole('button', { name: 'Derivar' });
    expect(btnDerivar).not.toBeDisabled();
  });
});
