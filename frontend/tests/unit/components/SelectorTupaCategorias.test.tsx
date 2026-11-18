/**
 * ==============================================================================
 * TEST UNITARIO: SelectorTupaCategorias.test.tsx
 * ==============================================================================
 * Cobertura exigida:
 * - 72 registros TUPA contabilizados y clasificados correctamente en las 7 categorías oficiales.
 * - Búsqueda tolerante a tildes (ej. "ingles" -> "Certificado de Inglés").
 * - Búsqueda por código oficial (ej. "p1-fila-06").
 * - Filtros y selección de procedimientos con emisión de registroVersionId.
 * - Opción "Trámite no TUPA / documentación general".
 * - Atributos responsive y accesibilidad sin overflow horizontal.
 * ==============================================================================
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  SelectorTupaCategorias,
  CATEGORIAS_OFICIALES,
  normalizarParaBusqueda,
  resolverCategoriaProcedimiento,
  type ProcedimientoSelectorItem,
} from '@/components/tramite/SelectorTupaCategorias';
import { TUPA_SUIZA_2026_COMPLETO } from '@/data/tupaSuiza2026CatalogoCompleto';

describe('SelectorTupaCategorias — Catálogo TUPA 2026 por Categorías', () => {
  // Convertir los 72 procedimientos oficiales en items del selector
  const catalogo72: ProcedimientoSelectorItem[] = TUPA_SUIZA_2026_COMPLETO.map((p, idx) => ({
    registroVersionId: `11111111-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
    codigo: p.referenciaFila,
    denominacion: p.denominacion,
    monto: p.monto,
    plazo: p.plazo,
    requisitos: p.requisitos,
    categoria: p.categoria,
    unidadResponsable: p.unidadResponsable,
    fuente: {
      referenciaFila: p.referenciaFila,
      nombre: 'TUPA_2026_IESTP_Suiza.pdf',
      pagina: p.pagina,
    },
  }));

  it('1. Contabiliza exactamente los 72 registros TUPA en las 7 categorías oficiales', () => {
    expect(catalogo72).toHaveLength(72);
    expect(CATEGORIAS_OFICIALES).toHaveLength(7);

    // Contar por categoría oficial
    const conteos: Record<string, number> = {};
    for (const item of catalogo72) {
      const cat = resolverCategoriaProcedimiento(item);
      conteos[cat] = (conteos[cat] || 0) + 1;
    }

    expect(conteos['PROCEDIMIENTO_APROBADO']).toBe(18);
    expect(conteos['SERVICIO_ACADEMICO']).toBe(17);
    expect(conteos['SERVICIO_COMERCIAL']).toBe(9);
    expect(conteos['BIEN_PRODUCTIVO']).toBe(9);
    expect(conteos['ACTUACION_INTERNA']).toBe(5);
    expect(conteos['PROCEDIMIENTO_PENDIENTE']).toBe(5);
    expect(conteos['OTRO_NO_RADICABLE']).toBe(9);

    const total = Object.values(conteos).reduce((acc, c) => acc + c, 0);
    expect(total).toBe(72);
  });

  it('2. Búsqueda tolerante a tildes: "ingles" encuentra Certificado de Inglés', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <SelectorTupaCategorias
        procedimientos={catalogo72}
        value=""
        onChange={handleChange}
        permitirNoTupa={true}
      />
    );

    const inputBusqueda = screen.getByLabelText(/Buscar procedimiento en catálogo TUPA/i);
    await user.type(inputBusqueda, 'ingles');

    // Debe mostrar coincidencias para "ingles"
    expect(screen.getByText(/coincidencia/i)).toBeInTheDocument();
    expect(screen.getByText('Certificado de Inglés')).toBeInTheDocument();
  });

  it('3. Búsqueda por código de fila oficial: "p1-fila-06" localiza el procedimiento patrón', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <SelectorTupaCategorias
        procedimientos={catalogo72}
        value=""
        onChange={handleChange}
      />
    );

    const inputBusqueda = screen.getByLabelText(/Buscar procedimiento en catálogo TUPA/i);
    await user.type(inputBusqueda, 'p1-fila-06');

    // Debe encontrar p1-fila-06
    expect(screen.getByText('p1-fila-06')).toBeInTheDocument();
    expect(screen.getByText('Certificado de Inglés')).toBeInTheDocument();
    expect(screen.getByText('S/ 100.00')).toBeInTheDocument();
  });

  it('4. Selección de procedimiento emite el registroVersionId técnico correspondiente', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const pIngles = catalogo72.find((p) => p.codigo === 'p1-fila-06')!;

    render(
      <SelectorTupaCategorias
        procedimientos={catalogo72}
        value=""
        onChange={handleChange}
      />
    );

    const inputBusqueda = screen.getByLabelText(/Buscar procedimiento en catálogo TUPA/i);
    await user.type(inputBusqueda, 'p1-fila-06');

    const card = screen.getByText('Certificado de Inglés');
    await user.click(card);

    expect(handleChange).toHaveBeenCalledWith(pIngles.registroVersionId);
  });

  it('5. Permite seleccionar Trámite no TUPA / Documentación general', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <SelectorTupaCategorias
        procedimientos={catalogo72}
        value=""
        onChange={handleChange}
        permitirNoTupa={true}
      />
    );

    const opcionNoTupa = screen.getByText(/Trámite no TUPA \/ documentación general/i);
    await user.click(opcionNoTupa);

    expect(handleChange).toHaveBeenCalledWith('NO_TUPA');
  });

  it('6. Muestra confirmación visual destacada cuando un procedimiento está seleccionado', () => {
    const pIngles = catalogo72.find((p) => p.codigo === 'p1-fila-06')!;

    render(
      <SelectorTupaCategorias
        procedimientos={catalogo72}
        value={pIngles.registroVersionId}
        onChange={vi.fn()}
      />
    );

    // Debe mostrar la caja de confirmación "Seleccionado: p1-fila-06"
    expect(screen.getByText('Seleccionado:')).toBeInTheDocument();
    expect(screen.getAllByText('p1-fila-06').length).toBeGreaterThanOrEqual(1);
  });

  it('7. Diseño responsive: cuenta con contenedor scrolleable acotado y text wrapping', () => {
    const { container } = render(
      <SelectorTupaCategorias
        procedimientos={catalogo72}
        value=""
        onChange={vi.fn()}
      />
    );

    const regionScrolleable = screen.getByRole('region', { name: /Listado de categorías TUPA/i });
    expect(regionScrolleable).toHaveClass('max-h-[380px]', 'overflow-y-auto');

    // No debe existir overflow horizontal desbordante
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('w-full', 'max-w-full');
  });

  it('8. Función normalizarParaBusqueda elimina correctamente acentos y diacríticos', () => {
    expect(normalizarParaBusqueda('INGLÉS')).toBe('ingles');
    expect(normalizarParaBusqueda('Convalidación de Estudios')).toBe('convalidacion de estudios');
    expect(normalizarParaBusqueda('Prácticas')).toBe('practicas');
  });
});
