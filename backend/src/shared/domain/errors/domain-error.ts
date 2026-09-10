import { AppError } from './app-error.js';

export interface DomainErrorOptions {
  code: string;
  message: string;
  detail?: string;
}

export class DomainError extends AppError {
  constructor(options: DomainErrorOptions) {
    super({
      status: 422,
      code: options.code,
      message: options.message,
      detail: options.detail,
    });
  }
}