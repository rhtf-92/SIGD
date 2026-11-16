import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { DigitalizacionService } from '../../../../src/domains/rutadoc/digitalizacion.service.js';
import type { AdjuntarDocumentoInput } from '../../../../src/domains/rutadoc/digitalizacion.schemas.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const mockInput: AdjuntarDocumentoInput = {
  nombreArchivo: 'solicitud_estudios.pdf',
  tamanoBytes: 15,
  mimeType: 'application/pdf',
  sha256Hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', // SHA-256 of "abc"
  storagePath: 'expedientes/2026/11111111-2222-3333-4444-555555555555.pdf',
  folios: 2,
};

const actorStaff: ActorRutaDoc = {
  id: '00000000-0000-0000-0000-000000000040',
  roles: ['MESA_PARTES'],
  permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'GLOBAL', areaId: null }],
  puedeVerExpediente: vi.fn(async () => true),
};

const actorCiudadano: ActorRutaDoc = {
  id: '00000000-0000-0000-0000-000000000050',
  roles: ['CIUDADANO'],
  puedeVerExpediente: vi.fn(async () => true),
};

function setupMockPool() {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM sigd_tra.expediente') && sql.includes('FOR UPDATE')) {
      return {
        rows: [
          {
            expediente_id: 'cad71708-e867-42ce-86ac-a005915d257c',
            codigo_expediente: 'EXP-2026-000019',
            tipo_documental_id: 'dc156983-a824-418a-835e-5a7e104c9ca5',
            solicitante_id: '00000000-0000-0000-0000-000000000050',
            estado: 'REGISTRADO',
            fecha_radicacion: new Date('2026-10-29T18:18:22Z'),
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT EXISTS') && sql.includes('sigd_doc.documento_adjunto')) {
      return { rows: [{ existe: false }], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_doc.expediente WHERE expediente_id')) {
      return { rows: [], rowCount: 0 }; // Not yet in sigd_doc, will be inserted
    }
    if (sql.includes('FROM sigd_tra.asiento_registro')) {
      return { rows: [{ asunto: 'Asunto de prueba' }], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
      return { rows: [{ tipo_tramite_id: '00000000-0000-0000-0000-000000000001' }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_doc.expediente')) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_doc.tipo_documento')) {
      return { rows: [{ tipo_documental_id: 'dc156983-a824-418a-835e-5a7e104c9ca5' }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('MAX(folio_fin)')) {
      return { rows: [{ max_fin: 0 }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO sigd_tra.expediente_documento_folio')) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Consulta SQL no simulada: ${sql}`);
  });

  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  const pool = { query, connect } as unknown as Pool;

  return { pool, client, query, release, connect };
}

describe('DigitalizacionService (Carga documental posterior a recepción)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rechaza a un actor con rol exclusivo CIUDADANO con 403 Forbidden', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);

    await expect(
      service.adjuntarDocumento('cad71708-e867-42ce-86ac-a005915d257c', mockInput, actorCiudadano.id, actorCiudadano),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('rechaza si el actor no tiene autorización para acceder al expediente', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const actorSinAcceso: ActorRutaDoc = {
      ...actorStaff,
      puedeVerExpediente: vi.fn(async () => false),
    };

    await expect(
      service.adjuntarDocumento('cad71708-e867-42ce-86ac-a005915d257c', mockInput, actorSinAcceso.id, actorSinAcceso),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('rechaza claves de storage que no respetan el formato institucional', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const inputInvalido = { ...mockInput, storagePath: 'otro-path/malicioso.exe' };

    await expect(
      service.adjuntarDocumento('cad71708-e867-42ce-86ac-a005915d257c', inputInvalido, actorStaff.id, actorStaff),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('adjunta y folia exitosamente el documento cuando el archivo en MinIO es válido', async () => {
    const { pool, query, client } = setupMockPool();
    const service = new DigitalizacionService(pool);

    // Mock global fetch para simular descarga desde MinIO
    const mockBytes = Buffer.from('%PDF-1.4 prueba');
    const mockSha256 = '5ebec4c47b5e04b49c995e8c4b523dfa7c413381c119c101c377d57b92040493';
    const inputValido: AdjuntarDocumentoInput = {
      ...mockInput,
      tamanoBytes: mockBytes.length,
      sha256Hash: mockSha256,
    };

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(mockBytes);
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      body: stream,
    });

    const resultado = await service.adjuntarDocumento(
      'cad71708-e867-42ce-86ac-a005915d257c',
      inputValido,
      actorStaff.id,
      actorStaff,
    );

    expect(resultado).toMatchObject({
      expedienteId: 'cad71708-e867-42ce-86ac-a005915d257c',
      nombreArchivo: 'solicitud_estudios.pdf',
      folios: {
        folioInicio: 1,
        folioFin: 2,
        cantidad: 2,
      },
      sha256: mockSha256,
      s3Key: inputValido.storagePath,
    });

    // Verificación de llamadas SQL
    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith('COMMIT');
    const calls = query.mock.calls.map(([sql]) => String(sql));
    expect(calls.some((sql) => sql.includes('FOR UPDATE'))).toBe(true);
    expect(calls.some((sql) => sql.includes('sigd_doc.documento_adjunto'))).toBe(true);
    expect(calls.some((sql) => sql.includes('sigd_tra.expediente_documento_folio'))).toBe(true);
  });

  it('previene la adjunción de un documento con hash SHA-256 ya existente en el expediente (409 Conflict)', async () => {
    const { pool, query } = setupMockPool();
    // Simular que el hash ya existe
    query.mockImplementation(async (sql: string) => {
      if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM sigd_tra.expediente') && sql.includes('FOR UPDATE')) {
        return {
          rows: [{
            expediente_id: 'cad71708-e867-42ce-86ac-a005915d257c',
            codigo_expediente: 'EXP-2026-000019',
            tipo_documental_id: 'dc156983-a824-418a-835e-5a7e104c9ca5',
            solicitante_id: '00000000-0000-0000-0000-000000000050',
            estado: 'REGISTRADO',
            fecha_radicacion: new Date(),
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('SELECT EXISTS') && sql.includes('sigd_doc.documento_adjunto')) {
        return { rows: [{ existe: true }], rowCount: 1 };
      }
      throw new Error(`Consulta no prevista: ${sql}`);
    });

    const service = new DigitalizacionService(pool);

    const mockBytes = Buffer.from('%PDF-1.4 prueba');
    const mockSha256 = '5ebec4c47b5e04b49c995e8c4b523dfa7c413381c119c101c377d57b92040493';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(mockBytes);
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      body: stream,
    });

    await expect(
      service.adjuntarDocumento(
        'cad71708-e867-42ce-86ac-a005915d257c',
        { ...mockInput, tamanoBytes: mockBytes.length, sha256Hash: mockSha256 },
        actorStaff.id,
        actorStaff,
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'DOCUMENTO_YA_ADJUNTO',
    });

    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
});
