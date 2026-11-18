import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';
import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { magicBytesValidator } from '../../../../src/middlewares/magicBytesValidator.middleware.js';
import { HashIntegrityService } from '../../../../src/domains/docucore/hashIntegrity.service.js';
import {
  EdicionResolucionesService,
  ENTIDADES_REQUERIDAS,
  ESQUEMA_PROYECTO_RESOLUCION_AUSENTE,
} from '../../../../src/domains/docucore/edicionResoluciones.service.js';
import { AppError } from '../../../../src/shared/domain/errors/index.js';

function crearMockRequest(body: unknown, contentType: string): Request {
  return {
    body,
    get: ((header: string): string | undefined =>
      header.toLowerCase() === 'content-type' ? contentType : undefined) as Request['get'],
  } as Request;
}

function crearMockResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnThis();
  res.json = vi.fn().mockReturnThis();
  res.setHeader = vi.fn().mockReturnThis();
  return res;
}

function crearMockNext(): NextFunction {
  return vi.fn();
}

const PDF_FIRMA = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
const PDF_VALIDO = Buffer.concat([PDF_FIRMA, Buffer.from('1.7\n%%EOF\n')]);
const PDF_SIN_QUINTO_BYTE = Buffer.from([0x25, 0x50, 0x44, 0x46]);
const EXE_RENOMBRADO = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.from('MZ payload')]);
const PNG_RENOMBRADO = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]);
const BUFFER_VACIO = Buffer.alloc(0);
const BUFFER_INCOMPLETO = Buffer.from([0x25, 0x50, 0x44]);
const HIBRIDO_SIN_PDF = Buffer.concat([Buffer.from([0x4d, 0x5a]), PDF_VALIDO, EXE_RENOMBRADO]);
const HIBRIDO_CON_PDF = Buffer.concat([PDF_VALIDO, Buffer.from('\n%%EOF\n'), EXE_RENOMBRADO]);

const MULTIPART = 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW';

describe('DC-05 — magicBytesValidator', () => {
  it('acepta un PDF con la firma completa de cinco bytes', () => {
    const next = crearMockNext();
    magicBytesValidator(crearMockRequest(PDF_VALIDO, MULTIPART), crearMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('acepta un PDF de cinco bytes exactos, sin cuerpo posterior', () => {
    const next = crearMockNext();
    magicBytesValidator(crearMockRequest(PDF_FIRMA, MULTIPART), crearMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 415 un PDF truncado al que le falta el quinto byte (guion)', () => {
    expect(() =>
      magicBytesValidator(crearMockRequest(PDF_SIN_QUINTO_BYTE, MULTIPART), crearMockResponse(), crearMockNext()),
    ).toThrow(AppError);

    try {
      magicBytesValidator(crearMockRequest(PDF_SIN_QUINTO_BYTE, MULTIPART), crearMockResponse(), crearMockNext());
    } catch (error) {
      expect((error as AppError).status).toBe(415);
      expect((error as AppError).code).toBe('MAGIC_BYTES_INVALID');
    }
  });

  it('rechaza con 415 un PDF que conserva %PDF pero cambia el quinto byte', () => {
    const quintoByteAlterado = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x39]);

    expect(() =>
      magicBytesValidator(crearMockRequest(quintoByteAlterado, MULTIPART), crearMockResponse(), crearMockNext()),
    ).toThrow(AppError);

    try {
      magicBytesValidator(crearMockRequest(quintoByteAlterado, MULTIPART), crearMockResponse(), crearMockNext());
    } catch (error) {
      expect((error as AppError).code).toBe('MAGIC_BYTES_MISMATCH');
    }
  });

  it('rechaza con 415 un ejecutable renombrado a .pdf', () => {
    expect(() =>
      magicBytesValidator(crearMockRequest(EXE_RENOMBRADO, MULTIPART), crearMockResponse(), crearMockNext()),
    ).toThrow(AppError);

    try {
      magicBytesValidator(crearMockRequest(EXE_RENOMBRADO, MULTIPART), crearMockResponse(), crearMockNext());
    } catch (error) {
      expect((error as AppError).code).toBe('MAGIC_BYTES_MISMATCH');
    }
  });

  it('rechaza con 415 una imagen PNG renombrada a .pdf', () => {
    expect(() =>
      magicBytesValidator(crearMockRequest(PNG_RENOMBRADO, MULTIPART), crearMockResponse(), crearMockNext()),
    ).toThrow(AppError);
  });

  it('rechaza con 415 un buffer vacio', () => {
    expect(() =>
      magicBytesValidator(crearMockRequest(BUFFER_VACIO, MULTIPART), crearMockResponse(), crearMockNext()),
    ).toThrow(AppError);
  });

  it('rechaza con 415 un buffer truncado de cuatro bytes', () => {
    expect(() =>
      magicBytesValidator(crearMockRequest(BUFFER_INCOMPLETO, MULTIPART), crearMockResponse(), crearMockNext()),
    ).toThrow(AppError);
  });

  it('rechaza un MIME falsificado a application/pdf', () => {
    const next = crearMockNext();

    expect(() =>
      magicBytesValidator(crearMockRequest(EXE_RENOMBRADO, 'application/pdf'), crearMockResponse(), next),
    ).toThrow(AppError);

    expect(next).not.toHaveBeenCalled();

    try {
      magicBytesValidator(crearMockRequest(EXE_RENOMBRADO, 'application/pdf'), crearMockResponse(), next);
    } catch (error) {
      expect((error as AppError).status).toBe(415);
      expect((error as AppError).code).toBe('MAGIC_BYTES_MISMATCH');
    }
  });

  it('acepta un PDF legitimo declarado como application/pdf', () => {
    const next = crearMockNext();
    magicBytesValidator(crearMockRequest(PDF_VALIDO, 'application/pdf'), crearMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rechaza un MIME falsificado cuando el transporte es octet-stream', () => {
    expect(() =>
      magicBytesValidator(crearMockRequest(EXE_RENOMBRADO, 'application/octet-stream'), crearMockResponse(), crearMockNext()),
    ).toThrow(AppError);
  });

  it('rechaza con 415 un multipart cuyo archivo no fue extraido, en vez de aprobarlo en silencio', () => {
    const next = crearMockNext();

    expect(() => magicBytesValidator(crearMockRequest(undefined, MULTIPART), crearMockResponse(), next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();

    try {
      magicBytesValidator(crearMockRequest(undefined, MULTIPART), crearMockResponse(), next);
    } catch (error) {
      expect((error as AppError).status).toBe(415);
      expect((error as AppError).code).toBe('MAGIC_BYTES_UNAVAILABLE');
    }
  });

  it('rechaza con 415 cuando el body no es un Buffer aunque se declare un archivo', () => {
    expect(() =>
      magicBytesValidator(crearMockRequest({ campo: 'texto' }, MULTIPART), crearMockResponse(), crearMockNext()),
    ).toThrow(AppError);
  });

  it('rechaza un archivo hibrido cuya firma no es PDF', () => {
    expect(() =>
      magicBytesValidator(crearMockRequest(HIBRIDO_SIN_PDF, MULTIPART), crearMockResponse(), crearMockNext()),
    ).toThrow(AppError);

    try {
      magicBytesValidator(crearMockRequest(HIBRIDO_SIN_PDF, MULTIPART), crearMockResponse(), crearMockNext());
    } catch (error) {
      expect((error as AppError).code).toBe('MAGIC_BYTES_MISMATCH');
    }
  });

  it('ACEPTa un hibrido con firma PDF valida: limitacion explicita del detector', () => {
    const next = crearMockNext();
    magicBytesValidator(crearMockRequest(HIBRIDO_CON_PDF, MULTIPART), crearMockResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignora content-types que no transportan archivo', () => {
    const next = crearMockNext();
    magicBytesValidator(crearMockRequest({ titular: 'x' }, 'application/json'), crearMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('documenta la limitacion: no inspecciona estructura interna ni firmas Polyglot', () => {
    const traza = magicBytesValidator.toString();
    expect(traza).toContain('Buffer');
    expect(traza).not.toContain('Buffer.concat');
  });
});

describe('DC-06 — HashIntegrityService', () => {
  const servicio = new HashIntegrityService();

  it('produce el SHA-256 conocido de "abc"', async () => {
    const esperado = createHash('sha256').update('abc').digest('hex');
    const resultado = await servicio.calculateFromStream(Readable.from([Buffer.from('abc')]));

    expect(resultado.sha256).toBe(esperado);
    expect(resultado.sha256).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(resultado.bytesProcessed).toBe(3);
  });

  it('produce el mismo digest sea cual sea el numero de chunks', async () => {
    const contenido = 'a'.repeat(10_000);
    const entero = await servicio.calculateFromStream(Readable.from([Buffer.from(contenido)]));
    const fragmentado = await servicio.calculateFromStream(
      Readable.from([Buffer.from('a'.repeat(3_333)), Buffer.from('a'.repeat(3_333)), Buffer.from('a'.repeat(3_334))]),
    );

    expect(fragmentado.sha256).toBe(entero.sha256);
    expect(fragmentado.bytesProcessed).toBe(10_000);
  });

  it('produce el digest de un archivo vacio', async () => {
    const resultado = await servicio.calculateFromStream(Readable.from([]));

    expect(resultado.sha256).toBe(createHash('sha256').digest('hex'));
    expect(resultado.bytesProcessed).toBe(0);
  });

  it('rechaza cuando el stream emite error', async () => {
    const flujo = new Readable({
      read() {
        this.destroy(new Error('fallo de red'));
      },
    });

    await expect(servicio.calculateFromStream(flujo)).rejects.toThrow(/fallo de red/);
  });

  it('rechaza cuando el stream se destruye antes de concluir', async () => {
    const flujo = new Readable({
      read() {
        this.destroy(new Error('conexion interrumpida'));
      },
    });

    await expect(servicio.calculateFromStream(flujo)).rejects.toThrow(/conexion interrumpida/);
  });

  it('rechaza un stream que nunca emite chunks validos', async () => {
    const flujo = new Readable({
      read() {
        /* no produce nada */
      },
    });
    flujo.destroy();

    await expect(servicio.calculateFromStream(flujo)).rejects.toThrow();
  });

  it('calculateFromBuffer coincide con el calculo por stream', () => {
    const contenido = Buffer.from('contenido de prueba');
    const esperado = createHash('sha256').update(contenido).digest('hex');
    const resultado = servicio.calculateFromBuffer(contenido);

    expect(resultado.sha256).toBe(esperado);
    expect(resultado.bytesProcessed).toBe(contenido.length);
  });

  it('createHashStream hashtea mientras reenvia los bytes intactos', async () => {
    const contenido = Buffer.from('contenido que atraviesa el transform');
    const flujo = servicio.createHashStream();
    const resultadoPromesa = flujo.getResult();

    const recibido: Buffer[] = [];
    flujo.on('data', (trozo: Buffer) => recibido.push(trozo));
    await new Promise<void>((resolve) => {
      flujo.on('end', () => resolve());
      flujo.write(contenido);
      flujo.end();
    });

    const resultado = await resultadoPromesa;
    expect(resultado.sha256).toBe(createHash('sha256').update(contenido).digest('hex'));
    expect(Buffer.concat(recibido)).toEqual(contenido);
  });

  it('validateHashFormat acepta digests validos y rechaza otros', () => {
    expect(HashIntegrityService.validateHashFormat(createHash('sha256').digest('hex'))).toBe(true);
    expect(HashIntegrityService.validateHashFormat('no-es-un-hash')).toBe(false);
    expect(HashIntegrityService.validateHashFormat(createHash('sha256').digest('hex').toUpperCase())).toBe(false);
  });
});

describe('DC-07 — EdicionResolucionesService bloqueado por esquema ausente', () => {
  /**
   * El DDL institucional vigente no define las tablas de proyecto de resolucion,
   * por lo que el servicio no debe tocar la base de datos. Estos tests fijan ese
   * contrato: cuando se anada una migracion, habra que cambiarlos a proposito,
   * de modo que ningun SQL inventado pueda pasar inadvertido.
   */
  it('no ejecuta ningun SQL: su API no expone cliente de base de datos', () => {
    const fuente = EdicionResolucionesService.toString();
    expect(fuente).not.toContain('SELECT');
    expect(fuente).not.toContain('INSERT');
    expect(fuente).not.toContain('UPDATE');
    expect(fuente).not.toContain('FOR UPDATE');
    expect(fuente).not.toContain('query');
  });

  it('no redacta sentencias contra entidades que el DDL no define', () => {
    const fuente = EdicionResolucionesService.toString();
    expect(fuente).not.toMatch(/FROM\s+sigd_doc\./i);
    expect(fuente).not.toMatch(/INTO\s+sigd_doc\./i);
    expect(fuente).not.toMatch(/UPDATE\s+sigd_doc\./i);
  });

  it('declara las entidades requeridas para poder habilitar el servicio', () => {
    expect(ENTIDADES_REQUERIDAS).toContain('sigd_doc.proyecto_resolucion');
    expect(ENTIDADES_REQUERIDAS).toContain('sigd_doc.proyecto_resolucion_version');
  });

  it('no inventa estados de edicion ni columnas de visado', () => {
    const fuente = EdicionResolucionesService.toString();
    expect(fuente).not.toContain('BORRADOR');
    expect(fuente).not.toContain('EN_REVISION');
    expect(fuente).not.toContain('FIRMADO');
    expect(fuente).not.toContain('id_usuario_visador');
    expect(fuente).not.toContain('fecha_visado');
  });

  it.each([
    ['crearVersion', (s: EdicionResolucionesService) => s.crearVersion({ contenido: 'x' })],
    ['obtenerVersiones', (s: EdicionResolucionesService) => s.obtenerVersiones()],
    ['obtenerVersion', (s: EdicionResolucionesService) => s.obtenerVersion()],
    ['visarVersion', (s: EdicionResolucionesService) => s.visarVersion()],
  ])('%s rechaza con 501 en vez de fingir persistencia', (_nombre, invocar) => {
    const servicio = new EdicionResolucionesService();

    expect(() => invocar(servicio)).toThrow(AppError);

    try {
      invocar(servicio);
      expect.unreachable('el servicio debio lanzar');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.status).toBe(501);
      expect(appError.code).toBe(ESQUEMA_PROYECTO_RESOLUCION_AUSENTE);
    }
  });

  it('identifica en el detalle las entidades que faltan', () => {
    try {
      new EdicionResolucionesService().crearVersion({ contenido: 'x' });
      expect.unreachable('el servicio debio lanzar');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.detail).toContain('sigd_doc.proyecto_resolucion');
      expect(appError.detail).toContain('sigd_doc.proyecto_resolucion_version');
    }
  });

  it('conserva el calculo del digest, que es puro e independiente del esquema', () => {
    const contenido = 'articulo primero';
    const esperado = createHash('sha256').update(contenido, 'utf8').digest('hex');
    const resultado = new EdicionResolucionesService().calcularHashContenido(contenido);

    expect(resultado.hash_contenido).toBe(esperado);
    expect(resultado.bytes_processed).toBe(Buffer.byteLength(contenido, 'utf8'));
    expect(HashIntegrityService.validateHashFormat(resultado.hash_contenido)).toBe(true);
  });

  it('el digest coincide con el de HashIntegrityService sobre el mismo contenido', () => {
    const contenido = 'contenido compartido entre DC-06 y DC-07';
    const desdeServicio = new EdicionResolucionesService().calcularHashContenido(contenido).hash_contenido;
    const desdeHash = createHash('sha256').update(contenido, 'utf8').digest('hex');

    expect(desdeServicio).toBe(desdeHash);
  });

  it('el digest cambia si cambia un solo byte del contenido', () => {
    const servicio = new EdicionResolucionesService();
    const a = servicio.calcularHashContenido('articulo primero').hash_contenido;
    const b = servicio.calcularHashContenido('articulo primeros').hash_contenido;

    expect(a).not.toBe(b);
  });
});