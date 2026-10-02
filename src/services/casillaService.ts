/**
 * Módulo: Capa de Servicio para Casilla Electrónica y Acuse Legal (ENT-M01-03)
 * Centraliza las llamadas HTTP con tipado estricto y fallback a datos simulados (fixtures)
 * para previsualización inmediata hasta conectar el backend oficial.
 */

import { apiClient } from "../api/client";
import type {
  AcuseNotificacion,
  EstadisticasCasilla,
  FiltrosCasilla,
  GenerarAcuseRequest,
  GenerarAcuseResponse,
  Notificacion,
  NotificacionesResponse,
} from "../types/casilla";

// ============================================================================
// CONSTANTES DE ENDPOINTS (Fácilmente editables según documentación del backend)
// ============================================================================
export const CASILLA_ENDPOINTS = {
  /**
   * GET /api/v1/casilla/notificaciones
   * Query params: page, limit, tipo, estado, fechaInicio, fechaFin, busqueda
   */
  LISTAR_NOTIFICACIONES: "/api/v1/casilla/notificaciones",

  /**
   * GET /api/v1/casilla/notificaciones/:id
   * Obtiene el detalle completo del acto administrativo y notificación
   */
  DETALLE_NOTIFICACION: (id: string) => `/api/v1/casilla/notificaciones/${id}`,

  /**
   * PATCH /api/v1/casilla/notificaciones/:id/lectura
   * Registra el primer acceso/lectura del administrado
   */
  MARCAR_LEIDO: (id: string) => `/api/v1/casilla/notificaciones/${id}/lectura`,

  /**
   * POST /api/v1/casilla/notificaciones/:id/acuse
   * Solicita al backend la generación inmutable del acuse digital legal
   * Body: { confirmacionAdministrado: boolean }
   * Response: { success: boolean, data: AcuseNotificacion (con timestamp ISO-8601 y hash SHA-256) }
   */
  GENERAR_ACUSE: (id: string) => `/api/v1/casilla/notificaciones/${id}/acuse`,

  /**
   * GET /api/v1/casilla/estadisticas
   * Retorna métricas de la casilla (no leídos, notificados, etc.)
   */
  ESTADISTICAS: "/api/v1/casilla/estadisticas",

  /**
   * GET /api/v1/casilla/notificaciones/:id/documento/descargar
   * Descarga el acto administrativo en PDF
   */
  DESCARGAR_DOCUMENTO: (id: string) =>
    `/api/v1/casilla/notificaciones/${id}/documento/descargar`,

  /**
   * GET /api/v1/casilla/notificaciones/:id/acuse/descargar
   * Descarga la cédula oficial de acuse de recibo en PDF
   */
  DESCARGAR_ACUSE: (id: string) =>
    `/api/v1/casilla/notificaciones/${id}/acuse/descargar`,
} as const;

// Modo de desarrollo: usar fixtures si la API aún no está disponible
const MOCK_STORAGE_KEY = "sigd_casilla_mock_data_v1";

// ============================================================================
// FIXTURES / MOCK DATA (Alineado a Ley N° 27444 y Ley N° 29733 - IESTP Suiza)
// ============================================================================
const MOCK_NOTIFICACIONES_INICIALES: Notificacion[] = [
  {
    id: "NOT-2026-000184",
    numeroNotificacion: "NOT-2026-000184",
    numeroExpediente: "EXP-2026-000184",
    asunto:
      "Aprobación de Expediente de Titulación y Emisión de Título Profesional Técnico en Desarrollo de Sistemas de Información",
    tipo: "RESOLUCION",
    estado: "NO_LEIDO",
    prioridad: "ALTA",
    unidadEmisora: "Dirección General - Secretaría Académica",
    responsableEmision: "Ing. Rolando Ramírez Peña (Director General)",
    fechaDepositoIso: "2026-09-10T14:35:20.000Z",
    fechaLecturaIso: null,
    fechaNotificadoIso: null,
    requiereAcuse: true,
    actoAdministrativo: {
      tipoActo: "Resolución Directoral",
      numeroDocumento: "RD N.° 0412-2026-DG-IESTP-SUIZA",
      anio: 2026,
      asunto:
        "DECLARAR EXPEDITO y APROBAR el otorgamiento del Título Profesional Técnico a favor del administrado tras cumplir la totalidad de créditos y prácticas preprofesionales reglamentarias.",
      resumenLegal:
        "Visto el Expediente N.° EXP-2026-000184 tramitado ante la Secretaría Académica del IESTP 'Suiza', que contiene el Dictamen Favorable de Titulación N.° 058-2026-DA-DSI, acreditando la culminación del plan de estudios 2023-2026 con 132 créditos académicos aprobados y 720 horas de experiencias formativas en situaciones reales de trabajo.",
      textoCompleto:
        "SE RESUELVE:\n\nArtículo 1°.- DECLARAR EXPEDITO al administrado para la colación del Título Profesional Técnico en Desarrollo de Sistemas de Información.\n\nArtículo 2°.- DISPONER la inscripción del diploma en el Registro Institucional de Títulos y su posterior remisión al Ministerio de Educación (MINEDU).\n\nArtículo 3°.- NOTIFICAR el presente acto resolutivo a la Casilla Electrónica Institucional del interesado conforme a lo dispuesto en el Artículo 20 del TUO de la Ley N° 27444.",
      nombreArchivoPdf: "RD-0412-2026-DG-IESTP-SUIZA.pdf",
      tamanoArchivo: "1.45 MB",
      hashIntegridadSha256:
        "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      cvd: "CVD-2026-RD-0412-7F83B1",
      firmantes: [
        {
          nombre: "Ing. Rolando Ramírez Peña",
          cargo: "Director General - IESTP Suiza",
          fechaFirma: "10/09/2026 14:10:15 UTC-5",
          entidadCertificadora: "RENIEC / Refirma Digital",
        },
        {
          nombre: "Lic. María Fernanda López",
          cargo: "Secretaria Académica - IESTP Suiza",
          fechaFirma: "10/09/2026 13:45:00 UTC-5",
          entidadCertificadora: "RENIEC / Refirma Digital",
        },
      ],
    },
    acuse: null,
  },
  {
    id: "NOT-2026-000179",
    numeroNotificacion: "NOT-2026-000179",
    numeroExpediente: "EXP-2026-000179",
    asunto:
      "Observación y Pliego de Subsanación en Trámite de Convalidación de Asignaturas Semestre Académico 2026-II",
    tipo: "NOTIFICACION_OBSERVACION",
    estado: "LEIDO",
    prioridad: "URGENTE",
    unidadEmisora: "Coordinación del Área Académica de Informática",
    responsableEmision: "Mag. Carlos Enrique Dávila Ruiz",
    fechaDepositoIso: "2026-09-08T10:15:00.000Z",
    fechaLecturaIso: "2026-09-08T16:22:45.000Z",
    fechaNotificadoIso: null,
    requiereAcuse: true,
    actoAdministrativo: {
      tipoActo: "Cédula de Notificación de Observación",
      numeroDocumento: "NOT-OBS N.° 0034-2026-CAAI-IESTP-SUIZA",
      anio: 2026,
      asunto:
        "Se requiere adjuntar los sílabos oficiales visados de la institución de origen correspondientes a las asignaturas de Base de Datos Avanzada y Redes Corporativas.",
      resumenLegal:
        "De conformidad con el Reglamento Institucional de Convalidaciones del IESTP Suiza y el Art. 136 del TUO de la Ley N° 27444, se concede al administrado un plazo perentorio de diez (10) días hábiles para subsanar los requisitos documentarios observados.",
      textoCompleto:
        "REQUERIMIENTO DE SUBSANACIÓN:\n\n1. Presentar en Mesa de Partes Digital los sílabos originales visados.\n2. Copia legible del Certificado Oficial de Estudios Superiores.\n\nEl cómputo del plazo de subsanación rige a partir del día hábil siguiente de generado el acuse en esta Casilla Electrónica.",
      nombreArchivoPdf: "NOT-OBS-0034-2026-IESTP-SUIZA.pdf",
      tamanoArchivo: "845 KB",
      hashIntegridadSha256:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      cvd: "CVD-2026-OBS-0034-E3B0C4",
      firmantes: [
        {
          nombre: "Mag. Carlos Enrique Dávila Ruiz",
          cargo: "Coordinador de Informática",
          fechaFirma: "08/09/2026 09:50:11 UTC-5",
          entidadCertificadora: "Firma Digital IOFE-INDECOPI",
        },
      ],
    },
    acuse: null,
  },
  {
    id: "NOT-2026-000155",
    numeroNotificacion: "NOT-2026-000155",
    numeroExpediente: "EXP-2026-000155",
    asunto:
      "Convocatoria Oficial a Ceremonia Solemne de Graduación y Entrega de Diplomas Promoción 2026",
    tipo: "OFICIO",
    estado: "NOTIFICADO",
    prioridad: "NORMAL",
    unidadEmisora: "Secretaría General e Imagen Institucional",
    responsableEmision: "Dr. Víctor Raúl Meléndez",
    fechaDepositoIso: "2026-09-02T09:00:00.000Z",
    fechaLecturaIso: "2026-09-02T11:15:30.000Z",
    fechaNotificadoIso: "2026-09-02T11:16:05.000Z",
    requiereAcuse: true,
    actoAdministrativo: {
      tipoActo: "Oficio Múltiple",
      numeroDocumento: "OF-MULT N.° 0089-2026-SG-IESTP-SUIZA",
      anio: 2026,
      asunto:
        "Cronograma, ensayo general y protocolo de vestimenta académica para la Ceremonia de Graduación a llevarse a cabo en el Auditorio Central del IESTP Suiza.",
      resumenLegal:
        "Se convoca a los egresados aptos de los programas de Desarrollo de Sistemas, Enfermería Técnica y Mecánica Automotriz al acto protocolar oficial el día viernes 26 de septiembre de 2026 a horas 18:00.",
      textoCompleto:
        "OFICIO MÚLTIPLE N.° 0089-2026-SG-IESTP-SUIZA:\n\nPor medio del presente, la Dirección General y la Secretaría Académica expresan su cordial saludo y hacen de su conocimiento las disposiciones protocolares para la Magna Ceremonia de Graduación.",
      nombreArchivoPdf: "OF-MULT-0089-2026-IESTP-SUIZA.pdf",
      tamanoArchivo: "2.10 MB",
      hashIntegridadSha256:
        "9b73c93d7798ec3bf09bed4642f930f4e80fb5f9738c15258269d6b844f0430e",
      cvd: "CVD-2026-OFM-0089-9B73C9",
      firmantes: [
        {
          nombre: "Dr. Víctor Raúl Meléndez",
          cargo: "Secretario General",
          fechaFirma: "02/09/2026 08:40:00 UTC-5",
          entidadCertificadora: "RENIEC / Refirma",
        },
      ],
    },
    acuse: {
      idAcuse: "ACU-2026-000155",
      idNotificacion: "NOT-2026-000155",
      numeroExpediente: "EXP-2026-000155",
      destinatario: {
        idPersona: 104,
        nombresCompletos: "Sergio Serruche Panduro",
        numeroDocumento: "74561238",
        tipoDocumento: "DNI",
        direccionCasilla: "74561238@casilla.iestpsuiza.edu.pe",
        correoPersonal: "sergio.serruche@estudiante.iestpsuiza.edu.pe",
        telefonoContacto: "+51 961234567",
      },
      timestampGeneracionIso: "2026-09-02T11:16:05.184Z",
      hashSha256Acuse:
        "c4ca4238a0b923820dcc509a6f75849b23b0c44298fc1c149afbf4c8996fb924",
      cvdAcuse: "CVD-2026-ACU-000155-C4CA42",
      entidadEmisora:
        "Instituto de Educación Superior Tecnológico Público Suiza (Pucallpa)",
      unidadEmisora: "Secretaría General e Imagen Institucional",
      fechaEfectoLegal: "02/09/2026 11:16:05 (Mismo día del depósito formal)",
      plazoImpugnacionDiasHabiles: 15,
      fechaLimiteImpugnacion: "24/09/2026",
      ipRegistro: "190.237.142.88",
      validezLegalMensaje:
        "Cédula de Acuse de Recibo Electrónico generada conforme al Artículo 20 del TUO de la Ley N° 27444. Certifica la recepción y conocimiento legal del acto notificado.",
    },
  },
  {
    id: "NOT-2026-000132",
    numeroNotificacion: "NOT-2026-000132",
    numeroExpediente: "EXP-2026-000132",
    asunto:
      "Emisión y Entrega de Constancia Oficial de Egresado y Cuadro de Mérito Académico",
    tipo: "CONSTANCIA",
    estado: "NOTIFICADO",
    prioridad: "NORMAL",
    unidadEmisora: "Oficina de Registros Académicos y Archivo",
    responsableEmision: "Lic. Andrea Morales Vásquez",
    fechaDepositoIso: "2026-08-25T15:10:00.000Z",
    fechaLecturaIso: "2026-08-25T16:05:12.000Z",
    fechaNotificadoIso: "2026-08-25T16:06:00.000Z",
    requiereAcuse: true,
    actoAdministrativo: {
      tipoActo: "Constancia Oficial",
      numeroDocumento: "CONST N.° 0214-2026-ORA-IESTP-SUIZA",
      anio: 2026,
      asunto:
        "Constancia de Egresado acreditando Pertenencia al Tercio Superior de la Promoción 2026 del Programa de Desarrollo de Sistemas de Información.",
      resumenLegal:
        "Se deja constancia fehaciente de que el estudiante egresado ha obtenido un Promedio Ponderado Acumulado de 17.85 sobre 20, ubicándose en el orden de mérito N° 02.",
      nombreArchivoPdf: "CONST-0214-2026-IESTP-SUIZA.pdf",
      tamanoArchivo: "620 KB",
      hashIntegridadSha256:
        "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
      cvd: "CVD-2026-CST-0214-A591A6",
      firmantes: [
        {
          nombre: "Lic. Andrea Morales Vásquez",
          cargo: "Jefa de Registros Académicos",
          fechaFirma: "25/08/2026 14:50:00 UTC-5",
          entidadCertificadora: "RENIEC / Refirma",
        },
      ],
    },
    acuse: {
      idAcuse: "ACU-2026-000132",
      idNotificacion: "NOT-2026-000132",
      numeroExpediente: "EXP-2026-000132",
      destinatario: {
        nombresCompletos: "Sergio Serruche Panduro",
        numeroDocumento: "74561238",
        tipoDocumento: "DNI",
        direccionCasilla: "74561238@casilla.iestpsuiza.edu.pe",
      },
      timestampGeneracionIso: "2026-08-25T16:06:00.320Z",
      hashSha256Acuse:
        "13b8606411516e87a2d480ee278772a1cd70cf843818e6ecad3ec9c5eb67fe08",
      cvdAcuse: "CVD-2026-ACU-000132-13B860",
      entidadEmisora: "IESTP Suiza",
      unidadEmisora: "Oficina de Registros Académicos y Archivo",
      fechaEfectoLegal: "25/08/2026 16:06:00 UTC-5",
      plazoImpugnacionDiasHabiles: 15,
      validezLegalMensaje:
        "Acuse emitido con pleno valor probatorio en sede administrativa.",
    },
  },
  {
    id: "NOT-2026-000118",
    numeroNotificacion: "NOT-2026-000118",
    numeroExpediente: "EXP-2026-000118",
    asunto:
      "Citación a Audiencia de Sustentación Oral y Demostración de Proyecto de Innovación Tecnológica",
    tipo: "CITACION",
    estado: "NO_LEIDO",
    prioridad: "URGENTE",
    unidadEmisora: "Jurado Calificador de Grados y Títulos",
    responsableEmision: "Ing. Marco Aurelio Sangama",
    fechaDepositoIso: "2026-09-11T07:45:00.000Z",
    fechaLecturaIso: null,
    fechaNotificadoIso: null,
    requiereAcuse: true,
    actoAdministrativo: {
      tipoActo: "Cédula de Citación Oficial",
      numeroDocumento: "CIT-N.° 0019-2026-JCGT-IESTP-SUIZA",
      anio: 2026,
      asunto:
        "Citación a Sustentación: Proyecto 'Sistema Integral de Gestión Documentaria para el IESTP Suiza'. Fecha fijada: 18 de septiembre de 2026 a las 10:00 AM.",
      resumenLegal:
        "El Presidente del Jurado Evaluador cita al postulante titular para la sustentación y defensa de su trabajo aplicativo ante el tribunal colegiado.",
      nombreArchivoPdf: "CIT-0019-2026-IESTP-SUIZA.pdf",
      tamanoArchivo: "710 KB",
      hashIntegridadSha256:
        "4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865",
      cvd: "CVD-2026-CIT-0019-4355A4",
      firmantes: [
        {
          nombre: "Ing. Marco Aurelio Sangama",
          cargo: "Presidente del Jurado Calificador",
          fechaFirma: "11/09/2026 07:30:00 UTC-5",
          entidadCertificadora: "RENIEC / Refirma",
        },
      ],
    },
    acuse: null,
  },
  {
    id: "NOT-2026-000095",
    numeroNotificacion: "NOT-2026-000095",
    numeroExpediente: "EXP-2026-000095",
    asunto:
      "Informe Técnico de Validación de Experiencias Formativas en Situaciones Reales de Trabajo (EFSRT)",
    tipo: "INFORME",
    estado: "LEIDO",
    prioridad: "NORMAL",
    unidadEmisora: "Coordinación de Empleabilidad y Prácticas",
    responsableEmision: "Lic. Carmen Rosa Inga",
    fechaDepositoIso: "2026-08-18T11:20:00.000Z",
    fechaLecturaIso: "2026-08-19T09:14:00.000Z",
    fechaNotificadoIso: null,
    requiereAcuse: false,
    actoAdministrativo: {
      tipoActo: "Informe Técnico",
      numeroDocumento: "INF-TEC N.° 0045-2026-CEP-IESTP-SUIZA",
      anio: 2026,
      asunto:
        "Conformidad de cumplimiento de 720 horas de prácticas en el área de desarrollo de software del Gobierno Regional de Ucayali.",
      resumenLegal:
        "Habiéndose revisado los informes de desempeño y cartas de supervisión, se emite OPINIÓN FAVORABLE para la convalidación del módulo III de prácticas.",
      nombreArchivoPdf: "INF-TEC-0045-2026-IESTP-SUIZA.pdf",
      tamanoArchivo: "1.12 MB",
      hashIntegridadSha256:
        "53c234e5e8472b6ac51c1ae1cab3fe06fad053beb8ebfd8977b010655bfdd3c3",
      cvd: "CVD-2026-INF-0045-53C234",
      firmantes: [
        {
          nombre: "Lic. Carmen Rosa Inga",
          cargo: "Coordinadora de Prácticas",
          fechaFirma: "18/08/2026 10:55:00 UTC-5",
        },
      ],
    },
    acuse: null,
  },
];

// Helper para persistencia local de demostración
function getStoredMockData(): Notificacion[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(
        MOCK_STORAGE_KEY,
        JSON.stringify(MOCK_NOTIFICACIONES_INICIALES),
      );
      return MOCK_NOTIFICACIONES_INICIALES;
    }
    return JSON.parse(raw);
  } catch {
    return MOCK_NOTIFICACIONES_INICIALES;
  }
}

function saveStoredMockData(data: Notificacion[]): void {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("No se pudo persistir en localStorage:", error);
  }
}

// ============================================================================
// SERVICIO DE CASILLA ELECTRÓNICA
// ============================================================================
export const casillaService = {
  /**
   * Obtiene el listado paginado de notificaciones aplicando filtros de tipo, fecha y estado
   */
  async getNotificaciones(
    filtros: FiltrosCasilla,
  ): Promise<NotificacionesResponse> {
    try {
      // Intentar llamada al backend real
      const response = await apiClient.get<NotificacionesResponse>(
        CASILLA_ENDPOINTS.LISTAR_NOTIFICACIONES,
        {
          params: {
            page: filtros.page,
            limit: filtros.limit,
            tipo: filtros.tipo !== "TODOS" ? filtros.tipo : undefined,
            estado: filtros.estado !== "TODOS" ? filtros.estado : undefined,
            fechaInicio: filtros.fechaInicio || undefined,
            fechaFin: filtros.fechaFin || undefined,
            busqueda: filtros.busqueda || undefined,
          },
        },
      );
      return response.data;
    } catch {
      // Fallback a Fixtures Mock
      const allData = getStoredMockData();

      // Aplicar filtros en memoria
      const filtrados = allData.filter((item) => {
        // Filtro por tipo
        if (filtros.tipo && filtros.tipo !== "TODOS" && item.tipo !== filtros.tipo) {
          return false;
        }
        // Filtro por estado
        if (
          filtros.estado &&
          filtros.estado !== "TODOS" &&
          item.estado !== filtros.estado
        ) {
          return false;
        }
        // Filtro por rango de fechas (fechaDepositoIso)
        if (filtros.fechaInicio) {
          const itemDate = item.fechaDepositoIso.slice(0, 10);
          if (itemDate < filtros.fechaInicio) return false;
        }
        if (filtros.fechaFin) {
          const itemDate = item.fechaDepositoIso.slice(0, 10);
          if (itemDate > filtros.fechaFin) return false;
        }
        // Filtro por texto libre
        if (filtros.busqueda && filtros.busqueda.trim() !== "") {
          const q = filtros.busqueda.trim().toLowerCase();
          const matchNum = item.numeroNotificacion.toLowerCase().includes(q);
          const matchExp = item.numeroExpediente.toLowerCase().includes(q);
          const matchAsunto = item.asunto.toLowerCase().includes(q);
          const matchActo = item.actoAdministrativo.numeroDocumento
            .toLowerCase()
            .includes(q);
          if (!matchNum && !matchExp && !matchAsunto && !matchActo) {
            return false;
          }
        }
        return true;
      });

      // Paginación
      const page = Math.max(1, filtros.page || 1);
      const limit = Math.max(1, filtros.limit || 5);
      const totalItems = filtrados.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const startIndex = (page - 1) * limit;
      const paginatedData = filtrados.slice(startIndex, startIndex + limit);

      return {
        data: paginatedData,
        meta: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }
  },

  /**
   * Obtiene una notificación por su identificador
   */
  async getNotificacionById(id: string): Promise<Notificacion> {
    try {
      const response = await apiClient.get<Notificacion>(
        CASILLA_ENDPOINTS.DETALLE_NOTIFICACION(id),
      );
      return response.data;
    } catch {
      const allData = getStoredMockData();
      const notificacion = allData.find((n) => n.id === id);
      if (!notificacion) {
        throw new Error(`Notificación con ID ${id} no encontrada.`);
      }
      return notificacion;
    }
  },

  /**
   * Marca una notificación como LEÍDA tras su apertura en el modal
   */
  async marcarComoLeido(id: string): Promise<Notificacion> {
    try {
      const response = await apiClient.patch<Notificacion>(
        CASILLA_ENDPOINTS.MARCAR_LEIDO(id),
      );
      return response.data;
    } catch {
      const allData = getStoredMockData();
      const index = allData.findIndex((n) => n.id === id);
      if (index === -1) {
        throw new Error(`Notificación con ID ${id} no encontrada.`);
      }

      // Si estaba en NO_LEIDO, transicionar a LEIDO (si ya está NOTIFICADO, preservarlo)
      const actual = allData[index];
      if (actual.estado === "NO_LEIDO") {
        const actualizada: Notificacion = {
          ...actual,
          estado: "LEIDO",
          fechaLecturaIso: new Date().toISOString(),
        };
        allData[index] = actualizada;
        saveStoredMockData(allData);
        return actualizada;
      }
      return actual;
    }
  },

  /**
   * Genera el Acuse Digital Legal (Fecha cierta ISO-8601 + Hash SHA-256 + CVD)
   * ¡IMPORTANTE!: Los valores criptográficos y de tiempo son provistos por el servidor.
   * El cliente solo los solicita formalmente y los visualiza.
   */
  async generarAcuseLegal(
    notificacionId: string,
    payload?: Partial<GenerarAcuseRequest>,
  ): Promise<GenerarAcuseResponse> {
    try {
      const response = await apiClient.post<GenerarAcuseResponse>(
        CASILLA_ENDPOINTS.GENERAR_ACUSE(notificacionId),
        {
          notificacionId,
          confirmacionAdministrado: true,
          metadataCliente: {
            navegador: navigator.userAgent,
            zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ...payload?.metadataCliente,
          },
        },
      );
      return response.data;
    } catch {
      // Simulación de respuesta segura del backend con sello de tiempo y SHA-256
      const allData = getStoredMockData();
      const notifIndex = allData.findIndex((n) => n.id === notificacionId);
      if (notifIndex === -1) {
        throw new Error("La notificación no existe en el sistema.");
      }

      const notif = allData[notifIndex];
      const ahora = new Date();
      const isoTimestamp = ahora.toISOString();

      // Cálculo formal de perfeccionamiento legal según Art. 20 Ley N° 27444
      // Depósito posterior a las 16:30 hrs surte efecto al primer día hábil siguiente
      const horaActual = ahora.getHours() + ahora.getMinutes() / 60;
      let mensajeEfecto = "Surtimiento de efectos legales inmediato.";
      if (horaActual >= 16.5) {
        mensajeEfecto =
          "Depositado después de las 16:30 hrs. Surte efectos legales el primer día hábil siguiente a las 08:00 hrs (Art. 20 TUO Ley N° 27444).";
      }

      // Hash simulado provisto por TSA/Servidor
      const mockSha256 =
        "d2c88e99b0487311756be2efd4924b17a0a64931a7ff7fa5f5f7267104b2b2a6";
      const idAcuseGen = `ACU-2026-${notif.id.replace("NOT-2026-", "") || "000999"}`;
      const cvdGen = `CVD-2026-ACU-${idAcuseGen.slice(-6)}-D2C8`;

      const nuevoAcuse: AcuseNotificacion = {
        idAcuse: idAcuseGen,
        idNotificacion: notif.id,
        numeroExpediente: notif.numeroExpediente,
        destinatario: {
          idPersona: 104,
          nombresCompletos: "Sergio Serruche Panduro",
          numeroDocumento: "74561238",
          tipoDocumento: "DNI",
          direccionCasilla: "74561238@casilla.iestpsuiza.edu.pe",
          correoPersonal: "sergio.serruche@estudiante.iestpsuiza.edu.pe",
          telefonoContacto: "+51 961234567",
        },
        timestampGeneracionIso: isoTimestamp,
        hashSha256Acuse: mockSha256,
        cvdAcuse: cvdGen,
        entidadEmisora: "IESTP Suiza (Pucallpa)",
        unidadEmisora: notif.unidadEmisora,
        fechaEfectoLegal: mensajeEfecto,
        plazoImpugnacionDiasHabiles: 15,
        fechaLimiteImpugnacion: new Date(
          ahora.getTime() + 15 * 24 * 60 * 60 * 1000,
        ).toLocaleDateString("es-PE"),
        ipRegistro: "190.237.142.88",
        validezLegalMensaje:
          "Acuse Electrónico Inmutable con Certificado de Sello de Tiempo UTC e Integridad SHA-256.",
      };

      const notificacionActualizada: Notificacion = {
        ...notif,
        estado: "NOTIFICADO",
        fechaNotificadoIso: isoTimestamp,
        acuse: nuevoAcuse,
      };

      allData[notifIndex] = notificacionActualizada;
      saveStoredMockData(allData);

      return {
        success: true,
        message: "Acuse de Notificación Electrónica generado y sellado con éxito.",
        data: nuevoAcuse,
        notificacionActualizada,
      };
    }
  },

  /**
   * Obtiene estadísticas de la casilla del usuario
   */
  async getEstadisticas(): Promise<EstadisticasCasilla> {
    try {
      const response = await apiClient.get<EstadisticasCasilla>(
        CASILLA_ENDPOINTS.ESTADISTICAS,
      );
      return response.data;
    } catch {
      const allData = getStoredMockData();
      const noLeidos = allData.filter((n) => n.estado === "NO_LEIDO").length;
      const leidos = allData.filter((n) => n.estado === "LEIDO").length;
      const notificados = allData.filter((n) => n.estado === "NOTIFICADO").length;
      const urgentes = allData.filter(
        (n) => n.prioridad === "URGENTE" && n.estado !== "NOTIFICADO",
      ).length;

      return {
        total: allData.length,
        noLeidos,
        leidos,
        notificados,
        urgentes,
      };
    }
  },

  /**
   * Simula la descarga o apertura del acto administrativo PDF
   */
  descargarDocumento(notificacion: Notificacion): void {
    const filename =
      notificacion.actoAdministrativo.nombreArchivoPdf || "acto_notificado.pdf";
    // Generar un blob simulado con texto representativo o abrir enlace
    const contenido = `--- INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO SUIZA ---
CÉDULA DE NOTIFICACIÓN OFICIAL / ACTO ADMINISTRATIVO
Expediente: ${notificacion.numeroExpediente}
Documento: ${notificacion.actoAdministrativo.numeroDocumento}
Asunto: ${notificacion.asunto}
Hash SHA-256: ${notificacion.actoAdministrativo.hashIntegridadSha256}
CVD: ${notificacion.actoAdministrativo.cvd}
Fecha Emisión: ${notificacion.fechaDepositoIso}

${notificacion.actoAdministrativo.resumenLegal}

${notificacion.actoAdministrativo.textoCompleto || ""}
`;
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Simula la descarga oficial de la Cédula de Acuse Digital Legal
   */
  descargarAcuse(acuse: AcuseNotificacion): void {
    const filename = `ACUSE_LEGAL_${acuse.idAcuse}.txt`;
    const contenido = `================================================================================
INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO SUIZA (IESTP SUIZA)
CONSTANCIA Y CÉDULA DE ACUSE DE NOTIFICACIÓN ELECTRÓNICA INSTITUCIONAL
Conforme al Artículo 20 del TUO de la Ley N° 27444 y Ley N° 29733
================================================================================

IDENTIFICADOR DE ACUSE : ${acuse.idAcuse}
EXPEDIENTE              : ${acuse.numeroExpediente}
UNIDAD EMISORA          : ${acuse.unidadEmisora}
DESTINATARIO            : ${acuse.destinatario.nombresCompletos}
DOCUMENTO IDENTIDAD     : ${acuse.destinatario.tipoDocumento} ${acuse.destinatario.numeroDocumento}
CASILLA ELECTRÓNICA     : ${acuse.destinatario.direccionCasilla}

FECHA Y HORA UTC (ISO)  : ${acuse.timestampGeneracionIso}
HASH CRIPTOGRÁFICO SHA256: ${acuse.hashSha256Acuse}
CÓDIGO VERIFICACIÓN (CVD): ${acuse.cvdAcuse}
SURTIMIENTO DE EFECTO   : ${acuse.fechaEfectoLegal}
PLAZO LEGAL DE IMPUGN.  : ${acuse.plazoImpugnacionDiasHabiles} días hábiles

VALIDEZ LEGAL:
${acuse.validezLegalMensaje}

Este documento digital cuenta con valor probatorio inmutable en sede administrativa.
================================================================================`;
    const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Restablece los datos de demostración
   */
  resetMockData(): void {
    localStorage.removeItem(MOCK_STORAGE_KEY);
  },
};
