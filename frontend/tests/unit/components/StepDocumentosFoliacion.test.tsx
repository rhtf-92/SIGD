// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StepDocumentos from '../../../src/components/tramite/WizardSteps/StepDocumentos';
import { INITIAL_DOCUMENTOS } from '../../../src/types/tramiteWizardState';
import { apiClient } from '../../../src/api/client';
import * as foliacionPdf from '../../../src/utils/foliacionPdf';

describe('StepDocumentos — Requisitos Estructurados TUPA y Foliación Automática (Fase 1)', () => {
  const mockProcedimientoId = '11111111-2222-4333-8444-555555555555';
  const mockProcSinAnexosId = '22222222-3333-4444-8555-666666666666';

  const metadatos = (pagina: number, referenciaFila: string) => ({
    fuente: {
      nombre: 'TUPA_2026_IESTP_Suiza.pdf',
      documentoSha256: '377DD8E14B8806F2030B5374120AB9B4FE17640BB98086E10C1A9A4431A33622',
      pagina,
      referenciaFila,
    },
    pagina,
    revision: 1,
    vigencia: { desde: null, hasta: null },
    vigenciaDesde: null,
    vigenciaHasta: null,
    version: {
      etiqueta: 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1',
      revision: 1,
      vigenciaDesde: null,
      vigenciaHasta: null,
    },
    estadoValidacion: 'APROBADO',
    estado: 'APROBADO',
    referenciaAprobacion: 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1',
  });

  const mockCatalogo = [
    {
      registroVersionId: mockProcedimientoId,
      codigoExterno: 'p5-fila-21',
      codigo: 'p5-fila-21',
      denominacion: 'Constancia de Matrícula Regular',
      monto: 'S/ 25.00',
      requisitos: ['Solicitud FUT', 'Comprobante de Pago'],
      id: mockProcedimientoId,
      ...metadatos(12, 'p5-fila-21'),
    },
    {
      registroVersionId: mockProcSinAnexosId,
      codigoExterno: 'p1-fila-06',
      codigo: 'p1-fila-06',
      denominacion: 'Certificado de Inglés',
      monto: 'S/ 100.00',
      requisitos: ['Derecho de Certificado', 'Boleta de Venta'],
      id: mockProcSinAnexosId,
      ...metadatos(4, 'p1-fila-06'),
    },
  ];

  const mockRequisitosConAnexos = {
    procedimientoId: mockProcedimientoId,
    codigoRef: 'p5-fila-21',
    denominacion: 'Constancia de Matrícula Regular',
    generaExpediente: true,
    totalRequisitos: 3,
    totalAnexosDigitales: 2,
    totalAnexosObligatorios: 1,
    requisitos: [
      {
        idRequisito: 'req-0001-uuid',
        idProcedimiento: mockProcedimientoId,
        registroVersionId: mockProcedimientoId,
        nombre: 'Formulario Único de Trámite (FUT)',
        descripcion: 'Formulario oficial debidamente firmado',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: true,
        orden: 1,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Requisito 1',
      },
      {
        idRequisito: 'req-0002-uuid',
        idProcedimiento: mockProcedimientoId,
        registroVersionId: mockProcedimientoId,
        nombre: 'Constancia de No Adeudo de Biblioteca',
        descripcion: 'Opcional si es egresado reciente',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: false,
        orden: 2,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Requisito 2',
      },
      {
        idRequisito: 'req-0003-uuid',
        idProcedimiento: mockProcedimientoId,
        registroVersionId: mockProcedimientoId,
        nombre: 'Derecho de tramitación institucional (Tasa TUPA)',
        descripcion: 'Pago en caja de tesorería',
        tipoRequisito: 'FINANCIERO',
        esAnexoDigital: false,
        obligatorio: true,
        orden: 3,
        formatosPermitidos: '',
        activo: true,
        fuenteOriginal: 'Requisito 3',
      },
    ],
    anexosDigitales: [
      {
        idRequisito: 'req-0001-uuid',
        idProcedimiento: mockProcedimientoId,
        registroVersionId: mockProcedimientoId,
        nombre: 'Formulario Único de Trámite (FUT)',
        descripcion: 'Formulario oficial debidamente firmado',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: true,
        orden: 1,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Requisito 1',
      },
      {
        idRequisito: 'req-0002-uuid',
        idProcedimiento: mockProcedimientoId,
        registroVersionId: mockProcedimientoId,
        nombre: 'Constancia de No Adeudo de Biblioteca',
        descripcion: 'Opcional si es egresado reciente',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: false,
        orden: 2,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Requisito 2',
      },
    ],
  };

  const mockRequisitosSinAnexos = {
    procedimientoId: mockProcSinAnexosId,
    codigoRef: 'p1-fila-06',
    denominacion: 'Certificado de Inglés',
    generaExpediente: true,
    totalRequisitos: 2,
    totalAnexosDigitales: 0,
    totalAnexosObligatorios: 0,
    requisitos: [
      {
        idRequisito: 'r-fin-1',
        idProcedimiento: mockProcSinAnexosId,
        registroVersionId: mockProcSinAnexosId,
        nombre: 'Derecho de Certificado (S/ 100.00)',
        tipoRequisito: 'FINANCIERO',
        esAnexoDigital: false,
        obligatorio: true,
        orden: 1,
        formatosPermitidos: '',
        activo: true,
        fuenteOriginal: '',
      },
      {
        idRequisito: 'r-int-1',
        idProcedimiento: mockProcSinAnexosId,
        registroVersionId: mockProcSinAnexosId,
        nombre: 'Emisión de Boleta de Venta Electrónica',
        tipoRequisito: 'INTERNO',
        esAnexoDigital: false,
        obligatorio: true,
        orden: 2,
        formatosPermitidos: '',
        activo: true,
        fuenteOriginal: '',
      },
    ],
    anexosDigitales: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(foliacionPdf, 'contarPaginasPdfArchivo').mockResolvedValue(3);
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes(mockProcedimientoId) && url.includes('/requisitos')) {
        return { data: mockRequisitosConAnexos } as any;
      }
      if (url.includes(mockProcSinAnexosId) && url.includes('/requisitos')) {
        return { data: mockRequisitosSinAnexos } as any;
      }
      return { data: mockCatalogo } as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Carga y renderiza requisitos clasificados (Obligatorio, Opcional y Financiero)', async () => {
    const dataInicial = {
      ...INITIAL_DOCUMENTOS,
      tipoTramiteId: mockProcedimientoId,
      asunto: 'Solicitud formal de constancia de matrícula periodo 2026',
    };

    render(
      <StepDocumentos
        data={dataInicial}
        dispatch={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    // Esperar a que carguen los requisitos estructurados
    await waitFor(() => {
      expect(screen.getByText(/Requisitos Específicos del Trámite \(p5-fila-21\)/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Formulario Único de Trámite \(FUT\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Constancia de No Adeudo de Biblioteca/i)).toBeInTheDocument();
    expect(screen.getByText(/^Obligatorio$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Opcional$/i)).toBeInTheDocument();
    expect(screen.getByText(/Requisito Financiero:/i)).toBeInTheDocument();
  });

  it('2. Bloquea el avance si falta un anexo documental obligatorio', async () => {
    const onNextMock = vi.fn();
    const dataConAsunto = {
      ...INITIAL_DOCUMENTOS,
      tipoTramiteId: mockProcedimientoId,
      asunto: 'Solicitud formal de constancia de matrícula periodo 2026',
      archivos: [], // Sin archivos
    };

    render(
      <StepDocumentos
        data={dataConAsunto}
        dispatch={vi.fn()}
        onNext={onNextMock}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Formulario Único de Trámite \(FUT\)/i)).toBeInTheDocument();
    });

    const botonSiguiente = screen.getByRole('button', { name: /Siguiente →/i });
    expect(botonSiguiente).toBeDisabled();
    expect(onNextMock).not.toHaveBeenCalled();
  });

  it('3. Muestra estado cargado y folios continuos cuando el requisito obligatorio tiene archivo asociado', async () => {
    const dataConArchivoObligatorio = {
      ...INITIAL_DOCUMENTOS,
      tipoTramiteId: mockProcedimientoId,
      asunto: 'Solicitud formal de constancia de matrícula periodo 2026',
      numeroFolios: 3,
      archivos: [
        {
          nombre: 'FUT_Firmado.pdf',
          peso: 154200,
          hashSha256: 'a'.repeat(64),
          paginas: 3,
          folioInicio: 1,
          folioFin: 3,
          idRequisito: 'req-0001-uuid',
          nombreRequisito: 'Formulario Único de Trámite (FUT)',
        },
      ],
    };

    render(
      <StepDocumentos
        data={dataConArchivoObligatorio}
        dispatch={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Requisitos Específicos del Trámite/i)).toBeInTheDocument();
    });

    // Debe mostrar la etiqueta con el rango de folios
    expect(screen.getByText(/✓ Folios 1 al 3 \(3 págs\)/i)).toBeInTheDocument();

    // Esperar a que el catálogo esté resuelto para que el botón esté activo
    await waitFor(() => {
      const botonSiguiente = screen.getByRole('button', { name: /Siguiente →/i });
      expect(botonSiguiente).not.toBeDisabled();
    });
  });

  it('4. Procedimiento sin anexos obligatorios muestra nota informativa y habilita avance con documento general', async () => {
    const dataSinAnexos = {
      ...INITIAL_DOCUMENTOS,
      tipoTramiteId: mockProcSinAnexosId,
      asunto: 'Solicitud formal para emisión de certificado de suficiencia en inglés',
      numeroFolios: 2,
      archivos: [
        {
          nombre: 'Solicitud_Ingles.pdf',
          peso: 85000,
          hashSha256: 'b'.repeat(64),
          paginas: 2,
          folioInicio: 1,
          folioFin: 2,
        },
      ],
    };

    render(
      <StepDocumentos
        data={dataSinAnexos}
        dispatch={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Este procedimiento no requiere anexos documentales obligatorios/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Requisito Financiero:/i)).toBeInTheDocument();
    expect(screen.getByText(/Verificación Interna \/ De Oficio:/i)).toBeInTheDocument();

    await waitFor(() => {
      const botonSiguiente = screen.getByRole('button', { name: /Siguiente →/i });
      expect(botonSiguiente).not.toBeDisabled();
    });
  });
});
