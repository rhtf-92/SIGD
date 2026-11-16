import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ejecutarMigraciones,
  normalizarContenidoSql,
  calcularChecksumSha256,
  BASE_DATOS_OFICIAL_B_JACOBO,
  SIGD_MIGRATION_ADVISORY_LOCK_ID,
} from '../../../src/db/migrate.js';

describe('Suite de Integridad, Concurrencia y Saneamiento del Migrador DDL (Exclusividad B_JACOBO)', () => {
  const prevDir = process.env.MIGRATIONS_DIR;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigd-migracion-test-'));
    process.env.MIGRATIONS_DIR = tmpDir;
  });

  afterEach(() => {
    if (prevDir === undefined) {
      delete process.env.MIGRATIONS_DIR;
    } else {
      process.env.MIGRATIONS_DIR = prevDir;
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function crearMockPool(opcionesMock: {
    dbName?: string;
    registrosDb?: Map<string, string>;
    lockAdquirido?: boolean;
    fallaEnSql?: boolean;
    fallaEnInsertMigraciones?: boolean;
  } = {}) {
    const dbName = opcionesMock.dbName ?? BASE_DATOS_OFICIAL_B_JACOBO;
    const registrosDb = opcionesMock.registrosDb ?? new Map<string, string>();
    const lockAdquirido = opcionesMock.lockAdquirido ?? true;
    const llamadas: Array<{ sql: string; params?: unknown[] }> = [];

    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        llamadas.push({ sql, params });

        if (sql.includes('pg_try_advisory_lock')) {
          return { rows: [{ adquirido: lockAdquirido }], rowCount: 1 };
        }
        if (sql.includes('current_database()')) {
          return { rows: [{ db: dbName }], rowCount: 1 };
        }
        if (sql.includes('SELECT id, nombre_script, checksum_sha256')) {
          const rows = Array.from(registrosDb.entries()).map(([nombre, checksum], idx) => ({
            id: idx + 1,
            nombre_script: nombre,
            checksum_sha256: checksum,
            ejecutado_en: new Date(),
          }));
          return { rows, rowCount: rows.length };
        }
        if (sql.includes('SELECT checksum_sha256 FROM public.sigd_migraciones WHERE nombre_script = $1')) {
          const script = params?.[0] as string;
          if (registrosDb.has(script)) {
            return { rows: [{ checksum_sha256: registrosDb.get(script)! }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('INSERT INTO public.sigd_migraciones')) {
          if (opcionesMock.fallaEnInsertMigraciones) {
            throw new Error('SIMULATED_DB_ERROR: Error al registrar historial en sigd_migraciones');
          }
          const script = params?.[0] as string;
          const hash = params?.[1] as string;
          registrosDb.set(script, hash);
          return { rows: [{ id: 1 }], rowCount: 1 };
        }
        if (opcionesMock.fallaEnSql && (sql.includes('TABLA_FALLIDA') || sql.includes('ERROR_SIMULADO'))) {
          throw new Error('SIMULATED_SQL_SYNTAX_ERROR: Error durante ejecución de SQL');
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    const pool = {
      connect: vi.fn(async () => client),
    } as never;

    return { client, pool, llamadas, registrosDb };
  }

  // 1. Algoritmo de checksum determinista
  it('1. Algoritmo de checksum: genera SHA-256 idéntico sin importar saltos de línea CRLF, CR aislado o BOM', () => {
    const sqlCrLf = '\uFEFFCREATE TABLE test_bom (\r\n  id INT PRIMARY KEY\r\n);\r\n';
    const sqlLf = 'CREATE TABLE test_bom (\n  id INT PRIMARY KEY\n);\n';
    const sqlCr = 'CREATE TABLE test_bom (\r  id INT PRIMARY KEY\r);\r';

    const hashCrLf = calcularChecksumSha256(sqlCrLf);
    const hashLf = calcularChecksumSha256(sqlLf);
    const hashCr = calcularChecksumSha256(sqlCr);

    expect(hashCrLf).toBe(hashLf);
    expect(hashCr).toBe(hashLf);
    expect(hashCrLf).toHaveLength(64);
    expect(normalizarContenidoSql(sqlCrLf)).toBe(sqlLf);
    expect(normalizarContenidoSql(sqlCr)).toBe(sqlLf);
  });

  it('1b. Normalización criptográfica: compatibilidad estricta con CHAR(64) de PostgreSQL y recorte de espacios', () => {
    const rawSql = 'SELECT 1;';
    const computedHash = calcularChecksumSha256(rawSql);
    // Simular retorno de driver pg para columna CHAR(64) con espacios residuales
    const dbStoredChar64 = computedHash.padEnd(64, ' ');
    expect(dbStoredChar64.trim()).toBe(computedHash);
    expect(dbStoredChar64.trim()).toHaveLength(64);

    // Comparar con un valor que tenga espacios extra accidentales
    const dbStoredConEspacios = `  ${computedHash}   `;
    expect(dbStoredConEspacios.trim()).toBe(computedHash);
  });

  // 2. Migración nueva
  it('2. Migración nueva: se aplica y registra correctamente dentro de su transacción atómica en sigd_jacobo_demo', async () => {
    fs.writeFileSync(path.join(tmpDir, '22_sigd_nuevo_modulo.sql'), 'CREATE TABLE nuevo_modulo (id INT);');
    const mock = crearMockPool({ dbName: BASE_DATOS_OFICIAL_B_JACOBO });

    const aplicadas = await ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO });

    expect(aplicadas).toEqual(['22_sigd_nuevo_modulo.sql']);
    expect(mock.registrosDb.has('22_sigd_nuevo_modulo.sql')).toBe(true);
    expect(mock.llamadas.some((x) => x.sql === 'BEGIN')).toBe(true);
    expect(mock.llamadas.some((x) => x.sql === 'COMMIT')).toBe(true);
    expect(mock.client.release).toHaveBeenCalledOnce();
  });

  // 3. Migración ya aplicada
  it('3. Migración ya aplicada: no se vuelve a ejecutar y se preserva el estado previo', async () => {
    const contenido = 'CREATE TABLE modulo_existente (id INT);';
    fs.writeFileSync(path.join(tmpDir, '22_sigd_existente.sql'), contenido);
    const hash = calcularChecksumSha256(contenido);

    const mock = crearMockPool({
      dbName: BASE_DATOS_OFICIAL_B_JACOBO,
      registrosDb: new Map([['22_sigd_existente.sql', hash]]),
    });

    const aplicadas = await ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO });

    expect(aplicadas).toEqual([]);
    expect(mock.llamadas.some((x) => x.sql.includes('CREATE TABLE modulo_existente'))).toBe(false);
  });

  // 4. Checksum idéntico
  it('4. Checksum idéntico: aceptado sin error en el pipeline DDL', async () => {
    const contenido = 'CREATE TABLE check_ok (id INT);';
    fs.writeFileSync(path.join(tmpDir, '22_check_ok.sql'), contenido);
    const hash = calcularChecksumSha256(contenido);

    const mock = crearMockPool({
      dbName: BASE_DATOS_OFICIAL_B_JACOBO,
      registrosDb: new Map([['22_check_ok.sql', hash]]),
    });

    await expect(ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO })).resolves.toEqual([]);
  });

  // 5. Checksum modificado (Error explícito)
  it('5. Checksum modificado: detecta alteración no autorizada y lanza error explícito de integridad DDL', async () => {
    fs.writeFileSync(path.join(tmpDir, '22_alterado.sql'), 'CREATE TABLE alterado_ahora (id INT);');
    const mock = crearMockPool({
      dbName: BASE_DATOS_OFICIAL_B_JACOBO,
      registrosDb: new Map([['22_alterado.sql', 'hash_antiguo_invalido_0000000000000000000000000000000000000000000000000000']]),
    });

    await expect(ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO })).rejects.toThrow(
      /Error de Integridad DDL: 22_alterado.sql fue alterado tras su ejecución/,
    );
  });

  // 6. Archivo SQL faltante (Error controlado)
  it('6. Archivo SQL faltante: detecta migración registrada en BD que fue eliminada de disco', async () => {
    const mock = crearMockPool({
      dbName: BASE_DATOS_OFICIAL_B_JACOBO,
      registrosDb: new Map([['30_archivo_fantasma.sql', 'hash_30_000000000000000000000000000000000000000000000000000000000000']]),
    });

    await expect(ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO })).rejects.toThrow(
      /Error de Integridad DDL: La migración "30_archivo_fantasma.sql" está registrada en la base de datos pero no existe en disco/,
    );
  });

  // 7. Migración duplicada (Rechazo)
  it('7. Migración duplicada: rechaza colisiones en el identificador o número de secuencia', async () => {
    fs.writeFileSync(path.join(tmpDir, '25_modulo_a.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(tmpDir, '25_modulo_b.sql'), 'SELECT 2;');
    const mock = crearMockPool({ dbName: BASE_DATOS_OFICIAL_B_JACOBO });

    await expect(ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO })).rejects.toThrow(
      /Conflicto de secuencia en migraciones: 25_modulo_b.sql comparte el número 25 con 25_modulo_a.sql/,
    );
  });

  // 8. Error durante SQL (ROLLBACK)
  it('8. Error durante SQL: revierte la transacción con ROLLBACK y no asienta el registro', async () => {
    fs.writeFileSync(path.join(tmpDir, '22_falla_sql.sql'), 'CREATE TABLE TABLA_FALLIDA (error);');
    const mock = crearMockPool({ dbName: BASE_DATOS_OFICIAL_B_JACOBO, fallaEnSql: true });

    await expect(ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO })).rejects.toThrow(
      /SIMULATED_SQL_SYNTAX_ERROR/,
    );

    expect(mock.llamadas.some((x) => x.sql === 'ROLLBACK')).toBe(true);
    expect(mock.registrosDb.has('22_falla_sql.sql')).toBe(false);
  });

  // 9. Error al registrar historial (ROLLBACK)
  it('9. Error al registrar historial: si falla la inserción en sigd_migraciones revierte con ROLLBACK', async () => {
    fs.writeFileSync(path.join(tmpDir, '22_falla_historial.sql'), 'CREATE TABLE ok_pero_falla_historial (id INT);');
    const mock = crearMockPool({ dbName: BASE_DATOS_OFICIAL_B_JACOBO, fallaEnInsertMigraciones: true });

    await expect(ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO })).rejects.toThrow(
      /SIMULATED_DB_ERROR/,
    );

    expect(mock.llamadas.some((x) => x.sql === 'ROLLBACK')).toBe(true);
  });

  // 10. Dos runners simultáneos (Advisory Lock bloqueante)
  it('10. Dos runners simultáneos: si el advisory lock está retenido, falla de forma controlada por timeout', async () => {
    fs.writeFileSync(path.join(tmpDir, '22_concurrent.sql'), 'SELECT 1;');
    const mock = crearMockPool({ dbName: BASE_DATOS_OFICIAL_B_JACOBO, lockAdquirido: false });

    await expect(
      ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO, timeoutLockMs: 100 }),
    ).rejects.toThrow(/No se pudo adquirir el Advisory Lock 987654321/);
  });

  // 11. Restricción estricta de base: rechaza sigd_prueba y cualquier otra base no autorizada
  it('11. Restricción de base: rechaza terminantemente sigd_prueba y cualquier otra base que no sea sigd_jacobo_demo', async () => {
    fs.writeFileSync(path.join(tmpDir, '22_segura.sql'), 'SELECT 1;');

    // Caso A: Intento de conexión a sigd_prueba es rechazado antes de cualquier DDL
    const mockPrueba = crearMockPool({ dbName: 'sigd_prueba' });
    await expect(
      ejecutarMigraciones(mockPrueba.pool),
    ).rejects.toThrow(/Acceso no autorizado: La base de datos actual es "sigd_prueba"/);
    expect(mockPrueba.llamadas.some((x) => x.sql === 'BEGIN')).toBe(false);

    // Caso B: Intento de especificar baseEsperada como sigd_prueba es rechazado
    const mockDemo = crearMockPool({ dbName: BASE_DATOS_OFICIAL_B_JACOBO });
    await expect(
      ejecutarMigraciones(mockDemo.pool, { baseEsperada: 'sigd_prueba' }),
    ).rejects.toThrow(/Base de datos de destino incorrecta: se especificó "sigd_prueba"/);

    // Caso C: Base arbitraria o de producción no autorizada es rechazada
    const mockOtra = crearMockPool({ dbName: 'otra_base_inexistente' });
    await expect(
      ejecutarMigraciones(mockOtra.pool),
    ).rejects.toThrow(/Acceso no autorizado: La base de datos actual es "otra_base_inexistente"/);
  });

  // 12. Migración 21 con checksum canónico estricto en sigd_jacobo_demo
  it('12. Integridad Criptográfica: la migración 21 es validada contra su checksum canónico estricto sin requerir aliases', async () => {
    const contenido21 = fs.readFileSync(
      path.resolve(__dirname, '../../../migraciones/21_sigd_auth_actualizacion_ubigeo_2026.sql'),
      'utf-8',
    );
    fs.writeFileSync(path.join(tmpDir, '21_sigd_auth_actualizacion_ubigeo_2026.sql'), contenido21);

    const hashCanonicoReal = calcularChecksumSha256(contenido21);

    // Con el hash canónico real presente en sigd_jacobo_demo, el runner aprueba la migración
    const mockOk = crearMockPool({
      dbName: BASE_DATOS_OFICIAL_B_JACOBO,
      registrosDb: new Map([['21_sigd_auth_actualizacion_ubigeo_2026.sql', hashCanonicoReal]]),
    });
    await expect(ejecutarMigraciones(mockOk.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO })).resolves.toEqual([]);

    // Si se intentara presentar un hash artificial o manipulado, se rechaza inmediatamente
    const mockAlterado = crearMockPool({
      dbName: BASE_DATOS_OFICIAL_B_JACOBO,
      registrosDb: new Map([['21_sigd_auth_actualizacion_ubigeo_2026.sql', 'a9b7405126830740a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef01']]),
    });
    await expect(ejecutarMigraciones(mockAlterado.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO })).rejects.toThrow(
      /Error de Integridad DDL: 21_sigd_auth_actualizacion_ubigeo_2026.sql fue alterado tras su ejecución/,
    );
  });

  // 13. Segunda ejecución del runner (Idempotencia)
  it('13. Segunda ejecución del runner: garantiza idempotencia absoluta retornando 0 aplicaciones', async () => {
    fs.writeFileSync(path.join(tmpDir, '22_primera.sql'), 'CREATE TABLE primera (id INT);');
    const mock = crearMockPool({ dbName: BASE_DATOS_OFICIAL_B_JACOBO });

    // Primera ejecución: aplica
    const primeraVez = await ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO });
    expect(primeraVez).toEqual(['22_primera.sql']);

    // Segunda ejecución: 0 aplicadas, sin error
    const segundaVez = await ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO });
    expect(segundaVez).toEqual([]);
  });

  // 14. Migración futura con mala práctica (Detección de violación DDL)
  it('14. Regla de Arquitectura: rechaza migraciones futuras (>21) que intenten registrarse a sí mismas manualmente', async () => {
    const sqlInvalido = `
      CREATE TABLE modulo_nuevo (id INT);
      INSERT INTO public.sigd_migraciones (nombre_script, checksum_sha256) VALUES ('22_mala_practica.sql', 'fake');
    `;
    fs.writeFileSync(path.join(tmpDir, '22_mala_practica.sql'), sqlInvalido);
    const mock = crearMockPool({ dbName: BASE_DATOS_OFICIAL_B_JACOBO });

    await expect(ejecutarMigraciones(mock.pool, { baseEsperada: BASE_DATOS_OFICIAL_B_JACOBO })).rejects.toThrow(
      /Violación de Arquitectura DDL en 22_mala_practica.sql: El registro de migraciones es responsabilidad exclusiva del runner institucional/,
    );
  });
});
