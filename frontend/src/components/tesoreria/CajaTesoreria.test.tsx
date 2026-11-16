import '@testing-library/jest-dom/vitest';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {CajaTesoreria,CobroEfectivo,vueltoVisual} from './CajaTesoreria';
import {tesGet} from '../../services/tesoreriaService';
vi.mock('../../services/tesoreriaService',()=>({claveSolicitudTesoreria:vi.fn(()=> '00000000-0000-4000-8000-000000000001'),tesGet:vi.fn(),tesPost:vi.fn()}));
afterEach(()=>cleanup());
describe('Recepción de efectivo',()=>{
 it('calcula el vuelto sin pérdida decimal',()=>{expect(vueltoVisual('16.50','20.00')).toBe('3.50');expect(vueltoVisual('124.00','100.00')).toBe(null);});
 it('solo permite confirmar cuando el importe recibido es suficiente',()=>{render(<CobroEfectivo importe="124.00" busy={false} onConfirmar={vi.fn()}/>);const b=screen.getByRole('button',{name:'Confirmar recepción de efectivo'});expect(b).toBeDisabled();fireEvent.change(screen.getByRole('textbox'),{target:{value:'150.00'}});expect(screen.getByText('Vuelto: S/ 26.00')).toBeInTheDocument();expect(b).toBeEnabled();});
 it('muestra confirmación expresa de recepción y mantiene el bloqueo durante envío',()=>{render(<CobroEfectivo importe="80.00" busy onConfirmar={vi.fn()}/>);expect(screen.getByRole('checkbox')).toBeRequired();expect(screen.getByRole('button',{name:'Confirmar recepción de efectivo'})).toBeDisabled();});
 it('el supervisor puede consultar la caja abierta sin controles para cerrarla',async()=>{
  vi.mocked(tesGet).mockResolvedValue({actual:{id:'caja-demo',saldo_inicial:'0.00',saldo_esperado:'0.00',demostracion:true,abierta_en:'2026-10-31T12:00:00Z'},cajas:[],movimientos:[]} as never);
  render(<CajaTesoreria puedeOperar={false}/>);
  expect(await screen.findByText(/CAJA DE DEMOSTRACIÓN/)).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Cerrar caja'})).not.toBeInTheDocument();
 });
});
