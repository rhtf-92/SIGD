import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach,describe,expect,it,vi } from 'vitest';
import {
  ejecutarMigraciones,
  detectarComandosTransaccionalesNivelSuperior,
  validarEstructuraTransaccional,
} from '../../../src/db/migrate.js';

describe('migrador con selección segura de archivo',()=>{
 const prevDir=process.env.MIGRATIONS_DIR;
 let dir:string;
 afterEach(()=>{if(prevDir===undefined)delete process.env.MIGRATIONS_DIR;else process.env.MIGRATIONS_DIR=prevDir;if(dir)fs.rmSync(dir,{recursive:true,force:true});});
 async function fixture(){
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'sigd-migrate-unit-'));process.env.MIGRATIONS_DIR=dir;
  fs.writeFileSync(path.join(dir,'17_target.sql'),'CREATE TABLE target_demo(id integer);');
  fs.writeFileSync(path.join(dir,'18_other.sql'),'CREATE TABLE other_demo(id integer);');
  const calls:Array<{sql:string;params?:unknown[]}>=[];
  const client={query:vi.fn(async(sql:string,params?:unknown[])=>{calls.push({sql,params});
    if(sql.includes('pg_try_advisory_lock'))return{rows:[{adquirido:true}],rowCount:1};
    if(sql.includes('current_database'))return{rows:[{db:'sigd_jacobo_demo'}],rowCount:1};
    if(sql.includes('SELECT checksum_sha256'))return{rows:[],rowCount:0};
    return{rows:[],rowCount:1};}),release:vi.fn()};
  const pool={connect:vi.fn(async()=>client)} as never;
  return{calls,client,pool};
 }
 it('ejecuta y registra atómicamente solo el archivo seleccionado bajo advisory lock',async()=>{
  const f=await fixture();
  await expect(ejecutarMigraciones(f.pool,{soloArchivo:'17_target.sql',baseEsperada:'sigd_jacobo_demo'})).resolves.toEqual(['17_target.sql']);
  const sql=f.calls.map(x=>x.sql);
  expect(sql.indexOf('BEGIN')).toBeLessThan(sql.indexOf('CREATE TABLE target_demo(id integer);'));
  expect(sql.indexOf('CREATE TABLE target_demo(id integer);')).toBeLessThan(sql.findIndex(x=>x.startsWith('INSERT INTO public.sigd_migraciones')));
  expect(sql.at(-2)).toBe('COMMIT');
  expect(sql).not.toContain('CREATE TABLE other_demo(id integer);');
  expect(f.client.release).toHaveBeenCalledOnce();
 });
 it('rechaza base inesperada antes de BEGIN o cualquier DDL',async()=>{
  const f=await fixture();
  await expect(ejecutarMigraciones(f.pool,{soloArchivo:'17_target.sql',baseEsperada:'otra_base'})).rejects.toThrow('Base de datos de destino incorrecta');
  expect(f.calls.some(x=>x.sql==='BEGIN'||x.sql.includes('CREATE TABLE IF NOT EXISTS public.sigd_migraciones'))).toBe(false);
 });
 it('no permite ejecución individual sin base esperada ni rutas arbitrarias',async()=>{
  const f=await fixture();
  await expect(ejecutarMigraciones(f.pool,{soloArchivo:'17_target.sql'})).rejects.toThrow('base de datos esperada explícita');
  await expect(ejecutarMigraciones(f.pool,{soloArchivo:'../17_target.sql',baseEsperada:'sigd_jacobo_demo'})).rejects.toThrow('nombre de archivo .sql');
 });
 it('bloquea el modo de prueba si NODE_ENV=production',async()=>{
  const f=await fixture();
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    await expect(ejecutarMigraciones(f.pool,{
      soloArchivo:'17_target.sql',
      baseEsperada:'sigd_isolated_cert_m2',
      permitirBaseCualquieraEnTest:true,
    })).rejects.toThrow('prohibido terminantemente en entorno de producción');
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
 });
 it('bloquea el modo de prueba si se intenta apuntar a la base oficial sigd_jacobo_demo',async()=>{
  const f=await fixture();
  await expect(ejecutarMigraciones(f.pool,{
    soloArchivo:'17_target.sql',
    baseEsperada:'sigd_jacobo_demo',
    permitirBaseCualquieraEnTest:true,
  })).rejects.toThrow('no puede ejecutarse contra la base oficial');
 });
 it('bloquea el modo de prueba ante bases no autorizadas fuera de la whitelist',async()=>{
  const f=await fixture();
  f.client.query = vi.fn(async(sql:string)=>{
    if(sql.includes('pg_try_advisory_lock'))return{rows:[{adquirido:true}],rowCount:1};
    if(sql.includes('current_database'))return{rows:[{db:'base_no_autorizada'}],rowCount:1};
    return{rows:[],rowCount:0};
  });
  await expect(ejecutarMigraciones(f.pool,{
    soloArchivo:'17_target.sql',
    baseEsperada:'base_no_autorizada',
    permitirBaseCualquieraEnTest:true,
  })).rejects.toThrow('Base de datos de prueba no autorizada');
 });
 it('la migración 17 deja transacción y checksum al runner y define DDL repetible',()=>{
  const sql=fs.readFileSync(path.resolve(process.cwd(),'migraciones/17_sigd_tes_pago_adicional_seguro.sql'),'utf8');
  expect(sql).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;\s*$/im);
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS sigd_tes.autorizacion_pago_adicional');
  expect(sql).toContain('ALTER TABLE sigd_tes.pago ADD COLUMN IF NOT EXISTS autorizacion_adicional_id');
  expect(sql).toContain("conname='pago_autorizacion_adicional_fk'");
  expect(sql).toContain('CREATE OR REPLACE FUNCTION sigd_tes.proteger_orden_devolucion');
  expect(sql).toContain('DROP TRIGGER IF EXISTS proteger_orden_devolucion');
  expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS pago_autorizacion_adicional_unica');
 });
 it('la migración 22 no contiene BEGIN ni COMMIT explícitos en sus extremos',()=>{
  const sql=fs.readFileSync(path.resolve(process.cwd(),'migraciones/22_sigd_org_catalogo_rbac_institucional.sql'),'utf8');
  expect(sql).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;\s*$/im);
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS sigd_org.capacidad_sistema');
 });
 it('detectarComandosTransaccionalesNivelSuperior detecta exhaustivamente las 12 variantes de comandos transaccionales',()=>{
  const variantes = [
    { sql: 'BEGIN;', esperado: ['BEGIN'] },
    { sql: 'COMMIT;', esperado: ['COMMIT'] },
    { sql: 'END;', esperado: ['END'] },
    { sql: 'START TRANSACTION;', esperado: ['START TRANSACTION'] },
    { sql: 'ROLLBACK;', esperado: ['ROLLBACK'] },
    { sql: 'COMMIT AND CHAIN;', esperado: ['COMMIT AND CHAIN'] },
    { sql: 'ROLLBACK AND CHAIN;', esperado: ['ROLLBACK AND CHAIN'] },
    { sql: 'COMMIT WORK;', esperado: ['COMMIT WORK'] },
    { sql: 'ROLLBACK WORK;', esperado: ['ROLLBACK WORK'] },
    { sql: "PREPARE TRANSACTION 'tx_sigd_demo';", esperado: ['PREPARE TRANSACTION'] },
    { sql: "COMMIT PREPARED 'tx_sigd_demo';", esperado: ['COMMIT PREPARED'] },
    { sql: "ROLLBACK PREPARED 'tx_sigd_demo';", esperado: ['ROLLBACK PREPARED'] },
    // Con modificadores y comentarios intercalados
    { sql: 'COMMIT /* comentario */ ;', esperado: ['COMMIT'] },
    { sql: 'START /* c1 */ TRANSACTION;', esperado: ['START TRANSACTION'] },
    { sql: 'COMMIT /* c1 */ AND /* c2 */ CHAIN;', esperado: ['COMMIT AND CHAIN'] },
    { sql: 'ROLLBACK /* c1 */ AND /* c2 */ CHAIN;', esperado: ['ROLLBACK AND CHAIN'] },
    { sql: '/* comentario previo /* anidado */ */ BEGIN;', esperado: ['BEGIN'] },
  ];

  for (const v of variantes) {
    const detectados = detectarComandosTransaccionalesNivelSuperior(v.sql);
    expect(detectados, `Falla al detectar comando en: ${v.sql}`).toEqual(v.esperado);
  }
 });
 it('detectarComandosTransaccionalesNivelSuperior previene con precisión quirúrgica los falsos positivos',()=>{
  const noTransaccionales = [
    // Savepoints
    'SAVEPOINT sp_punto_seguro;',
    'RELEASE SAVEPOINT sp_punto_seguro;',
    'RELEASE sp_punto_seguro;',
    'ROLLBACK TO SAVEPOINT sp_punto_seguro;',
    'ROLLBACK TO sp_punto_seguro;',
    'ROLLBACK /* comentario */ TO /* c2 */ SAVEPOINT sp_1;',

    // Expresiones CASE ... END simples y anidadas
    "SELECT id, CASE WHEN estado = 'A' THEN 'Activo' ELSE 'Inactivo' END AS descr FROM usuarios;",
    "SELECT CASE WHEN tipo = 1 THEN CASE WHEN sub = 2 THEN 'A' ELSE 'B' END ELSE 'C' END;",
    "ALTER TABLE doc ADD CONSTRAINT chk_test CHECK (CASE WHEN id IS NOT NULL THEN 1 ELSE 0 END = 1);",

    // Bloques DO $$ ... $$ y funciones PL/pgSQL
    'DO $$ BEGIN PERFORM 1; END $$;',
    'CREATE FUNCTION fn_test() RETURNS void AS $f$ BEGIN PERFORM 1; END; $f$ LANGUAGE plpgsql;',
    'CREATE PROCEDURE sp_test() AS $_$ BEGIN NULL; END; $_$ LANGUAGE plpgsql;',

    // Identificadores entrecomillados
    'CREATE TABLE "tbl_demo" ("BEGIN" text, "COMMIT" int, "ROLLBACK" boolean);',
    'SELECT "BEGIN" FROM "COMMIT" WHERE "ROLLBACK" IS TRUE;',

    // Literales de cadena y secuencias de escape E'...'
    "SELECT 'BEGIN', 'COMMIT', 'ROLLBACK', 'END', 'START TRANSACTION';",
    "SELECT E'escaped \\' quote with BEGIN and COMMIT and END in string' AS col;",

    // Comentarios de línea y bloque anidados sin comandos
    '-- BEGIN; COMMIT; ROLLBACK; START TRANSACTION;',
    '/* BEGIN; COMMIT; ROLLBACK; */',
    '/* Comentario /* Anidado /* Multinivel */ */ */',
    '/* BEGIN */ -- COMMIT\n /* ROLLBACK */',
  ];

  for (const sql of noTransaccionales) {
    const detectados = detectarComandosTransaccionalesNivelSuperior(sql);
    expect(detectados, `Falso positivo detectado en: ${sql}`).toEqual([]);
  }
 });
 it('detectarComandosTransaccionalesNivelSuperior identifica BEGIN, COMMIT y START TRANSACTION de nivel superior',()=>{
  const sqlConTransaccion = `
    -- Comentario con BEGIN que no debe detectarse
    /* Bloque de comentario con COMMIT */
    START TRANSACTION;
    CREATE TABLE tbl_demo(estado varchar(20) DEFAULT 'COMMIT');
    DO $$
    DECLARE v_val int;
    BEGIN
      v_val := 10;
    END $$;
    COMMIT;
  `;
  const detectados = detectarComandosTransaccionalesNivelSuperior(sqlConTransaccion);
  expect(detectados).toEqual(['START TRANSACTION', 'COMMIT']);
 });
 it('detectarComandosTransaccionalesNivelSuperior no genera falsos positivos con bloques DO o funciones plpgsql',()=>{
  const sqlLimpio = `
    -- Migración institucional sin comandos transaccionales de nivel superior
    CREATE TABLE IF NOT EXISTS sigd_org.demo (
      id uuid PRIMARY KEY,
      estado varchar(20) DEFAULT 'BEGIN_STATE'
    );

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mi_enum') THEN
        CREATE TYPE mi_enum AS ENUM ('ACTIVO', 'INACTIVO');
      END IF;
    END $$;

    CREATE OR REPLACE FUNCTION sigd_org.fn_prueba()
    RETURNS void
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      PERFORM 1;
    END;
    $func$;
  `;
  const detectados = detectarComandosTransaccionalesNivelSuperior(sqlLimpio);
  expect(detectados).toEqual([]);
 });
 it('validarEstructuraTransaccional rechaza BEGIN y COMMIT de nivel superior en migraciones > 21',()=>{
  const sqlInvalido = `
    BEGIN;
    CREATE TABLE tbl_invalida(id int);
    COMMIT;
  `;
  expect(() => validarEstructuraTransaccional(sqlInvalido, '24_sigd_seguridad_auditoria.sql'))
    .toThrow('Violación de Arquitectura DDL en 24_sigd_seguridad_auditoria.sql: Las migraciones superiores a 21 no deben contener comandos transaccionales explícitos de nivel superior (BEGIN, COMMIT)');
 });
 it('validarEstructuraTransaccional permite migraciones históricas <= 21 con BEGIN y COMMIT',()=>{
  const sqlHistorico = `
    BEGIN;
    CREATE TABLE tbl_historica(id int);
    COMMIT;
  `;
  expect(() => validarEstructuraTransaccional(sqlHistorico, '20_migracion_historica.sql')).not.toThrow();
 });
 it('las migraciones 22 a 28 en disco cumplen estrictamente la validación estructural transaccional',()=>{
  const directorio = path.resolve(process.cwd(), 'migraciones');
  const migracionesNuevas = ['22', '23', '24', '25', '26', '27', '28'];
  const archivos = fs.readdirSync(directorio).filter(f => migracionesNuevas.some(num => f.startsWith(`${num}_`)));
  expect(archivos.length).toBe(7);

  for (const archivo of archivos) {
    const contenido = fs.readFileSync(path.join(directorio, archivo), 'utf8');
    expect(() => validarEstructuraTransaccional(contenido, archivo)).not.toThrow();
    const detectados = detectarComandosTransaccionalesNivelSuperior(contenido);
    expect(detectados, `Migración ${archivo} no debe contener comandos transaccionales de nivel superior`).toEqual([]);
  }
 });
 it('las migraciones activas en raíz se validan correctamente',()=>{
  const directorio = path.resolve(process.cwd(), 'migraciones');
  const archivosRaiz = fs.readdirSync(directorio).filter(f => /^\d{2}_.*\.sql$/.test(f));
  expect(archivosRaiz.length).toBeGreaterThanOrEqual(26);
  expect(archivosRaiz).toContain('28_sigd_org_eliminacion_definitiva_rol_especialista.sql');

  const dirPendientes = path.join(directorio, 'pendientes');
  const archivosPendientes = fs.existsSync(dirPendientes)
    ? fs.readdirSync(dirPendientes).filter(f => /^\d{2}_.*\.sql$/.test(f))
    : [];

  const totalArchivos = [...archivosRaiz.map(f => path.join(directorio, f)), ...archivosPendientes.map(f => path.join(dirPendientes, f))];
  expect(totalArchivos.length).toBeGreaterThanOrEqual(26);

  for (const rutaCompleta of totalArchivos) {
    const nombreArchivo = path.basename(rutaCompleta);
    const contenido = fs.readFileSync(rutaCompleta, 'utf8');
    expect(() => validarEstructuraTransaccional(contenido, nombreArchivo)).not.toThrow();
  }
 });
});
