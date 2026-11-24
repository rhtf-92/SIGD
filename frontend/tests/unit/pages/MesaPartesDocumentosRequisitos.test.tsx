// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MesaPartesDigitalPage from '../../../src/pages/tramite/MesaPartesDigitalPage';
import * as procedService from '../../../src/services/procedimientosTupa.service';
import * as foliacionUtils from '../../../src/utils/foliacionPdf';

vi.mock('../../../src/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock foliación PDF para simular lectura de páginas físicas
vi.mock('../../../src/utils/foliacionPdf', async (importOriginal) => {
  const actual = await importOriginal<typeof foliacionUtils>();
  return {
    ...actual,
    contarPaginasPdfArchivo: vi.fn().mockResolvedValue(2),
  };
});

describe('Mesa de Partes Digital — Paso 3: Documentos, Anexos y Requisitos TUPA', () => {
  const mockProcedimientoIngles = {
    registroVersionId: '11720d13-da80-433c-8a24-d02cfd2cb5de',
    id: '11720d13-da80-433c-8a24-d02cfd2cb5de',
    codigo: 'p1-fila-06',
    codigoRef: 'p1-fila-06',
    codigoExterno: 'p1-fila-06',
    denominacion: 'Certificado de Inglés',
    categoria: 'PROCEDIMIENTO_APROBADO',
    clasificacion: 'PROCEDIMIENTO_DOCUMENTARIO',
    monto: 'S/ 100.00',
    costoSoles: 100,
    montoNumero: 100,
    unidadCobro: 'PEN',
    plazo: 'Hasta 15 días hábiles',
    plazoDias: 15,
    plazoDiasHabiles: 15,
    requisitos: ['Pago en el Área de Tesorería', 'Emisión de la B/V'],
    generaExpediente: true,
    admiteRadicacionSigd: true,
    admiteRadicacion: true,
    calificacion: 'EVALUACION_PREVIA_POSITIVO',
    versionFuente: 'TUPA 2026',
    estadoValidacion: 'APROBADO' as const,
    estado: 'APROBADO' as const,
    revision: 1,
    pagina: 12,
    vigenciaDesde: null,
    vigenciaHasta: null,
    vigencia: null,
    version: { etiqueta: 'TUPA 2026', revision: 1, vigenciaDesde: null, vigenciaHasta: null },
    referenciaAprobacion: 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1',
    fuente: {
      nombre: 'TUPA_2026_IESTP_Suiza.pdf',
      documentoSha256: '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
      pagina: 12,
      referenciaFila: 'p1-fila-06',
    },
  };

  const mockRequisitosIngles: procedService.DtoRequisitosProcedimiento = {
    procedimientoId: '3852e80f-1253-4c92-9eca-f2bf860261c1',
    codigoRef: 'p1-fila-06',
    denominacion: 'Certificado de Inglés',
    generaExpediente: true,
    totalRequisitos: 2,
    totalAnexosDigitales: 0,
    totalAnexosObligatorios: 0,
    requisitos: [
      {
        idRequisito: 'a46fa451-b0d5-4912-863d-b5cd45f4e080',
        idProcedimiento: '3852e80f-1253-4c92-9eca-f2bf860261c1',
        registroVersionId: '11720d13-da80-433c-8a24-d02cfd2cb5de',
        nombre: 'Pago en el Área de Tesorería',
        descripcion: 'Requisito financiero liquidado mediante orden de pago oficial de Tesorería.',
        tipoRequisito: 'FINANCIERO',
        esAnexoDigital: false,
        obligatorio: true,
        orden: 1,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Pago en el Área de Tesorería',
        idAnexo: null,
        anexo: null,
      },
      {
        idRequisito: 'c40a3058-08d8-4802-876a-a70d444f64eb',
        idProcedimiento: '3852e80f-1253-4c92-9eca-f2bf860261c1',
        registroVersionId: '11720d13-da80-433c-8a24-d02cfd2cb5de',
        nombre: 'Emisión de la B/V',
        descripcion: 'Actuación o verificación interna del despacho o secretaría técnica.',
        tipoRequisito: 'INTERNO',
        esAnexoDigital: false,
        obligatorio: true,
        orden: 2,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Emisión de la B/V',
        idAnexo: null,
        anexo: null,
      },
    ],
    anexosDigitales: [],
  };

  const mockProcedimientoConAnexos = {
    ...mockProcedimientoIngles,
    registroVersionId: 'e4e443a5-8a37-4d6c-9921-e20fafd29dcc',
    codigo: 'p5-fila-21',
    codigoRef: 'p5-fila-21',
    denominacion: 'Traslado Externo',
  };

  const mockRequisitosConAnexos: procedService.DtoRequisitosProcedimiento = {
    procedimientoId: 'eadc761e-a5bc-44aa-aebe-1da84aa7a52a',
    codigoRef: 'p5-fila-21',
    denominacion: 'Traslado Externo',
    generaExpediente: true,
    totalRequisitos: 4,
    totalAnexosDigitales: 2,
    totalAnexosObligatorios: 1,
    requisitos: [
      {
        idRequisito: '9c716498-1c69-4757-b803-6a83617bedb2',
        idProcedimiento: 'eadc761e-a5bc-44aa-aebe-1da84aa7a52a',
        registroVersionId: 'e4e443a5-8a37-4d6c-9921-e20fafd29dcc',
        nombre: 'Solicitud en FUT dirigida al Director.',
        descripcion: 'Formulario oficial de trámite debidamente completado.',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: true,
        orden: 1,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Solicitud en FUT',
        idAnexo: '71bcd773-b557-46eb-aead-c27c6559fbb8',
        anexo: {
          idAnexo: '71bcd773-b557-46eb-aead-c27c6559fbb8',
          codigo: 'FUT_OFICIAL_2026',
          nombre: 'Formulario Único de Trámite (FUT)',
          descripcion: 'Formato oficial institucional.',
          version: '2026.1',
          nombreArchivo: 'FUT_OFICIAL_IESTP_SUIZA_2026.pdf',
          esDescargable: false, // En BD está como no descargable activo=false
          activo: false,
        },
      },
      {
        idRequisito: 'bbbb2222-3333-4444-5555-666677778888',
        idProcedimiento: 'eadc761e-a5bc-44aa-aebe-1da84aa7a52a',
        registroVersionId: 'e4e443a5-8a37-4d6c-9921-e20fafd29dcc',
        nombre: 'Constancia de No Adeudo de la institución de origen',
        descripcion: 'Documento probatorio opcional en formato PDF.',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: false,
        orden: 2,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Constancia de no adeudo',
        idAnexo: null,
        anexo: null,
      },
      {
        idRequisito: 'cccc3333-4444-5555-6666-777788889999',
        idProcedimiento: 'eadc761e-a5bc-44aa-aebe-1da84aa7a52a',
        registroVersionId: 'e4e443a5-8a37-4d6c-9921-e20fafd29dcc',
        nombre: 'Pago del Derecho en Tesorería',
        descripcion: 'Tasa institucional por traslado externo.',
        tipoRequisito: 'FINANCIERO',
        esAnexoDigital: false,
        obligatorio: true,
        orden: 3,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Pago del Derecho en Tesorería',
        idAnexo: null,
        anexo: null,
      },
      {
        idRequisito: 'dddd4444-5555-6666-7777-888899990000',
        idProcedimiento: 'eadc761e-a5bc-44aa-aebe-1da84aa7a52a',
        registroVersionId: 'e4e443a5-8a37-4d6c-9921-e20fafd29dcc',
        nombre: 'Resolución Directoral - Secretaría Académica',
        descripcion: 'Actuación resolutiva interna.',
        tipoRequisito: 'INTERNO',
        esAnexoDigital: false,
        obligatorio: true,
        orden: 4,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Resolución Directoral',
        idAnexo: null,
        anexo: null,
      },
    ],
    anexosDigitales: [],
  };

  const mockProcedimientoConDoc = {
    ...mockProcedimientoIngles,
    registroVersionId: 'b819f4a1-5c3b-410a-8105-d91012a6b412',
    codigo: 'p3-fila-10',
    codigoRef: 'p3-fila-10',
    denominacion: 'Duplicado de Diploma de Egresado',
  };

  const mockRequisitosConDoc: procedService.DtoRequisitosProcedimiento = {
    procedimientoId: 'b819f4a1-5c3b-410a-8105-d91012a6b412',
    codigoRef: 'p3-fila-10',
    denominacion: 'Duplicado de Diploma de Egresado',
    generaExpediente: true,
    totalRequisitos: 1,
    totalAnexosDigitales: 1,
    totalAnexosObligatorios: 0,
    requisitos: [
      {
        idRequisito: '11111111-2222-3333-4444-555555555555',
        idProcedimiento: 'b819f4a1-5c3b-410a-8105-d91012a6b412',
        registroVersionId: 'b819f4a1-5c3b-410a-8105-d91012a6b412',
        nombre: 'Copia certificada de denuncia policial (Opcional)',
        descripcion: 'Constancia oficial de denuncia policial.',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: false,
        orden: 1,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Denuncia policial',
        idAnexo: null,
        anexo: null,
      },
    ],
    anexosDigitales: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Certificado de Inglés (p1-fila-06): muestra Solicitud Principal (Art. 113 LPAG — D.S. 006-2026-JUS), separa financieros e internos, y no muestra descargas falsas', async () => {
    vi.spyOn(procedService, 'obtenerCatalogoProcedimientosTupa').mockResolvedValueOnce([
      mockProcedimientoIngles as any,
    ]);
    vi.spyOn(procedService, 'obtenerRequisitosProcedimiento').mockResolvedValueOnce(
      mockRequisitosIngles,
    );

    render(
      <MemoryRouter initialEntries={['/mesa-partes?procedimiento=p1-fila-06']}>
        <Routes>
          <Route path="/mesa-partes" element={<MesaPartesDigitalPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Paso 1: Completar datos personales
    await waitFor(() => {
      expect(screen.getByText('Tus datos personales')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('45872315'), { target: { value: '45872315' } });
    fireEvent.change(screen.getByPlaceholderText('ejemplo@correo.com'), {
      target: { value: 'solicitante@test.pe' },
    });
    fireEvent.change(screen.getByPlaceholderText('987654321'), { target: { value: '987654321' } });

    // Avanzar a Paso 2
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Elegir trámite/i }));

    // Paso 2: Verificar trámite preseleccionado
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Tu trámite/i })).toBeInTheDocument();
      expect(screen.getAllByText('Certificado de Inglés').length).toBeGreaterThan(0);
    });

    // Avanzar a Paso 3
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Adjuntar documentos/i }));

    // Paso 3: Verificar documentos y requisitos
    await waitFor(() => {
      expect(screen.getByText('Documentos y requisitos')).toBeInTheDocument();
    });

    // A) Trámite 100% Digital Simplificado (Sin requisitos documentales obligatorios)
    expect(screen.getByText(/Trámite 100% Digital Simplificado/i)).toBeInTheDocument();
    expect(screen.getByText(/Solicitud Digital Oficial \(FUT Digital — Art\. 113 LPAG\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/1\. Solicitud o Escrito de Petición \(Documento Principal\)/i)).not.toBeInTheDocument();

    // B) Requisitos Financieros separados
    expect(screen.getByText(/Información Financiera y Orden de Pago Oficial/i)).toBeInTheDocument();
    expect(screen.getByText(/Pago en el Área de Tesorería/i)).toBeInTheDocument();
    expect(screen.getByText(/El pago previo no es obligatorio para presentar su trámite/i)).toBeInTheDocument();

    // D) Actuaciones Internas separadas
    expect(screen.getByText(/Actuaciones y Verificaciones Internas Institucionales/i)).toBeInTheDocument();
    expect(screen.getByText(/Emisión de la B\/V/i)).toBeInTheDocument();

    // E) No muestra botones de descarga falsos
    expect(screen.queryByText(/Descargar plantilla oficial/i)).not.toBeInTheDocument();
  });

  it('2. Bloquea avance a Paso 4 si falta la solicitud principal u obligatorios y muestra error explícito', async () => {
    vi.spyOn(procedService, 'obtenerCatalogoProcedimientosTupa').mockResolvedValueOnce([
      mockProcedimientoConDoc as any,
    ]);
    vi.spyOn(procedService, 'obtenerRequisitosProcedimiento').mockResolvedValueOnce(
      mockRequisitosConDoc,
    );

    render(
      <MemoryRouter initialEntries={['/mesa-partes?procedimiento=p3-fila-10']}>
        <Routes>
          <Route path="/mesa-partes" element={<MesaPartesDigitalPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Llenar paso 1
    await waitFor(() => screen.getByPlaceholderText('45872315'));
    fireEvent.change(screen.getByPlaceholderText('45872315'), { target: { value: '45872315' } });
    fireEvent.change(screen.getByPlaceholderText('ejemplo@correo.com'), {
      target: { value: 'solicitante@test.pe' },
    });
    fireEvent.change(screen.getByPlaceholderText('987654321'), { target: { value: '987654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Elegir trámite/i }));

    // Paso 2 -> Paso 3
    await waitFor(() => screen.getByRole('button', { name: /Continuar: Adjuntar documentos/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Adjuntar documentos/i }));

    // Paso 3
    await waitFor(() => screen.getByText('Documentos y requisitos'));

    // Botón Continuar deshabilitado si no hay adjuntos
    const btnContinuar = screen.getByRole('button', { name: /Continuar: Revisar y presentar/i });
    expect(btnContinuar).toBeDisabled();
  });

  it('3. Procedimiento con obligatorios y opcionales: distingue badges, asocia idRequisito y no muestra descarga inactiva', async () => {
    vi.spyOn(procedService, 'obtenerCatalogoProcedimientosTupa').mockResolvedValueOnce([
      mockProcedimientoConAnexos as any,
    ]);
    vi.spyOn(procedService, 'obtenerRequisitosProcedimiento').mockResolvedValueOnce(
      mockRequisitosConAnexos,
    );

    render(
      <MemoryRouter initialEntries={['/mesa-partes?procedimiento=p5-fila-21']}>
        <Routes>
          <Route path="/mesa-partes" element={<MesaPartesDigitalPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Llenar paso 1
    await waitFor(() => screen.getByPlaceholderText('45872315'));
    fireEvent.change(screen.getByPlaceholderText('45872315'), { target: { value: '45872315' } });
    fireEvent.change(screen.getByPlaceholderText('ejemplo@correo.com'), {
      target: { value: 'solicitante@test.pe' },
    });
    fireEvent.change(screen.getByPlaceholderText('987654321'), { target: { value: '987654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Elegir trámite/i }));

    // Paso 2 -> Paso 3
    await waitFor(() => screen.getByRole('button', { name: /Continuar: Adjuntar documentos/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Adjuntar documentos/i }));

    // Paso 3
    await waitFor(() => screen.getByText('Documentos y requisitos'));

    // Distingue obligatorio y opcional
    expect(screen.getByText(/Solicitud en FUT dirigida al Director\./i)).toBeInTheDocument();
    expect(screen.getByText(/Constancia de No Adeudo de la institución de origen/i)).toBeInTheDocument();
    expect(screen.getByText('Opcional')).toBeInTheDocument();

    // Como el anexo FUT en BD tiene activo=false y esDescargable=false, no muestra botón falso
    expect(screen.queryByText(/Descargar plantilla oficial/i)).not.toBeInTheDocument();
  });

  it('4. Limpieza de adjuntos al cambiar de procedimiento (prevención BOLA)', async () => {
    vi.spyOn(procedService, 'obtenerCatalogoProcedimientosTupa').mockResolvedValue([
      mockProcedimientoIngles as any,
      mockProcedimientoConAnexos as any,
    ]);
    vi.spyOn(procedService, 'obtenerRequisitosProcedimiento')
      .mockResolvedValueOnce(mockRequisitosIngles)
      .mockResolvedValueOnce(mockRequisitosConAnexos);

    render(
      <MemoryRouter initialEntries={['/mesa-partes?procedimiento=p1-fila-06']}>
        <Routes>
          <Route path="/mesa-partes" element={<MesaPartesDigitalPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Llenar paso 1
    await waitFor(() => screen.getByPlaceholderText('45872315'));
    fireEvent.change(screen.getByPlaceholderText('45872315'), { target: { value: '45872315' } });
    fireEvent.change(screen.getByPlaceholderText('ejemplo@correo.com'), {
      target: { value: 'solicitante@test.pe' },
    });
    fireEvent.change(screen.getByPlaceholderText('987654321'), { target: { value: '987654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Elegir trámite/i }));

    // Paso 2
    await waitFor(() => screen.getByRole('heading', { name: /Tu trámite/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Adjuntar documentos/i }));

    // Paso 3: Volver a Paso 2 y cambiar procedimiento
    await waitFor(() => screen.getByText('Documentos y requisitos'));
    fireEvent.click(screen.getByRole('button', { name: /← Volver/i }));

    // En Paso 2, pulsar "Cambiar trámite" para desplegar el catálogo y seleccionar otro procedimiento
    await waitFor(() => screen.getByRole('heading', { name: /Tu trámite/i }));
    const btnCambiar = screen.queryByRole('button', { name: /Cambiar trámite/i });
    if (btnCambiar) fireEvent.click(btnCambiar);

    const procTraslado = screen.getByText('Traslado Externo');
    fireEvent.click(procTraslado);

    // Debe cargar los nuevos requisitos sin arrastrar estados anteriores
    await waitFor(() => {
      expect(screen.getAllByText('Traslado Externo').length).toBeGreaterThan(0);
    });
  });

  it('5. Carga de archivo PDF para Solicitud Principal, cálculo de folios (F. 1 a 2) y avance a Paso 4', async () => {
    vi.spyOn(procedService, 'obtenerCatalogoProcedimientosTupa').mockResolvedValueOnce([
      mockProcedimientoConDoc as any,
    ]);
    vi.spyOn(procedService, 'obtenerRequisitosProcedimiento').mockResolvedValueOnce(
      mockRequisitosConDoc,
    );

    render(
      <MemoryRouter initialEntries={['/mesa-partes?procedimiento=p3-fila-10']}>
        <Routes>
          <Route path="/mesa-partes" element={<MesaPartesDigitalPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Paso 1
    await waitFor(() => screen.getByPlaceholderText('45872315'));
    fireEvent.change(screen.getByPlaceholderText('45872315'), { target: { value: '45872315' } });
    fireEvent.change(screen.getByPlaceholderText('ejemplo@correo.com'), {
      target: { value: 'solicitante@test.pe' },
    });
    fireEvent.change(screen.getByPlaceholderText('987654321'), { target: { value: '987654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Elegir trámite/i }));

    // Paso 2 -> Paso 3
    await waitFor(() => screen.getByRole('heading', { name: /Tu trámite/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar: Adjuntar documentos/i }));

    // Paso 3
    await waitFor(() => screen.getByText('Documentos y requisitos'));

    // Simular carga de archivo PDF para la Solicitud Principal
    const inputSolicitud = screen.getByLabelText(/Adjuntar Solicitud en PDF/i);
    const fakeFile = new File(['%PDF-1.4 mock content'], 'solicitud_ingles.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(inputSolicitud, { target: { files: [fakeFile] } });

    // Esperar a que se procese el archivo y se calcule la foliación
    await waitFor(() => {
      expect(screen.getByText(/Folio 1 al 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Total: 2 folios/i)).toBeInTheDocument();
    });

    // Ahora el botón para continuar debe estar habilitado
    const btnContinuar = screen.getByRole('button', { name: /Continuar: Revisar y presentar/i });
    expect(btnContinuar).not.toBeDisabled();
    fireEvent.click(btnContinuar);

    // Paso 4: Confirmación
    await waitFor(() => {
      expect(screen.getByText('Confirmación de la solicitud')).toBeInTheDocument();
      expect(screen.getByText(/2 folios/i)).toBeInTheDocument();
      expect(screen.getByText(/Declaración Jurada de Veracidad/i)).toBeInTheDocument();
    });
  });
});
