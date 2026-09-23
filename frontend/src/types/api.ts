/**
 * Contratos de comunicación API bajo los estándares RFC 7807 (Problem Details for HTTP APIs)
 * y RFC 9457 para el Sistema Integral de Gestión Documentaria (SIGD).
 */

export type ProblemCategory =
  | "Validation"
  | "Security"
  | "Business"
  | "Conflict"
  | "System";

export interface InvalidParamDetail {
  name: string;
  reason: string;
}

export interface ApiProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  category: ProblemCategory;
  correlationId: string;
  invalidParams?: InvalidParamDetail[];
  retryable: boolean;
}

/**
 * Error tipado emitido por el cliente API centralizado cuando el backend
 * responde con una estructura Problem Details RFC 7807 o falla la red.
 */
export class ApiHttpError extends Error {
  readonly problemDetails: ApiProblemDetails;
  readonly status: number;
  readonly correlationId: string;

  constructor(problemDetails: ApiProblemDetails) {
    super(problemDetails.detail || problemDetails.title);
    this.name = "ApiHttpError";
    this.problemDetails = problemDetails;
    this.status = problemDetails.status;
    this.correlationId = problemDetails.correlationId;
    Object.setPrototypeOf(this, ApiHttpError.prototype);
  }
}
