import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TesoreriaPage from '../../../src/pages/tesoreria/TesoreriaPage';
import { tesoreriaService } from '../../../src/services/tesoreria.service';

vi.mock('../../../src/services/tesoreria.service', () => ({
  tesoreriaService: {
    obtenerDashboard: vi.fn(),
    listarOrdenes: vi.fn(),
    confirmarPago: vi.fn(),
    rechazarPago: vi.fn(),
    obtenerPagoExpediente: vi.fn(),
    generarOrdenPagoExpediente: vi.fn(),
    buscarPersonaPresencial: vi.fn(),
    obtenerConfiguracionDemoQr: vi.fn(),
    crearPagoDemoQr: vi.fn(),
    obtenerOrdenPorId: vi.fn(),
  },
}));

describe('TesoreriaPage — Módulo Institucional de Tesorería', () => {
  const mockDashboard = {
    pendientes: 3,
    confirmadosHoy: 5,
    vencidos: 1,
  };

  const mockOrdenes = [
    {
      ordenPagoId: 'ord-1',
      codigoPago: 'PAG-2026-000001',
      expedienteId: 'exp-1',
      codigoExpediente: 'EXP-2026-000014',
      solicitanteId: 'sol-1',
      solicitanteNombre: 'Juan Perez Soto',
      documentoEnmascarado: '••••5678',
      concepto: 'Certificado de Inglés',
      codigoTupa: 'p1-fila-06',
      monto: 100.0,
      moneda: 'PEN',
      estado: 'PENDIENTE' as const,
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
    {
      ordenPagoId: 'ord-2',
      codigoPago: 'PAG-2026-000002',
      expedienteId: 'exp-2',
      codigoExpediente: 'EXP-2026-000015',
      solicitanteId: 'sol-2',
      solicitanteNombre: 'Maria Garcia Flores',
      documentoEnmascarado: '••••1234',
      concepto: 'Duplicado de Carné',
      codigoTupa: 'p2-fila-01',
      monto: 35.0,
      moneda: 'PEN',
      estado: 'CONFIRMADO' as const,
      metodoPago: 'EFECTIVO' as const,
      referenciaOperacion: null,
      montoRecibido: 50.0,
      vuelto: 15.0,
      codigoRecibo: 'REC-2026-000001',
      fechaCreacion: '2026-10-28T09:00:00Z',
      fechaVencimiento: '2026-11-05T09:00:00Z',
      fechaPago: '2026-10-28T09:30:00Z',
      tesoreroId: 'tes-1',
      motivoRechazo: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tesoreriaService.obtenerDashboard).mockResolvedValue(mockDashboard);
    vi.mocked(tesoreriaService.listarOrdenes).mockResolvedValue({
      items: mockOrdenes,
      total: 2,
      page: 1,
      totalPages: 1,
    });
    vi.mocked(tesoreriaService.obtenerConfiguracionDemoQr).mockResolvedValue({
      configured: true, sandbox: true, publicUrl: 'https://demo.example.test',
    });
    vi.mocked(tesoreriaService.crearPagoDemoQr).mockResolvedValue({
      ok: true,
      orden: {
        ...mockOrdenes[0],
        paymentProvider: 'DEMO_QR',
        providerPaymentId: 'demo-payment-test-1',
        providerQrImage: 'data:image/png;base64,iVBORw0KGgo=',
        providerCheckoutUrl: 'https://demo.example.test/demo-pay/token-test',
        providerExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      },
    });
  });

  it('1. Renderiza el encabezado institucional y las 3 tarjetas de métricas reales', async () => {
    render(
      <MemoryRouter>
        <TesoreriaPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Módulo de Tesorería — IESTP "Suiza"')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Pendientes
      expect(screen.getByText('5')).toBeInTheDocument(); // Confirmados Hoy
      expect(screen.getByText('1')).toBeInTheDocument(); // Vencidos
    });

    expect(screen.getByText('Órdenes Pendientes')).toBeInTheDocument();
    expect(screen.getByText('Confirmados Hoy')).toBeInTheDocument();
    expect(screen.getByText('Órdenes Vencidas')).toBeInTheDocument();
  });

  it('2. Renderiza la tabla de órdenes con datos, códigos PAG y badges de estado', async () => {
    render(
      <MemoryRouter>
        <TesoreriaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('PAG-2026-000001')).toBeInTheDocument();
      expect(screen.getByText('PAG-2026-000002')).toBeInTheDocument();
    });

    expect(screen.getByText('Juan Perez Soto')).toBeInTheDocument();
    expect(screen.getByText('Maria Garcia Flores')).toBeInTheDocument();
    expect(screen.getByText('PEN 100.00')).toBeInTheDocument();
    expect(screen.getByText('PEN 35.00')).toBeInTheDocument();
    expect(screen.getAllByText('PENDIENTE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('CONFIRMADO').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver Recibo' })).toBeInTheDocument();
  });

  it('3. Flujo de cobro en Efectivo: calcula vuelto en vivo y confirma generando recibo', async () => {
    const ordenConfirmada = {
      ...mockOrdenes[0],
      estado: 'CONFIRMADO' as const,
      metodoPago: 'EFECTIVO' as const,
      montoRecibido: 120.0,
      vuelto: 20.0,
      codigoRecibo: 'REC-2026-000002',
      fechaPago: '2026-10-28T11:00:00Z',
    };

    vi.mocked(tesoreriaService.confirmarPago).mockResolvedValueOnce({
      ok: true,
      mensaje: 'Pago confirmado',
      orden: ordenConfirmada,
    });

    render(
      <MemoryRouter>
        <TesoreriaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cobrar' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    // Modal de confirmación abierto
    expect(screen.getByText('Confirmar Cobro — PAG-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('Total a Pagar:')).toBeInTheDocument();

    // Cambiar monto recibido a 120 para calcular vuelto de 20
    const inputMonto = screen.getByLabelText(/Monto Recibido del Administrado/i);
    fireEvent.change(inputMonto, { target: { value: '120' } });

    expect(screen.getByText('S/ 20.00')).toBeInTheDocument();

    // Confirmar pago
    const btnConfirmar = screen.getByRole('button', { name: /Confirmar pago/i });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(tesoreriaService.confirmarPago).toHaveBeenCalledWith('ord-1', {
        metodoPago: 'EFECTIVO',
        montoRecibido: 120,
        referenciaOperacion: undefined,
      });
    });

    // Debe abrir el modal del recibo oficial emitido
    await waitFor(() => {
      expect(screen.getByText(/CONSTANCIA DE PAGO/i)).toBeInTheDocument();
      expect(screen.getByText(/RECIBO INTERNO DE TESORERÍA/i)).toBeInTheDocument();
      expect(screen.getByText(/REC-2026-000002/)).toBeInTheDocument();
    });
  });

  it('4. Flujo de cobro por Yape: valida referencia de operación y confirma', async () => {
    const ordenConfirmadaYape = {
      ...mockOrdenes[0],
      estado: 'CONFIRMADO' as const,
      metodoPago: 'YAPE' as const,
      referenciaOperacion: '984321',
      codigoRecibo: 'REC-2026-000003',
      fechaPago: '2026-10-28T11:15:00Z',
    };

    vi.mocked(tesoreriaService.confirmarPago).mockResolvedValueOnce({
      ok: true,
      mensaje: 'Pago confirmado',
      orden: ordenConfirmadaYape,
    });

    render(
      <MemoryRouter>
        <TesoreriaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cobrar' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    // Seleccionar pestaña Yape
    fireEvent.click(screen.getByText(/Yape \/ QR Asistido/i));

    expect(
      screen.getByText(/Realice el pago con Yape y presente el número de operación al personal de Tesorería/i),
    ).toBeInTheDocument();
    const qr = screen.getByRole('img', { name: /QR Yape para pago asistido/i });
    expect(qr).toHaveAttribute('src', '/local-assets/qr_original.jpeg');
    expect(qr).toHaveClass('w-[480px]', 'max-w-full', 'h-auto', 'object-contain');
    expect(qr).not.toHaveClass('object-cover');
    expect(screen.getByText(/Monto exacto: S\/ 100\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/Código de Orden:/i)).toHaveTextContent('PAG-2026-000001');
    fireEvent.click(screen.getByRole('button', { name: /Ver QR ampliado/i }));
    expect(screen.getByRole('dialog', { name: /QR Yape ampliado/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /QR Yape ampliado para pago asistido/i })).toHaveClass('w-[640px]', 'max-w-full', 'object-contain');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /QR Yape ampliado/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver QR ampliado/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cerrar QR ampliado/i }));

    // Ingresar número de operación
    const inputYape = screen.getByPlaceholderText('Ej. 8493021');
    fireEvent.change(inputYape, { target: { value: '984321' } });

    // Confirmar
    fireEvent.click(screen.getByRole('button', { name: /Confirmar pago/i }));

    await waitFor(() => {
      expect(tesoreriaService.confirmarPago).toHaveBeenCalledWith('ord-1', {
        metodoPago: 'YAPE',
        montoRecibido: undefined,
        referenciaOperacion: '984321',
      });
    });
  });

  it('muestra un error claro si no se puede cargar el QR, sin simular otro código', async () => {
    render(<MemoryRouter><TesoreriaPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    fireEvent.click(screen.getByText(/Yape \/ QR Asistido/i));

    fireEvent.error(screen.getByRole('img', { name: /QR Yape para pago asistido/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el QR de Yape. Verifique el activo local o utilice pago en efectivo.');
    expect(screen.queryByText('QR YAPE')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Número de operación/i)).toBeInTheDocument();
  });

  it('5. Flujo de rechazo de orden: valida motivo mínimo y ejecuta rechazo', async () => {
    vi.mocked(tesoreriaService.rechazarPago).mockResolvedValueOnce({
      ok: true,
      mensaje: 'Orden rechazada',
      orden: { ...mockOrdenes[0], estado: 'RECHAZADO' as const, motivoRechazo: 'Desistimiento' },
    });

    render(
      <MemoryRouter>
        <TesoreriaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(screen.getByText('Rechazar Orden de Pago — PAG-2026-000001')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Indique la causa del rechazo/i);
    fireEvent.change(textarea, { target: { value: 'Desistimiento expreso del administrado' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Rechazo' }));

    await waitFor(() => {
      expect(tesoreriaService.rechazarPago).toHaveBeenCalledWith(
        'ord-1',
        'Desistimiento expreso del administrado'
      );
    });
  });

  it('muestra únicamente los tres métodos de cobro de la demo y no consulta TAYPI', async () => {
    render(<MemoryRouter><TesoreriaPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    expect(screen.getByRole('button', { name: /Efectivo en Ventanilla/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yape \/ QR Asistido/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /QR Automático — Simulador/i })).toHaveLength(1);
    expect(screen.queryByText(/Sandbox no configurado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TAYPI/i)).not.toBeInTheDocument();
  });

  it('muestra QR del simulador sin número de operación ni confirmación manual', async () => {
    render(<MemoryRouter><TesoreriaPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    fireEvent.click(screen.getByRole('button', { name: /QR Automático — Simulador/i }));
    await waitFor(() => expect(tesoreriaService.crearPagoDemoQr).toHaveBeenCalledWith('ord-1'));
    expect(await screen.findByRole('img', { name: 'QR del simulador de pago' })).toHaveAttribute('src', expect.stringContaining('data:image/png'));
    expect(screen.getAllByText(/No procesa dinero real/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Abrir checkout de simulación/i })).toHaveAttribute('href', 'https://demo.example.test/demo-pay/token-test');
    expect(screen.queryByLabelText(/Número de operación/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar pago manual/i })).not.toBeInTheDocument();
  });

  it('detecta confirmación demo por polling y rotula REC como simulación', async () => {
    vi.mocked(tesoreriaService.obtenerOrdenPorId).mockResolvedValue({
      ...mockOrdenes[0], estado: 'CONFIRMADO', metodoPago: 'QR_AUTOMATICO_SANDBOX',
      paymentProvider: 'DEMO_QR', confirmedSource: 'WEBHOOK', codigoRecibo: 'REC-2026-000099',
    });
    render(<MemoryRouter><TesoreriaPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    fireEvent.click(screen.getByRole('button', { name: /QR Automático — Simulador/i }));
    expect(await screen.findByText(/Pago confirmado automáticamente/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmación recibida mediante webhook del simulador/i)).toBeInTheDocument();
    expect(screen.queryByText(/webhook de TAYPI/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Ver constancia/i })[0]);
    expect((await screen.findAllByText(/Webhook del simulador/i)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/sin dinero real/i).length).toBeGreaterThan(0);
  });

  it('reabre una orden DEMO_QR confirmada con recibo y origen correctos', async () => {
    vi.mocked(tesoreriaService.listarOrdenes).mockResolvedValue({
      items: [{
        ...mockOrdenes[0], estado: 'CONFIRMADO', metodoPago: 'QR_AUTOMATICO_SANDBOX',
        paymentProvider: 'DEMO_QR', confirmedSource: 'WEBHOOK', codigoRecibo: 'REC-2026-000002',
      }], total: 1, page: 1, totalPages: 1,
    });
    render(<MemoryRouter><TesoreriaPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Recibo' }));
    expect(screen.getAllByText(/REC-2026-000002/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/QR Automático — Simulador \(sin dinero real\)/i)).toBeInTheDocument();
    expect(screen.getByText('Webhook del simulador')).toBeInTheDocument();
    expect(screen.queryByText(/TAYPI/i)).not.toBeInTheDocument();
  });
});
