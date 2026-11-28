// Hook de Tablas Maestras y Catálogos de Trazabilidad (ENT-M05-05)
import { useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import type {
  AreaOrganica,
  EstadoRegistro,
  RegistroMaestro,
  TipoTabla,
} from "../types/tablasMaestras";

export const TIPOS_TABLA: TipoTabla[] = [
  "Tipos documentales",
  "Áreas y Organigrama",
  "Estados de trámite (FSM)",
  "Acciones de trazabilidad",
  "Transiciones de flujo",
];

export const ORGANIGRAMA_MATERIALIZED_PATH: AreaOrganica[] = [
  // Nivel 1: Dirección General
  { id: 1, codigo: "ARE_DIR", nombre: "Dirección General", ruta: "01", detalle: "Órgano de máxima autoridad resolutiva institucional.", estado: "Activo" },

  // Nivel 2: Órganos de Dirección, Recepción y Apoyo
  { id: 2, codigo: "ARE_SUBDIR", nombre: "Sub Dirección", ruta: "01.01", detalle: "Nivel 2 - Conducción pedagógica y despacho de trámites hacia coordinaciones.", estado: "Activo" },
  { id: 3, codigo: "ARE_MPV", nombre: "Mesa de Partes y Ventanilla", ruta: "01.02", detalle: "Nivel 2 - Recepción física y digital, foliación inicial y asignación de CUT.", estado: "Activo" },
  { id: 4, codigo: "ARE_ABA", nombre: "Abastecimiento Administrativo", ruta: "01.03", detalle: "Nivel 2 - Gestión logística, adquisiciones, bienes y servicios administrativos.", estado: "Activo" },
  { id: 5, codigo: "ARE_SEC", nombre: "Secretaría Académica", ruta: "01.04", detalle: "Nivel 2 - Fe pública institucional, registro académico, certificaciones y actas.", estado: "Activo" },
  { id: 6, codigo: "ARE_CAL", nombre: "Calidad", ruta: "01.05", detalle: "Nivel 2 - Aseguramiento y licenciamiento de la calidad educativa institucional.", estado: "Activo" },
  { id: 7, codigo: "ARE_ADM", nombre: "Administración y Finanzas", ruta: "01.06", detalle: "Nivel 2 - Gestión presupuestal y financiera institucional.", estado: "Activo" },
  { id: 8, codigo: "ARE_ARC", nombre: "Archivo Central y Acervo", ruta: "01.06.01", detalle: "Nivel 3 - Custodia pasiva del acervo documental conforme a normas del AGN.", estado: "Activo" },
  { id: 9, codigo: "ARE_DSI", nombre: "Coordinación DSI", ruta: "01.06.02", detalle: "Nivel 3 - Coordinación técnica de desarrollo de sistemas e informática.", estado: "Activo" },

  // Nivel 3: Coordinaciones bajo Sub Dirección
  { id: 10, codigo: "ARE_ACAD", nombre: "Coordinación Académica", ruta: "01.01.01", detalle: "Nivel 3 - Programación curricular, convalidaciones y soporte docente.", estado: "Activo" },
  { id: 11, codigo: "ARE_BIE", nombre: "Bienestar", ruta: "01.01.02", detalle: "Nivel 3 - Servicios estudiantiles, tutoría, empleabilidad y bienestar del educando.", estado: "Activo" },
  { id: 12, codigo: "ARE_INV", nombre: "Investigación", ruta: "01.01.03", detalle: "Nivel 3 - Proyectos de investigación tecnológica aplicada e innovación.", estado: "Activo" },

  // Nivel 3: Coordinaciones de Programas de Estudio (Carreras)
  { id: 13, codigo: "ARE_CADM", nombre: "Coordinación de Administración de Empresas", ruta: "01.01.04", detalle: "Nivel 3 - Programa de Estudios de Administración de Empresas.", estado: "Activo" },
  { id: 14, codigo: "ARE_CTUR", nombre: "Coordinación de Administración en Operaciones Turísticas", ruta: "01.01.05", detalle: "Nivel 3 - Programa de Estudios de Guía Oficial y Operaciones Turísticas.", estado: "Activo" },
  { id: 15, codigo: "ARE_CENF", nombre: "Coordinación de Enfermería Técnica", ruta: "01.01.06", detalle: "Nivel 3 - Programa de Estudios de Enfermería Técnica y prácticas clínicas.", estado: "Activo" },
  { id: 16, codigo: "ARE_CCON", nombre: "Coordinación de Construcción Civil", ruta: "01.01.07", detalle: "Nivel 3 - Programa de Estudios de Construcción Civil y obras.", estado: "Activo" },
  { id: 17, codigo: "ARE_CASS", nombre: "Coordinación de Asistencia Administrativa", ruta: "01.01.08", detalle: "Nivel 3 - Programa de Estudios de Asistencia Administrativa.", estado: "Activo" },
  { id: 18, codigo: "ARE_CFOR", nombre: "Coordinación de Manejo Forestal", ruta: "01.01.09", detalle: "Nivel 3 - Programa de Estudios de Tecnología y Manejo Forestal.", estado: "Activo" },
  { id: 19, codigo: "ARE_CAGR", nombre: "Coordinación de Producción Agropecuaria", ruta: "01.01.10", detalle: "Nivel 3 - Programa de Estudios de Producción Agropecuaria y centros de producción.", estado: "Activo" },
  { id: 20, codigo: "ARE_CELE", nombre: "Coordinación de Electricidad Industrial", ruta: "01.01.11", detalle: "Nivel 3 - Programa de Estudios de Electricidad Industrial y automatización.", estado: "Activo" },
  { id: 21, codigo: "ARE_CCONTA", nombre: "Coordinación de Contabilidad", ruta: "01.01.12", detalle: "Nivel 3 - Programa de Estudios de Contabilidad y Finanzas.", estado: "Activo" },
  { id: 22, codigo: "ARE_CAUT", nombre: "Coordinación de Mecatrónica Automotriz", ruta: "01.01.13", detalle: "Nivel 3 - Programa de Estudios de Mecatrónica y Mantenimiento Automotriz.", estado: "Activo" },
];

const registrosIniciales: RegistroMaestro[] = [
  // 1. Tipos documentales oficiales
  { id: 101, tipo: "Tipos documentales", codigo: "SOL", nombre: "Solicitud / FUT", detalle: "Escrito del administrado que inicia un trámite o petición formal.", estado: "Activo", exigeFirma: false, tamanoMaximoMb: 25 },
  { id: 102, tipo: "Tipos documentales", codigo: "OFI", nombre: "Oficio Institucional", detalle: "Comunicación externa oficial con otras entidades públicas o privadas.", estado: "Activo", exigeFirma: true, tamanoMaximoMb: 25 },
  { id: 103, tipo: "Tipos documentales", codigo: "MEMO", nombre: "Memorando Interno", detalle: "Comunicación interna oficial entre unidades orgánicas.", estado: "Activo", exigeFirma: true, tamanoMaximoMb: 20 },
  { id: 104, tipo: "Tipos documentales", codigo: "INF", nombre: "Informe Técnico / Legal", detalle: "Dictamen pericial, informe académico o sustento sustantivo de un expediente.", estado: "Activo", exigeFirma: true, tamanoMaximoMb: 35 },
  { id: 105, tipo: "Tipos documentales", codigo: "RD", nombre: "Resolución Directoral", detalle: "Acto resolutivo emitido por el Despacho Directoral con fe pública.", estado: "Activo", exigeFirma: true, tamanoMaximoMb: 50 },
  { id: 106, tipo: "Tipos documentales", codigo: "PROV", nombre: "Proveído de Pase", detalle: "Decreto o providencia de derivación inter-áreas en la línea de trámite.", estado: "Activo", exigeFirma: false, tamanoMaximoMb: 15 },
  { id: 107, tipo: "Tipos documentales", codigo: "NOTIF", nombre: "Cédula de Notificación", detalle: "Acto de comunicación a la casilla electrónica del administrado.", estado: "Activo", exigeFirma: true, tamanoMaximoMb: 20 },
  { id: 108, tipo: "Tipos documentales", codigo: "CONST", nombre: "Constancia Oficial", detalle: "Certificación o constancia expedida por Secretaría Académica.", estado: "Activo", exigeFirma: true, tamanoMaximoMb: 20 },
  { id: 109, tipo: "Tipos documentales", codigo: "ACT", nombre: "Acta de Evaluación / Notas", detalle: "Registro oficial inalterable de evaluaciones y notas académicas.", estado: "Activo", exigeFirma: true, tamanoMaximoMb: 30 },
  { id: 110, tipo: "Tipos documentales", codigo: "DEC_JUR", nombre: "Declaración Jurada", detalle: "Manifestación bajo juramento conforme al Art. 51 del TUO de la LPAG.", estado: "Activo", exigeFirma: false, tamanoMaximoMb: 20 },

  // 2. Áreas y Organigrama
  { id: 201, tipo: "Áreas y Organigrama", codigo: "ARE_DIR", nombre: "Dirección General", detalle: "Nivel 1 - Máxima autoridad resolutiva institucional.", estado: "Activo" },
  { id: 202, tipo: "Áreas y Organigrama", codigo: "ARE_SUBDIR", nombre: "Sub Dirección", detalle: "Nivel 2 - Conducción pedagógica y canalización de trámites (Ruta: 01.01).", estado: "Activo" },
  { id: 203, tipo: "Áreas y Organigrama", codigo: "ARE_MPV", nombre: "Mesa de Partes y Ventanilla", detalle: "Nivel 2 - Recepción y radicación física/virtual (Ruta: 01.02).", estado: "Activo" },
  { id: 204, tipo: "Áreas y Organigrama", codigo: "ARE_ABA", nombre: "Abastecimiento Administrativo", detalle: "Nivel 2 - Gestión logística y bienes (Ruta: 01.03).", estado: "Activo" },
  { id: 205, tipo: "Áreas y Organigrama", codigo: "ARE_SEC", nombre: "Secretaría Académica", detalle: "Nivel 2 - Fe pública y registro académico (Ruta: 01.04).", estado: "Activo" },
  { id: 206, tipo: "Áreas y Organigrama", codigo: "ARE_CAL", nombre: "Calidad", detalle: "Nivel 2 - Aseguramiento de la calidad (Ruta: 01.05).", estado: "Activo" },
  { id: 207, tipo: "Áreas y Organigrama", codigo: "ARE_ADM", nombre: "Administración y Finanzas", detalle: "Nivel 2 - Gestión financiera (Ruta: 01.06).", estado: "Activo" },
  { id: 208, tipo: "Áreas y Organigrama", codigo: "ARE_ARC", nombre: "Archivo Central y Acervo", detalle: "Nivel 3 - Depende de Administración (Ruta: 01.06.01).", estado: "Activo" },
  { id: 209, tipo: "Áreas y Organigrama", codigo: "ARE_DSI", nombre: "Coordinación DSI", detalle: "Nivel 3 - Depende de Administración (Ruta: 01.06.02).", estado: "Activo" },
  { id: 210, tipo: "Áreas y Organigrama", codigo: "ARE_ACAD", nombre: "Coordinación Académica", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.01).", estado: "Activo" },
  { id: 211, tipo: "Áreas y Organigrama", codigo: "ARE_BIE", nombre: "Bienestar", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.02).", estado: "Activo" },
  { id: 212, tipo: "Áreas y Organigrama", codigo: "ARE_INV", nombre: "Investigación", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.03).", estado: "Activo" },
  { id: 213, tipo: "Áreas y Organigrama", codigo: "ARE_CADM", nombre: "Coord. Administración de Empresas", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.04).", estado: "Activo" },
  { id: 214, tipo: "Áreas y Organigrama", codigo: "ARE_CTUR", nombre: "Coord. Adm. en Operaciones Turísticas", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.05).", estado: "Activo" },
  { id: 215, tipo: "Áreas y Organigrama", codigo: "ARE_CENF", nombre: "Coord. Enfermería Técnica", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.06).", estado: "Activo" },
  { id: 216, tipo: "Áreas y Organigrama", codigo: "ARE_CCON", nombre: "Coord. Construcción Civil", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.07).", estado: "Activo" },
  { id: 217, tipo: "Áreas y Organigrama", codigo: "ARE_CASS", nombre: "Coord. Asistencia Administrativa", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.08).", estado: "Activo" },
  { id: 218, tipo: "Áreas y Organigrama", codigo: "ARE_CFOR", nombre: "Coord. Manejo Forestal", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.09).", estado: "Activo" },
  { id: 219, tipo: "Áreas y Organigrama", codigo: "ARE_CAGR", nombre: "Coord. Producción Agropecuaria", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.10).", estado: "Activo" },
  { id: 220, tipo: "Áreas y Organigrama", codigo: "ARE_CELE", nombre: "Coord. Electricidad Industrial", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.11).", estado: "Activo" },
  { id: 221, tipo: "Áreas y Organigrama", codigo: "ARE_CCONTA", nombre: "Coord. Contabilidad", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.12).", estado: "Activo" },
  { id: 222, tipo: "Áreas y Organigrama", codigo: "ARE_CAUT", nombre: "Coord. Mecatrónica Automotriz", detalle: "Nivel 3 - Depende de Sub Dirección (Ruta: 01.01.13).", estado: "Activo" },

  // 3. Estados de trámite (FSM)
  { id: 301, tipo: "Estados de trámite (FSM)", codigo: "REGISTRADO", nombre: "Registrado", detalle: "Apertura inicial en Mesa de Partes Virtual o Ventanilla. Se genera el CUT único oficial.", estado: "Activo", esTerminal: false, faseProcesal: "Inicial" },
  { id: 302, tipo: "Estados de trámite (FSM)", codigo: "RECEPCIONADO", nombre: "Recepcionado", detalle: "Conformidad formal y pase a revisión de admisibilidad documental.", estado: "Activo", esTerminal: false, faseProcesal: "Admisibilidad" },
  { id: 303, tipo: "Estados de trámite (FSM)", codigo: "EN_CALIFICACION", nombre: "En Calificación", detalle: "Verificación de requisitos normativos TUPA por mesa de partes.", estado: "Activo", esTerminal: false, faseProcesal: "Calificación" },
  { id: 304, tipo: "Estados de trámite (FSM)", codigo: "DERIVADO", nombre: "Derivado", detalle: "Pase procesal remitido a la unidad orgánica resolutiva de destino.", estado: "Activo", esTerminal: false, faseProcesal: "Tránsito" },
  { id: 305, tipo: "Estados de trámite (FSM)", codigo: "EN_REVISION", nombre: "En Revisión", detalle: "Estudio sustantivo del expediente por el especialista de área.", estado: "Activo", esTerminal: false, faseProcesal: "Instrucción" },
  { id: 306, tipo: "Estados de trámite (FSM)", codigo: "OBSERVADO", nombre: "Observado", detalle: "Requisitos incompletos. Notificado al administrado con plazo de 48h.", estado: "Activo", esTerminal: false, faseProcesal: "Subsanación" },
  { id: 307, tipo: "Estados de trámite (FSM)", codigo: "SUBSANADO", nombre: "Subsanado", detalle: "El administrado reingresó recaudos subsanados satisfactoriamente.", estado: "Activo", esTerminal: false, faseProcesal: "Reanudación" },
  { id: 308, tipo: "Estados de trámite (FSM)", codigo: "EN_FIRMA", nombre: "En Firma", detalle: "Proyecto de resolución o dictamen remitido a Despacho para firma digital.", estado: "Activo", esTerminal: false, faseProcesal: "Despacho" },
  { id: 309, tipo: "Estados de trámite (FSM)", codigo: "RESUELTO", nombre: "Resuelto", detalle: "Acto resolutivo emitido con firma digital y notificado a casilla.", estado: "Activo", esTerminal: false, faseProcesal: "Resolutiva" },
  { id: 310, tipo: "Estados de trámite (FSM)", codigo: "ARCHIVADO", nombre: "Archivado", detalle: "Custodia pasiva y conclusión del ciclo de vida procesal del expediente.", estado: "Activo", esTerminal: true, faseProcesal: "Terminal" },

  // 4. Acciones y Eventos de Trazabilidad
  { id: 401, tipo: "Acciones de trazabilidad", codigo: "RECEPCION", nombre: "Recepción de Expediente", detalle: "Acuse y toma de conocimiento del expediente en bandeja de entrada del área.", estado: "Activo" },
  { id: 402, tipo: "Acciones de trazabilidad", codigo: "INICIAR_CALIFICACION", nombre: "Iniciar Calificación", detalle: "Inicio de verificación técnico-legal de recaudos y aranceles TUPA.", estado: "Activo" },
  { id: 403, tipo: "Acciones de trazabilidad", codigo: "INICIAR_REVISION", nombre: "Iniciar Revisión Sustantiva", detalle: "Apertura formal de análisis técnico y elaboración de proyecto de informe.", estado: "Activo" },
  { id: 404, tipo: "Acciones de trazabilidad", codigo: "DERIVACION", nombre: "Derivación con Proveído", detalle: "Pase formal a otra unidad orgánica adjuntando providencia de derivación.", estado: "Activo" },
  { id: 405, tipo: "Acciones de trazabilidad", codigo: "OBSERVACION", nombre: "Emisión de Observaciones", detalle: "Notificación de requerimiento de subsanación hacia la casilla del ciudadano.", estado: "Activo" },
  { id: 406, tipo: "Acciones de trazabilidad", codigo: "CORRECCION", nombre: "Registro de Subsanación", detalle: "Recepción de documentos subsanatorios remitidos por el administrado.", estado: "Activo" },
  { id: 407, tipo: "Acciones de trazabilidad", codigo: "ENVIAR_A_FIRMA", nombre: "Envío a Despacho Directoral", detalle: "Pase a Dirección con proyecto de resolución para suscripción digital.", estado: "Activo" },
  { id: 408, tipo: "Acciones de trazabilidad", codigo: "FIRMA", nombre: "Firma Digital Criptográfica", detalle: "Suscripción con certificado digital acreditado y sellado de tiempo TSA.", estado: "Activo" },
  { id: 409, tipo: "Acciones de trazabilidad", codigo: "CIERRE", nombre: "Cierre y Archivo", detalle: "Remisión al Archivo Central institucional para conservación pasiva.", estado: "Activo" },

  // 5. Transiciones de Flujo
  { id: 501, tipo: "Transiciones de flujo", codigo: "TR-01", nombre: "Apertura → Recepción", detalle: "Evento RECEPCION: De REGISTRADO a RECEPCIONADO", estado: "Activo", eventoTransicion: "RECEPCION", estadoDestino: "RECEPCIONADO" },
  { id: 502, tipo: "Transiciones de flujo", codigo: "TR-02", nombre: "Recepción → Calificación", detalle: "Evento INICIAR_CALIFICACION: De RECEPCIONADO a EN_CALIFICACION", estado: "Activo", eventoTransicion: "INICIAR_CALIFICACION", estadoDestino: "EN_CALIFICACION" },
  { id: 503, tipo: "Transiciones de flujo", codigo: "TR-03", nombre: "Calificación → Revisión", detalle: "Evento INICIAR_REVISION: De EN_CALIFICACION a EN_REVISION", estado: "Activo", eventoTransicion: "INICIAR_REVISION", estadoDestino: "EN_REVISION" },
  { id: 504, tipo: "Transiciones de flujo", codigo: "TR-04", nombre: "Calificación → Derivación", detalle: "Evento DERIVACION: De EN_CALIFICACION a DERIVADO", estado: "Activo", eventoTransicion: "DERIVACION", estadoDestino: "DERIVADO" },
  { id: 505, tipo: "Transiciones de flujo", codigo: "TR-05", nombre: "Calificación → Observación", detalle: "Evento OBSERVACION: De EN_CALIFICACION a OBSERVADO", estado: "Activo", eventoTransicion: "OBSERVACION", estadoDestino: "OBSERVADO" },
  { id: 506, tipo: "Transiciones de flujo", codigo: "TR-06", nombre: "Derivación → Revisión", detalle: "Evento RECEPCION: De DERIVADO a EN_REVISION", estado: "Activo", eventoTransicion: "RECEPCION", estadoDestino: "EN_REVISION" },
  { id: 507, tipo: "Transiciones de flujo", codigo: "TR-07", nombre: "Revisión → Derivación", detalle: "Evento DERIVACION: De EN_REVISION a DERIVADO", estado: "Activo", eventoTransicion: "DERIVACION", estadoDestino: "DERIVADO" },
  { id: 508, tipo: "Transiciones de flujo", codigo: "TR-08", nombre: "Revisión → Observación", detalle: "Evento OBSERVACION: De EN_REVISION a OBSERVADO", estado: "Activo", eventoTransicion: "OBSERVACION", estadoDestino: "OBSERVADO" },
  { id: 509, tipo: "Transiciones de flujo", codigo: "TR-09", nombre: "Revisión → En Firma", detalle: "Evento ENVIAR_A_FIRMA: De EN_REVISION a EN_FIRMA", estado: "Activo", eventoTransicion: "ENVIAR_A_FIRMA", estadoDestino: "EN_FIRMA" },
  { id: 510, tipo: "Transiciones de flujo", codigo: "TR-10", nombre: "Observación → Subsanación", detalle: "Evento CORRECCION: De OBSERVADO a SUBSANADO", estado: "Activo", eventoTransicion: "CORRECCION", estadoDestino: "SUBSANADO" },
  { id: 511, tipo: "Transiciones de flujo", codigo: "TR-11", nombre: "Subsanación → Revisión", detalle: "Evento INICIAR_REVISION: De SUBSANADO a EN_REVISION", estado: "Activo", eventoTransicion: "INICIAR_REVISION", estadoDestino: "EN_REVISION" },
  { id: 512, tipo: "Transiciones de flujo", codigo: "TR-12", nombre: "En Firma → Resuelto", detalle: "Evento FIRMA: De EN_FIRMA a RESUELTO", estado: "Activo", eventoTransicion: "FIRMA", estadoDestino: "RESUELTO" },
  { id: 513, tipo: "Transiciones de flujo", codigo: "TR-13", nombre: "Resuelto → Archivado", detalle: "Evento CIERRE: De RESUELTO a ARCHIVADO (Terminal)", estado: "Activo", eventoTransicion: "CIERRE", estadoDestino: "ARCHIVADO" },
];

export function useTablasMaestras() {
  const [registros, setRegistros] = useState<RegistroMaestro[]>(registrosIniciales);
  const [tipoActivo, setTipoActivo] = useState<TipoTabla>("Tipos documentales");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [exigeFirma, setExigeFirma] = useState(false);
  const [tamanoMb, setTamanoMb] = useState(25);
  const [mensaje, setMensaje] = useState("");

  const [areasOrganicas, setAreasOrganicas] = useState<AreaOrganica[]>(ORGANIGRAMA_MATERIALIZED_PATH);

  // Sincronización con backend si está disponible
  useEffect(() => {
    let montado = true;

    // Cargar tipos documentales desde backend
    apiClient
      .get<Array<{
        id: string;
        codigo: string;
        nombre: string;
        tamano_maximo_mb: number;
        exige_firma: boolean;
        vigente: boolean;
      }>>("/api/v1/admin/maestras/tipo-documento")
      .then((res) => {
        if (!montado || !Array.isArray(res.data) || res.data.length === 0) return;
        const docsBD: RegistroMaestro[] = res.data.map((item, idx) => ({
          id: 1000 + idx,
          tipo: "Tipos documentales" as const,
          codigo: item.codigo,
          nombre: item.nombre,
          detalle: `Exige firma digital: ${item.exige_firma ? "Sí" : "No"} • Tamaño máx: ${item.tamano_maximo_mb} MB`,
          estado: item.vigente ? "Activo" : "Inactivo",
          exigeFirma: item.exige_firma,
          tamanoMaximoMb: item.tamano_maximo_mb,
        }));

        setRegistros((prev) => [
          ...prev.filter((r) => r.tipo !== "Tipos documentales"),
          ...docsBD,
        ]);
      })
      .catch(() => {
        // Mantiene catálogo inicial precargado
      });

    // Cargar organigrama desde backend
    apiClient
      .get<Array<{
        id?: string | number;
        sigla?: string;
        codigo?: string;
        nombre: string;
        path?: string;
        ruta_jerarquica?: string;
        children?: any[];
      }>>("/api/v1/admin/organigrama")
      .then((res) => {
        if (!montado || !Array.isArray(res.data) || res.data.length === 0) return;

        let contador = 1;
        const aplanar = (
          nodos: Array<{
            id?: string | number;
            sigla?: string;
            codigo?: string;
            nombre: string;
            path?: string;
            ruta_jerarquica?: string;
            children?: any[];
          }>,
          prefijo = "01"
        ): AreaOrganica[] => {
          const resultado: AreaOrganica[] = [];
          nodos.forEach((nodo, idx) => {
            const numeroNodo = String(idx + 1).padStart(2, "0");
            const rutaCalculada = prefijo === "01" && idx === 0 ? "01" : `${prefijo}.${numeroNodo}`;
            const idArea = typeof nodo.id === "number" ? nodo.id : contador++;
            const cod = nodo.codigo ?? nodo.sigla ?? `ARE-${String(idArea).padStart(3, "0")}`;
            resultado.push({
              id: idArea,
              codigo: cod,
              nombre: nodo.nombre,
              ruta: rutaCalculada,
              detalle: `Unidad orgánica institucional (${cod})`,
              estado: "Activo" as const,
            });
            if (Array.isArray(nodo.children) && nodo.children.length > 0) {
              resultado.push(...aplanar(nodo.children, rutaCalculada));
            }
          });
          return resultado;
        };

        const mapped = aplanar(res.data);
        if (mapped.length > 0) {
          setAreasOrganicas(mapped);
        }
      })
      .catch(() => {
        // Mantiene organigrama predeterminado
      });

    return () => {
      montado = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return registros.filter(
      (registro) =>
        registro.tipo === tipoActivo &&
        (texto === "" ||
          registro.codigo.toLowerCase().includes(texto) ||
          registro.nombre.toLowerCase().includes(texto) ||
          registro.detalle.toLowerCase().includes(texto)),
    );
  }, [busqueda, registros, tipoActivo]);

  function cambiarTipo(tipo: TipoTabla) {
    setTipoActivo(tipo);
    setBusqueda("");
    setMostrarFormulario(false);
    setMensaje("");
  }

  // Invariante de Trazabilidad: prohibido el borrado físico; solo inactivación lógica.
  function alternarEstado(id: number) {
    setMensaje("");
    setRegistros((actuales) =>
      actuales.map((registro) =>
        registro.id === id
          ? {
              ...registro,
              estado: (registro.estado === "Activo" ? "Inactivo" : "Activo") as EstadoRegistro,
            }
          : registro,
      ),
    );
    const registro = registros.find((item) => item.id === id);
    if (registro) {
      setMensaje(
        `Registro ${registro.codigo} ${
          registro.estado === "Activo" ? "desactivado (borrado lógico)" : "reactivado"
        }. La trazabilidad histórica procesal de los trámites se encuentra preservada.`,
      );
    }
  }

  function crearRegistro() {
    if (!codigo.trim() || !nombre.trim()) return;

    const nuevo: RegistroMaestro = {
      id: Math.max(0, ...registros.map((r) => r.id)) + 1,
      tipo: tipoActivo,
      codigo: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      detalle: detalle.trim() || `Configuración de ${tipoActivo}`,
      estado: "Activo",
      exigeFirma: tipoActivo === "Tipos documentales" ? exigeFirma : undefined,
      tamanoMaximoMb: tipoActivo === "Tipos documentales" ? tamanoMb : undefined,
    };

    setRegistros((actuales) => [...actuales, nuevo]);

    setMensaje(
      `Registro ${codigo.trim().toUpperCase()} añadido satisfactoriamente al catálogo de ${tipoActivo}.`,
    );
    setCodigo("");
    setNombre("");
    setDetalle("");
    setExigeFirma(false);
    setTamanoMb(25);
    setMostrarFormulario(false);
  }

  return {
    tipos: TIPOS_TABLA,
    registros: filtrados,
    todosRegistros: registros,
    areasOrganicas,
    tipoActivo,
    cambiarTipo,
    busqueda,
    setBusqueda,
    mostrarFormulario,
    setMostrarFormulario,
    codigo,
    setCodigo,
    nombre,
    setNombre,
    detalle,
    setDetalle,
    exigeFirma,
    setExigeFirma,
    tamanoMb,
    setTamanoMb,
    mensaje,
    setMensaje,
    crearRegistro,
    alternarEstado,
  };
}
