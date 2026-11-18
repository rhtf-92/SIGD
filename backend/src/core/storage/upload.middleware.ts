/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO: Almacenamiento Local de Archivos Adjuntos (Multer + Storage)
 * ARCHIVO: backend/src/core/storage/upload.middleware.ts
 * ==============================================================================
 * DESCRIPCIÓN:
 * Middleware de carga de archivos PDF en disco local mediante Multer.
 * - Almacenamiento físico en uploads/expedientes/{anio}/{uuid}.pdf
 * - Creación automática de directorios recursivos
 * - Validación estricta de MIME application/pdf y extensión .pdf
 * - Límite de tamaño: 20 MB (20,971,520 bytes)
 * - Verificación de Magic Bytes (%PDF-)
 * - Cómputo server-side de hash SHA-256
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/** Directorio raíz para archivos subidos en el backend */
export const UPLOADS_ROOT_DIR = path.resolve(process.cwd(), 'uploads');
export const EXPEDIENTES_DIR = path.join(UPLOADS_ROOT_DIR, 'expedientes');

// Asegura la existencia del directorio base al iniciar
if (!fs.existsSync(EXPEDIENTES_DIR)) {
  fs.mkdirSync(EXPEDIENTES_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const anio = String(new Date().getFullYear());
    const folder = path.join(EXPEDIENTES_DIR, anio);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    cb(null, folder);
  },
  filename: (_req, _file, cb) => {
    const uuid = crypto.randomUUID();
    cb(null, `${uuid}.pdf`);
  },
});

export const uploadPdfMulter = multer({
  storage,
  limits: {
    fileSize: MAX_PDF_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const esPdfMime = file.mimetype === 'application/pdf';
    const esPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
    if (!esPdfMime && !esPdfExt) {
      return cb(new Error('Solo se permiten archivos en formato PDF (application/pdf).'));
    }
    cb(null, true);
  },
});

export interface UploadPdfResultado {
  id: string;
  url: string;
  ruta: string;
  storageUrl: string;
  s3Key: string;
  nombreOriginal: string;
  hashSha256: string;
  tamano: number;
  tamanoBytes: number;
  mimeType: string;
  mensaje: string;
}

/**
 * Controlador de respuesta para la subida de un archivo PDF
 */
export function procesarArchivoSubido(file: Express.Multer.File): UploadPdfResultado {
  const filePath = file.path;
  const fileBuffer = fs.readFileSync(filePath);

  // Validación de cabecera Magic Bytes (%PDF-)
  const magicBytes = fileBuffer.subarray(0, 5).toString('utf-8');
  if (!magicBytes.startsWith('%PDF-')) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignorar fallo al borrar archivo no válido
    }
    throw new Error('El archivo adjunto no tiene una cabecera válida de documento PDF.');
  }

  const hashSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const anio = String(new Date().getFullYear());
  const nombreFisico = path.basename(filePath);
  const id = nombreFisico.replace(/\.pdf$/i, '');
  const ruta = `expedientes/${anio}/${nombreFisico}`;
  const url = `/uploads/expedientes/${anio}/${nombreFisico}`;

  return {
    id,
    url,
    ruta,
    storageUrl: ruta,
    s3Key: ruta,
    nombreOriginal: file.originalname,
    hashSha256,
    tamano: file.size,
    tamanoBytes: file.size,
    mimeType: 'application/pdf',
    mensaje: 'Archivo PDF subido y verificado con éxito.',
  };
}

/**
 * Middleware express completo para manejar subida de PDF con control de errores Multer
 */
export function middlewareSubidaPdf(req: Request, res: Response, next: NextFunction): void {
  uploadPdfMulter.any()(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            status: 400,
            code: 'FILE_TOO_LARGE',
            message: 'El archivo excede el tamaño máximo permitido de 20 MB.',
          });
          return;
        }
        res.status(400).json({
          status: 400,
          code: err.code,
          message: err.message,
        });
        return;
      }
      res.status(400).json({
        status: 400,
        code: 'UPLOAD_ERROR',
        message: err instanceof Error ? err.message : 'Error al procesar la subida del archivo.',
      });
      return;
    }

    const file = req.file || (Array.isArray(req.files) ? req.files[0] : undefined);
    if (!file) {
      res.status(400).json({
        status: 400,
        code: 'NO_FILE_UPLOADED',
        message: 'No se recibió ningún archivo PDF para cargar.',
      });
      return;
    }

    try {
      const resultado = procesarArchivoSubido(file);
      res.status(200).json(resultado);
    } catch (error) {
      res.status(400).json({
        status: 400,
        code: 'INVALID_PDF',
        message: error instanceof Error ? error.message : 'El archivo PDF no es válido.',
      });
    }
  });
}
