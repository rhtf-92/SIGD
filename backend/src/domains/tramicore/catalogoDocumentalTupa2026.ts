/**
 * Catálogo Documental Oficial de los 72 Procedimientos TUPA 2026 — IESTP Suiza
 * Generado de forma determinista y coherente con TUPA 2026 IESTP Suiza.
 * Cada procedimiento cuenta con configuración documental explícita, trazable y no bloqueante.
 * Incluye asignación orgánica institucional (Unidad de Recepción, Responsable y Resolutiva).
 */

export interface RequisitoDocumentalTupa {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  obligatorio: boolean;
  clasificacion: 'EXPEDIENTE' | 'ANEXO';
  formatosAdmitidos: readonly string[];
  observaciones: string;
  fuente: string;
  estadoValidacion?: 'VALIDADO_OFICIAL' | 'PENDIENTE_VALIDACION';
  tipoOrigen?: 'EXPRESO_FUENTE_INSTITUCIONAL' | 'INFERIDO_POR_DENOMINACION' | 'ESTANDAR_GENERAL';
  versionTupa?: string;
}

export interface ConfiguracionDocumentalProcedimiento {
  codigoInterno: string;
  codigoVisible: string;
  numeroVisible: string;
  nombre: string;
  rubro: string;
  paginaFuente: number;
  costoFuente: string;
  estadoValidacion: 'VALIDADO' | 'PENDIENTE_VALIDACION_DOCUMENTAL';
  sinAnexosEspecificos: boolean;
  observacionInstitucional: string;
  unidadRecepcion: string;
  unidadResponsable: string;
  unidadResponsableVerificada?: boolean;
  autoridadResolutiva: string;
  plazoDias: number | null;
  silencioAdministrativo: 'POSITIVO' | 'NEGATIVO' | 'PENDIENTE_VALIDACION' | null;
  versionTupa: string;
  requisitos: readonly RequisitoDocumentalTupa[];
  anexos: readonly RequisitoDocumentalTupa[];
}

export const CATALOGO_DOCUMENTAL_TUPA_2026: readonly ConfiguracionDocumentalProcedimiento[] = [
  {
    "codigoInterno": "SUZ26-001",
    "codigoVisible": "SUZ26-001",
    "numeroVisible": "001",
    "nombre": "Prácticas Iniciales",
    "rubro": "Proyectos Productivos — Venta de servicios",
    "paginaFuente": 1,
    "costoFuente": "S/ 35.00 (0.64 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Prácticas académicas. Se adjunta FUT y facultativamente la ficha o control académico. (TUPA 2026 IESTP Suiza, Página 1)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Coordinación de Área Académica / Secretaría Académica",
    "autoridadResolutiva": "Secretaría Académica",
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-001-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-001-INF",
        "codigo": "ANEXO_INF_PRACTICAS",
        "nombre": "Ficha o Control de Prácticas del Área Académica",
        "descripcion": "Documento de control o constancia de prácticas emitida o registrada por el Área Académica.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "El PDF indica control en el Área Académica.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-002",
    "codigoVisible": "SUZ26-002",
    "numeroVisible": "002",
    "nombre": "Prácticas Intermedias",
    "rubro": "Proyectos Productivos — Venta de servicios",
    "paginaFuente": 1,
    "costoFuente": "S/ 45.00 (0.82 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Prácticas académicas. Se adjunta FUT y facultativamente la ficha o control académico. (TUPA 2026 IESTP Suiza, Página 1)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Coordinación de Área Académica / Secretaría Académica",
    "autoridadResolutiva": "Secretaría Académica",
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-002-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-002-INF",
        "codigo": "ANEXO_INF_PRACTICAS",
        "nombre": "Ficha o Control de Prácticas del Área Académica",
        "descripcion": "Documento de control o constancia de prácticas emitida o registrada por el Área Académica.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "El PDF indica control en el Área Académica.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-003",
    "codigoVisible": "SUZ26-003",
    "numeroVisible": "003",
    "nombre": "Prácticas Finales",
    "rubro": "Proyectos Productivos — Venta de servicios",
    "paginaFuente": 1,
    "costoFuente": "S/ 60.00 (1.09 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Prácticas académicas. Se adjunta FUT y facultativamente la ficha o control académico. (TUPA 2026 IESTP Suiza, Página 1)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Coordinación de Área Académica / Secretaría Académica",
    "autoridadResolutiva": "Secretaría Académica",
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-003-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-003-INF",
        "codigo": "ANEXO_INF_PRACTICAS",
        "nombre": "Ficha o Control de Prácticas del Área Académica",
        "descripcion": "Documento de control o constancia de prácticas emitida o registrada por el Área Académica.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "El PDF indica control en el Área Académica.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-004",
    "codigoVisible": "SUZ26-004",
    "numeroVisible": "004",
    "nombre": "Experiencias Formativas en Situaciones Reales de Trabajo (I, II, III y IV) — por cada módulo",
    "rubro": "Proyectos Productivos — Venta de servicios",
    "paginaFuente": 1,
    "costoFuente": "S/ 46.50 (0.84 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Experiencias Formativas en Situaciones Reales de Trabajo por módulo. (TUPA 2026 IESTP Suiza, Página 1)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Coordinación de Área Académica / Secretaría Académica",
    "autoridadResolutiva": "Secretaría Académica",
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-004-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-004-SUP",
        "codigo": "ANEXO_INF_SUPERVISION",
        "nombre": "Informe de Designación de Docentes Responsables",
        "descripcion": "Informe del Área Académica designando docentes responsables de supervisión de experiencias formativas.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "El PDF indica informe del Área Académica designando docentes responsables.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-005",
    "codigoVisible": "SUZ26-005",
    "numeroVisible": "005",
    "nombre": "Certificado Modular (I, II, III y IV) — por cada módulo",
    "rubro": "Proyectos Productivos — Venta de servicios",
    "paginaFuente": 1,
    "costoFuente": "S/ 100.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 1). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-005-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-006",
    "codigoVisible": "SUZ26-006",
    "numeroVisible": "006",
    "nombre": "Certificado de Inglés",
    "rubro": "Proyectos Productivos — Venta de servicios",
    "paginaFuente": 1,
    "costoFuente": "S/ 100.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Opción A — Emisión de certificado por estudios de inglés culminados y aprobados en el propio IESTP Suiza. El ciudadano radica FUT en Mesa de Partes y cancela el derecho en Tesorería (S/ 100.00 — B/V). Secretaría Académica verifica internamente los antecedentes académicos institucionales y Dirección General aprueba y suscribe digitalmente el certificado. Parámetro operativo: plazo referencial 5 días hábiles y silencio positivo (el TUPA 2026 pág. 1 consigna derecho de pago S/ 100.00 en Tesorería y emisión de B/V).",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-006-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro de emisión de Certificado de Inglés por estudios culminados y aprobados en el IESTP Suiza.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación. No requiere adjuntar notas ni constancias internas: Secretaría Académica verifica el historial institucional directamente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": true
  },
  {
    "codigoInterno": "SUZ26-007",
    "codigoVisible": "SUZ26-007",
    "numeroVisible": "007",
    "nombre": "Centro de Idiomas — paquete básico de 4 meses para alumnos del IESTP Suiza",
    "rubro": "Proyectos Productivos — Venta de servicios",
    "paginaFuente": 1,
    "costoFuente": "S/ 300.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 1). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-007-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-008",
    "codigoVisible": "SUZ26-008",
    "numeroVisible": "008",
    "nombre": "Centro de Idiomas — paquete básico de 4 meses para alumnos externos",
    "rubro": "Proyectos Productivos — Venta de servicios del IESTP Suiza",
    "paginaFuente": 1,
    "costoFuente": "S/ 350.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 1). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-008-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-009",
    "codigoVisible": "SUZ26-009",
    "numeroVisible": "009",
    "nombre": "Examen de Suficiencia de Inglés y/o Portugués",
    "rubro": "Proyectos Productivos — Venta de servicios",
    "paginaFuente": 1,
    "costoFuente": "S/ 300.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 1). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-009-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-010",
    "codigoVisible": "SUZ26-010",
    "numeroVisible": "010",
    "nombre": "CEPRETEC 2026",
    "rubro": "Proyectos Productivos — Venta de servicios",
    "paginaFuente": 1,
    "costoFuente": "El cuadro muestra S/ 400.00, S/ 200.00, S/ 60.00, S/ 50.00, S/ 40.00 y S/ 10.00.",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 1). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-010-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 1",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-011",
    "codigoVisible": "SUZ26-011",
    "numeroVisible": "011",
    "nombre": "Alquiler del Galpón Agrícola para la Crianza de Pollos (por campaña)",
    "rubro": "Venta de servicios",
    "paginaFuente": 2,
    "costoFuente": "S/ 500.00.",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Servicio / Alquiler institucional. El TUPA oficial no establece anexos documentales específicos. Se formaliza mediante solicitud de servicio o contrato. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-011-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-012",
    "codigoVisible": "SUZ26-012",
    "numeroVisible": "012",
    "nombre": "Alquiler de Retroproyector",
    "rubro": "Venta de servicios",
    "paginaFuente": 2,
    "costoFuente": "S/ 100.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Servicio / Alquiler institucional. El TUPA oficial no establece anexos documentales específicos. Se formaliza mediante solicitud de servicio o contrato. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-012-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-013",
    "codigoVisible": "SUZ26-013",
    "numeroVisible": "013",
    "nombre": "Alquiler de Aulas — diario",
    "rubro": "Venta de servicios",
    "paginaFuente": 2,
    "costoFuente": "S/ 150.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Servicio / Alquiler institucional. El TUPA oficial no establece anexos documentales específicos. Se formaliza mediante solicitud de servicio o contrato. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-013-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-014",
    "codigoVisible": "SUZ26-014",
    "numeroVisible": "014",
    "nombre": "Alquiler de la Cancha de Fútbol — diario",
    "rubro": "Venta de servicios",
    "paginaFuente": 2,
    "costoFuente": "S/ 100.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Servicio / Alquiler institucional. El TUPA oficial no establece anexos documentales específicos. Se formaliza mediante solicitud de servicio o contrato. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-014-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-015",
    "codigoVisible": "SUZ26-015",
    "numeroVisible": "015",
    "nombre": "Alquiler de Ambientes para servicio de alimentación",
    "rubro": "Venta de servicios",
    "paginaFuente": 2,
    "costoFuente": "S/ 1,000.00.",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Servicio / Alquiler institucional. El TUPA oficial no establece anexos documentales específicos. Se formaliza mediante solicitud de servicio o contrato. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-015-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-016",
    "codigoVisible": "SUZ26-016",
    "numeroVisible": "016",
    "nombre": "Alquiler del Auditorio",
    "rubro": "Venta de servicios",
    "paginaFuente": 2,
    "costoFuente": "S/ 300.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Servicio / Alquiler institucional. El TUPA oficial no establece anexos documentales específicos. Se formaliza mediante solicitud de servicio o contrato. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-016-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-017",
    "codigoVisible": "SUZ26-017",
    "numeroVisible": "017",
    "nombre": "Alquiler de Laboratorio de Cómputo a Terceros",
    "rubro": "Venta de servicios",
    "paginaFuente": 2,
    "costoFuente": "S/ 20.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Servicio / Alquiler institucional. El TUPA oficial no establece anexos documentales específicos. Se formaliza mediante solicitud de servicio o contrato. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-017-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-018",
    "codigoVisible": "SUZ26-018",
    "numeroVisible": "018",
    "nombre": "Venta Ambulatoria Diaria",
    "rubro": "Venta de servicios",
    "paginaFuente": 2,
    "costoFuente": "S/ 20.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Servicio / Alquiler institucional. El TUPA oficial no establece anexos documentales específicos. Se formaliza mediante solicitud de servicio o contrato. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-018-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-019",
    "codigoVisible": "SUZ26-019",
    "numeroVisible": "019",
    "nombre": "Venta de Mangos",
    "rubro": "Venta de bienes",
    "paginaFuente": 2,
    "costoFuente": "S/ 15.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-019-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-020",
    "codigoVisible": "SUZ26-020",
    "numeroVisible": "020",
    "nombre": "Venta de Patos BB",
    "rubro": "Venta de bienes",
    "paginaFuente": 2,
    "costoFuente": "S/ 15.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 2)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-020-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 2",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-021",
    "codigoVisible": "SUZ26-021",
    "numeroVisible": "021",
    "nombre": "Venta de Patos Pichones",
    "rubro": "Venta de bienes",
    "paginaFuente": 3,
    "costoFuente": "S/ 30.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 3)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-021-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 3",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-023",
    "codigoVisible": "SUZ26-022",
    "numeroVisible": "022",
    "nombre": "Venta de Pati Pollos",
    "rubro": "Venta de servicios, según el encabezado de página; la ubicación del concepto bajo ese rubro puede requerir confirmación",
    "paginaFuente": 3,
    "costoFuente": "S/ 15.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 3)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-023-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 3",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-024",
    "codigoVisible": "SUZ26-023",
    "numeroVisible": "023",
    "nombre": "Venta de Patos adultos hembras",
    "rubro": "Venta de servicios, según el encabezado de página; la ubicación del concepto bajo ese rubro puede requerir confirmación",
    "paginaFuente": 3,
    "costoFuente": "S/ 40.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 3)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-024-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 3",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-025",
    "codigoVisible": "SUZ26-024",
    "numeroVisible": "024",
    "nombre": "Venta de Patos adultos machos",
    "rubro": "Venta de servicios, según el encabezado de página; la ubicación del concepto bajo ese rubro puede requerir confirmación",
    "paginaFuente": 3,
    "costoFuente": "El cuadro muestra S/ 50.00 y S/ 55.00.",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 3)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-025-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 3",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-026",
    "codigoVisible": "SUZ26-025",
    "numeroVisible": "025",
    "nombre": "Venta de Porcino para consumo — kg",
    "rubro": "Rubro según encabezado del TUPA",
    "paginaFuente": 3,
    "costoFuente": "S/ 20.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 3)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-026-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 3",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-027",
    "codigoVisible": "SUZ26-026",
    "numeroVisible": "026",
    "nombre": "Venta de Porcino en Pie — kg",
    "rubro": "Rubro según encabezado del TUPA",
    "paginaFuente": 3,
    "costoFuente": "El cuadro muestra S/ 25.00 y S/ 15.00.",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 3)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-027-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 3",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-028",
    "codigoVisible": "SUZ26-027",
    "numeroVisible": "027",
    "nombre": "Venta de Ganado Vacuno",
    "rubro": "Rubro según encabezado del TUPA",
    "paginaFuente": 3,
    "costoFuente": "El cuadro muestra S/ 20.00 y S/ 15.00.",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 3)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-028-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 3",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-029",
    "codigoVisible": "SUZ26-028",
    "numeroVisible": "028",
    "nombre": "Servicio de Empadre",
    "rubro": "Venta de servicios",
    "paginaFuente": 3,
    "costoFuente": "S/ 50.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Venta de productos pecuarios / agropecuarios. Se formaliza mediante solicitud o boleta de atención directa. (TUPA 2026 IESTP Suiza, Página 3)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-029-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 3",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-030",
    "codigoVisible": "SUZ26-029",
    "numeroVisible": "029",
    "nombre": "FUT — proceso de titulación",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 4.00 (0.07 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Proceso de Titulación. Adquisición o presentación de FUT de titulación. (TUPA 2026 IESTP Suiza, Página 4)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-030-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "EXPRESO_FUENTE_INSTITUCIONAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-031",
    "codigoVisible": "SUZ26-030",
    "numeroVisible": "030",
    "nombre": "Constancia de No Adeudar — para fines de titulación",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 16.50 (0.30 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Constancia de No Adeudar. El TUPA no exige anexos obligatorios para la solicitud. (TUPA 2026 IESTP Suiza, Página 4)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-031-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-032",
    "codigoVisible": "SUZ26-031",
    "numeroVisible": "031",
    "nombre": "Trabajo de Aplicación Profesional (Examen Teórico Práctico)",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 57.00 (1.03 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-032-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-033",
    "codigoVisible": "SUZ26-032",
    "numeroVisible": "032",
    "nombre": "Examen de Suficiencia Profesional (Examen Teórico Práctico)",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 57.00 (1.03 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-033-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-034",
    "codigoVisible": "SUZ26-033",
    "numeroVisible": "033",
    "nombre": "Expedición de Título",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 105.00 (1.90 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Expedición de Título Profesional Técnico. (TUPA 2026 IESTP Suiza, Página 4)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-034-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-034-EXP",
        "codigo": "ANEXO_EXP_TITULACION",
        "nombre": "Expediente Académico de Titulación y Fotografías",
        "descripcion": "Documentación sustentatoria de haber completado plan de estudios, prácticas y requisitos de titulación.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Sujeto a verificación de cumplimiento académico en Secretaría Académica.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-035",
    "codigoVisible": "SUZ26-034",
    "numeroVisible": "034",
    "nombre": "Certificado de Estudios Superiores (6 semestres)",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 124.00 (2.24 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento institucional SUZ26-034 conforme al TUPA 2026 (Página 4). Certificado de Estudios Superiores (6 semestres), derecho de tramitación S/ 124.00, calificación por Secretaría Académica y suscripción digital por Dirección General.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-035-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      },
      {
        "id": "REQ-SUZ26-035-COMPROBANTE",
        "codigo": "COMPROBANTE_PAGO",
        "nombre": "Comprobante de Pago por Derecho de Trámite",
        "descripcion": "Comprobante emitido por Tesorería o entidad recaudadora autorizada (S/ 124.00 · 2.24% UIT).",
        "obligatorio": false,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf",
          "image/jpeg",
          "image/png"
        ],
        "observaciones": "Verificación y conciliación de pago a cargo de Tesorería del IESTP Suiza.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": true
  },
  {
    "codigoInterno": "SUZ26-036",
    "codigoVisible": "SUZ26-035",
    "numeroVisible": "035",
    "nombre": "Visación de Certificado de Estudios Superiores",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 16.00 (0.29 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-036-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-037",
    "codigoVisible": "SUZ26-036",
    "numeroVisible": "036",
    "nombre": "Caligrafiado de Título",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 26.00 (0.47 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-037-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-038",
    "codigoVisible": "SUZ26-037",
    "numeroVisible": "037",
    "nombre": "Derecho de Formato de Título",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 42.00 (0.75 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-038-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-039",
    "codigoVisible": "SUZ26-038",
    "numeroVisible": "038",
    "nombre": "Inscripción de Título",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 120.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-039-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-040",
    "codigoVisible": "SUZ26-039",
    "numeroVisible": "039",
    "nombre": "Medallas — proceso de titulación",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 100.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-040-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-041",
    "codigoVisible": "SUZ26-040",
    "numeroVisible": "040",
    "nombre": "Protector de Título",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 100.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-041-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-042",
    "codigoVisible": "SUZ26-041",
    "numeroVisible": "041",
    "nombre": "Colación",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 100.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-042-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-043",
    "codigoVisible": "SUZ26-042",
    "numeroVisible": "042",
    "nombre": "Protector de Certificado Modular",
    "rubro": "Ingresos Propios — Servicios Académicos; Proceso de Titulación",
    "paginaFuente": 4,
    "costoFuente": "S/ 50.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 4). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-043-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-044",
    "codigoVisible": "SUZ26-043",
    "numeroVisible": "043",
    "nombre": "Modificación de Datos del Título",
    "rubro": "Ingresos Propios — Servicios Académicos; Otros Servicios Académicos",
    "paginaFuente": 4,
    "costoFuente": "S/ 269.00 (4.88 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Modificación de Datos del Título. (TUPA 2026 IESTP Suiza, Página 4)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-044-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-044-PROBATORIO",
        "codigo": "ANEXO_DOC_PROBATORIO",
        "nombre": "Documento Oficial Probatorio de Modificación de Datos",
        "descripcion": "Copia certificada de DNI rectificado, partida de nacimiento o resolución registral de RENIEC.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Requisito probatorio indispensable para autorizar la rectificación de datos registrales en el título.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-045",
    "codigoVisible": "SUZ26-044",
    "numeroVisible": "044",
    "nombre": "Derecho de duplicado de Título",
    "rubro": "Ingresos Propios — Servicios Académicos; Otros Servicios Académicos",
    "paginaFuente": 4,
    "costoFuente": "S/ 309.00 (5.61 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Derecho de duplicado de Título. (TUPA 2026 IESTP Suiza, Página 4)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-045-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-045-JUSTIFICACION",
        "codigo": "ANEXO_DENUNCIA_O_DETERIORO",
        "nombre": "Denuncia Policial por Pérdida o Título Deteriorado",
        "descripcion": "Denuncia policial por pérdida/robo del título original o entrega física del documento deteriorado.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Requisito indispensable para sustentar la expedición de duplicado según normativa sectorial.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 4",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-046",
    "codigoVisible": "SUZ26-045",
    "numeroVisible": "045",
    "nombre": "Matrículas",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 200.00",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Proceso de Matrícula semestral regular. (TUPA 2026 IESTP Suiza, Página 5)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-046-FUT",
        "codigo": "FUT",
        "nombre": "Ficha Oficial de Matrícula",
        "descripcion": "Ficha de matrícula debidamente completada con las unidades didácticas del semestre.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "EXPRESO_FUENTE_INSTITUCIONAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-047",
    "codigoVisible": "SUZ26-046",
    "numeroVisible": "046",
    "nombre": "Admisión 2026",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 250.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-047-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-048",
    "codigoVisible": "SUZ26-047",
    "numeroVisible": "047",
    "nombre": "Guías del postulante",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 50.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-048-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-049",
    "codigoVisible": "SUZ26-048",
    "numeroVisible": "048",
    "nombre": "Ingreso Admisión 2026 — titulados",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 500.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-049-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-050",
    "codigoVisible": "SUZ26-049",
    "numeroVisible": "049",
    "nombre": "Derecho de Reincorporación (Reingreso)",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 300.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-050-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-051",
    "codigoVisible": "SUZ26-050",
    "numeroVisible": "050",
    "nombre": "Constancia de Egresado",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 31.00",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-051-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-052",
    "codigoVisible": "SUZ26-051",
    "numeroVisible": "051",
    "nombre": "Certificado de Bachillerato",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 42.00 (0.75 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-052-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-053",
    "codigoVisible": "SUZ26-052",
    "numeroVisible": "052",
    "nombre": "Constancias — de título, estudios o matrícula",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 23.00 (0.41 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-053-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-054",
    "codigoVisible": "SUZ26-053",
    "numeroVisible": "053",
    "nombre": "Convalidación entre Planes de Estudios",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 46.50 (0.84 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Convalidación entre Planes de Estudios. (TUPA 2026 IESTP Suiza, Página 5)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-054-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-054-PLAN",
        "codigo": "ANEXO_PLAN_ESTUDIOS",
        "nombre": "Certificado de Estudios o Sílabos del Plan Previo",
        "descripcion": "Certificados de estudios o sílabos visados del plan de estudios curricular de origen para cotejo.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento sustentatorio para la comisión evaluadora de convalidaciones.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-055",
    "codigoVisible": "SUZ26-054",
    "numeroVisible": "054",
    "nombre": "Convalidación por Unidades de Competencia",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 46.50 (0.84 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Convalidación por Unidades de Competencia. (TUPA 2026 IESTP Suiza, Página 5)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-055-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-055-COMP",
        "codigo": "ANEXO_CERT_COMPETENCIAS",
        "nombre": "Certificados de Competencias Laborales o Formativas",
        "descripcion": "Evidencias documentales y certificados oficiales de competencias a convalidar.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Evaluación de competencias a cargo de la coordinación de carrera.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-056",
    "codigoVisible": "SUZ26-055",
    "numeroVisible": "055",
    "nombre": "Devolución de Expediente",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 21.00 (0.37 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-056-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-057",
    "codigoVisible": "SUZ26-056",
    "numeroVisible": "056",
    "nombre": "Evaluación Extraordinaria (A)",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 93.00 (1.68 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-057-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-058",
    "codigoVisible": "SUZ26-057",
    "numeroVisible": "057",
    "nombre": "Evaluación Extraordinaria (RM 069)",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 70.00 (1.27 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-058-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-059",
    "codigoVisible": "SUZ26-058",
    "numeroVisible": "058",
    "nombre": "Examen de Recuperación",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 70.00 (1.27 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-059-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-060",
    "codigoVisible": "SUZ26-059",
    "numeroVisible": "059",
    "nombre": "Examen de Cargo",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 70.00 (1.27 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-060-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-061",
    "codigoVisible": "SUZ26-060",
    "numeroVisible": "060",
    "nombre": "Repitencia de Unidad Didáctica",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 86.00 (1.56 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-061-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-062",
    "codigoVisible": "SUZ26-061",
    "numeroVisible": "061",
    "nombre": "Repitencia de Semestre",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 80.00 (1.45 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 5). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-062-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-063",
    "codigoVisible": "SUZ26-062",
    "numeroVisible": "062",
    "nombre": "Reserva de Matrícula — ingresantes",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 66.00 (1.20 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Reserva de Matrícula para ingresantes. (TUPA 2026 IESTP Suiza, Página 5)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-063-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-063-CONSTANCIA",
        "codigo": "ANEXO_CONSTANCIA_INGRESO",
        "nombre": "Constancia de Ingreso / Postulación",
        "descripcion": "Copia de la constancia de ingreso al proceso de admisión correspondiente.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Sustento para la reserva de matrícula por plazo de ley.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-064",
    "codigoVisible": "SUZ26-063",
    "numeroVisible": "063",
    "nombre": "Licencia de Estudios — estudiantes antiguos",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 66.00 (1.20 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Licencia de Estudios para estudiantes antiguos. (TUPA 2026 IESTP Suiza, Página 5)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-064-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-064-RESOLUCION",
        "codigo": "ANEXO_DOC_JUSTIFICATORIO",
        "nombre": "Documentación Justificatoria de Licencia",
        "descripcion": "Documentos sustentatorios (laboral, salud o personal) de la solicitud de licencia.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "El PDF indica Resolución Directoral — Secretaría Académica.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": true
  },
  {
    "codigoInterno": "SUZ26-065",
    "codigoVisible": "SUZ26-064",
    "numeroVisible": "064",
    "nombre": "Traslado Interno",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 309.00 (5.61 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Traslado Interno de programa de estudios. (TUPA 2026 IESTP Suiza, Página 5)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-065-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "EXPRESO_FUENTE_INSTITUCIONAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-065-VACANTE",
        "codigo": "ANEXO_CONSTANCIA_VACANTE",
        "nombre": "Constancia de Vacante en la Carrera Destino",
        "descripcion": "Constancia de disponibilidad de vacante emitida por la coordinación del programa de estudios.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "El PDF indica vacante en la carrera y Resolución Directoral.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "EXPRESO_FUENTE_INSTITUCIONAL"
      }
    ],
    "unidadResponsableVerificada": true
  },
  {
    "codigoInterno": "SUZ26-066",
    "codigoVisible": "SUZ26-065",
    "numeroVisible": "065",
    "nombre": "Traslado Externo",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 5,
    "costoFuente": "S/ 412.00 (7.48 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Traslado Externo desde otra institución de educación superior. (TUPA 2026 IESTP Suiza, Página 5)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-066-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "EXPRESO_FUENTE_INSTITUCIONAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-066-ORIGEN",
        "codigo": "ANEXO_CERT_ORIGEN",
        "nombre": "Certificados Oficiales de Estudios del Instituto de Origen",
        "descripcion": "Certificados oficiales visados de estudios superiores del instituto tecnológico de procedencia.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Requisito para el análisis curricular de convalidación externa.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 5",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": true
  },
  {
    "codigoInterno": "SUZ26-067",
    "codigoVisible": "SUZ26-066",
    "numeroVisible": "066",
    "nombre": "Demora Devolución Libro Biblioteca",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 6,
    "costoFuente": "S/ 10.00 (0.19 % UIT vigente; costo por día)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 6). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Unidad de Administración / Tesorería (Pendiente de validación en ROF)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-067-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 6",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-068",
    "codigoVisible": "SUZ26-067",
    "numeroVisible": "067",
    "nombre": "Acceso a la Información Pública",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 6,
    "costoFuente": "El cuadro muestra S/ 10.50 y también S/ 10.00 por cada hoja; consigna 0.19 % UIT vigente.",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento amparado en el TUO de la Ley de Transparencia y Acceso a la Información Pública (D.S. 021-2019-JUS). (TUPA 2026 IESTP Suiza, Página 6)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Dirección General (DG)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-068-FUT",
        "codigo": "FUT",
        "nombre": "Formulario de Acceso a la Información Pública (Ley 27806)",
        "descripcion": "Solicitud formal dirigida a la Dirección General precisando la información requerida.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 6",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "EXPRESO_FUENTE_INSTITUCIONAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": true
  },
  {
    "codigoInterno": "SUZ26-069",
    "codigoVisible": "SUZ26-068",
    "numeroVisible": "068",
    "nombre": "Búsqueda y Duplicados de Boletas, Síllabus y Otros Trámites",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 6,
    "costoFuente": "Importe agrupado o variante; revisar detalle",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 6). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-069-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 6",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-072",
    "codigoVisible": "SUZ26-069",
    "numeroVisible": "069",
    "nombre": "Titulación de Otros Institutos Tecnológicos",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 6,
    "costoFuente": "S/ 515.00 (9.35 % UIT vigente)",
    "estadoValidacion": "VALIDADO",
    "sinAnexosEspecificos": false,
    "observacionInstitucional": "Titulación de egresados de otros institutos tecnológicos. (TUPA 2026 IESTP Suiza, Página 6)",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC)",
    "autoridadResolutiva": "Dirección General (DG)",
    "plazoDias": 30,
    "silencioAdministrativo": "NEGATIVO",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-072-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 6",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [
      {
        "id": "ANX-SUZ26-072-EXP_ORIGEN",
        "codigo": "ANEXO_EXP_ORIGEN",
        "nombre": "Expediente Académico de Egresado del Instituto de Origen",
        "descripcion": "Certificados oficiales visados, constancia de egresado y documentación de titulación de origen.",
        "obligatorio": false,
        "clasificacion": "ANEXO",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Sujeto a verificación por la comisión institucional de titulación.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 6",
        "estadoValidacion": "VALIDADO_OFICIAL",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "INFERIDO_POR_DENOMINACION"
      }
    ],
    "unidadResponsableVerificada": true
  },
  {
    "codigoInterno": "SUZ26-073",
    "codigoVisible": "SUZ26-070",
    "numeroVisible": "070",
    "nombre": "Examen de Subsanación con Jurado",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 6,
    "costoFuente": "S/ 33.00 (0.60 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 6). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-073-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 6",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-074",
    "codigoVisible": "SUZ26-071",
    "numeroVisible": "071",
    "nombre": "Prueba de Suficiencia Académica",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 6,
    "costoFuente": "S/ 105.00 (1.90 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 6). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-074-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 6",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  },
  {
    "codigoInterno": "SUZ26-075",
    "codigoVisible": "SUZ26-072",
    "numeroVisible": "072",
    "nombre": "Carnets, Insignia y Distintivos",
    "rubro": "Otros Servicios Académicos",
    "paginaFuente": 6,
    "costoFuente": "S/ 50.00 (0.93 % UIT vigente)",
    "estadoValidacion": "PENDIENTE_VALIDACION_DOCUMENTAL",
    "sinAnexosEspecificos": true,
    "observacionInstitucional": "Procedimiento registrado en el TUPA 2026 (Página 6). Requisitos específicos y unidad responsable pendiente de validación institucional; se admite radicación con Solicitud General (FUT) sin bloquear el trámite.",
    "unidadRecepcion": "Mesa de Partes (MP)",
    "unidadResponsable": "Secretaría Académica (SEC) — Pendiente de validación institucional",
    "autoridadResolutiva": "Secretaría Académica / Dirección General (Pendiente de formalización)",
    "plazoDias": null,
    "silencioAdministrativo": "PENDIENTE_VALIDACION",
    "versionTupa": "TUPA-2026-V1",
    "requisitos": [
      {
        "id": "REQ-SUZ26-075-FUT",
        "codigo": "FUT",
        "nombre": "Solicitud Formal Única de Trámite (FUT)",
        "descripcion": "Formulario oficial debidamente llenado con datos de identificación y petitorio claro.",
        "obligatorio": true,
        "clasificacion": "EXPEDIENTE",
        "formatosAdmitidos": [
          "application/pdf"
        ],
        "observaciones": "Documento principal de radicación exigido para formalizar el inicio del expediente.",
        "fuente": "TUPA 2026 IESTP Suiza, Página 6",
        "estadoValidacion": "PENDIENTE_VALIDACION",
        "versionTupa": "TUPA-2026-V1",
        "tipoOrigen": "ESTANDAR_GENERAL"
      }
    ],
    "anexos": [],
    "unidadResponsableVerificada": false
  }
] as const;

export const CATALOGO_DOCUMENTAL_POR_CODIGO: ReadonlyMap<string, ConfiguracionDocumentalProcedimiento> = new Map(
  CATALOGO_DOCUMENTAL_TUPA_2026.flatMap(c => [
    [c.codigoInterno, c],
    [c.codigoVisible, c],
    [c.numeroVisible, c],
  ])
);
