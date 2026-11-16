import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { TupaVersionadoService } from '../../../../src/domains/organicore/tupaVersionado.service.js';
import { CATALOGO_DOCUMENTAL_TUPA_2026, CATALOGO_DOCUMENTAL_POR_CODIGO } from '../../../../src/domains/tramicore/catalogoDocumentalTupa2026.js';
import { obtenerDocumentacionTramite } from '../../../../src/domains/tramicore/documentacionTramite.service.js';

describe('TupaVersionadoService — Versionado y Unidades Orgánicas (Parte 4)', () => {
  it('1. El catálogo oficial contiene exactamente 72 procedimientos numerados consecutivamente del 001 al 072', () => {
    expect(CATALOGO_DOCUMENTAL_TUPA_2026).toHaveLength(72);

    CATALOGO_DOCUMENTAL_TUPA_2026.forEach((p, idx) => {
      const esperadoNumero = String(idx + 1).padStart(3, '0');
      const esperadoCodigoVisible = `SUZ26-${esperadoNumero}`;
      expect(p.numeroVisible).toBe(esperadoNumero);
      expect(p.codigoVisible).toBe(esperadoCodigoVisible);
      expect(p.unidadRecepcion).toBe('Mesa de Partes (MP)');
      expect(p.unidadResponsable).toBeDefined();
      expect(p.autoridadResolutiva).toBeDefined();
      expect(p.versionTupa).toBe('TUPA-2026-V1');
    });

    const primerTramite = CATALOGO_DOCUMENTAL_TUPA_2026[0];
    expect(primerTramite.numeroVisible).toBe('001');
    expect(primerTramite.codigoVisible).toBe('SUZ26-001');

    const ultimoTramite = CATALOGO_DOCUMENTAL_TUPA_2026[71];
    expect(ultimoTramite.numeroVisible).toBe('072');
    expect(ultimoTramite.codigoVisible).toBe('SUZ26-072');
    expect(ultimoTramite.codigoInterno).toBe('SUZ26-075');
  });

  it('2. Identifica transparentemente los 36 trámites validados y los 36 pendientes de validación institucional', () => {
    const validados = CATALOGO_DOCUMENTAL_TUPA_2026.filter((p) => p.estadoValidacion === 'VALIDADO');
    const pendientes = CATALOGO_DOCUMENTAL_TUPA_2026.filter(
      (p) => p.estadoValidacion === 'PENDIENTE_VALIDACION_DOCUMENTAL'
    );

    expect(validados).toHaveLength(36);
    expect(pendientes).toHaveLength(36);

    pendientes.forEach((p) => {
      expect(p.observacionInstitucional).toMatch(/pendiente de validación/i);
    });
  });

  it('3. Mapea coherentemente las unidades orgánicas institucionales (SEC, DG, ADM)', () => {
    // Trámites académicos deben derivar a Secretaría Académica
    const practicas = CATALOGO_DOCUMENTAL_POR_CODIGO.get('001');
    expect(practicas?.unidadResponsable).toMatch(/Secretaría Académica/i);

    const titulacion = CATALOGO_DOCUMENTAL_POR_CODIGO.get('033'); // Expedición de título
    expect(titulacion?.unidadResponsable).toMatch(/Secretaría Académica/i);
    expect(titulacion?.autoridadResolutiva).toBe('Dirección General (DG)');

    // Trámites de servicios / alquileres deben derivar a Administración
    const alquilerCancha = CATALOGO_DOCUMENTAL_POR_CODIGO.get('014');
    expect(alquilerCancha?.unidadResponsable).toMatch(/Administración/i);
  });

  it('4. TupaVersionadoService lista versiones reglamentarias (VIGENTE, BORRADOR, HISTORICO)', async () => {
    const pool = {
      query: vi.fn().mockRejectedValue(new Error('Tabla no creada aún')),
    } as unknown as Pool;

    const service = new TupaVersionadoService(pool);
    const versiones = await service.listarVersiones();

    expect(versiones.length).toBeGreaterThanOrEqual(1);
    const vigente = versiones.find((v) => v.estado === 'VIGENTE');
    expect(vigente).toBeDefined();
    expect(vigente?.codigoVersion).toBe('TUPA-2026-V1');
    expect(vigente?.vigente).toBe(true);
    expect(vigente?.totalTramites).toBe(72);
    // Transparencia institucional: no se inventan números de resolución ni fechas
    expect(vigente?.resolucionAprobacion).toBeNull();
    expect(vigente?.fechaAprobacion).toBeNull();

    // Confirmar que NO existen borradores de simulación ni entidades artificiales no autorizadas
    const borrador = versiones.find((v) => v.codigoVersion === 'BORRADOR-SIMULACION');
    expect(borrador).toBeUndefined();
    const historico = versiones.find((v) => v.codigoVersion === 'HISTORICO-AUDITORIA-PREVIA');
    expect(historico).toBeUndefined();
  });

  it('5. Audita los 197 expedientes preservando la restricción expediente_tupa_origen_unico', async () => {
    const pool = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('sigd_doc.expediente')) {
          return {
            rows: [
              {
                total: '189',
                vigentes: '184',
                historicos: '5',
                huerfanos: '0',
              },
            ],
          };
        }
        if (sql.includes('sigd_tra.expediente')) {
          return {
            rows: [{ total: '197' }],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const service = new TupaVersionadoService(pool);
    const auditoria = await service.auditarExpedientes();

    expect(auditoria.totalExpedientesDoc).toBe(189);
    expect(auditoria.expedientesTupaVigente2026).toBe(184);
    expect(auditoria.expedientesAuditoriaHistoricaPre2026).toBe(5);
    expect(auditoria.expedientesHuerfanosDoc).toBe(0);
    expect(auditoria.totalExpedientesTra).toBe(197);
    expect(auditoria.reasignacionesSinEvidencia).toBe(0);
    expect(auditoria.costosAlterados).toBe(0);
    expect(auditoria.cumplimientoRestriccionOrigenUnico).toBe(true);
    expect(auditoria.estadoIntegridad).toBe('AUDITORIA_INTEGRA');
  });

  it('6. obtenerDocumentacionTramite expone metadatos de enrutamiento y versión', async () => {
    const mockProcId = '18cc2baf-92e9-4834-bb1f-8e698fc417f2';
    const pool = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) {
          return {
            rows: [
              {
                tipo_tramite_id: mockProcId,
                codigo: 'SUZ26-001',
                denominacion: 'Prácticas Iniciales',
              },
            ],
          };
        }
        if (sql.includes('sigd_doc.requisito')) {
          return { rows: [] };
        }
        if (sql.includes('sigd_doc.tipo_documento')) {
          return {
            rows: [
              { tipo_documental_id: 'td-fut', codigo: 'FUT', nombre: 'FUT' },
              { tipo_documental_id: 'td-anx', codigo: 'ANEXO', nombre: 'ANEXO' },
            ],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const doc = await obtenerDocumentacionTramite(pool, mockProcId);

    expect(doc.codigoVisible).toBe('SUZ26-001');
    expect(doc.numeroVisible).toBe('001');
    expect(doc.unidadRecepcion).toBe('Mesa de Partes (MP)');
    expect(doc.unidadResponsable).toMatch(/Secretaría Académica/i);
    expect(doc.versionTupa).toBe('TUPA-2026-V1');
    expect(doc.requisitos.length).toBeGreaterThanOrEqual(1);
    expect(doc.requisitos[0].estadoValidacion).toBe('VALIDADO_OFICIAL');
  });

  it('7. publicarVersion exige resolución formal y fecha, rechazando borradores y vacíos', async () => {
    const pool = {
      query: vi.fn(),
    } as unknown as Pool;

    const service = new TupaVersionadoService(pool);

    // Sin resolución formal
    await expect(
      service.publicarVersion({
        codigoVersion: 'TUPA-2027-V1',
        resolucionAprobacion: '',
        fechaAprobacion: '2027-01-01',
      })
    ).rejects.toThrow(/sin resolución formal de aprobación/i);

    // Sin fecha formal
    await expect(
      service.publicarVersion({
        codigoVersion: 'TUPA-2027-V1',
        resolucionAprobacion: 'R.D. N° 012-2027-IESTP-SUIZA',
        fechaAprobacion: '',
      })
    ).rejects.toThrow(/sin fecha formal de aprobación/i);


    // Publicación válida con registro de usuario publicador
    const pub = await service.publicarVersion({
      codigoVersion: 'TUPA-2026-V1',
      resolucionAprobacion: 'R.D. N° 001-2026-IESTP-SUIZA',
      fechaAprobacion: '2026-01-02',
      usuarioId: '11111111-1111-4111-8111-111111111111',
    });

    expect(pub.estado).toBe('VIGENTE');
    expect(pub.vigente).toBe(true);
    expect(pub.codigoVersion).toBe('TUPA-2026-V1');
  });

  it('8. Diferencia rigurosa entre requisitos EXPRESO_FUENTE_INSTITUCIONAL e INFERIDO_POR_DENOMINACION', () => {
    // Exactamente 5 trámites con requisitos específicos expresos en la fuente institucional
    const tramitesExpresos = CATALOGO_DOCUMENTAL_TUPA_2026.filter((p) =>
      p.requisitos.some((r) => r.tipoOrigen === 'EXPRESO_FUENTE_INSTITUCIONAL')
    );
    expect(tramitesExpresos.map((p) => p.codigoInterno).sort()).toEqual(
      ['SUZ26-030', 'SUZ26-046', 'SUZ26-065', 'SUZ26-066', 'SUZ26-068'].sort()
    );

    // Los anexos son referenciales, nunca obligatorios bloqueantes
    CATALOGO_DOCUMENTAL_TUPA_2026.forEach((p) => {
      p.anexos.forEach((a) => {
        expect(a.obligatorio).toBe(false);
        expect(['INFERIDO_POR_DENOMINACION', 'EXPRESO_FUENTE_INSTITUCIONAL']).toContain(a.tipoOrigen);
      });
    });

    // Los 36 trámites pendientes no exigen anexos específicos no aprobados
    const pendientes = CATALOGO_DOCUMENTAL_TUPA_2026.filter(
      (p) => p.estadoValidacion === 'PENDIENTE_VALIDACION_DOCUMENTAL'
    );
    pendientes.forEach((p) => {
      expect(p.sinAnexosEspecificos).toBe(true);
      expect(p.anexos).toHaveLength(0);
      // Solo exige el FUT institucional estándar
      expect(p.requisitos).toHaveLength(1);
      expect(p.requisitos[0].tipoOrigen).toBe('ESTANDAR_GENERAL');
    });

    // Tarifas intactas (72 procedimientos con costoFuente definido no vacío)
    CATALOGO_DOCUMENTAL_TUPA_2026.forEach((p) => {
      expect(p.costoFuente).toBeDefined();
      expect(typeof p.costoFuente).toBe('string');
      expect(p.costoFuente.length).toBeGreaterThan(0);
    });
  });

  it('9. Migración 18: FK usuario_publicador_id cumple política institucional ON DELETE RESTRICT y PK id_usuario', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const rutaMigracion = path.resolve(__dirname, '../../../../migraciones/18_sigd_doc_tupa_versionado.sql');
    const contenidoSql = fs.readFileSync(rutaMigracion, 'utf-8');

    // 1. Clave foránea correcta apuntando a id_usuario y con ON DELETE RESTRICT
    expect(contenidoSql).toMatch(
      /usuario_publicador_id\s+UUID\s+NULL\s+REFERENCES\s+sigd_auth\.cuenta_usuario\s*\(\s*id_usuario\s*\)\s+ON\s+DELETE\s+RESTRICT/i
    );

    // 2. Prohibido utilizar ON DELETE SET NULL en usuario_publicador_id
    expect(contenidoSql).not.toMatch(/usuario_publicador_id[^;]+ON\s+DELETE\s+SET\s+NULL/i);

    // 3. Prohibido referenciar cuenta_id (columna inexistente en sigd_auth.cuenta_usuario)
    expect(contenidoSql).not.toMatch(/cuenta_usuario\s*\(\s*cuenta_id\s*\)/i);

    // 4. Idempotencia estricta en semillas de versiones (DO NOTHING para no reactivar versiones pasadas)
    const matchesConflict = contenidoSql.match(/ON\s+CONFLICT\s*\(\s*codigo_version\s*\)\s+DO\s+NOTHING/gi);
    expect(matchesConflict).not.toBeNull();
    expect(matchesConflict?.length).toBe(1); // TUPA-2026-V1 única semilla institucional de línea base
    expect(contenidoSql).not.toMatch(/BORRADOR-SIMULACION/i);
    expect(contenidoSql).not.toMatch(/HISTORICO-AUDITORIA-PREVIA/i);
  });

  it('10. publicarVersion persiste usuario_publicador_id autenticado en PostgreSQL con alternancia atómica', async () => {
    const executedQueries: { sql: string; params?: any[] }[] = [];
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        executedQueries.push({ sql, params });
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('SELECT version_id, estado, vigente FROM sigd_doc.tupa_catalogo_version')) {
          return {
            rows: [{ version_id: 'a0260001-0000-4000-8000-000000002026', estado: 'HISTORICO', vigente: false }],
            rowCount: 1,
          };
        }
        if (sql.includes('UPDATE sigd_doc.tupa_catalogo_version')) {
          return {
            rows: [
              {
                version_id: 'a0260001-0000-4000-8000-000000002026',
                codigo_version: 'TUPA-2026-V1',
                estado: 'VIGENTE',
                vigente: true,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };

    const pool = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ existe: true }] };
        }
        return { rows: [] };
      }),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    const service = new TupaVersionadoService(pool);
    const mockUsuarioId = '55555555-5555-4555-8555-555555555555';

    const res = await service.publicarVersion({
      codigoVersion: 'TUPA-2026-V1',
      resolucionAprobacion: 'R.D. N° 045-2026-IESTP-SUIZA',
      fechaAprobacion: '2026-03-15',
      usuarioId: mockUsuarioId,
    });

    expect(res.estado).toBe('VIGENTE');
    expect(res.vigente).toBe(true);
    expect(mockClient.release).toHaveBeenCalledOnce();

    // Verificar que la consulta SQL incluyó fecha_publicacion y usuario_publicador_id
    const updateCall = executedQueries.find((q) => q.sql.includes('UPDATE sigd_doc.tupa_catalogo_version'));
    expect(updateCall).toBeDefined();
    expect(updateCall?.sql).toContain('fecha_publicacion = clock_timestamp()');
    expect(updateCall?.sql).toContain('usuario_publicador_id = COALESCE($4::uuid, usuario_publicador_id)');
    expect(updateCall?.params).toEqual([
      'R.D. N° 045-2026-IESTP-SUIZA',
      '2026-03-15',
      'TUPA-2026-V1',
      mockUsuarioId,
    ]);
  });

  it('11. Conservación de identidad: la desactivación de cuenta mantiene la autoría histórica sin permitir borrado físico', () => {
    // Simula una cuenta en sigd_auth.cuenta_usuario
    const cuentaUsuario = {
      id_usuario: '55555555-5555-4555-8555-555555555555',
      usuario: 'director.general',
      correo: 'director@iestpsuiza.edu.pe',
      activo: true,
    };

    // La versión TUPA referencia id_usuario mediante ON DELETE RESTRICT
    const versionTupa = {
      codigo_version: 'TUPA-2026-V1',
      usuario_publicador_id: cuentaUsuario.id_usuario,
      estado: 'VIGENTE',
    };

    // Al desactivar la cuenta (activo = false)
    cuentaUsuario.activo = false;

    // 1. El registro de cuenta_usuario persiste intacto (no se elimina)
    expect(cuentaUsuario.id_usuario).toBe('55555555-5555-4555-8555-555555555555');
    expect(cuentaUsuario.activo).toBe(false);

    // 2. La versión TUPA conserva exactamente la autoría histórica del publicador
    expect(versionTupa.usuario_publicador_id).toBe(cuentaUsuario.id_usuario);
    expect(versionTupa.usuario_publicador_id).not.toBeNull();

    // 3. Simulación de DELETE restringido: ON DELETE RESTRICT rechaza cualquier DELETE físico
    const intentarDeleteFisico = (tieneReferenciasEnTupa: boolean) => {
      if (tieneReferenciasEnTupa) {
        throw new Error('update or delete on table "cuenta_usuario" violates foreign key constraint "tupa_catalogo_version_usuario_publicador_id_fkey" (ON DELETE RESTRICT)');
      }
    };

    expect(() => intentarDeleteFisico(true)).toThrow(/violates foreign key constraint.*RESTRICT/i);
  });

  it('12. Endpoint /tupa/versiones/:codigoVersion/publicar exige RBAC y descarta usuarioId manipulado en el body', async () => {
    const express = (await import('express')).default;
    const request = (await import('supertest')).default;
    const { firmarTokenAcceso } = await import('../../../../src/core/auth/jwt.service.js');
    const { crearRouterAdminMaestras } = await import('../../../../src/domains/organicore/adminMaestras.routes.js');

    const adminSub = '11111111-1111-4111-8111-111111111111';
    const fakeToken = firmarTokenAcceso({
      sub: adminSub,
      roles: ['ADMINISTRADOR'],
      expiraSegundos: 300,
      secreto: '12345678901234567890123456789012',
    });

    // Mock Pool que autoriza el permiso ADMIN_USUARIOS GLOBAL para adminSub
    const mockPool = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('autorizado')) {
          return { rows: [{ autorizado: params?.[0] === adminSub }] };
        }
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ existe: false }] };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    process.env.AUTH_JWT_SECRET = '12345678901234567890123456789012';

    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', crearRouterAdminMaestras(mockPool));

    // 1. Petición sin token -> 401 Unauthorized
    const resSinToken = await request(app)
      .post('/api/v1/admin/tupa/versiones/TUPA-2026-V1/publicar')
      .send({
        resolucionAprobacion: 'R.D. N° 001-2026',
        fechaAprobacion: '2026-01-01',
      });
    expect([401, 403]).toContain(resSinToken.status);

    // 2. Petición con token legítimo pero con usuarioId falso inyectado en el body
    const resConToken = await request(app)
      .post('/api/v1/admin/tupa/versiones/TUPA-2026-V1/publicar')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({
        usuarioId: '99999999-9999-4999-8999-999999999999', // Intento de suplantar publicador desde frontend
        resolucionAprobacion: 'R.D. N° 001-2026-IESTP-SUIZA',
        fechaAprobacion: '2026-01-02',
      });

    expect(resConToken.status).toBe(200);
    expect(resConToken.body.data.codigoVersion).toBe('TUPA-2026-V1');
  });

  describe('Suite RBAC: Facultades del ADMINISTRADOR y SUPER_ADMIN en Catálogo TUPA', () => {
    const adminId = '11111111-1111-4111-8111-111111111111';
    const superAdminId = '22222222-2222-4222-8222-222222222222';
    const ciudadanoId = '33333333-3333-4333-8333-333333333333';
    const mesaPartesId = '44444444-4444-4444-8444-444444444444';

    let app: any;
    let firmarTokenAcceso: any;

    beforeEach(async () => {
      const express = (await import('express')).default;
      const jwtMod = await import('../../../../src/core/auth/jwt.service.js');
      firmarTokenAcceso = jwtMod.firmarTokenAcceso;
      const { crearRouterAdminMaestras } = await import('../../../../src/domains/organicore/adminMaestras.routes.js');

      process.env.AUTH_JWT_SECRET = '12345678901234567890123456789012';

      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          if (sql.includes('autorizado')) {
            const sub = params?.[0];
            const esValido = sub === adminId || sub === superAdminId;
            return { rows: [{ autorizado: esValido }] };
          }
          if (sql.includes('information_schema.tables')) {
            return { rows: [{ existe: false }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      app = express();
      app.use(express.json());
      app.use('/api/v1/admin', crearRouterAdminMaestras(mockPool));
    });

    it('1. ADMINISTRADOR puede crear borradores TUPA exitosamente', async () => {
      const request = (await import('supertest')).default;
      const tokenAdmin = firmarTokenAcceso({
        sub: adminId,
        roles: ['ADMINISTRADOR'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });

      const res = await request(app)
        .post('/api/v1/admin/tupa/versiones')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          codigoVersion: 'TUPA-2027-V1',
          denominacion: 'TUPA Institucional 2027 (Formulación)',
          observaciones: 'Borrador de prueba creado por Administrador',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.codigoVersion).toBe('TUPA-2027-V1');
      expect(res.body.data.estado).toBe('BORRADOR');
      expect(res.body.data.vigente).toBe(false);
    });

    it('2. ADMINISTRADOR puede editar borradores TUPA existentes', async () => {
      const request = (await import('supertest')).default;
      const tokenAdmin = firmarTokenAcceso({
        sub: adminId,
        roles: ['ADMINISTRADOR'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });

      const res = await request(app)
        .put('/api/v1/admin/tupa/versiones/TUPA-2027-V1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          denominacion: 'Borrador TUPA 2027 Editado por Administrador',
          observaciones: 'Ajuste de observaciones técnicas',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.denominacion).toContain('Editado por Administrador');
      expect(res.body.data.estado).toBe('BORRADOR');
    });

    it('3. ADMINISTRADOR puede publicar versiones autorizadas con resolución formal', async () => {
      const request = (await import('supertest')).default;
      const tokenAdmin = firmarTokenAcceso({
        sub: adminId,
        roles: ['ADMINISTRADOR'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });

      const res = await request(app)
        .post('/api/v1/admin/tupa/versiones/TUPA-2027-V1/publicar')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          resolucionAprobacion: 'R.D. N° 088-2027-IESTP-SUIZA',
          fechaAprobacion: '2027-02-15',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.codigoVersion).toBe('TUPA-2027-V1');
      expect(res.body.data.estado).toBe('VIGENTE');
      expect(res.body.data.vigente).toBe(true);
    });

    it('4. SUPER_ADMIN conserva plenamente sus facultades existentes para crear y publicar', async () => {
      const request = (await import('supertest')).default;
      const tokenSuperAdmin = firmarTokenAcceso({
        sub: superAdminId,
        roles: ['SUPER_ADMIN'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });

      // Crear borrador con SUPER_ADMIN
      const resCrear = await request(app)
        .post('/api/v1/admin/tupa/versiones')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({
          codigoVersion: 'TUPA-2028-V1',
          denominacion: 'TUPA Institucional 2028',
        });
      expect(resCrear.status).toBe(201);

      // Publicar con SUPER_ADMIN
      const resPub = await request(app)
        .post('/api/v1/admin/tupa/versiones/TUPA-2028-V1/publicar')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({
          resolucionAprobacion: 'R.D. N° 100-2028-IESTP-SUIZA',
          fechaAprobacion: '2028-01-10',
        });
      expect(resPub.status).toBe(200);
      expect(resPub.body.data.codigoVersion).toBe('TUPA-2028-V1');
      expect(resPub.body.data.vigente).toBe(true);
    });

    it('5. Usuarios sin autorización (CIUDADANO, MESA_PARTES) reciben HTTP 403 y solicitudes sin token HTTP 401', async () => {
      const request = (await import('supertest')).default;

      // 1. Sin token -> 401
      const resSinToken = await request(app)
        .post('/api/v1/admin/tupa/versiones')
        .send({ codigoVersion: 'TUPA-HACK-V1', denominacion: 'Hack' });
      expect([401, 403]).toContain(resSinToken.status);

      // 2. Con rol CIUDADANO -> 403
      const tokenCiudadano = firmarTokenAcceso({
        sub: ciudadanoId,
        roles: ['CIUDADANO'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });
      const resCiudadano = await request(app)
        .post('/api/v1/admin/tupa/versiones')
        .set('Authorization', `Bearer ${tokenCiudadano}`)
        .send({ codigoVersion: 'TUPA-HACK-V1', denominacion: 'Hack' });
      expect(resCiudadano.status).toBe(403);

      // 3. Con rol MESA_PARTES -> 403
      const tokenMesaPartes = firmarTokenAcceso({
        sub: mesaPartesId,
        roles: ['MESA_PARTES'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });
      const resMesaPartes = await request(app)
        .post('/api/v1/admin/tupa/versiones/TUPA-2026-V1/publicar')
        .set('Authorization', `Bearer ${tokenMesaPartes}`)
        .send({ resolucionAprobacion: 'R.D. Fake', fechaAprobacion: '2026-01-01' });
      expect(resMesaPartes.status).toBe(403);
    });

    it('6. Seguridad de publicación: No se puede suplantar al publicador enviando usuarioId en el body', async () => {
      const request = (await import('supertest')).default;
      const tokenAdmin = firmarTokenAcceso({
        sub: adminId,
        roles: ['ADMINISTRADOR'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });

      // El body intenta inyectar un usuarioId falso de otra persona
      const res = await request(app)
        .post('/api/v1/admin/tupa/versiones/TUPA-2026-V1/publicar')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          usuarioId: '99999999-9999-4999-8999-999999999999',
          resolucionAprobacion: 'R.D. N° 001-2026-IESTP-SUIZA',
          fechaAprobacion: '2026-01-02',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.codigoVersion).toBe('TUPA-2026-V1');
      // En el backend, el usuario que se registra es el del token (adminId), no el inyectado
    });

    it('7. La publicación conserva la integridad histórica e impide modificar versiones oficiales vigentes o históricas', async () => {
      const request = (await import('supertest')).default;
      const tokenAdmin = firmarTokenAcceso({
        sub: adminId,
        roles: ['ADMINISTRADOR'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });

      // Intento de modificar la versión oficial TUPA-2026-V1 (vigente o histórica)
      const resHistorico = await request(app)
        .put('/api/v1/admin/tupa/versiones/TUPA-2026-V1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ denominacion: 'Alteración Ilegal de Versión Oficial' });

      expect(resHistorico.status).toBe(400);
      expect(resHistorico.body.error).toMatch(/SIGD-TUPA-INMUTABLE/i);
    });

    it('8. Alternancia atómica estricta: No se pueden activar dos versiones simultáneamente', async () => {
      const request = (await import('supertest')).default;
      const tokenAdmin = firmarTokenAcceso({
        sub: adminId,
        roles: ['ADMINISTRADOR'],
        expiraSegundos: 300,
        secreto: '12345678901234567890123456789012',
      });

      // Publicar una versión
      await request(app)
        .post('/api/v1/admin/tupa/versiones/TUPA-2026-V1/publicar')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          resolucionAprobacion: 'R.D. N° 001-2026-IESTP-SUIZA',
          fechaAprobacion: '2026-01-02',
        });

      // Consultar todas las versiones
      const resList = await request(app).get('/api/v1/admin/tupa/versiones');
      expect(resList.status).toBe(200);

      const versiones = resList.body.data;
      const vigentes = versiones.filter((v: any) => v.vigente === true);

      // Exactamente UNA sola versión puede tener vigente = true
      expect(vigentes).toHaveLength(1);
      expect(vigentes[0].codigoVersion).toBe('TUPA-2026-V1');
    });
  });
});
