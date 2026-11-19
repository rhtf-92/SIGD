import '@testing-library/jest-dom/vitest';
import{describe,it,expect,vi,beforeEach,afterEach}from'vitest';
import{render,screen,fireEvent,waitFor,cleanup}from'@testing-library/react';
import OrdenPagoTramite from '@/components/tramite/OrdenPagoTramite';
import{useAuthStore}from'@/stores/authStore';
import{tesGet}from'@/services/tesoreriaService';
vi.mock('@/services/tesoreriaService',async importOriginal=>({...await importOriginal<typeof import('@/services/tesoreriaService')>(),tesGet:vi.fn()}));
const ID='11111111-1111-4111-8111-111111111111';
beforeEach(()=>{useAuthStore.setState({isAuthenticated:true,usuario:{id:ID,nombreCompleto:'Fixture',correo:'fixture@sandbox.invalid',rol:'CIUDADANO'}});});
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe('M3 consulta económica de M10',()=>{
 it('comunica gratuidad validada sin generar una orden',async()=>{vi.mocked(tesGet).mockResolvedValue([{id:ID,codigo:'FIXTURE',denominacion:'Gratuidad de prueba',tarifas:[{id:ID,importe:'0.00',fuente:'Solo prueba',concepto:'Fixture'}]}]);const condicion=vi.fn();render(<OrdenPagoTramite procedimiento={ID} onChange={vi.fn()} onCondicion={condicion}/>);expect(await screen.findByText('Gratuito: no necesita una orden de pago.')).toBeInTheDocument();expect(condicion).toHaveBeenCalledWith(ID,true);expect(screen.queryByRole('button',{name:'Generar orden para pagar en caja'})).not.toBeInTheDocument();});
 it('no presenta un precio sin tarifa validada',async()=>{vi.mocked(tesGet).mockResolvedValue([{id:ID,codigo:'FIXTURE',denominacion:'Pendiente',tarifas:[]}]);render(<OrdenPagoTramite procedimiento={ID} onChange={vi.fn()}/>);expect(await screen.findByText(/Pendiente de validación financiera/)).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Generar orden para pagar en caja'})).not.toBeInTheDocument();});
 it('encuentra una orden elegible después de la primera página y excluye operaciones ajenas',async()=>{
  const correcta={id:'orden-segunda-pagina',ciudadano_id:ID,tipo_tramite_id:ID,estado_pago:'VERIFICADO',importe:'80.00',codigo:'OP-SEGUNDA-PAGINA',devoluciones:[]};
  vi.mocked(tesGet).mockImplementation(async r=>r==='/catalogo'?[{id:ID,codigo:'SUZ26-035',denominacion:'Fixture',tarifas:[{importe:'80.00'}]}] as never:r.includes('pagina=1')?{items:[{...correcta,id:'ajena',ciudadano_id:'otra-cuenta'}],hayMas:true} as never:{items:[correcta],hayMas:false} as never);
  render(<OrdenPagoTramite procedimiento={ID} onChange={vi.fn()}/>);await screen.findByText(/Sujeto a pago/);fireEvent.click(screen.getByRole('button',{name:'Consultar mis órdenes disponibles'}));await waitFor(()=>expect(screen.getByRole('option',{name:'OP-SEGUNDA-PAGINA · S/ 80.00'})).toBeInTheDocument());expect(vi.mocked(tesGet).mock.calls.some(([r])=>r.includes('pagina=2'))).toBe(true);expect(screen.getAllByRole('option')).toHaveLength(2);
 });
});
