import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const raiz = fileURLToPath(new URL('../../..', import.meta.url));
const compose = readFileSync(`${raiz}/docker-compose.yml`, 'utf8');
const server = readFileSync(`${raiz}/backend/src/server.ts`, 'utf8');
const backendDockerfile = readFileSync(`${raiz}/backend/Dockerfile`, 'utf8');
const frontendDockerfile = readFileSync(`${raiz}/frontend/Dockerfile`, 'utf8');
const envExample = () => readFileSync(`${raiz}/.env.example`, 'utf8');

describe('contrato de arranque con Docker Compose', () => {
  it('usa una versión de Node compatible con el frontend y exige el secreto JWT', () => {
    expect(backendDockerfile).toContain('FROM node:24.19-alpine');
    expect(compose).toContain('AUTH_JWT_SECRET: ${AUTH_JWT_SECRET:?AUTH_JWT_SECRET es obligatorio}');
  });

  it('documenta el secreto necesario para ejecutar Compose localmente', () => {
    expect(envExample()).toContain('AUTH_JWT_SECRET=');
    expect(envExample()).toContain('POSTGRES_PASSWORD=CAMBIAR_');
    expect(compose).not.toContain('postgres_password');
    expect(compose).toContain('S3_SECRET_KEY: ${S3_SECRET_KEY:?S3_SECRET_KEY es obligatorio}');
  });

  it('separa la URL S3 pública de la URL interna del contenedor', () => {
    expect(compose).toContain('S3_PUBLIC_ENDPOINT: http://localhost:9000');
  });

  it('mantiene el almacenamiento S3 persistente y evita el puerto PostgreSQL habitual', () => {
    expect(compose).toContain('chrislusf/seaweedfs:4.17@sha256:');
    expect(compose).toContain('S3_BUCKET: ${S3_BUCKET:-sigd-expedientes}');
    expect(compose).toContain('s3data:/data');
    expect(compose).toContain('127.0.0.1:${POSTGRES_PORT:-5433}:5432');
  });

  it('entrega al worker la variable que realmente consume', () => {
    expect(compose).toContain('OUTBOX_POLL_INTERVAL_MS: 5000');
  });

  it('no inicia Vite hijo salvo que se solicite explícitamente', () => {
    expect(server).toContain("process.env.START_VITE_WITH_BACKEND === 'true'");
  });

  it('ejecuta el código y las dependencias empacados desde el contexto reconstruido', () => {
    expect(compose).toContain('context: ./backend');
    expect(compose).toContain('context: ./frontend');
    expect(compose).not.toContain('./backend:/app');
    expect(compose).not.toContain('./frontend:/app');
    expect(compose).not.toContain('_node_modules:/app/node_modules');
  });

  it('conecta el backend a PostgreSQL por la red interna sin depender de otra .env', () => {
    expect(compose).toContain('@postgres:5432/${POSTGRES_DB:?POSTGRES_DB es obligatorio}');
    expect(compose).not.toContain('DATABASE_URL: ${DATABASE_URL:');
  });

  it('dirige el proxy de Vite al servicio backend dentro de Docker', () => {
    expect(compose).toContain('VITE_PROXY_TARGET: http://backend:3000');
  });

  it('instala dependencias reproducibles dentro de las imágenes de desarrollo', () => {
    expect(backendDockerfile).toContain('RUN npm ci');
    expect(frontendDockerfile).toContain('RUN npm ci');
  });
});
