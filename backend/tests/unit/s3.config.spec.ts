import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { obtenerConfiguracionS3 } from '../../src/config/s3.config.js';

function rutaPrimerError(env: NodeJS.ProcessEnv): PropertyKey[] {
  try {
    obtenerConfiguracionS3(env);
    throw new Error('Se esperaba que la configuración fuera rechazada.');
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    return error.issues[0]?.path ?? [];
  }
}

describe('configuración S3', () => {
  it('conserva un endpoint público para URLs que abre el navegador', () => {
    const configuracion = obtenerConfiguracionS3({
      S3_ENDPOINT: 'http://minio:9000',
      S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'local-access-key',
      S3_SECRET_KEY: 'local-secret-key-segura',
    });

    expect(configuracion.publicEndpoint).toBe('http://localhost:9000');
  });

  it('exige credenciales S3 explícitas en cualquier entorno', () => {
    expect(() => obtenerConfiguracionS3({
      NODE_ENV: 'development',
      S3_ENDPOINT: 'http://localhost:9000',
    })).toThrow();
  });

  it.each([
    ['minioadmin', 'minioadmin'],
    ['CAMBIAR_USUARIO_MINIO', 'CAMBIAR_PASSWORD_MINIO'],
  ])('rechaza credenciales predeterminadas o marcadores en producción', (accessKey, secretKey) => {
    expect(() => obtenerConfiguracionS3({
      NODE_ENV: 'production',
      S3_ENDPOINT: 'https://s3.institucion.example',
      S3_ACCESS_KEY: accessKey,
      S3_SECRET_KEY: secretKey,
    })).toThrow(/credenciales S3 inseguras/i);
  });

  it('atribuye al campo correcto cada credencial insegura de producción', () => {
    const accessKeyInsegura = rutaPrimerError({
      NODE_ENV: 'production',
      S3_ENDPOINT: 'https://s3.institucion.example',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'secreto-produccion-gestionado-externamente',
    });
    const secretKeyInsegura = rutaPrimerError({
      NODE_ENV: 'production',
      S3_ENDPOINT: 'https://s3.institucion.example',
      S3_ACCESS_KEY: 'sigd-production-service',
      S3_SECRET_KEY: 'minioadmin',
    });

    expect(accessKeyInsegura).toEqual(['S3_ACCESS_KEY']);
    expect(secretKeyInsegura).toEqual(['S3_SECRET_KEY']);
  });

  it('rechaza los marcadores EXAMPLE de acceso y secreto en producción', () => {
    const accessKeyEjemplo = rutaPrimerError({
      NODE_ENV: 'production',
      S3_ENDPOINT: 'https://s3.institucion.example',
      S3_ACCESS_KEY: 'EXAMPLE_S3_ACCESS_KEY',
      S3_SECRET_KEY: 'secreto-produccion-gestionado-externamente',
    });
    const secretKeyEjemplo = rutaPrimerError({
      NODE_ENV: 'production',
      S3_ENDPOINT: 'https://s3.institucion.example',
      S3_ACCESS_KEY: 'sigd-production-service',
      S3_SECRET_KEY: 'EXAMPLE_S3_SECRET_KEY',
    });

    expect(accessKeyEjemplo).toEqual(['S3_ACCESS_KEY']);
    expect(secretKeyEjemplo).toEqual(['S3_SECRET_KEY']);
  });

  it('acepta credenciales explícitas no predeterminadas en producción', () => {
    const configuracion = obtenerConfiguracionS3({
      NODE_ENV: 'production',
      S3_ENDPOINT: 'https://s3.institucion.example',
      S3_ACCESS_KEY: 'sigd-production-service',
      S3_SECRET_KEY: 'secreto-produccion-gestionado-externamente',
    });

    expect(configuracion.accessKey).toBe('sigd-production-service');
  });
});
