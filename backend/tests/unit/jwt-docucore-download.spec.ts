import { describe, expect, it } from 'vitest';
import {
  firmarTokenAcceso,
  firmarTokenDescargaDocuCore,
  verificarTokenDescargaDocuCore,
  verificarTokenAcceso,
} from '../../src/core/auth/jwt.service.js';

describe('JWT de descarga DocuCore', () => {
  it('limita el token a un usuario y expediente con ámbito propio', () => {
    const token = firmarTokenDescargaDocuCore(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    );

    const claims = verificarTokenDescargaDocuCore(token);

    expect(claims.sub).toBe('00000000-0000-4000-8000-000000000001');
    expect(claims.resource).toBe('00000000-0000-4000-8000-000000000002');
    expect(claims.exp - claims.iat).toBe(300);
    expect(() => verificarTokenAcceso(token)).toThrow('No autenticado.');
  });

  it('rechaza un JWT normal sin scope de descarga', () => {
    const token = firmarTokenAcceso({ sub: 'usuario', roles: [] });
    expect(() =>
      verificarTokenDescargaDocuCore(token),
    ).toThrow('No autenticado.');
  });
});
