import { describe, expect, it } from 'vitest';
import { AppError } from '../../../../src/shared/domain/errors/index.js';
import { exigirPdfParaPublicar, exigirVersionBorrador } from '../../../../src/domains/tupa/tupa.rules.js';
import { serializeError } from '../../../../src/errors/error-mapper.js';

describe('reglas de negocio de versiones TUPA', () => {
  it('permite cambios solamente mientras la versión está en borrador', () => {
    expect(() => exigirVersionBorrador('BORRADOR', 'TUPA-2026-v2')).not.toThrow();
    for (const estado of ['VIGENTE', 'SUPERSEDIDA']) {
      try {
        exigirVersionBorrador(estado, 'TUPA-2026-v1');
        throw new Error('Se esperaba rechazo de versión publicada.');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).status).toBe(409);
      }
    }
  });

  it('exige el PDF de resolución como condición de publicación', () => {
    expect(() => exigirPdfParaPublicar('local:uuid/uuid.pdf')).not.toThrow();
    try {
      exigirPdfParaPublicar(null);
      throw new Error('Se esperaba rechazo por PDF ausente.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(422);
    }
  });

  it('mapea errores de inmutabilidad y restricciones SQL a respuestas API controladas', () => {
    expect(serializeError(Object.assign(new Error('blocked'), { code: '23001' }))).toMatchObject({
      status: 409,
      code: 'INMUTABLE_RESOURCE',
    });
    expect(serializeError(Object.assign(new Error('check'), { code: '23514' }))).toMatchObject({
      status: 422,
      code: 'CHECK_VIOLATION',
    });
    expect(serializeError(Object.assign(new Error('large'), { status: 413 }))).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });
});
