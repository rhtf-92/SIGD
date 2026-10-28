import { describe, expect, it } from 'vitest';
import { registroCiudadanoSchema } from '../../../../src/domains/identicore/registro.schemas.js';

describe('registro ciudadano con documento CE', () => {
  it('acepta CE real del catálogo y conserva su identificador', () => {
    const result = registroCiudadanoSchema.safeParse({
      tipoPersona: 'NATURAL', tipoDocumento: 'CE', ce: 'AB1234567X',
      nombres: 'María', apellidoPaterno: 'Pérez', apellidoMaterno: 'Ramos',
      correo: 'maria@example.com', celular: '961234567',
      ubigeoDistrito: '250101', direccion: 'Jr. Tarapacá 645',
      password: 'MiClaveSegura#2026', consentimientoDatos: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tipoDocumento).toBe('CE');
      expect(result.data.ce).toBe('AB1234567X');
    }
  });
});
