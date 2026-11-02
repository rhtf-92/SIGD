// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MesaPartesDigitalPage from '../../../src/pages/tramite/MesaPartesDigitalPage';
import ConsultaPublicaPage from '../../../src/pages/tramite/ConsultaPublicaPage';
import MisExpedientesPage from '../../../src/pages/tramite/MisExpedientesPage';
import BandejaExpedientesPage from '../../../src/pages/expedientes/BandejaExpedientesPage';
import { apiClient } from '../../../src/api/client';
import { useAuthStore } from '../../../src/stores/authStore';
import { AREA_ID_DIR } from '../../../src/utils/areaPresentacion';

vi.mock('../../../src/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../src/hooks/useBandejaExpedientes', () => ({
  useBandejaExpedientes: vi.fn(() => ({
    data: {
      elementos: [],
      siguienteCursor: null,
      tieneMas: false,
      contadores: {
        PENDIENTES: 0,
        EN_TRAMITE: 0,
        DERIVADOS: 0,
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

describe('SIGD 2026 — FASE 2: Mesa de Partes Digital Pública, Consulta Segura y Vinculación Histórica', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Mesa de Partes Digital Pública (/mesa-partes)', () => {
    it('renderiza la cabecera institucional y el paso inicial de identificación ciudadana sin requerir autenticación', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [],
      });

      render(
        <MemoryRouter initialEntries={['/mesa-partes']}>
          <Routes>
            <Route path="/mesa-partes" element={<MesaPartesDigitalPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Mesa de Partes Digital/i })).toBeInTheDocument();
      expect(screen.getByText(/Sin Necesidad de Cuenta Previa/i)).toBeInTheDocument();
      expect(screen.getByText('Paso 1: Identificación y Contacto del Solicitante')).toBeInTheDocument();
      expect(screen.getByText(/Tipo de Solicitante/i)).toBeInTheDocument();
      expect(screen.getByText(/Número de Documento/i)).toBeInTheDocument();
    });
  });

  describe('2. Consulta Pública Segura (/consulta)', () => {
    it('exige tanto el código CUT como el documento de identidad para proteger los datos (Ley 29733)', async () => {
      render(
        <MemoryRouter initialEntries={['/consulta']}>
          <Routes>
            <Route path="/consulta" element={<ConsultaPublicaPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Consulta Pública de Trámites y Expedientes')).toBeInTheDocument();
      expect(screen.getByLabelText(/Código Único de Trámite \(CUT\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Documento del Solicitante/i)).toBeInTheDocument();

      const btnConsultar = screen.getByRole('button', { name: /Consultar Estado/i });
      fireEvent.click(btnConsultar);

      // No dispara consulta a API si los campos requeridos no están provistos
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('realiza la consulta con ambos parámetros y presenta la información de seguimiento amigable', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          cut: 'EXP-2026-000020',
          anioFiscal: 2026,
          estadoTramite: 'REGISTRADO',
          tipoTramite: 'Certificado de Estudios',
          asunto: 'Solicitud de certificado oficial',
          fechaEnvioReal: '2026-10-31T10:00:00.000Z',
          fechaRadicacionLegal: '2026-10-31T10:00:00.000Z',
          fueraDeHorario: false,
          canalRecepcion: 'MESA_PARTES_DIGITAL',
          totalFolios: 5,
          areaActual: 'Subdirección Académica',
          pasoSiguiente: 'Expediente registrado en Mesa de Partes, pendiente de revisión.',
          estadoPago: 'CONFIRMADO',
          administrado: {
            documentoEnmascarado: '45***123',
            nombreEnmascarado: 'JUAN P*** P***',
          },
          documentos: [
            {
              nombreArchivo: 'solicitud.pdf',
              contentType: 'application/pdf',
              hashSha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            },
          ],
          proveidos: [],
          mensajeLegal: 'Trámite digital protegido conforme a la Ley N° 27444 y Ley N° 29733.',
        },
      });

      render(
        <MemoryRouter initialEntries={['/consulta/EXP-2026-000020?documento=45678123']}>
          <Routes>
            <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          '/api/v1/tramites/consulta-publica/EXP-2026-000020',
          { params: { documento: '45678123' } }
        );
      });

      expect(screen.getByText('EXP-2026-000020')).toBeInTheDocument();
      expect(screen.getByText('Subdirección Académica')).toBeInTheDocument();
      expect(screen.getByText(/5 folios certificados/i)).toBeInTheDocument();
      expect(screen.getByText(/Tasa Pagada/i)).toBeInTheDocument();
      expect(screen.getByText('solicitud.pdf')).toBeInTheDocument();
    });
  });

  describe('3. Vinculación Histórica en Mis Expedientes (MisExpedientesPage)', () => {
    beforeEach(() => {
      useAuthStore.setState({
        accessToken: 'jwt-token-ciudadano',
        refreshToken: null,
        isAuthenticated: true,
        usuario: {
          id: 'u-ciudadano-1',
          nombreCompleto: 'Ciudadano Registrado',
          correo: 'ciudadano@test.pe',
          rol: 'CIUDADANO',
        },
      });
    });

    it('permite al ciudadano abrir el modal de vinculación y enviar una solicitud con su CUT previo', async () => {
      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes('/mis-expedientes')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/mis-solicitudes')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: {} });
      });

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          solicitudId: 'sol-123',
          expedienteId: 'exp-123',
          cut: 'EXP-2026-000010',
          estado: 'PENDIENTE',
          mensaje: 'Solicitud de vinculación enviada exitosamente.',
        },
      });

      render(
        <MemoryRouter initialEntries={['/mis-expedientes']}>
          <Routes>
            <Route path="/mis-expedientes" element={<MisExpedientesPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Aún no tienes expedientes radicados/i)).toBeInTheDocument();
      });

      // Botón para vincular
      const btnVincular = screen.getByRole('button', { name: /🔗 Vincular Trámite Previo/i });
      expect(btnVincular).toBeInTheDocument();
      fireEvent.click(btnVincular);

      // Modal abierto
      expect(screen.getByRole('heading', { name: /Vincular Trámite Previo/i })).toBeInTheDocument();

      const inputCut = screen.getByLabelText(/Código Único de Trámite \(CUT\)/i);
      fireEvent.change(inputCut, { target: { value: 'EXP-2026-000010' } });

      const btnEnviar = screen.getByRole('button', { name: /Enviar Solicitud/i });
      fireEvent.click(btnEnviar);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/tramites/vinculaciones', {
          cut: 'EXP-2026-000010',
          motivo: undefined,
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Solicitud de vinculación enviada exitosamente/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('4. Bandeja de Expedientes: Gestión de Vinculaciones (Mesa de Partes / Admin)', () => {
    it('muestra el botón de Solicitudes de Vinculación para MESA_PARTES y permite resolver solicitudes', async () => {
      useAuthStore.setState({
        accessToken: 'jwt-token-mesa',
        refreshToken: null,
        isAuthenticated: true,
        usuario: {
          id: 'u-mesa-1',
          nombreCompleto: 'Operador Mesa de Partes',
          correo: 'mesa@suiza.edu.pe',
          rol: 'MESA_PARTES',
          areaId: AREA_ID_DIR,
        },
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [
          {
            solicitudId: 'sol-001',
            expedienteId: 'exp-001',
            cut: 'EXP-2026-000005',
            idUsuario: 'usr-999',
            motivo: 'Trámite presencial previo',
            estado: 'PENDIENTE',
            fechaSolicitud: '2026-10-31T09:00:00Z',
            solicitanteNombre: 'Maria Perez',
            solicitanteDocumento: '44556677',
            solicitanteTipoDocumento: 'DNI',
            usuarioLogin: 'mariap',
            usuarioCorreo: 'maria@test.com',
          },
        ],
      });

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          solicitudId: 'sol-001',
          decision: 'APROBADA',
          mensaje: 'Solicitud aprobada y expediente vinculado con éxito.',
        },
      });

      render(
        <MemoryRouter initialEntries={['/expedientes']}>
          <Routes>
            <Route path="/expedientes" element={<BandejaExpedientesPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Botón visible con indicador de cantidad
      const btnSolicitudes = await screen.findByRole('button', { name: /Solicitudes de Vinculación/i });
      expect(btnSolicitudes).toBeInTheDocument();
      expect(within(btnSolicitudes).getByText('1')).toBeInTheDocument();

      fireEvent.click(btnSolicitudes);

      // Modal de revisión de solicitudes de vinculación abierto
      expect(screen.getByRole('heading', { name: /Solicitudes de Vinculación de Trámites Previos/i })).toBeInTheDocument();
      expect(screen.getByText('EXP-2026-000005')).toBeInTheDocument();
      expect(screen.getByText('Maria Perez')).toBeInTheDocument();
      expect(screen.getByText('mariap')).toBeInTheDocument();

      // Botón Aprobar
      const btnAprobar = screen.getByRole('button', { name: /✓ Aprobar Vinculación/i });
      fireEvent.click(btnAprobar);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/api/v1/tramites/vinculaciones/sol-001/resolver',
          {
            decision: 'APROBADA',
            motivoRechazo: undefined,
          }
        );
      });
    });
  });
});
