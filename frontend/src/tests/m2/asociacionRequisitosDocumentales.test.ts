import { describe, expect, it } from 'vitest';
import type { DocumentacionTramite } from '../../types/documentacionTramite';
import type { ArchivoTramite } from '../../types/tramiteWizardState';
import {
  autoAsociarArchivosRequisitos,
  evaluarRequisitosTramite,
  validarAdjuntosRequisitos,
  verificarIntegridadArchivo,
} from '../../services/documentacionTramiteService';

const DETALLE_SUZ26_034_MOCK: DocumentacionTramite = {
  id: '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd',
  codigo: 'SUZ26-035',
  codigoVisible: 'SUZ26-034',
  numeroVisible: '034',
  denominacion: 'Certificado de Estudios Superiores (6 semestres)',
  condicionFinanciera: 'SUJETO_PAGO',
  tarifa: {
    id: 'a34b6891-a98b-489e-883d-a4d5ca9fb863',
    importe: '124.00',
    moneda: 'PEN',
    concepto: 'Certificado de Estudios Superiores (6 semestres)',
  },
  estadoValidacion: 'VALIDADO',
  sinAnexosEspecificos: true,
  observacionInstitucional:
    'Procedimiento institucional SUZ26-034 conforme al TUPA 2026 (Página 4). Certificado de Estudios Superiores (6 semestres), derecho de tramitación S/ 124.00, calificación por Secretaría Académica y suscripción digital por Dirección General.',
  unidadRecepcion: 'Mesa de Partes (MP)',
  unidadResponsable: 'Secretaría Académica (SEC)',
  autoridadResolutiva: 'Dirección General (DG)',
  plazoDias: 30,
  silencioAdministrativo: 'NEGATIVO',
  versionTupa: 'TUPA-2026-V1',
  requisitos: [
    {
      id: '7fc207f0-cfa3-4c34-b364-27a98db3fce3',
      codigo: 'FUT',
      nombre:
        'Solicitud Formal Única de Trámite (FUT) por estudios superiores culminados (6 semestres) en el IESTP Suiza',
      obligatorio: true,
      clasificacion: 'EXPEDIENTE',
      tipos: [
        {
          id: 'dc156983-a824-418a-835e-5a7e104c9ca5',
          codigo: 'FUT',
          nombre: 'FUT',
          condicion: null,
        },
      ],
    },
  ],
  anexos: [],
  nota: 'Nota institucional SUZ26-034',
};

describe('Asociación canónica y validación de requisitos documentales (SUZ26-034)', () => {
  const hashValido = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const storageValido = 'expedientes/2026/3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd.pdf';

  it('Prueba positiva: reconoce y asocia automáticamente el FUT adjunto como EXPEDIENTE', () => {
    const archivoFut: ArchivoTramite = {
      nombre: 'Formato Único de Trámite (FUT) - IESTP Suiza.pdf',
      peso: 154200,
      hashSha256: hashValido,
      storageUrl: storageValido,
      clasificacion: 'EXPEDIENTE',
      // requisitoId viene inicialmente undefined desde la carga general
      requisitoId: undefined,
      paginas: 2,
    };

    const asociados = autoAsociarArchivosRequisitos(DETALLE_SUZ26_034_MOCK, [archivoFut]);

    expect(asociados).toHaveLength(1);
    expect(asociados[0].requisitoId).toBe('7fc207f0-cfa3-4c34-b364-27a98db3fce3');
    expect(asociados[0].clasificacion).toBe('EXPEDIENTE');
    expect(asociados[0].tipoDocumentalId).toBe('dc156983-a824-418a-835e-5a7e104c9ca5');
    expect(asociados[0].tipoDocumentalCodigo).toBe('FUT');

    const evaluaciones = evaluarRequisitosTramite(DETALLE_SUZ26_034_MOCK, asociados);
    expect(evaluaciones).toHaveLength(1);
    expect(evaluaciones[0].estado).toBe('PRESENTADO');
    expect(evaluaciones[0].archivoAsociado?.nombre).toBe('Formato Único de Trámite (FUT) - IESTP Suiza.pdf');

    const errorValidacion = validarAdjuntosRequisitos(DETALLE_SUZ26_034_MOCK, [archivoFut]);
    expect(errorValidacion).toBeNull();
  });

  it('Reconciliación: mapea IDs legacy/estáticos de borrador (REQ-SUZ26-035-FUT) al UUID oficial', () => {
    const archivoLegacy: ArchivoTramite = {
      nombre: 'FUT_Firmado.pdf',
      peso: 98000,
      hashSha256: hashValido,
      storageUrl: storageValido,
      clasificacion: 'EXPEDIENTE',
      requisitoId: 'REQ-SUZ26-035-FUT',
      paginas: 1,
    };

    const asociados = autoAsociarArchivosRequisitos(DETALLE_SUZ26_034_MOCK, [archivoLegacy]);
    expect(asociados[0].requisitoId).toBe('7fc207f0-cfa3-4c34-b364-27a98db3fce3');

    const errorValidacion = validarAdjuntosRequisitos(DETALLE_SUZ26_034_MOCK, [archivoLegacy]);
    expect(errorValidacion).toBeNull();
  });

  it('Prueba negativa: un archivo que no corresponde al FUT (ANEXO libre) no acredita el requisito obligatorio', () => {
    const archivoAnexoLibre: ArchivoTramite = {
      nombre: 'documento_auxiliar.pdf',
      peso: 85000,
      hashSha256: hashValido,
      storageUrl: storageValido,
      clasificacion: 'ANEXO',
      requisitoId: undefined,
      paginas: 1,
    };

    const asociados = autoAsociarArchivosRequisitos(DETALLE_SUZ26_034_MOCK, [archivoAnexoLibre]);
    // El procedimiento SUZ26-034 no tiene anexos configurados, no se autoasocia al FUT
    expect(asociados[0].requisitoId).toBeUndefined();

    const evaluaciones = evaluarRequisitosTramite(DETALLE_SUZ26_034_MOCK, asociados);
    expect(evaluaciones[0].id).toBe('7fc207f0-cfa3-4c34-b364-27a98db3fce3');
    expect(evaluaciones[0].estado).toBe('PENDIENTE');

    const errorValidacion = validarAdjuntosRequisitos(DETALLE_SUZ26_034_MOCK, [archivoAnexoLibre]);
    expect(errorValidacion).not.toBeNull();
    // Exige al menos un PDF clasificado como EXPEDIENTE
    expect(errorValidacion).toContain('EXPEDIENTE');
  });

  it('Prueba negativa: archivo EXPEDIENTE sin asociar a requisito cuando faltan obligatorios', () => {
    // Si el usuario explícitamente desasocia el archivo (requisitoId: undefined y nombre no-FUT)
    const archivoDesasociado: ArchivoTramite = {
      nombre: 'archivo_sin_relacion.pdf',
      peso: 50000,
      hashSha256: hashValido,
      storageUrl: storageValido,
      clasificacion: 'EXPEDIENTE',
      requisitoId: undefined,
      paginas: 1,
    };

    // Al evaluar directamente requisitos sin autoasociar:
    const evaluaciones = evaluarRequisitosTramite(DETALLE_SUZ26_034_MOCK, [archivoDesasociado]);
    expect(evaluaciones[0].estado).toBe('PENDIENTE');
  });

  it('Prueba negativa de integridad: detecta archivos con metadatos o almacenamiento corruptos y los marca como OBSERVADO', () => {
    const archivoInvalido: ArchivoTramite = {
      nombre: 'FUT.pdf',
      peso: 0, // Invalido: peso cero
      hashSha256: 'hash_invalido',
      storageUrl: 'storage_invalido.txt',
      clasificacion: 'EXPEDIENTE',
      requisitoId: '7fc207f0-cfa3-4c34-b364-27a98db3fce3',
      paginas: 1,
    };

    const integridad = verificarIntegridadArchivo(archivoInvalido);
    expect(integridad.valido).toBe(false);

    const evaluaciones = evaluarRequisitosTramite(DETALLE_SUZ26_034_MOCK, [archivoInvalido]);
    expect(evaluaciones[0].estado).toBe('OBSERVADO');

    const error = validarAdjuntosRequisitos(DETALLE_SUZ26_034_MOCK, [archivoInvalido]);
    expect(error).toContain('Documento observado');
  });

  it('Asociación 1 a 1: no duplica el cumplimiento ni asigna dos archivos al mismo requisito', () => {
    const archivo1: ArchivoTramite = {
      nombre: 'FUT_Principal.pdf',
      peso: 100000,
      hashSha256: hashValido,
      storageUrl: 'expedientes/2026/00000000-0000-0000-0000-000000000001.pdf',
      clasificacion: 'EXPEDIENTE',
      requisitoId: undefined,
      paginas: 1,
    };
    const archivo2: ArchivoTramite = {
      nombre: 'FUT_Segunda_Copia.pdf',
      peso: 100000,
      hashSha256: 'f'.repeat(64),
      storageUrl: 'expedientes/2026/00000000-0000-0000-0000-000000000002.pdf',
      clasificacion: 'EXPEDIENTE',
      requisitoId: undefined,
      paginas: 1,
    };

    const asociados = autoAsociarArchivosRequisitos(DETALLE_SUZ26_034_MOCK, [archivo1, archivo2]);
    // El primer archivo satisface el requisito
    expect(asociados[0].requisitoId).toBe('7fc207f0-cfa3-4c34-b364-27a98db3fce3');
    // El segundo archivo no puede tomar el mismo requisito (no se contabiliza doble)
    expect(asociados[1].requisitoId).toBeUndefined();
  });
});

const DETALLE_SUZ26_006_MOCK: DocumentacionTramite = {
  id: '34b76005-d658-4e2b-a3c7-d2b7aec7dae5',
  codigo: 'SUZ26-006',
  codigoVisible: 'SUZ26-006',
  numeroVisible: '006',
  denominacion: 'Certificado de Inglés',
  condicionFinanciera: 'SUJETO_PAGO',
  tarifa: {
    id: 'fb58b189-b76f-4589-b0d8-a9e2cecac82c',
    importe: '100.00',
    moneda: 'PEN',
    concepto: 'Certificado de Inglés',
  },
  estadoValidacion: 'VALIDADO',
  sinAnexosEspecificos: true,
  observacionInstitucional: 'Opción A — Emisión de certificado por estudios de inglés culminados y aprobados en el propio IESTP Suiza.',
  unidadRecepcion: 'Mesa de Partes (MP)',
  unidadResponsable: 'Secretaría Académica (SEC)',
  autoridadResolutiva: 'Dirección General (DG)',
  plazoDias: 5,
  silencioAdministrativo: 'POSITIVO',
  versionTupa: 'TUPA-2026-V1',
  requisitos: [
    {
      id: '980445dd-44a5-4871-9ceb-deb6d90da303',
      codigo: 'FUT',
      nombre: 'Solicitud Formal Única de Trámite (FUT) por estudios de inglés culminados y aprobados en el IESTP Suiza',
      obligatorio: true,
      clasificacion: 'EXPEDIENTE',
      tipos: [
        {
          id: 'dc156983-a824-418a-835e-5a7e104c9ca5',
          codigo: 'FUT',
          nombre: 'FUT',
          condicion: null,
        },
      ],
    },
  ],
  anexos: [],
  nota: 'Nota institucional SUZ26-006',
};

describe('No regresión: Procedimiento SUZ26-006 (Certificado de Inglés)', () => {
  const hashValido = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const storageValido = 'expedientes/2026/34b76005-d658-4e2b-a3c7-d2b7aec7dae5.pdf';

  it('asocia correctamente el FUT al requisito canónico de SUZ26-006', () => {
    const archivoFut: ArchivoTramite = {
      nombre: 'Formato Único de Trámite (FUT) - Certificado Inglés.pdf',
      peso: 120000,
      hashSha256: hashValido,
      storageUrl: storageValido,
      clasificacion: 'EXPEDIENTE',
      requisitoId: undefined,
      paginas: 1,
    };

    const asociados = autoAsociarArchivosRequisitos(DETALLE_SUZ26_006_MOCK, [archivoFut]);
    expect(asociados[0].requisitoId).toBe('980445dd-44a5-4871-9ceb-deb6d90da303');
    expect(asociados[0].tipoDocumentalCodigo).toBe('FUT');

    const evaluacion = evaluarRequisitosTramite(DETALLE_SUZ26_006_MOCK, asociados);
    expect(evaluacion[0].estado).toBe('PRESENTADO');

    const error = validarAdjuntosRequisitos(DETALLE_SUZ26_006_MOCK, [archivoFut]);
    expect(error).toBeNull();
  });

  it('no permite que un documento ajeno o clasificado como ANEXO cumpla el FUT de SUZ26-006', () => {
    const archivoAnexo: ArchivoTramite = {
      nombre: 'boleta_notas_antigua.pdf',
      peso: 90000,
      hashSha256: hashValido,
      storageUrl: storageValido,
      clasificacion: 'ANEXO',
      requisitoId: undefined,
      paginas: 1,
    };

    const asociados = autoAsociarArchivosRequisitos(DETALLE_SUZ26_006_MOCK, [archivoAnexo]);
    expect(asociados[0].requisitoId).toBeUndefined();

    const evaluacion = evaluarRequisitosTramite(DETALLE_SUZ26_006_MOCK, asociados);
    expect(evaluacion[0].estado).toBe('PENDIENTE');

    const error = validarAdjuntosRequisitos(DETALLE_SUZ26_006_MOCK, [archivoAnexo]);
    expect(error).toContain('EXPEDIENTE');
  });
});

