import type {
  AcuseNotificacion,
  FiltrosCasilla,
  Notificacion,
  PaginationMeta,
} from "../../types/casilla";

export const notificacion: Notificacion = {
  id: "notif-1",
  numeroNotificacion: "NOT-2026-000001",
  numeroExpediente: "EXP-2026-000001",
  asunto: "Resolución de prueba",
  tipo: "RESOLUCION",
  estado: "NO_LEIDO",
  prioridad: "URGENTE",
  unidadEmisora: "Secretaría Académica",
  fechaDepositoIso: "2026-01-12T10:00:00.000Z",
  fechaLecturaIso: null,
  fechaNotificadoIso: null,
  requiereAcuse: true,
  actoAdministrativo: {
    tipoActo: "Resolución Directoral",
    numeroDocumento: "RD-001-2026",
    anio: 2026,
    asunto: "Resolución de prueba",
    resumenLegal: "Resumen legal de prueba",
    textoCompleto: "Texto íntegro del acto",
    nombreArchivoPdf: "resolucion.pdf",
    tamanoArchivo: "120 KB",
    hashIntegridadSha256: "a".repeat(64),
    cvd: "CVD-2026-001",
    firmantes: [
      {
        nombre: "María Pérez",
        cargo: "Directora",
        fechaFirma: "2026-01-12",
        entidadCertificadora: "RENIEC",
      },
    ],
  },
};

export const acuse: AcuseNotificacion = {
  idAcuse: "ACU-2026-000001",
  idNotificacion: notificacion.id,
  numeroExpediente: notificacion.numeroExpediente,
  destinatario: {
    nombresCompletos: "Ana Ciudadana",
    numeroDocumento: "12345678",
    tipoDocumento: "DNI",
    direccionCasilla: "12345678@casilla.iestpsuiza.edu.pe",
  },
  timestampGeneracionIso: "2026-01-12T10:30:00.000Z",
  hashSha256Acuse: "b".repeat(64),
  cvdAcuse: "CVD-ACU-2026-001",
  entidadEmisora: "IESTP Suiza",
  unidadEmisora: "Secretaría Académica",
  fechaEfectoLegal: "2026-01-13",
  plazoImpugnacionDiasHabiles: 15,
  fechaLimiteImpugnacion: "2026-02-03",
  validezLegalMensaje: "Acuse válido conforme a ley.",
};

export const filtrosIniciales: FiltrosCasilla = {
  tipo: "TODOS",
  estado: "TODOS",
  fechaInicio: "",
  fechaFin: "",
  busqueda: "",
  page: 1,
  limit: 5,
};

export const metaInicial: PaginationMeta = {
  currentPage: 1,
  totalPages: 1,
  totalItems: 1,
  itemsPerPage: 5,
  hasNextPage: false,
  hasPreviousPage: false,
};
