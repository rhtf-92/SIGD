import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UbigeoSelector } from '../../components/common/UbigeoSelector';

describe('UbigeoSelector - Pruebas Unitarias ENT-M01-02', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('3. Debe cargar las 4 provincias de Ucayali en el selector de provincia', () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i);
    expect(selectProv).toBeInTheDocument();
    
    expect(screen.getByRole('option', { name: /CORONEL PORTILLO/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /ATALAYA/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /PADRE ABAD/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /PURUS/i })).toBeInTheDocument();
  });

  it('4. Debe mantener deshabilitado el selector de distrito si no hay provincia seleccionada', () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i);
    expect(selectDist).toBeDisabled();
  });

  it('5. Debe habilitar distritos y permitir seleccionar provincia y distrito correctamente', () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i);
    fireEvent.change(selectProv, { target: { value: '2501' } }); // Coronel Portillo

    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i) as HTMLSelectElement;
    expect(selectDist).not.toBeDisabled();

    fireEvent.change(selectDist, { target: { value: '250105' } }); // Yarinacocha
    expect(selectDist.value).toBe('250105');
  });

  it('6. Debe emitir el código INEI de 6 dígitos completo al seleccionar un distrito', () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i);
    fireEvent.change(selectProv, { target: { value: '2501' } });

    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i);
    fireEvent.change(selectDist, { target: { value: '250105' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ubigeoCod: '250105',
        departamento: expect.objectContaining({ id: '25' }),
        provincia: expect.objectContaining({ id: '2501' }),
        distrito: expect.objectContaining({ id: '250105' }),
      })
    );
  });

  it('7. Debe limpiar la selección de distrito al cambiar la provincia seleccionada', () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i);
    fireEvent.change(selectProv, { target: { value: '2501' } });
    
    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i) as HTMLSelectElement;
    fireEvent.change(selectDist, { target: { value: '250101' } });
    expect(selectDist.value).toBe('250101');

    // Cambiar provincia a Atalaya (2502)
    fireEvent.change(selectProv, { target: { value: '2502' } });
    expect(selectDist.value).toBe('');
  });

  it('8. Debe resetear completamente la provincia y el distrito al presionar el botón de limpiar', () => {
    render(<UbigeoSelector onChange={mockOnChange} />);
    
    const selectProv = screen.getByLabelText(/Seleccionar Provincia de Ucayali/i) as HTMLSelectElement;
    fireEvent.change(selectProv, { target: { value: '2501' } });

    const btnLimpiar = screen.getByRole('button', { name: /Restablecer selección de Ubigeo/i });
    expect(btnLimpiar).toBeInTheDocument();

    fireEvent.click(btnLimpiar);

    expect(selectProv.value).toBe('');
    expect(screen.queryByRole('button', { name: /Restablecer selección de Ubigeo/i })).not.toBeInTheDocument();
  });
});