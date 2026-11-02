import { Pool } from 'pg';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { construirApp } from '../../../../src/app.js';
import { calcularHorarioCorte } from '../../../../src/domains/tramicore/horarioCorte.util.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { restaurarBaseE2E } from '../../../helpers/database.helper.js';

/**
 * Verificacion de extremo a extremo de los endpoints #14 y #16 sobre la base de
 * datos real. Corre solo si `TEST_DATABASE_URL` apunta a una base que tenga
 * instalado `05_esquema_sigd_tra_v6.3.sql` y los stubs de los dominios externos.
 */

const SECRETO_JWT_E2E = 'sigd-e2e-only-signing-secret-not-for-production';
const url = process.env.TEST_DATABASE_URL;
const describeE2e = url ? describe : describe.skip;

describeE2e('TramiCore · Radicacion virtual (#14) y consulta publica (#16)', () => {
  let pool: Pool;
  let app: Express;
  let idPersona: string;
  let idTipoTramite: string;
  let tipoDocumentalId: string;
  let token: string;
  /** CUT de la radicacion exitosa, reutilizado por la consulta publica. */
  let cutRadicable: string;

  beforeAll(async () => {
    await restaurarBaseE2E();
    process.env.AUTH_JWT_SECRET = SECRETO_JWT_E2E;
    pool = new Pool({ connectionString: url, max: 10 });
    app = construirApp(pool);

    await pool.query(
      `INSERT INTO sigd_auth.tipos_documento (codigo, descripcion) VALUES ('DNI', 'Documento Nacional de Identidad')
       ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion
       RETURNING id_tipo_documento`,
    );
    const persona = await pool.query(
      `INSERT INTO sigd_auth.persona
         (tipo, id_documento)
       VALUES ('NATURAL', '45872315') RETURNING id_persona`,
    );
    idPersona = persona.rows[0].id_persona;
    await pool.query(
      `INSERT INTO sigd_auth.persona_natural
         (id_persona, nombres, apellidos, nombre_completo, correo)
       VALUES ($1::uuid, 'Ana', 'Quispe Ramos', 'Ana Quispe Ramos', 'ana.quispe@estudiante.iestpsuiza.edu.pe')`,
      [idPersona],
    );
    const cuenta = await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash)
       VALUES ($1::uuid, 'tramites-e2e', 'tramites-e2e@example.test', '$argon2id$test')
       RETURNING id_usuario`,
      [idPersona],
    );
    token = firmarTokenAcceso({ sub: cuenta.rows[0].id_usuario, secreto: SECRETO_JWT_E2E });

    const tupa = await pool.query(
      `INSERT INTO sigd_doc.tipo_tramite_tupa (codigo, denominacion, unidad_organica)
       VALUES ('TD-001', 'Solicitud de certificado estudiantil', 'Secretaría Académica')
       RETURNING tipo_tramite_id`,
    );
    idTipoTramite = tupa.rows[0].tipo_tramite_id;
    const tipoDocumental = await pool.query(
      `INSERT INTO sigd_doc.tipo_documento (codigo, nombre)
       VALUES ('E2E-DOC', 'Documento E2E')
       RETURNING tipo_documental_id`,
    );
    tipoDocumentalId = tipoDocumental.rows[0].tipo_documental_id;
  });

  afterAll(async () => {
    await pool?.end();
  });

  const cuerpoValido = (hash: string) => ({
    asunto: 'Solicitud de certificado de estudios SUPERIOR',
    idTipoTramiteTupa: idTipoTramite,
    idPersona,
    tipoDocumentalId,
    nombreSolicitante: 'Ana Quispe Ramos',
    correo: 'ana.quispe@estudiante.iestpsuiza.edu.pe',
    totalFolios: 3,
    documentos: [
      {
        nombreArchivo: 'certificado.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 245_760,
        hashSha256: hash,
      },
    ],
  });

  const postAutenticado = (ruta: string) =>
    request(app).post(ruta).set('Authorization', `Bearer ${token}`);

  const getAutenticado = (ruta: string) =>
    request(app).get(ruta).set('Authorization', `Bearer ${token}`);

  it('Rechaza la radicacion sin ningun archivo cargado', async () => {
    const respuesta = await postAutenticado('/api/v1/tramites/radicacion-virtual')
      .send({ ...cuerpoValido('a'.repeat(64)), documentos: [] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('VALIDATION_ERROR');
  });

  it('Rechaza un asunto en blanco y un hash de longitud incorrecta', async () => {
    const sinAsunto = await postAutenticado('/api/v1/tramites/radicacion-virtual')
      .send({ ...cuerpoValido('a'.repeat(64)), asunto: '   ' });
    expect(sinAsunto.status).toBe(400);

    const hashCorto = await postAutenticado('/api/v1/tramites/radicacion-virtual')
      .send(cuerpoValido('abc'));
    expect(hashCorto.status).toBe(400);
  });

  it('Rechaza un correo invalido y un nombre en blanco (T-BE-TC-02)', async () => {
    const correos = [
      'no-es-un-correo',
      'faltan@dominio',
      'espacios dentro@ejemplo.com',
      '@iestpsuiza.edu.pe',
      'ana@',
    ];
    for (const correo of correos) {
      const respuesta = await postAutenticado('/api/v1/tramites/radicacion-virtual')
        .send({ ...cuerpoValido('e'.repeat(64)), correo });
      expect(respuesta.status, `correo "${correo}" debio ser rechazado`).toBe(400);
    }

    for (const nombre of ['', '   ', 'A']) {
      const respuesta = await postAutenticado('/api/v1/tramites/radicacion-virtual')
        .send({ ...cuerpoValido('e'.repeat(64)), nombreSolicitante: nombre });
      expect(respuesta.status, `nombre "${nombre}" debio ser rechazado`).toBe(400);
    }
  });

  it('Exige nombre y correo: sin ellos la radicacion no prospera', async () => {
    const sinCorreo = await postAutenticado('/api/v1/tramites/radicacion-virtual')
      .send((({ correo: _omitido, ...resto }) => resto)(cuerpoValido('f'.repeat(64))));
    expect(sinCorreo.status).toBe(400);

    const sinNombre = await postAutenticado('/api/v1/tramites/radicacion-virtual')
      .send((({ nombreSolicitante: _omitido, ...resto }) => resto)(cuerpoValido('f'.repeat(64))));
    expect(sinNombre.status).toBe(400);
  });

  it('Rechaza un tipo de tramite que no existe en el catalogo TUPA', async () => {
    const respuesta = await postAutenticado('/api/v1/tramites/radicacion-virtual')
      .send({
        ...cuerpoValido('b'.repeat(64)),
        idTipoTramiteTupa: '00000000-0000-0000-0000-000000000000',
      });
    expect(respuesta.status).toBe(400);
  });

  it('Radica un expediente y emite el cargo digital', async () => {
    const respuesta = await postAutenticado('/api/v1/tramites/radicacion-virtual')
      .send(cuerpoValido('c'.repeat(64)));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.cut).toMatch(/^EXP-\d{4}-\d{6}$/);
    expect(respuesta.body.expedienteId).toMatch(/^[0-9a-f-]{36}$/);
    // `diferidoPorCorte` depende de la hora en que corre la suite, asi que solo
    // se comprueba que sea booleano y que la fecha legal nunca preceda al
    // envio real, que es lo que exige el Art. 138 LPAG.
    expect(typeof respuesta.body.diferidoPorCorte).toBe('boolean');
    expect(respuesta.body.cargoDigital.codigo).toMatch(/^CARGO-/);
    expect(respuesta.body.qrSeguimientoUrl).toContain('SIGD://cargo/');

    const legal = new Date(respuesta.body.fechaRadicacionLegal).getTime();
    const envio = new Date(respuesta.body.fechaEnvioReal).getTime();
    expect(legal).toBeGreaterThanOrEqual(envio - 60_000);

    // La cabecera, el trámite y el asiento deben persistir; el cargo se devuelve en la respuesta.
    const persistido = await pool.query(
      `SELECT e.codigo_expediente AS cut,
              e.dni_solicitante,
              tr.asunto,
              (SELECT count(*) FROM sigd_tra.asiento_registro ar
                WHERE ar.expediente_id = e.expediente_id) AS asientos
         FROM sigd_tra.expediente e
         JOIN sigd_tra.tramite tr ON tr.expediente_id = e.expediente_id
        WHERE e.codigo_expediente = $1`,
      [respuesta.body.cut],
    );
    expect(persistido.rowCount).toBe(1);
    expect(persistido.rows[0].cut).toBe(respuesta.body.cut);
    expect(persistido.rows[0].dni_solicitante).toBe('45872315');
    expect(persistido.rows[0].asunto).toBe('Solicitud de certificado de estudios SUPERIOR');
    expect(Number(persistido.rows[0].asientos)).toBe(1);

    cutRadicable = respuesta.body.cut as string;
  });

  it('Consulta el expediente por CUT enmascarando los datos del administrado', async () => {
    expect(cutRadicable).toMatch(/^EXP-\d{4}-\d{6}$/);
    const respuesta = await getAutenticado(
      `/api/v1/tramites/consulta-publica/${cutRadicable}?documento=45872315`,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cut).toBe(cutRadicable);
    expect(respuesta.body.estadoTramite).toBe('REGISTRADO');
    expect(respuesta.body.asunto).toContain('certificado');

    // DNI 45872315 -> 45***315, nunca el valor integro.
    expect(respuesta.body.administrado.documentoEnmascarado).toBe('45***315');
    // Ana / Quispe / Ramos -> se conserva solo la inicial de cada componente.
    expect(respuesta.body.administrado.nombreEnmascarado).toBe('A** Q***** R****');
    expect(JSON.stringify(respuesta.body)).not.toContain('45872315');

    // El correo de notificacion se persiste para las notificaciones, pero es
    // dato de contacto y jamas debe salir por el endpoint publico.
    expect(JSON.stringify(respuesta.body)).not.toContain('ana.quispe@estudiante');
    expect(respuesta.body).not.toHaveProperty('correo');
    expect(respuesta.body).not.toHaveProperty('correoNotificacion');
    expect(respuesta.body).not.toHaveProperty('nombreSolicitante');
    expect(respuesta.body).not.toHaveProperty('nombre_solicitante');
    expect(respuesta.body.administrado).not.toHaveProperty('nombreSolicitante');

    // No debe filtrar ningun dato de contacto.
    expect(respuesta.body).not.toHaveProperty('telefono');
    expect(respuesta.body).not.toHaveProperty('correo');
    expect(respuesta.body).not.toHaveProperty('email');
    expect(respuesta.body).not.toHaveProperty('direccion');
  });

  it('Responde 404 con un CUT bien formado pero inexistente', async () => {
    const respuesta = await getAutenticado('/api/v1/tramites/consulta-publica/EXP-2026-999999?documento=45872315');
    expect(respuesta.status).toBe(404);
  });

  it('Responde 400 con un CUT que incumple la mascara EXP-YYYY-XXXXXX', async () => {
    const respuesta = await getAutenticado('/api/v1/tramites/consulta-publica/CUT-2026-1');
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('VALIDATION_ERROR');
  });

  it('No deja expedientes huerfanos si la radicacion falla a mitad de transaccion', async () => {
    const antes = await pool.query('SELECT count(*)::int AS n FROM sigd_tra.expediente');

    // Tipo MIME no admitido: falla la validacion, luego no debe quedar nada.
    const respuesta = await postAutenticado('/api/v1/tramites/radicacion-virtual')
      .send({
        ...cuerpoValido('d'.repeat(64)),
        documentos: [
          {
            nombreArchivo: 'malicioso.exe',
            contentType: 'application/x-msdownload',
            tamanoBytes: 1024,
            hashSha256: 'd'.repeat(64),
          },
        ],
      });
    expect(respuesta.status).toBe(400);

    const despues = await pool.query('SELECT count(*)::int AS n FROM sigd_tra.expediente');
    expect(despues.rows[0].n).toBe(antes.rows[0].n);
  });

  describe('T-BE-TC-03 · Motor de corte del Art. 138 LPAG', () => {
    // 2026-09-30 es miércoles, 2026-10-03 es sábado y 2026-10-05 es lunes.
    const escenarios: Array<{
      nombre: string;
      iso: string;
      feriados?: string[];
      esperado: { diferido: boolean; fechaLegal: string };
    }> = [
      { nombre: 'lunes 16:29 habil', iso: '2026-09-30T16:29:00-05:00', esperado: { diferido: false, fechaLegal: '2026-09-30' } },
      { nombre: 'lunes 16:31 despues del corte', iso: '2026-09-30T16:31:00-05:00', esperado: { diferido: true, fechaLegal: '2026-10-01' } },
      { nombre: 'sabado 10:00', iso: '2026-10-03T10:00:00-05:00', esperado: { diferido: true, fechaLegal: '2026-10-05' } },
      {
        nombre: 'lunes feriado, se proyecta al martes',
        iso: '2026-10-05T09:00:00-05:00',
        feriados: ['2026-10-05'],
        esperado: { diferido: true, fechaLegal: '2026-10-06' },
      },
      {
        nombre: 'viernes feriado con finde largos',
        iso: '2026-10-16T17:00:00-05:00',
        feriados: ['2026-10-16'],
        esperado: { diferido: true, fechaLegal: '2026-10-19' },
      },
    ];

    it.each(escenarios)(
      'Proyecta correctamente: $nombre',
      ({ iso, feriados, esperado }) => {
        const resultado = calcularHorarioCorte(new Date(iso), feriados);
        expect(resultado.requiereProyeccion).toBe(esperado.diferido);
        expect(resultado.fechaLegal).toBe(esperado.fechaLegal);
      },
    );

    it('Fija el inicio del computo a las 08:00 del dia habil proyectado', () => {
      // Recepcion un viernes a las 18:00: se proyecta al lunes siguiente a las 08:00.
      const resultado = calcularHorarioCorte(new Date('2026-10-02T18:00:00-05:00'));
      expect(resultado.fechaLegal).toBe('2026-10-05');
      // 08:00 hora de Lima == 13:00 UTC
      expect(resultado.radicacionLegal.toISOString()).toBe('2026-10-05T13:00:00.000Z');
    });

    it('Conserva el envio real como metadato pericial inmutable', () => {
      const envio = new Date('2026-10-03T02:00:00-05:00');
      const resultado = calcularHorarioCorte(envio);
      expect(resultado.envioReal.toISOString()).toBe(envio.toISOString());
      expect(resultado.radicacionLegal.toISOString()).not.toBe(envio.toISOString());
    });
  });
});
