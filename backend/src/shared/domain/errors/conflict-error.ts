import { AppError } from './app-error.js';

export interface ConflictErrorOptions {
  code?: string;
  message?: string;
  detail?: string;
}

export class ConflictError extends AppError {
  constructor(options: ConflictErrorOptions = {}) {
    super({
      status: 409,
      code: options.code ?? 'CONFLICT',
      message: options.message ?? 'Conflicto de estado o de unicidad.',
      detail: options.detail ?? options.message ?? 'La operación entra en conflicto con el estado actual del recurso.',
    });
  }
}