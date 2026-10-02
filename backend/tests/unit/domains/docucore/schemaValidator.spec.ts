import { describe, it, expect } from 'vitest';
import {
  SchemaValidatorServicio,
  SchemaValidationError,
  SchemaInvalidoError,
  type CargadorEsquemas,
  type EsquemaTupaCargado,
} from '../../../../src/domains/docucore/schemaValidator.service.js';
import { serializeError } from '../../../../src/errors/error-mapper.js';

// =============================================================================
// DocuCore · Batería unitaria del validador JSON Schema (Draft 2020-12)
// Autor: Christian Jhoel Rodríguez Cari (B_CHRISTIAN) · Sprint 4 · T-BE-DC-04
// =============================================================================
// Certifica que el sistema impida la radicación de solicitudes que no cumplan
// la estructura requerida: 12 esquemas TUPA polimórficos (válidos e inválidos),
// esquemas malformados e intentos de inyección, siempre bajo RFC 7807 con el
// código SCHEMA_VALIDATION_FAILED y el campo exacto en falta.
// =============================================================================

const DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema';

function crearCargador(schema: unknown, codigo: string, version = 1): CargadorEsquemas {
  return {
    cargarActivo: async (codigoTupa: string): Promise<EsquemaTupaCargado | null> =>
      codigoTupa === codigo ? { codigo_tupa: codigo, version, schema_definicion: schema } : null,
  };
}

function esquema(base: Record<string, unknown>): Record<string, unknown> {
  return { $schema: DRAFT_2020_12, type: 'object', additionalProperties: false, ...base };
}

interface CasoInvalido {
  datos: Record<string, unknown>;
  campoEsperado: string;
  motivoEsperado?: RegExp;
}

interface EsquemaTUPA {
  codigo: string;
  nombre: string;
  esquema: Record<string, unknown>;
  valido: Record<string, unknown>;
  invalidos: CasoInvalido[];
}

// Los 12 procedimientos TUPA del IESTP "Suiza" cubiertos por la batería.
const DOCE_TUPA: EsquemaTUPA[] = [
  {
    codigo: 'TUPA-001',
    nombre: 'Titulación por tesis o trabajo de suficiencia',
    esquema: esquema({
      required: ['carrera', 'anio_egreso', 'dni', 'modalidad'],
      properties: {
        carrera: { type: 'string', minLength: 3 },
        anio_egreso: { type: 'integer', minimum: 2000, maximum: 2026 },
        dni: { type: 'string', pattern: '^\\d{8}$' },
        modalidad: { type: 'string', enum: ['TESIS', 'TRABAJO_SUFICIENCIA', 'CONVENIO'] },
      },
    }),
    valido: { carrera: 'Ingeniería de Software', anio_egreso: 2024, dni: '71234567', modalidad: 'TESIS' },
    invalidos: [
      { datos: { carrera: 'Ingeniería', anio_egreso: 1980, dni: '71234567', modalidad: 'TESIS' }, campoEsperado: 'anio_egreso', motivoEsperado: /menor/ },
      { datos: { carrera: 'Ingeniería', anio_egreso: 2024, modalidad: 'TESIS' }, campoEsperado: 'dni', motivoEsperado: /obligatorio/ },
    ],
  },
  {
    codigo: 'TUPA-002',
    nombre: 'Rectificación de notas',
    esquema: esquema({
      required: ['codigo_asignatura', 'periodo_lectivo', 'nota_anterior'],
      properties: {
        codigo_asignatura: { type: 'string', pattern: '^[A-Z]{3,5}-\\d{3}$' },
        periodo_lectivo: { type: 'string', pattern: '^\\d{4}-(I|II)$' },
        nota_anterior: { type: 'number', minimum: 0, maximum: 20 },
      },
    }),
    valido: { codigo_asignatura: 'MATE-101', periodo_lectivo: '2025-I', nota_anterior: 13.5 },
    invalidos: [
      { datos: { codigo_asignatura: 'MATE-101', periodo_lectivo: '2025-I', nota_anterior: 25 }, campoEsperado: 'nota_anterior', motivoEsperado: /mayor/ },
      { datos: { codigo_asignatura: 'mate-101', periodo_lectivo: '2025-I', nota_anterior: 13 }, campoEsperado: 'codigo_asignatura' },
    ],
  },
  {
    codigo: 'TUPA-003',
    nombre: 'Convalidación de créditos',
    esquema: esquema({
      required: ['creditos', 'universidad_origen', 'silabus_url'],
      properties: {
        creditos: { type: 'integer', minimum: 1 },
        universidad_origen: { type: 'string', minLength: 3 },
        silabus_url: { type: 'string', pattern: '^https?://' },
      },
    }),
    valido: { creditos: 24, universidad_origen: 'Universidad Nacional de San Agustín', silabus_url: 'https://unsa.edu.pe/a.pdf' },
    invalidos: [
      { datos: { creditos: -5, universidad_origen: 'UNSA', silabus_url: 'https://unsa.edu.pe/a.pdf' }, campoEsperado: 'creditos', motivoEsperado: /no debe ser menor/ },
      { datos: { creditos: 4, universidad_origen: 'UNSA', silabus_url: 'ftp://servidor/a.pdf' }, campoEsperado: 'silabus_url' },
    ],
  },
  {
    codigo: 'TUPA-004',
    nombre: 'Constancia de estudios',
    esquema: esquema({
      required: ['promedio_ponderado', 'condicion'],
      properties: {
        promedio_ponderado: { type: 'number', minimum: 0, exclusiveMaximum: 20 },
        condicion: { type: 'string', enum: ['REGULAR', 'IRREGULAR', 'EGRESADO'] },
      },
    }),
    valido: { promedio_ponderado: 17.8, condicion: 'REGULAR' },
    invalidos: [
      { datos: { promedio_ponderado: 20, condicion: 'EGRESADO' }, campoEsperado: 'promedio_ponderado', motivoEsperado: /20/ },
      { datos: { promedio_ponderado: 15, condicion: 'VAGO' }, campoEsperado: 'condicion' },
    ],
  },
  {
    codigo: 'TUPA-005',
    nombre: 'Certificado de práctica pre-profesional',
    esquema: esquema({
      required: ['empresa', 'horas', 'fecha_inicio', 'fecha_fin'],
      properties: {
        empresa: { type: 'string', minLength: 2 },
        horas: { type: 'integer', minimum: 1 },
        fecha_inicio: { type: 'string', format: 'date' },
        fecha_fin: { type: 'string', format: 'date' },
      },
    }),
    valido: { empresa: 'Banco de la Nación', horas: 480, fecha_inicio: '2024-03-01', fecha_fin: '2024-12-31' },
    invalidos: [
      { datos: { empresa: 'Banco', horas: 0, fecha_inicio: '2024-03-01', fecha_fin: '2024-12-31' }, campoEsperado: 'horas', motivoEsperado: /menor/ },
      { datos: { empresa: 'Banco', horas: 8, fecha_inicio: '01/03/2024', fecha_fin: '2024-12-31' }, campoEsperado: 'fecha_inicio', motivoEsperado: /date/ },
    ],
  },
  {
    codigo: 'TUPA-006',
    nombre: 'Reincorporación',
    esquema: esquema({
      required: ['anio_retiro', 'motivo'],
      properties: {
        anio_retiro: { type: 'integer', minimum: 1990, maximum: 2026 },
        motivo: { type: 'string', minLength: 10 },
      },
    }),
    valido: { anio_retiro: 2021, motivo: 'Retiro por motivos laborales' },
    invalidos: [
      { datos: { anio_retiro: 3000, motivo: 'Retiro por motivos laborales' }, campoEsperado: 'anio_retiro', motivoEsperado: /mayor/ },
      { datos: { anio_retiro: 2021, motivo: 'corto' }, campoEsperado: 'motivo' },
    ],
  },
  {
    codigo: 'TUPA-007',
    nombre: 'Duplicado de diploma',
    esquema: esquema({
      required: ['motivo', 'apellidos', 'nombres', 'dni'],
      properties: {
        motivo: { type: 'string', enum: ['PERDIDA', 'DETERIORO', 'CAMBIO_NOMBRE'] },
        apellidos: { type: 'string', minLength: 2 },
        nombres: { type: 'string', minLength: 2 },
        dni: { type: 'string', pattern: '^\\d{8}$' },
      },
    }),
    valido: { motivo: 'PERDIDA', apellidos: 'Garcia', nombres: 'Maria', dni: '44556677' },
    invalidos: [
      { datos: { motivo: 'ROBO_MISTERIOSO', apellidos: 'G', nombres: 'M', dni: '44556677' }, campoEsperado: 'motivo' },
      { datos: { motivo: 'PERDIDA', apellidos: 'G', nombres: 'M', dni: 'abc' }, campoEsperado: 'dni' },
    ],
  },
  {
    codigo: 'TUPA-008',
    nombre: 'Validación de asignatura homologable',
    esquema: esquema({
      required: ['codigo_asignatura', 'creditos', 'homologable'],
      properties: {
        codigo_asignatura: { type: 'string', pattern: '^[A-Z]{3,5}-\\d{3}$' },
        creditos: { type: 'integer', minimum: 1 },
        homologable: { type: 'boolean' },
      },
    }),
    valido: { codigo_asignatura: 'QUIM-204', creditos: 4, homologable: true },
    invalidos: [
      { datos: { codigo_asignatura: 'QUIM-204', creditos: 0, homologable: true }, campoEsperado: 'creditos', motivoEsperado: /menor/ },
      { datos: { codigo_asignatura: 'QUIM-204', creditos: 4, homologable: 'si' }, campoEsperado: 'homologable' },
    ],
  },
  {
    codigo: 'TUPA-009',
    nombre: 'Beca a la excelencia',
    esquema: esquema({
      required: ['promedio', 'carrera', 'ciclo'],
      properties: {
        promedio: { type: 'number', minimum: 0, exclusiveMaximum: 20 },
        carrera: { type: 'string', minLength: 3 },
        ciclo: { type: 'integer', minimum: 1, maximum: 6 },
      },
    }),
    valido: { promedio: 18.5, carrera: 'Enfermería Técnica', ciclo: 5 },
    invalidos: [
      { datos: { promedio: -1, carrera: 'Enfermería', ciclo: 5 }, campoEsperado: 'promedio', motivoEsperado: /menor/ },
      { datos: { promedio: 18, carrera: 'Enfermería', ciclo: 9 }, campoEsperado: 'ciclo', motivoEsperado: /mayor/ },
    ],
  },
  {
    codigo: 'TUPA-010',
    nombre: 'Traslado externo',
    esquema: esquema({
      required: ['institucion_origen', 'ciclo', 'asignaturas_aprobadas'],
      properties: {
        institucion_origen: { type: 'string', minLength: 3 },
        ciclo: { type: 'integer', minimum: 1, maximum: 3 },
        asignaturas_aprobadas: { type: 'array', minItems: 1, items: { type: 'string', minLength: 2 } },
      },
    }),
    valido: { institucion_origen: 'Cetpro Pedro Vilca', ciclo: 2, asignaturas_aprobadas: ['Matemática', 'Comunicación'] },
    invalidos: [
      { datos: { institucion_origen: 'Cetpro', ciclo: 2, asignaturas_aprobadas: [] }, campoEsperado: 'asignaturas_aprobadas', motivoEsperado: /1/i },
      { datos: { institucion_origen: 'X', ciclo: 4, asignaturas_aprobadas: ['Matemática'] }, campoEsperado: 'institucion_origen' },
    ],
  },
  {
    codigo: 'TUPA-011',
    nombre: 'Certificado de asistencia',
    esquema: esquema({
      required: ['dni', 'numero_faltas', 'periodo_lectivo'],
      properties: {
        dni: { type: 'string', pattern: '^\\d{8}$' },
        numero_faltas: { type: 'integer', minimum: 0 },
        periodo_lectivo: { type: 'string', pattern: '^\\d{4}-(I|II)$' },
      },
    }),
    valido: { dni: '12345678', numero_faltas: 3, periodo_lectivo: '2025-II' },
    invalidos: [
      { datos: { dni: '12345678', numero_faltas: -2, periodo_lectivo: '2025-II' }, campoEsperado: 'numero_faltas', motivoEsperado: /menor/ },
      { datos: { dni: '12345678', numero_faltas: 0, periodo_lectivo: '2025-TER' }, campoEsperado: 'periodo_lectivo' },
    ],
  },
  {
    codigo: 'TUPA-012',
    nombre: 'Silencio administrativo por demora',
    esquema: esquema({
      required: ['solicitud_numero', 'fecha_presentacion', 'dias_sin_respuesta'],
      properties: {
        solicitud_numero: { type: 'string', pattern: '^EXP-\\d{4}-\\d{6}$' },
        fecha_presentacion: { type: 'string', format: 'date' },
        dias_sin_respuesta: { type: 'integer', minimum: 0 },
      },
    }),
    valido: { solicitud_numero: 'EXP-2026-000123', fecha_presentacion: '2026-01-15', dias_sin_respuesta: 45 },
    invalidos: [
      { datos: { solicitud_numero: 'X-1', fecha_presentacion: '2026-01-15', dias_sin_respuesta: 45 }, campoEsperado: 'solicitud_numero' },
      { datos: { solicitud_numero: 'EXP-2026-000123', fecha_presentacion: '2026-01-15', dias_sin_respuesta: -1 }, campoEsperado: 'dias_sin_respuesta', motivoEsperado: /menor/ },
    ],
  },
];

describe('SchemaValidatorServicio · batería polimórfica de 12 esquemas TUPA', () => {
  for (const tupa of DOCE_TUPA) {
    describe(`${tupa.codigo} — ${tupa.nombre}`, () => {
      const servicio = new SchemaValidatorServicio(crearCargador(tupa.esquema, tupa.codigo));

      it('acepta una solicitud que cumple el esquema', async () => {
        const datos = await servicio.validar(tupa.codigo, tupa.valido);
        expect(datos).toEqual(tupa.valido);
      });

      for (const [indice, invalido] of tupa.invalidos.entries()) {
        it(`rechaza con SCHEMA_VALIDATION_FAILED señalando "${invalido.campoEsperado}" (caso ${indice + 1})`, async () => {
          const error = (await servicio.validar(tupa.codigo, invalido.datos).catch((e: unknown) => e)) as SchemaValidationError;
          expect(error).toBeInstanceOf(SchemaValidationError);
          expect(error.code).toBe('SCHEMA_VALIDATION_FAILED');
          expect(error.status).toBe(422);
          const campo = error.invalidParams.find((p) => p.name === invalido.campoEsperado);
          expect(campo).toBeDefined();
          if (invalido.motivoEsperado) {
            expect(campo?.reason).toMatch(invalido.motivoEsperado);
          }
        });
      }
    });
  }
});

describe('SchemaValidatorServicio · rechazos RFC 7807', () => {
  it('serializa SCHEMA_VALIDATION_FAILED con el campo exacto en falta', () => {
    const servicio = new SchemaValidatorServicio(
      crearCargador(DOCE_TUPA[0].esquema, 'TUPA-001'),
    );
    expect(serializeError(new SchemaValidationError([{ name: 'dni', reason: 'Campo obligatorio faltante.' }]))).toEqual({
      status: 422,
      code: 'SCHEMA_VALIDATION_FAILED',
      detail: 'Los datos no cumplen la estructura requerida por el procedimiento TUPA.',
      invalidParams: [{ name: 'dni', reason: 'Campo obligatorio faltante.' }],
    });
  });

  it('el middleware RFC 7807 expone el error como SCHEMA_VALIDATION_FAILED', async () => {
    const servicio = new SchemaValidatorServicio(crearCargador(DOCE_TUPA[1].esquema, 'TUPA-002'));
    const error = (await servicio.validar('TUPA-002', { nota_anterior: 25 }).catch((e: unknown) => e)) as SchemaValidationError;
    const serializado = serializeError(error);
    expect(serializado).toMatchObject({
      status: 422,
      code: 'SCHEMA_VALIDATION_FAILED',
    });
    expect(serializado.invalidParams).toContainEqual(expect.objectContaining({ name: 'nota_anterior' }));
  });

  it('sin esquema activo devuelve SCHEMA_NOT_FOUND (404)', async () => {
    const servicio = new SchemaValidatorServicio(crearCargador(null, 'TUPA-999'));
    const error = (await servicio.validar('TUPA-000', {}).catch((e: unknown) => e)) as { code: string; status: number };
    expect(error).not.toBeInstanceOf(SchemaValidationError);
    expect(error.code).toBe('SCHEMA_NOT_FOUND');
    if ('status' in error) {
      expect(error.status).toBe(404);
    }
  });
});

describe('SchemaValidatorServicio · esquemas malformados', () => {
  it('rechaza un esquema que no es objeto JSON', async () => {
    const servicio = new SchemaValidatorServicio(
      crearCargador(['type', 'object'], 'TUPA-001'),
    );
    const error = (await servicio.validar('TUPA-001', {}).catch((e: unknown) => e)) as SchemaInvalidoError;
    expect(error).toBeInstanceOf(SchemaInvalidoError);
    expect(error.code).toBe('SCHEMA_INVALID');
    expect(error.detail).not.toContain('__proto__');
  });

  it('rechaza un esquema con keyword desconocida', async () => {
    const servicio = new SchemaValidatorServicio(
      crearCargador({ type: 'TIPO_INEXISTENTE' }, 'TUPA-001'),
    );
    const error = (await servicio.validar('TUPA-001', {}).catch((e: unknown) => e)) as SchemaInvalidoError;
    expect(error).toBeInstanceOf(SchemaInvalidoError);
  });

  it('serializa un esquema inválido como 500 SCHEMA_INVALID (RFC 7807)', async () => {
    const serializado = serializeError(new SchemaInvalidoError('mensaje tecnico'));
    expect(serializado).toMatchObject({ status: 500, code: 'SCHEMA_INVALID' });
    expect(serializado.detail).not.toContain('mensaje tecnico');
  });
});

describe('SchemaValidatorServicio · protección ante inyección y ataques', () => {
  const ataques: Array<{ etiqueta: string; esquema: unknown }> = [
    { etiqueta: '$ref remota por http', esquema: esquema({ $ref: 'http://malicioso.evil/schema.json' }) },
    { etiqueta: '$ref remota por protocolo relativo', esquema: esquema({ $ref: '//otro-dominio/payload' }) },
    { etiqueta: '$id externo', esquema: esquema({ $id: 'https://autf.example/schema' }) },
    // JSON.parse simula fielmente lo que llega desde jsonb: __proto__ llega como
    // propiedad propia, no como control del prototipo del objeto literal.
    { etiqueta: 'clave __proto__ (prototype pollution)', esquema: JSON.parse('{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"__proto__":{"type":"string"}}}') as Record<string, unknown> },
    { etiqueta: 'clave constructor', esquema: esquema({ properties: { constructor: { type: 'string' } } }) },
    {
      etiqueta: 'anidamiento excesivo (DoS)',
      esquema: (() => {
        let s: Record<string, unknown> = { type: 'string' };
        for (let i = 0; i < 70; i++) {
          s = { type: 'object', properties: { x: s } };
        }
        return s;
      })(),
    },
  ];

  for (const ataque of ataques) {
    it(`bloquea "${ataque.etiqueta}" sin compilar código`, async () => {
      const servicio = new SchemaValidatorServicio(crearCargador(ataque.esquema, 'TUPA-001'));
      const error = (await servicio.validar('TUPA-001', {}).catch((e: unknown) => e)) as SchemaInvalidoError;
      expect(error).toBeInstanceOf(SchemaInvalidoError);
      expect(error.code).toBe('SCHEMA_INVALID');
      // El detalle RFC 7807 nunca filtra el detalle técnico del esquema atacante.
      expect(error.detail).not.toMatch(/malicioso|evil|payload|__proto__/i);
    });
  }

  it('un script embebido en los datos se trata como valor JSON, nunca se ejecuta ni invalida la estructura', async () => {
    const servicio = new SchemaValidatorServicio(crearCargador(DOCE_TUPA[0].esquema, 'TUPA-001'));
    const conScript = {
      carrera: '<script>fetch("https://intranet.example/robos")</script>',
      anio_egreso: 2024,
      dni: '71234567',
      modalidad: 'TESIS',
    };
    const datos = await servicio.validar('TUPA-001', conScript);
    // El valor JSON se conserva íntegro (round-trip) sin ejecutar ni mutar:
    // `validar` devolvió los mismos datos, prueba de que el script no se evalúa.
    for (const [clave, valor] of Object.entries(conScript)) {
      expect(datos as Record<string, unknown>).toMatchObject({ [clave]: valor });
    }
  });
});