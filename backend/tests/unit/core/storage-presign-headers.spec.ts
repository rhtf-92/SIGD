import { describe, expect, it } from 'vitest';
import { generarUrlPresigned } from '../../../src/core/storage/s3-storage.service.js';
import type { ConfiguracionS3 } from '../../../src/config/s3.config.js';

const config: ConfiguracionS3 = {
  endpoint: 'http://127.0.0.1:9000', region: 'us-east-1', bucket: 'sigd-expedientes',
  accessKey: 'test-access', secretKey: 'test-secret', forcePathStyle: true,
  presignExpirationSegundos: 900,
};

describe('URLs prefirmadas compatibles con clientes HTTP y MinIO', () => {
  it('firma solo las cabeceras que el cliente envía para PUT y GET', () => {
    const ahora = new Date('2026-10-23T12:00:00.000Z');
    const put = new URL(generarUrlPresigned('expedientes/prueba.pdf', config,
      { metodo: 'PUT', contentType: 'application/pdf', ahora }));
    const get = new URL(generarUrlPresigned('expedientes/prueba.pdf', config,
      { metodo: 'GET', ahora }));
    expect(put.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    expect(get.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(put.searchParams.get('X-Amz-Date')).toBe('20261023T120000Z');
  });

  it('firma HEAD como HEAD, sin reutilizar una firma GET', () => {
    const ahora = new Date('2026-10-23T12:00:00.000Z');
    const head = new URL(generarUrlPresigned('expedientes/prueba.pdf', config,
      { metodo: 'HEAD', ahora }));
    const get = new URL(generarUrlPresigned('expedientes/prueba.pdf', config,
      { metodo: 'GET', ahora }));
    expect(head.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(head.searchParams.get('X-Amz-Signature')).not.toBe(get.searchParams.get('X-Amz-Signature'));
  });
});
