import type { Pool, PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistroCiudadanoService } from '../../../../src/domains/identicore/registroCiudadano.service.js';
import type { UbigeoService } from '../../../../src/domains/identicore/ubigeo.service.js';
import { registroCiudadanoSchema } from '../../../../src/domains/identicore/registro.schemas.js';

vi.mock('../../../../src/domains/identicore/argon2.service.js', () => ({
  Argon2Service: {
    hash: vi.fn(),
  },
}));

import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';

describe('RegistroCiudadanoService', () => {
  beforeEach(() => {
    vi.mocked(Argon2Service.hash).mockResolvedValue('$argon2id$registro-hash');
  });

  it('normaliza documentos CE con espacios o letras minúsculas', () => {
    const resultado = registroCiudadanoSchema.safeParse({
      tipoPersona: 'NATURAL',
      numeroDocumento: ' ab123456789 ',
      tipoDocumento: 'CE',
      nombres: 'Ana Maria',
      apellidoPaterno: 'Perez',
      apellidoMaterno: 'Ramos',
      fechaNacimiento: '1998-05-15',
      correo: 'ana@example.com',
      celular: '961234567',
      ubigeoDistrito: '250107',
      direccion: 'Jiron Principal 123',
      referenciaDomicilio: '',
      password: 'Clave*AB123456789',
      consentimientoDatos: true,
      declaracionJurada: true,
      aceptaNotificaciones: true,
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.dni).toBe('AB123456789');
  });

  it('guarda persona, cuenta y consentimientos usando el esquema SIGD en una transacción', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '1' }] })
      .mockResolvedValueOnce({ rows: [{ existe: false }] })
      .mockResolvedValueOnce({ rows: [{ id: 'persona-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'usuario-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'rol-usuario-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const ubigeo = {
      contieneDistrito: vi.fn().mockResolvedValue(true),
    } as unknown as UbigeoService;
    const datos = registroCiudadanoSchema.parse({
      tipoPersona: 'NATURAL',
      dni: '74561238',
      tipoDocumento: 'DNI',
      nombres: 'Sergio',
      apellidoPaterno: 'Serruche',
      apellidoMaterno: 'Panduro',
      correo: 'sergio@example.com',
      celular: '961234567',
      direccion: 'Jr. Masisea 460',
      referenciaDomicilio: 'Frente a la plaza',
      fechaNacimiento: '1998-05-15',
      ubigeoDistrito: '250101',
      password: 'Clave*74561238',
      consentimientoDatos: true,
      declaracionJurada: true,
      aceptaNotificaciones: true,
    });

    await expect(
      new RegistroCiudadanoService(pool, ubigeo).registrarCiudadano(datos, null),
    ).resolves.toEqual({
      idPersona: 'persona-1',
      mensaje: 'Registro exitoso',
    });

    expect(query).toHaveBeenCalledTimes(11);
    expect(query.mock.calls[2][0]).toContain('p.tipo = $1 AND p.id_documento = $2');
    expect(query.mock.calls[3][0]).toContain('(tipo, id_documento, id_tipo_documento, direccion, ubigeo_distrito, referencia_domicilio)');
    expect(query.mock.calls[3][1]).toContain('Frente a la plaza');
    expect(query.mock.calls[4][0]).toContain('(id_persona, nombres, apellidos, nombre_completo, correo, telefono, fecha_nacimiento)');
    expect(query.mock.calls[4][1]).toContain('1998-05-15');
    expect(query.mock.calls[5][0]).toContain('(id_persona, usuario, correo, password_hash, debe_cambiar_password)');
    expect(query.mock.calls[5][0]).toContain('VALUES ($1, $2, $3, $4, TRUE)');
    expect(query.mock.calls[6][0]).toContain("WHERE codigo = 'CIUDADANO'");
    expect(query.mock.calls[7][0]).toContain('(id_persona, finalidade, version_politica, aceptado, fecha_aceptacion, ip_origen)');
    expect(query.mock.calls[8][0]).toContain("'Notificaciones electrónicas'");
    expect(query.mock.calls[9][0]).toContain("'Declaración jurada de veracidad'");
    expect(query.mock.calls[10][0]).toBe('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });
});
