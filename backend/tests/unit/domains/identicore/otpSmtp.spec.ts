import { describe, it, vi, expect, beforeEach } from 'vitest';
const { sendMail, createTransport } = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport } }));
import { crearEntregaOtpSmtp } from '../../../../src/domains/identicore/otpSmtp.js';
const config = { IDENTICORE_OTP_ENABLED: 'true', IDENTICORE_OTP_SMTP_HOST: 'smtp.sandbox.invalid',
  IDENTICORE_OTP_SMTP_PORT: '587', IDENTICORE_OTP_SMTP_USER: 'test', IDENTICORE_OTP_SMTP_PASSWORD: 'test-only',
  IDENTICORE_OTP_SMTP_FROM: 'sigd@sandbox.invalid' };
beforeEach(() => { vi.resetAllMocks(); createTransport.mockReturnValue({ sendMail }); });
describe('SMTP OTP con configuración explícita', () => {
  it.each([{}, { ...config, IDENTICORE_OTP_ENABLED: 'false' }, { ...config, IDENTICORE_OTP_SMTP_PASSWORD: '' },
    { ...config, IDENTICORE_OTP_SMTP_PORT: '25' }, { ...config, IDENTICORE_OTP_SMTP_FROM: 'bad\nheader@sandbox.invalid' }])('no habilita envío con configuración incompleta o insegura (%j)', env => {
    expect(crearEntregaOtpSmtp(env)).toBeUndefined(); expect(createTransport).not.toHaveBeenCalled();
  });
  it('exige TLS validado, limita tiempos y desactiva lectura de archivos, URLs y logs', async () => {
    sendMail.mockResolvedValue({ accepted: ['original@sandbox.invalid'] });
    const transport = crearEntregaOtpSmtp(config)!; await transport.enviar('original@sandbox.invalid', '123456');
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true, debug: false, logger: false,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }, disableFileAccess: true, disableUrlAccess: true }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'original@sandbox.invalid', from: config.IDENTICORE_OTP_SMTP_FROM }));
  });
  it('rechazo SMTP no genera falso éxito ni expone el error del proveedor', async () => {
    sendMail.mockRejectedValue(new Error('provider-secret'));
    await expect(crearEntregaOtpSmtp(config)!.enviar('original@sandbox.invalid', '123456')).rejects.toThrow('OTP_DELIVERY_UNAVAILABLE');
  });
});
