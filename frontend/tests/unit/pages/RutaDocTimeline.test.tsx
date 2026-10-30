import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RutaDocTimeline from '../../../src/pages/expedientes/rutadoc/RutaDocTimeline';
import { trazabilidadSchema } from '../../../src/pages/expedientes/rutadoc/rutadoc.dto';

describe('Trazabilidad visible del expediente', () => {
  it('muestra eventos reales con textos humanos sin UUID ni identificador de operador', () => {
    const datos = trazabilidadSchema.parse({
      expedienteId: 'e0814628-c79b-4c75-ab6d-b6dbd15df166',
      actuaciones: [],
      eventos: [
        { id: 'RADICACION:a', tipo: 'RADICACION', fechaHora: '2026-10-29T10:00:00.000Z', titulo: 'Solicitud radicada', detalle: 'EXP-2026-000001' },
        { id: 'PAGO_CONFIRMADO:b', tipo: 'PAGO_CONFIRMADO', fechaHora: '2026-10-29T10:04:00.000Z', titulo: 'Pago confirmado', detalle: 'REC-2026-000001 · Efectivo' },
        { id: 'MOVIMIENTO:c', tipo: 'MOVIMIENTO', fechaHora: '2026-10-29T10:05:00.000Z', titulo: 'Derivado a Subdirección Académica', detalle: null },
      ],
    });
    const { container } = render(<RutaDocTimeline datos={datos} />);
    expect(screen.getByText('Solicitud radicada')).toBeTruthy();
    expect(screen.getByText('Pago confirmado')).toBeTruthy();
    expect(screen.getByText('Derivado a Subdirección Académica')).toBeTruthy();
    expect(screen.getByText('REC-2026-000001 · Efectivo')).toBeTruthy();
    expect(container.textContent).not.toContain('Movimiento UUID');
    expect(container.textContent).not.toContain('e0814628-c79b-4c75-ab6d-b6dbd15df166');
  });

  it('no crea eventos al recibir un historial vacío', () => {
    const datos = trazabilidadSchema.parse({ expedienteId: 'e0814628-c79b-4c75-ab6d-b6dbd15df166', actuaciones: [] });
    render(<RutaDocTimeline datos={datos} />);
    expect(screen.getByText('Sin eventos registrados para este expediente.')).toBeTruthy();
  });
});
