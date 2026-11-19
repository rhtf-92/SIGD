import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {apiClient} from '../../../src/api/client';
import DevolucionesMesaPartes from '../../../src/components/tesoreria/DevolucionesMesaPartes';

afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('bandeja de devoluciones de Mesa de Partes',()=>{
 it('consulta la bandeja autorizada y envía una transición con fundamento',async()=>{
  const item={id:'11111111-1111-4111-8111-111111111111',codigo:'DEV-UNIT',estado:'SOLICITADA',motivo:'PAGO_DUPLICADO',sustento:'Sustento de prueba unitaria',importe:'10.00',cut:'EXP-2026-000001',administrado:'Persona de prueba',id_documento:'********',numero_recibo:'12',recibo:'RC-12',fecha_operacion:'2026-10-31T12:00:00Z',recibo_documento_id:null,recibo_nombre:null,recibo_paginas:null,sustento_documento:null,sustento_nombre:null,sustento_paginas:null,orden_devolucion:null};
  const get=vi.spyOn(apiClient,'get').mockResolvedValue({data:[item]} as never);
  const post=vi.spyOn(apiClient,'post').mockResolvedValue({data:{estado:'EN_EVALUACION'}} as never);
  render(<DevolucionesMesaPartes/>);
  expect(await screen.findByText('DEV-UNIT · SOLICITADA')).toBeInTheDocument();
  expect(get).toHaveBeenCalledWith('/tramites/devoluciones');
  fireEvent.change(screen.getByRole('textbox',{name:'Fundamento DEV-UNIT'}),{target:{value:'Inicio de evaluación documentaria.'}});
  fireEvent.click(screen.getByRole('button',{name:'EN EVALUACION'}));
  await waitFor(()=>expect(post).toHaveBeenCalledWith('/tramites/devoluciones/'+item.id+'/revision',{estado:'EN_EVALUACION',motivo:'Inicio de evaluación documentaria.'}));
 });
});
