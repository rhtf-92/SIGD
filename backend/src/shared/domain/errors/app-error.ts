export interface InvalidParam {
  name: string;
  reason: string;
}

export interface AppErrorOptions {
  status: number;
  code: string;
  message: string;
  detail?: string;
  invalidParams?: InvalidParam[];
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly invalidParams: InvalidParam[];

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
    this.detail = options.detail ?? options.message;
    this.invalidParams = options.invalidParams ?? [];
    Error.captureStackTrace?.(this, new.target);
  }
}