import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UbigeoSelector } from '../../../src/components/common/UbigeoSelector';
import { apiClient } from '../../../src/api/client';
import { clearUbigeoCache } from '../../../src/services/ubigeoService';

const FIXTURE_PROVINCIAS_UCAYALI = [
  { id: '2501', nombre: 'CORONEL PORTILLO', padreId: '25' },
  { id: '2502', nombre: 'ATALAYA', padreId: '25' },
  { id: '2503', nombre: 'PADRE ABAD', padreId: '25' },
  { id: '2504', nombre: 'PURUS', padreId: '25' },
];

const FIXTURE_DISTRITOS_UCAYALI: Record<string, Array<{ id: string; nombre: string; padreId: string }>> = {
  '2501': [
    { id: '250101', nombre: 'CALLERIA', padreId: '2501' },
    { id: '250102', nombre: 'CAMPOVERDE', padreId: '2501' },
    { id: '250103', nombre: 'IPARIA', padreId: '2501' },
    { id: '250104', nombre: 'MASISEA', padreId: '2501' },
    { id: '250105', nombre: 'YARINACOCHA', padreId: '2501' },
    { id: '250106', nombre: 'NUEVA REQUENA', padreId: '2501' },
    { id: '250107', nombre: 'MANANTAY', padreId: '2501' },
  ],
  '2502': [
    { id: '250201', nombre: 'RAIMONDI', padreId: '2502' },
    { id: '250202', nombre: 'SEPAHUA', padreId: '2502' },
    { id: '250203', nombre: 'TAHUANIA', padreId: '2502' },
    { id: '250204', nombre: 'YURUA', padreId: '2502' },
  ],
  '2503': [
    { id: '250301', nombre: 'PADRE ABAD', padreId: '2503' },
    { id: '250302', nombre: 'IRAZOLA', padreId: '2503' },
    { id: '250303', nombre: 'CURIMANA', padreId: '2503' },
    { id: '250304', nombre: 'NESHUYA', padreId: '2503' },
    { id: '250305', nombre: 'ALEXANDER VON HUMBOLDT', padreId: '2503' },
  ],
  '2504': [
    { id: '250401', nombre: 'PURUS', padreId: '2504' },
  ],
};

describe('UbigeoSelector - Pruebas Unitarias ENT-M01-02 (Arquitectura Dinámica)', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    clearUbigeoCache();

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/ubigeo/provincias')) {
        return {
          data: FIXTURE_PROVINCIAS_UCAYALI.map((p) => ({
            codigo: p.id,
            nombre: p.nombre,
            departamentoCodigo: '25',
          })),
        } as never;
      }
      if (url.includes('/api/v1/ubigeo/distritos')) {
        const match = url.match(/provinciaCodigo=([^&]+)/);
        const prov = match ? decodeURIComponent(match[1]) : '';
        const dists = FIXTURE_DISTRITOS_UCAYALI[prov] || [];
        return {
          data: dists.map((d) => ({
            codigo: d.id,
            nombre: d.nombre,
            provinciaCodigo: prov,
          })),
        } as never;
      }
      return { data: [] } as never;
    });
  });

  it('1. Debe renderizar el departamento Ucayali como predeterminado e inmutable', () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectDept = screen.getByLabelText(/Departamento seleccionado/i) as HTMLSelectElement;
    expect(selectDept).toBeInTheDocument();
    expect(selectDept.value).toBe('25');
    expect(selectDept).toBeDisabled();
  });

  it('2. Debe renderizar el badge con el código INEI inicial (25)', () => {
    render(<UbigeoSelector onChange={mockOnChange} showCodeBadge={true} />);
    
    expect(screen.getByText(/INEI: 25/i)).toBeInTheDocument();
  });

  it('3. Debe cargar las 4 provincias de Ucayali en el selector de provincia dinámicamente', async () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i);
    expect(selectProv).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /CORONEL PORTILLO/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /ATALAYA/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /PADRE ABAD/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /PURUS/i })).toBeInTheDocument();
    });
  });

  it('4. Debe mantener deshabilitado el selector de distrito si no hay provincia seleccionada', () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i);
    expect(selectDist).toBeDisabled();
  });

  it('5. Debe habilitar distritos y permitir seleccionar provincia y distrito correctamente', async () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /CORONEL PORTILLO/i })).toBeInTheDocument();
    });

    fireEvent.change(selectProv, { target: { value: '2501' } }); // Coronel Portillo

    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i) as HTMLSelectElement;
    await waitFor(() => {
      expect(selectDist).not.toBeDisabled();
      expect(screen.getByRole('option', { name: /YARINACOCHA/i })).toBeInTheDocument();
    });

    fireEvent.change(selectDist, { target: { value: '250105' } }); // Yarinacocha
    expect(selectDist.value).toBe('250105');
  });

  it('6. Debe emitir el código INEI de 6 dígitos completo al seleccionar un distrito', async () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /CORONEL PORTILLO/i })).toBeInTheDocument();
    });

    fireEvent.change(selectProv, { target: { value: '2501' } });

    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /YARINACOCHA/i })).toBeInTheDocument();
    });

    fireEvent.change(selectDist, { target: { value: '250105' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      '250105',
      expect.objectContaining({
        ubigeoCod: '250105',
        departamento: expect.objectContaining({ id: '25' }),
        provincia: expect.objectContaining({ id: '2501' }),
        distrito: expect.objectContaining({ id: '250105' }),
      })
    );
  });

  it('7. Debe limpiar la selección de distrito al cambiar la provincia seleccionada', async () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /CORONEL PORTILLO/i })).toBeInTheDocument();
    });

    fireEvent.change(selectProv, { target: { value: '2501' } });
    
    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i) as HTMLSelectElement;
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /CALLERIA/i })).toBeInTheDocument();
    });

    fireEvent.change(selectDist, { target: { value: '250101' } });
    expect(selectDist.value).toBe('250101');

    // Cambiar provincia a Atalaya (2502)
    fireEvent.change(selectProv, { target: { value: '2502' } });
    expect(selectDist.value).toBe('');
  });

  it('8. Debe resetear completamente la provincia y el distrito al presionar el botón de limpiar', async () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i) as HTMLSelectElement;
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /CORONEL PORTILLO/i })).toBeInTheDocument();
    });

    fireEvent.change(selectProv, { target: { value: '2501' } });

    const btnLimpiar = screen.getByRole('button', { name: /Restablecer selección de Ubigeo/i });
    await waitFor(() => {
      expect(btnLimpiar).not.toBeDisabled();
    });

    fireEvent.click(btnLimpiar);

    await waitFor(() => {
      expect(selectProv.value).toBe('');
      expect(screen.queryByRole('button', { name: /Restablecer selección de Ubigeo/i })).not.toBeInTheDocument();
    });
  });
});

describe('Suite de Pruebas de Renderizado de UbigeoSelector (ENT-M01-02 / ENT-M01-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearUbigeoCache();

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/ubigeo/provincias')) {
        return {
          data: FIXTURE_PROVINCIAS_UCAYALI.map((p) => ({
            codigo: p.id,
            nombre: p.nombre,
            departamentoCodigo: '25',
          })),
        } as never;
      }
      if (url.includes('/api/v1/ubigeo/distritos')) {
        const match = url.match(/provinciaCodigo=([^&]+)/);
        const prov = match ? decodeURIComponent(match[1]) : '';
        const dists = FIXTURE_DISTRITOS_UCAYALI[prov] || [];
        return {
          data: dists.map((d) => ({
            codigo: d.id,
            nombre: d.nombre,
            provinciaCodigo: prov,
          })),
        } as never;
      }
      return { data: [] } as never;
    });
  });

  it('Render de UbigeoSelector; al recorrer las 4 provincias, el total de <option> de distrito emitidas debe ser exactamente 17', async () => {
    const user = userEvent.setup();
    render(<UbigeoSelector />);

    const selectProvincia = screen.getByLabelText(
      /Seleccionar Provincia de Ucayali/i,
    );
    const selectDistrito = screen.getByLabelText(/Seleccionar Distrito/i);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /CORONEL PORTILLO/i })).toBeInTheDocument();
    });

    const distritosVistos = new Set<string>();
    let conteoTotalOpcionesDistrito = 0;

    for (const provincia of FIXTURE_PROVINCIAS_UCAYALI) {
      await user.selectOptions(selectProvincia, provincia.id);

      await waitFor(() => {
        const opciones = Array.from(
          selectDistrito.querySelectorAll('option'),
        ).filter((opt) => opt.value !== '');
        expect(opciones.length).toBeGreaterThan(0);
      });

      const opciones = Array.from(
        selectDistrito.querySelectorAll('option'),
      ).filter((opt) => opt.value !== '');

      conteoTotalOpcionesDistrito += opciones.length;
      opciones.forEach((opt) => distritosVistos.add(opt.value));
    }

    expect(conteoTotalOpcionesDistrito).toBe(17);
    expect(distritosVistos.size).toBe(17);
  });

  it('Al cambiar de provincia, el distrito seleccionado se resetea a ""', async () => {
    const user = userEvent.setup();
    render(<UbigeoSelector />);

    const selectProvincia = screen.getByLabelText(
      /Seleccionar Provincia de Ucayali/i,
    );
    const selectDistrito = screen.getByLabelText(/Seleccionar Distrito/i);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /CORONEL PORTILLO/i })).toBeInTheDocument();
    });

    await user.selectOptions(selectProvincia, '2501');
    expect(selectProvincia).toHaveValue('2501');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /CALLERIA/i })).toBeInTheDocument();
    });

    await user.selectOptions(selectDistrito, '250101');
    expect(selectDistrito).toHaveValue('250101');

    await user.selectOptions(selectProvincia, '2502');
    expect(selectProvincia).toHaveValue('2502');

    expect(selectDistrito).toHaveValue('');
  });

  it("Al hacer clic en el botón 'Limpiar Selección' (aria-label='Restablecer selección de Ubigeo'), la provincia y el distrito seleccionados vuelven a estado vacío en el DOM.", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <UbigeoSelector
        initialProvinciaId="2501"
        initialDistritoId="250101"
        onChange={handleChange}
      />,
    );

    const selectProvincia = screen.getByLabelText(
      /Seleccionar Provincia de Ucayali/i,
    );
    const selectDistrito = screen.getByLabelText(/Seleccionar Distrito/i);

    await waitFor(() => {
      expect(selectProvincia).toHaveValue('2501');
      expect(selectDistrito).toHaveValue('250101');
    });

    const botonLimpiar = screen.getByRole('button', {
      name: 'Restablecer selección de Ubigeo',
    });
    await user.click(botonLimpiar);

    expect(selectProvincia).toHaveValue('');
    expect(selectDistrito).toHaveValue('');
    expect(handleChange).toHaveBeenCalledWith(
      '250000',
      expect.objectContaining({
        provincia: null,
        distrito: null,
        ubigeoCod: '250000',
      }),
    );
  });
});
