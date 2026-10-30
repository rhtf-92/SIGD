import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MiPerfilPage from '../../../src/pages/tramite/MiPerfilPage';
import { apiClient } from '../../../src/api/client';
import { useAuthStore } from '../../../src/stores/authStore';

const legacy = {
  id: '11111111-1111-4111-8111-111111111111',
  idPersona: '22222222-2222-4222-8222-222222222222',
  username: '12345678', usernameConfigurado: false,
  tipoDocumento: 'DNI', numeroDocumento: '12345678',
  nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@example.test',
  telefono: '987654321', direccion: 'Av. Central 100',
};

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'token-ciudadano', refreshToken: null, isAuthenticated: true,
    usuario: { id: legacy.id, idPersona: legacy.idPersona, nombreCompleto: 'Ana Pérez', correo: legacy.correo, rol: 'CIUDADANO' } });
});
afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ accessToken: null, refreshToken: null, isAuthenticated: false, usuario: null });
});

describe('Mi perfil ciudadano', () => {
  it('muestra username legacy como no configurado, identidad solo lectura y contacto editable', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: legacy } as never);
    render(<MemoryRouter><MiPerfilPage /></MemoryRouter>);
    expect(await screen.findByText('No configurado')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de documento')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Número de documento')).toHaveValue('12345678');
    expect(screen.getByLabelText('Número de documento')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Nombres')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Apellidos')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('987654321');
    expect(screen.getByLabelText('Dirección')).toHaveValue('Av. Central 100');
  });

  it('permite agregar username opcional y actualizar contacto de la cuenta propia', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: legacy } as never)
      .mockResolvedValueOnce({ data: { ...legacy, username: 'ana.perez', usernameConfigurado: true,
        correo: 'nuevo@example.test', telefono: '912345678', direccion: 'Av. Central 200' } } as never);
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({ status: 204 } as never);
    render(<MemoryRouter><MiPerfilPage /></MemoryRouter>);
    await screen.findByText('No configurado');
    await user.type(screen.getByPlaceholderText(/Agregar nombre de usuario/i), '  Ana.Perez  ');
    await user.clear(screen.getByLabelText('Correo'));
    await user.type(screen.getByLabelText('Correo'), 'NUEVO@example.test');
    await user.clear(screen.getByLabelText('Teléfono'));
    await user.type(screen.getByLabelText('Teléfono'), '912345678');
    await user.clear(screen.getByLabelText('Dirección'));
    await user.type(screen.getByLabelText('Dirección'), 'Av. Central 200');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/v1/auth/me', {
      username: 'ana.perez', correo: 'nuevo@example.test', telefono: '912345678', direccion: 'Av. Central 200',
    }, expect.any(Object)));
    expect(get).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Perfil actualizado correctamente.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de usuario')).toHaveValue('ana.perez');
    expect(screen.getByLabelText('Nombre de usuario')).toHaveAttribute('readonly');
  });

  it('muestra conflicto de username sin éxito falso', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: legacy } as never);
    vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('Este nombre de usuario ya está en uso.'));
    render(<MemoryRouter><MiPerfilPage /></MemoryRouter>);
    await screen.findByText('No configurado');
    await user.type(screen.getByPlaceholderText(/Agregar nombre de usuario/i), 'ocupado.test');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Este nombre de usuario ya está en uso.');
    expect(screen.queryByText('Perfil actualizado correctamente.')).not.toBeInTheDocument();
  });

  it('deja al usuario nuevo con username fijo y el contacto editable', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { ...legacy, username: 'ana.perez', usernameConfigurado: true } } as never);
    render(<MemoryRouter><MiPerfilPage /></MemoryRouter>);
    expect(await screen.findByLabelText('Nombre de usuario')).toHaveValue('ana.perez');
    expect(screen.queryByText('No configurado')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('readonly');
  });

  it('conserva el retorno seguro al trámite cuando se llega desde el Paso 1', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: legacy } as never);
    render(<MemoryRouter initialEntries={['/mi-perfil?returnTo=%2Ftramite']}><MiPerfilPage /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Volver al trámite' })).toHaveAttribute('href', '/tramite');
  });
});
