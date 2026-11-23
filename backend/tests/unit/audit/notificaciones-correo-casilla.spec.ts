import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import {
  DestinoEmail,
  DestinoCasilla,
  DespachadorNotificaciones,
  EVENTOS_INTERNOS_PROHIBIDOS,
  generarPlantillaNotificacionEmail,
} from '../../../src/audit/despachador-notificaciones.js';
import { EmailService } from '../../../src/domains/identicore/email.service.js';
import type { EventoPendiente } from '../../../src/audit/outbox-worker.js';

const ID_USUARIO_TITULAR = '11111111-1111-4111-8111-111111111111';
const ID_USUARIO_IMPOSTOR = '99999999-9999-4999-8999-999999999999';
const ID_PERSONA_TITULAR = '22222222-2222-4222-8222-222222222222';
const ID_EXPEDIENTE = '33333333-3333-4333-8333-333333333333';
const ID_DOCUMENTO = '44444444-4444-4444-8444-444444444444';
const CUT_TEST = 'EXP-2026-TEST01';
const EMAIL_TITULAR = 'estudiante.demo@iestpsuiza.edu.pe';
const EMAIL_PREFERIDO = 'personal.estudiante@gmail.com';

function crearEvento(
  tipo: string,
  payload: Record<string, unknown> = {},
  idEvento = '55555555-5555-4555-8555-555555555555',
): EventoPendiente {
  return {
    id_evento: idEvento,
    correlation_id: '66666666-6666-4666-8666-666666666666',
    agregado: 'Expediente',
    tipo_evento: tipo,
    payload: {
      usuario_id: ID_USUARIO_TITULAR,
      expediente_id: ID_EXPEDIENTE,
      cut: CUT_TEST,
      asunto: `Asunto de prueba para ${tipo}`,
      ...payload,
    },
    intentos: 0,
  };
}

function crearMockPool(opciones: {
  esTitular?: boolean;
  usarEmailPreferido?: boolean;
  casillaExistente?: { usuario_id: string; cut: string };
  adjuntoValido?: boolean;
} = {}) {
  const query = vi.fn(async (sql: string, valores?: unknown[]) => {
    // 1. Disponibilidad de Casilla
    if (sql.includes('to_regclass')) {
      return { rows: [{ existe: 'sigd_auth.notificacion_casilla' }], rowCount: 1 };
    }

    // 2. Consulta de cuenta de usuario y correo para DestinoEmail
    if (sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
      const uid = valores?.[0];
      if (uid === ID_USUARIO_IMPOSTOR) {
        return {
          rows: [{
            id_usuario: ID_USUARIO_IMPOSTOR,
            id_persona: '88888888-8888-4888-8888-888888888888',
            correo: 'impostor@externo.com',
            titular_nombre: 'Impostor Sin Titularidad',
            activo: true,
          }],
          rowCount: 1,
        };
      }
      return {
        rows: [{
          id_usuario: ID_USUARIO_TITULAR,
          id_persona: ID_PERSONA_TITULAR,
          correo: opciones.usarEmailPreferido ? EMAIL_PREFERIDO : EMAIL_TITULAR,
          titular_nombre: 'Estudiante Titular Demo',
          activo: true,
        }],
        rowCount: 1,
      };
    }

    // 3. Verificación de titularidad de expediente en DestinoEmail
    if (sql.includes('FROM sigd_doc.expediente e') && sql.includes('es_titular')) {
      return {
        rows: [{ es_titular: opciones.esTitular ?? true }],
        rowCount: 1,
      };
    }

    // 4. Verificación de titularidad de expediente en DestinoCasilla
    if (sql.includes('FROM sigd_doc.expediente e') && sql.includes('JOIN sigd_auth.cuenta_usuario c')) {
      return {
        rows: [{ existe: opciones.esTitular ?? true }],
        rowCount: 1,
      };
    }

    // 5. Verificación de adjunto en Casilla
    if (sql.includes('FROM sigd_doc.documento_adjunto a')) {
      return {
        rows: [{ existe: opciones.adjuntoValido ?? true }],
        rowCount: 1,
      };
    }

    // 6. Deduplicación en tabla de Casilla
    if (sql.includes('SELECT usuario_id, cut FROM sigd_auth.notificacion_casilla WHERE referencia')) {
      return {
        rows: opciones.casillaExistente ? [opciones.casillaExistente] : [],
        rowCount: opciones.casillaExistente ? 1 : 0,
      };
    }

    // 7. Inserciones en Casilla o Auditoría
    if (sql.includes('INSERT INTO sigd_auth.notificacion_casilla') || sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
      return { rows: [], rowCount: 1 };
    }

    // 8. Búsqueda por titular sin usuario_id
    if (sql.includes('FROM sigd_doc.expediente e') && sql.includes('JOIN sigd_auth.cuenta_usuario cu')) {
      if (opciones.esTitular === false) {
        return { rows: [], rowCount: 0 };
      }
      return {
        rows: [{
          id_usuario: ID_USUARIO_TITULAR,
          correo: EMAIL_TITULAR,
          titular_nombre: 'Estudiante Titular Demo',
          cut: CUT_TEST,
        }],
        rowCount: 1,
      };
    }

    return { rows: [], rowCount: 0 };
  });

  return { query, pool: { query } as unknown as Pool };
}

describe('SISTEMA INTEGRAL DE NOTIFICACIONES AUTOMÁTICAS, CORREO ELECTRÓNICO Y CASILLA (14 CASOS OBLIGATORIOS)', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService('re_test_key_sandbox', 'notificaciones@iestpsuiza.edu.pe');
    emailService.limpiarHistorial();
  });

  // CASO 1: Notificación de radicación
  it('1. Notificación de radicación: genera correo al titular con CUT y fecha legal', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);

    const ev = crearEvento('radicacion_exitosa', {
      cuerpo: { totalFolios: 5, fechaRadicacionLegal: '2026-11-21 10:00:00' },
    });

    await destinoEmail.despachar(ev);

    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].to).toBe(EMAIL_TITULAR);
    expect(enviados[0].subject).toContain(`[SIGD] Trámite Radicado Exitosamente — CUT: ${CUT_TEST}`);
    expect(enviados[0].html).toContain(CUT_TEST);
    expect(enviados[0].html).toContain('Folios Registrados:');
    expect(enviados[0].html).toContain('http://localhost:5178/tramites/mis-expedientes');
  });

  // CASO 2: Notificación de Tesorería
  it('2. Notificación de pago / tesorería: informa actualización financiera u orden de pago', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);

    const ev = crearEvento('tesoreria_notificacion', {
      referencia_orden: 'ORD-2026-0042',
      asunto: 'Orden de pago generada para certificado de estudios',
      cuerpo: { accion: 'EMISION_ORDEN', motivo: 'Derecho de trámite TUPA' },
    });

    await destinoEmail.despachar(ev);

    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toContain('[SIGD] Actualización de Tesorería — ORD-2026-0042');
    expect(enviados[0].html).toContain('ORD-2026-0042');
    expect(enviados[0].html).toContain('EMISION_ORDEN');
  });

  // CASO 3: Notificación de derivación
  it('3. Notificación de derivación: informa al titular del pase entre áreas institucionales', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);

    const ev = crearEvento('ExpedienteDerivado', {
      cuerpo: { motivo: 'Derivado a Secretaría Académica para revisión de requisitos' },
    });

    await destinoEmail.despachar(ev);

    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toContain(`[SIGD] Trámite Derivado — CUT: ${CUT_TEST}`);
    expect(enviados[0].html).toContain(CUT_TEST);
    expect(enviados[0].html).toContain('Secretaría Académica');
  });

  // CASO 4: Notificación de observación formal con plazo
  it('4. Notificación de observación formal: alerta sobre el plazo legal perentorio de 5 días hábiles', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);

    const ev = crearEvento('expediente_observado', {
      cuerpo: { contenido: 'Falta adjuntar constancia de no adeudo de biblioteca.' },
    });

    await destinoEmail.despachar(ev);

    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toContain(`[SIGD] Observación Formulada — Plazo de Subsanación — CUT: ${CUT_TEST}`);
    expect(enviados[0].html).toContain('cinco (5) días hábiles');
    expect(enviados[0].html).toContain('Falta adjuntar constancia de no adeudo');
    expect(enviados[0].html).toContain('Subsanar Expediente Ahora');
  });

  // CASO 5: Notificación de subsanación recibida
  it('5. Notificación de subsanación: emite acuse informativo de subsanación recibida', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);

    const ev = crearEvento('TramiteSubsanado', {
      cuerpo: { motivo: 'Se adjunta constancia de biblioteca subsanada.' },
    });

    await destinoEmail.despachar(ev);

    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toContain(`[SIGD] Constancia de Subsanación Recibida — CUT: ${CUT_TEST}`);
    expect(enviados[0].html).toContain('Subsanación Registrada con Éxito');
  });

  // CASO 6: Notificación de vinculación aprobada y rechazada
  it('6. Notificación de vinculación aprobada y rechazada: notifica al ciudadano según el resultado', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);

    // 6.1 Aprobada
    const evAprobada = crearEvento('vinculacion_cuenta_aprobada', {}, 'ev-vinc-aprobada-01');
    await destinoEmail.despachar(evAprobada);

    // 6.2 Rechazada
    const evRechazada = crearEvento('vinculacion_cuenta_rechazada', { motivo: 'DNI no coincide con el expediente' }, 'ev-vinc-rechazada-02');
    await destinoEmail.despachar(evRechazada);

    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(2);
    expect(enviados[0].subject).toContain(`[SIGD] Vinculación de Expediente APROBADA — CUT: ${CUT_TEST}`);
    expect(enviados[0].html).toContain('Mis Expedientes');
    expect(enviados[1].subject).toContain(`[SIGD] Solicitud de Vinculación RECHAZADA — CUT: ${CUT_TEST}`);
    expect(enviados[1].html).toContain('DNI no coincide con el expediente');
  });

  // CASO 7: Rechazo de notificación a ciudadanos sin titularidad
  it('7. Rechazo de notificación a ciudadanos sin titularidad: impide el envío y lanza error', async () => {
    const { pool } = crearMockPool({ esTitular: false });
    const destinoEmail = new DestinoEmail(pool, emailService);

    const evImpostor = crearEvento('expediente_observado', {
      usuario_id: ID_USUARIO_IMPOSTOR,
    });

    await expect(destinoEmail.despachar(evImpostor)).rejects.toThrow('no es titular legítimo del expediente');
    expect(emailService.obtenerCorreosEnviados()).toHaveLength(0);
  });

  // CASO 8: Protección de datos personales
  it('8. Protección de datos personales: las plantillas no exponen claves, hashes ni debates internos', () => {
    const plantilla = generarPlantillaNotificacionEmail(
      'expediente_observado',
      {
        cut: CUT_TEST,
        cuerpo: { contenido: 'Requisito formal pendiente.' },
        passwordHash: '$2b$10$inseguro',
        tokenPrivado: 'token_secreto_123',
        debateEvaluadores: 'Debate confidencial entre evaluadores',
      },
      'Estudiante Titular Demo',
      CUT_TEST,
    );

    expect(plantilla.html).not.toContain('$2b$10$inseguro');
    expect(plantilla.html).not.toContain('token_secreto_123');
    expect(plantilla.html).not.toContain('Debate confidencial');
    expect(plantilla.html).toContain('AVISO LEGAL OBLIGATORIO');
    expect(plantilla.html).toContain('Ley N° 27444');
  });

  // CASO 9: Prevención de correos duplicados (idempotencia)
  it('9. Prevención de correos duplicados: la clave de idempotencia del evento evita duplicados', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);

    const ev = crearEvento('radicacion_exitosa', {}, 'ev-idempotente-001');

    await destinoEmail.despachar(ev);
    await destinoEmail.despachar(ev);

    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].idempotencyKey).toBe('ev-idempotente-001');
  });

  // CASO 10: Reintentos del Outbox ante fallo transitorio
  it('10. Reintentos del Outbox ante fallo transitorio: maneja la recuperación tras falla', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);
    const ev = crearEvento('radicacion_exitosa', {}, 'ev-transitorio-001');

    // Simular corte de red o indisponibilidad en el primer intento
    emailService.simularFallo(true);
    await expect(destinoEmail.despachar(ev)).rejects.toThrow('Fallo simulado');
    expect(emailService.obtenerCorreosEnviados()).toHaveLength(0);

    // Restauración del servicio en el siguiente ciclo del outbox
    emailService.simularFallo(false);
    await destinoEmail.despachar(ev);
    expect(emailService.obtenerCorreosEnviados()).toHaveLength(1);
  });

  // CASO 11: Manejo seguro de fallos del proveedor de correo
  it('11. Manejo seguro de fallos del proveedor de correo: DespachadorNotificaciones propaga error limpiamente', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);
    const despachador = new DespachadorNotificaciones([destinoEmail]);
    const ev = crearEvento('radicacion_exitosa');

    emailService.simularFallo(true, new Error('503 Service Unavailable: Resend API down'));

    await expect(despachador.despachar(ev)).rejects.toThrow('503 Service Unavailable');
  });

  // CASO 12: Separación entre correo informativo y notificación formal en Casilla
  it('12. Separación entre correo informativo y notificación formal en Casilla', async () => {
    const { pool, query } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);
    const destinoCasilla = new DestinoCasilla(pool);
    const despachador = new DespachadorNotificaciones([destinoCasilla, destinoEmail]);

    const ev = crearEvento('resolucion_emitida', {
      numero_resolucion: 'RD-2026-000013',
      documento_id: ID_DOCUMENTO,
      tipo_acto: 'resolucion_emitida',
    }, 'ev-separacion-001');

    await despachador.despachar(ev);

    // Verificación en Casilla: se registra el acto jurídico formal
    const insertCasilla = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO sigd_auth.notificacion_casilla'));
    expect(insertCasilla).toBeDefined();
    expect(insertCasilla?.[1]).toContain(ID_USUARIO_TITULAR);
    expect(insertCasilla?.[1]).toContain(CUT_TEST);

    // Verificación en Correo: se envía aviso informativo con advertencia legal TUO 27444
    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toContain(`[SIGD] Resolución Emitida Disponible en Casilla — CUT: ${CUT_TEST}`);
    expect(enviados[0].html).toContain('AVISO LEGAL OBLIGATORIO');
    expect(enviados[0].html).toContain('no sustituye la notificación legal');
  });

  // CASO 13: Prohibición estricta de notificar anotaciones internas y asignaciones de docentes
  it('13. Prohibición estricta de notificar anotaciones internas y asignaciones de docentes', async () => {
    const { pool } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);

    for (const eventoProhibido of EVENTOS_INTERNOS_PROHIBIDOS) {
      const ev = crearEvento(eventoProhibido, {
        motivo: 'Asignación o anotación estrictamente confidencial de la administración',
      }, `ev-int-${eventoProhibido}`);

      await destinoEmail.despachar(ev);
    }

    // Ningún evento interno debe haber producido correo al ciudadano
    expect(emailService.obtenerCorreosEnviados()).toHaveLength(0);
  });

  // CASO 14: Notificación de resolución firmada y depositada en Casilla
  it('14. Notificación de resolución firmada y depositada en Casilla: entrega dual coordinada', async () => {
    const { pool, query } = crearMockPool();
    const destinoEmail = new DestinoEmail(pool, emailService);
    const destinoCasilla = new DestinoCasilla(pool);

    const evResolucion = crearEvento('resolucion_emitida', {
      numero_resolucion: 'RD-2026-000013',
      documento_id: ID_DOCUMENTO,
      tipo_acto: 'resolucion_emitida',
      cuerpo: { cvd: 'CVD-TEST-9988', firmadoEn: '2026-11-21T10:00:00Z' },
    }, 'ev-res-final-001');

    await destinoCasilla.despachar(evResolucion);
    await destinoEmail.despachar(evResolucion);

    // Casilla cuenta con el registro con referencia al CVD/documento
    const insertCasilla = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO sigd_auth.notificacion_casilla'));
    expect(insertCasilla).toBeDefined();

    // Correo tiene el enlace directo para consultar la resolución en Casilla
    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toContain('Resolución Emitida Disponible en Casilla');
    expect(enviados[0].html).toContain('RD-2026-000013');
    expect(enviados[0].html).toContain('http://localhost:5178/casilla/inbox');
  });
});
