import { describe, expect, it } from 'vitest';
import { serializeError } from '../../../../src/errors/error-mapper.js';
import { AppError } from '../../../../src/shared/domain/errors/app-error.js';
import {
  ESTADOS_RUTADOC,
  EVENTOS_RUTADOC,
  TRANSICIONES_RUTADOC,
  EstadoTransicionInvalidaError,
  esEstadoRutaDoc,
  esEventoRutaDoc,
  puedeTransicionar,
  obtenerSiguienteEstado,
  type EstadoRutaDoc,
  type EventoRutaDoc,
} from '../../../../src/domains/rutadoc/rutadoc.fsm.js';

describe('FSM RutaDoc', () => {
  it('contiene exactamente los diez estados canónicos, sin duplicados', () => {
    expect(ESTADOS_RUTADOC).toEqual([
      'REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION',
      'OBSERVADO', 'SUBSANADO', 'EN_FIRMA', 'RESUELTO', 'ARCHIVADO',
    ]);
    expect(new Set(ESTADOS_RUTADOC).size).toBe(10);
    expect(Object.isFrozen(ESTADOS_RUTADOC)).toBe(true);
  });

  it('conserva las acciones compatibles y distingue los tres eventos nuevos', () => {
    expect(EVENTOS_RUTADOC).toEqual([
      'RECEPCION', 'INICIAR_CALIFICACION', 'INICIAR_REVISION', 'DERIVACION',
      'OBSERVACION', 'CORRECCION', 'ENVIAR_A_FIRMA', 'FIRMA', 'CIERRE',
    ]);
    expect(new Set(EVENTOS_RUTADOC).size).toBe(EVENTOS_RUTADOC.length);
    expect(Object.isFrozen(EVENTOS_RUTADOC)).toBe(true);
  });

  it('mantiene congeladas todas las filas y destinos válidos de la matriz', () => {
    expect(Object.isFrozen(TRANSICIONES_RUTADOC)).toBe(true);
    expect(Object.keys(TRANSICIONES_RUTADOC)).toEqual([...ESTADOS_RUTADOC]);
    for (const estado of ESTADOS_RUTADOC) {
      expect(Object.isFrozen(TRANSICIONES_RUTADOC[estado])).toBe(true);
      for (const [evento, destino] of Object.entries(TRANSICIONES_RUTADOC[estado])) {
        expect(esEventoRutaDoc(evento)).toBe(true);
        expect(esEstadoRutaDoc(destino)).toBe(true);
      }
    }
    expect(Reflect.set(TRANSICIONES_RUTADOC.REGISTRADO, 'RECEPCION', 'ARCHIVADO')).toBe(false);
    expect(TRANSICIONES_RUTADOC.REGISTRADO.RECEPCION).toBe('RECEPCIONADO');
  });

  it('ejecuta cada transición definida y ninguna pareja adicional', () => {
    let total = 0;
    for (const estado of ESTADOS_RUTADOC) {
      for (const evento of EVENTOS_RUTADOC) {
        const esperado = TRANSICIONES_RUTADOC[estado][evento];
        expect(puedeTransicionar(estado, evento)).toBe(esperado !== undefined);
        if (esperado !== undefined) {
          expect(obtenerSiguienteEstado(estado, evento)).toBe(esperado);
          total += 1;
        }
      }
    }
    expect(total).toBe(13);
  });

  it('recorre los diez estados hasta el archivo', () => {
    const eventos: EventoRutaDoc[] = [
      'RECEPCION', 'INICIAR_CALIFICACION', 'DERIVACION', 'RECEPCION',
      'OBSERVACION', 'CORRECCION', 'INICIAR_REVISION', 'ENVIAR_A_FIRMA',
      'FIRMA', 'CIERRE',
    ];
    let estado: EstadoRutaDoc = 'REGISTRADO';
    const recorrido: EstadoRutaDoc[] = [estado];
    for (const evento of eventos) {
      estado = obtenerSiguienteEstado(estado, evento);
      recorrido.push(estado);
    }
    expect(recorrido).toEqual([
      'REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO',
      'EN_REVISION', 'OBSERVADO', 'SUBSANADO', 'EN_REVISION',
      'EN_FIRMA', 'RESUELTO', 'ARCHIVADO',
    ]);
    expect(new Set(recorrido)).toEqual(new Set(ESTADOS_RUTADOC));
  });

  it('permite pasar de calificación a revisión sin derivación', () => {
    expect(obtenerSiguienteEstado('EN_CALIFICACION', 'INICIAR_REVISION')).toBe('EN_REVISION');
  });

  it('permite observar durante calificación y corregir antes de revisión', () => {
    expect(obtenerSiguienteEstado('EN_CALIFICACION', 'OBSERVACION')).toBe('OBSERVADO');
    expect(obtenerSiguienteEstado('OBSERVADO', 'CORRECCION')).toBe('SUBSANADO');
    expect(obtenerSiguienteEstado('SUBSANADO', 'INICIAR_REVISION')).toBe('EN_REVISION');
  });

  it('retorna desde una observación en revisión mediante SUBSANADO', () => {
    expect(obtenerSiguienteEstado('EN_REVISION', 'OBSERVACION')).toBe('OBSERVADO');
    expect(obtenerSiguienteEstado('OBSERVADO', 'CORRECCION')).toBe('SUBSANADO');
    expect(obtenerSiguienteEstado('SUBSANADO', 'INICIAR_REVISION')).toBe('EN_REVISION');
  });

  it('permite una nueva derivación desde revisión y exige recepción de destino', () => {
    expect(obtenerSiguienteEstado('EN_REVISION', 'DERIVACION')).toBe('DERIVADO');
    expect(puedeTransicionar('DERIVADO', 'ENVIAR_A_FIRMA')).toBe(false);
    expect(obtenerSiguienteEstado('DERIVADO', 'RECEPCION')).toBe('EN_REVISION');
  });

  it('rechaza atajos desde registro hacia revisión, firma o archivo', () => {
    for (const evento of ['INICIAR_REVISION', 'ENVIAR_A_FIRMA', 'CIERRE'] as const) {
      expect(puedeTransicionar('REGISTRADO', evento)).toBe(false);
      expect(() => obtenerSiguienteEstado('REGISTRADO', evento)).toThrow(EstadoTransicionInvalidaError);
    }
  });

  it('rechaza un evento conocido incompatible con el estado actual', () => {
    expect(puedeTransicionar('RECEPCIONADO', 'FIRMA')).toBe(false);
    expect(() => obtenerSiguienteEstado('RECEPCIONADO', 'FIRMA')).toThrow(EstadoTransicionInvalidaError);
  });

  it('rechaza estados ajenos al catálogo, incluso valores no textuales', () => {
    for (const valor of ['PENDIENTE_RECEPCION', '', null, 17]) {
      expect(esEstadoRutaDoc(valor)).toBe(false);
      expect(puedeTransicionar(valor, 'RECEPCION')).toBe(false);
      expect(() => obtenerSiguienteEstado(valor, 'RECEPCION')).toThrow(EstadoTransicionInvalidaError);
    }
    expect(esEstadoRutaDoc('REGISTRADO')).toBe(true);
  });

  it('rechaza eventos ajenos al catálogo, incluso valores no textuales', () => {
    for (const valor of ['REAPERTURA', '', null, 17]) {
      expect(esEventoRutaDoc(valor)).toBe(false);
      expect(puedeTransicionar('REGISTRADO', valor)).toBe(false);
      expect(() => obtenerSiguienteEstado('REGISTRADO', valor)).toThrow(EstadoTransicionInvalidaError);
    }
    expect(esEventoRutaDoc('RECEPCION')).toBe(true);
  });

  it('mantiene ARCHIVADO terminal para todos los eventos conocidos', () => {
    expect(TRANSICIONES_RUTADOC.ARCHIVADO).toEqual({});
    for (const evento of EVENTOS_RUTADOC) {
      expect(puedeTransicionar('ARCHIVADO', evento)).toBe(false);
      expect(() => obtenerSiguienteEstado('ARCHIVADO', evento)).toThrow(EstadoTransicionInvalidaError);
    }
  });

  it('expone un AppError serializable como Problem Details con HTTP 422', () => {
    const error = new EstadoTransicionInvalidaError();
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 422, code: 'ESTADO_TRANSICION_INVALIDA' });
    expect(serializeError(error)).toMatchObject({
      status: 422,
      code: 'ESTADO_TRANSICION_INVALIDA',
      detail: 'La transición de estado solicitada no está permitida.',
      invalidParams: [],
    });
  });
});
