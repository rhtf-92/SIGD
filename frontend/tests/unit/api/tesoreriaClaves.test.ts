import {describe,it,expect} from 'vitest';
import {claveSolicitudTesoreria} from '@/services/tesoreriaService';
describe('M10: identidad de solicitudes y reintentos',()=>{
 it('conserva la clave en reintentos de la misma cuenta y operación',()=>{const a=claveSolicitudTesoreria('ciudadano-a','orden:uno');expect(claveSolicitudTesoreria('ciudadano-a','orden:uno')).toBe(a);});
 it('no comparte claves entre ciudadanos o procedimientos',()=>{expect(claveSolicitudTesoreria('a','orden:uno')).not.toBe(claveSolicitudTesoreria('b','orden:uno'));expect(claveSolicitudTesoreria('a','orden:uno')).not.toBe(claveSolicitudTesoreria('a','orden:dos'));});
 it('una nueva intención confirmada recibe otra clave',()=>{const first=claveSolicitudTesoreria('c','devolucion:uno');const second=claveSolicitudTesoreria('c','devolucion:uno',true);expect(second).not.toBe(first);expect(claveSolicitudTesoreria('c','devolucion:uno')).toBe(second);});
 it('no mezcla claves entre orden y devolución',()=>{expect(claveSolicitudTesoreria('d','orden:uno')).not.toBe(claveSolicitudTesoreria('d','devolucion:uno'));});
});
