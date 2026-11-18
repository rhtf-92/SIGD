import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BandejaExpedientesPage from '../../../src/pages/expedientes/BandejaExpedientesPage';
import { useAuthStore } from '../../../src/stores/authStore';
import { AREA_ID_SDA, AREA_ID_DIR } from '../../../src/utils/areaPresentacion';
import { tesoreriaService } from '../../../src/services/tesoreria.service';

vi.mock('../../../src/hooks/useBandejaExpedientes', () => ({
  useBandejaExpedientes: vi.fn(() => ({
    data: {
      elementos: [
        {
          idExpediente: '11111111-1111-1111-1111-111111111111',
          cut: 'EXP-2026-000001',
          asunto: 'Solicitud de Certificado de Estudios',
          fechaRadicacion: '2026-10-30T10:00:00.000Z',
          estadoActual: 'DERIVADO',
          areaActualId: AREA_ID_SDA,
          areaActualNombre: 'Subdirección Académica',
          areaActualCodigo: 'SDA',
        },
      ],
      siguienteCursor: null,
      tieneMas: false,
      contadores: {
        PENDIENTES: 0,
        EN_TRAMITE: 0,
        DERIVADOS: 1,
        POR_FIRMAR: 0,
        ATENDIDOS: 0,
        ARCHIVADOS: 0,
      },
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

describe('BandejaExpedientesPage — Adaptación visual y operativa por rol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ usuario: null, isAuthenticated: false, accessToken: null });
  });

  it('Mesa puede listar solicitudes DEV sin conocer el expediente', async () => {
    useAuthStore.setState({ usuario: {
      id: 'mesa-1', nombreCompleto: 'Operador Mesa', correo: 'mesa@test.local', rol: 'MESA_PARTES', areaId: AREA_ID_DIR,
    }, isAuthenticated: true });
    const listar = vi.spyOn(tesoreriaService, 'listarDevoluciones').mockResolvedValue({
      items: [{ solicitudDevolucionId: 'dev-1', codigoDev: 'DEV-2026-000001', codigoExpediente: 'EXP-2026-000001', expedienteId: '11111111-1111-1111-1111-111111111111', montoSolicitado: 50, estado: 'SOLICITADA' } as any],
      total: 1, page: 1, totalPages: 1,
    });
    render(<MemoryRouter initialEntries={['/expedientes']}><Routes><Route path="/expedientes" element={<BandejaExpedientesPage />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Solicitudes de devolución' }));
    await waitFor(() => expect(listar).toHaveBeenCalledWith({ estado: 'SOLICITADA', buscar: '', page: 1, limit: 20 }));
    expect(await screen.findByText(/DEV-2026-000001/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir expediente' })).toBeInTheDocument();
  });

  it('1. Para ESPECIALISTA: muestra título de Despacho y Calificación, badge SDA y área amigable sin exponer UUIDs en tabla', () => {
    useAuthStore.setState({
      usuario: {
        id: 'esp-1',
        nombreCompleto: 'Especialista Demo',
        correo: 'especialista@suiza.edu.pe',
        rol: 'ESPECIALISTA',
        areaId: AREA_ID_SDA,
      },
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/expedientes']}>
        <Routes>
          <Route path="/expedientes" element={<BandejaExpedientesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Título y rol
    expect(screen.getByRole('heading', { name: /Bandeja de expedientes — Despacho y Calificación/i })).toBeInTheDocument();
    expect(screen.getByText(/Subdirección Académica \(SDA\) — Evaluación, atención/i)).toBeInTheDocument();
    expect(screen.getByText('Especialista SDA')).toBeInTheDocument();

    // Debe mostrar la etiqueta con aclaración amigable
    expect(screen.getByText(/Área institucional/i)).toBeInTheDocument();
    expect(screen.getByText(/\(Subdirección Académica\)/i)).toBeInTheDocument();

    // En la tabla de expedientes debe mostrar el nombre "Subdirección Académica" y no el UUID crudo
    expect(screen.getByText('Subdirección Académica')).toBeInTheDocument();
    expect(screen.queryByText(AREA_ID_SDA)).not.toBeInTheDocument();
  });

  it('2. Para SECRETARIO: muestra título de Trámite y Derivación y badge Secretaría SDA', () => {
    useAuthStore.setState({
      usuario: {
        id: 'sec-1',
        nombreCompleto: 'Secretario Demo',
        correo: 'secretario@suiza.edu.pe',
        rol: 'SECRETARIO',
        areaId: AREA_ID_SDA,
      },
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/expedientes']}>
        <Routes>
          <Route path="/expedientes" element={<BandejaExpedientesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Bandeja de expedientes — Trámite y Derivación/i })).toBeInTheDocument();
    expect(screen.getByText('Secretaría SDA')).toBeInTheDocument();
  });

  it('3. Para ADMINISTRADOR: muestra título de Supervisión Global y selector de áreas institucionales', () => {
    useAuthStore.setState({
      usuario: {
        id: 'admin-1',
        nombreCompleto: 'Administrador Demo',
        correo: 'admin@suiza.edu.pe',
        rol: 'ADMINISTRADOR',
        areaId: AREA_ID_DIR,
      },
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/expedientes']}>
        <Routes>
          <Route path="/expedientes" element={<BandejaExpedientesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Bandeja de expedientes — Supervisión Institucional Global/i })).toBeInTheDocument();
    expect(screen.getByText('Supervisión Global (Administración)')).toBeInTheDocument();

    // Selector institucional de áreas presente
    const selectArea = screen.getByRole('combobox', { name: /Área UUID/i });
    expect(selectArea).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Todas las áreas \(Institucional Global\)/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Subdirección Académica \(SDA\)/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Dirección General \(DIR\)/i })).toBeInTheDocument();
  });

  it('4. Para MESA_PARTES: muestra título de Entrada y Derivación con badge de Mesa de Partes', () => {
    useAuthStore.setState({
      usuario: {
        id: 'mesa-1',
        nombreCompleto: 'Mesa Partes Demo',
        correo: 'mesapartes@suiza.edu.pe',
        rol: 'MESA_PARTES',
        areaId: AREA_ID_DIR,
      },
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/expedientes']}>
        <Routes>
          <Route path="/expedientes" element={<BandejaExpedientesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Bandeja de expedientes — Entrada y Derivación/i })).toBeInTheDocument();
    expect(screen.getByText('Mesa de Partes')).toBeInTheDocument();
    expect(screen.getByText(/Mesa de Partes \(DIR\) — Control de radicaciones/i)).toBeInTheDocument();
  });
});
