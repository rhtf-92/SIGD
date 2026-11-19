import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo',
});

async function main() {
  console.log('--- Comprobación de Triggers / Reglas WORM en sigd_audit.bitacora_auditoria ---');
  
  const { rows: triggers } = await pool.query(`
    SELECT tgname, pg_get_triggerdef(oid) as def
    FROM pg_trigger
    WHERE tgrelid = 'sigd_audit.bitacora_auditoria'::regclass
  `);
  console.log('Triggers:', triggers);

  const { rows: rules } = await pool.query(`
    SELECT rulename, definition
    FROM pg_rules
    WHERE schemaname = 'sigd_audit' AND tablename = 'bitacora_auditoria'
  `);
  console.log('Reglas:', rules);

  // Intentar un UPDATE y un DELETE en una transacción con ROLLBACK para verificar si está protegido
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('\n--- Probando inmutabilidad WORM contra UPDATE/DELETE ---');
    
    // Obtener un registro
    const { rows: r } = await client.query('SELECT id_auditoria FROM sigd_audit.bitacora_auditoria LIMIT 1');
    if (r.length > 0) {
      const id = r[0].id_auditoria;
      
      // Intentar UPDATE
      try {
        await client.query("UPDATE sigd_audit.bitacora_auditoria SET operacion = 'ALTERADA' WHERE id_auditoria = $1", [id]);
        console.log('UPDATE: Permitido (o controlado por trigger sin efecto)');
      } catch (e) {
        console.log('UPDATE: Bloqueado por regla/trigger WORM ->', e.message);
      }

      // Intentar DELETE
      try {
        await client.query("DELETE FROM sigd_audit.bitacora_auditoria WHERE id_auditoria = $1", [id]);
        console.log('DELETE: Permitido');
      } catch (e) {
        console.log('DELETE: Bloqueado por regla/trigger WORM ->', e.message);
      }
    }
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  pool.end();
});
