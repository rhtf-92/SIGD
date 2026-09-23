import type { EstadoFlujoExpediente, ExpedienteSGD, VersionDocumento } from "../types/expediente";
import type { BitacoraEventoExpediente, TipoEventoBitacora } from "../types/trazabilidadExpediente";
import { etiquetaExpediente } from "../utils/expedientePresentacion";

/**
 * Fixtures locales usadas cuando VITE_ENABLE_MOCKS=true (modo Stubs / Desarrollo Aislado),
 * conforme a la estrategia de desacoplamiento definida en
 * frontend/docs/00_ARQUITECTURA_ORDEN_IMPLEMENTACION_PARALELO.md (sección 5).
 *
 * Permiten desarrollar y demostrar la Bandeja y el Timeline sin depender de que el
 * backend (`sigd_tra` / TramiCore) esté desplegado.
 */
const expedientesBase: ExpedienteSGD[] = [
  {
    id: "8f1c9b2e-0001-4a11-9c1a-000000000001",
    codigoExpediente: "EXP-2026-000104",
    asunto: "Solicitud de Certificado Oficial de Estudios",
    solicitante: {
      tipoPersona: "NATURAL",
      tipoDocumento: "DNI",
      numeroDocumento: "47891234",
      nombreOrazonSocial: "Juan Pérez Ríos",
      correoNotificacion: "juan.perez@example.com",
      telefonoContacto: "961234567",
    },
    clasificacionCCD: {
      fondo: "IESTP_SUIZA",
      seccion: "SECRETARIA_ACADEMICA",
      serieDocumental: "MATRICULA_Y_ACTAS",
      subserieDocumental: "Certificados de Estudios",
      codigoSerie: "CCD-SA-MAT",
      codigoSubserie: "CCD-SA-MAT-CE",
    },
    metadatos: {
      tipoDocumentoPrincipal: "SOLICITUD",
      palabrasClave: ["certificado", "estudios"],
      canalIngreso: "MESA_DE_PARTES_VIRTUAL",
      creadorId: "u-001",
      creadorNombre: "Juan Pérez Ríos",
      responsableAsignadoId: "u-100",
      responsableAsignadoNombre: "Isack Vargas",
    },
    areaOrigen: "MESA_DE_PARTES",
    areaActual: "SECRETARIA_ACADEMICA",
    estadoFlujo: "PENDIENTE",
    prioridad: "NORMAL",
    fechaIngreso: "2026-09-05T09:12:00-05:00",
    fechaUltimoMovimiento: "2026-09-05T10:06:00-05:00",
    fechaLimiteAtencion: "2026-10-17T16:30:00-05:00",
    versionesDocumentos: [],
    cantidadFolios: 3,
  },
  {
    id: "8f1c9b2e-0002-4a11-9c1a-000000000002",
    codigoExpediente: "EXP-2026-000089",
    asunto: "Proyecto de Resolución de Prácticas Pre-Profesionales",
    solicitante: {
      tipoPersona: "NATURAL",
      tipoDocumento: "DNI",
      numeroDocumento: "74125896",
      nombreOrazonSocial: "Ana Ramos Tello",
      correoNotificacion: "ana.ramos@example.com",
      telefonoContacto: "967894561",
    },
    clasificacionCCD: {
      fondo: "IESTP_SUIZA",
      seccion: "UNIDAD_ACADEMICA",
      serieDocumental: "PRACTICAS_PREPROFESIONALES",
      subserieDocumental: "Informes de Prácticas",
      codigoSerie: "CCD-UA-PPP",
      codigoSubserie: "CCD-UA-PPP-INF",
    },
    metadatos: {
      tipoDocumentoPrincipal: "INFORME",
      palabrasClave: ["prácticas pre-profesionales"],
      canalIngreso: "VENTANILLA_PRESENCIAL",
      creadorId: "u-002",
      creadorNombre: "Ana Ramos Tello",
      responsableAsignadoId: "u-100",
      responsableAsignadoNombre: "Isack Vargas",
    },
    areaOrigen: "UNIDAD_ACADEMICA",
    areaActual: "UNIDAD_ACADEMICA",
    estadoFlujo: "EN_PROCESO",
    prioridad: "URGENTE",
    fechaIngreso: "2026-09-02T08:30:00-05:00",
    fechaUltimoMovimiento: "2026-09-08T14:00:00-05:00",
    fechaLimiteAtencion: "2026-09-11T16:30:00-05:00",
    versionesDocumentos: [
      {
        versionId: "v1.0",
        numeroVersion: 1,
        estado: "VIGENTE",
        nombreArchivo: "informe_practicas_v1.pdf",
        urlArchivo: "https://storage.local/expedientes/EXP-2026-000089/v1.0.pdf",
        autorCambioId: "u-100",
        autorCambioNombre: "Isack Vargas",
        fechaRegistro: "2026-09-08T14:00:00-05:00",
        motivoModificacion: "Versión inicial del informe técnico.",
        hashIntegridad:
          "b7e23ec29af22b0b4e41da31e868d57226121c84d1a5fddaad3e5b28e93bee6",
      },
    ],
    cantidadFolios: 12,
  },
  {
    id: "8f1c9b2e-0003-4a11-9c1a-000000000003",
    codigoExpediente: "EXP-2026-000041",
    asunto: "Informe Técnico de Convalidación de Cursos",
    solicitante: {
      tipoPersona: "NATURAL",
      tipoDocumento: "DNI",
      numeroDocumento: "45123687",
      nombreOrazonSocial: "Carlos Ruiz Panduro",
      correoNotificacion: "carlos.ruiz@example.com",
      telefonoContacto: "965321478",
    },
    clasificacionCCD: {
      fondo: "IESTP_SUIZA",
      seccion: "SECRETARIA_ACADEMICA",
      serieDocumental: "CONVALIDACIONES",
      subserieDocumental: "Informes Técnicos de Convalidación",
      codigoSerie: "CCD-SA-CON",
      codigoSubserie: "CCD-SA-CON-INF",
    },
    metadatos: {
      tipoDocumentoPrincipal: "INFORME",
      palabrasClave: ["convalidación"],
      canalIngreso: "VENTANILLA_PRESENCIAL",
      creadorId: "u-003",
      creadorNombre: "Carlos Ruiz Panduro",
      responsableAsignadoId: "u-101",
      responsableAsignadoNombre: "Willfredo Soria",
    },
    areaOrigen: "SECRETARIA_ACADEMICA",
    areaActual: "DIRECCION_GENERAL",
    estadoFlujo: "OBSERVADO",
    prioridad: "MUY_URGENTE",
    fechaIngreso: "2026-08-20T10:00:00-05:00",
    fechaUltimoMovimiento: "2026-09-07T11:20:00-05:00",
    fechaLimiteAtencion: "2026-09-09T16:30:00-05:00",
    versionesDocumentos: [],
    cantidadFolios: 8,
  },
  {
    id: "8f1c9b2e-0004-4a11-9c1a-000000000004",
    codigoExpediente: "EXP-2026-000132",
    asunto: "Derivación de Expediente de Titulación a Dirección General",
    solicitante: {
      tipoPersona: "NATURAL",
      tipoDocumento: "DNI",
      numeroDocumento: "70112233",
      nombreOrazonSocial: "María Torres Vela",
      correoNotificacion: "maria.torres@example.com",
      telefonoContacto: "969112233",
    },
    clasificacionCCD: {
      fondo: "IESTP_SUIZA",
      seccion: "SECRETARIA_ACADEMICA",
      serieDocumental: "TITULACION_PROFESIONAL",
      subserieDocumental: "Expedientes de Titulación",
      codigoSerie: "CCD-SA-TIT",
      codigoSubserie: "CCD-SA-TIT-EXP",
    },
    metadatos: {
      tipoDocumentoPrincipal: "RESOLUCION_DIRECTORAL",
      palabrasClave: ["titulación"],
      canalIngreso: "VENTANILLA_PRESENCIAL",
      creadorId: "u-004",
      creadorNombre: "María Torres Vela",
      responsableAsignadoId: "u-100",
      responsableAsignadoNombre: "Isack Vargas",
    },
    areaOrigen: "SECRETARIA_ACADEMICA",
    areaActual: "DIRECCION_GENERAL",
    estadoFlujo: "DERIVADO",
    prioridad: "NORMAL",
    fechaIngreso: "2026-08-28T09:00:00-05:00",
    fechaUltimoMovimiento: "2026-09-06T16:00:00-05:00",
    fechaLimiteAtencion: "2026-09-25T16:30:00-05:00",
    versionesDocumentos: [],
    cantidadFolios: 15,
  },
  {
    id: "8f1c9b2e-0005-4a11-9c1a-000000000005",
    codigoExpediente: "EXP-2026-000075",
    asunto: "Notificación de Resolución de Reconocimiento de Créditos",
    solicitante: {
      tipoPersona: "NATURAL",
      tipoDocumento: "DNI",
      numeroDocumento: "72233445",
      nombreOrazonSocial: "Luis Sánchez Reátegui",
      correoNotificacion: "luis.sanchez@example.com",
      telefonoContacto: "962233445",
    },
    clasificacionCCD: {
      fondo: "IESTP_SUIZA",
      seccion: "SECRETARIA_ACADEMICA",
      serieDocumental: "MATRICULA_Y_ACTAS",
      codigoSerie: "CCD-SA-MAT",
    },
    metadatos: {
      tipoDocumentoPrincipal: "RESOLUCION_DIRECTORAL",
      palabrasClave: ["reconocimiento de créditos"],
      canalIngreso: "MESA_DE_PARTES_VIRTUAL",
      creadorId: "u-005",
      creadorNombre: "Luis Sánchez Reátegui",
      responsableAsignadoId: "u-100",
      responsableAsignadoNombre: "Isack Vargas",
    },
    areaOrigen: "SECRETARIA_ACADEMICA",
    areaActual: "SECRETARIA_ACADEMICA",
    estadoFlujo: "NOTIFICADO",
    prioridad: "NORMAL",
    fechaIngreso: "2026-08-15T09:00:00-05:00",
    fechaUltimoMovimiento: "2026-09-04T10:00:00-05:00",
    fechaLimiteAtencion: "2026-09-16T16:30:00-05:00",
    versionesDocumentos: [],
    cantidadFolios: 6,
  },
  {
    id: "8f1c9b2e-0006-4a11-9c1a-000000000006",
    codigoExpediente: "EXP-2026-000010",
    asunto: "Expediente de Matrícula 2026-II Archivado",
    solicitante: {
      tipoPersona: "NATURAL",
      tipoDocumento: "DNI",
      numeroDocumento: "71223344",
      nombreOrazonSocial: "Rosa Flores Nunta",
      correoNotificacion: "rosa.flores@example.com",
      telefonoContacto: "968223344",
    },
    clasificacionCCD: {
      fondo: "IESTP_SUIZA",
      seccion: "SECRETARIA_ACADEMICA",
      serieDocumental: "MATRICULA_Y_ACTAS",
      codigoSerie: "CCD-SA-MAT",
    },
    metadatos: {
      tipoDocumentoPrincipal: "SOLICITUD",
      palabrasClave: ["matrícula"],
      canalIngreso: "MESA_DE_PARTES_VIRTUAL",
      creadorId: "u-006",
      creadorNombre: "Rosa Flores Nunta",
      responsableAsignadoId: "u-100",
      responsableAsignadoNombre: "Isack Vargas",
    },
    areaOrigen: "MESA_DE_PARTES",
    areaActual: "ARCHIVO_CENTRAL",
    estadoFlujo: "ARCHIVADO",
    prioridad: "NORMAL",
    fechaIngreso: "2026-08-01T08:00:00-05:00",
    fechaUltimoMovimiento: "2026-08-20T09:00:00-05:00",
    fechaLimiteAtencion: "2026-09-12T16:30:00-05:00",
    versionesDocumentos: [],
    cantidadFolios: 4,
  },
];

/** Identificadores de integridad demo; no representan hashes calculados de documentos reales. */
function hashDemo(expedienteId: string, version: number): string {
  return expedienteId.replaceAll("-", "") + version.toString(16).padStart(32, "0");
}

function crearVersionesDemo(expediente: ExpedienteSGD): VersionDocumento[] {
  return [
    {
      versionId: "v1.0", numeroVersion: 1, estado: "HISTORICA",
      nombreArchivo: `${expediente.codigoExpediente}_solicitud.pdf`, urlArchivo: "",
      autorCambioId: expediente.metadatos.creadorId,
      autorCambioNombre: expediente.metadatos.creadorNombre,
      fechaRegistro: expediente.fechaIngreso,
      motivoModificacion: "Registro inicial de la documentación presentada.",
      hashIntegridad: hashDemo(expediente.id, 1),
    },
    {
      versionId: "v1.1", numeroVersion: 2, estado: "VIGENTE",
      nombreArchivo: `${expediente.codigoExpediente}_documentacion.pdf`, urlArchivo: "",
      autorCambioId: expediente.metadatos.responsableAsignadoId ?? expediente.metadatos.creadorId,
      autorCambioNombre: expediente.metadatos.responsableAsignadoNombre ?? expediente.metadatos.creadorNombre,
      fechaRegistro: expediente.fechaUltimoMovimiento,
      motivoModificacion: "Incorporación de la clasificación documental y revisión de metadatos.",
      hashIntegridad: hashDemo(expediente.id, 2),
    },
  ];
}

export const EXPEDIENTES_FIXTURE: ExpedienteSGD[] = expedientesBase.map((expediente) => ({
  ...expediente,
  clasificacionCCD: {
    ...expediente.clasificacionCCD,
    ...(expediente.estadoFlujo === "NOTIFICADO" ? {
      subserieDocumental: "Reconocimiento de Créditos", codigoSubserie: "CCD-SA-MAT-RC",
    } : expediente.estadoFlujo === "ARCHIVADO" ? {
      subserieDocumental: "Expedientes de Matrícula", codigoSubserie: "CCD-SA-MAT-EXP",
    } : {}),
  },
  versionesDocumentos: expediente.versionesDocumentos.length > 0 ? expediente.versionesDocumentos : crearVersionesDemo(expediente),
}));

/** Se conserva la bitácora original del expediente EXP-2026-000104. */
const bitacoraCertificado: Record<string, BitacoraEventoExpediente[]> = {
  "8f1c9b2e-0001-4a11-9c1a-000000000001": [
    {
      eventoId: "evt-001",
      expedienteId: "8f1c9b2e-0001-4a11-9c1a-000000000001",
      tipoEvento: "CREACION",
      timestamp: "2026-09-05T09:12:00-05:00",
      usuarioId: "u-001",
      usuarioNombre: "Juan Pérez Ríos",
      areaNombre: "Mesa de Partes Virtual",
      estadoNuevo: "PENDIENTE",
      descripcionDetallada:
        "Registro del trámite en Mesa de Partes Virtual y asignación del CUT EXP-2026-000104.",
      hashTransaccion:
        "3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1",
    },
    {
      eventoId: "evt-002",
      expedienteId: "8f1c9b2e-0001-4a11-9c1a-000000000001",
      tipoEvento: "RECEPCION",
      timestamp: "2026-09-05T10:05:00-05:00",
      usuarioId: "u-050",
      usuarioNombre: "Operador de Ventanilla",
      areaNombre: "Mesa de Partes",
      estadoAnterior: "PENDIENTE",
      estadoNuevo: "PENDIENTE",
      descripcionDetallada:
        "Calificación conforme del documento y derivación a Secretaría Académica.",
      hashTransaccion:
        "6f2c3a1c8d5f2b7d5e5a4c3b2a1908f7e6d5c4b3a2918071615141312111009",
    },
    {
      eventoId: "evt-003",
      expedienteId: "8f1c9b2e-0001-4a11-9c1a-000000000001",
      tipoEvento: "DERIVACION",
      timestamp: "2026-09-05T10:06:00-05:00",
      usuarioId: "u-050",
      usuarioNombre: "Operador de Ventanilla",
      areaNombre: "Secretaría Académica",
      estadoAnterior: "PENDIENTE",
      estadoNuevo: "PENDIENTE",
      descripcionDetallada:
        "Derivación formal a Secretaría Académica para atención del certificado solicitado.",
      hashTransaccion:
        "9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a908070605040",
    },
  ],
};

const eventosPorEstado: Record<EstadoFlujoExpediente, { tipo: TipoEventoBitacora; descripcion: string }> = {
  PENDIENTE: { tipo: "CREACION", descripcion: "Registro del expediente para su atención." },
  EN_PROCESO: { tipo: "RECEPCION", descripcion: "Recepción formal e inicio de la revisión del expediente." },
  OBSERVADO: { tipo: "OBSERVACION", descripcion: "Observación documental registrada para su subsanación." },
  DERIVADO: { tipo: "DERIVACION", descripcion: "Derivación del expediente al área responsable de su atención." },
  NOTIFICADO: { tipo: "NOTIFICACION", descripcion: "Notificación de la resolución al solicitante." },
  ARCHIVADO: { tipo: "ARCHIVADO", descripcion: "Cierre de atención y traslado al Archivo Central." },
};

function crearBitacoraDemo(expediente: ExpedienteSGD): BitacoraEventoExpediente[] {
  const actual = eventosPorEstado[expediente.estadoFlujo];
  return [
    {
      eventoId: `${expediente.id}-registro`, expedienteId: expediente.id,
      tipoEvento: "CREACION", timestamp: expediente.fechaIngreso,
      usuarioId: expediente.metadatos.creadorId, usuarioNombre: expediente.metadatos.creadorNombre,
      areaNombre: etiquetaExpediente(expediente.areaOrigen), estadoNuevo: "PENDIENTE",
      descripcionDetallada: `Registro del expediente ${expediente.codigoExpediente}.`,
      hashTransaccion: hashDemo(expediente.id, 3),
    },
    {
      eventoId: `${expediente.id}-actual`, expedienteId: expediente.id,
      tipoEvento: actual.tipo, timestamp: expediente.fechaUltimoMovimiento,
      usuarioId: expediente.metadatos.responsableAsignadoId ?? expediente.metadatos.creadorId,
      usuarioNombre: expediente.metadatos.responsableAsignadoNombre ?? expediente.metadatos.creadorNombre,
      areaNombre: etiquetaExpediente(expediente.areaActual), estadoAnterior: "PENDIENTE",
      estadoNuevo: expediente.estadoFlujo, descripcionDetallada: actual.descripcion,
      hashTransaccion: hashDemo(expediente.id, 4),
    },
  ];
}

export const BITACORA_FIXTURE: Record<string, BitacoraEventoExpediente[]> = Object.fromEntries(
  EXPEDIENTES_FIXTURE.map((expediente) => [expediente.id, bitacoraCertificado[expediente.id] ?? crearBitacoraDemo(expediente)]),
);
