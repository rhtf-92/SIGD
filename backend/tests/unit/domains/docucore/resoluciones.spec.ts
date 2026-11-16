import { describe, expect, it, vi, beforeEach } from 'vitest';
// Isolate the existing projection contract; the real economic guard is tested separately.
vi.mock('../../../../src/domains/tramicore/demoPago.js', () => ({ exigirSinPagoDemoPendiente: vi.fn().mockResolvedValue(undefined) }));
import type { Pool } from 'pg';
import request from 'supertest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import express from 'express';
import {
  crearServicioResoluciones,
  crearRepositorioResoluciones,
  renderizarResolucionHTML,
  type RepositorioProyectoResolucion,
  type ProyectoResolucionAGuardar,
  type ProyectoResolucion,
} from '../../../../src/domains/docucore/resoluciones.service.js';
import { crearRouterResoluciones } from '../../../../src/domains/docucore/resoluciones.controller.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('AF-24 — Bloqueo B: Despacho Proyección de Resoluciones & Compatibilidad DDL', () => {
  describe('1. Renderizado normativo de hoja A4 y estructura institucional', () => {
    it('1.1 Genera el HTML oficial con membrete del IESTP Suiza, vistos, considerandos y artículos', () => {
      const html = renderizarResolucionHTML({
        numero: 'RD-2026-000001',
        tipoResolucion: 'DIRECTORAL_TITULACION',
        visto: 'El expediente N° EXP-2026-000001 sobre expedición de Título Profesional...',
        considerandos: [
          'Que el solicitante ha aprobado satisfactoriamente todos los módulos.',
          'Que la Comisión de Titulación emitió dictamen favorable.',
        ],
        articulos: [
          { numero: 1, texto: 'APROBAR la expedición del Título Profesional Técnico.' },
          { numero: 2, texto: 'DISPONER la inscripción en el Libro de Títulos del IESTP Suiza.' },
        ],
        distribucion: ['Dirección General', 'Secretaría Académica', 'Interesado'],
      });

      expect(html).toContain('INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"');
      expect(html).toContain('RESOLUCION DIRECTORAL DE TITULACION');
      expect(html).toContain('N° RD-2026-000001');
      expect(html).toContain('VISTO:');
      expect(html).toContain('CONSIDERANDO:');
      expect(html).toContain('SE RESUELVE:');
      expect(html).toContain('1.&nbsp;</p>');
      expect(html).toContain('DISTRIBUCION');
      expect(html).toContain('Dirección General');
      expect(html).toContain('REGISTRESE, COMUNIQUESE Y ARCHIVESE.');
      expect(html).toContain('width: 210mm; min-height: 297mm;'); // Geometría A4 estricta
    });
  });

  describe('2. Servicio de Resoluciones con Repositorio Aislado (Flujo Funcional en Memoria)', () => {
    let repoMemoria: RepositorioProyectoResolucion;
    let almacenamiento: Map<string, ProyectoResolucion>;
    let contadorSecuencia: number;

    beforeEach(() => {
      almacenamiento = new Map();
      contadorSecuencia = 0;
      repoMemoria = {
        async asignarNumeroAnual(anio: number) {
          contadorSecuencia++;
          return `RD-${anio}-${String(contadorSecuencia).padStart(6, '0')}`;
        },
        async guardar(proyecto: ProyectoResolucionAGuardar) {
          const id = proyecto.id || '11111111-2222-4333-8444-555555555555';
          const guardado: ProyectoResolucion = {
            ...proyecto,
            id,
            creadoEn: new Date().toISOString(),
          };
          almacenamiento.set(id, guardado);
          return guardado;
        },
        async obtenerPorId(id: string) {
          return almacenamiento.get(id) ?? null;
        },
      };
    });

    it('2.1 Proyecta resolución, asigna correlativo anual y almacena el borrador', async () => {
      const servicio = crearServicioResoluciones({} as unknown as Pool, repoMemoria);
      const resultado = await servicio.proyectar({
        expedienteId: '99999999-8888-4777-8666-555555555555',
        tipoResolucion: 'DIRECTORAL_CONVALIDACION',
        visto: 'El expediente de convalidación académica presentado por el estudiante.',
        considerandos: ['Que la normativa de convalidaciones cumple la RVM N° 277-2019-MINEDU.'],
        articulos: [{ numero: 1, texto: 'CONVALIDAR las unidades didácticas solicitadas.' }],
        distribucion: ['Jefatura de Unidad Académica'],
        usuarioId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      });

      expect(resultado.id).toBe('11111111-2222-4333-8444-555555555555');
      expect(resultado.numero).toBe(`RD-${new Date().getFullYear()}-000001`);
      expect(resultado.estado).toBe('BORRADOR');
      expect(resultado.html).toContain('CONVALIDAR las unidades didácticas');

      // Consulta por ID
      const recuperado = await servicio.obtenerProyectoPorId(resultado.id);
      expect(recuperado.id).toBe(resultado.id);
      expect(recuperado.visto).toBe(resultado.visto);
    });

    it('2.2 Lanza NotFoundError cuando el ID consultado no existe', async () => {
      const servicio = crearServicioResoluciones({} as unknown as Pool, repoMemoria);
      await expect(
        servicio.obtenerProyectoPorId('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrowError(/no encontrado/);
    });

    it('2.3 Actualiza un borrador existente con el mismo identificador conservando número y actualizando HTML', async () => {
      const servicio = crearServicioResoluciones({} as unknown as Pool, repoMemoria);
      const creado = await servicio.proyectar({
        expedienteId: '99999999-8888-4777-8666-555555555555',
        tipoResolucion: 'DIRECTORAL_CONVALIDACION',
        visto: 'El expediente de convalidación académica inicial.',
        considerandos: ['Considerando inicial.'],
        articulos: [{ numero: 1, texto: 'Texto inicial.' }],
      });

      const actualizado = await servicio.actualizarProyecto(creado.id, {
        visto: 'El expediente de convalidación académica rectificado.',
        considerandos: ['Considerando rectificado.', 'Nuevo considerando.'],
        articulos: [{ numero: 1, texto: 'Texto rectificado.' }],
      });

      expect(actualizado.id).toBe(creado.id);
      expect(actualizado.numero).toBe(creado.numero);
      expect(actualizado.visto).toBe('El expediente de convalidación académica rectificado.');
      expect(actualizado.considerandos).toHaveLength(2);
      expect(actualizado.html).toContain('Texto rectificado.');

      // Recuperación directa confirma la versión actualizada
      const recuperado = await servicio.obtenerProyectoPorId(creado.id);
      expect(recuperado.visto).toBe('El expediente de convalidación académica rectificado.');
    });

    it('2.4 Rechaza la edición si el proyecto no se encuentra en estado borrador', async () => {
      const servicio = crearServicioResoluciones({} as unknown as Pool, repoMemoria);
      const creado = await servicio.proyectar({
        expedienteId: '99999999-8888-4777-8666-555555555555',
        tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
        visto: 'Visto inicial',
        considerandos: ['Considerando inicial'],
        articulos: [{ numero: 1, texto: 'Texto inicial' }],
      });

      // Simular cambio de estado a FIRMADA
      const item = almacenamiento.get(creado.id)!;
      almacenamiento.set(creado.id, { ...item, estado: 'FIRMADA' as any });

      await expect(
        servicio.actualizarProyecto(creado.id, { visto: 'Nuevo visto no permitido' }),
      ).rejects.toMatchObject({
        code: 'RESOLUCION_ESTADO_NO_EDITABLE',
      });
    });
  });

  describe('3. Detección defensiva de incompatibilidad de esquema DDL (Fail-Closed)', () => {
    it('3.1 Cuando el esquema PostgreSQL carece de sigd_doc.proyecto_resolucion, responde 503 DESPACHO_MODELO_NO_COMPATIBLE', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              existe_proyecto: null,
              existe_secuencia: null,
            },
          ],
        }),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);

      await expect(repo.asignarNumeroAnual(2026)).rejects.toMatchObject({
        status: 503,
        code: 'DESPACHO_MODELO_NO_COMPATIBLE',
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("to_regclass('sigd_doc.proyecto_resolucion')"),
      );
    });

    it('3.2 Controlador REST traduce la incompatibilidad de esquema a HTTP 503 con formato RFC 7807', async () => {
      const token = firmarTokenAcceso({ sub: '10000000-0000-4000-8000-000000000001', roles: ['ADMINISTRADOR'] });
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('AS roles')) {
            return { rows: [{ roles: ['ADMINISTRADOR'], permisos: [{ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null }] }] };
          }
          return { rows: [{ existe_proyecto: null, existe_secuencia: null }] };
        }),
      } as unknown as Pool;

      const app = express();
      app.use(express.json());
      app.use('/api/v1/resoluciones', crearRouterResoluciones(mockPool));
      app.use(errorMiddleware);

      const respuesta = await request(app)
        .post('/api/v1/resoluciones/proyectar')
        .set('Authorization', `Bearer ${token}`)
        .send({
          expedienteId: '99999999-8888-4777-8666-555555555555',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          visto: 'El informe técnico administrativo N° 012-2026 emitido por Administración...',
          considerandos: ['Que la solicitud de viáticos cumple los requisitos normativos aplicables.'],
          articulos: [{ numero: 1, texto: 'AUTORIZAR la comisión de servicios solicitada.' }],
        });

      expect(respuesta.status).toBe(503);
      expect(respuesta.body).toMatchObject({
        code: 'DESPACHO_MODELO_NO_COMPATIBLE',
        detail: expect.stringContaining('sigd_doc.proyecto_resolucion'),
      });
    });

    it('3.3 Validaciones de entrada DTO rechazan payloads incompletos con HTTP 400 antes de tocar base de datos', async () => {
      const mockPool = { query: vi.fn() } as unknown as Pool;
      const app = express();
      app.use(express.json());
      app.use('/api/v1/resoluciones', crearRouterResoluciones(mockPool));
      app.use(errorMiddleware);

      const respuesta = await request(app)
        .post('/api/v1/resoluciones/proyectar')
        .send({
          expedienteId: 'uuid-invalido',
          tipoResolucion: 'TIPO_INEXISTENTE',
          visto: 'Corto',
          considerandos: [], // Vacío
          articulos: [],     // Vacío
        });

      expect(respuesta.status).toBe(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('3.4 Deniega peticiones anónimas sin token con HTTP 401', async () => {
      const mockPool = { query: vi.fn() } as unknown as Pool;
      const app = express();
      app.use(express.json());
      app.use('/api/v1/resoluciones', crearRouterResoluciones(mockPool));
      app.use(errorMiddleware);

      const respuesta = await request(app)
        .post('/api/v1/resoluciones/proyectar')
        .send({
          expedienteId: '99999999-8888-4777-8666-555555555555',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          visto: 'El informe técnico administrativo N° 012-2026 emitido por Administración...',
          considerandos: ['Que la solicitud de viáticos cumple los requisitos normativos aplicables.'],
          articulos: [{ numero: 1, texto: 'AUTORIZAR la comisión de servicios solicitada.' }],
        });

      expect(respuesta.status).toBe(401);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('3.5 Deniega la proyección de resoluciones al rol CIUDADANO con HTTP 403', async () => {
      const token = firmarTokenAcceso({ sub: '10000000-0000-4000-8000-000000000002', roles: ['CIUDADANO'] });
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('AS roles')) {
            return { rows: [{ roles: ['CIUDADANO'], permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null }] }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = express();
      app.use(express.json());
      app.use('/api/v1/resoluciones', crearRouterResoluciones(mockPool));
      app.use(errorMiddleware);

      const respuesta = await request(app)
        .post('/api/v1/resoluciones/proyectar')
        .set('Authorization', `Bearer ${token}`)
        .send({
          expedienteId: '99999999-8888-4777-8666-555555555555',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          visto: 'El informe técnico administrativo N° 012-2026 emitido por Administración...',
          considerandos: ['Que la solicitud de viáticos cumple los requisitos normativos aplicables.'],
          articulos: [{ numero: 1, texto: 'AUTORIZAR la comisión de servicios solicitada.' }],
        });

      expect(respuesta.status).toBe(403);
    });
  });

  describe('4. Sincronización canónica e integridad referencial de expedientes (AF-31)', () => {
    const idValido = '99999999-8888-4777-8666-555555555555';
    const cutValido = 'EXP-2026-000001';
    const tupaIdValido = '00000000-0000-0000-0000-000000000001';

    it('4.1 La persistencia de una resolución para un expediente no sincronizado consulta sigd_doc.tipo_tramite_tupa (y nunca la relación obsoleta tipo_tramite)', async () => {
      const sentenciasEjecutadas: string[] = [];
      const mockCliente = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          sentenciasEjecutadas.push(sql);
          if (sql.includes('BEGIN') || sql.includes('COMMIT')) {
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('SELECT EXISTS (SELECT 1 FROM sigd_doc.expediente')) {
            return { rowCount: 1, rows: [{ existe: false }] };
          }
          if (sql.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [
                {
                  expediente_id: idValido,
                  codigo_expediente: cutValido,
                  solicitante_id: '10000000-0000-4000-8000-000000000001',
                  asunto: 'Trámite de titulación profesional',
                  codigo_tramite: 'SUZ26-051',
                },
              ],
            };
          }
          if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
            return { rowCount: 1, rows: [{ tipo_tramite_id: tupaIdValido }] };
          }
          if (sql.includes('FROM sigd_doc.expediente') && sql.includes('WHERE codigo_expediente = $1')) {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('INSERT INTO sigd_doc.expediente')) {
            return {
              rowCount: 1,
              rows: [{ expediente_id: idValido }],
            };
          }
          if (sql.includes('INSERT INTO sigd_doc.resolucion')) {
            return {
              rowCount: 1,
              rows: [
                {
                  resolucion_id: '11111111-2222-4333-8444-555555555555',
                  expediente_id: idValido,
                  numero_borrador: 'RD-2026-000001',
                  numero_resolucion: 'RD-2026-000001',
                  tipo_resolucion: 'DIRECTORAL_ADMINISTRATIVA',
                  asunto: 'Asunto de prueba',
                  estado: 'BORRADOR_PENDIENTE_FIRMA',
                  fecha_proyeccion: '2026-10-27',
                  creado_en: '2026-10-27T10:00:00Z',
                },
              ],
            };
          }
          if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
            return { rowCount: 1, rows: [] };
          }
          return { rowCount: 0, rows: [] };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }],
        }),
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      await repo.guardar({
        id: '',
        numero: 'RD-2026-000001',
        tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
        expedienteId: idValido,
        estado: 'BORRADOR',
        visto: 'Visto de prueba',
        considerandos: ['Considerando 1'],
        articulos: [{ numero: 1, texto: 'Artículo 1' }],
        distribucion: ['Dirección'],
        html: '<p>HTML</p>',
      });

      // Verificación de la consulta SQL ejecutada en el cliente
      const sqlSincronizacion = sentenciasEjecutadas.find((s) =>
        s.includes('INSERT INTO sigd_doc.expediente'),
      );
      expect(sqlSincronizacion).toBeDefined();

      // Debe consultar la tabla institucional canónica del DDL: sigd_doc.tipo_tramite_tupa
      const sqlConsultaTupa = sentenciasEjecutadas.find((s) =>
        s.includes('FROM sigd_doc.tipo_tramite_tupa'),
      );
      expect(sqlConsultaTupa).toBeDefined();

      // Rechazar explícitamente el uso de la tabla inexistente sigd_doc.tipo_tramite
      expect(sentenciasEjecutadas.some((s) => /sigd_doc\.tipo_tramite(?!\w)/.test(s))).toBe(false);

      // Debe resolver correctamente las columnas canónicas de sigd_tra
      const sqlConsultaTra = sentenciasEjecutadas.find((s) =>
        s.includes('FROM sigd_tra.expediente e'),
      );
      expect(sqlConsultaTra).toContain('sigd_tra.tramite');
    });

    it('4.2 Rechaza sincronización con EXPEDIENTE_SIN_PROCEDIMIENTO_TUPA cuando el expediente carece de codigo_tramite', async () => {
      const mockCliente = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rowCount: 1, rows: [] };
          if (sql.includes('SELECT EXISTS (SELECT 1 FROM sigd_doc.expediente')) return { rowCount: 1, rows: [{ existe: false }] };
          if (sql.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [{
                expediente_id: idValido,
                codigo_expediente: cutValido,
                solicitante_id: '10000000-0000-4000-8000-000000000001',
                asunto: 'Expediente sin código TUPA',
                codigo_tramite: null, // Sin asociación TUPA
              }],
            };
          }
          return { rowCount: 0, rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }],
        }),
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      await expect(
        repo.guardar({
          id: '',
          numero: 'RD-2026-000001',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          expedienteId: idValido,
          estado: 'BORRADOR',
          visto: 'Visto',
          considerandos: ['C1'],
          articulos: [{ numero: 1, texto: 'A1' }],
          distribucion: [],
          html: '<p>HTML</p>',
        }),
      ).rejects.toMatchObject({
        code: 'EXPEDIENTE_SIN_PROCEDIMIENTO_TUPA',
      });
    });

    it('4.3 Rechaza sincronización cuando el procedimiento TUPA no existe o no está vigente en sigd_doc.tipo_tramite_tupa', async () => {
      const mockCliente = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rowCount: 1, rows: [] };
          if (sql.includes('SELECT EXISTS (SELECT 1 FROM sigd_doc.expediente')) return { rowCount: 1, rows: [{ existe: false }] };
          if (sql.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [{
                expediente_id: idValido,
                codigo_expediente: cutValido,
                solicitante_id: '10000000-0000-4000-8000-000000000001',
                asunto: 'Expediente con TUPA inválido',
                codigo_tramite: 'SUZ26-999-INEXISTENTE',
              }],
            };
          }
          if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
            return { rowCount: 0, rows: [] }; // No existe en catálogo
          }
          return { rowCount: 0, rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }],
        }),
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      await expect(
        repo.guardar({
          id: '',
          numero: 'RD-2026-000001',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          expedienteId: idValido,
          estado: 'BORRADOR',
          visto: 'Visto',
          considerandos: ['C1'],
          articulos: [{ numero: 1, texto: 'A1' }],
          distribucion: [],
          html: '<p>HTML</p>',
        }),
      ).rejects.toMatchObject({
        code: 'EXPEDIENTE_SIN_PROCEDIMIENTO_TUPA',
      });
    });

    it('4.4 Rechaza con EXPEDIENTE_IDENTIDAD_CONFLICTIVA cuando el código de expediente ya pertenece a otro identificador en DocuCore', async () => {
      const idOrigen = idValido;
      const idExistenteEnDoc = '88888888-7777-4666-8555-444444444444'; // Diferente

      const mockCliente = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rowCount: 1, rows: [] };
          if (sql.includes('SELECT EXISTS (SELECT 1 FROM sigd_doc.expediente')) return { rowCount: 1, rows: [{ existe: false }] };
          if (sql.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [{
                expediente_id: idOrigen,
                codigo_expediente: cutValido,
                solicitante_id: '10000000-0000-4000-8000-000000000001',
                asunto: 'Expediente con CUT en conflicto',
                codigo_tramite: 'SUZ26-050',
              }],
            };
          }
          if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
            return { rowCount: 1, rows: [{ tipo_tramite_id: tupaIdValido }] };
          }
          if (sql.includes('FROM sigd_doc.expediente') && sql.includes('WHERE codigo_expediente = $1')) {
            return { rowCount: 1, rows: [{ expediente_id: idExistenteEnDoc }] };
          }
          return { rowCount: 0, rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }],
        }),
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      await expect(
        repo.guardar({
          id: '',
          numero: 'RD-2026-000001',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          expedienteId: idOrigen,
          estado: 'BORRADOR',
          visto: 'Visto',
          considerandos: ['C1'],
          articulos: [{ numero: 1, texto: 'A1' }],
          distribucion: [],
          html: '<p>HTML</p>',
        }),
      ).rejects.toMatchObject({
        code: 'EXPEDIENTE_IDENTIDAD_CONFLICTIVA',
      });
    });

    it('4.5 Conserva la identidad cuando el código ya existe en DocuCore y corresponde al mismo expediente_id', async () => {
      let insertResolucionExpedienteId: string | null = null;
      const mockCliente = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rowCount: 1, rows: [] };
          if (sql.includes('SELECT EXISTS (SELECT 1 FROM sigd_doc.expediente')) return { rowCount: 1, rows: [{ existe: false }] };
          if (sql.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [{
                expediente_id: idValido,
                codigo_expediente: cutValido,
                solicitante_id: '10000000-0000-4000-8000-000000000001',
                asunto: 'Expediente con misma identidad',
                codigo_tramite: 'SUZ26-050',
              }],
            };
          }
          if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
            return { rowCount: 1, rows: [{ tipo_tramite_id: tupaIdValido }] };
          }
          if (sql.includes('FROM sigd_doc.expediente') && sql.includes('WHERE codigo_expediente = $1')) {
            return { rowCount: 1, rows: [{ expediente_id: idValido }] }; // Mismo ID
          }
          if (sql.includes('INSERT INTO sigd_doc.resolucion')) {
            insertResolucionExpedienteId = (params as any[])?.[0];
            return {
              rowCount: 1,
              rows: [{
                resolucion_id: '11111111-2222-4333-8444-555555555555',
                expediente_id: idValido,
                numero_borrador: 'RD-2026-000001',
                numero_resolucion: 'RD-2026-000001',
                tipo_resolucion: 'DIRECTORAL_ADMINISTRATIVA',
                asunto: 'Asunto de prueba',
                estado: 'BORRADOR_PENDIENTE_FIRMA',
                fecha_proyeccion: '2026-10-27',
                creado_en: '2026-10-27T10:00:00Z',
              }],
            };
          }
          if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rowCount: 1, rows: [] };
          return { rowCount: 0, rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }],
        }),
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      const res = await repo.guardar({
        id: '',
        numero: 'RD-2026-000001',
        tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
        expedienteId: idValido,
        estado: 'BORRADOR',
        visto: 'Visto',
        considerandos: ['C1'],
        articulos: [{ numero: 1, texto: 'A1' }],
        distribucion: [],
        html: '<p>HTML</p>',
      });

      expect(res.expedienteId).toBe(idValido);
      expect(insertResolucionExpedienteId).toBe(idValido);
    });

    it('4.6 Obtiene el asunto desde las fuentes canónicas disponibles de TramiCore al sincronizar', async () => {
      let insertAsuntoExpediente: string | null = null;
      const mockCliente = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rowCount: 1, rows: [] };
          if (sql.includes('SELECT EXISTS (SELECT 1 FROM sigd_doc.expediente')) return { rowCount: 1, rows: [{ existe: false }] };
          if (sql.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [{
                expediente_id: idValido,
                codigo_expediente: cutValido,
                solicitante_id: '10000000-0000-4000-8000-000000000001',
                asunto: 'Asunto Canónico Proveniente de sigd_tra.tramite',
                codigo_tramite: 'SUZ26-050',
              }],
            };
          }
          if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
            return { rowCount: 1, rows: [{ tipo_tramite_id: tupaIdValido }] };
          }
          if (sql.includes('FROM sigd_doc.expediente') && sql.includes('WHERE codigo_expediente = $1')) {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('INSERT INTO sigd_doc.expediente')) {
            insertAsuntoExpediente = (params as any[])?.[3];
            return { rowCount: 1, rows: [{ expediente_id: idValido }] };
          }
          if (sql.includes('INSERT INTO sigd_doc.resolucion')) {
            return {
              rowCount: 1,
              rows: [{
                resolucion_id: '11111111-2222-4333-8444-555555555555',
                expediente_id: idValido,
                numero_borrador: 'RD-2026-000001',
                numero_resolucion: 'RD-2026-000001',
                tipo_resolucion: 'DIRECTORAL_ADMINISTRATIVA',
                asunto: 'Asunto',
                estado: 'BORRADOR_PENDIENTE_FIRMA',
                fecha_proyeccion: '2026-10-27',
                creado_en: '2026-10-27T10:00:00Z',
              }],
            };
          }
          if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rowCount: 1, rows: [] };
          return { rowCount: 0, rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }],
        }),
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      await repo.guardar({
        id: '',
        numero: 'RD-2026-000001',
        tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
        expedienteId: idValido,
        estado: 'BORRADOR',
        visto: 'Visto alternativo',
        considerandos: ['C1'],
        articulos: [{ numero: 1, texto: 'A1' }],
        distribucion: [],
        html: '<p>HTML</p>',
      });

      expect(insertAsuntoExpediente).toBe('Asunto Canónico Proveniente de sigd_tra.tramite');
    });
  });

  describe('5. Auditoría y Robustez de Proyección de Resoluciones (Fase 8)', () => {
    it('5.1 Asignación consecutiva del correlativo anual sin saltar números (DB max=8 genera RD-2026-000009)', async () => {
      const sentencias: string[] = [];
      const mockCliente = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          sentencias.push(sql);
          if (sql.includes('SELECT COALESCE(MAX(')) {
            return { rows: [{ max_correlativo: '8' }] };
          }
          return { rowCount: 1, rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }],
        }),
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      const siguienteNumero = await repo.asignarNumeroAnual(2026);
      expect(siguienteNumero).toBe('RD-2026-000009');
      expect(sentencias.some((s) => s.includes('pg_advisory_xact_lock'))).toBe(true);
    });

    it('5.2 Detección y rechazo de solicitud duplicada para un mismo expediente (EXPEDIENTE_YA_TIENE_RESOLUCION)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('to_regclass')) {
            return { rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }] };
          }
          if (sql.includes('FROM sigd_doc.resolucion r') && sql.includes('WHERE r.expediente_id = $1::uuid')) {
            return {
              rows: [{
                resolucion_id: 'aaaaaaaa-bbbb-4ccc-8ddd-111111111111',
                numero_borrador: 'RD-2026-000009',
                numero_resolucion: 'RD-2026-000009',
                tipo_resolucion: 'DIRECTORAL_ADMINISTRATIVA',
                asunto: 'Resolución existente',
                estado: 'BORRADOR_PENDIENTE_FIRMA',
                creado_en: '2026-10-27T10:00:00Z',
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      const servicio = crearServicioResoluciones(mockPool, repo);

      await expect(
        servicio.proyectar({
          expedienteId: '9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          visto: 'Visto para expediente duplicado...',
          considerandos: ['Considerando de prueba duplicada.'],
          articulos: [{ numero: 1, texto: 'Artículo de prueba duplicada.' }],
        }),
      ).rejects.toMatchObject({
        code: 'EXPEDIENTE_YA_TIENE_RESOLUCION',
        status: 409,
      });
    });

    it('5.3 Rechazo de proyección para expediente inexistente con HTTP 404', async () => {
      const mockCliente = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rowCount: 1, rows: [] };
          if (sql.includes('SELECT EXISTS (SELECT 1 FROM sigd_doc.expediente')) return { rowCount: 1, rows: [{ existe: false }] };
          if (sql.includes('FROM sigd_tra.expediente e')) return { rowCount: 0, rows: [] };
          return { rowCount: 0, rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }],
        }),
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      await expect(
        repo.guardar({
          id: '',
          numero: 'RD-2026-000009',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          expedienteId: '00000000-0000-0000-0000-999999999999',
          estado: 'BORRADOR',
          visto: 'Visto de prueba inexistente',
          considerandos: ['Considerando 1'],
          articulos: [{ numero: 1, texto: 'Articulo 1' }],
          distribucion: [],
          html: '<p>HTML</p>',
        }),
      ).rejects.toMatchObject({
        status: 404,
      });
      expect(mockCliente.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('5.4 Rechazo por RBAC cuando el operador no pertenece al área del expediente (HTTP 403)', async () => {
      const token = firmarTokenAcceso({ sub: '10000000-0000-4000-8000-000000000099', roles: ['ESPECIALISTA'] });
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('AS roles')) {
            return {
              rows: [{
                roles: ['ESPECIALISTA'],
                permisos: [{ codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: 'area-otra-unidad-999' }],
              }],
            };
          }
          if (sql.includes('SELECT EXISTS (') && sql.includes('sigd_rut.estado_actual_expediente')) {
            return { rows: [{ autorizado: false }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = express();
      app.use(express.json());
      app.use('/api/v1/resoluciones', crearRouterResoluciones(mockPool));
      app.use(errorMiddleware);

      const respuesta = await request(app)
        .post('/api/v1/resoluciones/proyectar')
        .set('Authorization', `Bearer ${token}`)
        .send({
          expedienteId: '9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          visto: 'Expediente N° EXP-2026-000011 sobre solicitud de reincorporación...',
          considerandos: ['Considerando del operador de otra área.'],
          articulos: [{ numero: 1, texto: 'Artículo de resolución no autorizada.' }],
        });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body).toMatchObject({
        code: 'FORBIDDEN',
        detail: expect.stringContaining('área asignada'),
      });
    });

    it('5.5 Reversión transaccional completa (ROLLBACK) y cliente liberado ante fallo de inserción', async () => {
      const mockCliente = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rowCount: 1, rows: [] };
          if (sql.includes('SELECT EXISTS (SELECT 1 FROM sigd_doc.expediente')) return { rowCount: 1, rows: [{ existe: true }] };
          if (sql.includes('SELECT resolucion_id, numero_borrador, estado FROM sigd_doc.resolucion')) return { rowCount: 0, rows: [] };
          if (sql.includes('INSERT INTO sigd_doc.resolucion')) {
            throw new Error('Fallo simulado de base de datos en INSERT resolucion');
          }
          return { rowCount: 0, rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ existe_resolucion: 'sigd_doc.resolucion', existe_proyecto: null }],
        }),
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as unknown as Pool;

      const repo = crearRepositorioResoluciones(mockPool);
      await expect(
        repo.guardar({
          id: '',
          numero: 'RD-2026-000009',
          tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
          expedienteId: '9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca',
          estado: 'BORRADOR',
          visto: 'Visto con fallo de base de datos',
          considerandos: ['Considerando 1'],
          articulos: [{ numero: 1, texto: 'Artículo 1' }],
          distribucion: [],
          html: '<p>HTML</p>',
        }),
      ).rejects.toThrow('Fallo simulado de base de datos en INSERT resolucion');

      expect(mockCliente.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockCliente.release).toHaveBeenCalled();
    });
  });
});
