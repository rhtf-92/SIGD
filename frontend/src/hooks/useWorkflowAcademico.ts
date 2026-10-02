import { useCallback, useMemo, useState } from "react";

import type {
  EstadoEtapaWorkflow,
  EstadoTramite,
  EtapaWorkflowVisual,
  WorkflowAcademico,
} from "../types/workflowAcademico";
import { TRANSICIONES_FSM } from "../types/workflowAcademico";

const AHORA = (): string => new Date().toISOString();

function generarHashSha256Demo(origen: string): string {
  let hash = 0;
  for (let indice = 0; indice < origen.length; indice += 1) {
    hash = (hash << 5) - hash + origen.charCodeAt(indice);
    hash |= 0;
  }
  const semilla = (hash >>> 0).toString(16).padStart(8, "0");
  return Array.from({ length: 8 }, () => semilla).join("").slice(0, 64);
}

function crearTramiteDemo(
  overrides?: Partial<
    Pick<
      WorkflowAcademico,
      | "idTramite"
      | "cut"
      | "nombreTramite"
      | "programa"
      | "solicitante"
      | "estado"
      | "etapaActualId"
    >
  >,
): WorkflowAcademico {
  return {
    idTramite: 412,
    cut: "EXP-2026-000412",
    codigoProcedimiento: "PROC-ACA-01",
    nombreTramite: "Solicitud de Título Profesional Técnico",
    programa: "Desarrollo de Sistemas de Información (DSI)",
    solicitante: {
      idPersona: 2941,
      numeroDocumento: "45217893",
      nombres: "Carlos Eduardo",
      apellidos: "Mendoza Ríos",
      correoElectronico: "cmendoza@alumno.institutosuiza.edu.pe",
    },
    estado: "EN_TRAMITE",
    etapaActualId: 1,
    ...overrides,
    slaDiasTotales: 30,
    fechaRegistro: "2026-09-05T11:05:00-05:00",
    fechaLimiteSla: "2026-10-16T17:00:00-05:00",
    etapas: [
      {
        idEtapa: 1,
        orden: 1,
        codigo: "ETAPA-01",
        nombreEtapa: "Expedito",
        unidadOrganica: "Secretaría Académica",
        rolResponsable: "responsable",
        plazoSlaDias: 5,
        descripcion:
          "Declaratoria de expedito: egreso regular del plan de estudios y constancia de egreso del administrado.",
        requisitos: [
          {
            idRequisito: 101,
            descripcion: "Créditos del plan de estudios aprobados al 100%",
            cumplido: true,
            fechaCumplimiento: "2026-08-28T10:00:00-05:00",
          },
          {
            idRequisito: 102,
            descripcion: "Constancia de egreso emitida por Secretaría Académica",
            cumplido: true,
            fechaCumplimiento: "2026-09-01T09:30:00-05:00",
          },
        ],
        fechaInicio: "2026-09-05T12:00:00-05:00",
      },
      {
        idEtapa: 2,
        orden: 2,
        codigo: "ETAPA-02",
        nombreEtapa: "Prácticas Preprofesionales (EFSRT)",
        unidadOrganica: "Coordinación de la Carrera DSI",
        rolResponsable: "responsable",
        plazoSlaDias: 5,
        descripcion:
          "Acreditación de experiencias formativas en situaciones reales de trabajo y conformidad curricular.",
        requisitos: [
          {
            idRequisito: 201,
            descripcion:
              "Acreditación de EFSRT / Prácticas Preprofesionales (384 horas)",
            cumplido: false,
          },
          {
            idRequisito: 202,
            descripcion:
              "Conformidad técnica de malla curricular y notas aprobatorias",
            cumplido: false,
          },
          {
            idRequisito: 203,
            descripcion: "No adeudo de libros, materiales o instrumentos de taller",
            cumplido: false,
          },
        ],
      },
      {
        idEtapa: 3,
        orden: 3,
        codigo: "ETAPA-03",
        nombreEtapa: "Jurado y Sustentación",
        unidadOrganica: "Secretaría Académica / Jurado Evaluador",
        rolResponsable: "operador",
        plazoSlaDias: 10,
        descripcion:
          "Designación del jurado evaluador, sustentación del proyecto y acta con dictamen favorable (puerta de paso obligatoria a la etapa resolutiva).",
        requisitos: [
          {
            idRequisito: 301,
            descripcion: "Resolución de designación de jurado evaluador",
            cumplido: false,
          },
          {
            idRequisito: 302,
            descripcion: "Acta de examen profesional firmada por el jurado",
            cumplido: false,
          },
          {
            idRequisito: 303,
            descripcion: "Dictamen favorable del jurado con nota mayor o igual a 13",
            cumplido: false,
          },
        ],
      },
      {
        idEtapa: 4,
        orden: 4,
        codigo: "ETAPA-04",
        nombreEtapa: "Emisión de Resolución",
        unidadOrganica: "Dirección General",
        rolResponsable: "admin",
        plazoSlaDias: 5,
        descripcion:
          "Proyección y emisión del acto resolutivo institucional (Visto, Considerando y Se Resuelve). Bloqueada sin dictamen favorable de jurado.",
        requisitos: [
          {
            idRequisito: 401,
            descripcion: "Borrador RD con bloques Visto / Considerando / Se Resuelve",
            cumplido: false,
          },
          {
            idRequisito: 402,
            descripcion: "Dictamen favorable conjunto de las áreas precedentes",
            cumplido: false,
          },
        ],
      },
      {
        idEtapa: 5,
        orden: 5,
        codigo: "ETAPA-05",
        nombreEtapa: "Registro MinEdu, Diploma y Asiento",
        unidadOrganica: "Dirección General",
        rolResponsable: "admin",
        plazoSlaDias: 5,
        descripcion:
          "Firma PAdES-BES con TSA vía Refirma RENIEC, estampa CVD/QR, asiento en libro oficial y registro del título ante MinEdu.",
        requisitos: [
          {
            idRequisito: 501,
            descripcion: "Firma digital PAdES-BES con sellado de tiempo TSA",
            cumplido: false,
          },
          {
            idRequisito: 502,
            descripcion: "Estampa de Código de Verificación Digital (CVD) y QR",
            cumplido: false,
          },
          {
            idRequisito: 503,
            descripcion: "Asiento en el Libro Oficial y registro del título ante MinEdu",
            cumplido: false,
          },
        ],
      },
    ],
  };
}

function derivarEtapasVisuales(tramite: WorkflowAcademico): EtapaWorkflowVisual[] {
  const posicionActual = tramite.etapas.findIndex(
    (etapa) => etapa.idEtapa === tramite.etapaActualId,
  );

  return tramite.etapas.map((etapa, posicion) => {
    let estadoVisual: EstadoEtapaWorkflow;

    if (tramite.estado === "RESUELTO") {
      estadoVisual = "COMPLETADA";
    } else if (tramite.estado === "ANULADO") {
      estadoVisual = posicion <= posicionActual ? "COMPLETADA" : "BLOQUEADA";
    } else if (posicion === posicionActual) {
      estadoVisual = tramite.estado === "OBSERVADO" ? "OBSERVADA" : "EN_CURSO";
    } else if (posicion < posicionActual) {
      estadoVisual = "COMPLETADA";
    } else {
      estadoVisual = "BLOQUEADA";
    }

    return { ...etapa, estado: estadoVisual };
  });
}

export interface UseWorkflowAcademicoResultado {
  workflow: WorkflowAcademico;
  etapas: EtapaWorkflowVisual[];
  estado: EstadoTramite;
  errorFsm: string | null;
  requisitosPendientesEtapaActual: string[];
  expedientesDisponibles: WorkflowAcademico[];
  puedeTomar: boolean;
  puedeAprobar: boolean;
  puedeObservar: boolean;
  puedeSubsanar: boolean;
  puedeReanudar: boolean;
  puedeFirmar: boolean;
  puedeAnular: boolean;
  tomarEnRevision: () => void;
  cargarExpediente: (idTramite: number) => void;
  aprobarEtapaActual: () => void;
  observarEtapaActual: (observacion: string) => void;
  subsanar: () => void;
  reanudarRevision: () => void;
  firmarDocumento: () => void;
  anularTramite: () => void;
  marcarRequisito: (idEtapa: number, idRequisito: number, cumplido: boolean) => void;
}

/** Requisitos sin cumplir de una etapa (actas, certificados, dictámenes). */
export function requisitosPendientesDe(
  tramite: WorkflowAcademico,
  idEtapa: number,
): string[] {
  const etapa = tramite.etapas.find((e) => e.idEtapa === idEtapa);
  if (!etapa) return [];
  return etapa.requisitos.filter((r) => !r.cumplido).map((r) => r.descripcion);
}

/**
 * Bandeja demo de expedientes académicos para el buscador (ENT-M04-01).
 * Todos parten de la misma matriz de 5 etapas; varía la carátula y el estado
 * FSM para que el revisor pueda cargar cualquiera y pasarlo a revisión.
 */
export const EXPEDIENTES_DEMO: readonly WorkflowAcademico[] = [
  crearTramiteDemo(),
  crearTramiteDemo({
    idTramite: 413,
    cut: "EXP-2026-000413",
    nombreTramite: "Expedición de Certificado de Estudios",
    programa: "Desarrollo de Sistemas de Información (DSI)",
    solicitante: {
      idPersona: 2952,
      numeroDocumento: "47120358",
      nombres: "Lucía Fernanda",
      apellidos: "Torres Vega",
      correoElectronico: "ltorres@alumno.institutosuiza.edu.pe",
    },
    estado: "EN_TRAMITE",
    etapaActualId: 1,
  }),
  crearTramiteDemo({
    idTramite: 414,
    cut: "EXP-2026-000414",
    nombreTramite: "Convalidación de Estudios Previos",
    programa: "Contabilidad",
    solicitante: {
      idPersona: 2963,
      numeroDocumento: "48931027",
      nombres: "Miguel Ángel",
      apellidos: "Ríos Paredes",
      correoElectronico: "mrios@alumno.institutosuiza.edu.pe",
    },
    estado: "REGISTRADO",
    etapaActualId: 1,
  }),
  crearTramiteDemo({
    idTramite: 415,
    cut: "EXP-2026-000415",
    nombreTramite: "Emisión de Grado de Bachiller Técnico",
    programa: "Enfermería Técnica",
    solicitante: {
      idPersona: 2974,
      numeroDocumento: "50219436",
      nombres: "Rosa Amelia",
      apellidos: "García López",
      correoElectronico: "rgarcia@alumno.institutosuiza.edu.pe",
    },
    estado: "EN_REVISION",
    etapaActualId: 2,
  }),
];

export function useWorkflowAcademico(): UseWorkflowAcademicoResultado {
  const [tramite, setTramite] = useState<WorkflowAcademico>(() =>
    crearTramiteDemo(),
  );
  const [errorFsm, setErrorFsm] = useState<string | null>(null);

  const estado = tramite.estado;

  const etapas = useMemo<EtapaWorkflowVisual[]>(
    () => derivarEtapasVisuales(tramite),
    [tramite],
  );

  const validarTransicion = useCallback(
    (desde: EstadoTramite, hacia: EstadoTramite, mensaje: string): boolean => {
      if (desde !== estado || !TRANSICIONES_FSM[desde].includes(hacia)) {
        setErrorFsm(mensaje);
        return false;
      }
      setErrorFsm(null);
      return true;
    },
    [estado],
  );

  const tomarEnRevision = useCallback(() => {
    if (validarTransicion("EN_TRAMITE", "EN_REVISION", "El trámite no está en estado EN_TRAMITE.")) {
      setTramite((actual) => ({ ...actual, estado: "EN_REVISION" }));
    }
  }, [validarTransicion]);

  /** Buscador ENT-M04-01: carga un expediente de la bandeja para pasarlo a revisión. */
  const cargarExpediente = useCallback((idTramite: number) => {
    const encontrado = EXPEDIENTES_DEMO.find((e) => e.idTramite === idTramite);
    if (!encontrado) {
      setErrorFsm(`Expediente N.° ${idTramite} no encontrado en la bandeja demo.`);
      return;
    }
    setErrorFsm(null);
    // Clon profundo para no mutar el catálogo al avanzar la FSM.
    setTramite(JSON.parse(JSON.stringify(encontrado)) as WorkflowAcademico);
  }, []);

  const aprobarEtapaActual = useCallback(() => {
    if (!validarTransicion("EN_REVISION", "APROBADO", "Solo se puede aprobar en estado EN_REVISION.")) {
      return;
    }
    // T-FE-DOC-01: bloqueo FSM — no se avanza a la etapa resolutiva (ni a la
    // siguiente) si faltan actas de sustentación / certificados / dictámenes.
    const pendientes = requisitosPendientesDe(tramite, tramite.etapaActualId);
    if (pendientes.length > 0) {
      setErrorFsm(
        `Bloqueo FSM: la etapa actual exige ${pendientes.length} requisito(s) pendiente(s) antes de aprobar: ${pendientes.join("; ")}.`,
      );
      return;
    }
    setTramite((actual) => {
      const posicion = actual.etapas.findIndex(
        (etapa) => etapa.idEtapa === actual.etapaActualId,
      );
      const esUltima = posicion === actual.etapas.length - 1;
      const conFechaFin = actual.etapas.map((etapa, indice) =>
        indice === posicion ? { ...etapa, fechaFin: AHORA() } : etapa,
      );

      if (esUltima) {
        return { ...actual, etapas: conFechaFin, estado: "PARA_FIRMA" };
      }

      const siguienteEtapa = actual.etapas[posicion + 1];
      const conSiguienteInicio = conFechaFin.map((etapa) =>
        etapa.idEtapa === siguienteEtapa.idEtapa
          ? { ...etapa, fechaInicio: AHORA() }
          : etapa,
      );

      return {
        ...actual,
        etapas: conSiguienteInicio,
        etapaActualId: siguienteEtapa.idEtapa,
        estado: "EN_TRAMITE",
      };
    });
  }, [validarTransicion]);

  const observarEtapaActual = useCallback(
    (observacion: string) => {
      if (!validarTransicion("EN_REVISION", "OBSERVADO", "Solo se puede observar en estado EN_REVISION.")) {
        return;
      }
      setTramite((actual) => ({
        ...actual,
        estado: "OBSERVADO",
        etapas: actual.etapas.map((etapa) =>
          etapa.idEtapa === actual.etapaActualId
            ? { ...etapa, observacion }
            : etapa,
        ),
      }));
    },
    [validarTransicion],
  );

  const subsanar = useCallback(() => {
    if (!validarTransicion("OBSERVADO", "SUBSANADO", "El trámite no se encuentra OBSERVADO.")) {
      return;
    }
    setTramite((actual) => ({ ...actual, estado: "SUBSANADO" }));
  }, [validarTransicion]);

  const reanudarRevision = useCallback(() => {
    if (!validarTransicion("SUBSANADO", "EN_REVISION", "El trámite no se encuentra SUBSANADO.")) {
      return;
    }
    setTramite((actual) => ({
      ...actual,
      estado: "EN_REVISION",
      etapas: actual.etapas.map((etapa) =>
        etapa.idEtapa === actual.etapaActualId
          ? { ...etapa, observacion: undefined }
          : etapa,
      ),
    }));
  }, [validarTransicion]);

  const firmarDocumento = useCallback(() => {
    if (!validarTransicion("PARA_FIRMA", "RESUELTO", "El documento no está listo para firma (PARA_FIRMA).")) {
      return;
    }
    // Defensa en profundidad: jamás firmar si algún acta/dictamen quedó pendiente
    // (evita títulos sin dictamen favorable de jurado).
    const faltantes = tramite.etapas.flatMap((e) =>
      e.requisitos.filter((r) => !r.cumplido).map((r) => `${e.nombreEtapa}: ${r.descripcion}`),
    );
    if (faltantes.length > 0) {
      setErrorFsm(
        `Bloqueo FSM: no se puede firmar. Faltan ${faltantes.length} requisito(s): ${faltantes.slice(0, 3).join("; ")}${faltantes.length > 3 ? "…" : ""}`,
      );
      return;
    }
    setTramite((actual) => {
      const posicion = actual.etapas.findIndex(
        (etapa) => etapa.idEtapa === actual.etapaActualId,
      );
      const hash = generarHashSha256Demo(`${actual.idTramite}-${actual.cut}-${AHORA()}`);
      const cvd = `CVD-2026-TIT-${String(actual.idTramite).padStart(6, "0")}-${hash.slice(0, 4).toUpperCase()}`;
      return {
        ...actual,
        estado: "RESUELTO",
        certificado: { hashSha256: hash, cvd },
        etapas: actual.etapas.map((etapa, indice) =>
          indice === posicion ? { ...etapa, fechaFin: AHORA() } : etapa,
        ),
      };
    });
  }, [validarTransicion]);

  const anularTramite = useCallback(() => {
    const permitido = estado === "EN_REVISION" || estado === "OBSERVADO";
    if (!permitido) {
      setErrorFsm("Solo se puede anular en EN_REVISION u OBSERVADO.");
      return;
    }
    setErrorFsm(null);
    setTramite((actual) => ({ ...actual, estado: "ANULADO" }));
  }, [estado]);

  /** Carga/aprobación de actas y certificados por requisito (etapa jurado, etc.). */
  const marcarRequisito = useCallback(
    (idEtapa: number, idRequisito: number, cumplido: boolean) => {
      setTramite((actual) => ({
        ...actual,
        etapas: actual.etapas.map((etapa) =>
          etapa.idEtapa === idEtapa
            ? {
                ...etapa,
                requisitos: etapa.requisitos.map((req) =>
                  req.idRequisito === idRequisito
                    ? {
                        ...req,
                        cumplido,
                        fechaCumplimiento: cumplido ? AHORA() : undefined,
                      }
                    : req,
                ),
              }
            : etapa,
        ),
      }));
      setErrorFsm(null);
    },
    [],
  );

  return {
    workflow: tramite,
    etapas,
    estado,
    errorFsm,
    requisitosPendientesEtapaActual,
    expedientesDisponibles: [...EXPEDIENTES_DEMO],
    puedeTomar: estado === "EN_TRAMITE",
    puedeAprobar:
      estado === "EN_REVISION" && requisitosPendientesEtapaActual.length === 0,
    puedeObservar: estado === "EN_REVISION",
    puedeSubsanar: estado === "OBSERVADO",
    puedeReanudar: estado === "SUBSANADO",
    puedeFirmar: estado === "PARA_FIRMA",
    puedeAnular: estado === "EN_REVISION" || estado === "OBSERVADO",
    tomarEnRevision,
    cargarExpediente,
    aprobarEtapaActual,
    observarEtapaActual,
    subsanar,
    reanudarRevision,
    firmarDocumento,
    anularTramite,
    marcarRequisito,
  };
}