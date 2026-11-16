import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import OrdenPagoPublica from '@/components/tramite/OrdenPagoPublica';
import {publicRequest,publicSession} from '@/services/radicacionPublicaService';
vi.mock('@/services/radicacionPublicaService',()=>({publicRequest:vi.fn(),publicSession:vi.fn(),publicDraftOwner:()=> 'public:fixture'}));
const identidad={tipoDocumento:'DNI' as const,numeroDocumento:'00000050',nombres:'Persona',apellidos:'Prueba',correo:'qa@sandbox.invalid',telefono:'900000001'};
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe('Orden pública preparada para activación',()=>{
 it('no pide login ni emite una orden sin consentimiento',()=>{render(<OrdenPagoPublica procedimiento="fixture" identidad={identidad} onChange={vi.fn()}/>);expect(screen.getByRole('button',{name:'Generar orden pública para caja'})).toBeDisabled();expect(publicRequest).not.toHaveBeenCalled();expect(screen.queryByRole('link',{name:/sesión/})).not.toBeInTheDocument();});
 it('no envía precio ni identidad de cuenta y no vincula un pago pendiente',async()=>{
  vi.mocked(publicSession).mockResolvedValue('a'.repeat(64));vi.mocked(publicRequest).mockResolvedValue({status:201,data:{id:'orden-qa',codigo:'OP-QA',importe:'124.00',concepto:'Fixture',aplicada:false,en_devolucion:false}});
  const change=vi.fn();render(<OrdenPagoPublica procedimiento="fixture" identidad={identidad} onChange={change}/>);fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Generar orden pública para caja'}));await screen.findByText(/OP-QA/);
  const body=JSON.parse(String(vi.mocked(publicRequest).mock.calls[0][1]?.body));expect(body.numeroDocumento).toBe('00000050');expect(body).not.toHaveProperty('importe');expect(body).not.toHaveProperty('usuarioId');expect(change).toHaveBeenCalledWith(undefined);
 });
 it('solo vincula una recepción verificada no aplicada ni en devolución',async()=>{
  vi.mocked(publicSession).mockResolvedValue('a'.repeat(64));vi.mocked(publicRequest).mockResolvedValue({status:200,data:{id:'orden-qa',codigo:'OP-QA',importe:'124.00',estado_pago:'VERIFICADO',aplicada:false,en_devolucion:false}});
  const change=vi.fn();render(<OrdenPagoPublica procedimiento="fixture" identidad={identidad} value="orden-qa" onChange={change}/>);fireEvent.click(screen.getByRole('button',{name:'Comprobar recepción de efectivo'}));await waitFor(()=>expect(change).toHaveBeenCalledWith('orden-qa'));expect(screen.getByRole('button',{name:'Consultar recibos internos'})).toBeInTheDocument();
 });
 it('lista todos los recibos de una orden verificada',async()=>{
  vi.mocked(publicSession).mockResolvedValue('a'.repeat(64));
  vi.mocked(publicRequest).mockResolvedValueOnce({status:200,data:{id:'orden-qa',codigo:'OP-QA',importe:'80.00',estado_pago:'VERIFICADO',aplicada:false,en_devolucion:false}})
   .mockResolvedValueOnce({status:200,data:{items:[{id:'p1',numeroRecibo:1,referencia:'RC-1',fechaOperacion:'2026-11-01T12:00:00Z',importe:'80.00',nombre:'RC-1.pdf',url:'https://files.invalid/1'},{id:'p2',numeroRecibo:2,referencia:'RC-2',fechaOperacion:'2026-11-02T12:00:00Z',importe:'80.00',nombre:'RC-2.pdf',url:'https://files.invalid/2'}]}});
  render(<OrdenPagoPublica procedimiento="fixture" identidad={identidad} value="orden-qa" onChange={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Comprobar recepción de efectivo'}));
  fireEvent.click(await screen.findByRole('button',{name:'Consultar recibos internos'}));
  expect(await screen.findByRole('link',{name:/Recibo 1/})).toHaveAttribute('href','https://files.invalid/1');
  expect(screen.getByRole('link',{name:/Recibo 2/})).toHaveAttribute('href','https://files.invalid/2');
  expect(vi.mocked(publicRequest).mock.calls[1][0]).toBe('/ordenes/orden-qa/recibos');
 });
});
