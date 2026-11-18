import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VentanillaPresencialPage from '../../../src/pages/tramite/VentanillaPresencialPage';
import { tesoreriaService } from '../../../src/services/tesoreria.service';
import { useAuthStore } from '../../../src/stores/authStore';

vi.mock('../../../src/services/tesoreria.service', () => ({
  tesoreriaService: {
    buscarPersonaPresencial: vi.fn(),
    registrarPersonaPresencial: vi.fn(),
  },
}));

vi.mock('../../../src/services/procedimientosTupa.service', () => ({
  obtenerCatalogoTupaCompleto: vi.fn().mockResolvedValue([]),
}));

describe('Ventanilla Presencial - Búsqueda y Registro Administrativo por Documento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'jwt-mp',
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

  it('1. Búsqueda de ciudadano registrado por DNI autocompleta nombres y activa verificación física', async () => {
    vi.mocked(tesoreriaService.buscarPersonaPresencial).mockResolvedValueOnce({
      encontrada: true,
      persona: {
        idPersona: '11111111-3333-4444-5555-666666666666',
        tipoPersona: 'NATURAL',
        nombres: 'Geric',
        apellidos: 'Vargas',
        nombreCompleto: 'Geric Vargas',
        documentoEnmascarado: '••••5678',
        tipoDocumento: 'DNI',
        numeroDocumento: '72345678',
        correo: 'geric@test.pe',
        telefono: '987654321',
        tieneCuentaUsuario: true,
      },
    });

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>
    );

    const inputDoc = screen.getByLabelText(/Número de Documento \*/i);
    fireEvent.change(inputDoc, { target: { value: '72345678' } });

    const btnBuscar = screen.getByRole('button', { name: 'Buscar' });
    fireEvent.click(btnBuscar);

    await waitFor(() => {
      expect(tesoreriaService.buscarPersonaPresencial).toHaveBeenCalledWith('DNI', '72345678');
    });

    // Debe autocompletar el campo de nombres
    const inputNombre = screen.getByLabelText(/Apellidos y Nombres \*/i) as HTMLInputElement;
    expect(inputNombre.value).toBe('Geric Vargas');

    // Debe mostrar banner informativo
    expect(screen.getByText(/✓ Administrado registrado encontrado: Geric Vargas/i)).toBeInTheDocument();
    expect(screen.getByText(/Cuenta web:/i)).toBeInTheDocument();

    // Checkbox de documento físico verificado
    const checkboxFisico = screen.getByLabelText(/Doc\. físico verificado/i) as HTMLInputElement;
    expect(checkboxFisico).toBeInTheDocument();
    expect(checkboxFisico.checked).toBe(true);
  });

  it('2. Búsqueda sin coincidencias muestra aviso informativo y habilita formulario de registro', async () => {
    vi.mocked(tesoreriaService.buscarPersonaPresencial).mockResolvedValueOnce({
      encontrada: false,
      persona: null,
    });

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>
    );

    const inputDoc = screen.getByLabelText(/Número de Documento \*/i);
    fireEvent.change(inputDoc, { target: { value: '00000000' } });

    const btnBuscar = screen.getByRole('button', { name: 'Buscar' });
    fireEvent.click(btnBuscar);

    await waitFor(() => {
      expect(screen.getByText(/No existe un administrado registrado. Puede registrarlo para continuar la atención presencial./i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Registrar Administrado para Atención Presencial/i)).toBeInTheDocument();
  });

  it('3. Alta de administrado nuevo sin cuenta registra y autocompleta el formulario', async () => {
    vi.mocked(tesoreriaService.buscarPersonaPresencial).mockResolvedValueOnce({
      encontrada: false,
      persona: null,
    });

    vi.mocked(tesoreriaService.registrarPersonaPresencial).mockResolvedValueOnce({
      ok: true,
      mensaje: 'Administrado registrado exitosamente sin cuenta de usuario.',
      persona: {
        idPersona: '22222222-3333-4444-5555-666666666666',
        tipoPersona: 'NATURAL',
        nombres: 'María',
        apellidos: 'Ríos López',
        nombreCompleto: 'María Ríos López',
        documentoEnmascarado: '••••1234',
        tipoDocumento: 'DNI',
        numeroDocumento: '71112233',
        correo: 'maria.rios@example.test',
        telefono: '999888777',
        direccion: 'Av. Las Palmas 500',
        tieneCuentaUsuario: false,
      },
    });

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>
    );

    const inputDoc = screen.getByLabelText(/Número de Documento \*/i);
    fireEvent.change(inputDoc, { target: { value: '71112233' } });

    const btnBuscar = screen.getByRole('button', { name: 'Buscar' });
    fireEvent.click(btnBuscar);

    await waitFor(() => {
      expect(screen.getByText(/Registrar Administrado para Atención Presencial/i)).toBeInTheDocument();
    });

    const inputNombres = screen.getByPlaceholderText(/Nombres del administrado/i);
    const inputApellidos = screen.getByPlaceholderText(/Apellidos completos/i);
    fireEvent.change(inputNombres, { target: { value: 'María' } });
    fireEvent.change(inputApellidos, { target: { value: 'Ríos López' } });

    const btnRegistrar = screen.getByRole('button', { name: /Registrar y Continuar/i });
    fireEvent.click(btnRegistrar);

    await waitFor(() => {
      expect(tesoreriaService.registrarPersonaPresencial).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/✓ Administrado registrado exitosamente: María Ríos López/i)).toBeInTheDocument();
    });

    const inputNombrePrincipal = screen.getByLabelText(/Apellidos y Nombres \*/i) as HTMLInputElement;
    expect(inputNombrePrincipal.value).toBe('María Ríos López');
  });
});
