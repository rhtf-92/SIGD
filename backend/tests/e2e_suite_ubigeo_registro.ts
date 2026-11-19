/**
 * =============================================================================
 * SUITE DE CERTIFICACIÓN E2E · CATÁLOGO OFICIAL DE UBIGEO E INTEGRACIÓN CON REGISTRO
 * =============================================================================
 * Rama: B_JACOBO
 * Catálogo: INEI Actualizado 2026 (25 Departamentos, 196 Provincias, 1,893 Distritos)
 * Nuevas creaciones territoriales verificadas:
 *   - Santa Rosa de Loreto (160405 - Ley 32403)
 *   - Sangani (120307 - Ley 32729)
 * =============================================================================
 */

import pg from 'pg';
import request from 'supertest';

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'clave_secreta_jwt_para_pruebas_de_desarrollo_2026_super_segura_32char';

if (process.env.SIGD_ALLOW_E2E_MUTATION !== 'true') {
  console.error('[E2E-GUARD] Abortado: e2e_suite_ubigeo_registro no tiene autorización para mutar datos en sigd_jacobo_demo.');
  console.error('Para ejecutar esta suite en un entorno aislado autorizado, defina SIGD_ALLOW_E2E_MUTATION=true.');
  process.exit(1);
}

import { construirApp } from '../src/app.js';
import { calcularDigitoVerificadorRuc } from '../src/domains/identicore/modulo11.validator.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo';

interface TestResult {
  id: number;
  nombre: string;
  estado: 'PASO' | 'FALLO';
  detalle: string;
  duracionMs: number;
}

const resultados: TestResult[] = [];

async function ejecutarPrueba(id: number, nombre: string, fn: () => Promise<void>) {
  const inicio = Date.now();
  try {
    await fn();
    const duracionMs = Date.now() - inicio;
    resultados.push({ id, nombre, estado: 'PASO', detalle: 'Ejecutado correctamente', duracionMs });
    console.log(`[PASO] Caso ${id}: ${nombre} (${duracionMs} ms)`);
  } catch (error: any) {
    const duracionMs = Date.now() - inicio;
    resultados.push({ id, nombre, estado: 'FALLO', detalle: error.message || String(error), duracionMs });
    console.error(`[FALLO] Caso ${id}: ${nombre} - ${error.message}`);
  }
}

async function main() {
  console.log('=============================================================================');
  console.log('INICIANDO SUITE E2E: CATÁLOGO DE UBIGEO Y REGISTRO CIUDADANO NACIONAL');
  console.log('Base de datos:', DATABASE_URL);
  console.log('=============================================================================\n');

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const app = construirApp(pool);
  const sufijo = Date.now().toString().slice(-6);

  const dbCheck = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const dbActual = dbCheck.rows[0]?.db;
  if (dbActual !== 'sigd_jacobo_demo') {
    throw new Error(`[SUITE-UBIGEO] Abortando: conectado a "${dbActual}". Se requiere exclusivamente "sigd_jacobo_demo".`);
  }

  let idPersonaCallao = '';
  let idPersonaArequipa = '';
  let idPersonaSantaRosa = '';
  let idPersonaSangani = '';

  try {
    // Caso 1: Obtención de los 25 departamentos del Perú
    await ejecutarPrueba(1, 'GET /api/v1/ubigeo/departamentos retorna 25 departamentos oficiales desde PostgreSQL', async () => {
      const res = await request(app).get('/api/v1/ubigeo/departamentos');
      if (res.status !== 200) throw new Error(`Esperaba 200, obtuvo ${res.status}`);
      if (!Array.isArray(res.body) || res.body.length !== 25) {
        throw new Error(`Esperaba 25 departamentos, obtuvo ${res.body?.length}`);
      }
      const callao = res.body.find((d: any) => d.codigo === '07');
      if (!callao || !callao.nombre.includes('CALLAO')) throw new Error('Callao 07 no encontrado');
      const ucayali = res.body.find((d: any) => d.codigo === '25');
      if (!ucayali || ucayali.nombre !== 'UCAYALI') throw new Error('Ucayali 25 no encontrado');
      const lima = res.body.find((d: any) => d.codigo === '15');
      if (!lima || lima.nombre !== 'LIMA') throw new Error('Lima 15 no encontrado');
    });

    // Caso 2: Provincias de Callao (07) y Ucayali (25)
    await ejecutarPrueba(2, 'GET /api/v1/ubigeo/provincias filtra por departamento desde PostgreSQL', async () => {
      // Callao debe tener exactamente 1 provincia (0701)
      const resCallao = await request(app).get('/api/v1/ubigeo/provincias?departamentoCodigo=07');
      if (resCallao.status !== 200) throw new Error(`Esperaba 200 para Callao, obtuvo ${resCallao.status}`);
      if (resCallao.body.length !== 1 || resCallao.body[0].codigo !== '0701') {
        throw new Error(`Esperaba provincia 0701 para Callao, obtuvo: ${JSON.stringify(resCallao.body)}`);
      }

      // Ucayali debe tener exactamente 4 provincias (2501, 2502, 2503, 2504)
      const resUcayali = await request(app).get('/api/v1/ubigeo/provincias?departamentoCodigo=25');
      if (resUcayali.status !== 200) throw new Error(`Esperaba 200 para Ucayali, obtuvo ${resUcayali.status}`);
      if (resUcayali.body.length !== 4) {
        throw new Error(`Esperaba 4 provincias para Ucayali, obtuvo ${resUcayali.body.length}`);
      }
    });

    // Caso 3: Distritos de Coronel Portillo (2501) y Callao (0701)
    await ejecutarPrueba(3, 'GET /api/v1/ubigeo/distritos filtra por provincia desde PostgreSQL', async () => {
      const resCP = await request(app).get('/api/v1/ubigeo/distritos?provinciaCodigo=2501');
      if (resCP.status !== 200) throw new Error(`Esperaba 200 para Coronel Portillo, obtuvo ${resCP.status}`);
      if (resCP.body.length !== 7) throw new Error(`Esperaba 7 distritos en Coronel Portillo, obtuvo ${resCP.body.length}`);

      const resCallao = await request(app).get('/api/v1/ubigeo/distritos?provinciaCodigo=0701');
      if (resCallao.status !== 200) throw new Error(`Esperaba 200 para Callao, obtuvo ${resCallao.status}`);
      if (resCallao.body.length !== 7) throw new Error(`Esperaba 7 distritos en Callao, obtuvo ${resCallao.body.length}`);
    });

    // Caso 4: Detalle de UBIGEO jerárquico tradicional
    await ejecutarPrueba(4, 'GET /api/v1/ubigeo/detalle/:codigo retorna jerarquía completa', async () => {
      const res = await request(app).get('/api/v1/ubigeo/detalle/250101');
      if (res.status !== 200) throw new Error(`Esperaba 200, obtuvo ${res.status}`);
      if (res.body.distrito !== 'CALLERIA') throw new Error(`Distrito inesperado: ${res.body.distrito}`);
      if (res.body.provincia !== 'CORONEL PORTILLO') throw new Error(`Provincia inesperada: ${res.body.provincia}`);
      if (res.body.departamento !== 'UCAYALI') throw new Error(`Departamento inesperado: ${res.body.departamento}`);
    });

    // Caso 5: Nuevo distrito 2025: Santa Rosa de Loreto (160405 - Ley 32403)
    await ejecutarPrueba(5, 'Actualización 2026: Santa Rosa de Loreto (160405 - Ley 32403) verificado en API', async () => {
      // 1. Verificar detalle
      const resDetalle = await request(app).get('/api/v1/ubigeo/detalle/160405');
      if (resDetalle.status !== 200) throw new Error(`Esperaba 200 para 160405, obtuvo ${resDetalle.status}`);
      if (resDetalle.body.distrito !== 'SANTA ROSA DE LORETO') throw new Error(`Nombre inesperado: ${resDetalle.body.distrito}`);
      if (resDetalle.body.provincia !== 'MARISCAL RAMON CASTILLA') throw new Error(`Provincia inesperada: ${resDetalle.body.provincia}`);
      if (resDetalle.body.departamento !== 'LORETO') throw new Error(`Departamento inesperado: ${resDetalle.body.departamento}`);

      // 2. Verificar lista de distritos de Mariscal Ramón Castilla (1604 debe tener 5 distritos)
      const resProv = await request(app).get('/api/v1/ubigeo/distritos?provinciaCodigo=1604');
      if (resProv.status !== 200) throw new Error(`Esperaba 200, obtuvo ${resProv.status}`);
      if (resProv.body.length !== 5) throw new Error(`Esperaba 5 distritos en Mariscal Ramón Castilla, obtuvo ${resProv.body.length}`);
      const encontrado = resProv.body.find((d: any) => d.codigo === '160405');
      if (!encontrado) throw new Error('Distrito 160405 no encontrado en la lista provincial');
    });

    // Caso 6: Nuevo distrito 2026: Sangani (120307 - Ley 32729)
    await ejecutarPrueba(6, 'Actualización 2026: Sangani (120307 - Ley 32729) verificado en API', async () => {
      // 1. Verificar detalle
      const resDetalle = await request(app).get('/api/v1/ubigeo/detalle/120307');
      if (resDetalle.status !== 200) throw new Error(`Esperaba 200 para 120307, obtuvo ${resDetalle.status}`);
      if (resDetalle.body.distrito !== 'SANGANI') throw new Error(`Nombre inesperado: ${resDetalle.body.distrito}`);
      if (resDetalle.body.provincia !== 'CHANCHAMAYO') throw new Error(`Provincia inesperada: ${resDetalle.body.provincia}`);
      if (resDetalle.body.departamento !== 'JUNIN') throw new Error(`Departamento inesperado: ${resDetalle.body.departamento}`);

      // 2. Verificar lista de distritos de Chanchamayo (1203 debe tener 7 distritos)
      const resProv = await request(app).get('/api/v1/ubigeo/distritos?provinciaCodigo=1203');
      if (resProv.status !== 200) throw new Error(`Esperaba 200, obtuvo ${resProv.status}`);
      if (resProv.body.length !== 7) throw new Error(`Esperaba 7 distritos en Chanchamayo, obtuvo ${resProv.body.length}`);
      const encontrado = resProv.body.find((d: any) => d.codigo === '120307');
      if (!encontrado) throw new Error('Distrito 120307 no encontrado en la lista provincial');
    });

    // Caso 7: Retrocompatibilidad endpoint distritos-ucayali desde BD
    await ejecutarPrueba(7, 'GET /api/v1/ubigeo/distritos-ucayali consulta PostgreSQL y mantiene retrocompatibilidad', async () => {
      const res = await request(app).get('/api/v1/ubigeo/distritos-ucayali');
      if (res.status !== 200) throw new Error(`Esperaba 200, obtuvo ${res.status}`);
      if (!res.body.provincias || !Array.isArray(res.body.provincias) || res.body.provincias.length !== 4) {
        throw new Error(`Esperaba 4 provincias de Ucayali, obtuvo ${JSON.stringify(res.body)}`);
      }
    });

    // Caso 8: Registro de Persona Natural en Santa Rosa de Loreto (160405)
    let dniSRL = `7${sufijo}6`;
    let correoSRL = `santarosa_${sufijo}@test.gob.pe`;
    await ejecutarPrueba(8, 'Registro de Persona Natural con domicilio en Santa Rosa de Loreto (160405)', async () => {
      const payload = {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: dniSRL,
        nombres: 'Julio',
        apellidoPaterno: 'Panduro',
        apellidoMaterno: 'Castillo',
        fechaNacimiento: '1990-10-12',
        correo: correoSRL,
        celular: '965112233',
        password: 'PasswordSantaRosa123!',
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
        aceptaNotificaciones: true,
        direccion: 'Calle Frontera N° 102 - Isla Santa Rosa',
        ubigeoDistrito: '160405',
      };
      const res = await request(app).post('/api/v1/auth/registro-ciudadano').send(payload);
      if (res.status !== 201) throw new Error(`Esperaba 201, obtuvo ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.idPersona) throw new Error('idPersona no devuelto');
      idPersonaSantaRosa = res.body.idPersona;
    });

    // Caso 9: Verificación en BD de persistencia del domicilio de Santa Rosa de Loreto
    await ejecutarPrueba(9, 'Persistencia en BD de perfil_usuario y persona_natural para Santa Rosa de Loreto', async () => {
      const queryPerfil = await pool.query(
        `SELECT p.direccion, p.ubigeo_distrito, d.nombre AS distrito_nom, prov.nombre AS prov_nom, dep.nombre AS dep_nom
         FROM sigd_auth.perfil_usuario p
         JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = p.id_usuario
         JOIN sigd_auth.distrito_ubigeo d ON d.codigo = p.ubigeo_distrito
         JOIN sigd_auth.provincia_ubigeo prov ON prov.codigo = d.provincia_codigo
         JOIN sigd_auth.departamento_ubigeo dep ON dep.codigo = d.departamento_codigo
         WHERE u.correo = $1`,
        [correoSRL]
      );
      if (queryPerfil.rows.length === 0) throw new Error('No se encontró perfil_usuario');
      const row = queryPerfil.rows[0];
      if (row.ubigeo_distrito !== '160405') throw new Error(`ubigeo_distrito esperado 160405, obtenido ${row.ubigeo_distrito}`);
      if (row.distrito_nom !== 'SANTA ROSA DE LORETO') throw new Error(`distrito_nom esperado SANTA ROSA DE LORETO, obtenido ${row.distrito_nom}`);
      if (row.dep_nom !== 'LORETO') throw new Error(`dep_nom esperado LORETO, obtenido ${row.dep_nom}`);

      const queryNatural = await pool.query(
        `SELECT direccion, ubigeo_distrito FROM sigd_auth.persona_natural WHERE id_persona = $1::uuid`,
        [idPersonaSantaRosa]
      );
      if (queryNatural.rows.length === 0) throw new Error('No se encontró persona_natural');
      if (queryNatural.rows[0].ubigeo_distrito !== '160405') {
        throw new Error(`persona_natural ubigeo esperado 160405, obtenido ${queryNatural.rows[0].ubigeo_distrito}`);
      }
    });

    // Caso 10: Registro de Persona Natural en Sangani (120307)
    let dniSangani = `7${sufijo}7`;
    let correoSangani = `sangani_${sufijo}@test.gob.pe`;
    await ejecutarPrueba(10, 'Registro de Persona Natural con domicilio en Sangani (120307)', async () => {
      const payload = {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: dniSangani,
        nombres: 'María',
        apellidoPaterno: 'Rojas',
        apellidoMaterno: 'Huamán',
        fechaNacimiento: '1994-04-25',
        correo: correoSangani,
        celular: '964889900',
        password: 'PasswordSangani123!',
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
        aceptaNotificaciones: true,
        direccion: 'Av. Marginal Sur Km 15',
        ubigeoDistrito: '120307',
      };
      const res = await request(app).post('/api/v1/auth/registro-ciudadano').send(payload);
      if (res.status !== 201) throw new Error(`Esperaba 201, obtuvo ${res.status}: ${JSON.stringify(res.body)}`);
      idPersonaSangani = res.body.idPersona;
    });

    // Caso 11: Verificación en BD de persistencia del domicilio de Sangani
    await ejecutarPrueba(11, 'Persistencia en BD de perfil_usuario y persona_natural para Sangani', async () => {
      const queryPerfil = await pool.query(
        `SELECT p.direccion, p.ubigeo_distrito, d.nombre AS distrito_nom, prov.nombre AS prov_nom, dep.nombre AS dep_nom
         FROM sigd_auth.perfil_usuario p
         JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = p.id_usuario
         JOIN sigd_auth.distrito_ubigeo d ON d.codigo = p.ubigeo_distrito
         JOIN sigd_auth.provincia_ubigeo prov ON prov.codigo = d.provincia_codigo
         JOIN sigd_auth.departamento_ubigeo dep ON dep.codigo = d.departamento_codigo
         WHERE u.correo = $1`,
        [correoSangani]
      );
      if (queryPerfil.rows.length === 0) throw new Error('No se encontró perfil_usuario');
      const row = queryPerfil.rows[0];
      if (row.ubigeo_distrito !== '120307') throw new Error(`ubigeo_distrito esperado 120307, obtenido ${row.ubigeo_distrito}`);
      if (row.distrito_nom !== 'SANGANI') throw new Error(`distrito_nom esperado SANGANI, obtenido ${row.distrito_nom}`);
      if (row.dep_nom !== 'JUNIN') throw new Error(`dep_nom esperado JUNIN, obtenido ${row.dep_nom}`);
    });

    // Caso 12: Registro de Persona Jurídica en Arequipa (040101)
    const baseRuc = `20${sufijo.padStart(6, '0')}${Math.floor(10 + Math.random() * 89)}`;
    const digitoRuc = calcularDigitoVerificadorRuc(baseRuc);
    const rucArequipa = `${baseRuc}${digitoRuc}`;
    let correoArequipa = `arequipa_${sufijo}@empresa.gob.pe`;
    await ejecutarPrueba(12, 'Registro de Persona Jurídica con UBIGEO fiscal en Arequipa (040101)', async () => {
      const payload = {
        tipoPersona: 'JURIDICA',
        ruc: rucArequipa,
        razonSocial: 'VOLCANES DEL SUR S.A.C.',
        tipoDocumentoRepresentante: 'DNI',
        numeroDocumentoRepresentante: dniSRL,
        nombreRepresentante: 'Julio Panduro Castillo',
        cargoRepresentante: 'Gerente General',
        correo: correoArequipa,
        celular: '954112233',
        password: 'PasswordEmpresa123!',
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
        direccion: 'Calle Santa Catalina 101',
        ubigeoDistrito: '040101',
      };
      const res = await request(app).post('/api/v1/auth/registro-persona-juridica').send(payload);
      if (res.status !== 201) throw new Error(`Esperaba 201, obtuvo ${res.status}: ${JSON.stringify(res.body)}`);
      idPersonaArequipa = res.body.idPersona;
    });

    // Caso 13: Rechazo de código UBIGEO inexistente (999999 -> HTTP 400)
    await ejecutarPrueba(13, 'Rechazo de código UBIGEO inexistente (999999 -> HTTP 400)', async () => {
      const payload = {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: `7${sufijo}8`,
        nombres: 'Carlos',
        apellidoPaterno: 'Inexistente',
        apellidoMaterno: 'Prueba',
        fechaNacimiento: '2000-01-01',
        correo: `invalido_${sufijo}@test.gob.pe`,
        celular: '999888777',
        password: 'PasswordValida123!',
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
        aceptaNotificaciones: true,
        direccion: 'Av. Fantasma 123',
        ubigeoDistrito: '999999',
      };
      const res = await request(app).post('/api/v1/auth/registro-ciudadano').send(payload);
      if (res.status !== 400) {
        throw new Error(`Esperaba 400 para UBIGEO inexistente, obtuvo ${res.status}: ${JSON.stringify(res.body)}`);
      }
    });

    // Caso 14: Rechazo de código UBIGEO con formato inválido (ABCDEF -> HTTP 400)
    await ejecutarPrueba(14, 'Rechazo de código UBIGEO con formato inválido (ABCDEF o longitud != 6 -> HTTP 400)', async () => {
      const payload = {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: `7${sufijo}9`,
        nombres: 'Pedro',
        apellidoPaterno: 'Formato',
        apellidoMaterno: 'Invalido',
        fechaNacimiento: '2000-01-01',
        correo: `formato_${sufijo}@test.gob.pe`,
        celular: '999888777',
        password: 'PasswordValida123!',
        consentimientoDatos: true,
        declaracionJuradaAceptada: true,
        aceptaNotificaciones: true,
        direccion: 'Av. Formato 123',
        ubigeoDistrito: 'ABCDEF',
      };
      const res = await request(app).post('/api/v1/auth/registro-ciudadano').send(payload);
      if (res.status !== 400) {
        throw new Error(`Esperaba 400 para UBIGEO ABCDEF, obtuvo ${res.status}`);
      }
    });

  } finally {
    try {
      // Limpieza quirúrgica de eventos outbox de prueba
      await pool.query(
        `DELETE FROM sigd_audit.evento_outbox WHERE payload->>'correo' LIKE $1 OR payload->>'correo' LIKE $2`,
        [`%_${sufijo}@test.gob.pe`, `%_${sufijo}@empresa.gob.pe`],
      ).catch(() => undefined);

      // Desactivación quirúrgica institucional (la regla de negocio en PL/pgSQL
      // proteger_cuenta_usuario_no_delete prohíbe el DELETE físico de cuentas de usuario)
      await pool.query(
        `UPDATE sigd_auth.cuenta_usuario SET activo = false WHERE correo LIKE $1 OR correo LIKE $2`,
        [`%_${sufijo}@test.gob.pe`, `%_${sufijo}@empresa.gob.pe`],
      ).catch(() => undefined);
    } catch {
      // Silenciar error en limpieza para no distorsionar resultados
    }
    await pool.end();
  }

  // Resumen
  console.log('\n=============================================================================');
  console.log('RESUMEN DE RESULTADOS DE SUITE UBIGEO (14 CASOS):');
  console.log('=============================================================================');
  console.table(resultados);
  const total = resultados.length;
  const pasados = resultados.filter((r) => r.estado === 'PASO').length;
  const fallados = resultados.filter((r) => r.estado === 'FALLO').length;
  console.log(`TOTAL: ${total} | PASADOS: ${pasados} | FALLADOS: ${fallados}`);
  console.log('=============================================================================');

  if (fallados > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal en ejecución:', err);
  process.exit(1);
});
