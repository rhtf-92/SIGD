import { describe, it, expect } from 'vitest';
import { serializeError } from '../../src/errors/error-mapper.js';
import { ValidationError, ConflictError } from '../../src/shared/domain/errors/index.js';

describe('serializeError (matriz sección 6 del entregable 01)', () => {
  it('respeta status/code/detail/invalid_params de la jerarquía AppError', () => {
    const error = new ValidationError({
      invalidParams: [{ name: 'numero', reason: 'El campo es obligatorio.' }],
    });
    expect(serializeError(error)).toEqual({
      status: 400,
      code: 'VALIDATION_ERROR',
      detail: 'Los datos enviados no son válidos.',
      invalidParams: [{ name: 'numero', reason: 'El campo es obligatorio.' }],
    });
  });

  it('mapea errores de Zod a invalid_params', () => {
    const zodError = { issues: [{ path: ['expediente', 'numero'], message: 'Required' }] };
    const serializado = serializeError(zodError);
    expect(serializado.status).toBe(400);
    expect(serializado.code).toBe('VALIDATION_ERROR');
    expect(serializado.invalidParams).toEqual([{ name: 'expediente.numero', reason: 'Required' }]);
  });

  it('mapea violación de unicidad PostgreSQL 23505 a 409 DUPLICATE_KEY', () => {
    const pgError = Object.assign(new Error('duplicate key'), { code: '23505' });
    const serializado = serializeError(pgError);
    expect(serializado).toMatchObject({ status: 409, code: 'DUPLICATE_KEY' });
  });

  it('mapea cualquier otro error a 500 INTERNAL_ERROR genérico', () => {
    const serializado = serializeError(new Error('detalle interno sensible'));
    expect(serializado).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'Ocurrió un error interno en el servidor.',
    });
  });

  it('reconoce subclases como ConflictError', () => {
    const error = new ConflictError({ code: 'DOCUMENTO_DUPLICADO' });
    const serializado = serializeError(error);
    expect(serializado).toMatchObject({ status: 409, code: 'DOCUMENTO_DUPLICADO' });
  });
});