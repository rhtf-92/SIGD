export interface ItemServicio {
  concepto: string;
  descripcion: string[];
  monto: number | string;
  observacionPrecio?: string;
}

export interface CategoriaServicios {
  rubro: string;
  subRubro?: string;
  baseLegal?: string;
  cuentaBancaria?: string;
  items: ItemServicio[];
}

export const INSTITUTO_INFO = {
  nombre: "INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO 'SUIZA'",
  subtitulo: "INSTITUTO DE EXCELENCIA",
  unidadOrganica: "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
  tupa: "TUPA 2026 - UIT VIGENTE S/. 5,500.00",
  lugarYFecha: "PUCALLPA, ENERO DE 2026"
};

export const LISTA_PROYECTOS_PRODUCTIVOS: CategoriaServicios[] = [
  {
    rubro: "GESTION DE RECURSOS PROPIOS Y ACTIVIDADES PRODUCTIVAS Y EMPRESARIALES DEL IESTP 'SUIZA'",
    subRubro: "RUBRO: VENTA DE SERVICIOS",
    baseLegal: "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    cuentaBancaria: "CTA. CTE.: 0512-039170 - BANCO DE LA NACIÓN",
    items: [
      {
        concepto: "Prácticas Iniciales",
        descripcion: [
          "Pago del Derecho en Tesorería",
          "Control en el Área Académica",
          "Comprobante de Pago 0.64 % UIT Vigente"
        ],
        monto: 35.00
      },
      {
        concepto: "Prácticas Intermedias",
        descripcion: [
          "Pago del Derecho en Tesorería",
          "Control en el Área Académica",
          "Comprobante de Pago 0.82 % UIT Vigente"
        ],
        monto: 45.00
      },
      {
        concepto: "Prácticas Finales",
        descripcion: [
          "Pago del Derecho en Tesorería",
          "Control en el Área Académica",
          "Comprobante de Pago 1.09 % UIT Vigente"
        ],
        monto: 60.00
      },
      {
        concepto: "Experiencias Formativas en Situaciones Reales de Trabajo (I, II, III y IV) Por cada Modulo",
        descripcion: [
          "Informe del Área Académica designando los Docentes responsables para las Supervisiones de Experiencias Formativas en Situaciones Reales de Trabajo",
          "Pago del Derecho en Tesorería",
          "Comprobante de Pago 0.84 % UIT Vigente"
        ],
        monto: 46.50
      },
      {
        concepto: "Certificado Modular (I, II, III y IV) Por cada Modulo",
        descripcion: [
          "Pago en el Área de Tesorería",
          "Emision de la B/V"
        ],
        monto: 100.00
      },
      {
        concepto: "Certificado de Inglés",
        descripcion: [
          "Pago en el Área de Tesorería",
          "Emision de la B/V"
        ],
        monto: 100.00
      },
      {
        concepto: "Centro de Idiomas: Inglés, Portugues, Japones Nivel Básico Paquete: 04 meses para Alumnos del IESTP 'SUIZA'",
        descripcion: [
          "Pago en el Área de Tesorería",
          "Emision de la B/V"
        ],
        monto: 300.00
      },
      {
        concepto: "Centro de Idiomas: Inglés, Portugues, Japones Nivel Básico Paquete: 04 meses para Alumnos Externos del IESTP 'SUIZA'",
        descripcion: [
          "Pago en el Área de Tesorería",
          "Emision de la B/V"
        ],
        monto: 350.00
      },
      {
        concepto: "Examen de Suficiencia de Inglés y/o Portugués",
        descripcion: [
          "Pago en el Área de Tesorería",
          "Emision de la B/V"
        ],
        monto: 300.00
      },
      {
        concepto: "CEPRETEC 2026 - Matricula",
        descripcion: [
          "Pago en el Área de Tesorería",
          "Emisión de la B/V"
        ],
        monto: 400.00
      },
      {
        concepto: "Matricula Ultimo mes",
        descripcion: ["Pago en el Área de Tesorería"],
        monto: 200.00
      },
      {
        concepto: "Matricula Ultima Semana",
        descripcion: ["Pago en el Área de Tesorería"],
        monto: 60.00
      },
      {
        concepto: "Solo Simulacro (C/U)",
        descripcion: ["Pago en el Área de Tesorería"],
        monto: 50.00
      },
      {
        concepto: "Venta de Guías",
        descripcion: ["Pago en el Área de Tesorería"],
        monto: 40.00
      },
      {
        concepto: "Cambio de Carrera: (Antes del I Simulacro)",
        descripcion: ["Pago en el Área de Tesorería"],
        monto: 10.00
      }
    ]
  },
  {
    rubro: "VENTA DE BIENES Y OTROS SERVICIOS",
    subRubro: "VENTA DE SERVICIOS - Servicios de Maquilcentro de acuerdo al mercado: CATERPILLAR Y PETROLEROS",
    baseLegal: "D.S Nº 028-2007-ED",
    items: [
      {
        concepto: "Alquier del Galpon Agrícola Para la Crianza de Pollos (Por Campaña)",
        descripcion: [
          "Solicitud dirigida al Director del IESTP SUIZA",
          "Suscripción del Contrato",
          "Pago en tesorería de acuerdo al Contrato",
          "Precio por Campaña"
        ],
        monto: 500.00
      },
      {
        concepto: "Alquiler de Retroproyector",
        descripcion: ["Pago en tesorería"],
        monto: 100.00
      },
      {
        concepto: "Alquiler de Aulas-Diario",

        descripcion: [
          "Solicitud dirigida al Director del IESTP SUIZA",
          "Proveído a la Unidad Administrativa para su Autorización",
          "Pago en tesorería",
          "Emisión de B/V"
        ],
        monto: 150.00
      },
      {
        concepto: "Alquiler de la Cancha de Futbol-Diario",
        descripcion: [
          "Solicitud dirigida al Director del IESTP SUIZA",
          "Proveído a la Unidad Administrativa para su Autorización",
          "Pago en tesorería",
          "Emisión de B/V"
        ],
        monto: 100.00
      },
      {
        concepto: "Alquiler de Ambientes para servicio de alimentación",
        descripcion: [
          "Solicitud dirigida al Director del IESTP SUIZA",
          "Suscripción del Contrato",
          "Pago en tesorería de acuerdo al Contrato",
          "Precios de acuerdo al Contrato S/. 50.00 a S/. 350.00"
        ],
        monto: 1000.00
      },
      {
        concepto: "Alquiler del Auditorio",
        descripcion: [
          "Solicitud dirigida al Director del IESTP SUIZA",
          "Proveído a la Unidad Administrativa para su Autorización",
          "Pago en tesorería",
          "Emisión de B/V"
        ],
        monto: 300.00
      },
      {
        concepto: "Alquiler de Laboratorio de Cómputo a Terceros",
        descripcion: ["Por hora y por cada equipo"],
        monto: 20.00
      },
      {
        concepto: "Venta Ambulatoria Diaria",
        descripcion: [
          "Solicitud dirigida al Director",
          "Proveído a la Unidad Administrativa para su Autorización",
          "Pago en Tesorería",
          "Emisión de la B/V"
        ],
        monto: 20.00
      }
    ]
  },
  {
    rubro: "VENTA DE BIENES",
    subRubro: "Precios Vigentes para el año 2024, tomando como base precios del mercado.",
    baseLegal: "D.S Nº 028-2007-ED",
    items: [
      {
        concepto: "Venta de Mangos (Ciento)",
        descripcion: [
          "Pago en Tesorería",
          "Entrega del bien en proyectos",
          "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivis y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA",
          "Supervisión de salida del bien-vigilancia",
          "Emisión de Boleta de Venta"
        ],
        monto: 15.00
      },
      {
        concepto: "Venta de Patos BB",
        descripcion: [
          "Pago en Tesorería",
          "Entrega del bien en Proyectos",
          "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivis y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA",
          "Supervisión de salida del bien-vigilancia",
          "Emisión de Boleta de Venta"
        ],
        monto: 15.00
      },
      {
        concepto: "Venta de Patos Pichones, de acuerdo al Tamaño",
        descripcion: [
          "Pago en Tesorería",
          "Entrega del bien en Proyectos",
          "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivis y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA",
          "Supervisión de salida del bien-vigilancia",
          "Emisión de Boleta de Venta",
          "PICHONES HEMBRAS",
          "PICHONES MACHOS"
        ],
        monto: "S/. 30.00 (Hembras) / S/. 40.00 (Machos)"
      },
      {
        concepto: "Venta de Pati Pollos",
        descripcion: [
          "Pago en Tesorería",
          "Entrega del bien en Proyectos",
          "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivis y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA",
          "Supervisión de salida del bien-vigilancia",
          "Emisión de Boleta de Venta"
        ],
        monto: 15.00
      },
      {
        concepto: "Venta de Patos adultos hembras",
        descripcion: [
          "Pago en Tesorería",
          "Entrega del bien en Proyectos",
          "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivis y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA",
          "Supervisión de salida del bien-vigilancia",
          "Emisión de Boleta de Venta"
        ],
        monto: 40.00
      },
      {
        concepto: "Venta de Patos adultos machos",
        descripcion: [
          "Pago en Tesorería",
          "Entrega del bien en Proyectos",
          "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivis y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA",
          "Supervisión de salida del bien-vigilancia",
          "Emisión de Boleta de Venta"
        ],
        monto: "S/. 50.00 / S/. 55.00"
      },
      {
        concepto: "Venta de Porcino para consumo Kg",
        descripcion: [
          "Pago en Tesorería",
          "Entrega del bien en Proyectos",
          "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivis y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA",
          "Supervisión de salida del bien-vigilancia",
          "Emisión de Boleta de Venta"
        ],
        monto: 20.00
      },
      {
        concepto: "Venta de Porcino en Pie Kg",
        descripcion: [
          "Emisión de B/V",
          "REPRODUCTOR",
          "CARNE"
        ],
        monto: "REPRODUCTOR: S/. 25.00 / CARNE: S/. 15.00"
      },
      {
        concepto: "Venta de Ganado Vacuno en pie Kg; EN PIE / CARCASA (SIN PATA, SIN CABEZA) KG",
        descripcion: [
          "Pago en Tesorería",
          "Entrega del bien en Proyectos",
          "Papeleta de Autorización de salida Firmada por la Unidad Administrativa, Jefe (e) del Área de Proyectos Productivis y Jefe (e) de Abastecimiento y Patrimonio del IESTP SUIZA",
          "Supervisión de salida del bien-vigilancia",
          "Emisión de B/V"
        ],
        monto: "CARCASA: S/. 20.00 / EN PIE: S/. 15.00"
      },
      {
        concepto: "Servicio de Empadre",
        descripcion: [
          "Ejecución del Servicio",
          "Pago en Tesorería",
          "Emisión de B/V"
        ],
        monto: 50.00
      }
    ]
  }
];