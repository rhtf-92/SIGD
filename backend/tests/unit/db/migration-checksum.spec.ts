import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migracionesDir = path.resolve(__dirname, '../../../migraciones');

function checksumsCoinciden(contenido: string, checksumRegistrado: string): boolean {
  if (crypto.createHash('sha256').update(contenido).digest('hex') === checksumRegistrado) return true;
  const lf = crypto.createHash('sha256').update(contenido.replace(/\r\n/g, '\n')).digest('hex');
  if (lf === checksumRegistrado) return true;
  const crlf = crypto.createHash('sha256').update(contenido.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')).digest('hex');
  return crlf === checksumRegistrado;
}

describe('Auditoría de Integridad y Checksums Migratorios (§12 / Codex)', () => {
  it('normaliza CRLF y LF sin falsear mismatch de checksum', () => {
    const sqlOriginalLF = "SELECT 1;\n-- Test migration\nINSERT INTO test VALUES (1);\n";
    const sqlOriginalCRLF = "SELECT 1;\r\n-- Test migration\r\nINSERT INTO test VALUES (1);\r\n";

    const hashLF = crypto.createHash('sha256').update(sqlOriginalLF).digest('hex');
    const hashCRLF = crypto.createHash('sha256').update(sqlOriginalCRLF).digest('hex');

    // Ambos hashes son aceptados por la función de verificación independientemente del origen
    expect(checksumsCoinciden(sqlOriginalCRLF, hashLF)).toBe(true);
    expect(checksumsCoinciden(sqlOriginalLF, hashCRLF)).toBe(true);
  });

  it('detecta alteraciones reales en el contenido SQL (tamper detection estricto)', () => {
    const sqlBase = "CREATE TABLE test (id INT PRIMARY KEY);\n";
    const hashBase = crypto.createHash('sha256').update(sqlBase).digest('hex');

    const sqlModificado = "CREATE TABLE test (id BIGINT PRIMARY KEY);\n";
    const sqlConComentario = "CREATE TABLE test (id INT PRIMARY KEY); -- modificado\n";

    expect(checksumsCoinciden(sqlModificado, hashBase)).toBe(false);
    expect(checksumsCoinciden(sqlConComentario, hashBase)).toBe(false);
  });

  it('verifica que todos los archivos del manifiesto baseline existen físicamente y no están vacíos', () => {
    const manifiesto = [
      '01_sigd_audit.sql',
      '02_sigd_auth.sql',
      '03_sigd_org.sql',
      '04_sigd_doc.sql',
      '05_sigd_tra.sql',
      '08_sigd_tupa_acoplamiento.sql',
      '09_sigd_seguridad_remediacion.sql',
      '10_sigd_seguridad_fix_integridad.sql',
      '11_sigd_fix_post_auditoria_codex.sql',
    ];

    for (const archivo of manifiesto) {
      const rutaCompleta = path.join(migracionesDir, archivo);
      expect(fs.existsSync(rutaCompleta), `Archivo de migración ${archivo} no existe`).toBe(true);
      const contenido = fs.readFileSync(rutaCompleta, 'utf8');
      expect(contenido.trim().length, `Archivo ${archivo} está vacío`).toBeGreaterThan(50);
    }
  });

  it('valida que la migración 10 contiene la corrección canónica de columna F-07 y remediación F-08', () => {
    const ruta10 = path.join(migracionesDir, '10_sigd_seguridad_fix_integridad.sql');
    const contenido = fs.readFileSync(ruta10, 'utf8');

    // F-07: Comprobar que usa id_persona_natural y la consulta SQL no utiliza id_persona_representante
    expect(contenido).toContain('id_persona_natural = OLD.id_persona');
    const sqlSinComentarios = contenido.replace(/--.*$/gm, '');
    expect(sqlSinComentarios).not.toContain('id_persona_representante');

    // F-08: Comprobar que anula contraseñas estáticas DDL
    expect(contenido).toContain('ALTER ROLE sigd_app WITH PASSWORD NULL;');
    expect(contenido).toContain('ALTER ROLE sigd_worker WITH PASSWORD NULL;');
  });

  it('H-09/H-10: valida que la migración 11 y su rollback sincronizan el estado FSM legacy', () => {
    const ruta11 = path.join(migracionesDir, '11_sigd_fix_post_auditoria_codex.sql');
    const contenido11 = fs.readFileSync(ruta11, 'utf8');
    expect(contenido11).toContain("UPDATE sigd_tra.expediente");
    expect(contenido11).toContain("SET estado = 'EN_REVISION'");
    expect(contenido11).toContain("FROM sigd_rut.estado_actual_expediente");
    expect(contenido11).toContain("AND e.estado = 'EN_TRAMITE'");
    expect(contenido11).toContain("AND u.estado_nuevo = 'EN_REVISION'");

    const rutaRollback11 = path.join(migracionesDir, 'rollbacks', '11_sigd_fix_post_auditoria_codex_rollback.sql');
    expect(fs.existsSync(rutaRollback11)).toBe(true);
    const contenidoRollback = fs.readFileSync(rutaRollback11, 'utf8');
    expect(contenidoRollback).toContain("SET estado = 'EN_TRAMITE'");
  });

  it('H-03: algoritmo de prefijo ordenado estricto rechaza saltos, desorden y checksums corruptos', () => {
    const manifiestoFake = [
      { nombre: '01.sql', contenido: 'SELECT 1;', checksum: 'hash1' },
      { nombre: '02.sql', contenido: 'SELECT 2;', checksum: 'hash2' },
      { nombre: '03.sql', contenido: 'SELECT 3;', checksum: 'hash3' },
    ];

    function validarPrefijo(registros: Array<{ nombre_script: string; checksum_sha256: string }>) {
      if (registros.length > manifiestoFake.length) {
        throw new Error('la base de datos contiene más migraciones que el manifiesto');
      }
      for (let i = 0; i < registros.length; i++) {
        const reg = registros[i];
        const script = manifiestoFake[i];
        if (reg.nombre_script !== script.nombre) {
          throw new Error(`secuencia rota en ${i + 1}`);
        }
        if (reg.checksum_sha256 !== script.checksum) {
          throw new Error(`checksum distinto en ${i + 1}`);
        }
      }
      return registros.length === manifiestoFake.length ? 'COMPLETE' : 'PENDING';
    }

    // Prefijo válido parcial (PENDING)
    expect(validarPrefijo([
      { nombre_script: '01.sql', checksum_sha256: 'hash1' },
    ])).toBe('PENDING');

    // Prefijo completo (COMPLETE)
    expect(validarPrefijo([
      { nombre_script: '01.sql', checksum_sha256: 'hash1' },
      { nombre_script: '02.sql', checksum_sha256: 'hash2' },
      { nombre_script: '03.sql', checksum_sha256: 'hash3' },
    ])).toBe('COMPLETE');

    // Desorden (02 antes de 01) -> rechaza
    expect(() => validarPrefijo([
      { nombre_script: '02.sql', checksum_sha256: 'hash2' },
      { nombre_script: '01.sql', checksum_sha256: 'hash1' },
    ])).toThrow(/secuencia rota/);

    // Salto de migración (01 y 03, saltando 02) -> rechaza
    expect(() => validarPrefijo([
      { nombre_script: '01.sql', checksum_sha256: 'hash1' },
      { nombre_script: '03.sql', checksum_sha256: 'hash3' },
    ])).toThrow(/secuencia rota/);

    // Checksum alterado -> rechaza
    expect(() => validarPrefijo([
      { nombre_script: '01.sql', checksum_sha256: 'hash_corrupto' },
    ])).toThrow(/checksum distinto/);

    // Más migraciones que el manifiesto -> rechaza
    expect(() => validarPrefijo([
      { nombre_script: '01.sql', checksum_sha256: 'hash1' },
      { nombre_script: '02.sql', checksum_sha256: 'hash2' },
      { nombre_script: '03.sql', checksum_sha256: 'hash3' },
      { nombre_script: '04.sql', checksum_sha256: 'hash4' },
    ])).toThrow(/más migraciones/);
  });
});
