import { describe,expect,it } from 'vitest';
import { puedeTransicionarDevolucionMesa,validarEstadoRevisionDevolucionMesa } from '../../../../src/domains/tramicore/devolucionesMesaPartes.service.js';

describe('evaluación de devoluciones en Mesa de Partes',()=>{
 it('permite evaluación, observación, subsanación y decisión desde estados admitidos',()=>{
  expect(puedeTransicionarDevolucionMesa('SOLICITADA','EN_EVALUACION')).toBe(true);
  expect(puedeTransicionarDevolucionMesa('EN_EVALUACION','OBSERVADA')).toBe(true);
  expect(puedeTransicionarDevolucionMesa('OBSERVADA','EN_EVALUACION')).toBe(true);
  expect(puedeTransicionarDevolucionMesa('PENDIENTE_APROBACION','APROBADA')).toBe(true);
  expect(puedeTransicionarDevolucionMesa('EN_EVALUACION','RECHAZADA')).toBe(true);
 });
 it('no permite a Mesa de Partes ejecutar una salida de caja ni reabrir una decisión final',()=>{
  expect(puedeTransicionarDevolucionMesa('APROBADA','EN_PROCESO_DEVOLUCION')).toBe(false);
  expect(puedeTransicionarDevolucionMesa('APROBADA','DEVUELTA')).toBe(false);
  expect(puedeTransicionarDevolucionMesa('RECHAZADA','APROBADA')).toBe(false);
 });
 it('acepta exclusivamente los estados de evaluación definidos',()=>{
  expect(validarEstadoRevisionDevolucionMesa('APROBADA')).toBe(true);
  expect(validarEstadoRevisionDevolucionMesa('DEVUELTA')).toBe(false);
  expect(validarEstadoRevisionDevolucionMesa('PENDIENTE')).toBe(false);
 });
});
