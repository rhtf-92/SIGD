import type { InvalidParam } from '../shared/domain/errors/index.js';
import { AppError } from '../shared/domain/errors/index.js';
import { esErrorPostgresql, mapearErrorPostgresql } from './postgres-error-mapper.js';
import { esErrorZod, mapearIssuesZod } from './zod-error-mapper.js';

export interface ErrorSerializado {
  status: number;
  code: string;
  detail: string;
  invalidParams: InvalidParam[];
}

const INTERNO: ErrorSerializado = {
  status: 500,
  code: 'INTERNAL_ERROR',
  detail: 'Ocurrió un error interno en el servidor.',
  invalidParams: [],
};

export function serializeError(error: unknown): ErrorSerializado {
  if (error instanceof AppError) {
    return {
      status: error.status,
      code: error.code,
      detail: error.detail,
      invalidParams: error.invalidParams,
    };
  }

  if (esErrorZod(error)) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      detail: 'Los datos enviados no son válidos.',
      invalidParams: mapearIssuesZod(error.issues),
    };
  }

  if (esErrorPostgresql(error)) {
    const mapeo = mapearErrorPostgresql(error);
    return { ...mapeo, invalidParams: [] };
  }

  return INTERNO;
}