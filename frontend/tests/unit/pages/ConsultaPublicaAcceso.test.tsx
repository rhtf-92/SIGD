import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../src/api/client';
import CasillaElectronicaPage from '../../../src/pages/casilla/CasillaElectronicaPage';
import HomePage from '../../../src/pages/HomePage';
import ConsultaPublicaPage, {
  type DtoConsultaPublica,
} from '../../../src/pages/tramite/ConsultaPublicaPage';
import TramitePage from '../../../src/pages/tramite/TramitePage';
import { casillaService } from '../../../src/services/casillaService';
import { useAuthStore } from '../../../src/stores/authStore';

const respuestaConsultaMock: DtoConsultaPublica = {
  cut: 'EXP-2026-000003',
  anioFiscal: 2026,
  estadoTramite: 'RECEPCIONADO',
  tipoTramite: 'Expedición de Título Profesional Técnico',
  asunto: 'Solicitud de expedición de título profesional técnico',
  fechaEnvioReal: '2026-11-06T20:19:22.226Z',
  fechaRadicacionLegal: '2026-11-06T20:19:22.226Z',
  fueraDeHorario: false,
  canalRecepcion: 'MESA_VIRTUAL',
  totalFolios: 1,
  administrado: {
    documentoEnmascarado: '00***001',
    nombreEnmascarado: 'A**** B*****',
  },
  documentos: [
    {
      nombreArchivo: 'tupac.pdf',
      contentType: 'application/pdf',
      hashSha256:
        '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
    },
  ],
  proveidos: [],
  mensajeLegal:
    'Informacion publica pursuant a la Ley N° 29733. Los datos personales han sido enmascarados.',
};

describe('Acceso público sin cuenta para consulta de documentación', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
      selectionToken: null,
      rolesDisponibles: [],
      usuarioPendiente: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ConsultaPublicaPage consulta por CUT sin autenticación y valida campo vacío', async () => {
    const user = userEvent.setup();
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: respuestaConsultaMock });

    render(
      <MemoryRouter initialEntries={['/consulta']}>
        <Routes>
          <Route path="/consulta" element={<ConsultaPublicaPage />} />
          <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const boton = screen.getByRole('button', { name: /Consultar Estado/i });
    await user.click(boton);

    expect(
      await screen.findByText(/Por favor, ingrese un código CUT válido\./i),
    ).toBeInTheDocument();
    expect(getSpy).not.toHaveBeenCalled();

    const input = screen.getByLabelText(/Código Único de Trámite \(CUT\)/i);
    await user.type(input, 'exp-2026-000003');
    await user.click(boton);

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith(
        '/api/v1/tramites/consulta-publica/EXP-2026-000003',
      );
    });

    expect(await screen.findByText('RECEPCIONADO')).toBeInTheDocument();
    expect(
      screen.getByText('Solicitud de expedición de título profesional técnico'),
    ).toBeInTheDocument();
    expect(screen.getByText(/A\*\*\*\* B\*\*\*\*\*/)).toBeInTheDocument();
    expect(screen.getByText('tupac.pdf')).toBeInTheDocument();

    const progreso = screen.getByRole('list', {
      name: /Progreso del trámite/i,
    });
    expect(progreso).toBeInTheDocument();
    expect(progreso).toHaveTextContent('Recepcionado');
    expect(progreso).toHaveTextContent('En evaluación');
    expect(progreso).toHaveTextContent('Resuelto');
    expect(progreso).toHaveTextContent('Notificado / Archivado');
    expect(
      screen.getByRole('button', { name: /Copiar CUT/i }),
    ).toBeInTheDocument();
  });

  it('CasillaElectronicaPage sin sesión no llama a casillaService y permite consultar por CUT', async () => {
    const user = userEvent.setup();
    const notifSpy = vi.spyOn(casillaService, 'getNotificaciones');
    const statsSpy = vi.spyOn(casillaService, 'getEstadisticas');
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: respuestaConsultaMock });

    render(
      <MemoryRouter initialEntries={['/casilla']}>
        <CasillaElectronicaPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: /Casilla Electrónica — Consulta Pública/i,
      }),
    ).toBeInTheDocument();
    expect(notifSpy).not.toHaveBeenCalled();
    expect(statsSpy).not.toHaveBeenCalled();

    expect(
      screen.getByRole('link', { name: /Iniciar sesión en mi Casilla/i }),
    ).toHaveAttribute('href', '/login');
    expect(
      screen.getByRole('link', { name: /Crear cuenta ciudadana/i }),
    ).toHaveAttribute('href', '/registro');

    const input = screen.getByLabelText(/Código Único de Trámite \(CUT\)/i);
    await user.type(input, 'EXP-2026-000003');
    await user.click(screen.getByRole('button', { name: /Consultar Estado/i }));

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith(
        '/api/v1/tramites/consulta-publica/EXP-2026-000003',
      );
    });

    expect(await screen.findByText('RECEPCIONADO')).toBeInTheDocument();
    expect(screen.getByText('tupac.pdf')).toBeInTheDocument();
    expect(notifSpy).not.toHaveBeenCalled();
    expect(statsSpy).not.toHaveBeenCalled();
  });

  it('TramitePage sin sesión muestra consulta pública por CUT, catálogo TUPA y accesos a login/registro', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          codigo: 'TUPA-01',
          denominacion: 'Expedición de Título Profesional Técnico',
          unidad_organica: 'Secretaría Académica',
          plazo_dias: 15,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/tramite']}>
        <TramitePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: /Mesa de Partes Virtual — Consulta Pública y Catálogo TUPA/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Código Único de Trámite \(CUT\)/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith(
        '/api/v1/tramites/tupa',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    expect(
      await screen.findByText('Expedición de Título Profesional Técnico'),
    ).toBeInTheDocument();
    expect(screen.getByText(/15 días hábiles/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Iniciar sesión para radicar/i }),
    ).toHaveAttribute('href', '/login');
    expect(
      screen.getByRole('link', {
        name: /Registrarme como ciudadano\/estudiante/i,
      }),
    ).toHaveAttribute('href', '/registro');
  });

  it('HomePage sin sesión renderiza la tarjeta Consulta de Trámites apuntando a /consulta', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const tarjetaConsulta = screen.getByRole('link', {
      name: /Consulta de Trámites/i,
    });
    expect(tarjetaConsulta).toHaveAttribute('href', '/consulta');
  });
});
