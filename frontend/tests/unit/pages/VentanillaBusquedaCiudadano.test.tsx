import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VentanillaPresencialPage from '../../../src/pages/tramite/VentanillaPresencialPage';
import { tesoreriaService } from '../../../src/services/tesoreria.service';
import { useAuthStore } from '../../../src/stores/authStore';

vi.mock('../../../src/services/procedimientosTupa.service', () => ({
  obtenerCatalogoTupaCompleto: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/services/tesoreria.service', () => ({
  tesoreriaService: {
    buscarPersonaPresencial: vi.fn(),
  },
}));

describe('VentanillaPresencialPage — Búsqueda Administrativa de Ciudadano', () => {
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
      exito: true,
      datos: {
        idPersona: '11111111-3333-4444-5555-666666666666',
        nombres: 'Geric',
        apellidos: 'Vargas',
        nombreCompleto: 'Geric Vargas',
        documentoEnmascarado: '••••5678',
        tipoDocumento: 'DNI',
        numeroDocumento: '72345678',
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
    expect(screen.getByText(/Cuenta de usuario: Activa/i)).toBeInTheDocument();

    // Checkbox de documento físico verificado
    const checkboxFisico = screen.getByLabelText(/Doc\. físico verificado/i) as HTMLInputElement;
    expect(checkboxFisico).toBeInTheDocument();
    expect(checkboxFisico.checked).toBe(true);
  });

  it('2. Búsqueda sin coincidencias muestra aviso informativo para digitación manual', async () => {
    vi.mocked(tesoreriaService.buscarPersonaPresencial).mockResolvedValueOnce({
      exito: true,
      datos: null,
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
      expect(screen.getByText(/No se encontró registro previo en la base institucional/i)).toBeInTheDocument();
    });
  });
});
