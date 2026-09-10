import { AppError, InvalidParam } from './app-error.js';

export interface ValidationErrorOptions {
  invalidParams: InvalidParam[];
  message?: string;
}

export class ValidationError extends AppError {
  constructor(options: ValidationErrorOptions) {
    super({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: options.message ?? 'Los datos enviados no son válidos.',
      invalidParams: options.invalidParams,
    });
  }
}