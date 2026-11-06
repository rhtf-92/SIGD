import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';
import { VentanillaPresencialService } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';
import {
  radicacionVirtualSchema,
  ventanillaPresencialSchema,
} from '../../../../src/domains/tramicore/tramites.schemas.js';

/**
 * Suite de Integración Automatizada E2E — Milestone 3 & M4 (worker_o9_m3)
 * Certificación de Radicación Multi-Procedimiento TUPA y Ciclo de Vida Institucional
 *
 * Cobertura de procedimientos:
 *  - TUPA-01: Certificados oficiales de estudio
 *  - TUPA-02: Convalidación de unidades didácticas
 *  - TUPA-03: Titulación profesional técnica
 *  - TUPA-04: Rectificación de matrícula
 *  - TUPA-48: Otros servicios y alquileres
 *  - LIBRE-01: Trámite Institucional General No Tarifado
 *
 * Canales:
 *  1. Mesa de Partes Virtual (24x7) con corte legal 16:30 hrs y cargo digital S3/SHA-256
 *  2. Ventanilla Presencial con ticket térmico POS ESC/POS y foliación AGN
 */

describe('Fullstack E2E Integration Suite — Radicación TUPA & Trámite Lifecycle (M3/M4)', () => {
  const dummyHashA = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const dummyHashB = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

  const PROCEDIMIENTOS_CANONICOS = [
    {
      codigo: 'TUPA-01',
      uuid: '00000000-0000-0000-0001-000000000001',
      denominacion: 'Certificado de estudios',
      unidadOrganica: 'Secretaría Académica',
      plazoDias: 5,
      silencio: 'POSITIVO',
      folios: 3,
      arancel: 'S/. 11.00 por semestre; S/. 2.00',
    },
    {
      codigo: 'TUPA-02',
      uuid: '00000000-0000-0000-0001-000000000002',
      denominacion: 'Convalidación de asignaturas',
      unidadOrganica: 'Coordinación de Área Académica',
      plazoDias: 15,
      silencio: 'POSITIVO',
      folios: 8,
      arancel: 'S/. 25.00 por asignatura interna; S/. 30.00 externa',
    },
    {
      codigo: 'TUPA-03',
      uuid: '00000000-0000-0000-0001-000000000003',
      denominacion: 'Titulación profesional técnica',
      unidadOrganica: 'Dirección General / Secretaría Académica',
      plazoDias: 30,
      silencio: 'NEGATIVO',
      folios: 25,
      arancel: 'S/. 3.00',
    },
    {
      codigo: 'TUPA-04',
      uuid: '00000000-0000-0000-0001-000000000004',
      denominacion: 'Rectificación de matrícula',
      unidadOrganica: 'Secretaría Académica',
      plazoDias: 3,
      silencio: 'POSITIVO',
      folios: 2,
      arancel: 'S/. 3.00',
    },
    {
      codigo: 'TUPA-48',
      uuid: '00000000-0000-0000-0001-000000000048',
      denominacion: 'Otros servicios y alquileres',
      unidadOrganica: 'Unidad de Administración',
      plazoDias: 10,
      silencio: 'POSITIVO',
      folios: 4,
      arancel: 'Tarifas según servicio y alquiler',
    },
    {
      codigo: 'LIBRE-01',
      uuid: '00000000-0000-0000-0001-000000000099',
      denominacion: 'Solicitud Formal General',
      unidadOrganica: 'Mesa de Partes General',
      plazoDias: 30,
      silencio: 'POSITIVO',
      folios: 1,
      arancel: 'Gratuito',
    },
  ];

  function crearMockPool(cutGenerado = 'EXP-2026-000301') {
    const fakeClient = {
      query: vi.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
          const parametro = params?.[0];
          const proc = PROCEDIMIENTOS_CANONICOS.find(
            (p) => p.codigo === parametro || p.uuid === parametro,
          ) ?? PROCEDIMIENTOS_CANONICOS[0];
          return {
            rows: [
              {
                tipo_tramite_id: proc.uuid,
                codigo: proc.codigo,
                denominacion: proc.denominacion,
                unidad_organica: proc.unidadOrganica,
                plazo_dias: proc.plazoDias,
                silencio_administrativo: proc.silencio,
                vigente: true,
              },
            ],
          };
        }

        if (sql.includes('FROM sigd_auth.persona')) {
          return {
            rows: [{ id_persona: '00000000-0000-0000-0002-000000000001' }],
          };
        }

        if (sql.includes('fn_generar_cut') || sql.includes('generar_cut_expediente')) {
          return {
            rows: [{ cut: cutGenerado }],
          };
        }

        if (sql.includes('INSERT INTO sigd_doc.expediente')) {
          return {
            rows: [{ expediente_id: 'exp-doc-uuid-9999' }],
          };
        }

        if (sql.includes('INSERT INTO sigd_tra.expediente')) {
          return {
            rows: [{ expediente_id: 'exp-tra-uuid-8888' }],
          };
        }

        if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
          return { rows: [] };
        }

        if (sql.includes('INSERT INTO sigd_tra.asiento_registro')) {
          return { rows: [] };
        }

        return { rows: [] };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const fakePool = {
      connect: vi.fn(async () => fakeClient),
      query: vi.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('sigd_tra.generar_cut_expediente')) {
          return { rows: [{ cut: cutGenerado }] };
        }
        if (sql.includes('FROM sigd_tra.expediente e') && sql.includes('asiento_registro')) {
          return {
            rows: [
              {
                cut: cutGenerado,
                remitente: 'Carlos Mendoza Ríos',
                remitente_documento: '45872315',
                asunto: 'Solicitud institucional',
                folios: 5,
                fecha_asiento: '2026-10-05T10:00:00.000Z',
                hash_sha256: dummyHashA,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    return { fakePool, fakeClient };
  }

  // ===========================================================================
  // 1. CANAL MESA DE PARTES VIRTUAL: RADICACIÓN DE PROCEDIMIENTOS TUPA
  // ===========================================================================
  describe('1. Mesa de Partes Virtual — Radicación Multi-Procedimiento TUPA', () => {
    it.each(PROCEDIMIENTOS_CANONICOS)(
      'radica exitosamente el trámite %s ($codigo) mediante RadicacionVirtualService',
      async (proc) => {
        const { fakePool } = crearMockPool(`EXP-2026-${proc.codigo.replace(/[^0-9]/g, '').padStart(6, '0')}`);
        const service = new RadicacionVirtualService(fakePool, async () => []);

        // Radicación antes de corte legal (10:00 hrs)
        const fechaHoraNormal = new Date('2026-10-05T10:00:00-05:00');

        const resultado = await service.radicar(
          {
            asunto: `Petitorio formal correspondiente al procedimiento ${proc.denominacion}`,
            idTipoTramiteTupa: proc.codigo,
            idPersona: '00000000-0000-0000-0002-000000000001',
            nombreSolicitante: 'Rosa Elvira Gómez Chávez',
            correo: 'estudiante@iestpsuiza.edu.pe',
            totalFolios: proc.folios,
            documentos: [
              {
                nombreArchivo: `expediente_${proc.codigo.toLowerCase()}.pdf`,
                contentType: 'application/pdf',
                tamanoBytes: 1024 * 120,
                hashSha256: dummyHashA,
              },
            ],
          },
          fechaHoraNormal,
        );

        expect(resultado.cut).toMatch(/^EXP-2026-\d{6}$/);
        expect(resultado.fueraDeHorario).toBe(false);
        expect(resultado.totalFolios).toBe(proc.folios);
        expect(resultado.cargoDigital.hashSha256).toMatch(/^[0-9a-f]{64}$/i);
        expect(resultado.cargoDigital.qrContenido).toContain('SIGD://cargo/');
      },
    );

    it('aplica corte legal (16:30 hrs) difiriendo la fecha legal al siguiente día hábil', async () => {
      const { fakePool } = crearMockPool('EXP-2026-000888');
      const service = new RadicacionVirtualService(fakePool, async () => []);

      // Radicación posterior a corte legal (17:45 hrs)
      const fechaHoraPostCorte = new Date('2026-10-05T17:45:00-05:00');

      const resultado = await service.radicar(
        {
          asunto: 'Solicitud remitida fuera del horario administrativo',
          idTipoTramiteTupa: 'TUPA-03',
          idPersona: '74561238',
          nombreSolicitante: 'Manuel Torres',
          correo: 'mtorres@correo.pe',
          totalFolios: 12,
          documentos: [
            {
              nombreArchivo: 'expediente_titulacion.pdf',
              contentType: 'application/pdf',
              tamanoBytes: 50000,
              hashSha256: dummyHashB,
            },
          ],
        },
        fechaHoraPostCorte,
      );

      expect(resultado.fueraDeHorario).toBe(true);
      expect(resultado.mensajeLegal).toContain('Art. 138');
      expect(resultado.fechaRadicacionLegal).not.toBe(resultado.fechaEnvioReal);
    });

    it('ejecuta HTTP POST /api/v1/tramites/radicacion-virtual y alias /tramite/radicacion', async () => {
      const { fakePool } = crearMockPool('EXP-2026-000456');
      const app = construirApp(fakePool);

      const payload = {
        asunto: 'Convalidación de cursos de computación e informática',
        idTipoTramiteTupa: 'TUPA-02',
        idPersona: '00000000-0000-0000-0002-000000000001',
        nombreSolicitante: 'Lucía Benavides',
        correo: 'lucia@gmail.com',
        totalFolios: 5,
        documentos: [
          {
            nombreArchivo: 'silabos_certificados.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 25000,
            hashSha256: dummyHashA,
          },
        ],
      };

      // Endpoint canónico #14
      const resCanonico = await request(app)
        .post('/api/v1/tramites/radicacion-virtual')
        .send(payload);

      expect(resCanonico.status).toBe(201);
      expect(resCanonico.body.cut).toBe('EXP-2026-000456');
      expect(resCanonico.body).toHaveProperty('cargoDigital');
      expect(resCanonico.body.cargoDigital.qrContenido).toContain('SIGD://cargo/');

      // Alias frontend #14-alias
      const resAlias = await request(app)
        .post('/api/v1/tramite/radicacion')
        .send(payload);

      expect(resAlias.status).toBe(201);
      expect(resAlias.body.cut).toBe('EXP-2026-000456');
    });
  });

  // ===========================================================================
  // 2. CANAL VENTANILLA PRESENCIAL: RADICACIÓN FÍSICA Y TICKET POS
  // ===========================================================================
  describe('2. Ventanilla Presencial — Radicación Física y Ticket Térmico POS', () => {
    it.each(PROCEDIMIENTOS_CANONICOS)(
      'registra en ventanilla el trámite %s ($codigo) emitiendo ticket ESC/POS',
      async (proc) => {
        const { fakePool } = crearMockPool(`EXP-2026-${proc.codigo.replace(/[^0-9]/g, '').padStart(6, '0')}`);
        const service = new VentanillaPresencialService(fakePool);

        const resultado = await service.registrarExpedienteVentanilla({
          dniSolicitante: '74561238',
          datosRemitente: 'Carlos Mendoza Ríos',
          asunto: `Presentación física de expediente para ${proc.denominacion}`,
          foliosTotales: proc.folios,
          idTipoTramiteTupa: proc.uuid,
          codigoTupa: proc.codigo,
        });

        expect(resultado.cut).toMatch(/^EXP-2026-\d{6}$/);
        expect(resultado.cargo.folios).toBe(proc.folios);
        expect(resultado.cargo.qrSeguimientoUrl).toContain(resultado.cut);
        expect(resultado.ticketImpresion).toContain(resultado.cut);
        expect(resultado.ticketImpresion).toContain('FIRMA RECEPCION');
        expect(resultado.ticketImpresion).toContain('MESA DE PARTES FISICA');
      },
    );

    it('ejecuta HTTP POST /api/v1/tramites/ventanilla-presencial con payload estructurado', async () => {
      const { fakePool } = crearMockPool('EXP-2026-000789');
      const app = construirApp(fakePool);

      const res = await request(app)
        .post('/api/v1/tramites/ventanilla-presencial')
        .send({
          dniSolicitante: '88776655',
          datosRemitente: 'Asociación de Egresados IESTP Suiza',
          asunto: 'Solicitud formal para uso de auditorio institucional',
          foliosTotales: 6,
          codigoTupa: 'TUPA-48',
          idTipoTramiteTupa: '00000000-0000-0000-0001-000000000048',
        });

      expect(res.status).toBe(201);
      expect(res.body.cut).toBe('EXP-2026-000789');
      expect(res.body.cargo.remitente).toBe('Asociación de Egresados IESTP Suiza');
      expect(res.body.ticketImpresion).toBeDefined();
    });

    it('consulta cargo presencial en GET /api/v1/tramites/ventanilla/cargo/:cut', async () => {
      const { fakePool } = crearMockPool('EXP-2026-000789');
      const app = construirApp(fakePool);

      const res = await request(app).get('/api/v1/tramites/ventanilla/cargo/EXP-2026-000789');

      expect(res.status).toBe(200);
      expect(res.body.cut).toBe('EXP-2026-000789');
      expect(res.body.remitente).toBe('Carlos Mendoza Ríos');
      expect(res.body.dni).toBe('45872315');
      expect(res.body.folios).toBe(5);
    });
  });

  // ===========================================================================
  // 3. VALIDACIÓN ESTRICTA Y CASOS ADVERSARIALES DE RADICACIÓN
  // ===========================================================================
  describe('3. Validación Estricta de Esquemas Zod y Casos Adversariales', () => {
    it('rechaza radicación con nil UUID en tipo de trámite', () => {
      const res = radicacionVirtualSchema.safeParse({
        asunto: 'Solicitud con identificador prohibido nil UUID',
        idTipoTramiteTupa: '00000000-0000-0000-0000-000000000000',
        idPersona: '74561238',
        nombreSolicitante: 'Juan Pérez',
        correo: 'juan@correo.pe',
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'adjunto.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 2048,
            hashSha256: dummyHashA,
          },
        ],
      });
      expect(res.success).toBe(false);
    });

    it('rechaza radicación con documentos con hashes SHA-256 duplicados', () => {
      const res = radicacionVirtualSchema.safeParse({
        asunto: 'Solicitud con archivos idénticos duplicados',
        idTipoTramiteTupa: 'TUPA-01',
        idPersona: '74561238',
        nombreSolicitante: 'Juan Pérez',
        correo: 'juan@correo.pe',
        totalFolios: 2,
        documentos: [
          {
            nombreArchivo: 'archivo1.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: dummyHashA,
          },
          {
            nombreArchivo: 'archivo2.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: dummyHashA, // DUPLICADO
          },
        ],
      });
      expect(res.success).toBe(false);
    });

    it('rechaza ventanilla presencial con DNI de longitud incorrecta o letras', () => {
      expect(
        ventanillaPresencialSchema.safeParse({
          dniSolicitante: '1234567', // 7 dígitos
          datosRemitente: 'Carlos',
          asunto: 'Petitorio general',
          foliosTotales: 1,
        }).success,
      ).toBe(false);

      expect(
        ventanillaPresencialSchema.safeParse({
          dniSolicitante: '12345678A', // contiene letra
          datosRemitente: 'Carlos',
          asunto: 'Petitorio general',
          foliosTotales: 1,
        }).success,
      ).toBe(false);
    });

    it('rechaza folios iguales a cero o negativos en ventanilla presencial', () => {
      expect(
        ventanillaPresencialSchema.safeParse({
          dniSolicitante: '74561238',
          datosRemitente: 'Carlos',
          asunto: 'Petitorio general',
          foliosTotales: 0,
        }).success,
      ).toBe(false);

      expect(
        ventanillaPresencialSchema.safeParse({
          dniSolicitante: '74561238',
          datosRemitente: 'Carlos',
          asunto: 'Petitorio general',
          foliosTotales: -5,
        }).success,
      ).toBe(false);
    });
  });
});
