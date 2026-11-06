import { describe, expect, it } from 'vitest';
import { obtenerConfiguracionS3 } from '../../src/config/s3.config.js';

describe('configuración S3', () => {
  it('conserva un endpoint público para URLs que abre el navegador', () => {
    const configuracion = obtenerConfiguracionS3({
      S3_ENDPOINT: 'http://minio:9000',
      S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
    });

    expect(configuracion.publicEndpoint).toBe('http://localhost:9000');
  });
});
