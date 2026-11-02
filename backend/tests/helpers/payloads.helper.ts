import { randomUUID, randomInt } from 'node:crypto';

export const PERSONA_E2E_ID = '00000000-0000-4000-8000-000000000001';
export const AREA_E2E_ID = '00000000-0000-4000-8000-000000000002';

export function payloadRadicacionValido() {
  return {
    numero: `EXP-${randomInt(1_000_000, 9_999_999)}`,
    dni_solicitante: String(randomInt(10_000_000, 99_999_999)),
    numero_documento: `DOC-${randomInt(1_000, 9999)}`,
    folios: randomInt(1, 50),
    tipo_documental_id: randomUUID(),
    solicitante_id: PERSONA_E2E_ID,
    area_destino_id: AREA_E2E_ID,
  };
}

export function correlationIdFijo(): string {
  return randomUUID();
}