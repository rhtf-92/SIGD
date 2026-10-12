import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const raiz = fileURLToPath(new URL('../../..', import.meta.url));
const compose = readFileSync(`${raiz}/docker-compose.yml`, 'utf8');
const server = readFileSync(`${raiz}/backend/src/server.ts`, 'utf8');
const envExample = () => readFileSync(`${raiz}/.env.example`, 'utf8');

describe('contrato de arranque con Docker Compose', () => {
  it('usa una versión de Node compatible con el frontend y exige el secreto JWT', () => {
    expect(compose).toContain('image: node:24-alpine');
    expect(compose).toContain('AUTH_JWT_SECRET: ${AUTH_JWT_SECRET:?AUTH_JWT_SECRET es obligatorio}');
  });

  it('documenta el secreto necesario para ejecutar Compose localmente', () => {
    expect(envExample()).toContain('AUTH_JWT_SECRET=');
    expect(envExample()).toContain('POSTGRES_PASSWORD=CAMBIAR_');
    expect(compose).not.toContain('postgres_password');
    expect(compose).not.toContain('minioadminpassword');
  });

  it('separa la URL S3 pública de la URL interna del contenedor', () => {
    expect(compose).toContain('S3_PUBLIC_ENDPOINT: http://localhost:9000');
  });

  it('inicializa el bucket antes del backend y evita el puerto PostgreSQL ocupado del host', () => {
    expect(compose).toContain('minio-init:');
    expect(compose).toContain('chainguard/minio:latest');
    expect(compose).toContain('condition: service_started');
    expect(compose).toContain('amazon/aws-cli:2.27.0');
    expect(compose).toContain('entrypoint: ["/bin/sh", "-c",');
    expect(compose).toContain('aws --endpoint-url http://minio:9000 s3 mb s3://sigd-expedientes');
    expect(compose).toContain('"5433:5432"');
  });

  it('entrega al worker la variable que realmente consume', () => {
    expect(compose).toContain('OUTBOX_POLL_MS: 5000');
  });

  it('no inicia Vite hijo salvo que se solicite explícitamente', () => {
    expect(server).toContain("process.env.START_VITE_WITH_BACKEND === 'true'");
  });

  it('mantiene las dependencias del frontend en un volumen Linux', () => {
    expect(compose).toContain('frontend_node_modules:/app/node_modules');
  });
});
