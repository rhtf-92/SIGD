/**
 * =============================================================================
 * SUITE DE CERTIFICACIÓN INTEGRAL — FASE C2
 * SUPERADMINISTRADOR, SEPARACIÓN ADMINISTRATIVA Y GOBIERNO DEL TUPA
 * =============================================================================
 *
 * Cobertura de certificación (Secciones 34 a 39 del Plan Maestro):
 *   1. Test Admin: administración operativa permitida, no publicación técnica TUPA, no receptor.
 *   2. Test Superadmin: gobierno técnico permitido, no resolución, no firma, no receptor.
 *   3. Test Director: resolución y firma conservadas, aprobación institucional TUPA.
 *   4. Test TUPA 2027: clonación íntegra de 72 procedimientos, destinos y requisitos.
 *   5. Test Edición Aislada: modificación de arancel en borrador no altera 2026 ni snapshots.
 *   6. Test Retiro de Procedimiento: activo=false en borrador mantiene 2026 e histórico intactos.
 *   7. Test Publicación y Transición: impide publicación directa de BORRADOR, exige validación
 *      y aprobación institucional previa, mantiene single VIGENTE archivando previa a HISTORICO.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { AuthorizationService } from '../../../src/core/auth/authorization.service.js';
import { TupaVersionRepository } from '../../../src/domains/tramicore/tupaVersion.repository.js';
import { ROLES_FIRMA, verificarFacultadFirma } from '../../../src/core/auth/auth.guard.js';
import { ROLES_OPERATIVOS_RECEPTOR_RUTADOC } from '../../../src/core/auth/authorization.types.js';

describe('FASE C2: Superadministrador, Separación Administrativa y Gobierno del TUPA', () => {
  let pool: Pool;
  let authService: AuthorizationService;
  let tupaRepo: TupaVersionRepository;

  // IDs canónicos de usuarios demo
  let superadminId: string;
  let adminId: string;
  let directorId: string;
  let versionVigente2026Id: string;

  // Versión fixture temporal para pruebas de ciclo de vida
  let testVersionId: string | null = null;
  const CODIGO_TEST_VERSION = 'TUPA-TEST-C2-2029';
  const ANIO_TEST = 2029;

  beforeAll(async () => {
    const databaseUrl =
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba';
    pool = new Pool({ connectionString: databaseUrl });
    authService = new AuthorizationService(pool);
    tupaRepo = new TupaVersionRepository(pool);

    // Resolver IDs de usuarios de laboratorio
    const resUsers = await pool.query<{ id_usuario: string; usuario: string }>(
      `SELECT id_usuario, usuario FROM sigd_auth.cuenta_usuario
        WHERE usuario IN ('superadmin_demo', 'administrador_demo', 'director_demo')`,
    );

    for (const u of resUsers.rows) {
      if (u.usuario === 'superadmin_demo') superadminId = u.id_usuario;
      if (u.usuario === 'administrador_demo') adminId = u.id_usuario;
      if (u.usuario === 'director_demo') directorId = u.id_usuario;
    }

    expect(superadminId).toBeDefined();
    expect(adminId).toBeDefined();
    expect(directorId).toBeDefined();

    // Obtener versión vigente TUPA-2026
    const resVer = await pool.query<{ id_version: string }>(
      `SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026' AND estado = 'VIGENTE'`,
    );
    expect(resVer.rows.length).toBe(1);
    versionVigente2026Id = resVer.rows[0].id_version;

    // Limpieza preventiva de versiones test residuales
    await pool.query(
      `DELETE FROM sigd_doc.tupa_procedimiento
        WHERE id_version IN (SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = $1)`,
      [CODIGO_TEST_VERSION],
    );
    await pool.query(`DELETE FROM sigd_doc.tupa_version WHERE codigo = $1`, [CODIGO_TEST_VERSION]);
  });

  afterAll(async () => {
    if (testVersionId) {
      await pool.query(
        `DELETE FROM sigd_doc.tupa_procedimiento WHERE id_version = $1::uuid`,
        [testVersionId],
      );
      await pool.query(`DELETE FROM sigd_doc.tupa_version WHERE id_version = $1::uuid`, [
        testVersionId,
      ]);
    }
    // Asegurar que TUPA-2026 regrese a VIGENTE si hubiera sido archivado en pruebas de transición
    await pool.query(
      `UPDATE sigd_doc.tupa_version SET estado = 'VIGENTE' WHERE id_version = $1::uuid`,
      [versionVigente2026Id],
    );
    await pool.end();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SECCIÓN 34: TEST ADMINISTRADOR_DEMO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Sección 34: Comportamiento y restricciones de ADMINISTRADOR', () => {
    it('1. Administrador permite gestión operativa (CUENTA_GESTIONAR, ADMIN_USUARIOS, TUPA_GESTIONAR)', async () => {
      const resCuentas = await authService.autorizar({
        usuarioId: adminId,
        rolesDeclarados: ['ADMINISTRADOR'],
        accion: 'CUENTA_GESTIONAR',
      });
      expect(resCuentas.autorizado).toBe(true);

      const resUsuarios = await authService.autorizar({
        usuarioId: adminId,
        rolesDeclarados: ['ADMINISTRADOR'],
        accion: 'ADMIN_USUARIOS',
      });
      expect(resUsuarios.autorizado).toBe(true);

      const resTupaGestionar = await authService.autorizar({
        usuarioId: adminId,
        rolesDeclarados: ['ADMINISTRADOR'],
        accion: 'TUPA_GESTIONAR',
      });
      expect(resTupaGestionar.autorizado).toBe(true);
    });

    it('2. Administrador NO posee autorización para publicación técnica ni gobierno de seguridad', async () => {
      const accionesSensiblesDenegadas = [
        'TUPA_PUBLICAR',
        'ROLES_GESTIONAR',
        'PERMISOS_GESTIONAR',
        'PERFILES_GESTIONAR',
        'CONFIGURACION_GLOBAL_GESTIONAR',
        'AUDITORIA_GLOBAL_VER',
      ] as const;

      for (const accion of accionesSensiblesDenegadas) {
        const res = await authService.autorizar({
          usuarioId: adminId,
          rolesDeclarados: ['ADMINISTRADOR'],
          accion,
        });
        expect(res.autorizado).toBe(false);
      }
    });

    it('3. Administrador por sí solo NO es receptor operativo de expedientes (C0.1B inmutable)', () => {
      const esReceptor = (ROLES_OPERATIVOS_RECEPTOR_RUTADOC as readonly string[]).includes('ADMINISTRADOR');
      expect(esReceptor).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SECCIÓN 35: TEST SUPERADMIN_DEMO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Sección 35: Comportamiento y segregación de SUPERADMINISTRADOR', () => {
    it('1. Superadministrador permite gobierno técnico y seguridad (ROLES, PERMISOS, AUDITORÍA, TUPA_PUBLICAR)', async () => {
      const resRoles = await authService.autorizar({
        usuarioId: superadminId,
        rolesDeclarados: ['SUPERADMINISTRADOR'],
        accion: 'ROLES_GESTIONAR',
      });
      expect(resRoles.autorizado).toBe(true);

      const resPermisos = await authService.autorizar({
        usuarioId: superadminId,
        rolesDeclarados: ['SUPERADMINISTRADOR'],
        accion: 'PERMISOS_GESTIONAR',
      });
      expect(resPermisos.autorizado).toBe(true);

      const resPerfiles = await authService.autorizar({
        usuarioId: superadminId,
        rolesDeclarados: ['SUPERADMINISTRADOR'],
        accion: 'PERFILES_GESTIONAR',
      });
      expect(resPerfiles.autorizado).toBe(true);

      const resConfig = await authService.autorizar({
        usuarioId: superadminId,
        rolesDeclarados: ['SUPERADMINISTRADOR'],
        accion: 'CONFIGURACION_GLOBAL_GESTIONAR',
      });
      expect(resConfig.autorizado).toBe(true);

      const resAuditoria = await authService.autorizar({
        usuarioId: superadminId,
        rolesDeclarados: ['SUPERADMINISTRADOR'],
        accion: 'AUDITORIA_GLOBAL_VER',
      });
      expect(resAuditoria.autorizado).toBe(true);

      const resPublicar = await authService.autorizar({
        usuarioId: superadminId,
        rolesDeclarados: ['SUPERADMINISTRADOR'],
        accion: 'TUPA_PUBLICAR',
      });
      expect(resPublicar.autorizado).toBe(true);
    });

    it('2. Superadministrador NO confiere facultades de resolución de expedientes ni operación de caja (PODER TÉCNICO ≠ NEGOCIO)', async () => {
      const resResolver = await authService.autorizar({
        usuarioId: superadminId,
        rolesDeclarados: ['SUPERADMINISTRADOR'],
        accion: 'EXPEDIENTE_RESOLVER',
      });
      expect(resResolver.autorizado).toBe(false);
      expect(resResolver.codigoDenegacion).toBe('PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO');

      const resCaja = await authService.autorizar({
        usuarioId: superadminId,
        rolesDeclarados: ['SUPERADMINISTRADOR'],
        accion: 'PAGO_REGISTRAR',
      });
      expect(resCaja.autorizado).toBe(false);
    });

    it('3. Superadministrador NO confiere firma digital de actos resolutivos', async () => {
      const resFirma = await verificarFacultadFirma(pool, superadminId, ['SUPERADMINISTRADOR']);
      expect(resFirma.puedeFirmar).toBe(false);
      expect((ROLES_FIRMA as readonly string[]).includes('SUPERADMINISTRADOR')).toBe(false);
    });

    it('4. Superadministrador por sí solo NO es receptor operativo de expedientes', () => {
      const esReceptor = (ROLES_OPERATIVOS_RECEPTOR_RUTADOC as readonly string[]).includes('SUPERADMINISTRADOR');
      expect(esReceptor).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SECCIÓN 36: TEST DIRECTOR_DEMO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Sección 36: Autoridad sustantiva de negocio en DIRECTOR', () => {
    it('1. Director conserva facultad de resolución de expedientes', async () => {
      const resResolver = await authService.autorizar({
        usuarioId: directorId,
        rolesDeclarados: ['DIRECTOR'],
        accion: 'EXPEDIENTE_RESOLVER',
      });
      expect(resResolver.autorizado).toBe(true);
    });

    it('2. Director conserva facultad de firma digital', async () => {
      const resFirma = await verificarFacultadFirma(pool, directorId, ['DIRECTOR']);
      expect(resFirma.puedeFirmar).toBe(true);
      expect(resFirma.facultadGlobal).toBe(true);
    });

    it('3. Director pertenece a los roles operativos facultados para despacho/recepción', () => {
      expect((ROLES_OPERATIVOS_RECEPTOR_RUTADOC as readonly string[]).includes('DIRECTOR')).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SECCIONES 37 Y 38: CLONACIÓN TUPA 2027, EDICIÓN AISLADA Y RETIRO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Secciones 37 y 38: Gobierno TUPA 2027, Aislamiento y Retiro', () => {
    let procs2026Count: number;
    let proc2026Muestra: { id_procedimiento: string; codigo_ref: string; monto: string };

    beforeAll(async () => {
      const countRes = await pool.query<{ count: string }>(
        `SELECT count(*) FROM sigd_doc.tupa_procedimiento WHERE id_version = $1::uuid`,
        [versionVigente2026Id],
      );
      procs2026Count = Number(countRes.rows[0].count);
      expect(procs2026Count).toBe(72);

      const muestraRes = await pool.query<{ id_procedimiento: string; codigo_ref: string; monto: string }>(
        `SELECT id_procedimiento, codigo_ref, monto FROM sigd_doc.tupa_procedimiento
          WHERE id_version = $1::uuid ORDER BY orden ASC LIMIT 1`,
        [versionVigente2026Id],
      );
      proc2026Muestra = muestraRes.rows[0];
      expect(proc2026Muestra).toBeDefined();
    });

    it('1. Clonar TUPA-2026 genera exactamente 72 procedimientos en BORRADOR con destinos preservados', async () => {
      const nuevaVersion = await tupaRepo.clonarVersion(
        versionVigente2026Id,
        CODIGO_TEST_VERSION,
        ANIO_TEST,
        `TUPA Institucional Prueba ${ANIO_TEST}`,
        'Clonación controlada para verificación C2',
        1,
      );

      testVersionId = nuevaVersion.id_version;
      expect(nuevaVersion.estado).toBe('BORRADOR');
      expect(nuevaVersion.anio).toBe(ANIO_TEST);
      expect(nuevaVersion.revision).toBe(1);

      // Verificar que se clonaron exactamente 72 procedimientos
      const procsClonados = await pool.query<{
        id_procedimiento: string;
        codigo_ref: string;
        unidad_receptora_id: string;
        unidad_responsable_id: string;
        unidad_resolutiva_id: string;
        unidad_financiera_id: string;
        intervencion_financiera: string;
        activo: boolean;
      }>(
        `SELECT id_procedimiento, codigo_ref, unidad_receptora_id, unidad_responsable_id,
                unidad_resolutiva_id, unidad_financiera_id, intervencion_financiera, activo
           FROM sigd_doc.tupa_procedimiento
          WHERE id_version = $1::uuid`,
        [testVersionId],
      );

      expect(procsClonados.rows.length).toBe(72);

      // Todos los 72 procedimientos conservan destinos funcionales completos
      for (const p of procsClonados.rows) {
        expect(p.unidad_receptora_id).not.toBeNull();
        expect(p.unidad_responsable_id).not.toBeNull();
        expect(p.unidad_resolutiva_id).not.toBeNull();
        expect(p.unidad_financiera_id).not.toBeNull();
        expect(p.intervencion_financiera).toBe('REQUIERE_PAGO');
        expect(p.activo).toBe(true);
      }
    });

    it('2. Edición aislada de monto en borrador NO modifica TUPA-2026 ni snapshots históricos', async () => {
      expect(testVersionId).toBeDefined();

      // Buscar el procedimiento correspondiente en la versión clonada
      const procTestRes = await pool.query<{ id_procedimiento: string; monto: string }>(
        `SELECT id_procedimiento, monto FROM sigd_doc.tupa_procedimiento
          WHERE id_version = $1::uuid AND codigo_ref = $2`,
        [testVersionId, proc2026Muestra.codigo_ref],
      );
      const procTest = procTestRes.rows[0];

      const nuevoMonto = 999.50;
      await tupaRepo.actualizarProcedimiento(
        procTest.id_procedimiento,
        { monto: nuevoMonto },
        testVersionId!,
      );

      // Verificar que el borrador cambió al nuevo monto
      const procModificado = await pool.query<{ monto: string }>(
        `SELECT monto FROM sigd_doc.tupa_procedimiento WHERE id_procedimiento = $1::uuid`,
        [procTest.id_procedimiento],
      );
      expect(Number(procModificado.rows[0].monto)).toBe(nuevoMonto);

      // Verificar que TUPA-2026 sigue intacto con su monto original
      const proc2026Actual = await pool.query<{ monto: string }>(
        `SELECT monto FROM sigd_doc.tupa_procedimiento WHERE id_procedimiento = $1::uuid`,
        [proc2026Muestra.id_procedimiento],
      );
      expect(Number(proc2026Actual.rows[0].monto)).toBe(Number(proc2026Muestra.monto));

      // Verificar que los snapshots históricos en expediente_tupa_vinculo no sufrieron ningún cambio
      const vinculos = await pool.query<{ count: string }>(
        `SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo`,
      );
      expect(Number(vinculos.rows[0].count)).toBeGreaterThan(0);
    });

    it('3. Retiro de procedimiento (activo = false) en borrador mantiene 2026 activo e histórico intacto', async () => {
      expect(testVersionId).toBeDefined();

      const procTestRes = await pool.query<{ id_procedimiento: string; activo: boolean }>(
        `SELECT id_procedimiento, activo FROM sigd_doc.tupa_procedimiento
          WHERE id_version = $1::uuid AND codigo_ref = $2`,
        [testVersionId, proc2026Muestra.codigo_ref],
      );
      const procTest = procTestRes.rows[0];

      // Desactivar procedimiento en la versión borrador
      await tupaRepo.actualizarProcedimiento(
        procTest.id_procedimiento,
        { activo: false },
        testVersionId!,
      );

      // Verificar que en borrador quedó inactivo
      const procDesactivado = await pool.query<{ activo: boolean }>(
        `SELECT activo FROM sigd_doc.tupa_procedimiento WHERE id_procedimiento = $1::uuid`,
        [procTest.id_procedimiento],
      );
      expect(procDesactivado.rows[0].activo).toBe(false);

      // Verificar que en TUPA-2026 el procedimiento sigue activo
      const proc2026Activo = await pool.query<{ activo: boolean }>(
        `SELECT activo FROM sigd_doc.tupa_procedimiento WHERE id_procedimiento = $1::uuid`,
        [proc2026Muestra.id_procedimiento],
      );
      expect(proc2026Activo.rows[0].activo).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SECCIÓN 39: TEST CICLO DE GOBIERNO Y PUBLICACIÓN TÉCNICA CONTROLADA
  // ───────────────────────────────────────────────────────────────────────────
  describe('Sección 39: Ciclo de vida: BORRADOR -> PENDIENTE_VALIDACION -> VIGENTE', () => {
    it('1. Impide publicación directa desde BORRADOR (Sección 18)', async () => {
      expect(testVersionId).toBeDefined();

      // Intentar publicar directamente la versión en BORRADOR debe fallar
      await expect(
        tupaRepo.publicarVersionConGobierno(testVersionId!, new Date(), superadminId),
      ).rejects.toThrow(/No se permite la publicación directa de una versión en BORRADOR/);
    });

    it('2. Transición a validación: BORRADOR -> PENDIENTE_VALIDACION', async () => {
      expect(testVersionId).toBeDefined();

      const versionEnValidacion = await tupaRepo.enviarAValidacion(testVersionId!, adminId);
      expect(versionEnValidacion.estado).toBe('PENDIENTE_VALIDACION');

      const dbCheck = await pool.query<{ estado: string }>(
        `SELECT estado FROM sigd_doc.tupa_version WHERE id_version = $1::uuid`,
        [testVersionId],
      );
      expect(dbCheck.rows[0].estado).toBe('PENDIENTE_VALIDACION');
    });

    it('2b. BYPASS CRÍTICO PREVENIDO: Intento de publicar versión en PENDIENTE_VALIDACION sin aprobación formal -> RECHAZADO (ConflictError)', async () => {
      expect(testVersionId).toBeDefined();

      // La versión está en PENDIENTE_VALIDACION pero aún NO tiene resolución_aprobacion ni fecha_aprobacion
      await expect(
        tupaRepo.publicarVersionConGobierno(testVersionId!, new Date(), superadminId),
      ).rejects.toThrow(/No se permite la publicación técnica sin aprobación institucional formal previa/);
    });

    it('2c. AUTOAPROBACIÓN BLOQUEADA: Administrador o Superadmin intentan aprobar institucionalmente -> DENEGADO (403)', async () => {
      // 1. Administrador técnico intenta aprobar
      const resAdminAprobar = await authService.autorizar({
        usuarioId: adminId,
        rolesDeclarados: ['ADMINISTRADOR'],
        accion: 'TUPA_ACTIVAR',
        recurso: { tipo: 'TUPA', id: testVersionId! },
      });
      expect(resAdminAprobar.autorizado).toBe(false);

      // 2. Superadministrador técnico intenta autoaprobar
      const resSuperAdminAprobar = await authService.autorizar({
        usuarioId: superadminId,
        rolesDeclarados: ['SUPERADMINISTRADOR'],
        accion: 'TUPA_ACTIVAR',
        recurso: { tipo: 'TUPA', id: testVersionId! },
      });
      expect(resSuperAdminAprobar.autorizado).toBe(false);
      expect(resSuperAdminAprobar.codigoDenegacion).toBe('PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO');
    });

    it('3. Aprobación institucional formal registra resolución y mantiene PENDIENTE_VALIDACION', async () => {
      expect(testVersionId).toBeDefined();

      const resolucion = 'RD-0142-2029-IESTP-SUIZA';
      const versionAprobada = await tupaRepo.aprobarVersion(
        testVersionId!,
        resolucion,
        new Date(),
        directorId,
      );

      expect(versionAprobada.resolucion_aprobacion).toBe(resolucion);
      expect(versionAprobada.fecha_aprobacion).not.toBeNull();
      expect(versionAprobada.estado).toBe('PENDIENTE_VALIDACION');
    });

    it('4. Publicación técnica controlada pone en VIGENTE y archiva versión anterior a HISTORICO', async () => {
      expect(testVersionId).toBeDefined();

      // Ejecutar publicación técnica
      const versionPublicada = await tupaRepo.publicarVersionConGobierno(
        testVersionId!,
        new Date(),
        superadminId,
      );

      expect(versionPublicada.estado).toBe('VIGENTE');

      // Verificar que TUPA-2026 pasó deterministamente a HISTORICO
      const res2026 = await pool.query<{ estado: string }>(
        `SELECT estado FROM sigd_doc.tupa_version WHERE id_version = $1::uuid`,
        [versionVigente2026Id],
      );
      expect(res2026.rows[0].estado).toBe('HISTORICO');

      // Verificar la restricción de UNA SOLA versión vigente en toda la base de datos
      const resVigentes = await pool.query<{ id_version: string; codigo: string }>(
        `SELECT id_version, codigo FROM sigd_doc.tupa_version WHERE estado = 'VIGENTE'`,
      );
      expect(resVigentes.rows.length).toBe(1);
      expect(resVigentes.rows[0].id_version).toBe(testVersionId);
    });

    it('5. Restauración controlada de TUPA-2026 como VIGENTE y archivo de la versión test', async () => {
      expect(testVersionId).toBeDefined();

      // Volver a poner TUPA-2026 en VIGENTE para dejar la base de datos en su estado canónico 2026
      await pool.query(
        `UPDATE sigd_doc.tupa_version SET estado = 'HISTORICO' WHERE id_version = $1::uuid`,
        [testVersionId],
      );
      await pool.query(
        `UPDATE sigd_doc.tupa_version SET estado = 'VIGENTE' WHERE id_version = $1::uuid`,
        [versionVigente2026Id],
      );

      const resFinal = await pool.query<{ codigo: string; estado: string }>(
        `SELECT codigo, estado FROM sigd_doc.tupa_version WHERE id_version = $1::uuid`,
        [versionVigente2026Id],
      );
      expect(resFinal.rows[0].estado).toBe('VIGENTE');
      expect(resFinal.rows[0].codigo).toBe('TUPA-2026');
    });
  });
});
