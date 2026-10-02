export interface PostgresqlError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

export interface MapeoErrorPg {
  status: number;
  code: string;
  detail: string;
}

const MATRIZ_PG: Record<string, MapeoErrorPg> = {
  '23505': { status: 409, code: 'DUPLICATE_KEY', detail: 'El registro ya se encuentra registrado.' },
  '23503': { status: 400, code: 'FOREIGN_KEY_VIOLATION', detail: 'El recurso referenciado no es válido.' },
  '23502': { status: 400, code: 'NOT_NULL_VIOLATION', detail: 'Un campo obligatorio no fue proporcionado.' },
  P0001: { status: 422, code: 'DOMAIN_RULE', detail: 'Regla de negocio incumplida.' },
};

export function esErrorPostgresql(valor: unknown): valor is PostgresqlError {
  return (
    valor instanceof Error &&
    typeof (valor as PostgresqlError).code === 'string' &&
    (valor as PostgresqlError).code !== ''
  );
}

export function mapearErrorPostgresql(error: PostgresqlError): MapeoErrorPg {
  if (error.code && MATRIZ_PG[error.code]) {
    return MATRIZ_PG[error.code];
  }
  return { status: 500, code: 'INTERNAL_ERROR', detail: 'Ocurrió un error interno en el servidor.' };
}