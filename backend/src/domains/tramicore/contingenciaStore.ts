import fs from 'node:fs';
import path from 'node:path';
import type { EstadoRutaDoc } from '../rutadoc/rutadoc.fsm.js';
import type { ExpedienteResumen } from '../rutadoc/rutadoc.types.js';

export interface ExpedienteContingenciaItem {
  idExpediente: string;
  cut: string;
  asunto: string;
  fechaRadicacion: string;
  fechaIngreso: string;
  estadoActual: EstadoRutaDoc;
  areaActualId: string;
  canalIngreso: string;
  procedimientoTupa: string;
  codigoTupa?: string;
  solicitanteNombre: string;
  solicitanteNumeroDocumento: string;
  solicitanteDni: string;
  totalFolios?: number;
  cargo?: any;
  habilitacionInfo?: any;
  documentos?: Array<{
    idDocumento: string;
    nombre: string;
    mimeType: string;
    folioInicio: number;
    folioFin: number;
    tieneFirmaDigital?: boolean;
    desglosado?: boolean;
  }>;
}

const STORE_PATH = path.resolve(process.cwd(), 'data', 'expedientes_contingencia.json');

const EXPEDIENTES_SEMILLA: ExpedienteContingenciaItem[] = [
  {
    idExpediente: 'EXP-2026-000002',
    cut: 'EXP-2026-000002',
    asunto: 'SUZ26-006 — Certificado de Inglés — Nivel Básico (Acreditación Académica)',
    fechaRadicacion: '2026-11-24T10:15:00.000Z',
    fechaIngreso: '2026-11-24T10:15:00.000Z',
    estadoActual: 'REGISTRADO',
    areaActualId: 'MESA_DE_PARTES',
    canalIngreso: 'MESA_VIRTUAL',
    procedimientoTupa: 'SUZ26-006 — Certificado de Inglés',
    codigoTupa: 'SUZ26-006',
    solicitanteNombre: 'SAMANTA PAREDES FLORES',
    solicitanteNumeroDocumento: '72345678',
    solicitanteDni: '72345678',
    totalFolios: 3,
    habilitacionInfo: {
      requierePago: true,
      estadoPago: 'VERIFICADO',
      pagoVerificado: true,
      diasHabilesRestantes: 30,
      habilitado: true,
      mensaje: 'Trámite habilitado y conforme',
    },
    documentos: [
      {
        idDocumento: 'doc-samanta-01',
        nombre: 'FUT_Solicitud_Certificado_Samanta.pdf',
        mimeType: 'application/pdf',
        folioInicio: 1,
        folioFin: 2,
        tieneFirmaDigital: true,
      },
      {
        idDocumento: 'doc-samanta-02',
        nombre: 'Constancia_Notas_Ingles_Samanta.pdf',
        mimeType: 'application/pdf',
        folioInicio: 3,
        folioFin: 3,
        tieneFirmaDigital: true,
      },
    ],
  },
  {
    idExpediente: 'EXP-2026-000001',
    cut: 'EXP-2026-000001',
    asunto: 'SUZ26-007 — Centro de Idiomas — paquete básico de 4 meses para alumnos del IESTP Suiza',
    fechaRadicacion: '2026-11-24T09:00:00.000Z',
    fechaIngreso: '2026-11-24T09:00:00.000Z',
    estadoActual: 'REGISTRADO',
    areaActualId: 'MESA_DE_PARTES',
    canalIngreso: 'MESA_VIRTUAL',
    procedimientoTupa: 'SUZ26-007 — Centro de Idiomas — paquete básico de 4 meses para alumnos del IESTP Suiza',
    codigoTupa: 'SUZ26-007',
    solicitanteNombre: 'JUAN CARLOS PEREZ GOMEZ',
    solicitanteNumeroDocumento: '12345678',
    solicitanteDni: '12345678',
    totalFolios: 4,
    habilitacionInfo: {
      requierePago: true,
      estadoPago: 'VERIFICADO',
      pagoVerificado: true,
      diasHabilesRestantes: 30,
      habilitado: true,
      mensaje: 'Trámite habilitado y conforme',
    },
    documentos: [
      {
        idDocumento: 'doc-jcp-01',
        nombre: 'FUT_Solicitud_Certificado_Ingles.pdf',
        mimeType: 'application/pdf',
        folioInicio: 1,
        folioFin: 2,
        tieneFirmaDigital: true,
      },
      {
        idDocumento: 'doc-jcp-02',
        nombre: 'Constancia_Notas_Centro_Idiomas.pdf',
        mimeType: 'application/pdf',
        folioInicio: 3,
        folioFin: 4,
        tieneFirmaDigital: true,
      },
    ],
  },
];

class ContingenciaStore {
  private expedientes: ExpedienteContingenciaItem[] = [];

  constructor() {
    this.cargarDesdeDisco();
  }

  private cargarDesdeDisco(): void {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const contenido = fs.readFileSync(STORE_PATH, 'utf-8');
        const parseado = JSON.parse(contenido);
        if (Array.isArray(parseado) && parseado.length > 0) {
          this.expedientes = parseado;
          // Asegurar que Samanta esté presente
          if (!this.expedientes.some((e) => e.solicitanteNombre?.toUpperCase().includes('SAMANTA') || e.cut === 'EXP-2026-000002')) {
            this.expedientes.unshift(EXPEDIENTES_SEMILLA[0]);
            this.guardarEnDisco();
          }
          return;
        }
      }
    } catch (err) {
      console.warn('[ContingenciaStore] Error leyendo store en disco:', (err as Error).message);
    }
    this.expedientes = [...EXPEDIENTES_SEMILLA];
    this.guardarEnDisco();
  }

  private guardarEnDisco(): void {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.expedientes, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[ContingenciaStore] Error guardando store en disco:', (err as Error).message);
    }
  }

  public agregarExpediente(item: ExpedienteContingenciaItem): void {
    const indice = this.expedientes.findIndex((e) => e.cut === item.cut || e.idExpediente === item.idExpediente);
    if (indice >= 0) {
      this.expedientes[indice] = { ...this.expedientes[indice], ...item };
    } else {
      this.expedientes.unshift(item);
    }
    this.guardarEnDisco();
  }

  public listar(filtros?: {
    pestana?: string;
    bandeja?: string;
    busqueda?: string;
  }): ExpedienteContingenciaItem[] {
    let resultado = [...this.expedientes];

    if (filtros?.busqueda) {
      const q = filtros.busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (e) =>
          e.cut.toLowerCase().includes(q) ||
          e.solicitanteNombre.toLowerCase().includes(q) ||
          e.solicitanteDni.toLowerCase().includes(q) ||
          e.asunto.toLowerCase().includes(q) ||
          e.procedimientoTupa.toLowerCase().includes(q),
      );
    }

    // Ordenar siempre por fecha descendente (más recientes primero)
    resultado.sort((a, b) => new Date(b.fechaRadicacion).getTime() - new Date(a.fechaRadicacion).getTime());

    return resultado;
  }

  public obtenerPorIdOCut(idOCut: string): ExpedienteContingenciaItem | null {
    const buscado = idOCut.trim().toUpperCase();
    return (
      this.expedientes.find(
        (e) => e.cut.toUpperCase() === buscado || e.idExpediente.toUpperCase() === buscado,
      ) ?? null
    );
  }

  public obtenerContadores12Bandejas(): Record<string, number> {
    const lista = this.expedientes;
    const contadores = {
      pendientes_recepcion: lista.filter((e) => e.estadoActual === 'REGISTRADO').length,
      recepcionados: lista.filter((e) => e.estadoActual === 'RECEPCIONADO').length,
      pendientes_calificacion: lista.filter((e) => ['RECEPCIONADO', 'EN_CALIFICACION'].includes(e.estadoActual)).length,
      observados: lista.filter((e) => e.estadoActual === 'OBSERVADO').length,
      pendientes_subsanacion: lista.filter((e) => e.estadoActual === 'OBSERVADO').length,
      subsanados: lista.filter((e) => e.estadoActual === 'SUBSANADO').length,
      conformes: lista.filter((e) => e.estadoActual === 'EN_CALIFICACION').length,
      rechazados: lista.filter((e) => ['CERRADO', 'ARCHIVADO'].includes(e.estadoActual)).length,
      pendientes_derivacion: lista.filter((e) => ['RECEPCIONADO', 'EN_CALIFICACION', 'SUBSANADO'].includes(e.estadoActual)).length,
      derivados: lista.filter((e) => e.estadoActual === 'DERIVADO').length,
      pendientes_recepcion_destino: lista.filter((e) => e.estadoActual === 'DERIVADO').length,
      atendidos: lista.filter((e) => ['ATENDIDO', 'RESUELTO', 'ARCHIVADO'].includes(e.estadoActual)).length,
    };
    return contadores;
  }

  public obtenerContadoresRutaDoc(): Record<string, number> {
    const lista = this.expedientes;
    return {
      PENDIENTES: lista.filter((e) => ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION'].includes(e.estadoActual)).length,
      EN_TRAMITE: lista.filter((e) => ['EN_REVISION', 'OBSERVADO', 'SUBSANADO'].includes(e.estadoActual)).length,
      DERIVADOS: lista.filter((e) => e.estadoActual === 'DERIVADO').length,
      POR_FIRMAR: lista.filter((e) => e.estadoActual === 'EN_FIRMA').length,
      ATENDIDOS: lista.filter((e) => ['ATENDIDO', 'RESUELTO'].includes(e.estadoActual)).length,
      ARCHIVADOS: lista.filter((e) => e.estadoActual === 'ARCHIVADO').length,
    };
  }
}

export const contingenciaStore = new ContingenciaStore();
