import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { construirApp } from '../../../src/app.js';
import { EnrutabilidadService } from '../../../src/domains/rutadoc/enrutabilidad.service.js';
import { ExpedienteAsignacionService } from '../../../src/domains/rutadoc/expedienteAsignacion.service.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';

describe('C0.1 — Certificación de Integración Física: Enrutabilidad y Asignación Operativa', () => {
  let pool: Pool;
  let app: any;
  let enrutabilidadService: EnrutabilidadService;
  let asignacionService: ExpedienteAsignacionService;

  const idsCreados = {
    areas: new Set<string>(),
    cargos: new Set<string>(),
    personas: new Set<string>(),
    cuentas: new Set<string>(),
    vinculos: new Set<string>(),
    asignacionesPersonal: new Set<string>(),
    usuarioRoles: new Set<string>(),
    expedientes: new Set<string>(),
    expedienteAsignaciones: new Set<string>(),
    asignacionesPerfiles: new Set<string>(),
    perfilesOperativos: new Set<number>(),
    perfilPermisos: new Set<string>(),
  };

  let tokenOperador: string;
  let usuarioOperadorId: string;
  let personaOperadorId: string;
  let tipoDocId: string;

  beforeAll(async () => {
    process.env.AUTH_JWT_SECRET =
      process.env.AUTH_JWT_SECRET || 'unit-test-secret-not-for-production-min32chars';

    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });

    const connTest = await pool.query('SELECT current_database(), current_user');
    expect(connTest.rows[0].current_database).toBe('sigd_prueba');

    enrutabilidadService = new EnrutabilidadService(pool);
    asignacionService = new ExpedienteAsignacionService(pool);
    app = construirApp(pool);

    const tdRes = await pool.query<{ tipo_documental_id: string }>(
      'SELECT tipo_documental_id FROM sigd_doc.tipo_documento LIMIT 1',
    );
    tipoDocId = tdRes.rows[0]?.tipo_documental_id;

    // Usuario operador para peticiones HTTP
    usuarioOperadorId = randomUUID();
    personaOperadorId = randomUUID();
    const dni = String(Math.floor(10000000 + Math.random() * 90000000));

    await pool.query(
      `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento, creado_en)
       VALUES ($1, 'NATURAL', $2, now())`,
      [personaOperadorId, dni],
    );
    idsCreados.personas.add(personaOperadorId);

    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
       VALUES ($1, 'Operador', 'C0', 'Operador C0', 'operador_c0@test.pe')`,
      [personaOperadorId],
    );

    await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo, creado_en)
       VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_for_test', true, now())`,
      [usuarioOperadorId, personaOperadorId, `operador_c0_${Date.now()}`, 'operador_c0@test.pe'],
    );
    idsCreados.cuentas.add(usuarioOperadorId);

    tokenOperador = firmarTokenAcceso({
      sub: usuarioOperadorId,
      roles: ['ADMINISTRADOR', 'MESA_PARTES'],
    });
  });

  afterAll(async () => {
    // Limpieza segura en orden inverso de dependencias
    const client = await pool.connect();
    try {
      await client.query("SET session_replication_role = 'replica';");

      if (idsCreados.asignacionesPerfiles.size > 0) {
        const arr = Array.from(idsCreados.asignacionesPerfiles);
        await client.query('DELETE FROM sigd_org.asignacion_perfil_operativo WHERE id_asignacion_perfil = ANY($1::uuid[])', [arr]);
      }
      if (idsCreados.perfilesOperativos.size > 0) {
        const arr = Array.from(idsCreados.perfilesOperativos);
        await client.query('DELETE FROM sigd_org.perfil_permiso WHERE perfil_id = ANY($1::smallint[])', [arr]);
        await client.query('DELETE FROM sigd_org.perfil_operativo WHERE perfil_id = ANY($1::smallint[])', [arr]);
      }
      if (idsCreados.expedienteAsignaciones.size > 0) {
        const arr = Array.from(idsCreados.expedienteAsignaciones);
        await client.query('DELETE FROM sigd_rut.expediente_asignacion WHERE id_asignacion = ANY($1::uuid[])', [arr]);
      }
      if (idsCreados.expedientes.size > 0) {
        const arr = Array.from(idsCreados.expedientes);
        await client.query('DELETE FROM sigd_rut.estado_actual_expediente WHERE expediente_id = ANY($1::uuid[])', [arr]);
        await client.query('DELETE FROM sigd_rut.movimiento_tramite WHERE expediente_id = ANY($1::uuid[])', [arr]);
        await client.query('DELETE FROM sigd_tra.expediente WHERE expediente_id = ANY($1::uuid[])', [arr]);
      }
      if (idsCreados.asignacionesPersonal.size > 0) {
        const arr = Array.from(idsCreados.asignacionesPersonal);
        await client.query('DELETE FROM sigd_org.asignacion_personal WHERE id_asignacion = ANY($1::uuid[])', [arr]);
      }
      if (idsCreados.usuarioRoles.size > 0) {
        const arr = Array.from(idsCreados.usuarioRoles);
        await client.query('DELETE FROM sigd_org.usuario_rol WHERE id_usuario_rol = ANY($1::uuid[])', [arr]);
      }
      if (idsCreados.vinculos.size > 0) {
        const arr = Array.from(idsCreados.vinculos);
        await client.query('DELETE FROM sigd_auth.vinculo_institucional WHERE id_vinculo = ANY($1::uuid[])', [arr]);
      }
      if (idsCreados.cuentas.size > 0) {
        const arr = Array.from(idsCreados.cuentas);
        await client.query('DELETE FROM sigd_auth.cuenta_usuario WHERE id_usuario = ANY($1::uuid[])', [arr]);
      }
      if (idsCreados.personas.size > 0) {
        const arr = Array.from(idsCreados.personas);
        await client.query('DELETE FROM sigd_auth.persona_natural WHERE id_persona = ANY($1::uuid[])', [arr]);
        await client.query('DELETE FROM sigd_auth.persona WHERE id_persona = ANY($1::uuid[])', [arr]);
      }
      if (idsCreados.cargos.size > 0) {
        const arr = Array.from(idsCreados.cargos);
        await client.query('DELETE FROM sigd_org.cargo WHERE cargo_id = ANY($1::uuid[])', [arr]);
      }
      if (idsCreados.areas.size > 0) {
        const arr = Array.from(idsCreados.areas);
        await client.query('DELETE FROM sigd_org.area WHERE area_id = ANY($1::uuid[])', [arr]);
      }
    } finally {
      await client.query("SET session_replication_role = 'origin';").catch(() => {});
      client.release();
      await pool.end();
    }
  });

  describe('1. EnrutabilidadService — Evaluación física de áreas contra PostgreSQL 18.6', () => {
    it('TC-C01-01: Área no existente debe evaluarse como DESTINO_INEXISTENTE sin errores DDL', async () => {
      const nonExistent = randomUUID();
      const resultado = await enrutabilidadService.evaluarEnrutabilidadArea(nonExistent);

      expect(resultado.existe).toBe(false);
      expect(resultado.vigente).toBe(false);
      expect(resultado.enrutable).toBe(false);
      expect(resultado.receptoresOperativos).toBe(0);
      expect(resultado.motivo).toBe('DESTINO_INEXISTENTE');
    });

    it('TC-C01-02: Área dada de baja (vigente = false) debe evaluarse como DESTINO_INACTIVO', async () => {
      const areaInactivaId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.area (area_id, codigo, nombre, nivel, vigente, creado_en, tipo_unidad)
         VALUES ($1, $2, 'Área Cerrada Temporal', 1, false, now(), 'UNIDAD')`,
        [areaInactivaId, `INACT_${Date.now().toString().slice(-6)}`],
      );
      idsCreados.areas.add(areaInactivaId);

      const resultado = await enrutabilidadService.evaluarEnrutabilidadArea(areaInactivaId);
      expect(resultado.existe).toBe(true);
      expect(resultado.vigente).toBe(false);
      expect(resultado.enrutable).toBe(false);
      expect(resultado.motivo).toBe('DESTINO_INACTIVO');
    });

    it('TC-C01-03: Área activa pero sin personal operativo debe evaluarse como AREA_NO_ENRUTABLE', async () => {
      const areaDesiertaId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.area (area_id, codigo, nombre, nivel, vigente, creado_en, tipo_unidad)
         VALUES ($1, $2, 'Área Desierta Sin Receptores', 1, true, now(), 'UNIDAD')`,
        [areaDesiertaId, `DES_${Date.now().toString().slice(-6)}`],
      );
      idsCreados.areas.add(areaDesiertaId);

      const resultado = await enrutabilidadService.evaluarEnrutabilidadArea(areaDesiertaId);
      expect(resultado.existe).toBe(true);
      expect(resultado.vigente).toBe(true);
      expect(resultado.enrutable).toBe(false);
      expect(resultado.receptoresOperativos).toBe(0);
      expect(resultado.motivo).toBe('AREA_NO_ENRUTABLE');
    });

    it('TC-C01-04: Área activa con funcionario operativo plenamente vinculado debe ser ENRUTABLE', async () => {
      // 1. Crear área
      const areaOperativaId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.area (area_id, codigo, nombre, nivel, vigente, creado_en, tipo_unidad)
         VALUES ($1, $2, 'Unidad de Gestión Certificada C0', 1, true, now(), 'UNIDAD')`,
        [areaOperativaId, `OP_${Date.now().toString().slice(-6)}`],
      );
      idsCreados.areas.add(areaOperativaId);

      // 2. Crear persona y cuenta
      const pId = randomUUID();
      const uId = randomUUID();
      const dni = String(Math.floor(10000000 + Math.random() * 90000000));
      await pool.query(
        `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento, creado_en)
         VALUES ($1, 'NATURAL', $2, now())`,
        [pId, dni],
      );
      idsCreados.personas.add(pId);
      await pool.query(
        `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
         VALUES ($1, 'Funcionario', 'Operativo', 'Funcionario Operativo C0', 'func_c0@test.pe')`,
        [pId],
      );
      await pool.query(
        `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo, creado_en)
         VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_for_test', true, now())`,
        [uId, pId, `func_c0_${Date.now()}`, 'func_c0@test.pe'],
      );
      idsCreados.cuentas.add(uId);

      // 3. Crear vínculo institucional vigente
      const vId = randomUUID();
      const resTv = await pool.query<{ id_tipo_vinculo: number }>(
        "SELECT id_tipo_vinculo FROM sigd_auth.tipo_vinculo_institucional WHERE codigo = 'ADMINISTRATIVO' LIMIT 1",
      );
      const tvId = resTv.rows[0].id_tipo_vinculo;
      await pool.query(
        `INSERT INTO sigd_auth.vinculo_institucional (id_vinculo, id_persona, id_tipo_vinculo, estado, vigente_desde, creado_en)
         VALUES ($1, $2, $3, 'ACTIVO', now() - interval '1 day', now())`,
        [vId, pId, tvId],
      );
      idsCreados.vinculos.add(vId);

      // 4. Crear cargo y asignación personal
      const cId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.cargo (cargo_id, codigo, nombre, vigente)
         VALUES ($1, $2, 'Especialista de Trámite', true)`,
        [cId, `CRG_${Date.now().toString().slice(-6)}`],
      );
      idsCreados.cargos.add(cId);

      const asigId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, id_persona, id_vinculo, cargo_id, area_id, estado, vigente_desde, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', now() - interval '1 day', now())`,
        [asigId, uId, pId, vId, cId, areaOperativaId],
      );
      idsCreados.asignacionesPersonal.add(asigId);

      // 5. Asignar rol operativo canónico
      const resRol = await pool.query<{ rol_id: string }>(
        "SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ESPECIALISTA' LIMIT 1",
      );
      const rolId = resRol.rows[0].rol_id;
      const urId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
         VALUES ($1, $2, $3, $4, now() - interval '1 day')`,
        [urId, uId, rolId, areaOperativaId],
      );
      idsCreados.usuarioRoles.add(urId);

      // 6. Evaluar enrutabilidad
      const resultado = await enrutabilidadService.evaluarEnrutabilidadArea(areaOperativaId);
      expect(resultado.existe).toBe(true);
      expect(resultado.vigente).toBe(true);
      expect(resultado.enrutable).toBe(true);
      expect(resultado.receptoresOperativos).toBeGreaterThanOrEqual(1);
      expect(resultado.motivo).toBeUndefined();
    });

    it('TC-C01-05: listarAreasEnrutables debe ejecutarse limpiamente sobre PostgreSQL sin errores de columnas fantasma', async () => {
      const listado = await enrutabilidadService.listarAreasEnrutables();
      expect(Array.isArray(listado)).toBe(true);
      expect(listado.length).toBeGreaterThan(0);

      for (const item of listado) {
        expect(typeof item.id).toBe('string');
        expect(typeof item.nombre).toBe('string');
        expect(typeof item.habilitada).toBe('boolean');
        expect(typeof item.enrutable).toBe('boolean');
        if (!item.enrutable) {
          expect(typeof item.motivo_no_enrutable).toBe('string');
        } else {
          expect(item.motivo_no_enrutable).toBeNull();
        }
      }
    });
  });

  describe('1.1 Semántica Canónica de Receptor Operativo (Fase C0.1B)', () => {
    async function crearFuncionarioConArea(areaId: string, nombreFunc: string) {
      const pId = randomUUID();
      const uId = randomUUID();
      const dni = String(Math.floor(10000000 + Math.random() * 90000000));
      await pool.query(
        `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento, creado_en)
         VALUES ($1, 'NATURAL', $2, now())`,
        [pId, dni],
      );
      idsCreados.personas.add(pId);
      await pool.query(
        `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
         VALUES ($1, $2, 'C0.1B', $3, $4)`,
        [pId, nombreFunc, `${nombreFunc} C0.1B`, `${nombreFunc.toLowerCase()}_${Date.now()}@test.pe`],
      );
      await pool.query(
        `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo, creado_en)
         VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_for_test', true, now())`,
        [uId, pId, `${nombreFunc.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`, `${nombreFunc.toLowerCase()}@test.pe`],
      );
      idsCreados.cuentas.add(uId);

      const vId = randomUUID();
      const resTv = await pool.query<{ id_tipo_vinculo: number }>(
        "SELECT id_tipo_vinculo FROM sigd_auth.tipo_vinculo_institucional WHERE codigo = 'ADMINISTRATIVO' LIMIT 1",
      );
      await pool.query(
        `INSERT INTO sigd_auth.vinculo_institucional (id_vinculo, id_persona, id_tipo_vinculo, estado, vigente_desde, creado_en)
         VALUES ($1, $2, $3, 'ACTIVO', now() - interval '1 day', now())`,
        [vId, pId, resTv.rows[0].id_tipo_vinculo],
      );
      idsCreados.vinculos.add(vId);

      const cId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.cargo (cargo_id, codigo, nombre, vigente)
         VALUES ($1, $2, 'Cargo Test C0.1B', true)`,
        [cId, `CRG_${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)}`],
      );
      idsCreados.cargos.add(cId);

      const asigId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, id_persona, id_vinculo, cargo_id, area_id, estado, vigente_desde, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', now() - interval '1 day', now())`,
        [asigId, uId, pId, vId, cId, areaId],
      );
      idsCreados.asignacionesPersonal.add(asigId);

      return { pId, uId, vId, cId, asigId };
    }

    async function crearArea(nombre: string) {
      const areaId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.area (area_id, codigo, nombre, nivel, vigente, creado_en, tipo_unidad)
         VALUES ($1, $2, $3, 1, true, now(), 'UNIDAD')`,
        [areaId, `A_${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)}`, nombre],
      );
      idsCreados.areas.add(areaId);
      return areaId;
    }

    it('TC-C01-13 (C0.1B #12): Área con usuario con rol ADMINISTRADOR solo debe ser AREA_NO_ENRUTABLE', async () => {
      const areaId = await crearArea('Área Administrador Solo');
      const { uId } = await crearFuncionarioConArea(areaId, 'AdminSolo');

      const resRol = await pool.query<{ rol_id: string }>(
        "SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ADMINISTRADOR' LIMIT 1",
      );
      const urId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
         VALUES ($1, $2, $3, $4, now() - interval '1 day')`,
        [urId, uId, resRol.rows[0].rol_id, areaId],
      );
      idsCreados.usuarioRoles.add(urId);

      const res = await enrutabilidadService.evaluarEnrutabilidadArea(areaId);
      expect(res.existe).toBe(true);
      expect(res.vigente).toBe(true);
      expect(res.enrutable).toBe(false);
      expect(res.receptoresOperativos).toBe(0);
      expect(res.motivo).toBe('AREA_NO_ENRUTABLE');
    });

    it('TC-C01-14 (C0.1B #11): Área con usuario con perfil SUPERADMINISTRADOR solo (sin receptor) debe ser AREA_NO_ENRUTABLE', async () => {
      const areaId = await crearArea('Área Superadmin Solo');
      const { uId } = await crearFuncionarioConArea(areaId, 'SuperadminSolo');

      const resPerf = await pool.query<{ perfil_id: number }>(
        `INSERT INTO sigd_org.perfil_operativo (codigo, nombre, vigente)
         VALUES ($1, 'Super Administrador C0.1B', true)
         RETURNING perfil_id`,
        [`SUPERADMIN_${Date.now()}`],
      );
      const perfilId = resPerf.rows[0].perfil_id;
      idsCreados.perfilesOperativos.add(perfilId);

      const asigPerfId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.asignacion_perfil_operativo (id_asignacion_perfil, id_usuario, perfil_id, area_id, scope, estado, vigente_desde)
         VALUES ($1, $2, $3, $4, 'AREA', 'ACTIVO', now() - interval '1 day')`,
        [asigPerfId, uId, perfilId, areaId],
      );
      idsCreados.asignacionesPerfiles.add(asigPerfId);

      const res = await enrutabilidadService.evaluarEnrutabilidadArea(areaId);
      expect(res.existe).toBe(true);
      expect(res.vigente).toBe(true);
      expect(res.enrutable).toBe(false);
      expect(res.receptoresOperativos).toBe(0);
      expect(res.motivo).toBe('AREA_NO_ENRUTABLE');
    });

    it('TC-C01-15 (C0.1B #13): Área con funcionario que solo posee EXPEDIENTE_VER debe ser AREA_NO_ENRUTABLE', async () => {
      const areaId = await crearArea('Área Solo Ver');
      const { uId } = await crearFuncionarioConArea(areaId, 'SoloVer');

      const resPerf = await pool.query<{ perfil_id: number }>(
        `INSERT INTO sigd_org.perfil_operativo (codigo, nombre, vigente)
         VALUES ($1, 'Perfil Solo Ver C0.1B', true)
         RETURNING perfil_id`,
        [`PERF_VER_${Date.now()}`],
      );
      const perfilId = resPerf.rows[0].perfil_id;
      idsCreados.perfilesOperativos.add(perfilId);

      const resPerm = await pool.query<{ permiso_id: string }>(
        "SELECT permiso_id FROM sigd_org.permiso_sistema WHERE codigo = 'EXPEDIENTE_VER' LIMIT 1",
      );
      await pool.query(
        `INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id) VALUES ($1, $2)`,
        [perfilId, resPerm.rows[0].permiso_id],
      );
      idsCreados.perfilPermisos.add(`${perfilId}_${resPerm.rows[0].permiso_id}`);

      const asigPerfId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.asignacion_perfil_operativo (id_asignacion_perfil, id_usuario, perfil_id, area_id, scope, estado, vigente_desde)
         VALUES ($1, $2, $3, $4, 'AREA', 'ACTIVO', now() - interval '1 day')`,
        [asigPerfId, uId, perfilId, areaId],
      );
      idsCreados.asignacionesPerfiles.add(asigPerfId);

      const res = await enrutabilidadService.evaluarEnrutabilidadArea(areaId);
      expect(res.existe).toBe(true);
      expect(res.vigente).toBe(true);
      expect(res.enrutable).toBe(false);
      expect(res.receptoresOperativos).toBe(0);
      expect(res.motivo).toBe('AREA_NO_ENRUTABLE');
    });

    it('TC-C01-16 (C0.1B #14): Área con funcionario que solo posee EXPEDIENTE_DERIVAR debe ser AREA_NO_ENRUTABLE', async () => {
      const areaId = await crearArea('Área Solo Derivar');
      const { uId } = await crearFuncionarioConArea(areaId, 'SoloDerivar');

      const resPerf = await pool.query<{ perfil_id: number }>(
        `INSERT INTO sigd_org.perfil_operativo (codigo, nombre, vigente)
         VALUES ($1, 'Perfil Solo Derivar C0.1B', true)
         RETURNING perfil_id`,
        [`PERF_DER_${Date.now()}`],
      );
      const perfilId = resPerf.rows[0].perfil_id;
      idsCreados.perfilesOperativos.add(perfilId);

      const resPerm = await pool.query<{ permiso_id: string }>(
        "SELECT permiso_id FROM sigd_org.permiso_sistema WHERE codigo = 'EXPEDIENTE_DERIVAR' LIMIT 1",
      );
      await pool.query(
        `INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id) VALUES ($1, $2)`,
        [perfilId, resPerm.rows[0].permiso_id],
      );
      idsCreados.perfilPermisos.add(`${perfilId}_${resPerm.rows[0].permiso_id}`);

      const asigPerfId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.asignacion_perfil_operativo (id_asignacion_perfil, id_usuario, perfil_id, area_id, scope, estado, vigente_desde)
         VALUES ($1, $2, $3, $4, 'AREA', 'ACTIVO', now() - interval '1 day')`,
        [asigPerfId, uId, perfilId, areaId],
      );
      idsCreados.asignacionesPerfiles.add(asigPerfId);

      const res = await enrutabilidadService.evaluarEnrutabilidadArea(areaId);
      expect(res.existe).toBe(true);
      expect(res.vigente).toBe(true);
      expect(res.enrutable).toBe(false);
      expect(res.receptoresOperativos).toBe(0);
      expect(res.motivo).toBe('AREA_NO_ENRUTABLE');
    });

    it('TC-C01-17 (C0.1B #15): Área con funcionario con EXPEDIENTE_RECIBIR debe ser ENRUTABLE', async () => {
      const areaId = await crearArea('Área Con Recibir');
      const { uId } = await crearFuncionarioConArea(areaId, 'ConRecibir');

      const resPerf = await pool.query<{ perfil_id: number }>(
        `INSERT INTO sigd_org.perfil_operativo (codigo, nombre, vigente)
         VALUES ($1, 'Perfil Recibir C0.1B', true)
         RETURNING perfil_id`,
        [`PERF_REC_${Date.now()}`],
      );
      const perfilId = resPerf.rows[0].perfil_id;
      idsCreados.perfilesOperativos.add(perfilId);

      const resPerm = await pool.query<{ permiso_id: string }>(
        "SELECT permiso_id FROM sigd_org.permiso_sistema WHERE codigo = 'EXPEDIENTE_RECIBIR' LIMIT 1",
      );
      await pool.query(
        `INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id) VALUES ($1, $2)`,
        [perfilId, resPerm.rows[0].permiso_id],
      );
      idsCreados.perfilPermisos.add(`${perfilId}_${resPerm.rows[0].permiso_id}`);

      const asigPerfId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.asignacion_perfil_operativo (id_asignacion_perfil, id_usuario, perfil_id, area_id, scope, estado, vigente_desde)
         VALUES ($1, $2, $3, $4, 'AREA', 'ACTIVO', now() - interval '1 day')`,
        [asigPerfId, uId, perfilId, areaId],
      );
      idsCreados.asignacionesPerfiles.add(asigPerfId);

      const res = await enrutabilidadService.evaluarEnrutabilidadArea(areaId);
      expect(res.existe).toBe(true);
      expect(res.vigente).toBe(true);
      expect(res.enrutable).toBe(true);
      expect(res.receptoresOperativos).toBe(1);
      expect(res.motivo).toBeUndefined();
    });

    it('TC-C01-18 (C0.1B #16): Área con funcionario con EXPEDIENTE_ATENDER debe ser ENRUTABLE', async () => {
      const areaId = await crearArea('Área Con Atender');
      const { uId } = await crearFuncionarioConArea(areaId, 'ConAtender');

      const resPerf = await pool.query<{ perfil_id: number }>(
        `INSERT INTO sigd_org.perfil_operativo (codigo, nombre, vigente)
         VALUES ($1, 'Perfil Atender C0.1B', true)
         RETURNING perfil_id`,
        [`PERF_ATN_${Date.now()}`],
      );
      const perfilId = resPerf.rows[0].perfil_id;
      idsCreados.perfilesOperativos.add(perfilId);

      const resPerm = await pool.query<{ permiso_id: string }>(
        "SELECT permiso_id FROM sigd_org.permiso_sistema WHERE codigo = 'EXPEDIENTE_ATENDER' LIMIT 1",
      );
      await pool.query(
        `INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id) VALUES ($1, $2)`,
        [perfilId, resPerm.rows[0].permiso_id],
      );
      idsCreados.perfilPermisos.add(`${perfilId}_${resPerm.rows[0].permiso_id}`);

      const asigPerfId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.asignacion_perfil_operativo (id_asignacion_perfil, id_usuario, perfil_id, area_id, scope, estado, vigente_desde)
         VALUES ($1, $2, $3, $4, 'AREA', 'ACTIVO', now() - interval '1 day')`,
        [asigPerfId, uId, perfilId, areaId],
      );
      idsCreados.asignacionesPerfiles.add(asigPerfId);

      const res = await enrutabilidadService.evaluarEnrutabilidadArea(areaId);
      expect(res.existe).toBe(true);
      expect(res.vigente).toBe(true);
      expect(res.enrutable).toBe(true);
      expect(res.receptoresOperativos).toBe(1);
      expect(res.motivo).toBeUndefined();
    });

    it('TC-C01-19 (C0.1B #17): Cuenta multirrol con ADMIN + ESPECIALISTA debe ser ENRUTABLE por el rol operativo y no por admin', async () => {
      const areaId = await crearArea('Área Multirrol');
      const { uId } = await crearFuncionarioConArea(areaId, 'MultirrolUser');

      // 1. Asignar rol ADMINISTRADOR
      const resRol = await pool.query<{ rol_id: string }>(
        "SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ADMINISTRADOR' LIMIT 1",
      );
      const urId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
         VALUES ($1, $2, $3, $4, now() - interval '1 day')`,
        [urId, uId, resRol.rows[0].rol_id, areaId],
      );
      idsCreados.usuarioRoles.add(urId);

      // 2. Con sólo ADMINISTRADOR, debe ser AREA_NO_ENRUTABLE
      const resSoloAdmin = await enrutabilidadService.evaluarEnrutabilidadArea(areaId);
      expect(resSoloAdmin.enrutable).toBe(false);
      expect(resSoloAdmin.motivo).toBe('AREA_NO_ENRUTABLE');

      // 3. Agregar rol operativo ESPECIALISTA a la misma cuenta
      const resRolEsp = await pool.query<{ rol_id: string }>(
        "SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ESPECIALISTA' LIMIT 1",
      );
      const urEspId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.usuario_rol (id_usuario_rol, id_usuario, rol_id, area_id, vigente_desde)
         VALUES ($1, $2, $3, $4, now() - interval '1 day')`,
        [urEspId, uId, resRolEsp.rows[0].rol_id, areaId],
      );
      idsCreados.usuarioRoles.add(urEspId);

      // 4. Ahora debe ser ENRUTABLE por la presencia del rol operativo
      const resConEsp = await enrutabilidadService.evaluarEnrutabilidadArea(areaId);
      expect(resConEsp.enrutable).toBe(true);
      expect(resConEsp.receptoresOperativos).toBe(1);
      expect(resConEsp.motivo).toBeUndefined();

      // 5. Eliminar el rol ESPECIALISTA, manteniendo intacto el rol ADMINISTRADOR
      await pool.query('DELETE FROM sigd_org.usuario_rol WHERE id_usuario_rol = $1', [urEspId]);
      idsCreados.usuarioRoles.delete(urEspId);

      // 6. El área debe volver inmediatamente a AREA_NO_ENRUTABLE
      const resRevocado = await enrutabilidadService.evaluarEnrutabilidadArea(areaId);
      expect(resRevocado.enrutable).toBe(false);
      expect(resRevocado.motivo).toBe('AREA_NO_ENRUTABLE');
      expect(resRevocado.receptoresOperativos).toBe(0);
    });
  });

  describe('2. ExpedienteAsignacionService — Asignación y Reasignación contra PostgreSQL 18.6', () => {
    let testAreaId: string;
    let testPersonaId: string;
    let testUsuarioId: string;
    let testExpedienteId: string;

    beforeAll(async () => {
      // 1. Crear área de prueba
      testAreaId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.area (area_id, codigo, nombre, nivel, vigente, creado_en, tipo_unidad)
         VALUES ($1, $2, 'Área de Prueba Asignación C0', 1, true, now(), 'UNIDAD')`,
        [testAreaId, `ASG_${Date.now().toString().slice(-6)}`],
      );
      idsCreados.areas.add(testAreaId);

      // 2. Crear persona y cuenta
      testPersonaId = randomUUID();
      testUsuarioId = randomUUID();
      const dni = String(Math.floor(10000000 + Math.random() * 90000000));
      await pool.query(
        `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento, creado_en)
         VALUES ($1, 'NATURAL', $2, now())`,
        [testPersonaId, dni],
      );
      idsCreados.personas.add(testPersonaId);

      await pool.query(
        `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
         VALUES ($1, 'Asignado', 'Test', 'Asignado Test', 'asig@test.pe')`,
        [testPersonaId],
      );

      await pool.query(
        `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo, creado_en)
         VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_for_test', true, now())`,
        [testUsuarioId, testPersonaId, `asig_${Date.now()}`, 'asig@test.pe'],
      );
      idsCreados.cuentas.add(testUsuarioId);

      // 3. Crear expediente de prueba en el área
      testExpedienteId = randomUUID();
      const numExp = String(Math.floor(100000 + Math.random() * 900000));
      const dniSol = String(Math.floor(10000000 + Math.random() * 90000000));
      await pool.query(
        `INSERT INTO sigd_tra.expediente (expediente_id, codigo_expediente, numero, dni_solicitante, tipo_documental_id, solicitante_id, area_destino_id, estado, fecha_radicacion, id_usuario_creador)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'EN_TRAMITE', now(), $8)`,
        [testExpedienteId, `EXP-2026-${numExp}`, numExp, dniSol, tipoDocId, personaOperadorId, testAreaId, usuarioOperadorId],
      );
      idsCreados.expedientes.add(testExpedienteId);
    });

    it('TC-C01-06: Debe RECHAZAR asignación si el funcionario no tiene vínculo institucional activo', async () => {
      await expect(
        asignacionService.asignarExpediente({
          expedienteId: testExpedienteId,
          idPersona: testPersonaId,
          idUsuario: testUsuarioId,
          asignadoPorUsuarioId: usuarioOperadorId,
          motivo: 'Asignación sin vínculo institucional',
        }),
      ).rejects.toThrow(/vínculo institucional vigente/i);
    });

    it('TC-C01-07: Debe RECHAZAR asignación si el funcionario tiene vínculo pero no pertenece al área', async () => {
      // Crear vínculo institucional
      const vId = randomUUID();
      const resTv = await pool.query<{ id_tipo_vinculo: number }>(
        "SELECT id_tipo_vinculo FROM sigd_auth.tipo_vinculo_institucional WHERE codigo = 'ADMINISTRATIVO' LIMIT 1",
      );
      await pool.query(
        `INSERT INTO sigd_auth.vinculo_institucional (id_vinculo, id_persona, id_tipo_vinculo, estado, vigente_desde, creado_en)
         VALUES ($1, $2, $3, 'ACTIVO', now() - interval '1 day', now())`,
        [vId, testPersonaId, resTv.rows[0].id_tipo_vinculo],
      );
      idsCreados.vinculos.add(vId);

      await expect(
        asignacionService.asignarExpediente({
          expedienteId: testExpedienteId,
          idPersona: testPersonaId,
          idUsuario: testUsuarioId,
          asignadoPorUsuarioId: usuarioOperadorId,
          motivo: 'Asignación sin pertenencia a área',
        }),
      ).rejects.toThrow(/ASIGNACION_NO_VIGENTE/i);
    });

    it('TC-C01-08: Debe ACEPTAR asignación cuando el funcionario cuenta con adscripción activa al área', async () => {
      // Crear cargo y asignación personal en el área del expediente
      const cId = randomUUID();
      await pool.query(
        `INSERT INTO sigd_org.cargo (cargo_id, codigo, nombre, vigente)
         VALUES ($1, $2, 'Especialista Responsable', true)`,
        [cId, `CRG_${Date.now().toString().slice(-6)}`],
      );
      idsCreados.cargos.add(cId);

      const asigId = randomUUID();
      const vId = Array.from(idsCreados.vinculos)[0];
      await pool.query(
        `INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, id_persona, id_vinculo, cargo_id, area_id, estado, vigente_desde, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', now() - interval '1 day', now())`,
        [asigId, testUsuarioId, testPersonaId, vId, cId, testAreaId],
      );
      idsCreados.asignacionesPersonal.add(asigId);

      const res = await asignacionService.asignarExpediente({
        expedienteId: testExpedienteId,
        idPersona: testPersonaId,
        idUsuario: testUsuarioId,
        asignadoPorUsuarioId: usuarioOperadorId,
        motivo: 'Asignación válida con vínculo y adscripción',
      });

      expect(res).toBeDefined();
      expect(res.idAsignacion).toBeDefined();
      expect(res.expedienteId).toBe(testExpedienteId);
      expect(res.idPersona).toBe(testPersonaId);
      expect(res.idUsuario).toBe(testUsuarioId);
      expect(res.activo).toBe(true);

      idsCreados.expedienteAsignaciones.add(res.idAsignacion);

      // Verificar en base de datos
      const asignacionActiva = await asignacionService.obtenerAsignacionActiva(testExpedienteId);
      expect(asignacionActiva).toBeDefined();
      expect(asignacionActiva?.idUsuario).toBe(testUsuarioId);
    });

    it('TC-C01-09: Reasignación debe desactivar la asignación previa con motivo REASIGNACION', async () => {
      // Crear segundo usuario con adscripción al área
      const p2Id = randomUUID();
      const u2Id = randomUUID();
      const dni2 = String(Math.floor(10000000 + Math.random() * 90000000));
      await pool.query(
        `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento, creado_en)
         VALUES ($1, 'NATURAL', $2, now())`,
        [p2Id, dni2],
      );
      idsCreados.personas.add(p2Id);
      await pool.query(
        `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
         VALUES ($1, 'Segundo', 'Funcionario', 'Segundo Funcionario', 'func2@test.pe')`,
        [p2Id],
      );
      await pool.query(
        `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo, creado_en)
         VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_for_test', true, now())`,
        [u2Id, p2Id, `func2_${Date.now()}`, 'func2@test.pe'],
      );
      idsCreados.cuentas.add(u2Id);

      const v2Id = randomUUID();
      const resTv = await pool.query<{ id_tipo_vinculo: number }>(
        "SELECT id_tipo_vinculo FROM sigd_auth.tipo_vinculo_institucional WHERE codigo = 'ADMINISTRATIVO' LIMIT 1",
      );
      await pool.query(
        `INSERT INTO sigd_auth.vinculo_institucional (id_vinculo, id_persona, id_tipo_vinculo, estado, vigente_desde, creado_en)
         VALUES ($1, $2, $3, 'ACTIVO', now() - interval '1 day', now())`,
        [v2Id, p2Id, resTv.rows[0].id_tipo_vinculo],
      );
      idsCreados.vinculos.add(v2Id);

      const asig2Id = randomUUID();
      const cId = Array.from(idsCreados.cargos)[0];
      await pool.query(
        `INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, id_persona, id_vinculo, cargo_id, area_id, estado, vigente_desde, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', now() - interval '1 day', now())`,
        [asig2Id, u2Id, p2Id, v2Id, cId, testAreaId],
      );
      idsCreados.asignacionesPersonal.add(asig2Id);

      // Reasignar al segundo funcionario
      const resReasig = await asignacionService.asignarExpediente({
        expedienteId: testExpedienteId,
        idPersona: p2Id,
        idUsuario: u2Id,
        asignadoPorUsuarioId: usuarioOperadorId,
        motivo: 'Reasignación por redistribución de carga',
      });

      expect(resReasig.idUsuario).toBe(u2Id);
      idsCreados.expedienteAsignaciones.add(resReasig.idAsignacion);

      // Comprobar que la primera asignación quedó inactiva con motivo REASIGNACION
      const primeraAsig = await pool.query<{ activo: boolean; motivo_desasignacion: string }>(
        'SELECT activo, motivo_desasignacion FROM sigd_rut.expediente_asignacion WHERE id_usuario = $1 AND expediente_id = $2',
        [testUsuarioId, testExpedienteId],
      );
      expect(primeraAsig.rows[0].activo).toBe(false);
      expect(primeraAsig.rows[0].motivo_desasignacion).toBe('REASIGNACION');
    });
  });

  describe('3. HTTP Endpoints — Reglas de Seguridad CORS y Rechazo Canónico', () => {
    it('TC-C01-10: OPTIONS Preflight no debe reflejar cabeceras arbitrarias en Access-Control-Allow-Headers', async () => {
      const res = await request(app)
        .options('/api/v1/organigrama/areas-activas')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'X-CABECERA-MALICIOSA, Authorization');

      expect(res.status).toBe(204);
      const allowHeaders = res.headers['access-control-allow-headers'] || '';
      expect(allowHeaders).not.toContain('X-CABECERA-MALICIOSA');
      expect(allowHeaders).toContain('Authorization');
      expect(allowHeaders).toContain('Content-Type');
    });

    it('TC-C01-11: GET /api/v1/organigrama/areas-activas debe responder HTTP 200 con listado enriquecido', async () => {
      const res = await request(app)
        .get('/api/v1/organigrama/areas-activas')
        .set('Authorization', `Bearer ${tokenOperador}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('enrutable');
      expect(res.body[0]).toHaveProperty('habilitada');
    });

    it('TC-C01-12: POST /api/v1/expedientes/:id/derivar con asignación embebida debe ser RECHAZADO con HTTP 400', async () => {
      const expFake = randomUUID();
      const areaFake = randomUUID();
      const userFake = randomUUID();

      const res = await request(app)
        .post(`/api/v1/expedientes/${expFake}/derivar`)
        .set('Authorization', `Bearer ${tokenOperador}`)
        .send({
          destinos: [
            {
              area_destino_id: areaFake,
              es_copia: false,
              usuario_asignado_id: userFake,
            },
          ],
          proveido: 'Pase reglamentario.',
        });

      expect(res.status).toBe(400);
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).toContain('ASIGNACION_EMBEBIDA_NO_PERMITIDA');
    });
  });
});
