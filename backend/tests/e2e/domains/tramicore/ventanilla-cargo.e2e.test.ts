import { Pool } from 'pg';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { construirApp } from '../../../../src/app.js';

/**
 * Integración real de la radicación física en ventanilla (#15) y del cargo de
 * recepción física (#20).
 *
 * REQUISITOS (mismos que `tramites.e2e.test.ts`):
 *   * `TEST_DATABASE_URL` apuntando a una base con `05_esquema_sigd_tra_v6.3.sql`
 *     (TramiCore) y los esquemas de IdentiCore (`sigd_auth`) y DocuCore
 *     (`sigd_doc`) instalados.
 *
 * ESTADO: EN ROJO hasta alinear `ventanillaPresencial.service.ts` y el endpoint
 * #20 al esquema canónico v6.3. Hoy el servicio escribe en
 * `sigd_tra.asiento_registro` (tabla inexistente en v6.3) y resuelve la persona
 * por `sigd_auth.persona_natural` (contrato de IdentiCore v1). Cuando el fix
 * aterrice, estos casos deben quedar verdes sin tocar el cuerpo de las
 * aserciones (solo el seed/contrato de entrada).
 */

const url = process.env.TEST_DATABASE_URL;
const describeE2e = url ? describe : describe.skip;

describeE2e('TramiCore · Ventanilla presencial (#15) y cargo físico (#20) sobre v6.3', () => {
  let pool: Pool;
  let app: Express;
  let idPersona: number;
  let idTipoTramite: string;
  let cutVentanilla: string;

  const DNI = '45678912';
  const CORREO = 'juan.perez@iestpsuiza.edu.pe';
  const NOMBRE = 'Juan Perez Quispe';
  const ASUNTO = 'Solicitud de constancia de matriculacion';

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 5 });
    app = construirApp(pool);

    const documento = await pool.query(
      `INSERT INTO sigd_auth.tipos_documento (codigo, nombre) VALUES ('DNI', 'DNI')
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id`,
    );
    const persona = await pool.query(
      `INSERT INTO sigd_auth.persona
         (tipo_documento_id, numero_documento, nombres, apellido_paterno, apellido_materno)
       VALUES ($1, $2, 'Juan', 'Perez', 'Quispe') RETURNING id`,
      [documento.rows[0].id, DNI],
    );
    idPersona = persona.rows[0].id;

    const tupa = await pool.query(
      `INSERT INTO sigd_doc.tipo_tramite_tupa
         (id_tipo_tramite_tupa, codigo_tupa, denominacion, es_tupa, calificacion_administrativa, activo)
       VALUES (gen_random_uuid(), 'TC-900', 'Constancia de matriculacion', TRUE, 'EVALUACION_PREVIA_SAN', TRUE)
       RETURNING id_tipo_tramite_tupa`,
    );
    idTipoTramite = tupa.rows[0].id_tipo_tramite_tupa;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('#15 radica en ventanilla y persiste el expediente con canal VENTANILLA_PRESENCIAL', async () => {
    const respuesta = await request(app)
      .post('/api/v1/tramites/ventanilla-presencial')
      .send({
        dniSolicitante: DNI,
        datosRemitente: NOMBRE,
        asunto: ASUNTO,
        foliosTotales: 5,
        correo: CORREO,
        nombreSolicitante: NOMBRE,
        idTipoTramiteTupa: idTipoTramite,
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.cut).toMatch(/^EXP-\d{4}-\d{6}$/);
    expect(respuesta.body.expedienteId).toMatch(/^[0-9a-f-]{36}$/);

    const persistido = await pool.query(
      `SELECT cut, canal_recepcion, id_persona, id_tipo_tramite_tupa, nombre_solicitante, total_folios
         FROM sigd_tra.expediente
        WHERE cut = $1`,
      [respuesta.body.cut],
    );
    expect(persistido.rowCount).toBe(1);
    const fila = persistido.rows[0];
    expect(fila.canal_recepcion).toBe('VENTANILLA_PRESENCIAL');
    expect(Number(fila.id_persona)).toBe(idPersona);
    expect(fila.id_tipo_tramite_tupa).toBe(idTipoTramite);
    expect(Number(fila.total_folios)).toBe(5);

    cutVentanilla = respuesta.body.cut as string;
  });

  it('#20 devuelve el cargo físico para impresión térmica a partir del CUT', async () => {
    expect(cutVentanilla).toMatch(/^EXP-\d{4}-\d{6}$/);
    const respuesta = await request(app).get(
      `/api/v1/tramites/ventanilla/cargo/${cutVentanilla}`,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cut).toBe(cutVentanilla);
    expect(respuesta.body.folios).toBe(5);
    expect(respuesta.body.ticketTermicoTexto).toContain(cutVentanilla);
  });

  it('#20 responde 404 con un CUT bien formado pero inexistente', async () => {
    const respuesta = await request(app).get('/api/v1/tramites/ventanilla/cargo/EXP-2026-999999');
    expect(respuesta.status).toBe(404);
  });
});
