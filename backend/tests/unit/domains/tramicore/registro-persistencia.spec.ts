import { describe, it, expect, vi } from 'vitest';
import { RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';
import {
  radicacionVirtualSchema,
  type RadicacionVirtualInput,
} from '../../../../src/domains/tramicore/tramites.schemas.js';

/**
 * Persistencia del registro de trámite (endpoint #14).
 *
 * Estas pruebas verifican el CONTRATO de escritura: que el servicio ejecute los
 * INSERT correctos sobre `sigd_tra.expediente`, `sigd_tra.documento_adjunto` y
 * `sigd_tra.cargo_digital`, dentro de una transacción, con los valores que el
 * ciudadano capturó. Se usa un Pool grabador (sin PostgreSQL) para poder
 * ejercer la ruta completa de forma determinista.
 *
 * Complementan a `tramites.e2e.test.ts`, que valida el mismo flujo contra una
 * base real con el DDL canónico `05_esquema_sigd_tra_v6.3.sql` instalado.
 */

const TUPA_UUID = 'a1b2c3d4-0001-4000-8000-000000000001';
const ID_PERSONA = 42;
const EXPEDIENTE_ID = '11111111-2222-3333-4444-555555555555';
const CUT = 'EXP-2026-000042';
const CORREO_CRUDO = 'Ana.Quispe@Estudiante.IESTPSUIZA.edu.pe';
const CORREO_NORMALIZADO = 'ana.quispe@estudiante.iestpsuiza.edu.pe';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

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
  return { pool, cliente, llamadas, query };
}

function rutasFelices(): Ruta[] {
  return [
    [/FROM sigd_doc\.tipo_tramite_tupa/, { rows: [{ id_tipo_tramite_tupa: TUPA_UUID, activo: true }] }],
    [/FROM sigd_auth\.persona/, { rows: [{ id: String(ID_PERSONA), estado: true }] }],
    [/fn_generar_cut/, { rows: [{ cut: CUT }] }],
    [
      /INSERT INTO sigd_tra\.expediente/,
      {
        rows: [
          {
            expediente_id: EXPEDIENTE_ID,
            cut: CUT,
            fecha_envio_real: new Date('2026-10-19T15:00:00.000Z'),
            fecha_radicacion_legal: new Date('2026-10-19T15:00:00.000Z'),
            fuera_de_horario: false,
          },
        ],
      },
    ],
    [/INSERT INTO sigd_tra\.documento_adjunto/, { rows: [] }],
    [/INSERT INTO sigd_tra\.cargo_digital/, { rows: [] }],
  ];
}

function cuerpoValido(extra: Partial<RadicacionVirtualInput> = {}): RadicacionVirtualInput {
  return radicacionVirtualSchema.parse({
    asunto: 'Solicitud de certificado de estudios',
    idTipoTramiteTupa: TUPA_UUID,
    idPersona: ID_PERSONA,
    nombreSolicitante: 'Ana Quispe Ramos',
    correo: CORREO_CRUDO,
    totalFolios: 3,
    documentos: [
      {
        nombreArchivo: 'certificado.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 245_760,
        hashSha256: HASH_A,
      },
    ],
    ...extra,
  });
}

function insert(rutas: Llamada[], tabla: string): Llamada {
  const encontrado = rutas.find((llamada) => llamada.sql.includes(`INSERT INTO sigd_tra.${tabla}`));
  if (!encontrado) throw new Error(`No se ejecutó ningún INSERT sobre sigd_tra.${tabla}.`);
  return encontrado;
}

describe('TramiCore · #14 persiste el trámite en sigd_tra', () => {
  it('inserta el expediente con la cabecera completa y el CUT devuelto', async () => {
    const { pool, llamadas } = crearPoolGrabador(rutasFelices());
    const servicio = new RadicacionVirtualService(pool as never, async () => []);

    const resultado = await servicio.radicar(cuerpoValido(), new Date('2026-10-19T15:00:00.000Z'));

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
    expect(expediente.sql).toContain("'MESA_VIRTUAL'");
    expect(expediente.sql).toContain("'REGISTRADO'");

    expect(expediente.params).toEqual([
      CUT,
      ID_PERSONA,
      TUPA_UUID,
      'Ana Quispe Ramos',
      CORREO_NORMALIZADO,
      'Solicitud de certificado de estudios',
      3,
      expect.any(Date),
      expect.any(Date),
      false,
    ]);
    expect(typeof expediente.params[1]).toBe('number');
  });

  it('persiste un adjunto por cada documento con su hash en minúsculas', async () => {
    const { pool, llamadas } = crearPoolGrabador(rutasFelices());
    const servicio = new RadicacionVirtualService(pool as never, async () => []);

    await servicio.radicar(
      cuerpoValido({
        documentos: [
          { nombreArchivo: 'uno.pdf', contentType: 'application/pdf', tamanoBytes: 1024, hashSha256: HASH_A },
          { nombreArchivo: 'dos.pdf', contentType: 'application/pdf', tamanoBytes: 2048, hashSha256: HASH_B },
        ],
      }),
      new Date('2026-10-19T15:00:00.000Z'),
    );

    const adjuntos = llamadas.filter((llamada) => llamada.sql.includes('INSERT INTO sigd_tra.documento_adjunto'));
    expect(adjuntos).toHaveLength(2);
    expect(adjuntos[0]?.params).toEqual([EXPEDIENTE_ID, 'uno.pdf', 'application/pdf', 1024, HASH_A, null]);
    expect(adjuntos[1]?.params).toEqual([EXPEDIENTE_ID, 'dos.pdf', 'application/pdf', 2048, HASH_B, null]);
  });

  it('emite el cargo digital ligado al expediente con código CARGO-', async () => {
    const { pool, llamadas } = crearPoolGrabador(rutasFelices());
    const servicio = new RadicacionVirtualService(pool as never, async () => []);

    const resultado = await servicio.radicar(cuerpoValido(), new Date('2026-10-19T15:00:00.000Z'));

    expect(resultado.cargoDigital.codigo).toMatch(/^CARGO-[0-9A-F]{8}$/);
    expect(resultado.cargoDigital.hashSha256).toMatch(/^[0-9a-f]{64}$/);

    const cargo = insert(llamadas, 'cargo_digital');
    expect(cargo.params[0]).toBe(EXPEDIENTE_ID);
    expect(cargo.params[1]).toBe(resultado.cargoDigital.codigo);
    expect(cargo.params[3]).toContain('SIGD://cargo/');
  });

  it('envuelve la escritura en una transacción (BEGIN ... COMMIT)', async () => {
    const { pool, query } = crearPoolGrabador(rutasFelices());
    const servicio = new RadicacionVirtualService(pool as never, async () => []);

    await servicio.radicar(cuerpoValido(), new Date('2026-10-19T15:00:00.000Z'));

    const sentencias = query.mock.calls.map(([sql]) => String(sql).trim());
    expect(sentencias).toContain('BEGIN');
    expect(sentencias).toContain('COMMIT');
    expect(sentencias).not.toContain('ROLLBACK');
  });

  it('hace ROLLBACK y no escribe expediente si el tipo TUPA no existe', async () => {
    const rutas: Ruta[] = rutasFelices();
    rutas[0] = [/FROM sigd_doc\.tipo_tramite_tupa/, { rows: [] }];
    const { pool, query, llamadas } = crearPoolGrabador(rutas);
    const servicio = new RadicacionVirtualService(pool as never, async () => []);

    await expect(servicio.radicar(cuerpoValido(), new Date('2026-10-19T15:00:00.000Z'))).rejects.toThrow();

    const sentencias = query.mock.calls.map(([sql]) => String(sql).trim());
    expect(sentencias).toContain('ROLLBACK');
    expect(sentencias).not.toContain('COMMIT');
    expect(llamadas.some((llamada) => llamada.sql.includes('INSERT INTO sigd_tra.expediente'))).toBe(false);
  });
});
