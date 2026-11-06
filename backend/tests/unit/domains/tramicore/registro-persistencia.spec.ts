import { describe, it, expect, vi } from 'vitest';
import { RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';
import {
  radicacionVirtualSchema,
  type RadicacionVirtualInput,
} from '../../../../src/domains/tramicore/tramites.schemas.js';
import { crearContexto, runWithContext } from '../../../../src/shared/request-context/request-context.js';

vi.mock('../../../../src/domains/rutadoc/derivaciones.service.js', () => ({
  registrarActuacion: vi.fn(async () => undefined),
}));

/**
 * Persistencia del registro de trámite (endpoint #14).
 *
 * Estas pruebas verifican el CONTRATO de escritura: que el servicio ejecute los
 * INSERT correctos sobre `sigd_tra.expediente`, `sigd_doc.documento_adjunto` y
 * `sigd_tra.cargo_digital`, dentro de una transacción, con los valores que el
 * ciudadano capturó. Se usa un Pool grabador (sin PostgreSQL) para poder
 * ejercer la ruta completa de forma determinista.
 */

const TUPA_UUID = 'a1b2c3d4-0001-4000-8000-000000000001';
const ID_PERSONA = 'a1b2c3d4-0001-4000-8000-000000000042';
const EXPEDIENTE_ID = '11111111-2222-3333-4444-555555555555';
const USUARIO_ID = '22222222-3333-4444-5555-666666666666';
const AREA_ID = '33333333-4444-5555-6666-777777777777';
const TIPO_DOCUMENTAL_ID = '10000000-0000-4000-8000-000000000001';
const CARGA_CERTIFICADO = '44444444-5555-6666-7777-888888888888';
const CARGA_UNO = '55555555-6666-7777-8888-999999999999';
const CARGA_DOS = '66666666-7777-8888-9999-aaaaaaaaaaaa';
const CUT = 'EXP-2026-000042';
const CORREO_CRUDO = 'Ana.Quispe@Estudiante.IESTPSUIZA.edu.pe';
const CORREO_NORMALIZADO = 'ana.quispe@estudiante.iestpsuiza.edu.pe';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const STORAGE_CERTIFICADO = 'cargas/certificado.pdf';
const STORAGE_UNO = 'cargas/uno.pdf';
const STORAGE_DOS = 'cargas/dos.pdf';
const BUCKET = 'sigd-pruebas';

interface Llamada {
  sql: string;
  params: unknown[];
}

interface Carga {
  carga_id: string;
  sha256: string;
  tamano_bytes: number;
  nombre_archivo: string;
  s3_bucket: string;
}

type RespuestaRuta = { rows: unknown[] } | ((params: unknown[]) => { rows: unknown[] });
type Ruta = [RegExp, RespuestaRuta];

function crearPoolGrabador(rutas: Ruta[]) {
  const llamadas: Llamada[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    llamadas.push({ sql, params });
    for (const [patron, respuesta] of rutas) {
      if (patron.test(sql)) {
        return typeof respuesta === 'function' ? respuesta(params) : respuesta;
      }
    }
    return { rows: [], rowCount: 0 };
  });
  const release = vi.fn();
  const cliente = { query, release };
  const pool = { connect: vi.fn(async () => cliente) };
  return { pool, cliente, llamadas, query };
}

function cargas(): Record<string, Carga> {
  return {
    [STORAGE_CERTIFICADO]: {
      carga_id: CARGA_CERTIFICADO,
      sha256: HASH_A,
      tamano_bytes: 245_760,
      nombre_archivo: 'certificado.pdf',
      s3_bucket: BUCKET,
    },
    [STORAGE_UNO]: {
      carga_id: CARGA_UNO,
      sha256: HASH_A,
      tamano_bytes: 1024,
      nombre_archivo: 'uno.pdf',
      s3_bucket: BUCKET,
    },
    [STORAGE_DOS]: {
      carga_id: CARGA_DOS,
      sha256: HASH_B,
      tamano_bytes: 2048,
      nombre_archivo: 'dos.pdf',
      s3_bucket: BUCKET,
    },
  };
}

function rutasFelices(): Ruta[] {
  const porClave = cargas();
  return [
    [/FROM sigd_doc\.tipo_tramite_tupa/, { rows: [{ id_tipo_tramite_tupa: TUPA_UUID, activo: true }] }],
    [/FROM sigd_auth\.persona/, { rows: [{ id: ID_PERSONA, estado: true }] }],
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
    [/INSERT INTO sigd_doc\.documento_adjunto/, { rows: [] }],
    [/INSERT INTO sigd_tra\.tramite/, { rows: [] }],
    [/INSERT INTO sigd_tra\.asiento_registro/, { rows: [] }],
    [/INSERT INTO sigd_tra\.cargo_digital/, { rows: [] }],
    [/FROM sigd_doc\.tipo_documento/, { rows: [{ tipo_documental_id: TIPO_DOCUMENTAL_ID }] }],
    [
      /FROM sigd_doc\.carga_documento/,
      (params) => {
        const carga = porClave[String(params[0])];
        return { rows: carga ? [carga] : [] };
      },
    ],
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
        storagePath: STORAGE_CERTIFICADO,
      },
    ],
    ...extra,
  });
}

function radicar(
  servicio: RadicacionVirtualService,
  datos: RadicacionVirtualInput,
  now: Date,
): Promise<Awaited<ReturnType<RadicacionVirtualService['radicar']>>> {
  return runWithContext(
    crearContexto({ usuario_id: USUARIO_ID, unidad_organica_id: AREA_ID }),
    () => servicio.radicar(datos, now),
  );
}

function insert(rutas: Llamada[], tabla: string): Llamada {
  const encontrado = rutas.find((llamada) => llamada.sql.includes(`INSERT INTO ${tabla}`));
  if (!encontrado) throw new Error(`No se ejecutó ningún INSERT sobre ${tabla}.`);
  return encontrado;
}

describe('TramiCore · #14 persiste el trámite en sigd_tra', () => {
  it('inserta el expediente con la cabecera completa y el CUT devuelto', async () => {
    const { pool, llamadas } = crearPoolGrabador(rutasFelices());
    const servicio = new RadicacionVirtualService(pool as never, async () => []);

    const resultado = await radicar(servicio, cuerpoValido(), new Date('2026-10-19T15:00:00.000Z'));

    expect(resultado.cut).toBe(CUT);
    expect(resultado.cut).toMatch(/^EXP-\d{4}-\d{6}$/);
    expect(resultado.expedienteId).toBe(EXPEDIENTE_ID);

    const expediente = insert(llamadas, 'sigd_tra.expediente');
    for (const columna of [
      'codigo_expediente',
      'solicitante_id',
      'tipo_tramite_id',
      'nombre_solicitante',
      'correo_notificacion',
      'numero',
      'total_folios',
      'fecha_envio_real',
      'fecha_radicacion',
      'fuera_de_horario',
      'expediente_id',
      'tipo_documental_id',
      'area_destino_id',
    ]) {
      expect(expediente.sql, `falta la columna ${columna}`).toContain(columna);
    }
    expect(expediente.sql).toContain('codigo_expediente AS cut');

    expect(expediente.params).toEqual([
      CUT,
      ID_PERSONA,
      TUPA_UUID,
      'Ana Quispe Ramos',
      CORREO_NORMALIZADO,
      CUT,
      3,
      expect.any(Date),
      expect.any(Date),
      false,
      expect.any(String),
      TIPO_DOCUMENTAL_ID,
      AREA_ID,
    ]);
    expect(typeof expediente.params[1]).toBe('string');

    const tramite = insert(llamadas, 'sigd_tra.tramite');
    expect(tramite.params).toEqual([expect.any(String), 'Solicitud de certificado de estudios']);

    const asiento = insert(llamadas, 'sigd_tra.asiento_registro');
    expect(asiento.params).toEqual([expect.any(String), 'Solicitud de certificado de estudios', ID_PERSONA]);
  });

  it('persiste un adjunto por cada documento con su hash en minúsculas', async () => {
    const { pool, llamadas } = crearPoolGrabador(rutasFelices());
    const servicio = new RadicacionVirtualService(pool as never, async () => []);

    await radicar(
      servicio,
      cuerpoValido({
        documentos: [
          {
            nombreArchivo: 'uno.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: HASH_A,
            storagePath: STORAGE_UNO,
          },
          {
            nombreArchivo: 'dos.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 2048,
            hashSha256: HASH_B,
            storagePath: STORAGE_DOS,
          },
        ],
      }),
      new Date('2026-10-19T15:00:00.000Z'),
    );

    const adjuntos = llamadas.filter((llamada) => llamada.sql.includes('INSERT INTO sigd_doc.documento_adjunto'));
    expect(adjuntos).toHaveLength(2);
    expect(adjuntos[0]?.params).toEqual([
      EXPEDIENTE_ID,
      'uno.pdf',
      'application/pdf',
      1024,
      HASH_A,
      STORAGE_UNO,
      CARGA_UNO,
      BUCKET,
      USUARIO_ID,
    ]);
    expect(adjuntos[1]?.params).toEqual([
      EXPEDIENTE_ID,
      'dos.pdf',
      'application/pdf',
      2048,
      HASH_B,
      STORAGE_DOS,
      CARGA_DOS,
      BUCKET,
      USUARIO_ID,
    ]);
  });

  it('emite el cargo digital ligado al expediente con código CARGO-', async () => {
    const { pool, llamadas } = crearPoolGrabador(rutasFelices());
    const servicio = new RadicacionVirtualService(pool as never, async () => []);

    const resultado = await radicar(servicio, cuerpoValido(), new Date('2026-10-19T15:00:00.000Z'));

    expect(resultado.cargoDigital.codigo).toMatch(/^CARGO-[0-9A-F]{8}$/);
    expect(resultado.cargoDigital.hashSha256).toMatch(/^[0-9a-f]{64}$/);

    const cargo = insert(llamadas, 'sigd_tra.cargo_digital');
    expect(cargo.params[0]).toBe(EXPEDIENTE_ID);
    expect(cargo.params[1]).toBe(resultado.cargoDigital.codigo);
    expect(cargo.params[3]).toContain('SIGD://cargo/');
  });

  it('envuelve la escritura en una transacción (BEGIN ... COMMIT)', async () => {
    const { pool, query } = crearPoolGrabador(rutasFelices());
    const servicio = new RadicacionVirtualService(pool as never, async () => []);

    await radicar(servicio, cuerpoValido(), new Date('2026-10-19T15:00:00.000Z'));

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

    await expect(
      radicar(servicio, cuerpoValido(), new Date('2026-10-19T15:00:00.000Z')),
    ).rejects.toThrow();

    const sentencias = query.mock.calls.map(([sql]) => String(sql).trim());
    expect(sentencias).toContain('ROLLBACK');
    expect(sentencias).not.toContain('COMMIT');
    expect(llamadas.some((llamada) => llamada.sql.includes('INSERT INTO sigd_tra.expediente'))).toBe(false);
  });
});
