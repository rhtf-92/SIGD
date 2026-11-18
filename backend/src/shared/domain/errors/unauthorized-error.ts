import { AppError } from './app-error.js';

export interface UnauthorizedErrorOptions {
  message?: string;
  detail?: string;
}

export class UnauthorizedError extends AppError {
  constructor(options: UnauthorizedErrorOptions = {}) {
    super({
      status: 401,
      code: 'UNAUTHORIZED',
      message: options.message ?? 'No autenticado.',
      detail: options.detail ?? options.message ?? 'Debe autenticarse o sus credenciales no son válidas.',
    });
  }
}