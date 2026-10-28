import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { TupaVersionRepository } from '../../../../src/domains/tramicore/tupaVersion.repository.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../../src/shared/domain/errors/index.js';

describe('TupaVersionRepository — Versionamiento Anual y Data-Driven', () => {
  const ID_V2026 = '11111111-2026-4111-8111-111111111111';
  const ID_V2027 = '22222222-2027-4222-8222-222222222222';
  const ID_PROC_1 = '33333333-3333-4333-8333-333333333333';

  it('listarVersiones devuelve el histórico y la versión vigente', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id_version: ID_V2026,
            codigo: 'TUPA-2026',
            denominacion: 'Texto Único de Procedimientos Administrativos 2026',
            anio: 2026,
            estado: 'VIGENTE',
            total_procedimientos: 72,
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const repo = new TupaVersionRepository(mockPool);
    const versiones = await repo.listarVersiones();

    expect(versiones).toHaveLength(1);
    expect(versiones[0].codigo).toBe('TUPA-2026');
    expect(versiones[0].estado).toBe('VIGENTE');
    expect(versiones[0].total_procedimientos).toBe(72);
  });

  it('obtenerVersionVigente retorna la versión en estado VIGENTE', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id_version: ID_V2026,
            codigo: 'TUPA-2026',
            denominacion: 'TUPA 2026',
            anio: 2026,
            estado: 'VIGENTE',
            total_procedimientos: 72,
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const repo = new TupaVersionRepository(mockPool);
    const vigente = await repo.obtenerVersionVigente();

    expect(vigente).not.toBeNull();
    expect(vigente?.codigo).toBe('TUPA-2026');
    expect(vigente?.total_procedimientos).toBe(72);
  });

  it('crearVersionBorrador rechaza años menores a 2026 con ValidationError', async () => {
    const mockPool = { query: vi.fn() } as unknown as Pool;
    const repo = new TupaVersionRepository(mockPool);

    await expect(
      repo.crearVersionBorrador({
        anio: 2020,
        denominacion: 'TUPA Antiguo Inválido',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('crearVersionBorrador rechaza duplicar un año ya registrado con ConflictError', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id_version: ID_V2026 }],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const repo = new TupaVersionRepository(mockPool);

    await expect(
      repo.crearVersionBorrador({
        anio: 2026,
        denominacion: 'TUPA 2026 Duplicado',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('crearVersionBorrador clona procedimientos de la versión base en una transacción', async () => {
    const queryClientMock = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO sigd_doc.tupa_version')) {
        return {
          rows: [
            {
              id_version: ID_V2027,
              codigo: 'TUPA-2027',
              denominacion: 'TUPA 2027 Borrador',
              anio: 2027,
              estado: 'BORRADOR',
              total_procedimientos: 0,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('SELECT codigo_ref')) {
        return {
          rows: [
            {
              codigo_ref: 'p1-fila-05',
              codigo_externo: 'TUPA-01',
              denominacion: 'Constancia de Matrícula',
              categoria: 'PROCEDIMIENTO_APROBADO',
              tipo_formulario: 'DOCUMENTARIO',
              monto: '15.00',
              unidad_cobro: 'PEN',
              plazo_dias: 5,
              requisitos: ['Solicitud FUT', 'Voucher de pago'],
              genera_expediente: true,
              calificacion: 'EVALUACION_PREVIA_POSITIVA',
              registro_version_id: 'aaaa-bbbb',
              activo: true,
              orden: 1,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const mockPool = {
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      connect: vi.fn().mockResolvedValue({
        query: queryClientMock,
        release: vi.fn(),
      }),
    } as unknown as Pool;

    const repo = new TupaVersionRepository(mockPool);
    const nueva = await repo.crearVersionBorrador({
      anio: 2027,
      denominacion: 'TUPA 2027 Borrador',
      clonarDeIdVersion: ID_V2026,
    });

    expect(nueva.codigo).toBe('TUPA-2027');
    expect(nueva.estado).toBe('BORRADOR');
    expect(nueva.total_procedimientos).toBe(1);
    expect(queryClientMock).toHaveBeenCalledWith('BEGIN');
    expect(queryClientMock).toHaveBeenCalledWith('COMMIT');
  });

  it('actualizarProcedimiento impide modificar filas de versión histórica', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id_procedimiento: ID_PROC_1,
            id_version: ID_V2026,
            estado_version: 'HISTORICO',
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const repo = new TupaVersionRepository(mockPool);

    await expect(
      repo.actualizarProcedimiento(ID_PROC_1, {
        monto: 50.0,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('actualizarProcedimiento actualiza precio y plazo en versión borrador', async () => {
    const mockPool = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT p.*, v.estado as estado_version')) {
          return {
            rows: [
              {
                id_procedimiento: ID_PROC_1,
                id_version: ID_V2027,
                estado_version: 'BORRADOR',
                monto: '15.00',
                plazo_dias: 5,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('UPDATE sigd_doc.tupa_procedimiento')) {
          return {
            rows: [
              {
                id_procedimiento: ID_PROC_1,
                id_version: ID_V2027,
                monto: 25.0,
                plazo_dias: 3,
                actualizado_en: new Date().toISOString(),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const repo = new TupaVersionRepository(mockPool);
    const actualizado = await repo.actualizarProcedimiento(ID_PROC_1, {
      monto: 25.0,
      plazoDias: 3,
    });

    expect(actualizado.monto).toBe(25.0);
    expect(actualizado.plazo_dias).toBe(3);
  });

  it('publicarVersion archiva versión vigente previa y activa la nueva versión', async () => {
    const queryClientMock = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('UPDATE sigd_doc.tupa_version') && sql.includes("estado = 'HISTORICO'")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('UPDATE sigd_doc.tupa_version') && sql.includes("estado = 'VIGENTE'")) {
        return {
          rows: [
            {
              id_version: ID_V2027,
              codigo: 'TUPA-2027',
              estado: 'VIGENTE',
              anio: 2027,
              fecha_aprobacion: '2027-01-01',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const mockPool = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('tupa_version') && sql.includes('id_version')) {
          return {
            rows: [
              {
                id_version: ID_V2027,
                codigo: 'TUPA-2027',
                estado: 'BORRADOR',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn().mockResolvedValue({
        query: queryClientMock,
        release: vi.fn(),
      }),
    } as unknown as Pool;

    const repo = new TupaVersionRepository(mockPool);
    const publicada = await repo.publicarVersion(ID_V2027);

    expect(publicada.estado).toBe('VIGENTE');
    expect(publicada.codigo).toBe('TUPA-2027');
    expect(queryClientMock).toHaveBeenCalledWith('BEGIN');
    expect(queryClientMock).toHaveBeenCalledWith('COMMIT');
  });

  it('asociarDocumentoOficial asocia archivo físico a la versión e inserta registro de auditoría', async () => {
    const queryClientMock = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('UPDATE sigd_doc.tupa_version') && sql.includes('documento_oficial_key')) {
        return {
          rows: [
            {
              id_version: ID_V2026,
              codigo: 'TUPA-2026',
              documento_oficial_key: 'tupa/2026/TUPA_2026_OFICIAL.pdf',
              documento_oficial_nombre: 'TUPA_2026_OFICIAL.pdf',
              documento_oficial_sha256: '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
              documento_oficial_tamano: 1375801,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO sigd_doc.tupa_documento_oficial_historial')) {
        return {
          rows: [
            {
              id_historial: 'hist-1',
              id_version: ID_V2026,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id_version: ID_V2026,
            codigo: 'TUPA-2026',
            documento_oficial_key: 'tupa/2026/TUPA_2026_OFICIAL.pdf',
            documento_oficial_nombre: 'TUPA_2026_OFICIAL.pdf',
            documento_oficial_sha256: '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
            documento_oficial_tamano: 1375801,
          },
        ],
        rowCount: 1,
      }),
      connect: vi.fn().mockResolvedValue({
        query: queryClientMock,
        release: vi.fn(),
      }),
    } as unknown as Pool;

    const repo = new TupaVersionRepository(mockPool);
    const resultado = await repo.asociarDocumentoOficial(ID_V2026, {
      uploadId: '33333333-3333-4333-8333-333333333333',
      storageKey: 'tupa/2026/TUPA_2026_OFICIAL.pdf',
      nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
      sha256: '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
      mimeType: 'application/pdf',
      tamanoBytes: 1375801,
      cargadoPor: '00000000-0000-0000-0000-000000000001',
      motivoCambio: 'Carga inicial de respaldo digital',
    });

    expect(resultado.documento_oficial_key).toBe('tupa/2026/TUPA_2026_OFICIAL.pdf');
    expect(resultado.documento_oficial_sha256).toBe('4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f');
    expect(queryClientMock).toHaveBeenCalledWith('BEGIN');
    expect(queryClientMock).toHaveBeenCalledWith('COMMIT');
  });

  it('obtenerHistorialDocumentoOficial retorna listado de auditoría de documentos', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id_historial: 'hist-1',
            id_version: ID_V2026,
            storage_key: 'tupa/2026/TUPA_2026_OFICIAL.pdf',
            nombre_archivo: 'TUPA_2026_OFICIAL.pdf',
            sha256: '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
            mime_type: 'application/pdf',
            tamano_bytes: 1375801,
            motivo_cambio: 'Carga inicial de copia oficial escaneada',
            cargado_por: '00000000-0000-0000-0000-000000000001',
            cargado_por_usuario: 'administrador_demo',
            cargado_por_nombre: 'Administrador Demo',
            fecha_registro: new Date().toISOString(),
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const repo = new TupaVersionRepository(mockPool);
    const historial = await repo.obtenerHistorialDocumentoOficial(ID_V2026);

    expect(historial).toHaveLength(1);
    expect(historial[0].nombre_archivo).toBe('TUPA_2026_OFICIAL.pdf');
    expect(historial[0].sha256).toBe('4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f');
    expect(historial[0].cargado_por_usuario).toBe('administrador_demo');
  });
});
