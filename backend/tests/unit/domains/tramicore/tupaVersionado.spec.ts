import { describe, expect, it, vi } from 'vitest';
import { TupaVersionadoService } from '../../../../src/domains/tramicore/tupaVersionado.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../../src/shared/domain/errors/index.js';

describe('TupaVersionadoService — Pruebas unitarias aisladas (B_CHRISTIAN)', () => {
  const versionAprobadaUuid = '11111111-1111-4111-8111-111111111111';
  const expedienteUuid = '22222222-2222-4222-8222-222222222222';

  it('listarAprobados devuelve catálogo versionado con campos físicamente respaldados', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            registro_version_id: versionAprobadaUuid,
            codigo_externo: 'TUPA-001',
            denominacion_original: 'Certificado de estudios',
            requisitos_original: ['DNI copia', 'Recibo de pago'],
            monto_original: '25.00',
            fuente_nombre: 'tupa-2026.pdf',
            documento_sha256: 'a'.repeat(64),
            pagina: 12,
            referencia_fila: 'F-12',
            version_fuente: 'v1.0',
            revision: 1,
            vigencia_desde: new Date('2026-01-01'),
            vigencia_hasta: new Date('2026-12-31'),
            estado_validacion: 'APROBADO',
            referencia_aprobacion: 'RD 01-2026',
          },
        ],
      }),
    };

    const service = new TupaVersionadoService(mockPool as any);
    const resultado = await service.listarAprobados();

    expect(resultado).toHaveLength(1);
    const item = resultado[0];
    expect(item.registroVersionId).toBe(versionAprobadaUuid);
    expect(item.codigoExterno).toBe('TUPA-001');
    expect(item.codigo).toBe('TUPA-001');
    expect(item.denominacion).toBe('Certificado de estudios');
    expect(item.monto).toBe('25.00');
    expect(item.requisitos).toEqual(['DNI copia', 'Recibo de pago']);
    expect(item.pagina).toBe(12);
    expect(item.revision).toBe(1);
    expect(item.estadoValidacion).toBe('APROBADO');
    expect(item.estado).toBe('APROBADO');
    expect(item.fuente.nombre).toBe('tupa-2026.pdf');
    expect(item.fuente.pagina).toBe(12);
    expect(item.fuente.documentoSha256).toBe('a'.repeat(64));
    expect(item.id).toBe(versionAprobadaUuid);
    expect(item).not.toHaveProperty('id_tipo_tramite');
  });

  it('validarYObtenerVersion rechaza UUID con formato inválido con ValidationError (400)', async () => {
    const mockClient = { query: vi.fn() };
    const service = new TupaVersionadoService({} as any);

    await expect(service.validarYObtenerVersion(mockClient as any, 'uuid-invalido'))
      .rejects.toThrow(ValidationError);
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('validarYObtenerVersion arroja NotFoundError (404) si el registro no existe', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new TupaVersionadoService({} as any);

    await expect(service.validarYObtenerVersion(mockClient as any, versionAprobadaUuid))
      .rejects.toThrow(NotFoundError);
  });

  it('validarYObtenerVersion arroja ConflictError (409) si el estado no es APROBADO', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            registro_version_id: versionAprobadaUuid,
            estado_validacion: 'PENDIENTE_VALIDACION',
          },
        ],
      }),
    };
    const service = new TupaVersionadoService({} as any);

    await expect(service.validarYObtenerVersion(mockClient as any, versionAprobadaUuid))
      .rejects.toThrow(ConflictError);
  });

  it('validarYObtenerVersion arroja ConflictError (409) si el registro está fuera de vigencia', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            registro_version_id: versionAprobadaUuid,
            estado_validacion: 'APROBADO',
            vigencia_desde: new Date('2025-01-01'),
            vigencia_hasta: new Date('2025-12-31'), // Ya venció respecto de 2026
          },
        ],
      }),
    };
    const service = new TupaVersionadoService({} as any);
    const fechaRef2026 = new Date('2026-10-18T10:00:00Z');

    await expect(service.validarYObtenerVersion(mockClient as any, versionAprobadaUuid, fechaRef2026))
      .rejects.toThrow(ConflictError);
  });

  it('obtenerContextoExpediente devuelve tupa: null si el expediente no tiene vínculo', async () => {
    const mockPool = {
      query: vi.fn()
        // 1. SELECT EXISTS(...)
        .mockResolvedValueOnce({ rows: [{ existe: true }] })
        // 2. SELECT vínculo
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new TupaVersionadoService(mockPool as any);
    const resultado = await service.obtenerContextoExpediente(expedienteUuid);

    expect(resultado).toEqual({ tupa: null });
  });

  it('obtenerContextoExpediente arroja NotFoundError si el expediente no existe', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{ existe: false }] }),
    };
    const service = new TupaVersionadoService(mockPool as any);

    await expect(service.obtenerContextoExpediente(expedienteUuid))
      .rejects.toThrow(NotFoundError);
  });

  it('obtenerContextoExpediente devuelve el contexto TUPA poblado si existe vínculo', async () => {
    const mockPool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ existe: true }] })
        .mockResolvedValueOnce({
          rows: [
            {
              registro_version_id: versionAprobadaUuid,
              codigo_externo: 'TUPA-001',
              denominacion_original: 'Certificado de estudios',
              requisitos_original: ['DNI'],
              monto_original: '25.00',
              fuente_nombre: 'tupa-2026.pdf',
              pagina: 12,
              revision: 1,
              version_fuente: 'v1.0',
              estado_validacion: 'APROBADO',
              vinculado_en: new Date('2026-10-18T12:00:00Z'),
            },
          ],
        }),
    };
    const service = new TupaVersionadoService(mockPool as any);
    const resultado = await service.obtenerContextoExpediente(expedienteUuid);

    expect(resultado.tupa).toBeDefined();
    expect(resultado.tupa?.registroVersionId).toBe(versionAprobadaUuid);
    expect(resultado.tupa?.codigo).toBe('TUPA-001');
    expect(resultado.tupa?.denominacion).toBe('Certificado de estudios');
    expect(resultado.tupa?.monto).toBe('25.00');
    expect(resultado.tupa?.vinculadoEn).toBe('2026-10-18T12:00:00.000Z');
  });
});
