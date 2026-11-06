import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  TiposDocumentoService,
  tipoDocumentoInputSchema,
  tipoDocumentoActualizarSchema,
  tipoDocumentoEstadoSchema,
} from '../../../../src/domains/organicore/tiposDocumento.service.js';
import { ConflictError, NotFoundError } from '../../../../src/shared/domain/errors/index.js';

describe('TiposDocumentoService & Zod Schemas (Milestone 1 — F1)', () => {
  let mockClient: Partial<PoolClient>;
  let mockPool: Partial<Pool>;
  let service: TiposDocumentoService;

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: vi.fn(),
    };

    mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: vi.fn().mockResolvedValue(mockClient as PoolClient),
    };

    service = new TiposDocumentoService(mockPool as Pool);
  });

  describe('Zod Schemas Validation', () => {
    it('valida un payload de tipo documental válido aplicando valores por defecto', () => {
      const parsed = tipoDocumentoInputSchema.parse({
        codigo: 'SOLICITUD',
        nombre: 'Solicitud Formal Única',
      });

      expect(parsed.codigo).toBe('SOLICITUD');
      expect(parsed.nombre).toBe('Solicitud Formal Única');
      expect(parsed.extension).toBe('pdf');
      expect(parsed.mimeType).toBe('application/pdf');
      expect(parsed.tamanoMaximoMb).toBe(25);
      expect(parsed.exigeFirma).toBe(false);
      expect(parsed.vigente).toBe(true);
    });

    it('rechaza código con caracteres no permitidos', () => {
      expect(() =>
        tipoDocumentoInputSchema.parse({
          codigo: 'CODIGO CON ESPACIOS!',
          nombre: 'Solicitud',
        }),
      ).toThrow();
    });

    it('rechaza tamaño máximo mayor a 100 MB', () => {
      expect(() =>
        tipoDocumentoInputSchema.parse({
          codigo: 'OFICIO',
          nombre: 'Oficio Institucional',
          tamanoMaximoMb: 200,
        }),
      ).toThrow();
    });

    it('permite actualización parcial con tipoDocumentoActualizarSchema', () => {
      const parsed = tipoDocumentoActualizarSchema.parse({
        nombre: 'Nuevo Nombre de Tipo',
        exigeFirma: true,
      });

      expect(parsed.nombre).toBe('Nuevo Nombre de Tipo');
      expect(parsed.exigeFirma).toBe(true);
      expect(parsed.codigo).toBeUndefined();
    });

    it('permite alternar vigencia con tipoDocumentoEstadoSchema', () => {
      const parsed = tipoDocumentoEstadoSchema.parse({ vigente: false });
      expect(parsed.vigente).toBe(false);
    });
  });

  describe('TiposDocumentoService CRUD Operations', () => {
    it('listar: devuelve los tipos documentales mapeados con dual-casing', async () => {
      const fakeRows = [
        {
          tipo_documental_id: '00000000-0000-0000-0000-000000000001',
          codigo: 'SOLICITUD',
          nombre: 'Solicitud',
          extension: 'pdf',
          mime_type: 'application/pdf',
          tamano_maximo_mb: 25,
          exige_firma: true,
          vigente: true,
        },
      ];

      (mockPool.query as any).mockResolvedValueOnce({ rows: fakeRows, rowCount: 1 });

      const resultado = await service.listar(true);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('sigd_doc.tipo_documento'), [true]);
      expect(resultado).toHaveLength(1);
      expect(resultado[0].tipo_documental_id).toBe('00000000-0000-0000-0000-000000000001');
      expect(resultado[0].tipoDocumentalId).toBe('00000000-0000-0000-0000-000000000001');
      expect(resultado[0].id).toBe('00000000-0000-0000-0000-000000000001');
      expect(resultado[0].tamanoMaximoMb).toBe(25);
      expect(resultado[0].tamano_maximo_mb).toBe(25);
      expect(resultado[0].exigeFirma).toBe(true);
      expect(resultado[0].exige_firma).toBe(true);
    });

    it('obtenerPorId: lanza NotFoundError cuando no existe', async () => {
      (mockPool.query as any).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(service.obtenerPorId('00000000-0000-0000-0000-000000000999')).rejects.toThrow(NotFoundError);
    });

    it('crear: valida duplicidad de código y rechaza con ConflictError', async () => {
      (mockPool.query as any).mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await expect(
        service.crear({
          codigo: 'SOLICITUD',
          nombre: 'Solicitud Repetida',
          extension: 'pdf',
          mimeType: 'application/pdf',
          tamanoMaximoMb: 25,
          exigeFirma: false,
          vigente: true,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('crear: persiste en sigd_doc.tipo_documento y registra en sigd_audit.bitacora_auditoria', async () => {
      // 1. SELECT unicidad -> vacío
      (mockPool.query as any).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // 2. INSERT tipo_documento -> retorno
      (mockClient.query as any).mockResolvedValueOnce({ rows: [] }); // BEGIN
      (mockClient.query as any).mockResolvedValueOnce({
        rows: [
          {
            tipo_documental_id: '11111111-2222-3333-4444-555555555555',
            codigo: 'MEMO',
            nombre: 'Memorando Múltiple',
            extension: 'pdf',
            mime_type: 'application/pdf',
            tamano_maximo_mb: 25,
            exige_firma: false,
            vigente: true,
          },
        ],
        rowCount: 1,
      }); // INSERT tipo_documento
      (mockClient.query as any).mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT bitacora_auditoria
      (mockClient.query as any).mockResolvedValueOnce({ rows: [] }); // COMMIT

      const nuevo = await service.crear({
        codigo: 'memo',
        nombre: 'Memorando Múltiple',
        extension: 'PDF',
        mimeType: 'application/pdf',
        tamanoMaximoMb: 25,
        exigeFirma: false,
        vigente: true,
      });

      expect(nuevo.tipoDocumentalId).toBe('11111111-2222-3333-4444-555555555555');
      expect(nuevo.codigo).toBe('MEMO');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sigd_doc.tipo_documento'),
        expect.arrayContaining(['MEMO', 'Memorando Múltiple']),
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sigd_audit.bitacora_auditoria'),
        expect.any(Array),
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('actualizar: modifica atributos y registra en bitácora de auditoría', async () => {
      // 1. obtenerPorId previo
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            tipo_documental_id: '11111111-2222-3333-4444-555555555555',
            codigo: 'MEMO',
            nombre: 'Memorando Múltiple',
            extension: 'pdf',
            mime_type: 'application/pdf',
            tamano_maximo_mb: 25,
            exige_firma: false,
            vigente: true,
          },
        ],
        rowCount: 1,
      });

      (mockClient.query as any).mockResolvedValueOnce({ rows: [] }); // BEGIN
      (mockClient.query as any).mockResolvedValueOnce({
        rows: [
          {
            tipo_documental_id: '11111111-2222-3333-4444-555555555555',
            codigo: 'MEMO',
            nombre: 'Memorando Actualizado',
            extension: 'pdf',
            mime_type: 'application/pdf',
            tamano_maximo_mb: 30,
            exige_firma: true,
            vigente: true,
          },
        ],
        rowCount: 1,
      }); // UPDATE
      (mockClient.query as any).mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT bitacora
      (mockClient.query as any).mockResolvedValueOnce({ rows: [] }); // COMMIT

      const actualizado = await service.actualizar('11111111-2222-3333-4444-555555555555', {
        nombre: 'Memorando Actualizado',
        tamanoMaximoMb: 30,
        exigeFirma: true,
      });

      expect(actualizado.nombre).toBe('Memorando Actualizado');
      expect(actualizado.tamanoMaximoMb).toBe(30);
      expect(actualizado.exigeFirma).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sigd_doc.tipo_documento'),
        expect.any(Array),
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('eliminar: ejecuta baja lógica si el tipo documental tiene referencias', async () => {
      // 1. obtenerPorId
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            tipo_documental_id: '11111111-2222-3333-4444-555555555555',
            codigo: 'MEMO',
            nombre: 'Memorando',
            extension: 'pdf',
            mime_type: 'application/pdf',
            tamano_maximo_mb: 25,
            exige_firma: false,
            vigente: true,
          },
        ],
        rowCount: 1,
      });
      // 2. Comprobar referencias en sigd_doc.documento_adjunto -> existe 1
      (mockPool.query as any).mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });

      // Internamente llamará a actualizar(id, { vigente: false })
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            tipo_documental_id: '11111111-2222-3333-4444-555555555555',
            codigo: 'MEMO',
            nombre: 'Memorando',
            extension: 'pdf',
            mime_type: 'application/pdf',
            tamano_maximo_mb: 25,
            exige_firma: false,
            vigente: true,
          },
        ],
        rowCount: 1,
      });
      (mockClient.query as any).mockResolvedValueOnce({ rows: [] }); // BEGIN
      (mockClient.query as any).mockResolvedValueOnce({
        rows: [
          {
            tipo_documental_id: '11111111-2222-3333-4444-555555555555',
            codigo: 'MEMO',
            nombre: 'Memorando',
            extension: 'pdf',
            mime_type: 'application/pdf',
            tamano_maximo_mb: 25,
            exige_firma: false,
            vigente: false,
          },
        ],
        rowCount: 1,
      }); // UPDATE vigente = false
      (mockClient.query as any).mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT bitacora
      (mockClient.query as any).mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await service.eliminar('11111111-2222-3333-4444-555555555555');

      expect(res.eliminado).toBe(true);
      expect(res.mensaje).toContain('baja lógica');
    });

    it('eliminar: ejecuta DELETE físico si no tiene referencias', async () => {
      // 1. obtenerPorId
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            tipo_documental_id: '11111111-2222-3333-4444-555555555555',
            codigo: 'MEMO',
            nombre: 'Memorando',
            extension: 'pdf',
            mime_type: 'application/pdf',
            tamano_maximo_mb: 25,
            exige_firma: false,
            vigente: true,
          },
        ],
        rowCount: 1,
      });
      // 2. Comprobar referencias -> 0
      (mockPool.query as any).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      (mockClient.query as any).mockResolvedValueOnce({ rows: [] }); // BEGIN
      (mockClient.query as any).mockResolvedValueOnce({ rows: [], rowCount: 1 }); // DELETE
      (mockClient.query as any).mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT bitacora
      (mockClient.query as any).mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await service.eliminar('11111111-2222-3333-4444-555555555555');

      expect(res.eliminado).toBe(true);
      expect(res.mensaje).toContain('eliminado exitosamente');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM sigd_doc.tipo_documento'),
        ['11111111-2222-3333-4444-555555555555'],
      );
    });
  });
});
