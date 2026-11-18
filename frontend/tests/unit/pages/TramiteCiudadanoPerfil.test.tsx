import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TramiteWizard } from '../../../src/components/tramite/TramiteWizard';
import { useAuthStore } from '../../../src/stores/authStore';
import { apiClient } from '../../../src/api/client';

const perfil = {
  idPersona: '33333333-3333-4333-8333-333333333333',
  tipoDocumento: 'DNI', numeroDocumento: '12345678',
  nombres: 'Ana María', apellidos: 'Pérez López',
  correo: 'ana@example.test', telefono: null, direccion: 'Av. Central 100',
};

describe('Trámite ciudadano: perfil de la cuenta', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({ accessToken: 'token-ciudadano', refreshToken: null, isAuthenticated: true,
      usuario: { id: 'u-a', idPersona: perfil.idPersona, nombreCompleto: 'Ana María Pérez López', correo: perfil.correo, rol: 'CIUDADANO' } });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => perfil });
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
    sessionStorage.clear();
  });

  it('precarga DNI y nombre, bloquea identidad y deja contacto editable', async () => {
    const user = userEvent.setup();
    const patch = vi.spyOn(apiClient, 'patch');
    render(<MemoryRouter><TramiteWizard /></MemoryRouter>);
    expect(screen.getByText('Cargando datos de tu cuenta...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Verifica tus datos' })).toBeInTheDocument());
    expect(screen.getByLabelText(/Tipo de Documento Oficial/i)).toBeDisabled();
    expect(screen.getByLabelText(/Número de Documento/i)).toHaveValue('12345678');
    expect(screen.getByLabelText(/Número de Documento/i)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/Nombres Completos/i)).toHaveValue('Ana María');
    expect(screen.getByLabelText(/Nombres Completos/i)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/Apellidos Completos/i)).toHaveValue('Pérez López');
    expect(screen.getByLabelText(/Apellidos Completos/i)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/Correo Electrónico Notificable/i)).toHaveValue('ana@example.test');
    expect(screen.getByLabelText(/Dirección Domiciliaria/i)).toHaveValue('Av. Central 100');
    expect(screen.getByText('Completa este dato para continuar.')).toBeInTheDocument();
    expect(screen.getByText(/Los cambios realizados aquí se aplican solo a esta solicitud/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Actualizar mi perfil' })).toHaveAttribute('href', '/mi-perfil?returnTo=%2Ftramite');
    await user.type(screen.getByLabelText(/Teléfono Celular/i), '987654321');
    expect(screen.getByLabelText(/Teléfono Celular/i)).toHaveValue('987654321');
    expect(patch).not.toHaveBeenCalled();
    patch.mockRestore();
  });

  it('no muestra identidad editable si falla la consulta de perfil', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    render(<MemoryRouter><TramiteWizard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo consultar el perfil/i));
    expect(screen.queryByLabelText(/Número de Documento/i)).not.toBeInTheDocument();
  });

  it('un trámite nuevo toma teléfono y dirección actualizados desde /auth/me', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      ...perfil, telefono: '912345678', direccion: 'Av. Actualizada 250', correo: 'nuevo@example.test',
    }) });
    render(<MemoryRouter><TramiteWizard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Verifica tus datos' })).toBeInTheDocument());
    expect(screen.getByLabelText(/Teléfono Celular/i)).toHaveValue('912345678');
    expect(screen.getByLabelText(/Dirección Domiciliaria/i)).toHaveValue('Av. Actualizada 250');
    expect(screen.getByLabelText(/Correo Electrónico Notificable/i)).toHaveValue('nuevo@example.test');
  });
});
