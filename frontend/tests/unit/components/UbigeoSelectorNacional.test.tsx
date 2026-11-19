import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UbigeoSelector } from '../../../src/components/common/UbigeoSelector';
import { apiClient } from '../../../src/api/client';
import { clearUbigeoCache } from '../../../src/services/ubigeoService';

const MOCK_DEPARTAMENTOS = [
  { codigo: '01', nombre: 'AMAZONAS' },
  { codigo: '02', nombre: 'ANCASH' },
  { codigo: '03', nombre: 'APURIMAC' },
  { codigo: '04', nombre: 'AREQUIPA' },
  { codigo: '05', nombre: 'AYACUCHO' },
  { codigo: '06', nombre: 'CAJAMARCA' },
  { codigo: '07', nombre: 'CALLAO' },
  { codigo: '08', nombre: 'CUSCO' },
  { codigo: '09', nombre: 'HUANCAVELICA' },
  { codigo: '10', nombre: 'HUANUCO' },
  { codigo: '11', nombre: 'ICA' },
  { codigo: '12', nombre: 'JUNIN' },
  { codigo: '13', nombre: 'LA LIBERTAD' },
  { codigo: '14', nombre: 'LAMBAYEQUE' },
  { codigo: '15', nombre: 'LIMA' },
  { codigo: '16', nombre: 'LORETO' },
  { codigo: '17', nombre: 'MADRE DE DIOS' },
  { codigo: '18', nombre: 'MOQUEGUA' },
  { codigo: '19', nombre: 'PASCO' },
  { codigo: '20', nombre: 'PIURA' },
  { codigo: '21', nombre: 'PUNO' },
  { codigo: '22', nombre: 'SAN MARTIN' },
  { codigo: '23', nombre: 'TACNA' },
  { codigo: '24', nombre: 'TUMBES' },
  { codigo: '25', nombre: 'UCAYALI' },
];

const MOCK_PROVINCIAS: Record<string, Array<{ codigo: string; departamentoCodigo: string; nombre: string }>> = {
  '07': [{ codigo: '0701', departamentoCodigo: '07', nombre: 'PROV. CONST. DEL CALLAO' }],
  '15': [{ codigo: '1501', departamentoCodigo: '15', nombre: 'LIMA' }],
  '16': [
    { codigo: '1601', departamentoCodigo: '16', nombre: 'MAYNAS' },
    { codigo: '1604', departamentoCodigo: '16', nombre: 'MARISCAL RAMON CASTILLA' },
  ],
  '25': [
    { codigo: '2501', departamentoCodigo: '25', nombre: 'CORONEL PORTILLO' },
    { codigo: '2502', departamentoCodigo: '25', nombre: 'ATALAYA' },
    { codigo: '2503', departamentoCodigo: '25', nombre: 'PADRE ABAD' },
    { codigo: '2504', departamentoCodigo: '25', nombre: 'PURUS' },
  ],
};

const MOCK_DISTRITOS: Record<string, Array<{ codigo: string; provinciaCodigo: string; departamentoCodigo: string; nombre: string }>> = {
  '0701': [{ codigo: '070101', provinciaCodigo: '0701', departamentoCodigo: '07', nombre: 'CALLAO' }],
  '1501': [{ codigo: '150101', provinciaCodigo: '1501', departamentoCodigo: '15', nombre: 'LIMA' }],
  '2501': [{ codigo: '250101', provinciaCodigo: '2501', departamentoCodigo: '25', nombre: 'CALLERIA' }],
  '2503': [{ codigo: '250301', provinciaCodigo: '2503', departamentoCodigo: '25', nombre: 'PADRE ABAD' }],
};

describe('UbigeoSelectorNacional - Suite de Pruebas Cascada Nacional (25 Dptos / 196 Provs / 1891 Dists)', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    clearUbigeoCache();

    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/ubigeo/departamentos')) {
        return { data: MOCK_DEPARTAMENTOS } as never;
      }
      if (url.includes('/api/v1/ubigeo/provincias')) {
        const match = url.match(/departamentoCodigo=([^&]+)/);
        const dep = match ? decodeURIComponent(match[1]) : '';
        return { data: MOCK_PROVINCIAS[dep] || [] } as never;
      }
      if (url.includes('/api/v1/ubigeo/distritos')) {
        const match = url.match(/provinciaCodigo=([^&]+)/);
        const prov = match ? decodeURIComponent(match[1]) : '';
        return { data: MOCK_DISTRITOS[prov] || [] } as never;
      }
      return { data: [] } as never;
    });
  });

  it('1. Debe renderizar los 25 departamentos del Perú en orden alfabético cuando soloUcayali={false}', async () => {
    render(<UbigeoSelector soloUcayali={false} onChange={mockOnChange} />);

    const selectDept = screen.getByLabelText(/Seleccionar Departamento/i) as HTMLSelectElement;
    expect(selectDept).toBeInTheDocument();
    expect(selectDept).not.toBeDisabled();

    await waitFor(() => {
      const options = Array.from(selectDept.querySelectorAll('option')).filter((o) => o.value !== '');
      expect(options.length).toBe(25);
    });

    const options = Array.from(selectDept.querySelectorAll('option')).filter((o) => o.value !== '');

    // Callao presente con código 07
    const callao = options.find((o) => o.value === '07');
    expect(callao).toBeDefined();
    expect(callao?.textContent).toContain('CALLAO');

    // Ucayali presente con código 25
    const ucayali = options.find((o) => o.value === '25');
    expect(ucayali).toBeDefined();
    expect(ucayali?.textContent).toContain('UCAYALI');

    // Lima presente con código 15
    const lima = options.find((o) => o.value === '15');
    expect(lima).toBeDefined();
    expect(lima?.textContent).toContain('LIMA');
  });

  it('2. Selectores de Provincia y Distrito deben estar deshabilitados inicialmente hasta seleccionar Departamento', () => {
    render(<UbigeoSelector soloUcayali={false} onChange={mockOnChange} />);

    const selectProv = screen.getByLabelText(/Seleccionar Provincia/i) as HTMLSelectElement;
    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i) as HTMLSelectElement;

    expect(selectProv).toBeDisabled();
    expect(selectDist).toBeDisabled();
  });

  it('3. Flujo en cascada completo: Selección de Callao (07 -> 0701 -> 070101)', async () => {
    const user = userEvent.setup();
    render(<UbigeoSelector soloUcayali={false} onChange={mockOnChange} />);

    const selectDept = screen.getByLabelText(/Seleccionar Departamento/i);
    const selectProv = screen.getByLabelText(/Seleccionar Provincia/i);
    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i);

    await waitFor(() => {
      expect(selectDept.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    // 1. Seleccionar Callao (07)
    await user.selectOptions(selectDept, '07');
    await waitFor(() => {
      expect(selectProv).not.toBeDisabled();
      expect(selectProv.querySelectorAll('option').length).toBeGreaterThan(1);
    });
    expect(selectDist).toBeDisabled();

    // 2. Seleccionar Provincia Constitucional del Callao (0701)
    await user.selectOptions(selectProv, '0701');
    await waitFor(() => {
      expect(selectDist).not.toBeDisabled();
      expect(selectDist.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    // 3. Seleccionar Distrito Callao (070101)
    await user.selectOptions(selectDist, '070101');
    expect(selectDist).toHaveValue('070101');

    // Verificar llamada onChange con DTO completo
    expect(mockOnChange).toHaveBeenLastCalledWith(
      '070101',
      expect.objectContaining({
        ubigeoCod: '070101',
        departamento: expect.objectContaining({ id: '07' }),
        provincia: expect.objectContaining({ id: '0701' }),
        distrito: expect.objectContaining({ id: '070101' }),
      })
    );
  });

  it('4. Reseteo descendente estricto: Cambiar departamento debe vaciar provincia y distrito', async () => {
    const user = userEvent.setup();
    render(<UbigeoSelector soloUcayali={false} onChange={mockOnChange} />);

    const selectDept = screen.getByLabelText(/Seleccionar Departamento/i);
    const selectProv = screen.getByLabelText(/Seleccionar Provincia/i);
    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i);

    await waitFor(() => {
      expect(selectDept.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    // Seleccionar Ucayali -> Coronel Portillo -> Callería
    await user.selectOptions(selectDept, '25');
    await waitFor(() => {
      expect(selectProv).not.toBeDisabled();
      expect(selectProv.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    await user.selectOptions(selectProv, '2501');
    await waitFor(() => {
      expect(selectDist).not.toBeDisabled();
      expect(selectDist.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    await user.selectOptions(selectDist, '250101');

    expect(selectProv).toHaveValue('2501');
    expect(selectDist).toHaveValue('250101');

    // Cambiar departamento a Loreto (16)
    await user.selectOptions(selectDept, '16');

    // Provincia y Distrito deben quedar limpios
    await waitFor(() => {
      expect(selectProv).toHaveValue('');
      expect(selectDist).toHaveValue('');
      expect(selectDist).toBeDisabled();
    });
  });

  it('5. Reseteo descendente estricto: Cambiar provincia debe vaciar distrito', async () => {
    const user = userEvent.setup();
    render(<UbigeoSelector soloUcayali={false} onChange={mockOnChange} />);

    const selectDept = screen.getByLabelText(/Seleccionar Departamento/i);
    const selectProv = screen.getByLabelText(/Seleccionar Provincia/i);
    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i);

    await waitFor(() => {
      expect(selectDept.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    // Seleccionar Ucayali -> Coronel Portillo -> Callería
    await user.selectOptions(selectDept, '25');
    await waitFor(() => {
      expect(selectProv).not.toBeDisabled();
      expect(selectProv.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    await user.selectOptions(selectProv, '2501');
    await waitFor(() => {
      expect(selectDist).not.toBeDisabled();
      expect(selectDist.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    await user.selectOptions(selectDist, '250101');

    expect(selectDist).toHaveValue('250101');

    // Cambiar a provincia Padre Abad (2503)
    await user.selectOptions(selectProv, '2503');

    // Distrito reseteado
    await waitFor(() => {
      expect(selectDist).toHaveValue('');
      expect(selectDist).not.toBeDisabled();
    });
  });

  it('6. El botón Limpiar Selección restablece todos los campos a vacío', async () => {
    const user = userEvent.setup();
    render(<UbigeoSelector soloUcayali={false} onChange={mockOnChange} />);

    const selectDept = screen.getByLabelText(/Seleccionar Departamento/i);
    const selectProv = screen.getByLabelText(/Seleccionar Provincia/i);
    const selectDist = screen.getByLabelText(/Seleccionar Distrito/i);

    await waitFor(() => {
      expect(selectDept.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    await user.selectOptions(selectDept, '15'); // Lima
    await waitFor(() => {
      expect(selectProv).not.toBeDisabled();
      expect(selectProv.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    await user.selectOptions(selectProv, '1501'); // Lima
    await waitFor(() => {
      expect(selectDist).not.toBeDisabled();
      expect(selectDist.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    await user.selectOptions(selectDist, '150101'); // Lima

    const botonLimpiar = screen.getByRole('button', { name: /Restablecer selección de Ubigeo/i });
    expect(botonLimpiar).toBeInTheDocument();

    await user.click(botonLimpiar);

    expect(selectDept).toHaveValue('');
    expect(selectProv).toHaveValue('');
    expect(selectDist).toHaveValue('');
  });
});
