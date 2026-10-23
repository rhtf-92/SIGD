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
});
