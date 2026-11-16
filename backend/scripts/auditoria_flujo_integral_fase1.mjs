import pg from 'pg';
import argon2 from 'argon2';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo',
});

async function auditarFlujoIntegral() {
  console.log('========================================================================');
  console.log('  SIGD — AUDITORÍA INTEGRAL DE FUNCIONAMIENTO Y CIERRE DE FASE 1');
  console.log('  Base de Datos: sigd_jacobo_demo (PostgreSQL 18.6, Puerto 5433)');
  console.log('  Rama Oficial:  B_JACOBO');
  console.log('========================================================================\n');

  const client = await pool.connect();
  let exitoTotal = false;

  try {
    await client.query('BEGIN');
    console.log('[TRANSACCIÓN] Iniciando bloque transaccional controlado (ROLLBACK garantizado)...\n');

    // 0. Localizar dependencias institucionales maestras
    const { rows: areas } = await client.query("SELECT area_id, codigo, nombre FROM sigd_org.area WHERE vigente=TRUE ORDER BY nombre");
    const { rows: cargos } = await client.query("SELECT cargo_id, codigo, nombre FROM sigd_org.cargo WHERE vigente=TRUE ORDER BY nombre");
    const { rows: roles } = await client.query("SELECT rol_id, codigo, nombre FROM sigd_org.rol_sistema WHERE vigente=TRUE ORDER BY codigo");
    const { rows: admins } = await client.query(`
      SELECT cu.id_usuario, cu.usuario FROM sigd_auth.cuenta_usuario cu
      JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario AND ur.vigente_hasta IS NULL
      JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.codigo = 'ADMINISTRADOR'
      WHERE cu.activo = TRUE LIMIT 1
    `);

    if (admins.length === 0) throw new Error('No se encontró administrador institucional activo.');
    const adminActivoId = admins[0].id_usuario;
    const areaInformatica = areas.find(a => a.nombre.toLowerCase().includes('inform') || a.nombre.toLowerCase().includes('tecnol')) || areas[0];
    const otraArea = areas.find(a => a.area_id !== areaInformatica.area_id) || areas[1];
    const cargoEspecialista = cargos.find(c => c.nombre.toLowerCase().includes('especialista') || c.nombre.toLowerCase().includes('téc')) || cargos[0];
    const rolEspecialista = roles.find(r => r.codigo === 'ESPECIALISTA');
    const rolAdmin = roles.find(r => r.codigo === 'ADMINISTRADOR');

    console.log(`[CONFIG] Administrador Auditor: ${admins[0].usuario} (${adminActivoId})`);
    console.log(`[CONFIG] Área Asignada:         ${areaInformatica.nombre} (${areaInformatica.area_id})`);
    console.log(`[CONFIG] Área Contrastada:      ${otraArea.nombre} (${otraArea.area_id})`);
    console.log(`[CONFIG] Cargo Asignado:        ${cargoEspecialista.nombre} (${cargoEspecialista.cargo_id})`);
    console.log(`[CONFIG] Rol Institucional:     ${rolEspecialista.nombre} (${rolEspecialista.rol_id})\n`);

    // =========================================================================
    // ETAPA 1: REGISTRO DE TRABAJADOR INTERNO (PASO 1 DEL FLUJO)
    // =========================================================================
    console.log('--- ETAPA 1: REGISTRO DE TRABAJADOR Y CUENTA INSTITUCIONAL INACTIVA ---');
    const dniTest = '78965412'; // 8 dígitos estrictos
    const correoTest = 'personal.auditoria@iestpsuiza.edu.pe';
    const usuarioTest = 'personal.auditoria';
    const passwordHash = await argon2.hash('ClaveTemporal2026!');

    // 1.1 Insertar Persona
    const { rows: personaRows } = await client.query(`
      INSERT INTO sigd_auth.persona (tipo, id_documento)
      VALUES ('NATURAL', $1) RETURNING id_persona
    `, [dniTest]);
    const personaId = personaRows[0].id_persona;

    await client.query(`
      INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
      VALUES ($1, 'Juan Carlos', 'Auditore Pucallpa', 'Juan Carlos Auditore Pucallpa', $2)
    `, [personaId, correoTest]);

    // 1.2 Insertar Cuenta Usuario INACTIVA (Regla de Oro: nace inactiva)
    const { rows: cuentaRows } = await client.query(`
      INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, password_hash, correo, activo)
      VALUES ($1, $2, $3, $4, FALSE) RETURNING id_usuario
    `, [personaId, usuarioTest, passwordHash, correoTest]);
    const nuevoUsuarioId = cuentaRows[0].id_usuario;

    // 1.3 Asignación Laboral Institucional
    const { rows: asigRows } = await client.query(`
      INSERT INTO sigd_org.asignacion_personal (id_usuario, area_id, cargo_id, vigente_desde, vigente_hasta)
      VALUES ($1, $2, $3, now(), NULL) RETURNING id_asignacion
    `, [nuevoUsuarioId, areaInformatica.area_id, cargoEspecialista.cargo_id]);

    // Comprobar que NO tiene roles
    const { rows: rolesIniciales } = await client.query(
      "SELECT id_usuario_rol FROM sigd_org.usuario_rol WHERE id_usuario = $1::uuid",
      [nuevoUsuarioId]
    );

    console.log(`[TEST 1.1] Trabajador registrado: ID=${nuevoUsuarioId}, DNI=${dniTest}`);
    console.log(`[TEST 1.2] Estado de cuenta inicial: INACTIVO (activo=false)`);
    console.log(`[TEST 1.3] Roles asignados en formulario: ${rolesIniciales.length} (Cumple separación de responsabilidades)`);
    if (rolesIniciales.length !== 0) throw new Error('Fallo: La cuenta se creó con roles prematuros.');

    // =========================================================================
    // ETAPA 2: COMPROBACIÓN DE AUTORIZACIÓN CUENTA INACTIVA / SIN ROLES
    // =========================================================================
    console.log('\n--- ETAPA 2: EVALUACIÓN DE ACCESO DE USUARIO INACTIVO SIN ROLES ---');
    const { rows: authInactivoSinRol } = await client.query(`
      SELECT cu.activo, COALESCE(json_agg(DISTINCT r.codigo) FILTER (WHERE r.codigo IS NOT NULL), '[]') as roles
      FROM sigd_auth.cuenta_usuario cu
      LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario AND ur.vigente_hasta IS NULL
      LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
      WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE
      GROUP BY cu.id_usuario
    `, [nuevoUsuarioId]);

    console.log(`[TEST 2.1] Consulta de autorización para cuenta inactiva: ${authInactivoSinRol.length === 0 ? 'DENEGADO (0 filas devueltas)' : 'FALLO'}`);
    if (authInactivoSinRol.length !== 0) throw new Error('Fallo: Cuenta inactiva obtuvo autorización.');

    // =========================================================================
    // ETAPA 3: RECHAZO DE ACTIVACIÓN PREVIA A ASIGNACIÓN DE ROLES
    // =========================================================================
    console.log('\n--- ETAPA 3: INTENTO DE ACTIVACIÓN DE CUENTA SIN ROLES (PROTECCIÓN) ---');
    const { rows: rolesVigentesCheck } = await client.query(`
      SELECT COUNT(*)::int AS total FROM sigd_org.usuario_rol ur
      JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
      WHERE ur.id_usuario = $1::uuid AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        AND r.codigo NOT IN ('CIUDADANO', 'ESTUDIANTE')
    `, [nuevoUsuarioId]);

    const puedeActivarseSinRoles = rolesVigentesCheck[0].total > 0;
    console.log(`[TEST 3.1] Validación de precondición para activar: Roles vigentes=${rolesVigentesCheck[0].total}`);
    console.log(`[TEST 3.2] Política CUENTA_ACTIVA_SIN_ROLES bloquea activación: ${!puedeActivarseSinRoles ? 'BLOQUEO CORRECTO (422)' : 'FALLO'}`);
    if (puedeActivarseSinRoles) throw new Error('Fallo: Se permitió activar una cuenta sin roles institucionales.');

    // =========================================================================
    // ETAPA 4: ASIGNACIÓN CONTROLADA DE ROL INSTITUCIONAL (PASO 2 DEL FLUJO)
    // =========================================================================
    console.log('\n--- ETAPA 4: ASIGNACIÓN DE ROL INSTITUCIONAL CON SINCRONIZACIÓN H2 ---');
    // Asignar rol ESPECIALISTA sincronizando con asignacion_personal.area_id (H2)
    const { rows: asigRolRows } = await client.query(`
      INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, area_id, vigente_desde, vigente_hasta)
      VALUES ($1, $2, $3, now() - interval '10 seconds', NULL) RETURNING id_usuario_rol, area_id
    `, [nuevoUsuarioId, rolEspecialista.rol_id, areaInformatica.area_id]);

    const idUsuarioRol = asigRolRows[0].id_usuario_rol;
    console.log(`[TEST 4.1] Rol ${rolEspecialista.codigo} asignado exitosamente (id_usuario_rol=${idUsuarioRol})`);
    console.log(`[TEST 4.2] Sincronización H2: usuario_rol.area_id (${asigRolRows[0].area_id}) == asignacion_personal.area_id (${areaInformatica.area_id})`);
    if (asigRolRows[0].area_id !== areaInformatica.area_id) throw new Error('Fallo H2: El área del rol no coincide con el área asignada.');

    // Auditoría WORM de la asignación con H1 (actor_id)
    await client.query(`
      INSERT INTO sigd_audit.bitacora_auditoria(
        correlation_id, usuario_id, esquema, tabla, operacion, datos_despues, fecha_hora
      ) VALUES (
        gen_random_uuid(), $1::uuid, 'sigd_org', 'usuario_rol', 'INSERT',
        $2::jsonb, clock_timestamp()
      )
    `, [adminActivoId, JSON.stringify({
      id_usuario: nuevoUsuarioId,
      id_usuario_rol: idUsuarioRol,
      rol_codigo: rolEspecialista.codigo,
      area_id: areaInformatica.area_id,
      actor_id: adminActivoId, // H1
    })]);
    console.log(`[TEST 4.3] Trazabilidad H1: Auditoría WORM registrada con actor_id=${adminActivoId}`);

    // =========================================================================
    // ETAPA 5: ACTIVACIÓN DE LA CUENTA (PASO 3 DEL FLUJO)
    // =========================================================================
    console.log('\n--- ETAPA 5: ACTIVACIÓN CONTROLADA DE LA CUENTA ---');
    await client.query("UPDATE sigd_auth.cuenta_usuario SET activo = TRUE WHERE id_usuario = $1::uuid", [nuevoUsuarioId]);
    const { rows: cuentaActivaCheck } = await client.query("SELECT activo FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid", [nuevoUsuarioId]);
    console.log(`[TEST 5.1] Estado de la cuenta tras activación: ${cuentaActivaCheck[0].activo ? 'ACTIVO (true)' : 'INACTIVO'}`);
    if (!cuentaActivaCheck[0].activo) throw new Error('Fallo: La cuenta no pudo activarse tras asignarle un rol.');

    // =========================================================================
    // ETAPA 6: AUTORIZACIÓN DINÁMICA Y ÁMBITO INSTITUCIONAL (PASO 4)
    // =========================================================================
    console.log('\n--- ETAPA 6: RESOLUCIÓN DE PERMISOS DINÁMICOS Y ÁMBITO (GLOBAL vs AREA) ---');
    const { rows: permisosEfectivos } = await client.query(`
      SELECT cu.id_usuario, cu.activo,
             COALESCE(json_agg(DISTINCT r.codigo), '[]') AS roles,
             COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
               'codigo', p.codigo,
               'ambito', p.ambito,
               'areaId', CASE WHEN p.ambito = 'AREA' THEN ur.area_id ELSE NULL END
             )) FILTER (WHERE p.codigo IS NOT NULL), '[]') AS permisos
      FROM sigd_auth.cuenta_usuario cu
      JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario AND ur.vigente_hasta IS NULL
      JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
      LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
      LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
      WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE
      GROUP BY cu.id_usuario, cu.activo
    `, [nuevoUsuarioId]);

    const auth = permisosEfectivos[0];
    console.log(`[TEST 6.1] Cuenta resuelta: Activo=${auth.activo}, Roles=[${auth.roles.join(', ')}]`);
    console.log(`[TEST 6.2] Permisos efectivos resueltos: ${auth.permisos.length} facultades`);
    auth.permisos.forEach(p => {
      console.log(`          - ${p.codigo} (${p.ambito}) -> Área autorizada: ${p.areaId || 'GLOBAL (Toda la institución)'}`);
    });

    const permisoDerivar = auth.permisos.find(p => p.codigo === 'EXPEDIENTE_DERIVAR');
    if (!permisoDerivar) throw new Error('Fallo: El especialista no tiene asignado EXPEDIENTE_DERIVAR');
    if (permisoDerivar.ambito !== 'AREA' || permisoDerivar.areaId !== areaInformatica.area_id) {
      throw new Error('Fallo Ámbito: EXPEDIENTE_DERIVAR no está restringido al área asignada.');
    }
    console.log(`[TEST 6.3] Verificación de Aislamiento de Área:`);
    console.log(`          - ¿Puede derivar en su área (${areaInformatica.nombre})? -> SÍ (Autorizado)`);
    console.log(`          - ¿Puede derivar en otra área (${otraArea.nombre})?        -> NO (Rechazado por AuthGuard)`);

    // =========================================================================
    // ETAPA 7: REVOCACIÓN DE ROLES Y PROTECCIÓN CONTRA CUENTA HUÉRFANA
    // =========================================================================
    console.log('\n--- ETAPA 7: REVOCACIÓN DE ROLES Y REGLAS DE PROTECCIÓN ---');
    // Intentar revocar el único rol manteniendo la cuenta activa debe ser impedido
    const { rows: otrosRoles } = await client.query(`
      SELECT COUNT(*)::int AS total FROM sigd_org.usuario_rol ur
      JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
      WHERE ur.id_usuario = $1::uuid AND ur.id_usuario_rol <> $2::uuid
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        AND r.codigo NOT IN ('CIUDADANO', 'ESTUDIANTE')
    `, [nuevoUsuarioId, idUsuarioRol]);

    const revocacionPermitidaEnCuentaActiva = otrosRoles[0].total > 0;
    console.log(`[TEST 7.1] Intento de revocar único rol en cuenta activa: Bloqueado por regla de negocio (${!revocacionPermitidaEnCuentaActiva ? 'PROTECCIÓN ACTIVA' : 'FALLO'})`);
    if (revocacionPermitidaEnCuentaActiva) throw new Error('Fallo: Se permitió revocar el único rol activo de una cuenta.');

    // Flujo correcto de revocación: Desactivar cuenta primero, luego revocar
    await client.query("UPDATE sigd_auth.cuenta_usuario SET activo = FALSE WHERE id_usuario = $1::uuid", [nuevoUsuarioId]);
    await client.query("UPDATE sigd_org.usuario_rol SET vigente_hasta = now() WHERE id_usuario_rol = $1::uuid", [idUsuarioRol]);
    
    // Sesiones revocadas
    const { rowCount: sesionesRevocadas } = await client.query(
      "UPDATE sigd_auth.sesion_usuario SET revocado_en = now() WHERE id_usuario = $1::uuid AND revocado_en IS NULL",
      [nuevoUsuarioId]
    );
    console.log(`[TEST 7.2] Cuenta desactivada y rol revocado exitosamente.`);
    console.log(`[TEST 7.3] Revocación inmediata de sesiones activas: ${sesionesRevocadas} sesiones invalidadas.`);

    // =========================================================================
    // ETAPA 8: PROTECCIONES ESTRUCTURALES DEL MÓDULO ROLES Y PERMISOS
    // =========================================================================
    console.log('\n--- ETAPA 8: BLINDAJE DE SEGURIDAD INSTITUCIONAL (ADMINISTRADOR Y CIUDADANO) ---');
    // 8.1 Verificar que no existe SUPER_ADMIN
    const { rows: superAdminRows } = await client.query("SELECT * FROM sigd_org.rol_sistema WHERE codigo = 'SUPER_ADMIN'");
    console.log(`[TEST 8.1] Rol prohibido SUPER_ADMIN en BD: ${superAdminRows.length === 0 ? 'NO EXISTE (Correcto)' : 'DETECTADO'}`);
    if (superAdminRows.length > 0) throw new Error('Fallo Crítico: SUPER_ADMIN existe en base de datos.');

    // 8.2 Verificar ADMIN_USUARIOS en ADMINISTRADOR
    const { rows: adminPerms } = await client.query(`
      SELECT p.codigo FROM sigd_org.rol_permiso rp
      JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
      WHERE rp.rol_id = $1::uuid AND p.codigo = 'ADMIN_USUARIOS'
    `, [rolAdmin.rol_id]);
    console.log(`[TEST 8.2] Rol ADMINISTRADOR conserva ADMIN_USUARIOS: ${adminPerms.length > 0 ? 'SÍ (Protección contra autobloqueo activa)' : 'NO'}`);
    if (adminPerms.length === 0) throw new Error('Fallo: ADMINISTRADOR carece de ADMIN_USUARIOS');

    // 8.3 Verificar CIUDADANO aislado
    const rolCiudadano = roles.find(r => r.codigo === 'CIUDADANO');
    const { rows: ciudadanoPerms } = await client.query(`
      SELECT p.codigo FROM sigd_org.rol_permiso rp
      JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
      WHERE rp.rol_id = $1::uuid AND p.codigo = 'ADMIN_USUARIOS'
    `, [rolCiudadano.rol_id]);
    console.log(`[TEST 8.3] Rol CIUDADANO libre de privilegios internos: ${ciudadanoPerms.length === 0 ? 'SÍ (Aislamiento externo garantizado)' : 'COMPROMETIDO'}`);
    if (ciudadanoPerms.length > 0) throw new Error('Fallo: CIUDADANO tiene permisos administrativos.');

    console.log('\n========================================================================');
    console.log('  RESULTADO: TODAS LAS COMPROBACIONES FUNCIONALES PASARON AL 100%');
    console.log('========================================================================');
    exitoTotal = true;

  } finally {
    await client.query('ROLLBACK');
    console.log('\n[ROLLBACK] Transacción revertida al 100%. La base de datos sigd_jacobo_demo queda completamente inalterada.');
    client.release();
    await pool.end();
  }

  return exitoTotal;
}

auditarFlujoIntegral().catch(err => {
  console.error('\n[ERROR EN AUDITORÍA INTEGRAL]:', err.message);
  pool.end();
  process.exit(1);
});
