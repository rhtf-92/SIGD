export interface ProcedimientoTupa2026 {
  readonly codigo: string;
  readonly codigoInterno?: string;
  readonly codigoVisible?: string;
  readonly numeroVisible?: string;
  readonly nombre: string;
  readonly requisitos?: readonly string[];
  readonly derechoPago?: string;
  readonly dependencia?: string;
  readonly autoridad?: string;
  readonly tiempoMaximo?: string;
  readonly detalleTarifas?: readonly string[];
  readonly nota?: string;
}

export const PROCEDIMIENTOS_TUPA_2026: readonly ProcedimientoTupa2026[] = [
  {
    codigo: "SUZ26-001",
    codigoInterno: "SUZ26-001",
    codigoVisible: "SUZ26-001",
    numeroVisible: "001",
    nombre: "Prácticas Iniciales",
    derechoPago: "S/ 35.00 (0.64 % UIT vigente)",
    nota: "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago del derecho en Tesorería; control en el Área Académica; comprobante de pago."
  },
  {
    codigo: "SUZ26-002",
    codigoInterno: "SUZ26-002",
    codigoVisible: "SUZ26-002",
    numeroVisible: "002",
    nombre: "Prácticas Intermedias",
    derechoPago: "S/ 45.00 (0.82 % UIT vigente)",
    nota: "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago del derecho en Tesorería; control en el Área Académica; comprobante de pago."
  },
  {
    codigo: "SUZ26-003",
    codigoInterno: "SUZ26-003",
    codigoVisible: "SUZ26-003",
    numeroVisible: "003",
    nombre: "Prácticas Finales",
    derechoPago: "S/ 60.00 (1.09 % UIT vigente)",
    nota: "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago del derecho en Tesorería; control en el Área Académica; comprobante de pago."
  },
  {
    codigo: "SUZ26-004",
    codigoInterno: "SUZ26-004",
    codigoVisible: "SUZ26-004",
    numeroVisible: "004",
    nombre: "Experiencias Formativas en Situaciones Reales de Trabajo (I, II, III y IV) — por cada módulo",
    derechoPago: "S/ 46.50 (0.84 % UIT vigente)",
    nota: "Rubro: Proyectos Productivos — Venta de servicios. El PDF indica informe del Área Académica designando docentes responsables para las supervisiones, pago del derecho en Tesorería y comprobante de pago."
  },
  {
    codigo: "SUZ26-005",
    codigoInterno: "SUZ26-005",
    codigoVisible: "SUZ26-005",
    numeroVisible: "005",
    nombre: "Certificado Modular (I, II, III y IV) — por cada módulo",
    derechoPago: "S/ 100.00",
    nota: "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V."
  },
  {
    codigo: "SUZ26-006",
    codigoInterno: "SUZ26-006",
    codigoVisible: "SUZ26-006",
    numeroVisible: "006",
    nombre: "Certificado de Inglés",
    derechoPago: "S/ 100.00",
    nota: "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V."
  },
  {
    codigo: "SUZ26-007",
    codigoInterno: "SUZ26-007",
    codigoVisible: "SUZ26-007",
    numeroVisible: "007",
    nombre: "Centro de Idiomas — paquete básico de 4 meses para alumnos del IESTP Suiza",
    derechoPago: "S/ 300.00",
    detalleTarifas: ["Idiomas indicados: Inglés, Portugués y Japonés."],
    nota: "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V."
  },
  {
    codigo: "SUZ26-008",
    codigoInterno: "SUZ26-008",
    codigoVisible: "SUZ26-008",
    numeroVisible: "008",
    nombre: "Centro de Idiomas — paquete básico de 4 meses para alumnos externos",
    derechoPago: "S/ 350.00",
    detalleTarifas: ["Idiomas indicados: Inglés, Portugués y Japonés."],
    nota: "Rubro: Proyectos Productivos — Venta de servicios del IESTP Suiza. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V."
  },
  {
    codigo: "SUZ26-009",
    codigoInterno: "SUZ26-009",
    codigoVisible: "SUZ26-009",
    numeroVisible: "009",
    nombre: "Examen de Suficiencia de Inglés y/o Portugués",
    derechoPago: "S/ 300.00",
    nota: "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V."
  },
  {
    codigo: "SUZ26-010",
    codigoInterno: "SUZ26-010",
    codigoVisible: "SUZ26-010",
    numeroVisible: "010",
    nombre: "CEPRETEC 2026",
    derechoPago: "El cuadro muestra S/ 400.00, S/ 200.00, S/ 60.00, S/ 50.00, S/ 40.00 y S/ 10.00.",
    detalleTarifas: [
      "Matrícula: S/ 400.00.",
      "Matrícula último mes: S/ 200.00.",
      "Matrícula última semana: S/ 60.00.",
      "Solo simulacro (c/u): S/ 50.00.",
      "Venta de guías: S/ 40.00.",
      "Cambio de carrera (antes del I Simulacro): S/ 10.00."
    ],
    nota: "Rubro: Proyectos Productivos — Venta de servicios. El cuadro también muestra pago en Tesorería y emisión de B/V; la disposición visual de importes presenta ambigüedad, por lo que se conservan literalmente sin asignar una tarifa distinta a la indicada en cada línea."
  },
  {
    codigo: "SUZ26-011",
    codigoInterno: "SUZ26-011",
    codigoVisible: "SUZ26-011",
    numeroVisible: "011",
    nombre: "Alquiler del Galpón Agrícola para la Crianza de Pollos (por campaña)",
    derechoPago: "S/ 500.00.",
    detalleTarifas: ["Precio por campaña de acuerdo con el contrato."],
    nota: "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, suscripción del contrato y pago en Tesorería según contrato; no precisa cómo se relacionan el importe publicado y el precio contractual."
  },
  {
    codigo: "SUZ26-012",
    codigoInterno: "SUZ26-012",
    codigoVisible: "SUZ26-012",
    numeroVisible: "012",
    nombre: "Alquiler de Retroproyector",
    derechoPago: "S/ 100.00",
    nota: "Rubro: Venta de servicios. Descripción del PDF: Pago en Tesorería."
  },
  {
    codigo: "SUZ26-013",
    codigoInterno: "SUZ26-013",
    codigoVisible: "SUZ26-013",
    numeroVisible: "013",
    nombre: "Alquiler de Aulas — diario",
    derechoPago: "S/ 150.00",
    nota: "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, proveído a la Unidad Administrativa para autorización, pago en Tesorería y emisión de B/V."
  },
  {
    codigo: "SUZ26-014",
    codigoInterno: "SUZ26-014",
    codigoVisible: "SUZ26-014",
    numeroVisible: "014",
    nombre: "Alquiler de la Cancha de Fútbol — diario",
    derechoPago: "S/ 100.00",
    nota: "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, proveído a la Unidad Administrativa para autorización, pago en Tesorería y emisión de B/V."
  },
  {
    codigo: "SUZ26-015",
    codigoInterno: "SUZ26-015",
    codigoVisible: "SUZ26-015",
    numeroVisible: "015",
    nombre: "Alquiler de Ambientes para servicio de alimentación",
    derechoPago: "S/ 1,000.00.",
    detalleTarifas: ["El PDF también indica: precios de acuerdo con el contrato, S/ 50.00 a S/ 350.00."],
    nota: "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, suscripción del contrato y pago en Tesorería según contrato; no precisa la relación entre el monto y el rango contractual."
  },
  {
    codigo: "SUZ26-016",
    codigoInterno: "SUZ26-016",
    codigoVisible: "SUZ26-016",
    numeroVisible: "016",
    nombre: "Alquiler del Auditorio",
    derechoPago: "S/ 300.00",
    nota: "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, proveído a la Unidad Administrativa para autorización, pago en Tesorería y emisión de B/V."
  },
  {
    codigo: "SUZ26-017",
    codigoInterno: "SUZ26-017",
    codigoVisible: "SUZ26-017",
    numeroVisible: "017",
    nombre: "Alquiler de Laboratorio de Cómputo a Terceros",
    derechoPago: "S/ 20.00",
    detalleTarifas: ["Unidad/modalidad indicada: por hora y por cada equipo."],
    nota: "Rubro: Venta de servicios."
  },
  {
    codigo: "SUZ26-018",
    codigoInterno: "SUZ26-018",
    codigoVisible: "SUZ26-018",
    numeroVisible: "018",
    nombre: "Venta Ambulatoria Diaria",
    derechoPago: "S/ 20.00",
    nota: "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director, proveído a la Unidad Administrativa para autorización, pago en Tesorería y emisión de B/V."
  },
  {
    codigo: "SUZ26-019",
    codigoInterno: "SUZ26-019",
    codigoVisible: "SUZ26-019",
    numeroVisible: "019",
    nombre: "Venta de Mangos",
    derechoPago: "S/ 15.00",
    detalleTarifas: ["Unidad de cobro indicada: ciento."],
    nota: "Rubro: Venta de bienes. El PDF indica que los precios están vigentes para 2024 y se basan en precios de mercado; incluye pago en Tesorería, entrega en proyectos, papeleta de autorización de salida firmada por las unidades indicadas en el documento, supervisión de salida y emisión de Boleta de Venta. La vigencia 2024 requiere aclaración para el TUPA 2026."
  },
  {
    codigo: "SUZ26-020",
    codigoInterno: "SUZ26-020",
    codigoVisible: "SUZ26-020",
    numeroVisible: "020",
    nombre: "Venta de Patos BB",
    derechoPago: "S/ 15.00",
    nota: "Rubro: Venta de bienes. El PDF indica que los precios están vigentes para 2024 y se basan en precios de mercado; incluye pago en Tesorería, entrega en proyectos, papeleta de autorización de salida firmada por las unidades indicadas en el documento, supervisión de salida y emisión de Boleta de Venta."
  },
  {
    codigo: "SUZ26-021",
    codigoInterno: "SUZ26-021",
    codigoVisible: "SUZ26-021",
    numeroVisible: "021",
    nombre: "Venta de Patos Pichones",
    derechoPago: "S/ 30.00",
    detalleTarifas: [
      "El PDF indica pichones hembras: S/ 30.00.",
      "El PDF indica pichones machos: S/ 40.00."
    ],
    nota: "Rubro: Venta de bienes. El PDF indica precio de acuerdo al tamaño; incluye pago en Tesorería, entrega en proyectos, papeleta de autorización de salida, supervisión de salida y emisión de Boleta de Venta. Precios indicados como vigentes para 2024."
  },
  {
    codigo: "SUZ26-022",
    codigoInterno: "SUZ26-023",
    codigoVisible: "SUZ26-022",
    numeroVisible: "022",
    nombre: "Venta de Pati Pollos",
    derechoPago: "S/ 15.00",
    nota: "Rubro: Venta de servicios, según el encabezado de página; la ubicación del concepto bajo ese rubro puede requerir confirmación. El PDF indica pago en Tesorería, entrega del bien en proyectos, papeleta de autorización de salida, supervisión de salida y emisión de Boleta de Venta. Precios indicados como vigentes para 2024."
  },
  {
    codigo: "SUZ26-023",
    codigoInterno: "SUZ26-024",
    codigoVisible: "SUZ26-023",
    numeroVisible: "023",
    nombre: "Venta de Patos adultos hembras",
    derechoPago: "S/ 40.00",
    nota: "Rubro: Venta de servicios, según el encabezado de página; la ubicación del concepto bajo ese rubro puede requerir confirmación. El PDF indica pago en Tesorería, entrega del bien en proyectos, papeleta de autorización de salida, supervisión de salida y emisión de Boleta de Venta. Precios indicados como vigentes para 2024."
  },
  {
    codigo: "SUZ26-024",
    codigoInterno: "SUZ26-025",
    codigoVisible: "SUZ26-024",
    numeroVisible: "024",
    nombre: "Venta de Patos adultos machos",
    derechoPago: "El cuadro muestra S/ 50.00 y S/ 55.00.",
    detalleTarifas: ["Ambos importes aparecen asociados visualmente a la fila; no se determina su relación o variante."],
    nota: "Rubro: Venta de servicios, según el encabezado de página; la ubicación del concepto bajo ese rubro puede requerir confirmación. Incluye pago en Tesorería, entrega del bien, papeleta de autorización de salida, supervisión y emisión de Boleta de Venta. Precios indicados como vigentes para 2024."
  },
  {
    codigo: "SUZ26-025",
    codigoInterno: "SUZ26-026",
    codigoVisible: "SUZ26-025",
    numeroVisible: "025",
    nombre: "Venta de Porcino para consumo — kg",
    derechoPago: "S/ 20.00",
    detalleTarifas: ["Unidad de cobro indicada: kg."],
    nota: "Rubro de la página: Venta de servicios; el concepto es venta de un bien. El PDF indica pago en Tesorería, entrega en proyectos, papeleta de autorización de salida, supervisión y emisión de Boleta de Venta. Precios indicados como vigentes para 2024."
  },
  {
    codigo: "SUZ26-026",
    codigoInterno: "SUZ26-027",
    codigoVisible: "SUZ26-026",
    numeroVisible: "026",
    nombre: "Venta de Porcino en Pie — kg",
    derechoPago: "El cuadro muestra S/ 25.00 y S/ 15.00.",
    detalleTarifas: ["Reproductor: S/ 25.00.", "Carne: S/ 15.00.", "Unidad indicada: kg."],
    nota: "Rubro de la página: Venta de servicios; el concepto es venta de un bien. El cuadro también indica emisión de B/V; se conservan las variantes expresamente rotuladas."
  },
  {
    codigo: "SUZ26-027",
    codigoInterno: "SUZ26-028",
    codigoVisible: "SUZ26-027",
    numeroVisible: "027",
    nombre: "Venta de Ganado Vacuno",
    derechoPago: "El cuadro muestra S/ 20.00 y S/ 15.00.",
    detalleTarifas: ["Carcasa (sin pata, sin cabeza), kg: S/ 20.00.", "En pie: S/ 15.00."],
    nota: "Rubro de la página: Venta de servicios; el concepto es venta de un bien. El PDF también indica pago en Tesorería, entrega en proyectos, papeleta de autorización de salida, supervisión y emisión de B/V. Precios indicados como vigentes para 2024."
  },
  {
    codigo: "SUZ26-028",
    codigoInterno: "SUZ26-029",
    codigoVisible: "SUZ26-028",
    numeroVisible: "028",
    nombre: "Servicio de Empadre",
    derechoPago: "S/ 50.00",
    nota: "Rubro: Venta de servicios. Descripción del PDF: ejecución del servicio, pago en Tesorería y emisión de B/V."
  },
  {
    codigo: "SUZ26-029",
    codigoInterno: "SUZ26-030",
    codigoVisible: "SUZ26-029",
    numeroVisible: "029",
    nombre: "FUT — proceso de titulación",
    derechoPago: "S/ 4.00 (0.07 % UIT vigente)",
    detalleTarifas: ["El PDF indica pago del derecho en Tesorería; 3 FUT."],
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación."
  },
  {
    codigo: "SUZ26-030",
    codigoInterno: "SUZ26-031",
    codigoVisible: "SUZ26-030",
    numeroVisible: "030",
    nombre: "Constancia de No Adeudar — para fines de titulación",
    derechoPago: "S/ 16.50 (0.30 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-031",
    codigoInterno: "SUZ26-032",
    codigoVisible: "SUZ26-031",
    numeroVisible: "031",
    nombre: "Trabajo de Aplicación Profesional (Examen Teórico Práctico)",
    derechoPago: "S/ 57.00 (1.03 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería."
  },
  {
    codigo: "SUZ26-032",
    codigoInterno: "SUZ26-033",
    codigoVisible: "SUZ26-032",
    numeroVisible: "032",
    nombre: "Examen de Suficiencia Profesional (Examen Teórico Práctico)",
    derechoPago: "S/ 57.00 (1.03 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería."
  },
  {
    codigo: "SUZ26-033",
    codigoInterno: "SUZ26-034",
    codigoVisible: "SUZ26-033",
    numeroVisible: "033",
    nombre: "Expedición de Título",
    derechoPago: "S/ 105.00 (1.90 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-034",
    codigoInterno: "SUZ26-035",
    codigoVisible: "SUZ26-034",
    numeroVisible: "034",
    nombre: "Certificado de Estudios Superiores (6 semestres)",
    derechoPago: "S/ 124.00 (2.24 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-035",
    codigoInterno: "SUZ26-036",
    codigoVisible: "SUZ26-035",
    numeroVisible: "035",
    nombre: "Visación de Certificado de Estudios Superiores",
    derechoPago: "S/ 16.00 (0.29 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-036",
    codigoInterno: "SUZ26-037",
    codigoVisible: "SUZ26-036",
    numeroVisible: "036",
    nombre: "Caligrafiado de Título",
    derechoPago: "S/ 26.00 (0.47 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-037",
    codigoInterno: "SUZ26-038",
    codigoVisible: "SUZ26-037",
    numeroVisible: "037",
    nombre: "Derecho de Formato de Título",
    derechoPago: "S/ 42.00 (0.75 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-038",
    codigoInterno: "SUZ26-039",
    codigoVisible: "SUZ26-038",
    numeroVisible: "038",
    nombre: "Inscripción de Título",
    derechoPago: "S/ 120.00",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-039",
    codigoInterno: "SUZ26-040",
    codigoVisible: "SUZ26-039",
    numeroVisible: "039",
    nombre: "Medallas — proceso de titulación",
    derechoPago: "S/ 100.00",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-040",
    codigoInterno: "SUZ26-041",
    codigoVisible: "SUZ26-040",
    numeroVisible: "040",
    nombre: "Protector de Título",
    derechoPago: "S/ 100.00",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería."
  },
  {
    codigo: "SUZ26-041",
    codigoInterno: "SUZ26-042",
    codigoVisible: "SUZ26-041",
    numeroVisible: "041",
    nombre: "Colación",
    derechoPago: "S/ 100.00",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería."
  },
  {
    codigo: "SUZ26-042",
    codigoInterno: "SUZ26-043",
    codigoVisible: "SUZ26-042",
    numeroVisible: "042",
    nombre: "Protector de Certificado Modular",
    derechoPago: "S/ 50.00",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería."
  },
  {
    codigo: "SUZ26-043",
    codigoInterno: "SUZ26-044",
    codigoVisible: "SUZ26-043",
    numeroVisible: "043",
    nombre: "Modificación de Datos del Título",
    derechoPago: "S/ 269.00 (4.88 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-044",
    codigoInterno: "SUZ26-045",
    codigoVisible: "SUZ26-044",
    numeroVisible: "044",
    nombre: "Derecho de duplicado de Título",
    derechoPago: "S/ 309.00 (5.61 % UIT vigente)",
    nota: "Rubro: Ingresos Propios — Servicios Académicos; Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-045",
    codigoInterno: "SUZ26-046",
    codigoVisible: "SUZ26-045",
    numeroVisible: "045",
    nombre: "Matrículas",
    derechoPago: "S/ 200.00",
    detalleTarifas: ["El PDF enumera ficha de matrícula, pago de adeudos en Tesorería y pago del derecho de matrícula en Tesorería."],
    nota: "Rubro: Otros Servicios Académicos. El documento no desglosa el importe entre los conceptos enumerados."
  },
  {
    codigo: "SUZ26-046",
    codigoInterno: "SUZ26-047",
    codigoVisible: "SUZ26-046",
    numeroVisible: "046",
    nombre: "Admisión 2026",
    derechoPago: "S/ 250.00",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería."
  },
  {
    codigo: "SUZ26-047",
    codigoInterno: "SUZ26-048",
    codigoVisible: "SUZ26-047",
    numeroVisible: "047",
    nombre: "Guías del postulante",
    derechoPago: "S/ 50.00",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería."
  },
  {
    codigo: "SUZ26-048",
    codigoInterno: "SUZ26-049",
    codigoVisible: "SUZ26-048",
    numeroVisible: "048",
    nombre: "Ingreso Admisión 2026 — titulados",
    derechoPago: "S/ 500.00",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería."
  },
  {
    codigo: "SUZ26-049",
    codigoInterno: "SUZ26-050",
    codigoVisible: "SUZ26-049",
    numeroVisible: "049",
    nombre: "Derecho de Reincorporación (Reingreso)",
    derechoPago: "S/ 300.00",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería."
  },
  {
    codigo: "SUZ26-050",
    codigoInterno: "SUZ26-051",
    codigoVisible: "SUZ26-050",
    numeroVisible: "050",
    nombre: "Constancia de Egresado",
    derechoPago: "S/ 31.00",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería."
  },
  {
    codigo: "SUZ26-051",
    codigoInterno: "SUZ26-052",
    codigoVisible: "SUZ26-051",
    numeroVisible: "051",
    nombre: "Certificado de Bachillerato",
    derechoPago: "S/ 42.00 (0.75 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-052",
    codigoInterno: "SUZ26-053",
    codigoVisible: "SUZ26-052",
    numeroVisible: "052",
    nombre: "Constancias — de título, estudios o matrícula",
    derechoPago: "S/ 23.00 (0.41 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. El PDF enumera constancias de título, estudios y matrícula; pago del derecho en Tesorería y comprobante de pago."
  },
  {
    codigo: "SUZ26-053",
    codigoInterno: "SUZ26-054",
    codigoVisible: "SUZ26-053",
    numeroVisible: "053",
    nombre: "Convalidación entre Planes de Estudios",
    derechoPago: "S/ 46.50 (0.84 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería."
  },
  {
    codigo: "SUZ26-054",
    codigoInterno: "SUZ26-055",
    codigoVisible: "SUZ26-054",
    numeroVisible: "054",
    nombre: "Convalidación por Unidades de Competencia",
    derechoPago: "S/ 46.50 (0.84 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-055",
    codigoInterno: "SUZ26-056",
    codigoVisible: "SUZ26-055",
    numeroVisible: "055",
    nombre: "Devolución de Expediente",
    derechoPago: "S/ 21.00 (0.37 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-056",
    codigoInterno: "SUZ26-057",
    codigoVisible: "SUZ26-056",
    numeroVisible: "056",
    nombre: "Evaluación Extraordinaria (A)",
    derechoPago: "S/ 93.00 (1.68 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-057",
    codigoInterno: "SUZ26-058",
    codigoVisible: "SUZ26-057",
    numeroVisible: "057",
    nombre: "Evaluación Extraordinaria (RM 069)",
    derechoPago: "S/ 70.00 (1.27 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-058",
    codigoInterno: "SUZ26-059",
    codigoVisible: "SUZ26-058",
    numeroVisible: "058",
    nombre: "Examen de Recuperación",
    derechoPago: "S/ 70.00 (1.27 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-059",
    codigoInterno: "SUZ26-060",
    codigoVisible: "SUZ26-059",
    numeroVisible: "059",
    nombre: "Examen de Cargo",
    derechoPago: "S/ 70.00 (1.27 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-060",
    codigoInterno: "SUZ26-061",
    codigoVisible: "SUZ26-060",
    numeroVisible: "060",
    nombre: "Repitencia de Unidad Didáctica",
    derechoPago: "S/ 86.00 (1.56 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-061",
    codigoInterno: "SUZ26-062",
    codigoVisible: "SUZ26-061",
    numeroVisible: "061",
    nombre: "Repitencia de Semestre",
    derechoPago: "S/ 80.00 (1.45 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-062",
    codigoInterno: "SUZ26-063",
    codigoVisible: "SUZ26-062",
    numeroVisible: "062",
    nombre: "Reserva de Matrícula — ingresantes",
    derechoPago: "S/ 66.00 (1.20 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. El PDF indica Resolución Directoral — Secretaría Académica y pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-063",
    codigoInterno: "SUZ26-064",
    codigoVisible: "SUZ26-063",
    numeroVisible: "063",
    nombre: "Licencia de Estudios — estudiantes antiguos",
    derechoPago: "S/ 66.00 (1.20 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. El PDF indica Resolución Directoral — Secretaría Académica y pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-064",
    codigoInterno: "SUZ26-065",
    codigoVisible: "SUZ26-064",
    numeroVisible: "064",
    nombre: "Traslado Interno",
    derechoPago: "S/ 309.00 (5.61 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. El PDF indica vacante en la carrera, Resolución Directoral — Secretaría Académica, pago del derecho en Tesorería y comprobante de pago."
  },
  {
    codigo: "SUZ26-065",
    codigoInterno: "SUZ26-066",
    codigoVisible: "SUZ26-065",
    numeroVisible: "065",
    nombre: "Traslado Externo",
    derechoPago: "S/ 412.00 (7.48 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. El PDF indica solicitud en FUT dirigida al Director, vacante en la carrera, Resolución Directoral — Secretaría Académica, pago del derecho en Tesorería y comprobante de pago."
  },
  {
    codigo: "SUZ26-066",
    codigoInterno: "SUZ26-067",
    codigoVisible: "SUZ26-066",
    numeroVisible: "066",
    nombre: "Demora Devolución Libro Biblioteca",
    derechoPago: "S/ 10.00 (0.19 % UIT vigente; costo por día)",
    nota: "Rubro: Otros Servicios Académicos. El PDF indica informe a la Unidad Administrativa de deudores de libros; derivación a Tesorería; pago del derecho y comprobante."
  },
  {
    codigo: "SUZ26-067",
    codigoInterno: "SUZ26-068",
    codigoVisible: "SUZ26-067",
    numeroVisible: "067",
    nombre: "Acceso a la Información Pública",
    derechoPago: "El cuadro muestra S/ 10.50 y también S/ 10.00 por cada hoja; consigna 0.19 % UIT vigente.",
    detalleTarifas: ["Se conservan los importes y la referencia porcentual tal como aparecen, sin determinar su correspondencia."],
    nota: "Rubro: Otros Servicios Académicos. El PDF indica solicitud dirigida a Dirección en FUT y pago del derecho en Tesorería; la relación entre las tarifas requiere aclaración."
  },
  {
    codigo: "SUZ26-068",
    codigoInterno: "SUZ26-069",
    codigoVisible: "SUZ26-068",
    numeroVisible: "068",
    nombre: "Búsqueda y Duplicados de Boletas, Síllabus y Otros Trámites",
    derechoPago: "S/ 10.50 (0.19 % UIT vigente)",
    detalleTarifas: [
      "La fila agrupa Búsqueda y Duplicados de Boletas (c/u), Síllabus (c/u) y Otros Trámites; el PDF muestra una sola celda de monto: S/ 10.50 (0.19 % UIT vigente), no tres tarifas independientes."
    ],
    nota: "Rubro: Otros Servicios Académicos. El importe corresponde al grupo presentado en una misma fila en el PDF."
  },
  {
    codigo: "SUZ26-069",
    codigoInterno: "SUZ26-072",
    codigoVisible: "SUZ26-069",
    numeroVisible: "069",
    nombre: "Titulación de Otros Institutos Tecnológicos",
    derechoPago: "S/ 515.00 (9.35 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. El PDF indica pago del derecho en Tesorería, comprobante de pago y Resolución Directoral — Secretaría Académica."
  },
  {
    codigo: "SUZ26-070",
    codigoInterno: "SUZ26-073",
    codigoVisible: "SUZ26-070",
    numeroVisible: "070",
    nombre: "Examen de Subsanación con Jurado",
    derechoPago: "S/ 33.00 (0.60 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. El PDF indica pago del derecho en Tesorería, comprobante de pago y Resolución Directoral — Secretaría Académica."
  },
  {
    codigo: "SUZ26-071",
    codigoInterno: "SUZ26-074",
    codigoVisible: "SUZ26-071",
    numeroVisible: "071",
    nombre: "Prueba de Suficiencia Académica",
    derechoPago: "S/ 105.00 (1.90 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago."
  },
  {
    codigo: "SUZ26-072",
    codigoInterno: "SUZ26-075",
    codigoVisible: "SUZ26-072",
    numeroVisible: "072",
    nombre: "Carnets, Insignia y Distintivos",
    derechoPago: "S/ 50.00 (0.93 % UIT vigente)",
    nota: "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería; emisión de B/V."
  }
];
