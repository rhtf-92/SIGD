import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { IdentidadOtpService, type AlmacenOtp } from '../../../../src/domains/identicore/identidadOtp.service.js';

class AlmacenPrueba implements AlmacenOtp {
  ahora = 0;
  items = new Map<string, { valor: string; vence: number }>();
  cuotas = new Map<string, number>();
  async cuota(k: string, max: number) { const n = (this.cuotas.get(k) ?? 0) + 1; this.cuotas.set(k, n); return n <= max; }
  async guardar(k: string, valor: string, segundos: number) { this.items.set(k, { valor, vence: this.ahora + segundos }); }
  leer(k: string) { const row = this.items.get(k); return row && row.vence > this.ahora ? row : null; }
  async consumir(k: string) { const row = this.leer(k); this.items.delete(k); return row?.valor ?? null; }
  async verificar(k: string, digest: string) {
    const row = this.leer(k); if (!row) return null;
    const v = JSON.parse(row.valor); v.intentos++;
    if (digest === v.digest) { this.items.delete(k); return JSON.stringify(v.prueba); }
    if (v.intentos >= 5) this.items.delete(k); else row.valor = JSON.stringify(v);
    return null;
  }
}
const identidad = { tipoDocumento: 'DNI' as const, numeroDocumento: '00000050', nombres: 'Ciudadano', apellidos: 'Demo' };
const persona = { id_persona: '11111111-1111-4111-8111-111111111111', nombres: 'Ciudadano', apellidos: 'Demo', correo: 'original@sandbox.invalid' };
function preparar(row: unknown = persona) {
  const query = vi.fn().mockResolvedValue({ rows: row ? [row] : [] });
  const store = new AlmacenPrueba();
  const enviar = vi.fn().mockResolvedValue(undefined);
  const service = new IdentidadOtpService({ query } as unknown as Pool, store, { enviar }, 'x'.repeat(40));
  return { service, store, query, enviar };
}
describe('Reclamo de identidad por control del contacto preexistente', () => {
  it('envía solo al contacto original y consume una prueba ligada a persona/documento/contacto', async () => {
    const { service, enviar } = preparar();
    const start = await service.iniciar(identidad, 'ip');
    expect(enviar.mock.calls[0][0]).toBe(persona.correo);
    expect(JSON.stringify(start)).not.toContain(persona.correo);
    expect(JSON.stringify(start)).not.toContain(enviar.mock.calls[0][1]);
    const proof = await service.verificar(start.desafio, enviar.mock.calls[0][1], 'ip');
    await expect(service.consumir(proof.verificacionTitularidad, persona.id_persona, identidad.numeroDocumento, persona.correo)).resolves.toBeUndefined();
    await expect(service.consumir(proof.verificacionTitularidad, persona.id_persona, identidad.numeroDocumento, persona.correo)).rejects.toMatchObject({ code: 'IDENTITY_VERIFICATION_INVALID' });
  });
  it.each([null, { ...persona, nombres: 'Otra' }, { ...persona, correo: null }])('no enumera ni emite pruebas para identidades incompatibles o sin contacto (%j)', async row => {
    const { service, enviar } = preparar(row);
    const r = await service.iniciar(identidad, 'ip');
    expect(r).toHaveProperty('desafio'); expect(enviar).not.toHaveBeenCalled();
    await expect(service.verificar(r.desafio, '123456', 'ip')).rejects.toMatchObject({ code: 'IDENTITY_VERIFICATION_INVALID' });
  });
  it('rechaza OTP caducado', async () => {
    const { service, store, enviar } = preparar(); const r = await service.iniciar(identidad, 'ip'); store.ahora = 601;
    await expect(service.verificar(r.desafio, enviar.mock.calls[0][1], 'ip')).rejects.toMatchObject({ code: 'IDENTITY_VERIFICATION_INVALID' });
  });
  it('agota cinco intentos y rechaza incluso el código correcto después', async () => {
    const { service, enviar } = preparar(); const r = await service.iniciar(identidad, 'ip');
    const real = enviar.mock.calls[0][1]; const incorrecto = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(service.verificar(r.desafio, incorrecto, 'ip')).rejects.toMatchObject({ status: 400 });
    await expect(service.verificar(r.desafio, real, 'ip')).rejects.toMatchObject({ status: 400 });
  });
  it('solo una verificación concurrente puede emitir prueba', async () => {
    const { service, enviar } = preparar(); const r = await service.iniciar(identidad, 'ip');
    const results = await Promise.allSettled([service.verificar(r.desafio, enviar.mock.calls[0][1], 'ip'), service.verificar(r.desafio, enviar.mock.calls[0][1], 'ip')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });
  it.each(['persona', 'documento', 'contacto', 'caducidad'])('rechaza prueba aplicada a otro %s', async campo => {
    const { service, enviar, store } = preparar(); const r = await service.iniciar(identidad, 'ip');
    const proof = await service.verificar(r.desafio, enviar.mock.calls[0][1], 'ip');
    if (campo === 'caducidad') store.ahora = 301;
    await expect(service.consumir(proof.verificacionTitularidad,
      campo === 'persona' ? 'otra-persona' : persona.id_persona,
      campo === 'documento' ? '99999999' : identidad.numeroDocumento,
      campo === 'contacto' ? 'nuevo@sandbox.invalid' : persona.correo)).rejects.toMatchObject({ code: 'IDENTITY_VERIFICATION_INVALID' });
  });
  it('limita solicitudes por documento incluso cambiando IP', async () => {
    const { service } = preparar(); for (let i = 0; i < 3; i++) await service.iniciar(identidad, 'ip' + i);
    await expect(service.iniciar(identidad, 'otra-ip')).rejects.toMatchObject({ status: 429 });
  });
  it('sin transporte o secreto seguro no busca personas ni envía códigos', async () => {
    const query = vi.fn(); const s = new IdentidadOtpService({ query } as unknown as Pool);
    await expect(s.iniciar(identidad, 'ip')).rejects.toMatchObject({ status: 503 }); expect(query).not.toHaveBeenCalled();
  });
});
