/**
 * ARCHIVO: frontend/src/data/tupaCatalogo.ts
 * Catálogo Oficial y Respaldo Local Estructurado del TUPA 2026 - IESTP "Suiza" (Pucallpa).
 * Fuente: TUPA_SUIZA_2026_CORREGIDO_V2.pdf (6 páginas) — UIT Vigente 2026: S/. 5,500.00.
 * Este catálogo sirve como respaldo local ante fallas de red para que el usuario nunca quede bloqueado.
 */

export interface TupaCatalogoItem {
  readonly id: string;
  readonly codigo: string;
  readonly denominacion: string;
  readonly descripcion: string;
  readonly requisitos: readonly string[];
  readonly costo: string;
  readonly montoSoles: number;
  readonly plazoDias: number;
  readonly silencioAdministrativo: 'POSITIVO' | 'NEGATIVO';
  readonly unidadOrganica: string;
  readonly baseLegal: string;
  readonly rubro: string;
  readonly cuentaBancaria: string;
  readonly vigente: true;
}

export interface TipoTramiteFormal {
  id: string;
  codigo: string;
  denominacion: string;
  unidad_organica: string | null;
  descripcion?: string | null;
  vigente: true;
}

export const CATALOGO_TUPA_SUIZA: readonly TupaCatalogoItem[] = [
  {
    "id": "5395f878-d81e-5a4a-8adb-cc2d51b95146",
    "codigo": "SUZ26-001",
    "denominacion": "Prácticas Iniciales",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago del derecho en Tesorería; control en el Área Académica; comprobante de pago.",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Control en el Área Académica",
      "Comprobante de Pago"
    ],
    "costo": "S/ 35.00 (0.64 % UIT vigente)",
    "montoSoles": 35.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área Académica / Tesorería",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "7d02b403-821b-5c23-882f-52efdcac4090",
    "codigo": "SUZ26-002",
    "denominacion": "Prácticas Intermedias",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago del derecho en Tesorería; control en el Área Académica; comprobante de pago.",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Control en el Área Académica",
      "Comprobante de Pago"
    ],
    "costo": "S/ 45.00 (0.82 % UIT vigente)",
    "montoSoles": 45.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área Académica / Tesorería",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "ec7c4cdf-7a85-53ec-baa5-c58aea75b539",
    "codigo": "SUZ26-003",
    "denominacion": "Prácticas Finales",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago del derecho en Tesorería; control en el Área Académica; comprobante de pago.",
    "requisitos": [
      "Pago del Derecho en Tesorería",
      "Control en el Área Académica",
      "Comprobante de Pago"
    ],
    "costo": "S/ 60.00 (1.09 % UIT vigente)",
    "montoSoles": 60.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área Académica / Tesorería",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "b9e7f13a-e9d4-56aa-9417-83a92936a302",
    "codigo": "SUZ26-004",
    "denominacion": "Experiencias Formativas en Situaciones Reales de Trabajo (I, II, III y IV) — por cada módulo",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios. El PDF indica informe del Área Académica designando docentes responsables para las supervisiones, pago del derecho en Tesorería y comprobante de pago.",
    "requisitos": [
      "Informe del Área Académica designando docentes supervisores",
      "Pago del Derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 46.50 (0.84 % UIT vigente)",
    "montoSoles": 46.5,
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área Académica",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "22decec6-bb99-5fd9-b09d-07082bb3f681",
    "codigo": "SUZ26-005",
    "denominacion": "Certificado Modular (I, II, III y IV) — por cada módulo",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V.",
    "requisitos": [
      "Pago en el Área de Tesorería",
      "Emisión de Boleta de Venta (B/V)"
    ],
    "costo": "S/ 100.00",
    "montoSoles": 100.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "1a7ab5de-c9a2-5f08-a054-945a6fa387d3",
    "codigo": "SUZ26-006",
    "denominacion": "Certificado de Inglés",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V.",
    "requisitos": [
      "Pago en el Área de Tesorería",
      "Emisión de Boleta de Venta (B/V)"
    ],
    "costo": "S/ 100.00",
    "montoSoles": 100.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "1bce371e-10ac-5d56-a0cd-97c5ba93b1e9",
    "codigo": "SUZ26-007",
    "denominacion": "Centro de Idiomas — paquete básico de 4 meses para alumnos del IESTP Suiza",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V.",
    "requisitos": [
      "Ficha de inscripción de matrícula en Idiomas",
      "Pago en el Área de Tesorería",
      "Emisión de Boleta de Venta (B/V)"
    ],
    "costo": "S/ 300.00",
    "montoSoles": 300.0,
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Centro de Idiomas",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "153ebc0d-9da0-5820-ba47-2be55f7e6fc7",
    "codigo": "SUZ26-008",
    "denominacion": "Centro de Idiomas — paquete básico de 4 meses para alumnos externos",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios del IESTP Suiza. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V.",
    "requisitos": [
      "Ficha de inscripción de matrícula en Idiomas",
      "Pago en el Área de Tesorería",
      "Emisión de Boleta de Venta (B/V)"
    ],
    "costo": "S/ 350.00",
    "montoSoles": 350.0,
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Centro de Idiomas",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "eeef72f9-8138-5852-b123-8025381b59e6",
    "codigo": "SUZ26-009",
    "denominacion": "Examen de Suficiencia de Inglés y/o Portugués",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios. Descripción del PDF: Pago en el Área de Tesorería; emisión de B/V.",
    "requisitos": [
      "Solicitud de examen de suficiencia",
      "Pago en el Área de Tesorería",
      "Emisión de Boleta de Venta (B/V)"
    ],
    "costo": "S/ 300.00",
    "montoSoles": 300.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Centro de Idiomas / Secretaría Académica",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "788d46ed-9ab2-5028-b530-732eb20e79f8",
    "codigo": "SUZ26-010",
    "denominacion": "CEPRETEC 2026",
    "descripcion": "Rubro: Proyectos Productivos — Venta de servicios. El cuadro también muestra pago en Tesorería y emisión de B/V; la disposición visual de importes presenta ambigüedad, por lo que se conservan literalmente sin asignar una tarifa distinta a la indicada en cada línea.",
    "requisitos": [
      "Ficha de inscripción en CEPRETEC",
      "Pago en el Área de Tesorería",
      "Emisión de Boleta de Venta (B/V)"
    ],
    "costo": "El cuadro muestra S/ 400.00, S/ 200.00, S/ 60.00, S/ 50.00, S/ 40.00 y S/ 10.00.",
    "montoSoles": 400.0,
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Coordinación CEPRETEC",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja.",
    "rubro": "Proyectos Productivos — Venta de Servicios",
    "cuentaBancaria": "Cta. Cte. 0512-039170 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "5f632231-3a6c-5187-9539-7e81fe97ae55",
    "codigo": "SUZ26-011",
    "denominacion": "Alquiler del Galpón Agrícola para la Crianza de Pollos (por campaña)",
    "descripcion": "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, suscripción del contrato y pago en Tesorería según contrato; no precisa cómo se relacionan el importe publicado y el precio contractual.",
    "requisitos": [
      "Solicitud dirigida al Director del IESTP Suiza",
      "Suscripción de Contrato",
      "Pago en Tesorería según contrato"
    ],
    "costo": "S/ 500.00.",
    "montoSoles": 500.0,
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Dirección General / Unidad Administrativa",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "69afd287-d480-5c1b-bc50-cabf2730990a",
    "codigo": "SUZ26-012",
    "denominacion": "Alquiler de Retroproyector",
    "descripcion": "Rubro: Venta de servicios. Descripción del PDF: Pago en Tesorería.",
    "requisitos": [
      "Solicitud de alquiler dirigida a Dirección",
      "Proveído de Unidad Administrativa para autorización",
      "Pago en Tesorería",
      "Emisión de B/V"
    ],
    "costo": "S/ 100.00",
    "montoSoles": 100.0,
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Unidad Administrativa / Tesorería",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "6cef9088-d002-5181-82fd-90c2dbf9523b",
    "codigo": "SUZ26-013",
    "denominacion": "Alquiler de Aulas — diario",
    "descripcion": "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, proveído a la Unidad Administrativa para autorización, pago en Tesorería y emisión de B/V.",
    "requisitos": [
      "Solicitud de alquiler dirigida a Dirección",
      "Proveído de Unidad Administrativa para autorización",
      "Pago en Tesorería",
      "Emisión de B/V"
    ],
    "costo": "S/ 150.00",
    "montoSoles": 150.0,
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Unidad Administrativa / Tesorería",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "a3f32d7a-b325-5b30-8437-967ac2438ce6",
    "codigo": "SUZ26-014",
    "denominacion": "Alquiler de la Cancha de Fútbol — diario",
    "descripcion": "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, proveído a la Unidad Administrativa para autorización, pago en Tesorería y emisión de B/V.",
    "requisitos": [
      "Solicitud de alquiler dirigida a Dirección",
      "Proveído de Unidad Administrativa para autorización",
      "Pago en Tesorería",
      "Emisión de B/V"
    ],
    "costo": "S/ 100.00",
    "montoSoles": 100.0,
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Unidad Administrativa / Tesorería",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "55e5aea4-451b-5a62-ac46-98268a64b579",
    "codigo": "SUZ26-015",
    "denominacion": "Alquiler de Ambientes para servicio de alimentación",
    "descripcion": "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, suscripción del contrato y pago en Tesorería según contrato; no precisa la relación entre el monto y el rango contractual.",
    "requisitos": [
      "Solicitud dirigida al Director del IESTP Suiza",
      "Suscripción de Contrato",
      "Pago en Tesorería según contrato"
    ],
    "costo": "S/ 1,000.00.",
    "montoSoles": 1000.0,
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Dirección General / Unidad Administrativa",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "4768a96f-db53-5004-af23-29f6347825d8",
    "codigo": "SUZ26-016",
    "denominacion": "Alquiler del Auditorio",
    "descripcion": "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director del IESTP Suiza, proveído a la Unidad Administrativa para autorización, pago en Tesorería y emisión de B/V.",
    "requisitos": [
      "Solicitud de alquiler dirigida a Dirección",
      "Proveído de Unidad Administrativa para autorización",
      "Pago en Tesorería",
      "Emisión de B/V"
    ],
    "costo": "S/ 300.00",
    "montoSoles": 300.0,
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Unidad Administrativa / Tesorería",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "16096e21-506e-57d9-9756-aa779bbf21c5",
    "codigo": "SUZ26-017",
    "denominacion": "Alquiler de Laboratorio de Cómputo a Terceros",
    "descripcion": "Rubro: Venta de servicios.",
    "requisitos": [
      "Solicitud de alquiler dirigida a Dirección",
      "Proveído de Unidad Administrativa para autorización",
      "Pago en Tesorería",
      "Emisión de B/V"
    ],
    "costo": "S/ 20.00",
    "montoSoles": 20.0,
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Unidad Administrativa / Tesorería",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "c206e8cb-8726-549c-9f03-34617398f8b8",
    "codigo": "SUZ26-018",
    "denominacion": "Venta Ambulatoria Diaria",
    "descripcion": "Rubro: Venta de servicios. El PDF indica solicitud dirigida al Director, proveído a la Unidad Administrativa para autorización, pago en Tesorería y emisión de B/V.",
    "requisitos": [
      "Solicitud de alquiler dirigida a Dirección",
      "Proveído de Unidad Administrativa para autorización",
      "Pago en Tesorería",
      "Emisión de B/V"
    ],
    "costo": "S/ 20.00",
    "montoSoles": 20.0,
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Unidad Administrativa / Tesorería",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "45ce4ea1-f524-5b41-9824-d8f49350441d",
    "codigo": "SUZ26-019",
    "denominacion": "Venta de Mangos",
    "descripcion": "Rubro: Venta de bienes. El PDF indica que los precios están vigentes para 2024 y se basan en precios de mercado; incluye pago en Tesorería, entrega en proyectos, papeleta de autorización de salida firmada por las unidades indicadas en el documento, supervisión de salida y emisión de Boleta de Venta. La vigencia 2024 requiere aclaración para el TUPA 2026.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "S/ 15.00",
    "montoSoles": 15.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "2e51d8b1-e1a9-55ec-9b53-eb8e3dec28e3",
    "codigo": "SUZ26-020",
    "denominacion": "Venta de Patos BB",
    "descripcion": "Rubro: Venta de bienes. El PDF indica que los precios están vigentes para 2024 y se basan en precios de mercado; incluye pago en Tesorería, entrega en proyectos, papeleta de autorización de salida firmada por las unidades indicadas en el documento, supervisión de salida y emisión de Boleta de Venta.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "S/ 15.00",
    "montoSoles": 15.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "71d98e0f-29ad-5780-95cc-42bd9f39467e",
    "codigo": "SUZ26-021",
    "denominacion": "Venta de Patos Pichones — hembras",
    "descripcion": "Rubro: Venta de bienes. El PDF indica precio de acuerdo al tamaño; incluye pago en Tesorería, entrega en proyectos, papeleta de autorización de salida, supervisión de salida y emisión de Boleta de Venta. Precios indicados como vigentes para 2024.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "S/ 30.00",
    "montoSoles": 30.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "85a2cad1-f1f2-5842-bff4-1dd3b1278cd3",
    "codigo": "SUZ26-022",
    "denominacion": "Venta de Patos Pichones — machos",
    "descripcion": "Rubro: Venta de bienes. El PDF indica precio de acuerdo al tamaño; incluye pago en Tesorería, entrega en proyectos, papeleta de autorización de salida, supervisión de salida y emisión de Boleta de Venta. Precios indicados como vigentes para 2024.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "S/ 40.00",
    "montoSoles": 40.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "72fa3f13-7262-54e4-9ac9-856bfa6b55a7",
    "codigo": "SUZ26-023",
    "denominacion": "Venta de Pati Pollos",
    "descripcion": "Rubro: Venta de servicios, según el encabezado de página; la ubicación del concepto bajo ese rubro puede requerir confirmación. El PDF indica pago en Tesorería, entrega del bien en proyectos, papeleta de autorización de salida, supervisión de salida y emisión de Boleta de Venta. Precios indicados como vigentes para 2024.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "S/ 15.00",
    "montoSoles": 15.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "5a2dc507-3dc6-57e8-9968-b4231dc9f953",
    "codigo": "SUZ26-024",
    "denominacion": "Venta de Patos adultos hembras",
    "descripcion": "Rubro: Venta de servicios, según el encabezado de página; la ubicación del concepto bajo ese rubro puede requerir confirmación. El PDF indica pago en Tesorería, entrega del bien en proyectos, papeleta de autorización de salida, supervisión de salida y emisión de Boleta de Venta. Precios indicados como vigentes para 2024.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "S/ 40.00",
    "montoSoles": 40.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "1b9698e8-3c4d-5d47-a36e-dad2203a1bb9",
    "codigo": "SUZ26-025",
    "denominacion": "Venta de Patos adultos machos",
    "descripcion": "Rubro: Venta de servicios, según el encabezado de página; la ubicación del concepto bajo ese rubro puede requerir confirmación. Incluye pago en Tesorería, entrega del bien, papeleta de autorización de salida, supervisión y emisión de Boleta de Venta. Precios indicados como vigentes para 2024.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "El cuadro muestra S/ 50.00 y S/ 55.00.",
    "montoSoles": 50.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "f7cc811d-7ef3-5cc7-8225-e14639641375",
    "codigo": "SUZ26-026",
    "denominacion": "Venta de Porcino para consumo — kg",
    "descripcion": "Rubro: Venta de Bienes y Otros Servicios (D.S. 028-2007-ED). Rubro de la página: Venta de servicios; el concepto es venta de un bien. El PDF indica pago en Tesorería, entrega en proyectos, papeleta de autorización de salida, supervisión y emisión de Boleta de Venta. Precios indicados como vigentes para 2024.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "S/ 20.00",
    "montoSoles": 20.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "dbafdf1e-1c29-5ac8-bdbf-40dc1fc08938",
    "codigo": "SUZ26-027",
    "denominacion": "Venta de Porcino en Pie — kg",
    "descripcion": "Rubro: Venta de Bienes y Otros Servicios (D.S. 028-2007-ED). Rubro de la página: Venta de servicios; el concepto es venta de un bien. El cuadro también indica emisión de B/V; se conservan las variantes expresamente rotuladas.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "El cuadro muestra S/ 25.00 y S/ 15.00.",
    "montoSoles": 25.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "e7135168-f99e-5945-965e-44a890cc33f0",
    "codigo": "SUZ26-028",
    "denominacion": "Venta de Ganado Vacuno",
    "descripcion": "Rubro: Venta de Bienes y Otros Servicios (D.S. 028-2007-ED). Rubro de la página: Venta de servicios; el concepto es venta de un bien. El PDF también indica pago en Tesorería, entrega en proyectos, papeleta de autorización de salida, supervisión y emisión de B/V. Precios indicados como vigentes para 2024.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "El cuadro muestra S/ 20.00 y S/ 15.00.",
    "montoSoles": 20.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "85beae78-4507-54e4-80e4-8c901a49dc15",
    "codigo": "SUZ26-029",
    "denominacion": "Servicio de Empadre",
    "descripcion": "Rubro: Venta de servicios. Descripción del PDF: ejecución del servicio, pago en Tesorería y emisión de B/V.",
    "requisitos": [
      "Pago en Tesorería",
      "Papeleta de Autorización de salida firmada por autoridades",
      "Supervisión de salida del bien (Vigilancia)",
      "Emisión de Boleta de Venta"
    ],
    "costo": "S/ 50.00",
    "montoSoles": 50.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Área de Proyectos Productivos / Abastecimiento y Patrimonio",
    "baseLegal": "D.S. N° 028-2007-ED: Reglamento de Gestión de Recursos Propios y Actividades Productivas.",
    "rubro": "Venta de Bienes y Otros Servicios (D.S. 028-2007-ED)",
    "cuentaBancaria": "Tesorería Institucional",
    "vigente": true
  },
  {
    "id": "16ad60f2-e811-5637-82e3-c5816792fd36",
    "codigo": "SUZ26-030",
    "denominacion": "FUT — proceso de titulación",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación.",
    "requisitos": [
      "Pago del derecho en Tesorería (0.07% UIT - S/ 4.00)",
      "Comprobante de Pago"
    ],
    "costo": "S/ 4.00 (0.07 % UIT vigente)",
    "montoSoles": 4.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Mesa de Partes",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "61c51d0b-36cb-4c5f-baa1-0052f56845d2",
    "codigo": "SUZ26-031",
    "denominacion": "Constancia de No Adeudar — para fines de titulación",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT",
      "Pago del derecho en Tesorería (0.30% UIT - S/ 16.50)",
      "Comprobante de Pago"
    ],
    "costo": "S/ 16.50 (0.30 % UIT vigente)",
    "montoSoles": 16.5,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "a8b9e4c7-5019-564d-aa51-811ce66140f7",
    "codigo": "SUZ26-032",
    "denominacion": "Trabajo de Aplicación Profesional (Examen Teórico Práctico)",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería.",
    "requisitos": [
      "Solicitud en FUT",
      "Plan de trabajo aplicativo o suficiencia aprobado",
      "Pago del derecho en Tesorería (1.03% UIT - S/ 57.00)"
    ],
    "costo": "S/ 57.00 (1.03 % UIT vigente)",
    "montoSoles": 57.0,
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "6d0d65e2-3710-5820-817e-bbb83625e567",
    "codigo": "SUZ26-033",
    "denominacion": "Examen de Suficiencia Profesional (Examen Teórico Práctico)",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería.",
    "requisitos": [
      "Solicitud en FUT",
      "Plan de trabajo aplicativo o suficiencia aprobado",
      "Pago del derecho en Tesorería (1.03% UIT - S/ 57.00)"
    ],
    "costo": "S/ 57.00 (1.03 % UIT vigente)",
    "montoSoles": 57.0,
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "a778cedf-c565-4d07-b74d-012550d110c2",
    "codigo": "SUZ26-034",
    "denominacion": "Expedición de Título",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT dirigida a Dirección General",
      "Constancia de No Adeudar institucional",
      "Certificado de Estudios Superiores (6 semestres)",
      "Constancia de egresado y carpeta de titulación completa",
      "Comprobante de pago del derecho (1.90% UIT Vigente - S/ 105.00)"
    ],
    "costo": "S/ 105.00 (1.90 % UIT vigente)",
    "montoSoles": 105.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd",
    "codigo": "SUZ26-035",
    "denominacion": "Certificado de Estudios Superiores (6 semestres)",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT dirigida a Secretaría Académica",
      "Pago del derecho en Tesorería (2.24% UIT - S/ 124.00)",
      "Comprobante de Pago"
    ],
    "costo": "S/ 124.00 (2.24 % UIT vigente)",
    "montoSoles": 124.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "4b1e596b-80fb-4178-a4af-d4cf2e8dee9b",
    "codigo": "SUZ26-036",
    "denominacion": "Visación de Certificado de Estudios Superiores",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT",
      "Certificados de estudios originales",
      "Pago del derecho en Tesorería (0.29% UIT - S/ 16.00)"
    ],
    "costo": "S/ 16.00 (0.29 % UIT vigente)",
    "montoSoles": 16.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "bc6ff006-ffa3-5f74-860b-e798b3564459",
    "codigo": "SUZ26-037",
    "denominacion": "Caligrafiado de Título",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Expediente de titulación en trámite",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 26.00 (0.47 % UIT vigente)",
    "montoSoles": 26.0,
    "plazoDias": 7,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "3711cc0b-81e2-5b92-942d-05c39320056e",
    "codigo": "SUZ26-038",
    "denominacion": "Derecho de Formato de Título",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Expediente de titulación en trámite",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 42.00 (0.75 % UIT vigente)",
    "montoSoles": 42.0,
    "plazoDias": 7,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "7bb8b6c4-4277-534d-a154-3a965e9b46a0",
    "codigo": "SUZ26-039",
    "denominacion": "Inscripción de Título",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Expediente de titulación en trámite",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 120.00",
    "montoSoles": 120.0,
    "plazoDias": 7,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "5fa5514f-5461-5b39-956d-8c91d36b5f76",
    "codigo": "SUZ26-040",
    "denominacion": "Medallas — proceso de titulación",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 100.00",
    "montoSoles": 100.0,
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica / Tesorería",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "4ac95af1-9208-5016-8cd4-784dddfe7b9b",
    "codigo": "SUZ26-041",
    "denominacion": "Protector de Título",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 100.00",
    "montoSoles": 100.0,
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica / Tesorería",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "fff01154-aefb-5460-aeb3-134c220ff53a",
    "codigo": "SUZ26-042",
    "denominacion": "Colación",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 100.00",
    "montoSoles": 100.0,
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica / Tesorería",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "ce1cfcff-3caa-51dd-a224-9591821fe8c2",
    "codigo": "SUZ26-043",
    "denominacion": "Protector de Certificado Modular",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Proceso de Titulación. Descripción del PDF: pago del derecho en Tesorería.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 50.00",
    "montoSoles": 50.0,
    "plazoDias": 5,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica / Tesorería",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Proceso de Titulación",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "7cf2ffc4-a9c2-483f-8ac9-ac33702e1be4",
    "codigo": "SUZ26-044",
    "denominacion": "Modificación de Datos del Título",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT",
      "Documento probatorio (Partida rectificada / Denuncia policial y publicación en diario)",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 269.00 (4.88 % UIT vigente)",
    "montoSoles": 269.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "a9ff2ceb-aac8-4f31-aa9f-959231940e4d",
    "codigo": "SUZ26-045",
    "denominacion": "Derecho de duplicado de Título",
    "descripcion": "Rubro: Ingresos Propios — Servicios Académicos; Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT",
      "Documento probatorio (Partida rectificada / Denuncia policial y publicación en diario)",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 309.00 (5.61 % UIT vigente)",
    "montoSoles": 309.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "985558d8-4061-5def-9de1-339b2875398a",
    "codigo": "SUZ26-046",
    "denominacion": "Matrículas",
    "descripcion": "Rubro: Otros Servicios Académicos. El documento no desglosa el importe entre los conceptos enumerados.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 200.00",
    "montoSoles": 200.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "8aedd10d-d772-5213-b11d-a0951f47a781",
    "codigo": "SUZ26-047",
    "denominacion": "Admisión 2026",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería.",
    "requisitos": [
      "Ficha de inscripción de admisión",
      "Documento Nacional de Identidad (DNI)",
      "Certificado de estudios secundarios / Título",
      "Pago de derecho en Tesorería"
    ],
    "costo": "S/ 250.00",
    "montoSoles": 250.0,
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Comisión de Admisión",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "0a12bd4b-234b-5a55-95bf-a57edbd3137e",
    "codigo": "SUZ26-048",
    "denominacion": "Guías del postulante",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 50.00",
    "montoSoles": 50.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "8b9641e6-2a66-59ab-b79e-b8fb9b54c679",
    "codigo": "SUZ26-049",
    "denominacion": "Ingreso Admisión 2026 — titulados",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería.",
    "requisitos": [
      "Ficha de inscripción de admisión",
      "Documento Nacional de Identidad (DNI)",
      "Certificado de estudios secundarios / Título",
      "Pago de derecho en Tesorería"
    ],
    "costo": "S/ 500.00",
    "montoSoles": 500.0,
    "plazoDias": 15,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Comisión de Admisión",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "65950f60-be67-42c7-8a76-8bb0698f7868",
    "codigo": "SUZ26-050",
    "denominacion": "Derecho de Reincorporación (Reingreso)",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 300.00",
    "montoSoles": 300.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "5fc07beb-8d3e-458d-af3e-1e040928f711",
    "codigo": "SUZ26-051",
    "denominacion": "Constancia de Egresado",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería.",
    "requisitos": [
      "Solicitud en FUT",
      "Récord de estudios completos aprobados",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 31.00",
    "montoSoles": 31.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "79a17912-883e-40dc-8a67-53f9669c6c01",
    "codigo": "SUZ26-052",
    "denominacion": "Certificado de Bachillerato",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT",
      "Récord de estudios completos aprobados",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 42.00 (0.75 % UIT vigente)",
    "montoSoles": 42.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "f0e1b3a9-db4a-402b-ae4c-4d8cb558afd6",
    "codigo": "SUZ26-053",
    "denominacion": "Constancias — de título, estudios o matrícula",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF enumera constancias de título, estudios y matrícula; pago del derecho en Tesorería y comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT",
      "Récord de estudios completos aprobados",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 23.00 (0.41 % UIT vigente)",
    "montoSoles": 23.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "1c39704c-1b93-4dfd-a064-76145939028e",
    "codigo": "SUZ26-054",
    "denominacion": "Convalidación entre Planes de Estudios",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería.",
    "requisitos": [
      "Solicitud en FUT",
      "Certificado oficial de estudios",
      "Sílabos visados o portafolio de competencias",
      "Pago en Tesorería (0.84% UIT - S/ 46.50)"
    ],
    "costo": "S/ 46.50 (0.84 % UIT vigente)",
    "montoSoles": 46.5,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "98b9f51d-a883-4723-a508-9a758c23c941",
    "codigo": "SUZ26-055",
    "denominacion": "Convalidación por Unidades de Competencia",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT",
      "Certificado oficial de estudios",
      "Sílabos visados o portafolio de competencias",
      "Pago en Tesorería (0.84% UIT - S/ 46.50)"
    ],
    "costo": "S/ 46.50 (0.84 % UIT vigente)",
    "montoSoles": 46.5,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "3f865752-76a2-4922-b37b-3ba72d53ad35",
    "codigo": "SUZ26-056",
    "denominacion": "Devolución de Expediente",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 21.00 (0.37 % UIT vigente)",
    "montoSoles": 21.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "95427b3d-9e83-575f-a666-0cd5cd4da6db",
    "codigo": "SUZ26-057",
    "denominacion": "Evaluación Extraordinaria (A)",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Resolución Directoral o autorización académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 93.00 (1.68 % UIT vigente)",
    "montoSoles": 93.0,
    "plazoDias": 7,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Jefatura de Unidad Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "a992c738-b0f7-520c-b07b-a8feadd6440a",
    "codigo": "SUZ26-058",
    "denominacion": "Evaluación Extraordinaria (RM 069)",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Resolución Directoral o autorización académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 70.00 (1.27 % UIT vigente)",
    "montoSoles": 70.0,
    "plazoDias": 7,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Jefatura de Unidad Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "98076a38-6992-51e9-91af-b3ed4fc2d066",
    "codigo": "SUZ26-059",
    "denominacion": "Examen de Recuperación",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Resolución Directoral o autorización académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 70.00 (1.27 % UIT vigente)",
    "montoSoles": 70.0,
    "plazoDias": 7,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Jefatura de Unidad Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "df1c8f75-7244-5822-a849-ccfd2de86be6",
    "codigo": "SUZ26-060",
    "denominacion": "Examen de Cargo",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Resolución Directoral o autorización académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 70.00 (1.27 % UIT vigente)",
    "montoSoles": 70.0,
    "plazoDias": 7,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Jefatura de Unidad Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "2653aa0b-bf08-5604-b3a9-8a96ebf592d8",
    "codigo": "SUZ26-061",
    "denominacion": "Repitencia de Unidad Didáctica",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 86.00 (1.56 % UIT vigente)",
    "montoSoles": 86.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "1fdde733-c626-5d8e-ab88-1ff311f78fd1",
    "codigo": "SUZ26-062",
    "denominacion": "Repitencia de Semestre",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 80.00 (1.45 % UIT vigente)",
    "montoSoles": 80.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "db2b68bc-3e46-4d75-a955-4724a45def31",
    "codigo": "SUZ26-063",
    "denominacion": "Reserva de Matrícula — ingresantes",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica Resolución Directoral — Secretaría Académica y pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT dirigida a Dirección",
      "Récord académico",
      "Resolución Directoral de Secretaría Académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 66.00 (1.20 % UIT vigente)",
    "montoSoles": 66.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "22ba2fef-d601-4cf4-b83d-d26f57660668",
    "codigo": "SUZ26-064",
    "denominacion": "Licencia de Estudios — estudiantes antiguos",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica Resolución Directoral — Secretaría Académica y pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT dirigida a Dirección",
      "Récord académico",
      "Resolución Directoral de Secretaría Académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 66.00 (1.20 % UIT vigente)",
    "montoSoles": 66.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "0a802b72-04f3-4229-ba26-107cdd6804eb",
    "codigo": "SUZ26-065",
    "denominacion": "Traslado Interno",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica vacante en la carrera, Resolución Directoral — Secretaría Académica, pago del derecho en Tesorería y comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT dirigida a Dirección",
      "Vacante en la carrera",
      "Resolución Directoral de Secretaría Académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 309.00 (5.61 % UIT vigente)",
    "montoSoles": 309.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "6c15cb58-e78f-4b00-b709-bd008ab98d47",
    "codigo": "SUZ26-066",
    "denominacion": "Traslado Externo",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica solicitud en FUT dirigida al Director, vacante en la carrera, Resolución Directoral — Secretaría Académica, pago del derecho en Tesorería y comprobante de pago.",
    "requisitos": [
      "Solicitud en FUT dirigida a Dirección",
      "Vacante en la carrera",
      "Resolución Directoral de Secretaría Académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 412.00 (7.48 % UIT vigente)",
    "montoSoles": 412.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "befbec5d-30fd-5f0d-8eba-239480a20903",
    "codigo": "SUZ26-067",
    "denominacion": "Demora Devolución Libro Biblioteca",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica informe a la Unidad Administrativa de deudores de libros; derivación a Tesorería; pago del derecho y comprobante.",
    "requisitos": [
      "Informe administrativo de deudores de libros",
      "Pago de penalidad en Tesorería (S/ 10.00 por día)"
    ],
    "costo": "S/ 10.00 (0.19 % UIT vigente; costo por día)",
    "montoSoles": 10.0,
    "plazoDias": 1,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Biblioteca / Unidad Administrativa",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "36186535-00c2-43f2-b0cc-f657886ad8b5",
    "codigo": "SUZ26-068",
    "denominacion": "Acceso a la Información Pública",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica solicitud dirigida a Dirección en FUT y pago del derecho en Tesorería; la relación entre las tarifas requiere aclaración.",
    "requisitos": [
      "Solicitud en Formato Único de Trámite (FUT) dirigida a Dirección",
      "Pago de tasa de reproducción en Tesorería (S/ 10.50 / S/ 10.00 por hoja)"
    ],
    "costo": "El cuadro muestra S/ 10.50 y también S/ 10.00 por cada hoja; consigna 0.19 % UIT vigente.",
    "montoSoles": 10.5,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "ae289c0b-a54f-59d1-8986-0c9597a7f5c5",
    "codigo": "SUZ26-069",
    "denominacion": "Búsqueda y Duplicados de Boletas (c/u)",
    "descripcion": "Rubro: Otros Servicios Académicos. El importe corresponde al grupo presentado en una misma fila en el PDF.",
    "requisitos": [
      "Solicitud en FUT",
      "Pago del derecho en Tesorería (S/ 10.50)",
      "Comprobante de Pago"
    ],
    "costo": "Gratuito",
    "montoSoles": 0.0,
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "e6962908-f0de-5ca0-a387-699e01c971f3",
    "codigo": "SUZ26-070",
    "denominacion": "Síllabus (c/u)",
    "descripcion": "Rubro: Otros Servicios Académicos. El importe se conserva como dato compartido del grupo, no como tarifa individual de Síllabus.",
    "requisitos": [
      "Solicitud en FUT",
      "Pago del derecho en Tesorería (S/ 10.50)",
      "Comprobante de Pago"
    ],
    "costo": "Gratuito",
    "montoSoles": 0.0,
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "9551eb29-9942-5088-85aa-915370d3dc7c",
    "codigo": "SUZ26-071",
    "denominacion": "Otros Trámites",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF también muestra el texto “Otros Trámites Administrativos” en el bloque descriptivo compartido.",
    "requisitos": [
      "Solicitud en FUT",
      "Pago del derecho en Tesorería (S/ 10.50)",
      "Comprobante de Pago"
    ],
    "costo": "Gratuito",
    "montoSoles": 0.0,
    "plazoDias": 3,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "e91295e9-ff9f-4fb0-8692-309f0366ce49",
    "codigo": "SUZ26-072",
    "denominacion": "Titulación de Otros Institutos Tecnológicos",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica pago del derecho en Tesorería, comprobante de pago y Resolución Directoral — Secretaría Académica.",
    "requisitos": [
      "Expediente completo de titulación de instituto origen",
      "Certificados oficiales de estudios",
      "Pago en Tesorería (9.35% UIT - S/ 515.00)"
    ],
    "costo": "S/ 515.00 (9.35 % UIT vigente)",
    "montoSoles": 515.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL",
    "baseLegal": "Ley 28693: Ley General del Sistema Nacional de Tesorería. Principio de Unidad de Caja. Directiva de Tesorería.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "06db7a73-c202-59a6-9afb-6a54b1e2ea5b",
    "codigo": "SUZ26-073",
    "denominacion": "Examen de Subsanación con Jurado",
    "descripcion": "Rubro: Otros Servicios Académicos. El PDF indica pago del derecho en Tesorería, comprobante de pago y Resolución Directoral — Secretaría Académica.",
    "requisitos": [
      "Resolución Directoral o autorización académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 33.00 (0.60 % UIT vigente)",
    "montoSoles": 33.0,
    "plazoDias": 7,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Jefatura de Unidad Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "411afde2-62b0-5487-bf7c-136a054fe6c3",
    "codigo": "SUZ26-074",
    "denominacion": "Prueba de Suficiencia Académica",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.",
    "requisitos": [
      "Resolución Directoral o autorización académica",
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 105.00 (1.90 % UIT vigente)",
    "montoSoles": 105.0,
    "plazoDias": 7,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Jefatura de Unidad Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "7b725922-3db6-5b62-a230-743bc26c8491",
    "codigo": "SUZ26-075",
    "denominacion": "Carnets, Insignia y Distintivos",
    "descripcion": "Rubro: Otros Servicios Académicos. Descripción del PDF: pago en el Área de Tesorería; emisión de B/V.",
    "requisitos": [
      "Pago del derecho en Tesorería",
      "Comprobante de Pago"
    ],
    "costo": "S/ 50.00 (0.93 % UIT vigente)",
    "montoSoles": 50.0,
    "plazoDias": 10,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Secretaría Académica",
    "baseLegal": "Ley N° 30512: Ley de Institutos y Escuelas de Educación Superior; TUO Ley N° 27444.",
    "rubro": "Ingresos Propios — Servicios Académicos",
    "cuentaBancaria": "Cta. Cte. 0512-015263 Banco de la Nación",
    "vigente": true
  },
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "codigo": "LIBRE",
    "denominacion": "Solicitud General / Trámite No Tarifado",
    "descripcion": "Ingreso directo a Mesa de Partes para peticiones, justificaciones y trámites institucionales no tarifados en el TUPA.",
    "requisitos": [
      "Solicitud formal o FUT dirigida a la Dirección o Unidad correspondiente",
      "Documento Nacional de Identidad (DNI) o documento acreditante",
      "Documentación de sustento escaneada en formato PDF (máx. 25 MB)"
    ],
    "costo": "Gratuito",
    "montoSoles": 0.0,
    "plazoDias": 30,
    "silencioAdministrativo": "POSITIVO",
    "unidadOrganica": "Mesa de Partes General",
    "baseLegal": "TUO de la Ley N° 27444 — Ley del Procedimiento Administrativo General (D.S. N° 006-2026-JUS).",
    "rubro": "Trámite General / No TUPA",
    "cuentaBancaria": "No aplica (Trámite gratuito)",
    "vigente": true
  }
];

/**
 * Genera la lista de tipos formales para los componentes del Wizard (StepDocumentos, StepConfirmacion).
 * Cumple estrictamente con el contrato de validación (UUID, código, denominación, unidad_organica, vigente).
 */
export function obtenerCatalogoFormalRespaldo(): TipoTramiteFormal[] {
  return CATALOGO_TUPA_SUIZA.map((item) => ({
    id: item.id,
    codigo: item.codigo,
    denominacion: item.denominacion,
    unidad_organica: item.unidadOrganica,
    descripcion: `${item.descripcion}\nDerecho de pago: ${item.costo}\nRequisitos: ${item.requisitos.join('; ')}`,
    vigente: true,
  }));
}

/**
 * Busca un trámite por ID (UUID) o por código técnico ('SUZ26-XXX' o 'TUPA-SUZ26-XXX').
 */
export function buscarTramiteTupa(idOCodigo: string): TupaCatalogoItem | undefined {
  if (!idOCodigo) return undefined;
  const normalizado = idOCodigo.trim().toLowerCase();
  return CATALOGO_TUPA_SUIZA.find(
    (item) =>
      item.id.toLowerCase() === normalizado ||
      item.codigo.toLowerCase() === normalizado ||
      `tupa-${item.codigo.toLowerCase()}` === normalizado
  );
}
