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

function crearTramiteDemo(): WorkflowAcademico {
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
    slaDiasTotales: 30,
    fechaRegistro: "2026-09-05T11:05:00-05:00",
    fechaLimiteSla: "2026-10-16T17:00:00-05:00",
    etapas: [
      {
        idEtapa: 1,
        orden: 1,
        codigo: "ETAPA-01",
        nombreEtapa: "Admisión y Egreso Regular",
        unidadOrganica: "Secretaría Académica",
        rolResponsable: "responsable",
        plazoSlaDias: 5,
        descripcion:
          "Validación del egreso regular y acreditación de prácticas formativas EFSRT del administrado.",
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
          {
            idRequisito: 103,
            descripcion:
              "Acreditación de EFSRT / Prácticas Preprofesionales (384 horas)",
            cumplido: false,
          },
        ],
        fechaInicio: "2026-09-05T12:00:00-05:00",
      },
      {
        idEtapa: 2,
        orden: 2,
        codigo: "ETAPA-02",
        nombreEtapa: "Dictamen Curricular",
        unidadOrganica: "Coordinación de la Carrera DSI",
        rolResponsable: "responsable",
        plazoSlaDias: 5,
        descripcion:
          "Conformidad técnica de la Coordinación de la Carrera sobre la regularidad académica del expediente.",
        requisitos: [
          {
            idRequisito: 201,
            descripcion:
              "Conformidad técnica de malla curricular y notas aprobatorias",
            cumplido: false,
          },
          {
            idRequisito: 202,
            descripcion: "No adeudo de libros, materiales o instrumentos de taller",
            cumplido: false,
          },
        ],
      },
      {
        idEtapa: 3,
        orden: 3,
        codigo: "ETAPA-03",
        nombreEtapa: "Sustentación de Proyecto",
        unidadOrganica: "Secretaría Académica / Jurado Evaluador",
        rolResponsable: "operador",
        plazoSlaDias: 10,
        descripcion:
          "Registro del jurado evaluador y acta de examen profesional de la sustentación del proyecto.",
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
            descripcion: "Nota aprobatoria mayor o igual a 13",
            cumplido: false,
          },
        ],
      },
      {
        idEtapa: 4,
        orden: 4,
        codigo: "ETAPA-04",
        nombreEtapa: "Proyección de Resolución Directoral",
        unidadOrganica: "Dirección General",
        rolResponsable: "admin",
        plazoSlaDias: 5,
        descripcion:
          "Redacción del acto resolutivo institucional (Visto, Considerando y Se Resuelve) para aprobación directorial.",
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
        nombreEtapa: "Firma, Diploma y Asiento",
        unidadOrganica: "Dirección General",
        rolResponsable: "admin",
        plazoSlaDias: 5,
        descripcion:
          "Despacho a pasarela Refirma RENIEC, firma PAdES-BES con TSA, estampa CVD/QR y asiento en libro oficial.",
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
            descripcion: "Asiento en el Libro Oficial de Resoluciones Directorales",
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
  puedeTomar: boolean;
  puedeAprobar: boolean;
  puedeObservar: boolean;
  puedeSubsanar: boolean;
  puedeReanudar: boolean;
  puedeFirmar: boolean;
  puedeAnular: boolean;
  tomarEnRevision: () => void;
  aprobarEtapaActual: () => void;
  observarEtapaActual: (observacion: string) => void;
  subsanar: () => void;
  reanudarRevision: () => void;
  firmarDocumento: () => void;
  anularTramite: () => void;
}

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

  const validarTransicion = (
    desde: EstadoTramite,
    hacia: EstadoTramite,
    mensaje: string,
  ): boolean => {
    if (desde !== estado || !TRANSICIONES_FSM[desde].includes(hacia)) {
      setErrorFsm(mensaje);
      return false;
    }
    setErrorFsm(null);
    return true;
  };

  const tomarEnRevision = useCallback(() => {
    if (validarTransicion("EN_TRAMITE", "EN_REVISION", "El trámite no está en estado EN_TRAMITE.")) {
      setTramite((actual) => ({ ...actual, estado: "EN_REVISION" }));
    }
  }, [estado]);

  const aprobarEtapaActual = useCallback(() => {
    if (!validarTransicion("EN_REVISION", "APROBADO", "Solo se puede aprobar en estado EN_REVISION.")) {
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
  }, [estado]);

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
    [estado],
  );

  const subsanar = useCallback(() => {
    if (!validarTransicion("OBSERVADO", "SUBSANADO", "El trámite no se encuentra OBSERVADO.")) {
      return;
    }
    setTramite((actual) => ({ ...actual, estado: "SUBSANADO" }));
  }, [estado]);

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
  }, [estado]);

  const firmarDocumento = useCallback(() => {
    if (!validarTransicion("PARA_FIRMA", "RESUELTO", "El documento no está listo para firma (PARA_FIRMA).")) {
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
  }, [estado]);

  const anularTramite = useCallback(() => {
    const permitido = estado === "EN_REVISION" || estado === "OBSERVADO";
    if (!permitido) {
      setErrorFsm("Solo se puede anular en EN_REVISION u OBSERVADO.");
      return;
    }
    setErrorFsm(null);
    setTramite((actual) => ({ ...actual, estado: "ANULADO" }));
  }, [estado]);

  return {
    workflow: tramite,
    etapas,
    estado,
    errorFsm,
    puedeTomar: estado === "EN_TRAMITE",
    puedeAprobar: estado === "EN_REVISION",
    puedeObservar: estado === "EN_REVISION",
    puedeSubsanar: estado === "OBSERVADO",
    puedeReanudar: estado === "SUBSANADO",
    puedeFirmar: estado === "PARA_FIRMA",
    puedeAnular: estado === "EN_REVISION" || estado === "OBSERVADO",
    tomarEnRevision,
    aprobarEtapaActual,
    observarEtapaActual,
    subsanar,
    reanudarRevision,
    firmarDocumento,
    anularTramite,
  };
}