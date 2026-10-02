import { AppError } from './app-error.js';

export interface ForbiddenErrorOptions {
  message?: string;
  detail?: string;
}

export class ForbiddenError extends AppError {
  constructor(options: ForbiddenErrorOptions = {}) {
    super({
      status: 403,
      code: 'FORBIDDEN',
      message: options.message ?? 'Permisos insuficientes.',
      detail: options.detail ?? options.message ?? 'No tiene privilegios para realizar esta operación.',
    });
  }
}