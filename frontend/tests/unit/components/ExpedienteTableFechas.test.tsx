import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExpedienteTable, { formatearFechaIngreso } from '@/components/expedientes/ExpedienteTable';
import type { ExpedienteResumenRutaDoc } from '@/types/expediente';
describe('Fecha ingreso real en Perú, independiente de fecha legal y reloj del navegador', () => {
 it.each([
  ['2026-10-30T23:31:43.406Z','30/10/2026'],
  ['2026-10-31T02:30:00.000Z','30/10/2026'],
  ['2026-10-31T05:00:00.000Z','31/10/2026'],
  ['2026-01-01T03:59:00.000Z','31/12/2025'],
 ])('convierte %s a %s', (iso, expected) => expect(formatearFechaIngreso(iso)).toBe(expected));
 it('no inventa fechas ante datos ausentes o inválidos', () => {
  for(const date of [undefined,null,'','invalida']) expect(formatearFechaIngreso(date)).toBe('—');
 });
 it('muestra recepción real y no el inicio legal del lunes en varios expedientes', () => {
  const records: ExpedienteResumenRutaDoc[] = ['33','34','35'].map((suffix,i) => ({
   idExpediente:suffix,cut:`EXP-2026-0000${suffix}`,asunto:'Fixture de fechas',fechaIngreso:['2026-10-30T23:14:52.326Z','2026-10-30T23:31:43.406Z','2026-10-31T02:37:00Z'][i],
   fechaRadicacion:'2026-11-02T13:00:00.000Z',estadoActual:'REGISTRADO',areaActualId:null,
  }));
  render(<ExpedienteTable expedientes={records} onVerExpediente={()=>{}} />);
  for(const row of screen.getAllByRole('row').slice(1)){
   expect(within(row).getAllByRole('cell')[5]).toHaveTextContent('30/10/2026');
   expect(row).not.toHaveTextContent('02/11/2026');
  }
 });
});
