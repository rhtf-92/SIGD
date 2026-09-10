import type { InvalidParam } from '../shared/domain/errors/index.js';

export interface ZodIssueLike {
  path: (string | number)[];
  message: string;
}

export interface ZodErrorLike {
  issues: ZodIssueLike[];
}

export function esErrorZod(valor: unknown): valor is ZodErrorLike {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'issues' in valor &&
    Array.isArray((valor as ZodErrorLike).issues)
  );
}

export function mapearIssuesZod(issues: ZodIssueLike[]): InvalidParam[] {
  return issues.map((issue) => ({
    name: issue.path.join('.'),
    reason: issue.message,
  }));
}