export interface ProcedimientoTupa2026 {
  readonly codigo: string;
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
    codigo: "01",
    nombre: "Expedición de Título Profesional Técnico",
    requisitos: [
      "Solicitud en FUT dirigida a Dirección General",
      "Constancia de No Adeudar",
      "Carpeta de titulación completa",
      "Comprobante de Pago 1.90 % UIT Vigente"
    ],
    derechoPago: "S/ 105.00 (1.90% UIT)",
    dependencia: "Secretaría Académica / Mesa de Partes",
    autoridad: "Dirección General",
    tiempoMaximo: "30 días hábiles"
  },
  {
    codigo: "02",
    nombre: "Certificado de Estudios Superiores (6 Semestres)",
    requisitos: [
      "Solicitud en FUT dirigida a Secretaría Académica",
      "Comprobante de Pago 2.24 % UIT Vigente"
    ],
    derechoPago: "S/ 124.00 (2.24% UIT)",
    dependencia: "Secretaría Académica",
    autoridad: "Secretaría Académica",
    tiempoMaximo: "07 días hábiles"
  },
  {
    codigo: "03",
    nombre: "Visación de Certificado de Estudios Superiores",
    requisitos: [
      "Solicitud en FUT",
      "Certificados originales de estudios",
      "Comprobante de Pago 0.29 % UIT Vigente"
    ],
    derechoPago: "S/ 16.00 (0.29% UIT)",
    dependencia: "Secretaría Académica",
    autoridad: "Secretaría Académica",
    tiempoMaximo: "05 días hábiles"
  },
  {
    codigo: "04",
    nombre: "Constancia de No Adeudar (Para fines de Titulación)",
    requisitos: [
      "Solicitud en FUT",
      "Comprobante de Pago 0.30 % UIT Vigente"
    ],
    derechoPago: "S/ 16.50 (0.30% UIT)",
    dependencia: "Unidad Administrativa / Tesorería",
    autoridad: "Unidad Administrativa",
    tiempoMaximo: "03 días hábiles"
  },
  {
    codigo: "05",
    nombre: "Constancia de Egresado",
    requisitos: [
      "Solicitud en FUT",
      "Verificación de récord académico",
      "Pago del Derecho en Tesorería"
    ],
    derechoPago: "S/ 31.00",
    dependencia: "Secretaría Académica",
    autoridad: "Secretaría Académica",
    tiempoMaximo: "05 días hábiles"
  },
  {
    codigo: "06",
    nombre: "Constancias Varias (Título, Estudios o Matrícula)",
    requisitos: [
      "Solicitud en FUT",
      "Comprobante de Pago 0.41 % UIT Vigente"
    ],
    derechoPago: "S/ 23.00 (0.41% UIT)",
    dependencia: "Secretaría Académica",
    autoridad: "Secretaría Académica",
    tiempoMaximo: "05 días hábiles"
  },
  {
    codigo: "07",
    nombre: "Certificado Modular (I, II, III y IV)",
    requisitos: [
      "Solicitud en FUT",
      "Emisión de B/V en Tesorería",
      "Pago por módulo"
    ],
    derechoPago: "S/ 100.00 por módulo",
    dependencia: "Secretaría Académica",
    autoridad: "Secretaría Académica",
    tiempoMaximo: "10 días hábiles"
  },
  {
    codigo: "08",
    nombre: "Certificado de Bachillerato",
    requisitos: [
      "Solicitud en FUT",
      "Comprobante de Pago 0.75 % UIT Vigente"
    ],
    derechoPago: "S/ 42.00 (0.75% UIT)",
    dependencia: "Secretaría Académica",
    autoridad: "Dirección General",
    tiempoMaximo: "15 días hábiles"
  },
  {
    codigo: "09",
    nombre: "Derecho de Duplicado de Título",
    requisitos: [
      "Solicitud en FUT",
      "Publicación en diario oficial",
      "Denuncia policial por pérdida o deterioro",
      "Comprobante de Pago 5.61 % UIT Vigente"
    ],
    derechoPago: "S/ 309.00 (5.61% UIT)",
    dependencia: "Mesa de Partes / Secretaría Académica",
    autoridad: "Dirección General",
    tiempoMaximo: "30 días hábiles"
  },
  {
    codigo: "10",
    nombre: "Modificación de Datos del Título",
    requisitos: [
      "Solicitud en FUT",
      "Partida de nacimiento o DNI rectificado",
      "Comprobante de Pago 4.88 % UIT Vigente"
    ],
    derechoPago: "S/ 269.00 (4.88% UIT)",
    dependencia: "Secretaría Académica",
    autoridad: "Dirección General",
    tiempoMaximo: "20 días hábiles"
  },
  {
    codigo: "11",
    nombre: "Convalidación entre Planes de Estudios",
    requisitos: [
      "Solicitud en FUT",
      "Sílabos oficiales visados",
      "Certificado de estudios",
      "Comprobante de Pago 0.84 % UIT Vigente"
    ],
    derechoPago: "S/ 46.50 (0.84% UIT)",
    dependencia: "Jefatura de Unidad Académica",
    autoridad: "Unidad Académica",
    tiempoMaximo: "15 días hábiles"
  },
  {
    codigo: "12",
    nombre: "Convalidación por Unidades de Competencia",
    requisitos: [
      "Solicitud en FUT",
      "Portafolio de evidencias laborales o académicas",
      "Comprobante de Pago 0.84 % UIT Vigente"
    ],
    derechoPago: "S/ 46.50 (0.84% UIT)",
    dependencia: "Jefatura de Unidad Académica",
    autoridad: "Unidad Académica",
    tiempoMaximo: "15 días hábiles"
  },
  {
    codigo: "13",
    nombre: "Traslado Interno",
    requisitos: [
      "Solicitud en FUT",
      "Constancia de vacante en carrera destino",
      "Resolución Directoral de Secretaría Académica",
      "Comprobante de Pago 5.61 % UIT Vigente"
    ],
    derechoPago: "S/ 309.00 (5.61% UIT)",
    dependencia: "Secretaría Académica",
    autoridad: "Dirección General",
    tiempoMaximo: "10 días hábiles"
  },
  {
    codigo: "14",
    nombre: "Traslado Externo",
    requisitos: [
      "Solicitud en FUT dirigida al Director",
      "Certificado de estudios del instituto de origen",
      "Constancia de vacante en carrera destino",
      "Resolución Directoral",
      "Comprobante de Pago 7.48 % UIT Vigente"
    ],
    derechoPago: "S/ 412.00 (7.48% UIT)",
    dependencia: "Mesa de Partes / Secretaría Académica",
    autoridad: "Dirección General",
    tiempoMaximo: "15 días hábiles"
  },
  {
    codigo: "15",
    nombre: "Reserva de Matrícula - Ingresantes",
    requisitos: [
      "Solicitud en FUT",
      "Resolución Directoral de Secretaría Académica",
      "Comprobante de Pago 1.20 % UIT Vigente"
    ],
    derechoPago: "S/ 66.00 (1.20% UIT)",
    dependencia: "Secretaría Académica",
    autoridad: "Secretaría Académica",
    tiempoMaximo: "05 días hábiles"
  },
  {
    codigo: "16",
    nombre: "Licencia de Estudios - Estudiantes Antiguos",
    requisitos: [
      "Solicitud en FUT",
      "Resolución Directoral de Secretaría Académica",
      "Comprobante de Pago 1.20 % UIT Vigente"
    ],
    derechoPago: "S/ 66.00 (1.20% UIT)",
    dependencia: "Secretaría Académica",
    autoridad: "Secretaría Académica",
    tiempoMaximo: "05 días hábiles"
  },
  {
    codigo: "17",
    nombre: "Derecho de Reincorporación (Reingreso)",
    requisitos: [
      "Solicitud en FUT dirigida a Dirección",
      "Pago en el Área de Tesorería"
    ],
    derechoPago: "S/ 300.00",
    dependencia: "Secretaría Académica",
    autoridad: "Dirección General",
    tiempoMaximo: "10 días hábiles"
  },
  {
    codigo: "18",
    nombre: "Examen de Recuperación / Subsanación con Jurado",
    requisitos: [
      "Resolución Directoral de Secretaría Académica",
      "Pago del Derecho en Tesorería (0.60% a 1.27% UIT Vigente)"
    ],
    derechoPago: "S/ 33.00 a S/ 70.00",
    dependencia: "Jefatura de Unidad Académica",
    autoridad: "Unidad Académica",
    tiempoMaximo: "05 días hábiles"
  },
  {
    codigo: "19",
    nombre: "Evaluación Extraordinaria",
    requisitos: [
      "Solicitud según RM 069",
      "Pago del Derecho en Tesorería (1.27% a 1.68% UIT Vigente)"
    ],
    derechoPago: "S/ 70.00 a S/ 93.00",
    dependencia: "Jefatura de Unidad Académica",
    autoridad: "Unidad Académica",
    tiempoMaximo: "07 días hábiles"
  },
  {
    codigo: "20",
    nombre: "Prueba de Suficiencia Académica",
    requisitos: [
      "Resolución Directoral de Secretaría Académica",
      "Comprobante de Pago 1.90 % UIT Vigente"
    ],
    derechoPago: "S/ 105.00 (1.90% UIT)",
    dependencia: "Jefatura de Unidad Académica",
    autoridad: "Unidad Académica",
    tiempoMaximo: "10 días hábiles"
  },
  {
    codigo: "21",
    nombre: "Devolución de Expediente",
    requisitos: [
      "Solicitud en FUT dirigida a Mesa de Partes",
      "Comprobante de Pago 0.37 % UIT Vigente"
    ],
    derechoPago: "S/ 21.00 (0.37% UIT)",
    dependencia: "Mesa de Partes",
    autoridad: "Mesa de Partes",
    tiempoMaximo: "03 días hábiles"
  },
  {
    codigo: "22",
    nombre: "Acceso a la Información Pública",
    requisitos: [
      "Solicitud dirigida a Dirección en FUT",
      "Comprobante de Pago 0.19 % UIT Vigente por costo de reproducción"
    ],
    derechoPago: "S/ 10.50 (0.19% UIT)",
    dependencia: "Dirección General / Mesa de Partes",
    autoridad: "Dirección General",
    tiempoMaximo: "10 días hábiles"
  },
  {
    codigo: "23",
    nombre: "Búsqueda y Duplicados de Boletas / Sílabos",
    requisitos: [
      "Solicitud de búsqueda y duplicado en FUT",
      "Comprobante de Pago 0.19 % UIT Vigente"
    ],
    derechoPago: "S/ 10.50 (0.19% UIT)",
    dependencia: "Secretaría Académica",
    autoridad: "Secretaría Académica",
    tiempoMaximo: "03 días hábiles"
  }
];
