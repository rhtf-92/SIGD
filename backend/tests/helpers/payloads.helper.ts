import { randomUUID, randomInt } from 'node:crypto';

export function payloadRadicacionValido() {
  return {
    numero: `EXP-${randomInt(1_000_000, 9_999_999)}`,
    dni_solicitante: String(randomInt(10_000_000, 99_999_999)),
    numero_documento: `DOC-${randomInt(1_000, 9999)}`,
    folios: randomInt(1, 50),
    tipo_documental_id: randomUUID(),
    solicitante_id: randomUUID(),
    area_destino_id: randomUUID(),
  };
}

export function correlationIdFijo(): string {
  return randomUUID();
}