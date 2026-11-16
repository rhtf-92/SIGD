import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import TesoreriaPage from '@/pages/tesoreria/TesoreriaPage';
import {useAuthStore} from '@/stores/authStore';
import {tesGet,tesPost} from '@/services/tesoreriaService';
vi.mock('@/services/tesoreriaService',async importOriginal=>({...await importOriginal<typeof import('@/services/tesoreriaService')>(),tesGet:vi.fn(),tesPost:vi.fn(),cargarDocumentoFinanciero:vi.fn()}));
const ID='11111111-1111-4111-8111-111111111111';
const orden={id:ID,codigo:'OP-DEMO-UNITARIA',importe:'80.00',moneda:'PEN',concepto:'Fixture',tipo_tramite_id:ID,procedimiento:'SUZ26-035',denominacion:'Fixture certificado',creado_en:'2026-10-31T02:00:00Z',devoluciones:[]};
function montar(){return render(<MemoryRouter><TesoreriaPage/></MemoryRouter>);}
beforeEach(()=>{
 useAuthStore.setState({isAuthenticated:true,usuario:{id:ID,nombreCompleto:'Fixture',correo:'fixture@sandbox.invalid',rol:'CIUDADANO'}});
 vi.mocked(tesGet).mockImplementation(async route=>{
  if(route==='/capacidades')return{ciudadano:true,permisos:[]} as never;
  if(route==='/catalogo')return[{id:ID,codigo:'SUZ26-035',denominacion:'Fixture certificado',tarifas:[{id:ID,importe:'80.00',concepto:'Fixture',fuente:'Solo prueba'}]}] as never;
  if(route.startsWith('/ordenes?'))return{items:[orden],hayMas:false} as never;
  if(route==='/ordenes/'+ID)return{orden,pago:null,historial:[],devoluciones:[]} as never;
  return[] as never;
 });
 vi.mocked(tesPost).mockResolvedValue(orden);
});
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe('M10: interfaz ciudadana e institucional',()=>{
 it('muestra acceso ciudadano sin acciones de aprobación ni reportes internos',async()=>{montar();await screen.findByRole('heading',{name:'Mis pagos y devoluciones'});expect(screen.queryByRole('button',{name:'Reportes'})).not.toBeInTheDocument();expect(screen.queryByText('Proponer tarifa documentada')).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Mis trámites'})).toHaveAttribute('href','/consulta');});
 it('lista pagos con importe y zona Perú sin cambiar el encabezado institucional',async()=>{montar();await screen.findByText(/1 órdenes en esta página/);fireEvent.click(screen.getByRole('button',{name:'Pagos'}));expect(await screen.findByText('OP-DEMO-UNITARIA')).toBeInTheDocument();expect(screen.getByText('S/ 80.00')).toBeInTheDocument();expect(screen.getByRole('cell',{name:'PENDIENTE'})).toBeInTheDocument();});
 it('orienta a radicar antes de crear una orden y no envía un importe ni identidad',async()=>{montar();await screen.findByText(/1 órdenes en esta página/);fireEvent.click(screen.getByRole('button',{name:'Pagos'}));expect(screen.getByRole('link',{name:'Ir a Mesa de Partes'})).toHaveAttribute('href','/tramite');expect(screen.queryByRole('button',{name:'Generar orden'})).not.toBeInTheDocument();expect(tesPost).not.toHaveBeenCalled();});
 it('orienta al ciudadano a caja sin permitirle confirmar la recepción',async()=>{montar();await screen.findByText(/1 órdenes en esta página/);fireEvent.click(screen.getByRole('button',{name:'Pagos'}));fireEvent.click(screen.getByRole('button',{name:'Ver operación'}));await screen.findByRole('region',{name:'Detalle de operación financiera'});expect(screen.getByText(/Solo el TESORERO puede confirmar la recepción/)).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Confirmar recepción de efectivo'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Registrar revisión'})).not.toBeInTheDocument();});
 it('muestra error de instalación o servicio, sin datos simulados',async()=>{vi.mocked(tesGet).mockRejectedValue(new Error('Tesorería aún no está habilitada en esta instalación.'));montar();expect(await screen.findByRole('alert')).toHaveTextContent('aún no está habilitada');expect(screen.queryByText('OP-DEMO-UNITARIA')).not.toBeInTheDocument();});
 it('no genera cobros previos cuando falta una tarifa validada',async()=>{vi.mocked(tesGet).mockImplementation(async route=>route==='/capacidades'?{ciudadano:true,permisos:[]} as never:route==='/catalogo'?[{id:ID,codigo:'SUZ26-035',denominacion:'Fixture',tarifas:[]}] as never:{items:[],hayMas:false} as never);montar();await screen.findByText(/0 órdenes en esta página/);fireEvent.click(screen.getByRole('button',{name:'Pagos'}));expect(screen.queryByRole('button',{name:'Generar orden'})).not.toBeInTheDocument();expect(tesPost).not.toHaveBeenCalled();});
 it('habilita reportes únicamente mediante permiso específico',async()=>{vi.mocked(tesGet).mockImplementation(async route=>route==='/capacidades'?{ciudadano:false,permisos:['TESORERIA_REPORTES']} as never:route==='/catalogo'?[] as never:[] as never);montar();await screen.findByRole('heading',{name:'Tesorería'});expect(screen.getByRole('button',{name:'Reportes'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Proponer tarifa'})).not.toBeInTheDocument();});
 it('cambiar de operación conserva el nuevo detalle y no restaura el anterior',async()=>{
  const otro={...orden,id:'22222222-2222-4222-8222-222222222222',codigo:'OP-SEGUNDA'};
  const base=vi.mocked(tesGet).getMockImplementation()!;
  vi.mocked(tesGet).mockImplementation(async route=>route.startsWith('/ordenes?')?{items:[orden,otro],hayMas:false} as never:route==='/ordenes/'+otro.id?{orden:otro,pago:null,historial:[],devoluciones:[]} as never:base(route));
  montar();await screen.findByText(/2 órdenes en esta página/);fireEvent.click(screen.getByRole('button',{name:'Pagos'}));
  fireEvent.click(screen.getAllByRole('button',{name:'Ver operación'})[0]);await screen.findByRole('region',{name:'Detalle de operación financiera'});await waitFor(()=>expect(screen.getAllByRole('button',{name:'Ver operación'})[1]).not.toBeDisabled());
  fireEvent.click(screen.getAllByRole('button',{name:'Ver operación'})[1]);await waitFor(()=>expect(within(screen.getByRole('region',{name:'Detalle de operación financiera'})).getByRole('heading',{name:'OP-SEGUNDA'})).toBeInTheDocument());
  expect(vi.mocked(tesGet).mock.calls.filter(([r])=>r==='/ordenes/'+ID)).toHaveLength(1);
 });
 it('no muestra otra solicitud de devolución cuando hay una activa',async()=>{
  const base=vi.mocked(tesGet).getMockImplementation()!;
  vi.mocked(tesGet).mockImplementation(async route=>route==='/ordenes/'+ID?{orden,pago:{id:ID,estado:'VERIFICADO',documento_id:ID,referencia:'UNIT'},historial:[],devoluciones:[{id:ID,codigo:'DEV-UNITARIA',estado:'SOLICITADA',importe:'10.00',motivo:'OTRO',sustento:'Solo prueba unitaria'}]} as never:base(route));
  montar();await screen.findByText(/1 órdenes en esta página/);fireEvent.click(screen.getByRole('button',{name:'Pagos'}));fireEvent.click(screen.getByRole('button',{name:'Ver operación'}));await screen.findByText(/Saldo disponible para devolución: S\/ 70.00/);expect(screen.queryByRole('button',{name:'Solicitar devolución'})).not.toBeInTheDocument();
 });
 it('una observación no expone una acción nueva que el backend activo no anunció',async()=>{
  const base=vi.mocked(tesGet).getMockImplementation()!;
  vi.mocked(tesGet).mockImplementation(async route=>route==='/ordenes/'+ID?{orden,pago:{id:ID,estado:'OBSERVADO',documento_id:ID,referencia:'UNIT'},historial:[],devoluciones:[]} as never:base(route));
  montar();await screen.findByText(/1 órdenes en esta página/);fireEvent.click(screen.getByRole('button',{name:'Pagos'}));fireEvent.click(screen.getByRole('button',{name:'Ver operación'}));await screen.findByRole('region',{name:'Detalle de operación financiera'});expect(screen.queryByRole('button',{name:'Enviar subsanación'})).not.toBeInTheDocument();
 });
 it('muestra el pago anterior y exige confirmación explícita antes de ofrecer el cobro adicional',async()=>{
  useAuthStore.setState({isAuthenticated:true,usuario:{id:ID,nombreCompleto:'Tesorero de prueba',correo:'tesorero@sandbox.invalid',rol:'TESORERO',roles:['TESORERO']}});
  vi.mocked(tesGet).mockImplementation(async route=>route==='/capacidades'?{ciudadano:false,permisos:['TESORERIA_LEER','TESORERIA_PAGO_REGISTRAR','TESORERIA_PAGO_VERIFICAR']} as never:route==='/ordenes/'+ID?{orden,pago:{id:ID,estado:'VERIFICADO',documento_id:ID,referencia:'DEMO-RC-1'},pagos:[],historial:[],devoluciones:[]} as never:route.startsWith('/ordenes?')?{items:[orden],hayMas:false} as never:[] as never);
  vi.mocked(tesPost).mockImplementation(async route=>route.endsWith('/pagos-adicionales/advertencia')?{requiereConfirmacion:true,token:'a'.repeat(40),importe:'80.00',pagos:[{id:ID,referencia:'DEMO-RC-1',fecha_operacion:'2026-10-31T12:00:00Z',importe:'80.00',numero_recibo:'1',recibo:'DEMO-RC-1.pdf',estado:'VERIFICADO'}]} as never:route.endsWith('/pagos-adicionales/confirmar')?{autorizacionId:'77777777-7777-4777-8777-777777777777'} as never:{} as never);
  montar();await screen.findByText(/1 órdenes en esta página/);fireEvent.click(screen.getByRole('button',{name:'Pagos'}));fireEvent.click(screen.getByRole('button',{name:'Ver operación'}));await screen.findByRole('region',{name:'Detalle de operación financiera'});fireEvent.click(screen.getByRole('button',{name:'Revisar pago previo'}));expect(await screen.findByText(/POSIBLE PAGO DUPLICADO/)).toBeInTheDocument();expect(screen.getByText(/DEMO-RC-1 ·/)).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Confirmar recepción de efectivo'})).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Confirmar pago adicional'}));await waitFor(()=>expect(tesPost).toHaveBeenCalledWith(expect.stringContaining('/pagos-adicionales/confirmar'),{token:'a'.repeat(40)}));expect(await screen.findByText(/Autorización temporal confirmada/)).toBeInTheDocument();
 });
});
