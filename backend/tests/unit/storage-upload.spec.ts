import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearRouterStorage } from '../../src/core/storage/storage.router.js';

describe('Storage · Subida de Archivos PDF con Multer (POST /api/v1/storage/upload)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', crearRouterStorage());

  it('recibe un archivo PDF válido, lo almacena en disco y retorna la referencia de almacenamiento', async () => {
    const pdfContenido = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF';
    const buffer = Buffer.from(pdfContenido, 'utf-8');
    const hashEsperado = crypto.createHash('sha256').update(buffer).digest('hex');

    const res = await request(app)
      .post('/api/v1/storage/upload')
      .attach('archivo', buffer, 'expediente_solicitud_2026.pdf');

    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('ruta');
    expect(res.body).toHaveProperty('storageUrl');
    expect(res.body).toHaveProperty('s3Key');
    expect(res.body).toHaveProperty('nombreOriginal', 'expediente_solicitud_2026.pdf');
    expect(res.body).toHaveProperty('hashSha256', hashEsperado);
    expect(res.body).toHaveProperty('tamano', buffer.length);
    expect(res.body.ruta).toMatch(/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i);
    expect(res.body.storageUrl).toBe(res.body.ruta);

    // Verificar que el archivo realmente existe en el sistema de archivos local
    const anio = String(new Date().getFullYear());
    const rutaEnDisco = path.resolve(process.cwd(), 'uploads', 'expedientes', anio, `${res.body.id}.pdf`);
    expect(fs.existsSync(rutaEnDisco)).toBe(true);

    // Limpiar archivo creado durante el test
    fs.unlinkSync(rutaEnDisco);
  });

  it('rechaza archivos que no tengan cabecera PDF válida (%PDF-)', async () => {
    const fakeBuffer = Buffer.from('ESTO NO ES UN PDF SINO TEXTO PLANO', 'utf-8');

    const res = await request(app)
      .post('/api/v1/storage/upload')
      .attach('archivo', fakeBuffer, 'falso.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cabecera válida de documento PDF/i);
  });

  it('rechaza peticiones sin ningún archivo adjunto', async () => {
    const res = await request(app)
      .post('/api/v1/storage/upload')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No se recibió ningún archivo PDF/i);
  });
});
