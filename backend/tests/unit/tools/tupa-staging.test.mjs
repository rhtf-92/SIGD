import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  cargarStagingDesdeTexto,
  validarStaging,
} from '../../../src/tools/tupa/validate-staging.mjs';
import {
  importarStaging,
  REFERENCIA_APROBACION_PROTOTIPO,
  WHITELIST_APROBADOS_PROTOTIPO,
} from '../../../src/tools/tupa/import-staging.mjs';

const SHA_VALIDO = 'a'.repeat(64);
const SHA_PDF_OFICIAL = '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622';
const REFERENCIA_PROTOTIPO = 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1';
const CATALOGO_PROTOTIPO = new Map([
  ['p1-fila-05', { pagina: 1, denominacion: 'Certificado Modular (I, II, III y IV)\nPor cada M\u00f3dulo' }],
  ['p1-fila-06', { pagina: 1, denominacion: 'Certificado de Ingl\u00e9s' }],
  ['p4-fila-02', { pagina: 4, denominacion: 'Constancia de No Adeudar\n(Para fines de Titulaci\u00f3n)' }],
  ['p4-fila-05', { pagina: 4, denominacion: 'Expedici\u00f3n de T\u00edtulo' }],
  ['p4-fila-06', { pagina: 4, denominacion: 'Certificado de Estudios Superiores\n(6 Semestres)' }],
  ['p4-fila-07', { pagina: 4, denominacion: 'Visaci\u00f3n de Certificado de Estudios Superiores' }],
  ['p4-fila-10', { pagina: 4, denominacion: 'Inscripci\u00f3n de T\u00edtulo' }],
  ['p4-fila-15', { pagina: 4, denominacion: 'Modificaci\u00f3n de Datos del T\u00edtulo' }],
  ['p5-fila-06', { pagina: 5, denominacion: 'Constancia de Egresado' }],
  ['p5-fila-07', { pagina: 5, denominacion: 'Certificado de Bachillerato' }],
  ['p5-fila-09', { pagina: 5, denominacion: 'Convalidaci\u00f3n entre Planes de Estudios' }],
  ['p5-fila-10', { pagina: 5, denominacion: 'Convalidaci\u00f3n por Unidades de Competencia' }],
  ['p5-fila-11', { pagina: 5, denominacion: 'Devoluci\u00f3n de Expediente' }],
  ['p5-fila-18', { pagina: 5, denominacion: 'Reserva de Matr\u00edcula - Ingresantes' }],
  ['p5-fila-19', { pagina: 5, denominacion: 'Licencia de Estudios - Estudiantes Antiguos' }],
  ['p5-fila-20', { pagina: 5, denominacion: 'Traslado Interno' }],
  ['p5-fila-21', { pagina: 5, denominacion: 'Traslado Externo' }],
  ['p6-fila-04', { pagina: 6, denominacion: 'Titulaci\u00f3n de Otros Institutos Tecnol\u00f3gicos' }],
]);
const EXCLUIDAS_PROTOTIPO = new Set([
  'p4-fila-16', 'p5-fila-05', 'p5-fila-08',
  'p6-fila-02', 'p6-fila-03', 'p6-fila-05',
]);

function stagingValido() {
  return {
    schemaVersion: 1,
    fuente: {
      archivoNombre: 'TUPA_2026_IESTP_Suiza.pdf',
      documentoSha256: SHA_VALIDO,
      tamanoBytes: 1234,
      numeroPaginas: 6,
      hashVerificado: true,
    },
    entradas: [
      {
        documentoSha256: SHA_VALIDO,
        fuenteNombre: 'TUPA_2026_IESTP_Suiza.pdf',
        pagina: 1,
        referenciaFila: 'p1-fila-01',
        revision: 1,
        codigoExterno: null,
        textoOriginal: 'Texto conservado sin reinterpretar',
        denominacionOriginal: 'Denominacion literal',
        montoOriginal: 'S/ 10.00 por unidad',
        requisitosOriginal: ['Solicitud literal'],
        referenciaNormativaOriginal: null,
        versionFuente: '2026',
        vigenciaDesde: null,
        vigenciaHasta: null,
        estadoValidacion: 'PENDIENTE_VALIDACION',
        referenciaAprobacion: null,
        clasificacion: 'PAGO_DERECHO',
        candidatoRadicacion: 'REQUIERE_DECISION',
        estadoHomologacion: 'REQUIERE_DECISION',
        observacionClasificacion: 'La fuente no determina si es radicable.',
      },
    ],
  };
}

describe('staging controlado del TUPA Suiza 2026', () => {
  it('acepta una fuente y entrada validas', () => {
    const resultado = validarStaging(stagingValido());
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.errores, []);
  });

  it('usa las clasificaciones canonicas con guion bajo', () => {
    const staging = stagingValido();
    assert.equal(validarStaging(staging).ok, true);
    staging.entradas[0].clasificacion = 'PAGO/DERECHO';
    assert.match(validarStaging(staging).errores.join('\n'), /clasificacion/);
  });

  it('valida los tres estados de candidatura de radicacion', () => {
    const staging = stagingValido();
    for (const estado of ['CANDIDATO', 'NO_CANDIDATO', 'REQUIERE_DECISION']) {
      staging.entradas[0].candidatoRadicacion = estado;
      assert.equal(validarStaging(staging).ok, true);
    }
    staging.entradas[0].candidatoRadicacion = 'RADICABLE';
    assert.match(validarStaging(staging).errores.join('\n'), /candidatoRadicacion/);
  });

  it('rechaza un SHA-256 que no cumple el CHECK fisico', () => {
    const staging = stagingValido();
    staging.fuente.documentoSha256 = 'ABC123';
    const resultado = validarStaging(staging);
    assert.equal(resultado.ok, false);
    assert.match(resultado.errores.join('\n'), /documentoSha256/);
  });

  it('rechaza una pagina menor que uno', () => {
    const staging = stagingValido();
    staging.entradas[0].pagina = 0;
    assert.match(validarStaging(staging).errores.join('\n'), /pagina/);
  });

  it('rechaza una denominacion vacia', () => {
    const staging = stagingValido();
    staging.entradas[0].denominacionOriginal = '   ';
    assert.match(validarStaging(staging).errores.join('\n'), /denominacionOriginal/);
  });

  it('rechaza JSON de staging malformado antes de validar requisitos', () => {
    assert.throws(() => cargarStagingDesdeTexto('{"entradas": [}'), /JSON invalido/);
  });

  it('rechaza duplicados por fuente, pagina, referencia y revision', () => {
    const staging = stagingValido();
    staging.entradas.push(structuredClone(staging.entradas[0]));
    assert.match(validarStaging(staging).errores.join('\n'), /duplicada/);
  });

  it('rechaza APROBADO sin referencia de aprobacion', () => {
    const staging = stagingValido();
    staging.entradas[0].estadoValidacion = 'APROBADO';
    assert.match(validarStaging(staging).errores.join('\n'), /referenciaAprobacion/);
  });

  it('conserva el monto textual exactamente como fue transcrito', () => {
    const resultado = validarStaging(stagingValido());
    assert.equal(resultado.datos?.entradas[0].montoOriginal, 'S/ 10.00 por unidad');
  });

  it('conserva campos ausentes como null', () => {
    const entrada = validarStaging(stagingValido()).datos?.entradas[0];
    assert.equal(entrada?.codigoExterno, null);
    assert.equal(entrada?.referenciaNormativaOriginal, null);
    assert.equal(entrada?.vigenciaDesde, null);
    assert.equal(entrada?.vigenciaHasta, null);
  });

  it('activa exclusivamente las 18 entradas autorizadas para el prototipo', async () => {
    const ruta = new URL('../../../src/tools/tupa/staging/tupa-suiza-2026.staging.json', import.meta.url);
    const staging = cargarStagingDesdeTexto(await readFile(ruta, 'utf8'));
    const aprobadas = staging.entradas.filter((entrada) => entrada.estadoValidacion === 'APROBADO');
    const pendientes = staging.entradas.filter((entrada) => entrada.estadoValidacion === 'PENDIENTE_VALIDACION');

    assert.equal(staging.fuente.hashVerificado, true);
    assert.equal(staging.fuente.documentoSha256, SHA_PDF_OFICIAL);
    assert.equal(staging.fuente.tamanoBytes, 321617);
    assert.equal(staging.fuente.numeroPaginas, 6);
    assert.equal(staging.entradas.length, 72);
    assert.equal(aprobadas.length, 18);
    assert.equal(pendientes.length, 54);
    assert.ok(staging.entradas.every((entrada) => entrada.documentoSha256 === staging.fuente.documentoSha256));
    assert.deepEqual(
      new Set(aprobadas.map((entrada) => entrada.referenciaFila)),
      new Set(CATALOGO_PROTOTIPO.keys()),
    );
    assert.ok(aprobadas.every((entrada) => entrada.referenciaAprobacion === REFERENCIA_PROTOTIPO));
    assert.ok(pendientes.every((entrada) => entrada.referenciaAprobacion === null));
    assert.ok(staging.entradas
      .filter((entrada) => EXCLUIDAS_PROTOTIPO.has(entrada.referenciaFila))
      .every((entrada) => entrada.estadoValidacion === 'PENDIENTE_VALIDACION'));

    for (const entrada of aprobadas) {
      const esperada = CATALOGO_PROTOTIPO.get(entrada.referenciaFila);
      assert.ok(esperada);
      assert.equal(entrada.pagina, esperada.pagina);
      assert.equal(entrada.denominacionOriginal, esperada.denominacion);
    }
  });

  it('conserva exactamente un monto comprobable del PDF oficial', async () => {
    const ruta = new URL('../../../src/tools/tupa/staging/tupa-suiza-2026.staging.json', import.meta.url);
    const staging = cargarStagingDesdeTexto(await readFile(ruta, 'utf8'));
    const practicaInicial = staging.entradas.find((entrada) => entrada.referenciaFila === 'p1-fila-01');
    assert.equal(practicaInicial?.montoOriginal, 'S/ 35.00');
  });

  it('dry-run valida y no abre transaccion ni escribe', async () => {
    let consultas = 0;
    const resultado = await importarStaging(
      { query: async () => { consultas += 1; throw new Error('dry-run no debe consultar la base'); } },
      stagingValido(),
    );
    assert.deepEqual(resultado, { modo: 'DRY_RUN', entradasValidas: 1, insertadas: 0, omitidas: 0 });
    assert.equal(consultas, 0);
  });

  it('bloquea apply cuando el hash de la fuente no fue verificado', async () => {
    const staging = stagingValido();
    staging.fuente.hashVerificado = false;
    await assert.rejects(
      importarStaging({ query: async () => ({ rowCount: 0 }) }, staging, { aplicar: true }),
      /SHA-256 de la fuente no fue verificado/,
    );
  });

  it('no permite que el importador publique APROBADO', async () => {
    const staging = stagingValido();
    staging.entradas[0].estadoValidacion = 'APROBADO';
    staging.entradas[0].referenciaAprobacion = 'ACTA-VALIDA-PERO-NO-PUBLICABLE-POR-ESTA-HERRAMIENTA';
    await assert.rejects(
      importarStaging({ query: async () => ({ rowCount: 0 }) }, staging, { aplicar: true }),
      /no inserta registros APROBADO/,
    );
  });

  it('la whitelist de activacion contiene exactamente las 18 filas autorizadas', () => {
    assert.equal(WHITELIST_APROBADOS_PROTOTIPO.size, 18);
    assert.deepEqual(
      new Set(WHITELIST_APROBADOS_PROTOTIPO),
      new Set(CATALOGO_PROTOTIPO.keys()),
    );
    assert.equal(REFERENCIA_APROBACION_PROTOTIPO, REFERENCIA_PROTOTIPO);
  });

  it('apply acepta APROBADO solo con la opcion explicita, referencia exacta y fila autorizada', async () => {
    const consultas = [];
    const cliente = {
      query: async (sql) => {
        consultas.push(sql.trim());
        return { rowCount: sql.includes('INSERT INTO') ? 1 : null };
      },
    };
    const staging = stagingValido();
    staging.entradas[0] = {
      ...staging.entradas[0],
      pagina: 1,
      referenciaFila: 'p1-fila-05',
      estadoValidacion: 'APROBADO',
      referenciaAprobacion: REFERENCIA_PROTOTIPO,
    };
    const resultado = await importarStaging(cliente, staging, {
      aplicar: true,
      permitirAprobadosPrototipo: true,
    });
    assert.equal(consultas[0], 'BEGIN');
    assert.equal(consultas.at(-1), 'COMMIT');
    assert.deepEqual(resultado, { modo: 'APPLY', entradasValidas: 1, insertadas: 1, omitidas: 0 });
  });

  it('apply bloquea APROBADO aunque la opcion este habilitada si la fila no es autorizada', async () => {
    const staging = stagingValido();
    staging.entradas[0] = {
      ...staging.entradas[0],
      referenciaFila: 'p4-fila-16',
      estadoValidacion: 'APROBADO',
      referenciaAprobacion: REFERENCIA_PROTOTIPO,
    };
    await assert.rejects(
      importarStaging({ query: async () => ({ rowCount: 0 }) }, staging, {
        aplicar: true,
        permitirAprobadosPrototipo: true,
      }),
      /whitelist de 18 aprobados/,
    );
  });

  it('apply bloquea APROBADO con una referencia de aprobacion distinta de la del prototipo', async () => {
    const staging = stagingValido();
    staging.entradas[0] = {
      ...staging.entradas[0],
      referenciaFila: 'p1-fila-05',
      estadoValidacion: 'APROBADO',
      referenciaAprobacion: 'ACTA-VALIDA-PERO-NO-AUTORIZADA',
    };
    await assert.rejects(
      importarStaging({ query: async () => ({ rowCount: 0 }) }, staging, {
        aplicar: true,
        permitirAprobadosPrototipo: true,
      }),
      /referencia de aprobación no autorizada/,
    );
  });

  it('rechaza estados SQL invalidos antes de consultar la base', async () => {
    const staging = stagingValido();
    staging.entradas[0].estadoValidacion = 'PUBLICADO';
    let consultas = 0;
    await assert.rejects(
      importarStaging(
        { query: async () => { consultas += 1; return { rowCount: 0 }; } },
        staging,
      ),
      /estadoValidacion no coincide con el CHECK SQL/,
    );
    assert.equal(consultas, 0);
  });

  it('apply usa una transaccion y conserva la idempotencia del constraint', async () => {
    const consultas = [];
    const cliente = {
      query: async (sql) => {
        consultas.push(sql.trim());
        return { rowCount: sql.includes('INSERT INTO') ? 0 : null };
      },
    };
    const resultado = await importarStaging(cliente, stagingValido(), { aplicar: true });
    assert.equal(consultas[0], 'BEGIN');
    assert.match(consultas[1], /ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING/);
    assert.equal(consultas.at(-1), 'COMMIT');
    assert.deepEqual(resultado, { modo: 'APPLY', entradasValidas: 1, insertadas: 0, omitidas: 1 });
  });

  it('hace rollback si falla cualquier insercion', async () => {
    const consultas = [];
    const cliente = {
      query: async (sql) => {
        consultas.push(sql.trim());
        if (sql.includes('INSERT INTO')) throw new Error('fallo inducido');
        return { rowCount: null };
      },
    };
    await assert.rejects(importarStaging(cliente, stagingValido(), { aplicar: true }), /fallo inducido/);
    assert.equal(consultas[0], 'BEGIN');
    assert.equal(consultas.at(-1), 'ROLLBACK');
  });
});
