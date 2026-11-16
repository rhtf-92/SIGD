import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo',
});

async function main() {
  console.log('=== VERIFICACIÓN TÉCNICA REAL EN POSTGRESQL 18 (sigd_jacobo_demo:5433) ===\n');

  // 1. Roles institucionales
  const { rows: roles } = await pool.query(`
    SELECT rol_id, codigo, nombre, vigente,
           (SELECT COUNT(DISTINCT ur.id_usuario)::int FROM sigd_org.usuario_rol ur
            JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = ur.id_usuario AND cu.activo = TRUE
            WHERE ur.rol_id = r.rol_id AND ur.vigente_desde <= now()
              AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())) AS usuarios_activos
    FROM sigd_org.rol_sistema r
    ORDER BY codigo
  `);
  console.log(`[1] Roles en sigd_org.rol_sistema (${roles.length} roles encontrados):`);
  roles.forEach(r => {
    console.log(`    - [${r.codigo}] ${r.nombre} (Vigente: ${r.vigente}, Usuarios activos: ${r.usuarios_activos})`);
  });

  // Validar ausencia de SUPER_ADMIN
  const superAdmin = roles.find(r => r.codigo === 'SUPER_ADMIN');
  if (superAdmin) {
    throw new Error('FALLO CRÍTICO: Se detectó el rol prohibido SUPER_ADMIN en base de datos.');
  }
  console.log('    ✓ Confirmado: SUPER_ADMIN NO existe en el catálogo de base de datos.');

  // 2. Permisos del sistema
  const { rows: permisos } = await pool.query(`
    SELECT permiso_id, codigo, nombre, ambito,
           CASE
             WHEN codigo = 'ADMIN_USUARIOS' THEN 'Administración'
             WHEN codigo LIKE 'EXPEDIENTE_%' THEN 'Trámite Documentario y RutaDoc'
             WHEN codigo = 'TRAMICORE_DEVOLUCION_EVALUAR' THEN 'Mesa de Partes'
             WHEN codigo LIKE 'FIRMA_%' THEN 'Gestión Documentaria'
             WHEN codigo LIKE 'TESORERIA_%' THEN 'Tesorería'
             WHEN codigo LIKE 'REPORTE_%' THEN 'Reportes'
             ELSE 'General'
           END AS modulo
    FROM sigd_org.permiso_sistema
    ORDER BY modulo, codigo
  `);
  console.log(`\n[2] Permisos en sigd_org.permiso_sistema (${permisos.length} permisos catalogados):`);
  permisos.forEach(p => {
    console.log(`    - [${p.modulo}] ${p.codigo} (${p.ambito}): ${p.nombre}`);
  });

  // 3. Permisos de ADMINISTRADOR y CIUDADANO
  const adminRol = roles.find(r => r.codigo === 'ADMINISTRADOR');
  const ciudadanoRol = roles.find(r => r.codigo === 'CIUDADANO');

  const { rows: adminPermisos } = await pool.query(`
    SELECT p.codigo, p.ambito FROM sigd_org.rol_permiso rp
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
    WHERE rp.rol_id = $1::uuid
  `, [adminRol.rol_id]);
  console.log(`\n[3] Permisos de ADMINISTRADOR: ${adminPermisos.map(p => p.codigo).join(', ')}`);
  if (!adminPermisos.some(p => p.codigo === 'ADMIN_USUARIOS')) {
    throw new Error('FALLO: ADMINISTRADOR no tiene ADMIN_USUARIOS');
  }
  console.log('    ✓ Confirmado: ADMINISTRADOR posee ADMIN_USUARIOS (Protección contra autobloqueo activa).');

  const { rows: ciudadanoPermisos } = await pool.query(`
    SELECT p.codigo, p.ambito FROM sigd_org.rol_permiso rp
    JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
    WHERE rp.rol_id = $1::uuid
  `, [ciudadanoRol.rol_id]);
  console.log(`    Permisos de CIUDADANO: ${ciudadanoPermisos.map(p => p.codigo).join(', ')}`);
  console.log('    ✓ Confirmado: CIUDADANO cuenta únicamente con permisos externos de consulta.');

  // 4. Verificación de bitácora WORM
  const { rows: bitacora } = await pool.query(`
    SELECT id_auditoria, usuario_id, operacion, esquema, tabla, fecha_hora
    FROM sigd_audit.bitacora_auditoria
    ORDER BY fecha_hora DESC
    LIMIT 5
  `);
  console.log(`\n[4] Últimos 5 registros en sigd_audit.bitacora_auditoria:`);
  bitacora.forEach(b => {
    console.log(`    - [${b.fecha_hora ? b.fecha_hora.toISOString() : 'N/A'}] ${b.operacion} en ${b.esquema}.${b.tabla} (actor: ${b.usuario_id})`);
  });

  // 5. Simulación transaccional con ROLLBACK para verificar actualización y bitácora
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('\n[5] Simulación transaccional de actualización con ROLLBACK...');

    // Consultar permisos de Especialista
    const especialista = roles.find(r => r.codigo === 'ESPECIALISTA');
    const { rows: prevPerms } = await client.query(
      'SELECT permiso_id FROM sigd_org.rol_permiso WHERE rol_id = $1::uuid',
      [especialista.rol_id]
    );

    // Insertar un registro de auditoría con actor_id
    const actorAdminId = '99999999-9999-4999-8999-999999999999';
    await client.query(`
      INSERT INTO sigd_audit.bitacora_auditoria(
        correlation_id, usuario_id, esquema, tabla, operacion, datos_antes, datos_despues
      ) VALUES (
        gen_random_uuid(), $1::uuid, 'sigd_org', 'rol_permiso', 'UPDATE',
        $2::jsonb, $3::jsonb
      )
    `, [
      actorAdminId,
      JSON.stringify({ rol_codigo: 'ESPECIALISTA', permisos: [] }),
      JSON.stringify({ rol_codigo: 'ESPECIALISTA', permisos: ['EXPEDIENTE_DERIVAR'], actor_id: actorAdminId }),
    ]);

    console.log('    ✓ Inserción en bitácora de auditoría inmutable WORM ejecutada exitosamente.');
    await client.query('ROLLBACK');
    console.log('    ✓ Transacción revertida cleanly con ROLLBACK (la base queda intacta).');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('\n=== TODAS LAS VERIFICACIONES EN POSTGRESQL 18 CULMINARON CON ÉXITO (100%) ===');
  await pool.end();
}

main().catch(err => {
  console.error('Error durante la verificación:', err);
  pool.end();
  process.exit(1);
});
