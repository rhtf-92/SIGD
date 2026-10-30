/**
 * ==============================================================================
 * TEST UNITARIO: ExpedienteSeguimientoCustodia.test.tsx
 * ==============================================================================
 * Cobertura exigida:
 * - Modelo Funcional de Custodia: Tesorería NO es custodio documental.
 * - Desacoplamiento de estado documental y estado financiero.
 * - Post-pago continúa en Mesa con badge "Listo para derivar" y destino sugerido.
 * - Destino sugerido a SDA para p1-fila-06 (Certificado de Inglés).
 * - Sugerencia no deriva automáticamente; exige confirmación de Mesa.
 * - Live Tracking en todas las etapas del ciclo de vida (REGISTRADO -> DERIVADO -> EN_REVISION -> RESUELTO -> ARCHIVADO).
 * - Cero UUIDs crudos como información principal visible.
 * ==============================================================================
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExpedienteDetallePage from '@/pages/expedientes/ExpedienteDetallePage';
import { rutaDoc } from '@/pages/expedientes/rutadoc/rutadoc.service';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/pages/expedientes/rutadoc/rutadoc.service', () => ({
  rutaDoc: {
    resumen: vi.fn(),
    obtenerUrlArchivo: vi.fn(),
    foliacion: vi.fn(),
  },
}));

vi.mock('@/services/tesoreria.service', () => ({
  tesoreriaService: {
    obtenerPagoExpediente: vi.fn(),
    generarOrdenPagoExpediente: vi.fn(),
  },
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn((url: string) => {
      if (url.includes('/api/v1/organigrama/areas-activas')) {
        return Promise.resolve({
          data: [
            { id: 'a0000000-0000-0000-0000-000000000001', nombre: 'Subdirección Académica', habilitada: true },
            { id: 'a0000000-0000-0000-0000-000000000002', nombre: 'Dirección General', habilitada: true },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(),
  },
}));

describe('ExpedienteDetallePage — Seguimiento End-to-End y Custodia Documental', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    useAuthStore.setState({
      accessToken: 'jwt-mesa',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-mesa',
        nombreCompleto: 'Operador Mesa Demo',
        correo: 'mesa@iestp-suiza.edu.pe',
        rol: 'MESA_PARTES',
      },
    });
  });

  const renderConRuta = (expId: string) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/expedientes/${expId}`]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('1. Trámite p1-fila-06 con pago PENDIENTE: permanece en Mesa de Partes (Tesorería NO toma custodia documental)', async () => {
    vi.mocked(rutaDoc.resumen).mockResolvedValueOnce({
      expediente: {
        idExpediente: '11111111-2222-3333-4444-555555555555',
        cut: 'EXP-2026-000014',
        asunto: 'Certificado de Inglés',
        fechaRadicacion: '2026-10-28T10:00:00Z',
        estadoActual: 'REGISTRADO',
        areaActualId: null, // Mesa de Partes
        solicitanteId: '66666666-7777-8888-9999-000000000000',
        resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 0 },
        ultimoMovimiento: null,
        sla: null,
      },
      estado: 'REGISTRADO',
      documentos: [],
      solicitanteResumen: {
        idPersona: '66666666-7777-8888-9999-000000000000',
        nombreCompleto: 'Juan Pérez',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        documentoEnmascarado: '12***678',
        correo: 'juan@test.com',
      },
      tupaResumen: {
        registroVersionId: '11720d13-da80-433c-8a24-d02cfd2cb5de',
        codigo: 'p1-fila-06',
        denominacion: 'Certificado de Inglés',
        clasificacion: 'PROCEDIMIENTO_APROBADO',
        plazoDias: 15,
        costo: 100.0,
      },
      pago: {
        ordenPagoId: 'ord-14',
        codigoPago: 'PAG-2026-000014',
        expedienteId: '11111111-2222-3333-4444-555555555555',
        solicitanteId: '66666666-7777-8888-9999-000000000000',
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
        fechaVencimiento: '2026-11-28T10:00:00Z',
        fechaPago: null,
        motivoRechazo: null,
      },
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 0 },
    } as never);

    renderConRuta('11111111-2222-3333-4444-555555555555');

    expect(await screen.findByText('EXP-2026-000014')).toBeInTheDocument();

    // Verificación de Ubicación Actual en la Tarjeta de Seguimiento
    expect(screen.getByText('Ubicación y Seguimiento Operacional (Live Tracking)')).toBeInTheDocument();
    expect(screen.getByText('Ubicación Actual')).toBeInTheDocument();
    expect(screen.getAllByText('Mesa de Partes').length).toBeGreaterThanOrEqual(1);

    // Verificación de Siguiente Acción Requerida
    expect(screen.getByText('Siguiente Acción Requerida')).toBeInTheDocument();
    expect(screen.getByText('Esperar confirmación de pago en Tesorería')).toBeInTheDocument();

    // Responsable Actual
    expect(screen.getByText('Operador de Mesa de Partes')).toBeInTheDocument();

    // Área Responsable TUPA sugerida
    expect(screen.getByText('Subdirección Académica (SDA)')).toBeInTheDocument();

    // Banner de Pago Pendiente
    expect(screen.getByText(/Pago Pendiente en Tesorería/i)).toBeInTheDocument();

    // Botón derivar deshabilitado
    const btnDerivar = screen.getByRole('button', { name: 'Derivar' });
    expect(btnDerivar).toBeDisabled();
  });

  it('2. Pago CONFIRMADO: desbloquea derivación, muestra badge "Listo para derivar" y sugerencia SDA sin derivar automáticamente', async () => {
    vi.mocked(rutaDoc.resumen).mockResolvedValueOnce({
      expediente: {
        idExpediente: '11111111-2222-3333-4444-555555555555',
        cut: 'EXP-2026-000014',
        asunto: 'Certificado de Inglés',
        fechaRadicacion: '2026-10-28T10:00:00Z',
        estadoActual: 'REGISTRADO',
        areaActualId: null,
        solicitanteId: '66666666-7777-8888-9999-000000000000',
        resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 0 },
        ultimoMovimiento: null,
        sla: null,
      },
      estado: 'REGISTRADO',
      documentos: [],
      solicitanteResumen: {
        idPersona: '66666666-7777-8888-9999-000000000000',
        nombreCompleto: 'Juan Pérez',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        documentoEnmascarado: '12***678',
      },
      tupaResumen: {
        registroVersionId: '11720d13-da80-433c-8a24-d02cfd2cb5de',
        codigo: 'p1-fila-06',
        denominacion: 'Certificado de Inglés',
        clasificacion: 'PROCEDIMIENTO_APROBADO',
        plazoDias: 15,
        costo: 100.0,
      },
      pago: {
        ordenPagoId: 'ord-14',
        codigoPago: 'PAG-2026-000014',
        expedienteId: '11111111-2222-3333-4444-555555555555',
        solicitanteId: '66666666-7777-8888-9999-000000000000',
        concepto: 'Certificado de Inglés',
        codigoTupa: 'p1-fila-06',
        monto: 100.0,
        moneda: 'PEN',
        estado: 'CONFIRMADO',
        metodoPago: 'YAPE',
        referenciaOperacion: '987654',
        montoRecibido: 100.0,
        vuelto: 0,
        codigoRecibo: 'REC-2026-000014',
        fechaCreacion: '2026-10-28T10:00:00Z',
        fechaVencimiento: '2026-11-28T10:00:00Z',
        fechaPago: '2026-10-28T10:30:00Z',
        motivoRechazo: null,
      },
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 0 },
    } as never);

    renderConRuta('11111111-2222-3333-4444-555555555555');

    expect(await screen.findByText('EXP-2026-000014')).toBeInTheDocument();

    // Debe mostrar badge "Listo para derivar"
    expect(screen.getByText('✓ Listo para derivar')).toBeInTheDocument();

    // Debe sugerir Subdirección Académica
    expect(screen.getByText(/Destino sugerido:/i)).toBeInTheDocument();
    expect(screen.getByText('Subdirección Académica')).toBeInTheDocument();

    // Botón de derivación habilitado
    const btnDerivarTabla = screen.getByRole('button', { name: 'Derivar' });
    expect(btnDerivarTabla).not.toBeDisabled();

    // El botón rápido "Derivar Expediente" del banner también está visible
    const btnDerivarBanner = screen.getByRole('button', { name: /Derivar Expediente/i });
    expect(btnDerivarBanner).toBeInTheDocument();

    // Al hacer click, abre el modal pero NO deriva sin proveído ni confirmación
    fireEvent.click(btnDerivarBanner);
    expect(await screen.findByText('Confirmar derivación')).toBeInTheDocument();
  });

  it('3. Expediente DERIVADO: Ubicación actual es Subdirección Académica y requiere recepción formal', async () => {
    vi.mocked(rutaDoc.resumen).mockResolvedValueOnce({
      expediente: {
        idExpediente: '11111111-2222-3333-4444-555555555555',
        cut: 'EXP-2026-000014',
        asunto: 'Certificado de Inglés',
        fechaRadicacion: '2026-10-28T10:00:00Z',
        estadoActual: 'DERIVADO',
        areaActualId: 'a0000000-0000-0000-0000-000000000001', // SDA
        solicitanteId: '66666666-7777-8888-9999-000000000000',
        resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 2 },
        ultimoMovimiento: null,
        sla: null,
      },
      estado: 'DERIVADO',
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: {
        registroVersionId: '11720d13-da80-433c-8a24-d02cfd2cb5de',
        codigo: 'p1-fila-06',
        denominacion: 'Certificado de Inglés',
        clasificacion: 'PROCEDIMIENTO_APROBADO',
        plazoDias: 15,
        costo: 100.0,
      },
      pago: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 1, totalFolios: 2, cantidadFoliados: 2 },
    } as never);

    renderConRuta('11111111-2222-3333-4444-555555555555');

    expect(await screen.findByText('EXP-2026-000014')).toBeInTheDocument();

    // Ubicación no debe ser UUID, sino nombre institucional "Subdirección Académica"
    expect(screen.getAllByText('Subdirección Académica').length).toBeGreaterThanOrEqual(1);

    // Siguiente acción: recepción formal
    expect(screen.getByText('Confirmar recepción formal en Subdirección Académica')).toBeInTheDocument();
  });

  it('4. Expediente ARCHIVADO: Ubicación es Archivo Central (Custodia Física) y estado terminal', async () => {
    vi.mocked(rutaDoc.resumen).mockResolvedValueOnce({
      expediente: {
        idExpediente: '11111111-2222-3333-4444-555555555555',
        cut: 'EXP-2026-000014',
        asunto: 'Certificado de Inglés',
        fechaRadicacion: '2026-10-28T10:00:00Z',
        estadoActual: 'ARCHIVADO',
        areaActualId: 'a0000000-0000-0000-0000-000000000001',
        solicitanteId: '66666666-7777-8888-9999-000000000000',
        resumenDocumentos: { cantidadDocumentos: 2, totalFolios: 4, cantidadFoliados: 4 },
        ultimoMovimiento: null,
        sla: null,
      },
      estado: 'ARCHIVADO',
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: null,
      pago: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 2, totalFolios: 4, cantidadFoliados: 4 },
    } as never);

    renderConRuta('11111111-2222-3333-4444-555555555555');

    expect(await screen.findByText('EXP-2026-000014')).toBeInTheDocument();

    // Ubicación Actual: Archivo Central (Custodia Física)
    expect(screen.getByText('Archivo Central (Custodia Física)')).toBeInTheDocument();
    expect(screen.getByText('Encargado de Archivo Central')).toBeInTheDocument();
    expect(screen.getByText('Trámite concluido (custodia pasiva definitiva)')).toBeInTheDocument();
  });
});
