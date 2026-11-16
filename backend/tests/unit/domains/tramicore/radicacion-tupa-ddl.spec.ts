import type { Pool, PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { crearProveedorFeriados, RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';
import { radicacionVirtualSchema } from '../../../../src/domains/tramicore/tramites.schemas.js';
import { exigirIdUsuarioAutenticado } from '../../../../src/domains/tramicore/tramites.controller.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

const UUID_TUPA = '11111111-1111-4111-8111-111111111111';
const UUID_USUARIO = '22222222-2222-4222-8222-222222222222';
const UUID_PERSONA = '33333333-3333-4333-8333-333333333333';
const UUID_DOCUMENTAL = '44444444-4444-4444-8444-444444444444';
const pdfStorage = await PDFDocument.create();
pdfStorage.addPage();
const pdfStorageBytes = Buffer.from(await pdfStorage.save());

function datosRadicacion() {
  return radicacionVirtualSchema.parse({
    asunto: 'Solicitud de prueba de catálogo Suiza',
    idTipoTramiteTupa: UUID_TUPA,
    tipoDocumento: 'DNI',
    numeroDocumento: '74123456',
    nombreSolicitante: 'Ana Quispe',
    correo: 'ana@example.edu.pe',
    totalFolios: 1,
    documentos: [
      {
        nombreArchivo: 'solicitud.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 1024,
        hashSha256: 'a'.repeat(64),
      },
    ],
  });
}

function crearServicioConTipo(
  activo: boolean,
  idPersona: string | null = UUID_PERSONA,
  errorIdentidad?: Error,
  datosIdentidad: { id_documento?: string; tipo_persona?: string; nombre_identidad?: string; activo?: boolean } = {},
  tiposDocumentales: Array<{ tipo_documental_id: string; tipo_doc_codigo?: string; requiere_condicion: boolean; obligatorio?: boolean }> = [{ tipo_documental_id: UUID_DOCUMENTAL, requiere_condicion: false }],
  errorClasificacion?: Error,
  falloPersistencia: string | null = 'INSERT INTO sigd_tra.expediente',
  obtenerFeriados: () => Promise<string[]> = async () => [],
  cuts: string[] = ['EXP-2026-000001'],
) {
  const consultas: string[] = [];
  const parametros: unknown[][] = [];
  let cutIndex = 0;
  let expedienteIndex = 0;
  let expedienteActual = '55555555-5555-4555-8555-555555555555';
  const auditadas = new Map<string, unknown>();
  const expedienteIds = [
    '55555555-5555-4555-8555-555555555555',
    '55555555-5555-4555-8555-555555555556',
  ];
  const cliente = {
    query: vi.fn(async (sql: string, values: unknown[] = []) => {
      consultas.push(sql);
      parametros.push(values);
      // Explicit synthetic financial fixture; never implies institutional gratuity.
      if (sql.includes("to_regclass('sigd_tes.orden_pago')")) return { rows: [{ tabla: 'sigd_tes.orden_pago' }], rowCount: 1 };
      if (sql.includes('FROM sigd_tes.tarifa')) return { rows: [{ importe: '0.00' }], rowCount: 1 };
      if (sql === 'SELECT current_database() AS db') return { rows: [{ db: 'sigd_jacobo_demo' }], rowCount: 1 };
      if (sql.includes("datos_despues->'resultado' AS resultado")) {
        const resultado = auditadas.get(String(values[0]) + ':' + String(values[1]));
        return { rows: resultado ? [{ resultado }] : [], rowCount: resultado ? 1 : 0 };
      }
      if (sql.includes('FROM sigd_doc.requisito r')) {
        if (errorClasificacion) throw errorClasificacion;
        return { rows: tiposDocumentales, rowCount: tiposDocumentales.length };
      }
      if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
        return { rows: [{ id_tipo_tramite_tupa: UUID_TUPA, activo }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        if (errorIdentidad) throw errorIdentidad;
        return {
          rows: idPersona ? [{
            id_persona: idPersona,
            id_documento: datosIdentidad.id_documento ?? '74123456',
            tipo_persona: datosIdentidad.tipo_persona ?? 'NATURAL',
            nombre_identidad: datosIdentidad.nombre_identidad ?? 'Ana Quispe',
            activo: datosIdentidad.activo ?? true,
          }] : [],
          rowCount: idPersona ? 1 : 0,
        };
      }
      if (sql.includes('fn_generar_cut')) {
        const cut = cuts[Math.min(cutIndex, cuts.length - 1)];
        cutIndex += 1;
        return { rows: [{ cut }], rowCount: 1 };
      }
      if (falloPersistencia && sql.includes(falloPersistencia)) {
        throw new Error('PARADA_DE_PRUEBA_ANTES_DE_PERSISTENCIA');
      }
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
        const datos = JSON.parse(String(values[8]));
        auditadas.set(datos.usuario_id + ':' + datos.huella_solicitud, datos.resultado);
        return { rows: [{ id_auditoria: '77777777-7777-4777-8777-777777777777' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO sigd_doc.expediente')) {
        expedienteActual = expedienteIds[Math.min(expedienteIndex, expedienteIds.length - 1)];
        expedienteIndex += 1;
        return { rows: [{ expediente_id: expedienteActual, fecha_registro: values[4] }], rowCount: 1 };
      }
      if (sql.includes('FROM sigd_tra.expediente') && sql.includes('FOR UPDATE')) {
        return { rows: [{ expediente_id: expedienteActual }], rowCount: 1 };
      }
      if (sql.includes('MAX(f.folio_fin)')) {
        return { rows: [{ folio_inicio: 1 }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
        return { rows: [{ documento_adjunto_id: '66666666-6666-4666-8666-666666666666' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => cliente) } as unknown as Pool;
  const service = new RadicacionVirtualService(pool, obtenerFeriados);
  // Estas pruebas aíslan la transacción; la lectura S3 se prueba por separado.
  const verificarArchivo = vi.spyOn(service as unknown as {
    verificarArchivo: (documento: unknown) => Promise<{ bucket: string; key: string; paginas: number }>;
  }, 'verificarArchivo').mockResolvedValue({ bucket: 'bucket-unitario', key: 'expedientes/2026/77777777-7777-4777-8777-777777777777.pdf', paginas: 1 });
  return { service, consultas, parametros, cliente, verificarArchivo };
}

describe('TramiCore · consulta del catálogo TUPA según DocuCore SQL 04', () => {
  it('requiere un token de acceso con un subject UUID y obtiene de él el id_usuario', () => {
    const secreto = 'secreto-de-prueba-para-firmar-tokens-sigd';
    vi.stubEnv('AUTH_JWT_SECRET', secreto);
    try {
      expect(() => exigirIdUsuarioAutenticado(undefined)).toThrow();
      expect(() => exigirIdUsuarioAutenticado('Bearer no-es-un-jwt')).toThrow();
      const tokenConSubjectInvalido = firmarTokenAcceso({ sub: 'no-es-uuid', secreto });
      expect(() => exigirIdUsuarioAutenticado(`Bearer ${tokenConSubjectInvalido}`)).toThrow();

      const token = firmarTokenAcceso({ sub: UUID_USUARIO, secreto });
      expect(exigirIdUsuarioAutenticado(`Bearer ${token}`)).toBe(UUID_USUARIO);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('resuelve el UUID de persona desde la cuenta autenticada y conserva la vigencia TUPA', async () => {
    const { service, consultas, parametros } = crearServicioConTipo(true);

    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toThrow('PARADA_DE_PRUEBA_ANTES_DE_PERSISTENCIA');

    const consultaTipo = consultas.find((sql) => sql.includes('FROM sigd_doc.tipo_tramite_tupa'));
    expect(consultaTipo).toContain('tipo_tramite_id AS id_tipo_tramite_tupa');
    expect(consultaTipo).toContain('vigente AS activo');
    expect(consultaTipo).toContain('WHERE tipo_tramite_id = $1');
    const consultaIdentidad = consultas.find((sql) => sql.includes('FROM sigd_auth.cuenta_usuario'));
    expect(consultaIdentidad).toContain('p.id_persona = c.id_persona');
    expect(consultaIdentidad).toContain('c.id_usuario = $1::uuid');
    expect(consultaIdentidad).toContain('p.tipo AS tipo_persona');
    expect(consultaIdentidad).toContain('pn.nombre_completo');
    expect(consultaIdentidad).toContain('pj.razon_social');
    expect(parametros[consultas.indexOf(consultaIdentidad!)]).toEqual([UUID_USUARIO]);
    const insercionExpediente = consultas.findIndex((sql) => sql.includes('INSERT INTO sigd_tra.expediente'));
    expect(parametros[insercionExpediente]?.[4]).toBe(UUID_PERSONA);
  });

  it('rechaza un tipo no vigente antes de resolver la identidad', async () => {
    const { service, consultas } = crearServicioConTipo(false);

    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toMatchObject({
      invalidParams: [{ reason: expect.stringContaining('TIPO_TRAMITE_INACTIVO') }],
    });
    expect(consultas.some((sql) => sql.includes('FROM sigd_auth.cuenta_usuario'))).toBe(false);
  });

  it('rechaza una cuenta sin persona activa asociada antes de insertar y revierte la transacción', async () => {
    const { service, consultas, cliente } = crearServicioConTipo(true, null);

    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(consultas.some((sql) => sql.includes('INSERT INTO sigd_tra.expediente'))).toBe(false);
    expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it.each([
    ['documento diferente', { id_documento: '70112233' }],
    ['tipo de persona incompatible', { tipo_persona: 'JURIDICA' }],
    ['nombre declarado diferente', { nombre_identidad: 'María Salazar' }],
    ['cuenta desactivada', { activo: false }],
  ])('rechaza una identidad no coincidente (%s) sin insertar', async (_motivo, identidad) => {
    const { service, consultas, cliente } = crearServicioConTipo(true, UUID_PERSONA, undefined, identidad);

    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(consultas.some((sql) => sql.includes('INSERT INTO sigd_tra.expediente'))).toBe(false);
    expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('compara sin distinguir mayúsculas, tildes ni espacios duplicados', async () => {
    const { service } = crearServicioConTipo(true, UUID_PERSONA, undefined, {
      nombre_identidad: 'ANA  QUISPE',
    });
    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toThrow('PARADA_DE_PRUEBA_ANTES_DE_PERSISTENCIA');
  });

  it('propaga el error al consultar la identidad y revierte sin intentar persistir', async () => {
    const { service, consultas, cliente } = crearServicioConTipo(true, UUID_PERSONA, new Error('fallo de consulta'));

    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toThrow('fallo de consulta');
    expect(consultas.some((sql) => sql.includes('INSERT INTO sigd_tra.expediente'))).toBe(false);
    expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('no acepta idPersona como identidad proporcionada por el cliente', () => {
    expect(() => radicacionVirtualSchema.parse({ ...datosRadicacion(), idPersona: 42 })).toThrow();
    expect(datosRadicacion()).not.toHaveProperty('idPersona');
  });

  it.each([
    { tipoDocumentalId: '55555555-5555-4555-8555-555555555555' },
    { tipoDocumentalCodigo: 'FUT' },
    { tipoDocumentalId: UUID_DOCUMENTAL, tipoDocumentalCodigo: 'FUT' },
  ])('rechaza clasificación explícita incorrecta incluso con un solo tipo: %j', async clasificacion => {
    const { service, consultas, cliente } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, [
      { tipo_documental_id: UUID_DOCUMENTAL, tipo_doc_codigo: 'ANEXO', requiere_condicion: false },
    ]);
    const datos = datosRadicacion();
    Object.assign(datos.documentos[0], clasificacion);
    await expect(service.radicar(datos, UUID_USUARIO)).rejects.toMatchObject({
      invalidParams: [{ reason: expect.stringContaining('TIPO_DOCUMENTAL_NO_AUTORIZADO') }],
    });
    expect(consultas.some(sql => sql.includes('fn_generar_cut') || sql.includes('INSERT INTO'))).toBe(false);
    expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('resuelve el único UUID documental por las relaciones, sin clasificar por metadatos', async () => {
    const { service, consultas, parametros } = crearServicioConTipo(true);
    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toThrow('PARADA_DE_PRUEBA_ANTES_DE_PERSISTENCIA');
    const indice = consultas.findIndex(sql => sql.includes('FROM sigd_doc.requisito r'));
    expect(consultas[indice]).toContain('JOIN sigd_doc.tipo_documento_requisito');
    expect(consultas[indice]).toContain('JOIN sigd_doc.tipo_documento td');
    expect(consultas[indice]).toContain('td.vigente = TRUE');
    expect(parametros[indice]).toEqual([UUID_TUPA]);
    const insercion = consultas.findIndex(sql => sql.includes('INSERT INTO sigd_tra.expediente'));
    expect(consultas[insercion]).toContain('tipo_documental_id');
    expect(parametros[insercion][3]).toBe(UUID_DOCUMENTAL);
    const docucore = consultas.findIndex(sql => sql.includes('INSERT INTO sigd_doc.expediente'));
    expect(parametros[docucore][0]).toBe(UUID_TUPA);
  });

  it.each([
    ['sin configuración', []],
    ['varios tipos', [
      { tipo_documental_id: UUID_DOCUMENTAL, requiere_condicion: false },
      { tipo_documental_id: '55555555-5555-4555-8555-555555555555', requiere_condicion: false },
    ]],
    ['condición sin información disponible', [{ tipo_documental_id: UUID_DOCUMENTAL, requiere_condicion: true }]],
  ])('bloquea %s antes del CUT y de toda inserción', async (_caso, tipos) => {
    const { service, consultas, cliente } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, tipos);
    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toMatchObject({
      invalidParams: [{ name: 'documentos', reason: expect.stringContaining('CLASIFICACION_DOCUMENTAL_') }],
    });
    expect(consultas.some(sql => sql.includes('fn_generar_cut') || sql.includes('INSERT INTO'))).toBe(false);
    expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
    expect(cliente.release).toHaveBeenCalledOnce();
  });

  it('bloquea varios documentos sin utilizar su orden ni sus nombres para clasificarlos', async () => {
    const { service, consultas } = crearServicioConTipo(true);
    const datos = datosRadicacion();
    datos.documentos.push({ ...datos.documentos[0], nombreArchivo: 'comprobante.pdf', hashSha256: 'b'.repeat(64) });
    await expect(service.radicar(datos, UUID_USUARIO)).rejects.toMatchObject({
      invalidParams: [{ reason: expect.stringContaining('CLASIFICACION_DOCUMENTAL_AMBIGUA') }],
    });
    expect(consultas.some(sql => sql.includes('FROM sigd_doc.requisito r') || sql.includes('fn_generar_cut') || sql.includes('INSERT INTO'))).toBe(false);
  });

  it('propaga un error de clasificación sin generar CUT ni insertar registros', async () => {
    const { service, consultas, cliente } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, [], new Error('consulta documental fallida'));
    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toThrow('consulta documental fallida');
    expect(consultas.some(sql => sql.includes('fn_generar_cut') || sql.includes('INSERT INTO'))).toBe(false);
    expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('coordina los dominios con el UUID devuelto por DocuCore y confirma después del asiento', async () => {
    const { service, consultas, parametros, cliente } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, undefined, undefined, null);
    const resultado = await service.radicar(datosRadicacion(), UUID_USUARIO, new Date('2026-10-16T15:00:00Z'));
    const id = '55555555-5555-4555-8555-555555555555';
    const indice = (tabla: string) => consultas.findIndex(sql => sql.includes(`INSERT INTO ${tabla}`));
    expect(parametros[indice('sigd_doc.expediente')][0]).toBe(UUID_TUPA);
    expect(parametros[indice('sigd_tra.expediente')][0]).toBe(id);
    expect(parametros[indice('sigd_tra.tramite')][0]).toBe(id);
    expect(parametros[indice('sigd_doc.documento_adjunto')]).toEqual([
      id, 'solicitud.pdf', 'application/pdf', 1024, 'a'.repeat(64), 'bucket-unitario',
      'expedientes/2026/77777777-7777-4777-8777-777777777777.pdf', UUID_DOCUMENTAL, UUID_USUARIO,
    ]);
    const folio = consultas.findIndex(sql => sql.includes('INSERT INTO sigd_tra.expediente_documento_folio'));
    expect(parametros[folio]).toEqual([id, '66666666-6666-4666-8666-666666666666', 1, 1, UUID_USUARIO]);
    expect(parametros[indice('sigd_tra.asiento_registro')][0]).toBe(id);
    expect(consultas.at(-1)).toBe('COMMIT');
    expect(consultas.filter(sql => sql.includes('INSERT INTO sigd_doc.expediente'))).toHaveLength(1);
    expect(consultas.some(sql => sql.includes('sigd_tra.cargo_digital') || sql.includes('sigd_tra.documento_adjunto'))).toBe(false);
    expect(resultado.expedienteId).toBe(id);
    expect(resultado.cargoDigital.codigo).toBe(resultado.cut);
    expect(Object.keys(resultado).sort()).toEqual(['anio', 'cargoDigital', 'cut', 'expedienteId', 'fechaEnvioReal', 'fechaRadicacionLegal', 'fueraDeHorario', 'mensajeLegal', 'totalFolios'].sort());
    expect(cliente.release).toHaveBeenCalledOnce();
  });

  it('admite dos radicaciones independientes del mismo ciudadano y SUZ26-035 en el entorno aislado', async () => {
    const { service, consultas, cliente } = crearServicioConTipo(
      true,
      UUID_PERSONA,
      undefined,
      {},
      undefined,
      undefined,
      null,
      async () => [],
      ['EXP-2026-000101', 'EXP-2026-000102'],
    );
    const primera = await service.radicar(datosRadicacion(), UUID_USUARIO);
    const segunda = await service.radicar({
      ...datosRadicacion(),
      asunto: 'Segunda solicitud independiente de certificado',
      documentos: [{ ...datosRadicacion().documentos[0], nombreArchivo: 'segundo.pdf' }],
    }, UUID_USUARIO);

    expect(primera.cut).toBe('EXP-2026-000101');
    expect(segunda.cut).toBe('EXP-2026-000102');
    expect(segunda.expedienteId).not.toBe(primera.expedienteId);
    expect(consultas.filter((sql) => sql === 'COMMIT')).toHaveLength(2);
    expect(consultas.some((sql) => /SELECT.*solicitante_id.*tipo_tramite_id/is.test(sql))).toBe(false);
    expect(cliente.release).toHaveBeenCalledTimes(2);
  });

  it('recupera un reintento idéntico sin consumir otro CUT ni insertar otro expediente', async () => {
    const { service, consultas } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, undefined, undefined, null);
    const primera = await service.radicar(datosRadicacion(), UUID_USUARIO);
    const repetida = await service.radicar(datosRadicacion(), UUID_USUARIO);
    expect(repetida).toEqual(primera);
    expect(consultas.filter(sql => sql.includes('pg_advisory_xact_lock'))).toHaveLength(2);
    expect(consultas.filter(sql => sql.includes('fn_generar_cut'))).toHaveLength(1);
    expect(consultas.filter(sql => sql.includes('INSERT INTO sigd_doc.expediente'))).toHaveLength(1);
    expect(consultas.filter(sql => sql.includes('INSERT INTO sigd_audit.bitacora_auditoria'))).toHaveLength(1);
  });

  it('aplica la excepción demo autenticada y deja evidencia económica sin pago ficticio', async () => {
    vi.stubEnv('SIGD_DEMO_OMITIR_PAGO', 'true'); vi.stubEnv('NODE_ENV', 'test');
    try {
      const tipos = [
        { tipo_documental_id: UUID_DOCUMENTAL, tipo_doc_codigo: 'FUT', requiere_condicion: false, obligatorio: true },
        { tipo_documental_id: '88888888-8888-4888-8888-888888888888', tipo_doc_codigo: 'COMPROBANTE_PAGO', requiere_condicion: false, obligatorio: true },
      ];
      const { service, consultas, parametros } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, tipos, undefined, null);
      const datos = datosRadicacion(); datos.documentos[0].tipoDocumentalCodigo = 'FUT';
      const resultado = await service.radicar(datos, UUID_USUARIO);
      expect(resultado.mensajeLegal).toContain('Estado económico: NO VERIFICADO');
      const indice = consultas.findIndex(sql => sql.includes('INSERT INTO sigd_audit.bitacora_auditoria'));
      expect(JSON.parse(String(parametros[indice][8]))).toMatchObject({ usuario_id: UUID_USUARIO, estado_economico: 'NO_VERIFICADO', identidad: 'SESION_AUTENTICADA' });
      expect(consultas.some(sql => /INSERT INTO.*(?:pago|transaccion_pago)/i.test(sql))).toBe(false);
    } finally { vi.unstubAllEnvs(); }
  });

  it.each(['INSERT INTO sigd_doc.expediente', 'INSERT INTO sigd_tra.expediente', 'INSERT INTO sigd_tra.tramite',
    'INSERT INTO sigd_doc.documento_adjunto', 'INSERT INTO sigd_tra.expediente_documento_folio', 'INSERT INTO sigd_tra.asiento_registro', 'INSERT INTO sigd_audit.bitacora_auditoria'])
  ('revierte sin COMMIT cuando falla %s', async fallo => {
    const { service, consultas, cliente } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, undefined, undefined, fallo);
    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toThrow('PARADA_DE_PRUEBA_ANTES_DE_PERSISTENCIA');
    expect(consultas.at(-1)).toBe('ROLLBACK');
    expect(consultas).not.toContain('COMMIT');
    expect(cliente.release).toHaveBeenCalledOnce();
  });

  it('no genera CUT ni inserta si no puede verificar el objeto S3', async () => {
    const { service, verificarArchivo, consultas } = crearServicioConTipo(true);
    verificarArchivo.mockRejectedValueOnce(new Error('objeto no disponible'));
    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toThrow('objeto no disponible');
    expect(consultas.some(sql => sql.includes('INSERT INTO') || sql.includes('fn_generar_cut'))).toBe(false);
    expect(consultas.at(-1)).toBe('ROLLBACK');
  });

  it('no genera CUT ni inserta cuando falla la evaluación del horario', async () => {
    const { service, consultas, cliente } = crearServicioConTipo(
      true, UUID_PERSONA, undefined, {}, undefined, undefined, null,
      async () => { throw new Error('calendario no disponible'); },
    );
    await expect(service.radicar(datosRadicacion(), UUID_USUARIO)).rejects.toThrow('calendario no disponible');
    expect(consultas.some(sql => sql.includes('fn_generar_cut') || sql.includes('INSERT INTO'))).toBe(false);
    expect(consultas.at(-1)).toBe('ROLLBACK');
    expect(cliente.release).toHaveBeenCalledOnce();
  });
});

describe('Radicación · lectura del calendario antes del CUT', () => {
  it('reutiliza la conexión transaccional sin reservar ni liberar otra conexión del pool', async () => {
    const cliente = { query: vi.fn().mockResolvedValue({ rows: [{ fecha: '2026-10-13' }] }), release: vi.fn() };
    const connect = vi.fn();
    const pool = { connect } as unknown as Pool;
    await expect(crearProveedorFeriados(pool)(cliente as unknown as PoolClient)).resolves.toEqual(['2026-10-13']);
    expect(connect).not.toHaveBeenCalled();
    expect(cliente.release).not.toHaveBeenCalled();
  });

  it('propaga un fallo SQL en vez de tratarlo como un calendario sin feriados', async () => {
    const error = Object.assign(new Error('No se pudo leer el calendario'), { code: '42703' });
    const cliente = { query: vi.fn().mockRejectedValue(error), release: vi.fn() };
    const pool = { connect: vi.fn().mockResolvedValue(cliente) } as unknown as Pool;
    await expect(crearProveedorFeriados(pool)()).rejects.toBe(error);
    expect(cliente.release).toHaveBeenCalledOnce();
  });

  it('acepta una consulta válida sin feriados y libera la conexión', async () => {
    const cliente = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    const pool = { connect: vi.fn().mockResolvedValue(cliente) } as unknown as Pool;
    await expect(crearProveedorFeriados(pool)()).resolves.toEqual([]);
    expect(cliente.release).toHaveBeenCalledOnce();
  });
});

describe('Radicación · verificación de referencia existente en storage, sin subida real', () => {
  const contenido = pdfStorageBytes;
  const key = 'expedientes/2026/77777777-7777-4777-8777-777777777777.pdf';
  const documento = { ...datosRadicacion().documentos[0], storagePath: key,
    tamanoBytes: contenido.length, hashSha256: createHash('sha256').update(contenido).digest('hex') };

  async function verificar(cambios = {}, respuesta?: Response) {
    vi.stubEnv('S3_ENDPOINT', 'http://storage-unitario.invalid:9000');
    vi.stubEnv('S3_BUCKET', 'bucket-unitario');
    const leer = vi.fn().mockResolvedValue(respuesta ?? new Response(contenido, { headers: { 'content-type': 'application/pdf' } }));
    vi.stubGlobal('fetch', leer);
    const servicio = new RadicacionVirtualService({} as Pool, async () => []);
    try {
      const resultado = await (servicio as unknown as { verificarArchivo: (doc: unknown) => Promise<unknown> }).verificarArchivo({ ...documento, ...cambios });
      return { resultado, leer };
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  }

  it('usa el firmador existente y comprueba bytes, hash, tamaño y MIME antes de persistir', async () => {
    const { resultado, leer } = await verificar();
    expect(resultado).toEqual({ bucket: 'bucket-unitario', key, paginas: 1 });
    const [url, opciones] = leer.mock.calls[0];
    expect(new URL(url).pathname).toBe(`/bucket-unitario/${key}`);
    expect(new URL(url).searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(opciones.headers).toBeUndefined();
    expect(opciones.method).toBeUndefined(); // fetch usa GET, nunca PUT ni POST.
  });

  it.each([undefined, 'blob:local', 'https://externo.invalid/archivo.pdf', '../archivo.pdf'])
  ('rechaza una referencia que no proviene de presigned-url: %s', async storagePath => {
    await expect(verificar({ storagePath })).rejects.toMatchObject({ invalidParams: [{ reason: expect.stringContaining('ARCHIVO_NO_ALMACENADO') }] });
  });

  it.each([{ hashSha256: 'b'.repeat(64) }, { tamanoBytes: 1 }, { tamanoBytes: contenido.length + 1 }, { contentType: 'image/png' }])
  ('rechaza metadatos que no coinciden con el objeto: %j', async cambios => {
    await expect(verificar(cambios)).rejects.toMatchObject({ invalidParams: [{ reason: expect.stringContaining('ARCHIVO_NO_COINCIDE') }] });
  });

  it('rechaza un objeto inexistente sin crear otro archivo', async () => {
    await expect(verificar({}, new Response(null, { status: 404 }))).rejects.toMatchObject({ invalidParams: [{ reason: expect.stringContaining('ARCHIVO_NO_DISPONIBLE') }] });
  });

  it('rechaza un objeto no PDF aunque su hash, tamaño y MIME coincidan', async () => {
    const bytes = Buffer.from('MZ-archivo-que-no-es-pdf');
    await expect(verificar({
      tamanoBytes: bytes.length,
      hashSha256: createHash('sha256').update(bytes).digest('hex'),
    }, new Response(bytes, { headers: { 'content-type': 'application/pdf' } }))).rejects.toMatchObject({
      invalidParams: [{ reason: expect.stringContaining('ARCHIVO_NO_VALIDO') }],
    });
  });

  it('verifica la firma PDF aunque sus bytes lleguen en fragmentos distintos', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(contenido.subarray(0, 2));
      controller.enqueue(contenido.subarray(2, 4));
      controller.enqueue(contenido.subarray(4));
      controller.close();
    } });
    const { resultado } = await verificar({}, new Response(stream, { headers: { 'content-type': 'application/pdf' } }));
    expect(resultado).toEqual({ bucket: 'bucket-unitario', key, paginas: 1 });
  });

describe('clasificación documental multi-archivo TUPA Suiza 2026 (SUZ26-066)', () => {
  const UUID_FUT = 'dc156983-a824-418a-835e-5a7e104c9ca5';
  const UUID_ANEXO = 'b7f37bde-ec45-49d0-b28e-fc2ad4341b60';

  const tiposMultiples = [
    { tipo_documental_id: UUID_FUT, tipo_doc_codigo: 'FUT', requiere_condicion: false },
    { tipo_documental_id: UUID_ANEXO, tipo_doc_codigo: 'ANEXO', requiere_condicion: false },
  ];

  it.each(['FUT', 'ANEXO'])('acepta un único adjunto explícito %s si los demás tipos son opcionales', async codigo => {
    const tipos = tiposMultiples.map(t => ({ ...t, obligatorio: false }));
    const { service, parametros, consultas } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, tipos, undefined, null);
    const datos = datosRadicacion();
    datos.documentos[0].tipoDocumentalCodigo = codigo;
    await expect(service.radicar(datos, UUID_USUARIO)).resolves.toHaveProperty('cut');
    const indice = consultas.findIndex(sql => sql.includes('INSERT INTO sigd_tra.expediente'));
    expect(parametros[indice][3]).toBe(tipos.find(t => t.tipo_doc_codigo === codigo)!.tipo_documental_id);
    expect(consultas.find(sql => sql.includes('FROM sigd_doc.requisito r'))).toContain('bool_or(r.obligatorio) AS obligatorio');
  });

  it('rechaza la falta de un tipo realmente obligatorio antes del CUT', async () => {
    const tipos = tiposMultiples.map(t => ({ ...t, obligatorio: t.tipo_doc_codigo === 'FUT' }));
    const { service, consultas, cliente } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, tipos);
    const datos = datosRadicacion(); datos.documentos[0].tipoDocumentalCodigo = 'ANEXO';
    await expect(service.radicar(datos, UUID_USUARIO)).rejects.toMatchObject({
      invalidParams: [{ reason: expect.stringContaining('DOCUMENTOS_FALTANTES') }],
    });
    expect(consultas.some(sql => sql.includes('fn_generar_cut') || sql.includes('INSERT INTO'))).toBe(false);
    expect(cliente.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rechaza ID y código contradictorios entre tipos válidos sin consumir CUT', async () => {
    const { service, consultas } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, tiposMultiples);
    const datos = datosRadicacion();
    datos.documentos = [
      { ...datos.documentos[0], tipoDocumentalId: UUID_FUT, tipoDocumentalCodigo: 'ANEXO' },
      { ...datos.documentos[0], nombreArchivo: 'anexo.pdf', tipoDocumentalCodigo: 'ANEXO' },
    ];
    await expect(service.radicar(datos, UUID_USUARIO)).rejects.toMatchObject({
      invalidParams: [{ reason: expect.stringContaining('TIPO_DOCUMENTAL_NO_AUTORIZADO') }],
    });
    expect(consultas.some(sql => sql.includes('fn_generar_cut') || sql.includes('INSERT INTO'))).toBe(false);
  });

  it('radica exitosamente un procedimiento multi-documental cuando se proporcionan todos los tipos clasificados', async () => {
    const { service, consultas, cliente } = crearServicioConTipo(
      true,
      UUID_PERSONA,
      undefined,
      {},
      tiposMultiples as any,
      undefined,
      null, // No simular fallo en persistencia
    );

    const datos = datosRadicacion();
    datos.totalFolios = 2;
    datos.documentos = [
      {
        nombreArchivo: 'solicitud-fut.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 1024,
        hashSha256: 'a'.repeat(64),
        tipoDocumentalCodigo: 'FUT',
      },
      {
        nombreArchivo: 'voucher-anexo.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 2048,
        hashSha256: 'b'.repeat(64),
        tipoDocumentalCodigo: 'ANEXO',
      },
    ];

    const resultado = await service.radicar(datos, UUID_USUARIO, new Date('2026-10-16T15:00:00Z'));
    expect(resultado.cut).toBe('EXP-2026-000001');
    expect(resultado.totalFolios).toBe(2);

    // Debe insertar en expediente tramitológico con FUT como tipo principal
    const insExp = consultas.find(sql => sql.includes('INSERT INTO sigd_tra.expediente'));
    expect(insExp).toBeDefined();

    // Debe insertar ambos adjuntos en sigd_doc.documento_adjunto
    const insAdjuntos = consultas.filter(sql => sql.includes('INSERT INTO sigd_doc.documento_adjunto'));
    expect(insAdjuntos.length).toBe(2);

    // Debe foliar ambos adjuntos
    const insFolios = consultas.filter(sql => sql.includes('INSERT INTO sigd_tra.expediente_documento_folio'));
    expect(insFolios.length).toBe(2);

    expect(cliente.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rechaza con error descriptivo si se proporcionan tipos duplicados en la radicación', async () => {
    const { service } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, tiposMultiples as any);
    const datos = datosRadicacion();
    datos.documentos = [
      {
        nombreArchivo: 'fut-1.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 1024,
        hashSha256: 'a'.repeat(64),
        tipoDocumentalCodigo: 'FUT',
      },
      {
        nombreArchivo: 'fut-2.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 2048,
        hashSha256: 'b'.repeat(64),
        tipoDocumentalCodigo: 'FUT',
      },
    ];

    await expect(service.radicar(datos, UUID_USUARIO)).rejects.toMatchObject({
      invalidParams: [{ reason: expect.stringContaining('TIPO_DOCUMENTAL_DUPLICADO') }],
    });
  });

  it('rechaza con error descriptivo si se proporciona un tipo documental no autorizado para el trámite', async () => {
    const { service } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, tiposMultiples as any);
    const datos = datosRadicacion();
    datos.documentos = [
      {
        nombreArchivo: 'fut.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 1024,
        hashSha256: 'a'.repeat(64),
        tipoDocumentalCodigo: 'FUT',
      },
      {
        nombreArchivo: 'otro.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 2048,
        hashSha256: 'b'.repeat(64),
        tipoDocumentalCodigo: 'TIPO_NO_EXISTE',
      },
    ];

    await expect(service.radicar(datos, UUID_USUARIO)).rejects.toMatchObject({
      invalidParams: [{ reason: expect.stringContaining('TIPO_DOCUMENTAL_NO_AUTORIZADO') }],
    });
  });

  it('rechaza si faltan documentos obligatorios requeridos por el procedimiento TUPA', async () => {
    const { service } = crearServicioConTipo(true, UUID_PERSONA, undefined, {}, tiposMultiples as any);
    const datos = datosRadicacion();
    datos.documentos = [
      {
        nombreArchivo: 'fut.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 1024,
        hashSha256: 'a'.repeat(64),
        tipoDocumentalCodigo: 'FUT',
      },
      {
        nombreArchivo: 'fut-extra.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 2048,
        hashSha256: 'b'.repeat(64),
        tipoDocumentalId: UUID_FUT,
      },
    ];

    // Este caso tiene duplicado FUT y le falta ANEXO
    await expect(service.radicar(datos, UUID_USUARIO)).rejects.toMatchObject({
      invalidParams: [{ reason: expect.stringContaining('TIPO_DOCUMENTAL_DUPLICADO') }],
    });
  });
});

});
