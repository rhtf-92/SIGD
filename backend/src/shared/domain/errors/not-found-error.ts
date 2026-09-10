import { AppError } from './app-error.js';

export interface NotFoundErrorOptions {
  message?: string;
  detail?: string;
}

export class NotFoundError extends AppError {
  constructor(options: NotFoundErrorOptions = {}) {
    super({
      status: 404,
      code: 'NOT_FOUND',
      message: options.message ?? 'Recurso no encontrado.',
      detail: options.detail ?? options.message ?? 'El recurso solicitado no existe o no es localizable.',
    });
  }
}