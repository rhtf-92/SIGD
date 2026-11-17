import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATALOGO_TUPA_MESA_PARTES } from '../../../src/data/catalogoTupaMesaPartes';
import { CatalogoTupaCompleto } from '../../../src/components/tramite/CatalogoTupaCompleto';
import { apiClient } from '../../../src/api/client';

afterEach(() => vi.restoreAllMocks());

function renderConQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('Catálogo TUPA completo para Mesa de Partes', () => {
  it('expone exactamente 72 filas fuente y conserva agrupadas las variantes del PDF', () => {
    expect(CATALOGO_TUPA_MESA_PARTES).toHaveLength(72);
    expect(CATALOGO_TUPA_MESA_PARTES.find((item) => item.codigoInterno === 'SUZ26-021')?.referenciasInternas)
      .toEqual(['SUZ26-021', 'SUZ26-022']);
    expect(CATALOGO_TUPA_MESA_PARTES.find((item) => item.codigoInterno === 'SUZ26-069')?.referenciasInternas)
      .toEqual(['SUZ26-069', 'SUZ26-070', 'SUZ26-071']);
  });

  it('permite buscar por nombre y seleccionar un trámite formal configurado', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: CATALOGO_TUPA_MESA_PARTES } as never);
    const onSelect = vi.fn();
    renderConQuery(<CatalogoTupaCompleto codigosRadicables={new Set(['SUZ26-035'])} onSeleccionarRadicable={onSelect} />);
    await screen.findByRole('listbox', { name: /72 conceptos/i });
    const list = screen.getByRole('listbox', { name: /72 conceptos/i });
    expect(within(list).getAllByRole('option')).toHaveLength(72);
    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'certificado de estudios' } });
    fireEvent.click(within(list).getByRole('option', { name: /Certificado de Estudios Superiores \(6 semestres\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /usar en radicación formal/i }));
    expect(onSelect).toHaveBeenCalledWith('SUZ26-035');
  });

  it('no presenta los conceptos sin configuración backend como procedimientos radicables', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: CATALOGO_TUPA_MESA_PARTES } as never);
    renderConQuery(<CatalogoTupaCompleto codigosRadicables={new Set()} onSeleccionarRadicable={vi.fn()} />);
    await screen.findByRole('listbox', { name: /72 conceptos/i });
    const list = screen.getByRole('listbox', { name: /72 conceptos/i });
    fireEvent.click(within(list).getByRole('option', { name: /SUZ26-007/i }));
    expect(screen.getByText(/no tiene configuración de radicación formal/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /usar en radicación formal/i })).not.toBeInTheDocument();
  });
});
