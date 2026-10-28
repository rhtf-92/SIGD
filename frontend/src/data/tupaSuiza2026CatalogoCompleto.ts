/**
 * Catálogo Oficial Completo del TUPA 2026 - IESTP "Suiza" (Pucallpa, Ucayali)
 * Fuente: TUPA_2026_IESTP_Suiza.pdf (SHA-256: 377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622)
 * Total: 72 entradas clasificadas conforme a la fuente oficial institucional.
 */

export type CategoriaTupa =
  | "PROCEDIMIENTO_APROBADO"
  | "PROCEDIMIENTO_PENDIENTE"
  | "SERVICIO_ACADEMICO"
  | "SERVICIO_COMERCIAL"
  | "BIEN_PRODUCTIVO"
  | "ACTUACION_INTERNA"
  | "OTRO_NO_RADICABLE";

export interface ItemTupaOficial {
  readonly id: string;
  readonly pagina: number;
  readonly referenciaFila: string;
  readonly codigo: string;
  readonly denominacion: string;
  readonly categoria: CategoriaTupa;
  readonly estadoValidacion: "APROBADO" | "PENDIENTE_VALIDACION";
  readonly monto: string;
  readonly requisitos: readonly string[];
  readonly plazo: string;
  readonly unidadResponsable: string;
  readonly baseLegal: string | null;
  readonly admiteRadicacionSigd: boolean;
  readonly observacion: string;
  readonly clasificacion?: string;
}

export const TUPA_SUIZA_2026_COMPLETO: readonly ItemTupaOficial[] = [
  {
    "id": "p1-fila-01",
    "pagina": 1,
    "referenciaFila": "p1-fila-01",
    "codigo": "p1-fila-01",
    "denominacion": "Prácticas Iniciales",
    "categoria": "ACTUACION_INTERNA",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 35.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Control en el Área Académica",
      "Comprobante de Pago 0.64 % UIT Vigente"
    ],
    "plazo": "Conforme a calendario académico institucional",
    "unidadResponsable": "Área Académica",
    "baseLegal": "Ley N.° 30512 • Reglamento Institucional",
    "admiteRadicacionSigd": false,
    "observacion": "Actuación de control pedagógico interno o ceremonia de colación; no corresponde a radicación externa.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p1-fila-02",
    "pagina": 1,
    "referenciaFila": "p1-fila-02",
    "codigo": "p1-fila-02",
    "denominacion": "Prácticas Intermedias",
    "categoria": "ACTUACION_INTERNA",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 45.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Control en el Área Académica",
      "Comprobante de Pago 0.82 % UIT Vigente"
    ],
    "plazo": "Conforme a calendario académico institucional",
    "unidadResponsable": "Área Académica",
    "baseLegal": "Ley N.° 30512 • Reglamento Institucional",
    "admiteRadicacionSigd": false,
    "observacion": "Actuación de control pedagógico interno o ceremonia de colación; no corresponde a radicación externa.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p1-fila-03",
    "pagina": 1,
    "referenciaFila": "p1-fila-03",
    "codigo": "p1-fila-03",
    "denominacion": "Prácticas Finales",
    "categoria": "ACTUACION_INTERNA",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 60.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Control en el Área Académica",
      "Comprobante de Pago 1.09 % UIT Vigente"
    ],
    "plazo": "Conforme a calendario académico institucional",
    "unidadResponsable": "Área Académica",
    "baseLegal": "Ley N.° 30512 • Reglamento Institucional",
    "admiteRadicacionSigd": false,
    "observacion": "Actuación de control pedagógico interno o ceremonia de colación; no corresponde a radicación externa.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p1-fila-04",
    "pagina": 1,
    "referenciaFila": "p1-fila-04",
    "codigo": "p1-fila-04",
    "denominacion": "Experiencias Formativas en Situaciones Reales de Trabajo (I, II, III y IV) Por cada Módulo",
    "categoria": "ACTUACION_INTERNA",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 46.50",
    "requisitos": [
      "Informe del Área Académica designando los Docentes responsables para las Supervisiones de Experiencias Formativas en Situaciones Reales de Trabajo",
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.84 % UIT Vigente"
    ],
    "plazo": "Conforme a calendario académico institucional",
    "unidadResponsable": "Área Académica",
    "baseLegal": "Ley N.° 30512 • Reglamento Institucional",
    "admiteRadicacionSigd": false,
    "observacion": "Actuación de control pedagógico interno o ceremonia de colación; no corresponde a radicación externa.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p1-fila-05",
    "pagina": 1,
    "referenciaFila": "p1-fila-05",
    "codigo": "p1-fila-05",
    "denominacion": "Certificado Modular (I, II, III y IV) Por cada Módulo",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 100.00",
    "requisitos": [
      "Pago en el Área de Tesorería",
      "Emisión de la B/V"
    ],
    "plazo": "Hasta 15 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p1-fila-06",
    "pagina": 1,
    "referenciaFila": "p1-fila-06",
    "codigo": "p1-fila-06",
    "denominacion": "Certificado de Inglés",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 100.00",
    "requisitos": [
      "Pago en el Área de Tesorería",
      "Emisión de la B/V"
    ],
    "plazo": "Hasta 15 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p1-fila-07",
    "pagina": 1,
    "referenciaFila": "p1-fila-07",
    "codigo": "p1-fila-07",
    "denominacion": "Centro de Idiomas: Inglés, Portugués, Japonés Nivel Básico Paquete: 04 meses para Alumnos del IESTP \"SUIZA\"",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 300.00",
    "requisitos": [
      "Pago en el Área de Tesorería",
      "Emisión de la B/V"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p1-fila-08",
    "pagina": 1,
    "referenciaFila": "p1-fila-08",
    "codigo": "p1-fila-08",
    "denominacion": "Centro de Idiomas: Inglés, Portugués, Japonés Nivel Básico Paquete: 04 meses para Alumnos Externos del IESTP \"SUIZA\"",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 350.00",
    "requisitos": [
      "Pago en el Área de Tesorería",
      "Emisión de la B/V"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p1-fila-09",
    "pagina": 1,
    "referenciaFila": "p1-fila-09",
    "codigo": "p1-fila-09",
    "denominacion": "Examen de Suficiencia de Inglés y/o Portugués",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 300.00",
    "requisitos": [
      "Pago en el Área de Tesorería",
      "Emisión de la B/V"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p1-fila-10",
    "pagina": 1,
    "referenciaFila": "p1-fila-10",
    "codigo": "p1-fila-10",
    "denominacion": "CEPRETEC 2026",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 400.00 S/ 200.00 S/ 60.00 S/ 50.00 S/ 40.00 S/ 10.00",
    "requisitos": [
      "Pago en el Área de Tesorería",
      "Emisión de la B/V"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p2-fila-01",
    "pagina": 2,
    "referenciaFila": "p2-fila-01",
    "codigo": "p2-fila-01",
    "denominacion": "Alquiler del Galpón Agrícola Para la Crianza de Pollos (Por Campaña)",
    "categoria": "SERVICIO_COMERCIAL",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 500.00",
    "requisitos": [
      "Solicitud dirigida al Director del IESTP SUIZA.",
      "Suscripción del Contrato.",
      "Pago en tesorería de acuerdo al Contrato",
      "Precio por Campaña"
    ],
    "plazo": "Según disponibilidad de infraestructura y cronograma de reserva",
    "unidadResponsable": "Centro de Producción de Bienes y Servicios / Tesorería",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Estatuto Institucional IESTP Suiza",
    "admiteRadicacionSigd": false,
    "observacion": "Alquiler o servicio de explotación comercial de infraestructura; no genera CUT ni expediente SIGD.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p2-fila-02",
    "pagina": 2,
    "referenciaFila": "p2-fila-02",
    "codigo": "p2-fila-02",
    "denominacion": "Alquiler de Retroproyector",
    "categoria": "SERVICIO_COMERCIAL",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 100.00",
    "requisitos": [
      "Pago en tesorería."
    ],
    "plazo": "Según disponibilidad de infraestructura y cronograma de reserva",
    "unidadResponsable": "Centro de Producción de Bienes y Servicios / Tesorería",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Estatuto Institucional IESTP Suiza",
    "admiteRadicacionSigd": false,
    "observacion": "Alquiler o servicio de explotación comercial de infraestructura; no genera CUT ni expediente SIGD.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p2-fila-03",
    "pagina": 2,
    "referenciaFila": "p2-fila-03",
    "codigo": "p2-fila-03",
    "denominacion": "Alquiler de Aulas - Diario",
    "categoria": "SERVICIO_COMERCIAL",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 150.00",
    "requisitos": [
      "Solicitud dirigida al Director del IESTP SUIZA",
      "Proveído a la Unidad Administrativa para su Autorización",
      "Pago en tesorería.",
      "Emisión de B/V."
    ],
    "plazo": "Según disponibilidad de infraestructura y cronograma de reserva",
    "unidadResponsable": "Centro de Producción de Bienes y Servicios / Tesorería",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Estatuto Institucional IESTP Suiza",
    "admiteRadicacionSigd": false,
    "observacion": "Alquiler o servicio de explotación comercial de infraestructura; no genera CUT ni expediente SIGD.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p2-fila-04",
    "pagina": 2,
    "referenciaFila": "p2-fila-04",
    "codigo": "p2-fila-04",
    "denominacion": "Alquiler de la Cancha de Fútbol - Diario",
    "categoria": "SERVICIO_COMERCIAL",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 100.00",
    "requisitos": [
      "Solicitud dirigida al Director del IESTP SUIZA",
      "Proveído a la Unidad Administrativa para su Autorización",
      "Pago en tesorería.",
      "Emisión de B/V."
    ],
    "plazo": "Según disponibilidad de infraestructura y cronograma de reserva",
    "unidadResponsable": "Centro de Producción de Bienes y Servicios / Tesorería",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Estatuto Institucional IESTP Suiza",
    "admiteRadicacionSigd": false,
    "observacion": "Alquiler o servicio de explotación comercial de infraestructura; no genera CUT ni expediente SIGD.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p2-fila-05",
    "pagina": 2,
    "referenciaFila": "p2-fila-05",
    "codigo": "p2-fila-05",
    "denominacion": "Alquiler de Ambientes para servicio de alimentación.",
    "categoria": "SERVICIO_COMERCIAL",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 1,000.00",
    "requisitos": [
      "Solicitud dirigida al Director del IESTP SUIZA.",
      "Suscripción del Contrato.",
      "Pago en tesorería de acuerdo al Contrato",
      "Precios de acuerdo al Contrato S/. 50.00 a S/. 350.00"
    ],
    "plazo": "Según disponibilidad de infraestructura y cronograma de reserva",
    "unidadResponsable": "Centro de Producción de Bienes y Servicios / Tesorería",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Estatuto Institucional IESTP Suiza",
    "admiteRadicacionSigd": false,
    "observacion": "Alquiler o servicio de explotación comercial de infraestructura; no genera CUT ni expediente SIGD.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p2-fila-06",
    "pagina": 2,
    "referenciaFila": "p2-fila-06",
    "codigo": "p2-fila-06",
    "denominacion": "Alquiler del Auditorio.",
    "categoria": "SERVICIO_COMERCIAL",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 300.00",
    "requisitos": [
      "Solicitud dirigida al Director del IESTP SUIZA.",
      "Proveído a la Unidad Administrativa para su Autorización",
      "Pago en tesorería.",
      "Emisión de B/V."
    ],
    "plazo": "Según disponibilidad de infraestructura y cronograma de reserva",
    "unidadResponsable": "Centro de Producción de Bienes y Servicios / Tesorería",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Estatuto Institucional IESTP Suiza",
    "admiteRadicacionSigd": false,
    "observacion": "Alquiler o servicio de explotación comercial de infraestructura; no genera CUT ni expediente SIGD.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p2-fila-07",
    "pagina": 2,
    "referenciaFila": "p2-fila-07",
    "codigo": "p2-fila-07",
    "denominacion": "Alquiler de Laboratorio de Cómputo a Terceros",
    "categoria": "SERVICIO_COMERCIAL",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 20.00",
    "requisitos": [
      "Por hora y por cada equipo"
    ],
    "plazo": "Según disponibilidad de infraestructura y cronograma de reserva",
    "unidadResponsable": "Centro de Producción de Bienes y Servicios / Tesorería",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Estatuto Institucional IESTP Suiza",
    "admiteRadicacionSigd": false,
    "observacion": "Alquiler o servicio de explotación comercial de infraestructura; no genera CUT ni expediente SIGD.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p2-fila-08",
    "pagina": 2,
    "referenciaFila": "p2-fila-08",
    "codigo": "p2-fila-08",
    "denominacion": "Venta Ambulatoria Diaria",
    "categoria": "SERVICIO_COMERCIAL",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 20.00",
    "requisitos": [
      "Solicitud dirigida al Director.",
      "Proveído a la Unidad Administrativa para su Autorización.",
      "Pago en Tesorería.",
      "Emisión de la B/V"
    ],
    "plazo": "Según disponibilidad de infraestructura y cronograma de reserva",
    "unidadResponsable": "Centro de Producción de Bienes y Servicios / Tesorería",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Estatuto Institucional IESTP Suiza",
    "admiteRadicacionSigd": false,
    "observacion": "Alquiler o servicio de explotación comercial de infraestructura; no genera CUT ni expediente SIGD.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p2-fila-09",
    "pagina": 2,
    "referenciaFila": "p2-fila-09",
    "codigo": "p2-fila-09",
    "denominacion": "Venta de Mangos (Ciento)",
    "categoria": "BIEN_PRODUCTIVO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 15.00",
    "requisitos": [
      "Pago en Tesorería",
      "Entrega del bien en proyectos",
      "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.",
      "Supervisión de salida del bien-vigilancia",
      "Emisión de Boleta de Venta"
    ],
    "plazo": "Entrega inmediata según pesaje y stock disponible en granja/campo",
    "unidadResponsable": "Centro de Producción Agropecuaria / Caja",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Actividades Productivas",
    "admiteRadicacionSigd": false,
    "observacion": "Venta de productos agrícolas o pecuarios del centro de producción; pago directo en caja, no genera expediente.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p2-fila-10",
    "pagina": 2,
    "referenciaFila": "p2-fila-10",
    "codigo": "p2-fila-10",
    "denominacion": "Venta de Patos BB",
    "categoria": "BIEN_PRODUCTIVO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 15.00",
    "requisitos": [
      "Pago en Tesorería",
      "Entrega del bien en Proyectos",
      "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.",
      "Supervisión de salida del bien-vigilancia",
      "Emisión de Boleta de Venta"
    ],
    "plazo": "Entrega inmediata según pesaje y stock disponible en granja/campo",
    "unidadResponsable": "Centro de Producción Agropecuaria / Caja",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Actividades Productivas",
    "admiteRadicacionSigd": false,
    "observacion": "Venta de productos agrícolas o pecuarios del centro de producción; pago directo en caja, no genera expediente.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p3-fila-01",
    "pagina": 3,
    "referenciaFila": "p3-fila-01",
    "codigo": "p3-fila-01",
    "denominacion": "Venta de Patos Pichones, de acuerdo al Tamaño.",
    "categoria": "BIEN_PRODUCTIVO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 30.00 S/ 40.00",
    "requisitos": [
      "Pago en Tesorería",
      "Entrega del bien en Proyectos",
      "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.",
      "Supervisión de salida del bien-vigilancia",
      "Emisión de Boleta de Venta",
      "PICHONES HEMBRAS: S/ 30.00",
      "PICHONES MACHOS: S/ 40.00"
    ],
    "plazo": "Entrega inmediata según pesaje y stock disponible en granja/campo",
    "unidadResponsable": "Centro de Producción Agropecuaria / Caja",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Actividades Productivas",
    "admiteRadicacionSigd": false,
    "observacion": "Venta de productos agrícolas o pecuarios del centro de producción; pago directo en caja, no genera expediente.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p3-fila-02",
    "pagina": 3,
    "referenciaFila": "p3-fila-02",
    "codigo": "p3-fila-02",
    "denominacion": "Venta de Pati Pollos",
    "categoria": "BIEN_PRODUCTIVO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 15.00",
    "requisitos": [
      "Pago en Tesorería",
      "Entrega del bien en Proyectos",
      "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.",
      "Supervisión de salida del bien-vigilancia",
      "Emisión de Boleta de Venta"
    ],
    "plazo": "Entrega inmediata según pesaje y stock disponible en granja/campo",
    "unidadResponsable": "Centro de Producción Agropecuaria / Caja",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Actividades Productivas",
    "admiteRadicacionSigd": false,
    "observacion": "Venta de productos agrícolas o pecuarios del centro de producción; pago directo en caja, no genera expediente.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p3-fila-03",
    "pagina": 3,
    "referenciaFila": "p3-fila-03",
    "codigo": "p3-fila-03",
    "denominacion": "Venta de Patos adultos hembras",
    "categoria": "BIEN_PRODUCTIVO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 40.00",
    "requisitos": [
      "Pago en Tesorería",
      "Entrega del bien en Proyectos",
      "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.",
      "Supervisión de salida del bien-vigilancia",
      "Emisión de Boleta de Venta"
    ],
    "plazo": "Entrega inmediata según pesaje y stock disponible en granja/campo",
    "unidadResponsable": "Centro de Producción Agropecuaria / Caja",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Actividades Productivas",
    "admiteRadicacionSigd": false,
    "observacion": "Venta de productos agrícolas o pecuarios del centro de producción; pago directo en caja, no genera expediente.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p3-fila-04",
    "pagina": 3,
    "referenciaFila": "p3-fila-04",
    "codigo": "p3-fila-04",
    "denominacion": "Venta de Patos adultos machos",
    "categoria": "BIEN_PRODUCTIVO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 50.00 S/ 55.00",
    "requisitos": [
      "Pago en Tesorería",
      "Entrega del bien en Proyectos",
      "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.",
      "Supervisión de salida del bien-vigilancia",
      "Emisión de Boleta de Venta"
    ],
    "plazo": "Entrega inmediata según pesaje y stock disponible en granja/campo",
    "unidadResponsable": "Centro de Producción Agropecuaria / Caja",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Actividades Productivas",
    "admiteRadicacionSigd": false,
    "observacion": "Venta de productos agrícolas o pecuarios del centro de producción; pago directo en caja, no genera expediente.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p3-fila-05",
    "pagina": 3,
    "referenciaFila": "p3-fila-05",
    "codigo": "p3-fila-05",
    "denominacion": "Venta de Porcino para consumo Kg",
    "categoria": "BIEN_PRODUCTIVO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 20.00",
    "requisitos": [
      "Pago en Tesorería",
      "Entrega del bien en Proyectos",
      "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.",
      "Supervisión de salida del bien-vigilancia",
      "Emisión de Boleta de Venta"
    ],
    "plazo": "Entrega inmediata según pesaje y stock disponible en granja/campo",
    "unidadResponsable": "Centro de Producción Agropecuaria / Caja",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Actividades Productivas",
    "admiteRadicacionSigd": false,
    "observacion": "Venta de productos agrícolas o pecuarios del centro de producción; pago directo en caja, no genera expediente.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p3-fila-06",
    "pagina": 3,
    "referenciaFila": "p3-fila-06",
    "codigo": "p3-fila-06",
    "denominacion": "Venta de Porcino en Pie Kg",
    "categoria": "BIEN_PRODUCTIVO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 25.00 S/ 15.00",
    "requisitos": [
      "Emisión de B/V.",
      "REPRODUCTOR: S/ 25.00",
      "CARNE: S/ 15.00"
    ],
    "plazo": "Entrega inmediata según pesaje y stock disponible en granja/campo",
    "unidadResponsable": "Centro de Producción Agropecuaria / Caja",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Actividades Productivas",
    "admiteRadicacionSigd": false,
    "observacion": "Venta de productos agrícolas o pecuarios del centro de producción; pago directo en caja, no genera expediente.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p3-fila-07",
    "pagina": 3,
    "referenciaFila": "p3-fila-07",
    "codigo": "p3-fila-07",
    "denominacion": "Venta de Ganado Vacuno en pie Kg; EN",
    "categoria": "BIEN_PRODUCTIVO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 20.00 S/ 15.00",
    "requisitos": [
      "Pago en Tesorería",
      "Entrega del bien en Proyectos",
      "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivos y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA.",
      "Supervisión de salida del bien-vigilancia",
      "Emisión de B/V.",
      "CARCASA (SIN PATA, SIN CABEZA) KG: S/ 20.00",
      "EN PIE: S/ 15.00"
    ],
    "plazo": "Entrega inmediata según pesaje y stock disponible en granja/campo",
    "unidadResponsable": "Centro de Producción Agropecuaria / Caja",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Actividades Productivas",
    "admiteRadicacionSigd": false,
    "observacion": "Venta de productos agrícolas o pecuarios del centro de producción; pago directo en caja, no genera expediente.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p3-fila-08",
    "pagina": 3,
    "referenciaFila": "p3-fila-08",
    "codigo": "p3-fila-08",
    "denominacion": "Servicio de Empadre",
    "categoria": "SERVICIO_COMERCIAL",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 50.00",
    "requisitos": [
      "Ejecución del Servicio",
      "Pago en Tesorería",
      "Emisión de B/V."
    ],
    "plazo": "Según disponibilidad de infraestructura y cronograma de reserva",
    "unidadResponsable": "Centro de Producción de Bienes y Servicios / Tesorería",
    "baseLegal": "Ley N.° 28693 (Tesorería) • Estatuto Institucional IESTP Suiza",
    "admiteRadicacionSigd": false,
    "observacion": "Alquiler o servicio de explotación comercial de infraestructura; no genera CUT ni expediente SIGD.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p4-fila-01",
    "pagina": 4,
    "referenciaFila": "p4-fila-01",
    "codigo": "p4-fila-01",
    "denominacion": "FUT",
    "categoria": "OTRO_NO_RADICABLE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 4.00",
    "requisitos": [
      "Pago del Derecho en Tesorería 3 FUT",
      "Comprobante de Pago 0.07 % UIT Vigente"
    ],
    "plazo": "Inmediato con comprobante de pago",
    "unidadResponsable": "Tesorería / Caja / Almacén",
    "baseLegal": "Ley N.° 28693 (Tesorería)",
    "admiteRadicacionSigd": false,
    "observacion": "Pago de especie valorada, accesorio protocolar o penalidad bibliotecaria; no constituye trámite radicable.",
    "clasificacion": "PAGO_DERECHO"
  },
  {
    "id": "p4-fila-02",
    "pagina": 4,
    "referenciaFila": "p4-fila-02",
    "codigo": "p4-fila-02",
    "denominacion": "Constancia de No Adeudar (Para fines de Titulación)",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 16.50",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.30 % UIT Vigente"
    ],
    "plazo": "Hasta 7 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p4-fila-03",
    "pagina": 4,
    "referenciaFila": "p4-fila-03",
    "codigo": "p4-fila-03",
    "denominacion": "Trabajo de Aplicación Profesional (Examen Teórico Práctico)",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 57.00",
    "requisitos": [
      "Pago del Derecho en Tesorería, 1.03 % UIT Vigente"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p4-fila-04",
    "pagina": 4,
    "referenciaFila": "p4-fila-04",
    "codigo": "p4-fila-04",
    "denominacion": "Examen de Suficiencia Profesional (Examen Teórico Práctico)",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 57.00",
    "requisitos": [
      "Pago del Derecho en Tesorería, 1.03 % UIT Vigente"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p4-fila-05",
    "pagina": 4,
    "referenciaFila": "p4-fila-05",
    "codigo": "p4-fila-05",
    "denominacion": "Expedición de Título",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 105.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 1.90 % UIT Vigente"
    ],
    "plazo": "Hasta 30 días hábiles",
    "unidadResponsable": "Secretaría Académica / Dirección",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p4-fila-06",
    "pagina": 4,
    "referenciaFila": "p4-fila-06",
    "codigo": "p4-fila-06",
    "denominacion": "Certificado de Estudios Superiores (6 Semestres)",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 124.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 2.24 % UIT Vigente"
    ],
    "plazo": "Hasta 15 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p4-fila-07",
    "pagina": 4,
    "referenciaFila": "p4-fila-07",
    "codigo": "p4-fila-07",
    "denominacion": "Visación de Certificado de Estudios Superiores",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 16.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.29 % UIT Vigente"
    ],
    "plazo": "Hasta 7 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p4-fila-08",
    "pagina": 4,
    "referenciaFila": "p4-fila-08",
    "codigo": "p4-fila-08",
    "denominacion": "Caligrafiado de Título",
    "categoria": "OTRO_NO_RADICABLE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 26.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.47 % UIT Vigente"
    ],
    "plazo": "Inmediato con comprobante de pago",
    "unidadResponsable": "Tesorería / Caja / Almacén",
    "baseLegal": "Ley N.° 28693 (Tesorería)",
    "admiteRadicacionSigd": false,
    "observacion": "Pago de especie valorada, accesorio protocolar o penalidad bibliotecaria; no constituye trámite radicable.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p4-fila-09",
    "pagina": 4,
    "referenciaFila": "p4-fila-09",
    "codigo": "p4-fila-09",
    "denominacion": "Derecho de Formato de Título",
    "categoria": "OTRO_NO_RADICABLE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 42.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.75 % UIT Vigente"
    ],
    "plazo": "Inmediato con comprobante de pago",
    "unidadResponsable": "Tesorería / Caja / Almacén",
    "baseLegal": "Ley N.° 28693 (Tesorería)",
    "admiteRadicacionSigd": false,
    "observacion": "Pago de especie valorada, accesorio protocolar o penalidad bibliotecaria; no constituye trámite radicable.",
    "clasificacion": "PAGO_DERECHO"
  },
  {
    "id": "p4-fila-10",
    "pagina": 4,
    "referenciaFila": "p4-fila-10",
    "codigo": "p4-fila-10",
    "denominacion": "Inscripción de Título",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 120.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "plazo": "Hasta 15 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p4-fila-11",
    "pagina": 4,
    "referenciaFila": "p4-fila-11",
    "codigo": "p4-fila-11",
    "denominacion": "Medallas",
    "categoria": "OTRO_NO_RADICABLE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 100.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "plazo": "Inmediato con comprobante de pago",
    "unidadResponsable": "Tesorería / Caja / Almacén",
    "baseLegal": "Ley N.° 28693 (Tesorería)",
    "admiteRadicacionSigd": false,
    "observacion": "Pago de especie valorada, accesorio protocolar o penalidad bibliotecaria; no constituye trámite radicable.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p4-fila-12",
    "pagina": 4,
    "referenciaFila": "p4-fila-12",
    "codigo": "p4-fila-12",
    "denominacion": "Protector de Título",
    "categoria": "OTRO_NO_RADICABLE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 100.00",
    "requisitos": [
      "Pago del Derecho en Tesorería"
    ],
    "plazo": "Inmediato con comprobante de pago",
    "unidadResponsable": "Tesorería / Caja / Almacén",
    "baseLegal": "Ley N.° 28693 (Tesorería)",
    "admiteRadicacionSigd": false,
    "observacion": "Pago de especie valorada, accesorio protocolar o penalidad bibliotecaria; no constituye trámite radicable.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p4-fila-13",
    "pagina": 4,
    "referenciaFila": "p4-fila-13",
    "codigo": "p4-fila-13",
    "denominacion": "Colación",
    "categoria": "ACTUACION_INTERNA",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 100.00",
    "requisitos": [
      "Pago del Derecho en Tesorería"
    ],
    "plazo": "Conforme a calendario académico institucional",
    "unidadResponsable": "Secretaría Académica / Dirección",
    "baseLegal": "Ley N.° 30512 • Reglamento Institucional",
    "admiteRadicacionSigd": false,
    "observacion": "Actuación de control pedagógico interno o ceremonia de colación; no corresponde a radicación externa.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p4-fila-14",
    "pagina": 4,
    "referenciaFila": "p4-fila-14",
    "codigo": "p4-fila-14",
    "denominacion": "Protector de Certificado Modular",
    "categoria": "OTRO_NO_RADICABLE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 50.00",
    "requisitos": [
      "Pago del Derecho en Tesorería"
    ],
    "plazo": "Inmediato con comprobante de pago",
    "unidadResponsable": "Tesorería / Caja / Almacén",
    "baseLegal": "Ley N.° 28693 (Tesorería)",
    "admiteRadicacionSigd": false,
    "observacion": "Pago de especie valorada, accesorio protocolar o penalidad bibliotecaria; no constituye trámite radicable.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p4-fila-15",
    "pagina": 4,
    "referenciaFila": "p4-fila-15",
    "codigo": "p4-fila-15",
    "denominacion": "Modificación de Datos del Título",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 269.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 4.88 % UIT Vigente"
    ],
    "plazo": "Hasta 30 días hábiles",
    "unidadResponsable": "Secretaría Académica / Dirección",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p4-fila-16",
    "pagina": 4,
    "referenciaFila": "p4-fila-16",
    "codigo": "p4-fila-16",
    "denominacion": "Derecho de duplicado de Título.",
    "categoria": "PROCEDIMIENTO_PENDIENTE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 309.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 5.61 % UIT Vigente"
    ],
    "plazo": "Pendiente de homologación (hasta 30 días)",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444",
    "admiteRadicacionSigd": false,
    "observacion": "Procedimiento administrativo/documental identificado en TUPA; pendiente de formalización reglamentaria para radicación.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-01",
    "pagina": 5,
    "referenciaFila": "p5-fila-01",
    "codigo": "p5-fila-01",
    "denominacion": "Matrículas",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 200.00",
    "requisitos": [
      "Ficha de matrícula",
      "Pago de adeudos en Tesorería",
      "Pago de derecho de matrícula en tesorería"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p5-fila-02",
    "pagina": 5,
    "referenciaFila": "p5-fila-02",
    "codigo": "p5-fila-02",
    "denominacion": "ADMISIÓN 2026",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 250.00",
    "requisitos": [
      "Pago en el Área de Tesorería"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p5-fila-03",
    "pagina": 5,
    "referenciaFila": "p5-fila-03",
    "codigo": "p5-fila-03",
    "denominacion": "Guías del postulante",
    "categoria": "OTRO_NO_RADICABLE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 50.00",
    "requisitos": [
      "Pago en el Área de Tesorería"
    ],
    "plazo": "Inmediato con comprobante de pago",
    "unidadResponsable": "Tesorería / Caja / Almacén",
    "baseLegal": "Ley N.° 28693 (Tesorería)",
    "admiteRadicacionSigd": false,
    "observacion": "Pago de especie valorada, accesorio protocolar o penalidad bibliotecaria; no constituye trámite radicable.",
    "clasificacion": "BIEN_SERVICIO"
  },
  {
    "id": "p5-fila-04",
    "pagina": 5,
    "referenciaFila": "p5-fila-04",
    "codigo": "p5-fila-04",
    "denominacion": "Ingreso ADMISIÓN 2026 - Titulados",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 500.00",
    "requisitos": [
      "Pago en el Área de Tesorería"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p5-fila-05",
    "pagina": 5,
    "referenciaFila": "p5-fila-05",
    "codigo": "p5-fila-05",
    "denominacion": "Derecho de Reincorporación (Reingreso)",
    "categoria": "PROCEDIMIENTO_PENDIENTE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 300.00",
    "requisitos": [
      "Pago en el Área de Tesorería"
    ],
    "plazo": "Pendiente de homologación (hasta 30 días)",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444",
    "admiteRadicacionSigd": false,
    "observacion": "Procedimiento administrativo/documental identificado en TUPA; pendiente de formalización reglamentaria para radicación.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-06",
    "pagina": 5,
    "referenciaFila": "p5-fila-06",
    "codigo": "p5-fila-06",
    "denominacion": "Constancia de Egresado",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 31.00",
    "requisitos": [
      "Pago del Derecho en Tesorería"
    ],
    "plazo": "Hasta 7 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-07",
    "pagina": 5,
    "referenciaFila": "p5-fila-07",
    "codigo": "p5-fila-07",
    "denominacion": "Certificado de Bachillerato",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 42.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.75 % UIT Vigente"
    ],
    "plazo": "Hasta 15 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-08",
    "pagina": 5,
    "referenciaFila": "p5-fila-08",
    "codigo": "p5-fila-08",
    "denominacion": "Constancias (Otros: de Título, estudios, de Matrícula)",
    "categoria": "PROCEDIMIENTO_PENDIENTE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 23.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.41 % UIT Vigente"
    ],
    "plazo": "Pendiente de homologación (hasta 30 días)",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444",
    "admiteRadicacionSigd": false,
    "observacion": "Procedimiento administrativo/documental identificado en TUPA; pendiente de formalización reglamentaria para radicación.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-09",
    "pagina": 5,
    "referenciaFila": "p5-fila-09",
    "codigo": "p5-fila-09",
    "denominacion": "Convalidación entre Planes de Estudios",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 46.50",
    "requisitos": [
      "Pago del Derecho en Tesorería, 0.84% UIT Vigente"
    ],
    "plazo": "Hasta 20 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-10",
    "pagina": 5,
    "referenciaFila": "p5-fila-10",
    "codigo": "p5-fila-10",
    "denominacion": "Convalidación por Unidades de Competencia",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 46.50",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.84 % UIT Vigente"
    ],
    "plazo": "Hasta 20 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-11",
    "pagina": 5,
    "referenciaFila": "p5-fila-11",
    "codigo": "p5-fila-11",
    "denominacion": "Devolución de Expediente",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 21.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.37 % UIT Vigente"
    ],
    "plazo": "Hasta 7 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-12",
    "pagina": 5,
    "referenciaFila": "p5-fila-12",
    "codigo": "p5-fila-12",
    "denominacion": "Evaluación Extraordinaria (A)",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 93.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 1.68 % UIT Vigente"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p5-fila-13",
    "pagina": 5,
    "referenciaFila": "p5-fila-13",
    "codigo": "p5-fila-13",
    "denominacion": "Evaluación Extraordinaria (RM 069)",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 70.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 1.27 % UIT Vigente"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p5-fila-14",
    "pagina": 5,
    "referenciaFila": "p5-fila-14",
    "codigo": "p5-fila-14",
    "denominacion": "Examen de Recuperación",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 70.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 1.27 % UIT Vigente"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p5-fila-15",
    "pagina": 5,
    "referenciaFila": "p5-fila-15",
    "codigo": "p5-fila-15",
    "denominacion": "Examen de Cargo",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 70.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 1.27 % UIT Vigente"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p5-fila-16",
    "pagina": 5,
    "referenciaFila": "p5-fila-16",
    "codigo": "p5-fila-16",
    "denominacion": "Repitencia de Unidad Didáctica",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 86.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 1.56 % UIT Vigente"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p5-fila-17",
    "pagina": 5,
    "referenciaFila": "p5-fila-17",
    "codigo": "p5-fila-17",
    "denominacion": "Repitencia de Semestre",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 80.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 1.45 % UIT Vigente"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p5-fila-18",
    "pagina": 5,
    "referenciaFila": "p5-fila-18",
    "codigo": "p5-fila-18",
    "denominacion": "Reserva de Matrícula - Ingresantes",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 66.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Resolución Directoral-Secretaría Académica",
      "Comprobante de Pago 1.20 % UIT Vigente"
    ],
    "plazo": "Hasta 7 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-19",
    "pagina": 5,
    "referenciaFila": "p5-fila-19",
    "codigo": "p5-fila-19",
    "denominacion": "Licencia de Estudios - Estudiantes Antiguos",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 66.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Resolución Directoral-Secretaría - Académica",
      "Comprobante de Pago 1.20 % UIT Vigente"
    ],
    "plazo": "Hasta 7 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-20",
    "pagina": 5,
    "referenciaFila": "p5-fila-20",
    "codigo": "p5-fila-20",
    "denominacion": "Traslado Interno",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 309.00",
    "requisitos": [
      "Vacante en la Carrera",
      "Resolución Directoral-Secretaría Académica",
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 5.61 % UIT Vigente"
    ],
    "plazo": "Hasta 15 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p5-fila-21",
    "pagina": 5,
    "referenciaFila": "p5-fila-21",
    "codigo": "p5-fila-21",
    "denominacion": "Traslado Externo",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 412.00",
    "requisitos": [
      "Solicitud en FUT dirigida al Director.",
      "Vacante en la Carrera",
      "Resolución Directoral-Secretaría - Académica",
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 7.48 % UIT Vigente"
    ],
    "plazo": "Hasta 20 días hábiles",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p6-fila-01",
    "pagina": 6,
    "referenciaFila": "p6-fila-01",
    "codigo": "p6-fila-01",
    "denominacion": "Demora Devolución Libro Biblioteca",
    "categoria": "OTRO_NO_RADICABLE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 10.00",
    "requisitos": [
      "Informe a la Unidad Administrativa de deudores de Libros",
      "Unidad Administrativa deriva a Tesorería",
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.19 % UIT Vigente (Costo por día)"
    ],
    "plazo": "Inmediato con comprobante de pago",
    "unidadResponsable": "Tesorería / Caja / Almacén",
    "baseLegal": "Ley N.° 28693 (Tesorería)",
    "admiteRadicacionSigd": false,
    "observacion": "Pago de especie valorada, accesorio protocolar o penalidad bibliotecaria; no constituye trámite radicable.",
    "clasificacion": "PAGO_DERECHO"
  },
  {
    "id": "p6-fila-02",
    "pagina": 6,
    "referenciaFila": "p6-fila-02",
    "codigo": "p6-fila-02",
    "denominacion": "Acceso a la Información Pública. S/. 10.00 por C/Hoja",
    "categoria": "PROCEDIMIENTO_PENDIENTE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 10.50",
    "requisitos": [
      "Solicitud dirigida a Dirección en FUT",
      "Pago del Derecho en Tesorería 0.19 % de la UIT Vigente"
    ],
    "plazo": "Hasta 10 días hábiles (Ley N.° 27806)",
    "unidadResponsable": "Responsable de Transparencia / Dirección",
    "baseLegal": "Ley N.° 27806 (Ley de Transparencia y Acceso a la Información Pública)",
    "admiteRadicacionSigd": false,
    "observacion": "Procedimiento reglado por ley especial; monto fijo en fuente (S/ 10.50) debe alinearse al costo real de reproducción.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p6-fila-03",
    "pagina": 6,
    "referenciaFila": "p6-fila-03",
    "codigo": "p6-fila-03",
    "denominacion": "Búsqueda y Duplicados de Boletas (C/U) Síllabus (C/U) Otros Trámites",
    "categoria": "PROCEDIMIENTO_PENDIENTE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 10.50",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Otros Trámites Administrativos",
      "Comprobante de Pago 0.19% UIT Vigente"
    ],
    "plazo": "Pendiente de homologación (hasta 30 días)",
    "unidadResponsable": "Secretaría Académica",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444",
    "admiteRadicacionSigd": false,
    "observacion": "Procedimiento administrativo/documental identificado en TUPA; pendiente de formalización reglamentaria para radicación.",
    "clasificacion": "REQUIERE_DECISION"
  },
  {
    "id": "p6-fila-04",
    "pagina": 6,
    "referenciaFila": "p6-fila-04",
    "codigo": "p6-fila-04",
    "denominacion": "Titulación de Otros Institutos Tecnológicos",
    "categoria": "PROCEDIMIENTO_APROBADO",
    "estadoValidacion": "APROBADO",
    "monto": "S/ 515.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 9.35 % UIT Vigente",
      "Resolución Directoral-Secretaría Académica"
    ],
    "plazo": "Hasta 30 días hábiles",
    "unidadResponsable": "Secretaría Académica / Dirección",
    "baseLegal": "Ley N.° 30512 • TUO Ley N.° 27444 (D.S. 006-2026-JUS) • Ley 28693",
    "admiteRadicacionSigd": true,
    "observacion": "Procedimiento administrativo homologado y aprobado para radicación con emisión de CUT en SIGD.",
    "clasificacion": "PROCEDIMIENTO_DOCUMENTARIO"
  },
  {
    "id": "p6-fila-05",
    "pagina": 6,
    "referenciaFila": "p6-fila-05",
    "codigo": "p6-fila-05",
    "denominacion": "Examen de Subsanación con Jurado",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 33.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 0.60 % UIT Vigente",
      "Resolución Directoral-Secretaría Académica"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p6-fila-06",
    "pagina": 6,
    "referenciaFila": "p6-fila-06",
    "codigo": "p6-fila-06",
    "denominacion": "Prueba de Suficiencia Académica",
    "categoria": "SERVICIO_ACADEMICO",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 105.00",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago 1.90 % UIT Vigente"
    ],
    "plazo": "Conforme a cronograma del periodo lectivo institucional",
    "unidadResponsable": "Secretaría Académica / Registro y Matrícula / Jefatura de Área",
    "baseLegal": "Ley N.° 30512 • R.M. 069-2015-MINEDU",
    "admiteRadicacionSigd": false,
    "observacion": "Servicio pedagógico, matrícula o examen de evaluación curricular; se gestiona en el sistema académico institucional.",
    "clasificacion": "SERVICIO_ACADEMICO"
  },
  {
    "id": "p6-fila-07",
    "pagina": 6,
    "referenciaFila": "p6-fila-07",
    "codigo": "p6-fila-07",
    "denominacion": "Carnets, Insignia y Distintivos",
    "categoria": "OTRO_NO_RADICABLE",
    "estadoValidacion": "PENDIENTE_VALIDACION",
    "monto": "S/ 50.00",
    "requisitos": [
      "Pago en el Área de Tesorería",
      "Emisión de la B/V",
      "0.93 % UIT Vigente"
    ],
    "plazo": "Inmediato con comprobante de pago",
    "unidadResponsable": "Tesorería / Caja / Almacén",
    "baseLegal": "Ley N.° 28693 (Tesorería)",
    "admiteRadicacionSigd": false,
    "observacion": "Pago de especie valorada, accesorio protocolar o penalidad bibliotecaria; no constituye trámite radicable.",
    "clasificacion": "BIEN_SERVICIO"
  }
];
