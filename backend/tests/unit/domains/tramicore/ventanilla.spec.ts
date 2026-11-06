import { describe, it, expect, vi } from 'vitest';
import { VentanillaPresencialService } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';
import { TicketTermicoUtil } from '../../../../src/domains/tramicore/ticketTermico.util.js';

/**
 * Endpoint #15 — Ventanilla Presencial.
 *
 * Verifica el CONTRATO de escritura contra el DDL canónico v6.3: el expediente
 * usa las columnas reales de `sigd_tra.expediente`, no toca `asiento_registro`
 * (inexistente en v6.3) y asienta el acuse en `sigd_tra.documento_adjunto` para
 * cumplir el trigger `trg_expediente_exigir_adjunto`.
 */

const TUPA_UUID = 'a1b2c3d4-0001-4000-8000-000000000001';
const ID_PERSONA = 42;
const EXPEDIENTE_ID = '11111111-2222-3333-4444-555555555555';
const CUT = 'EXP-2026-000042';

interface Llamada {
  sql: string;
  params: unknown[];
}

type Ruta = [RegExp, { rows: unknown[] }];

function crearPoolGrabador(rutas: Ruta[]) {
  const llamadas: Llamada[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    llamadas.push({ sql, params });
    for (const [patron, respuesta] of rutas) {
      if (patron.test(sql)) return respuesta;
    }
    return { rows: [], rowCount: 0 };
  });
  const release = vi.fn();
  const cliente = { query, release };
  const pool = { connect: vi.fn(async () => cliente) };
  return { pool, llamadas, query };
}

function rutasFelices(): Ruta[] {
  return [
    [/FROM sigd_auth\.persona/, { rows: [{ id: ID_PERSONA, estado: true }] }],
    [/FROM sigd_doc\.tipo_tramite_tupa/, { rows: [{ id_tipo_tramite_tupa: TUPA_UUID, activo: true }] }],
    [/fn_generar_cut/, { rows: [{ cut: CUT }] }],
    [/INSERT INTO sigd_tra\.expediente/, { rows: [{ expediente_id: EXPEDIENTE_ID }] }],
    [/INSERT INTO sigd_tra\.documento_adjunto/, { rows: [] }],
  ];
}

function datosValidos() {
  return {
    dniSolicitante: '74561238',
    datosRemitente: 'Juan Pérez López',
    asunto: 'Solicitud de certificado de estudios',
    foliosTotales: 5,
    correo: 'Juan.Perez@Correo.com',
    idTipoTramiteTupa: TUPA_UUID,
  };
}

function insert(llamadas: Llamada[], tabla: string): Llamada {
  const encontrado = llamadas.find((llamada) => llamada.sql.includes(`INSERT INTO sigd_tra.${tabla}`));
  if (!encontrado) throw new Error(`No se ejecutó ningún INSERT sobre sigd_tra.${tabla}.`);
  return encontrado;
}

describe('Módulo TramiCore - Ventanilla Presencial y Ticket', () => {
  it('registra el expediente con las columnas de sigd_tra.expediente v6.3', async () => {
    const { pool, llamadas } = crearPoolGrabador(rutasFelices());
    const servicio = new VentanillaPresencialService(pool as never);

    const resultado = await servicio.registrarExpedienteVentanilla(datosValidos());

    expect(resultado.cut).toBe(CUT);
    expect(resultado.cut).toMatch(/^EXP-\d{4}-\d{6}$/);
    expect(resultado.expedienteId).toBe(EXPEDIENTE_ID);

    const expediente = insert(llamadas, 'expediente');
    for (const columna of [
      'cut',
      'id_persona',
      'id_tipo_tramite_tupa',
      'nombre_solicitante',
      'correo_notificacion',
      'asunto',
      'canal_recepcion',
      'estado_tramite',
      'total_folios',
      'fecha_envio_real',
      'fecha_radicacion_legal',
      'fuera_de_horario',
    ]) {
      expect(expediente.sql, `falta la columna ${columna}`).toContain(columna);
    }
    expect(expediente.sql).toContain("'VENTANILLA_PRESENCIAL'");
    expect(expediente.sql).toContain("'REGISTRADO'");
    expect(expediente.sql).not.toContain('asiento_registro');

    expect(expediente.params).toEqual([
      CUT,
      ID_PERSONA,
      TUPA_UUID,
      'Juan Pérez López',
      'juan.perez@correo.com',
      'Solicitud de certificado de estudios',
      5,
      expect.any(Date),
      expect.any(Date),
      expect.any(Boolean),
    ]);
  });

  it('asienta el acuse en documento_adjunto para cumplir el trigger diferido', async () => {
    const { pool, llamadas } = crearPoolGrabador(rutasFelices());
    const servicio = new VentanillaPresencialService(pool as never);

    await servicio.registrarExpedienteVentanilla(datosValidos());

    const adjunto = insert(llamadas, 'documento_adjunto');
    expect(adjunto.params[0]).toBe(EXPEDIENTE_ID);
    expect(adjunto.params[1]).toBe(`acuse-${CUT}.pdf`);
    expect(adjunto.params[2]).toBe('application/pdf');
    expect(String(adjunto.params[4])).toMatch(/^[0-9a-f]{64}$/);
  });

  it('envuelve la escritura en una transacción (BEGIN ... COMMIT)', async () => {
    const { pool, query } = crearPoolGrabador(rutasFelices());
    const servicio = new VentanillaPresencialService(pool as never);

    await servicio.registrarExpedienteVentanilla(datosValidos());

    const sentencias = query.mock.calls.map(([sql]) => String(sql).trim());
    expect(sentencias).toContain('BEGIN');
    expect(sentencias).toContain('COMMIT');
    expect(sentencias).not.toContain('ROLLBACK');
  });

  it('hace ROLLBACK si el administrado no está en el padrón', async () => {
    const rutas: Ruta[] = rutasFelices();
    rutas[0] = [/FROM sigd_auth\.persona/, { rows: [] }];
    const { pool, query, llamadas } = crearPoolGrabador(rutas);
    const servicio = new VentanillaPresencialService(pool as never);

    await expect(servicio.registrarExpedienteVentanilla(datosValidos())).rejects.toThrow();

    const sentencias = query.mock.calls.map(([sql]) => String(sql).trim());
    expect(sentencias).toContain('ROLLBACK');
    expect(sentencias).not.toContain('COMMIT');
    expect(llamadas.some((llamada) => llamada.sql.includes('INSERT INTO sigd_tra.expediente'))).toBe(false);
  });

  it('rechaza un DNI con formato inválido sin abrir transacción', async () => {
    const { pool, query } = crearPoolGrabador(rutasFelices());
    const servicio = new VentanillaPresencialService(pool as never);

    await expect(
      servicio.registrarExpedienteVentanilla({ ...datosValidos(), dniSolicitante: '123' }),
    ).rejects.toThrow();

    expect(query).not.toHaveBeenCalled();
  });

  it('Debe generar el ticket térmico cumpliendo el Criterio de Aceptación (Hash SHA-256)', () => {
    const datosTicket = {
      cut: CUT,
      timestamp: new Date(),
      folios: 5,
      hashSha256: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
      qrUrlSeguimiento: 'https://sigd.iestp-suiza.edu.pe/api/v1/tramites/consulta-publica/EXP-2026-000042',
    };

    const ticketStr = TicketTermicoUtil.generarTicketVentanilla(datosTicket);

    expect(ticketStr).toContain(CUT);
    expect(ticketStr).toContain('NRO. FOLIOS: 5');
    expect(ticketStr).toContain('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');
  });
});
