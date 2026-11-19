import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { DigitalizacionService } from '../../../../src/domains/rutadoc/digitalizacion.service.js';
import type { AdjuntarDocumentoInput } from '../../../../src/domains/rutadoc/digitalizacion.schemas.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const mockAreaId = 'a1a3a496-ff7f-45d8-b63c-3e54fcf79de1';
const otraAreaId = '2b147b0d-7c8f-434f-b75a-598a1ccb855b';
const mockExpedienteId = 'cad71708-e867-42ce-86ac-a005915d257c';

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
  permisos: [{ codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'AREA', areaId: mockAreaId }],
  puedeVerExpediente: vi.fn(async () => true),
};

const actorCiudadano: ActorRutaDoc = {
  id: '00000000-0000-0000-0000-000000000050',
  roles: ['CIUDADANO'],
  permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null }],
  puedeVerExpediente: vi.fn(async () => true),
};

function setupMockPool() {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) {
      return { rows: [], rowCount: 0 };
    }
    // Consulta previa de resolución de área actual del expediente (autorización de ámbito AREA)
    if (sql.includes('FROM sigd_tra.expediente') && !sql.includes('FOR UPDATE')) {
      if (params && params[0] === '00000000-0000-0000-0000-000000000404') {
        return { rows: [], rowCount: 0 }; // No existe
      }
      if (params && params[0] === '00000000-0000-0000-0000-000000000500') {
        return { rows: [{ area_actual_id: null }], rowCount: 1 }; // Área indeterminable
      }
      return {
        rows: [
          {
            area_actual_id: mockAreaId,
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM sigd_tra.expediente') && sql.includes('FOR UPDATE')) {
      return {
        rows: [
          {
            expediente_id: mockExpedienteId,
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

  it('1. rechaza con 401 Unauthorized cuando el actor es nulo o indefinido', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);

    await expect(
      service.adjuntarDocumento(mockExpedienteId, mockInput, 'usr-1', null as unknown as ActorRutaDoc),
    ).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('2. rechaza a un actor con rol exclusivo CIUDADANO con 403 Forbidden', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);

    await expect(
      service.adjuntarDocumento(mockExpedienteId, mockInput, actorCiudadano.id, actorCiudadano),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('3. rechaza a un actor sin permisos configurados (array vacío) con 403 Forbidden', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const actorSinPermisos: ActorRutaDoc = {
      id: '00000000-0000-0000-0000-000000000088',
      roles: ['DOCENTE'],
      permisos: [],
      puedeVerExpediente: vi.fn(async () => true),
    };

    await expect(
      service.adjuntarDocumento(mockExpedienteId, mockInput, actorSinPermisos.id, actorSinPermisos),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('4. rechaza a un actor con solamente EXPEDIENTE_LEER con 403 Forbidden', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const actorSoloLectura: ActorRutaDoc = {
      id: '00000000-0000-0000-0000-000000000089',
      roles: ['DOCENTE'],
      permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null }],
      puedeVerExpediente: vi.fn(async () => true),
    };

    await expect(
      service.adjuntarDocumento(mockExpedienteId, mockInput, actorSoloLectura.id, actorSoloLectura),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('5. rechaza a un actor con solamente EXPEDIENTE_DERIVAR con 403 Forbidden', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const actorSoloDerivar: ActorRutaDoc = {
      id: '00000000-0000-0000-0000-000000000090',
      roles: ['MESA_PARTES'],
      permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: mockAreaId }],
      puedeVerExpediente: vi.fn(async () => true),
    };

    await expect(
      service.adjuntarDocumento(mockExpedienteId, mockInput, actorSoloDerivar.id, actorSoloDerivar),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('6. rechaza a un actor con solamente EXPEDIENTE_RESOLVER con 403 Forbidden', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const actorSoloResolver: ActorRutaDoc = {
      id: '00000000-0000-0000-0000-000000000091',
      roles: ['DIRECTOR'],
      permisos: [{ codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: mockAreaId }],
      puedeVerExpediente: vi.fn(async () => true),
    };

    await expect(
      service.adjuntarDocumento(mockExpedienteId, mockInput, actorSoloResolver.id, actorSoloResolver),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('7. rechaza con 403 Forbidden cuando el permiso AREA es de una unidad diferente a la del expediente', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const actorOtraArea: ActorRutaDoc = {
      id: '00000000-0000-0000-0000-000000000092',
      roles: ['COORDINADOR_AREA'],
      permisos: [{ codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'AREA', areaId: otraAreaId }],
      puedeVerExpediente: vi.fn(async () => true),
    };

    await expect(
      service.adjuntarDocumento(mockExpedienteId, mockInput, actorOtraArea.id, actorOtraArea),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('8. rechaza con 403 Forbidden cuando no se puede determinar el área actual del expediente', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);

    await expect(
      service.adjuntarDocumento('00000000-0000-0000-0000-000000000500', mockInput, actorStaff.id, actorStaff),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('9. rechaza con 404 Not Found cuando el expediente no existe al verificar ámbito AREA', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);

    await expect(
      service.adjuntarDocumento('00000000-0000-0000-0000-000000000404', mockInput, actorStaff.id, actorStaff),
    ).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('10. rechaza si el actor no tiene autorización para acceder al expediente (puedeVerExpediente = false)', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const actorSinAcceso: ActorRutaDoc = {
      ...actorStaff,
      puedeVerExpediente: vi.fn(async () => false),
    };

    await expect(
      service.adjuntarDocumento(mockExpedienteId, mockInput, actorSinAcceso.id, actorSinAcceso),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('11. permite autorizar con permiso GLOBAL válido independientemente del área del expediente', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const actorGlobal: ActorRutaDoc = {
      id: '00000000-0000-0000-0000-000000000093',
      roles: ['ADMINISTRADOR'],
      permisos: [{ codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'GLOBAL', areaId: null }],
      puedeVerExpediente: vi.fn(async () => true),
    };

    const mockBytes = Buffer.from('%PDF-1.4 prueba global');
    const mockSha256 = createHash('sha256').update(mockBytes).digest('hex');
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
      mockExpedienteId,
      { ...mockInput, tamanoBytes: mockBytes.length, sha256Hash: mockSha256 },
      actorGlobal.id,
      actorGlobal,
    );

    expect(resultado).toBeDefined();
    expect(resultado.expedienteId).toBe(mockExpedienteId);
  });

  it('12. permite autorizar a GESTOR_APOYO_AREA con permiso AREA coincidente sin rol estatutario', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const actorGestorApoyo: ActorRutaDoc = {
      id: '00000000-0000-0000-0000-000000000094',
      roles: [],
      permisos: [
        { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: mockAreaId },
        { codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'AREA', areaId: mockAreaId },
        { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: mockAreaId },
        { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: mockAreaId },
      ],
      puedeVerExpediente: vi.fn(async () => true),
    };

    const mockBytes = Buffer.from('%PDF-1.4 prueba gestor');
    const mockSha256 = createHash('sha256').update(mockBytes).digest('hex');
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
      mockExpedienteId,
      { ...mockInput, tamanoBytes: mockBytes.length, sha256Hash: mockSha256 },
      actorGestorApoyo.id,
      actorGestorApoyo,
    );

    expect(resultado).toBeDefined();
    expect(resultado.folios.cantidad).toBe(mockInput.folios);
  });

  it('13. garantiza que los rechazos de autorización impiden invocar MinIO y no realizan escrituras en BD', async () => {
    const { pool, query } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const actorRechazado: ActorRutaDoc = {
      id: '00000000-0000-0000-0000-000000000095',
      roles: ['DOCENTE'],
      permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null }],
      puedeVerExpediente: vi.fn(async () => true),
    };

    await expect(
      service.adjuntarDocumento(mockExpedienteId, mockInput, actorRechazado.id, actorRechazado),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });

    // MinIO nunca debe ser invocado
    expect(fetchSpy).not.toHaveBeenCalled();

    // No debe haber transacciones de escritura abiertas
    const sqlCalls = query.mock.calls.map(([sql]) => String(sql));
    expect(sqlCalls.includes('BEGIN')).toBe(false);
    expect(sqlCalls.some((sql) => sql.includes('INSERT INTO sigd_doc.documento_adjunto'))).toBe(false);
    expect(sqlCalls.some((sql) => sql.includes('INSERT INTO sigd_tra.expediente_documento_folio'))).toBe(false);
  });

  it('14. rechaza claves de storage que no respetan el formato institucional', async () => {
    const { pool } = setupMockPool();
    const service = new DigitalizacionService(pool);
    const inputInvalido = { ...mockInput, storagePath: 'otro-path/malicioso.exe' };

    await expect(
      service.adjuntarDocumento(mockExpedienteId, inputInvalido, actorStaff.id, actorStaff),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('15. adjunta y folia exitosamente el documento cuando el archivo en MinIO es válido', async () => {
    const { pool, query } = setupMockPool();
    const service = new DigitalizacionService(pool);

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
      mockExpedienteId,
      inputValido,
      actorStaff.id,
      actorStaff,
    );

    expect(resultado).toMatchObject({
      expedienteId: mockExpedienteId,
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

  it('16. previene la adjunción de un documento con hash SHA-256 ya existente en el expediente (409 Conflict)', async () => {
    const { pool, query } = setupMockPool();
    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM sigd_tra.expediente') && !sql.includes('FOR UPDATE')) {
        return { rows: [{ area_actual_id: mockAreaId }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_tra.expediente') && sql.includes('FOR UPDATE')) {
        return {
          rows: [{
            expediente_id: mockExpedienteId,
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
        mockExpedienteId,
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
