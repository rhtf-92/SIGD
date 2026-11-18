import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TupaAdminPage from '../../../src/pages/administracion/TupaAdminPage';
import { useAuthStore } from '../../../src/stores/authStore';

const VERSIONES_MOCK = [
  {
    id: '00000000-0000-0000-0000-000000002026',
    codigo: 'TUPA-2026',
    anio: 2026,
    descripcion: 'Texto Único de Procedimientos Administrativos 2026',
    estado: 'VIGENTE',
    total_procedimientos: 72,
  },
  {
    id: '00000000-0000-0000-0000-000000002027',
    codigo: 'TUPA-2027',
    anio: 2027,
    descripcion: 'Texto Único de Procedimientos Administrativos 2027 (Propuesta)',
    estado: 'BORRADOR',
    total_procedimientos: 72,
  },
];

const PROCEDIMIENTOS_MOCK = [
  {
    id: 'proc-1',
    codigo: 'p1-fila-01',
    denominacion: 'Expedición de Certificado de Estudios',
    clasificacion: 'PROCEDIMIENTO_APROBADO',
    costoSoles: 15.5,
    plazoDiasHabiles: 5,
    admiteRadicacionSigd: true,
    requisitos: ['FUT debidamente llenado', 'Comprobante de pago'],
    autoridadCompetente: 'Secretaría Académica',
    activo: true,
    orden: 1,
  },
  {
    id: 'proc-2',
    codigo: 'p2-fila-05',
    denominacion: 'Alquiler del Auditorio Institucional',
    clasificacion: 'SERVICIO_COMERCIAL',
    costoSoles: 120.0,
    plazoDiasHabiles: 1,
    admiteRadicacionSigd: false,
    requisitos: ['Solicitud simple'],
    autoridadCompetente: 'Dirección General',
    activo: true,
    orden: 2,
  },
];

const DOC_OFICIAL_MOCK = {
  idVersion: '00000000-0000-0000-0000-000000002026',
  codigo: 'TUPA-2026',
  denominacion: 'Texto Único de Procedimientos Administrativos 2026',
  anio: 2026,
  estado: 'VIGENTE',
  documentoOficialKey: 'tupa/2026/TUPA_2026_OFICIAL.pdf',
  documentoOficialNombre: 'TUPA_2026_OFICIAL.pdf',
  documentoOficialSha256: '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
  documentoOficialMime: 'application/pdf',
  documentoOficialTamano: 1375801,
  documentoOficialFechaCarga: '2026-10-27T10:00:00.000Z',
  documentoOficialCargadoPor: '00000000-0000-0000-0000-000000000001',
  cargadoPorNombre: 'administrador_demo',
  asociado: true,
};

const HISTORIAL_MOCK = [
  {
    id_historial: 'hist-1',
    id_version: '00000000-0000-0000-0000-000000002026',
    storage_key: 'tupa/2026/TUPA_2026_OFICIAL.pdf',
    nombre_archivo: 'TUPA_2026_OFICIAL.pdf',
    sha256: '4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f',
    mime_type: 'application/pdf',
    tamano_bytes: 1375801,
    motivo_cambio: 'Carga inicial de respaldo digital',
    cargado_por: '00000000-0000-0000-0000-000000000001',
    cargado_por_usuario: 'administrador_demo',
    cargado_por_nombre: 'Administrador Demo',
    creado_en: '2026-10-27T10:00:00.000Z',
  },
];

describe('TupaAdminPage — Administración del Catálogo y Versiones TUPA', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'token-admin-jwt',
      refreshToken: null,
      usuario: {
        id: 'u-admin-1',
        nombreCompleto: 'Admin General',
        correo: 'admin@iestpsuiza.edu.pe',
        rol: 'ADMINISTRADOR',
      },
      isAuthenticated: true,
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/documento-oficial/descargar')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              downloadUrl: 'http://localhost:9000/sigd-expedientes/tupa/2026/TUPA_2026_OFICIAL.pdf?token=123',
              nombreArchivo: 'TUPA_2026_OFICIAL.pdf',
              sha256: DOC_OFICIAL_MOCK.documentoOficialSha256,
            }),
        });
      }
      if (url.includes('/documento-oficial/historial')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(HISTORIAL_MOCK),
        });
      }
      if (url.includes('/documento-oficial')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(DOC_OFICIAL_MOCK),
        });
      }
      if (url.includes('/api/v1/tramites/tupa/versiones') && !url.includes('/procedimientos')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(VERSIONES_MOCK),
        });
      }
      if (url.includes('/procedimientos')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(PROCEDIMIENTOS_MOCK),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renderiza el título, las 4 pestañas y el botón de nueva versión', async () => {
    render(
      <MemoryRouter>
        <TupaAdminPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Gestión y Versionamiento del TUPA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Nueva Versión \(Borrador\)/i })).toBeInTheDocument();

    // Las 4 pestañas requeridas
    expect(screen.getByRole('tab', { name: /Resumen/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Copia oficial/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Catálogo estructurado/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Historial de versiones/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/TUPA-2026/)).toBeInTheDocument();
    });
  });

  it('pestaña [Resumen] muestra métricas clave y principio de doble representación', async () => {
    render(
      <MemoryRouter>
        <TupaAdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Doble Representación Institucional del TUPA 2026/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Entradas/i)).toBeInTheDocument();
      expect(screen.getByText(/Radica en SIGD \(CUT\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Estado de la Copia Oficial Escaneada/i)).toBeInTheDocument();
    });
  });

  it('pestaña [Copia oficial] muestra metadatos del PDF, botones Ver/Descargar y Reemplazar', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TupaAdminPage />
      </MemoryRouter>
    );

    const tabCopia = screen.getByRole('tab', { name: /Copia oficial/i });
    await user.click(tabCopia);

    await waitFor(() => {
      expect(screen.getAllByText('TUPA_2026_OFICIAL.pdf').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/4642d10722bd0b027f41215c2f5f4a05c9ef6992cd0d987e44c6edc1f4d6560f/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /Ver PDF/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Descargar PDF/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reemplazar copia oficial/i })).toBeInTheDocument();
    });

    // Muestra la bitácora de auditoría
    expect(screen.getByText(/Bitácora Histórica de Carga y Reemplazos/i)).toBeInTheDocument();
    expect(screen.getByText('Carga inicial de respaldo digital')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver versión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeInTheDocument();
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const defaultFetch = fetchMock.getMockImplementation() as (url: string, options?: RequestInit) => Promise<unknown>;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/historial/hist-1/descargar')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ downloadUrl: 'http://localhost:9000/objeto-historico', nombreArchivo: 'TUPA_2026_OFICIAL.pdf' }) });
      }
      return defaultFetch(url, options);
    });
    await user.click(screen.getByRole('button', { name: 'Ver versión' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/historial/hist-1/descargar'), expect.any(Object)
    ));
  });

  it('pestaña [Catálogo estructurado] lista los procedimientos y permite filtrar', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TupaAdminPage />
      </MemoryRouter>
    );

    const tabCatalogo = screen.getByRole('tab', { name: /Catálogo estructurado/i });
    await user.click(tabCatalogo);

    await waitFor(() => {
      expect(screen.getByText('Expedición de Certificado de Estudios')).toBeInTheDocument();
      expect(screen.getByText('Alquiler del Auditorio Institucional')).toBeInTheDocument();
      expect(screen.getByText('p1-fila-01')).toBeInTheDocument();
      expect(screen.getByText('p2-fila-05')).toBeInTheDocument();
    });

    // Filtrar por texto
    const searchInput = screen.getByPlaceholderText(/Buscar por código, denominación o unidad competente/i);
    await user.type(searchInput, 'Auditorio');

    await waitFor(() => {
      expect(screen.getByText('Alquiler del Auditorio Institucional')).toBeInTheDocument();
      expect(screen.queryByText('Expedición de Certificado de Estudios')).not.toBeInTheDocument();
    });
  });

  it('pestaña [Historial de versiones] permite alternar entre versiones y muestra publicar en BORRADOR', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TupaAdminPage />
      </MemoryRouter>
    );

    const tabVersiones = screen.getByRole('tab', { name: /Historial de versiones/i });
    await user.click(tabVersiones);

    await waitFor(() => {
      expect(screen.getByText('Catálogo Histórico de Versiones TUPA')).toBeInTheDocument();
      expect(screen.getByText('TUPA-2027')).toBeInTheDocument();
    });

    // Seleccionar versión TUPA-2027 (BORRADOR)
    const botonTupa2027 = screen.getByRole('button', { name: /TUPA-2027/i });
    await user.click(botonTupa2027);

    // Debe mostrar botón "Publicar / Activar Versión"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Publicar \/ Activar Versión/i })).toBeInTheDocument();
    });
  });

  it('modal de reemplazo exige confirmación de que no altera los 72 procedimientos', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TupaAdminPage />
      </MemoryRouter>
    );

    const tabCopia = screen.getByRole('tab', { name: /Copia oficial/i });
    await user.click(tabCopia);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reemplazar copia oficial/i })).toBeInTheDocument();
    });

    const botonReemplazar = screen.getByRole('button', { name: /Reemplazar copia oficial/i });
    await user.click(botonReemplazar);

    expect(screen.getByText(/Aviso de Independencia del Catálogo Estructurado/i)).toBeInTheDocument();
    expect(screen.getByText(/No altera ni borra ninguno de los 72 procedimientos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar y Cargar en MinIO/i })).toBeDisabled();
  });

  it('elimina fallback Base64: si falla la URL prefirmada no intenta subir Base64 ni llama a /subir', async () => {
    const user = userEvent.setup();
    const fetchMock = globalThis.fetch as any;

    render(
      <MemoryRouter>
        <TupaAdminPage />
      </MemoryRouter>
    );

    const tabCopia = screen.getByRole('tab', { name: /Copia oficial/i });
    await user.click(tabCopia);
    await waitFor(() => screen.getByRole('button', { name: /Reemplazar copia oficial/i }));
    await user.click(screen.getByRole('button', { name: /Reemplazar copia oficial/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['%PDF-1.4 test'], 'TUPA_NUEVO.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, testFile);

    // Esperar que finalice el cálculo del SHA-256 y se active el formulario
    await waitFor(() => {
      expect(screen.getByText(/TUPA_NUEVO.pdf/i)).toBeInTheDocument();
    });

    const motivoInput = screen.getByPlaceholderText(/Fe de erratas/i);
    await user.type(motivoInput, 'Actualización por resolución');

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    // Interceptamos solo presigned-url para simular fallo
    const defaultHandler = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url: string, opts: any) => {
      if (url.includes('/presigned-url')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Fallo al generar URL prefirmada' }),
        });
      }
      return defaultHandler(url, opts);
    });

    const botonSubir = screen.getByRole('button', { name: /Confirmar y Cargar en MinIO/i });
    expect(botonSubir).toBeEnabled();
    const form = botonSubir.closest('form')!;
    fireEvent.submit(form);

    // Debe mostrar error descriptivo y NO llamar a endpoint /subir (Base64)
    await waitFor(() => {
      expect(screen.getByText(/Fallo al generar URL prefirmada/i)).toBeInTheDocument();
    });

    const llamadasSubir = fetchMock.mock.calls.filter(([callUrl]: [string]) => callUrl.includes('/documento-oficial/subir'));
    expect(llamadasSubir.length).toBe(0);
  });

  it('si falla la confirmación tras subir a MinIO, permite reintentar confirmación sin retransferir el binario', async () => {
    const user = userEvent.setup();
    const fetchMock = globalThis.fetch as any;

    render(
      <MemoryRouter>
        <TupaAdminPage />
      </MemoryRouter>
    );

    const tabCopia = screen.getByRole('tab', { name: /Copia oficial/i });
    await user.click(tabCopia);
    await waitFor(() => screen.getByRole('button', { name: /Reemplazar copia oficial/i }));
    await user.click(screen.getByRole('button', { name: /Reemplazar copia oficial/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['%PDF-1.4 test'], 'TUPA_NUEVO.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, testFile);

    await waitFor(() => {
      expect(screen.getByText(/TUPA_NUEVO.pdf/i)).toBeInTheDocument();
    });

    const motivoInput = screen.getByPlaceholderText(/Fe de erratas/i);
    await user.type(motivoInput, 'Actualización por fe de erratas');

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    // Mockeamos: presigned OK, PUT S3 OK, confirmación /documento-oficial falla la primera vez
    let confirmaciones = 0;
    let putS3Count = 0;
    const defaultHandler = fetchMock.getMockImplementation();

    fetchMock.mockImplementation((url: string, opts: any) => {
      if (url.includes('/presigned-url')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            uploadUrl: 'http://localhost:9000/sigd-expedientes/tupa/2026/TUPA_2026_OFICIAL.pdf?token=abc',
            uploadId: '33333333-3333-4333-8333-333333333333',
            storageKey: 'tupa/2026/TUPA_2026_OFICIAL.pdf',
          }),
        });
      }
      if (opts?.method === 'PUT') {
        putS3Count++;
        return Promise.resolve({ ok: true });
      }
      if (url.endsWith('/documento-oficial') && opts?.method === 'POST') {
        confirmaciones++;
        if (confirmaciones === 1) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ message: 'Error temporal en BD al confirmar' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ asociado: true }),
        });
      }
      return defaultHandler(url, opts);
    });

    const botonSubir = screen.getByRole('button', { name: /Confirmar y Cargar en MinIO/i });
    expect(botonSubir).toBeEnabled();
    const form = botonSubir.closest('form')!;
    fireEvent.submit(form);

    // Debe mostrar error indicando que el archivo ya subió y se puede reintentar la confirmación
    await waitFor(() => {
      expect(screen.getByText(/Archivo subido\. No se pudo confirmar el registro/i)).toBeInTheDocument();
    });

    // En este punto, S3 recibió 1 subida
    expect(putS3Count).toBe(1);

    // El botón debe haber cambiado a "Reintentar confirmación"
    const botonReintentar = screen.getByRole('button', { name: /Reintentar confirmación/i });
    expect(botonReintentar).toBeInTheDocument();

    // Reintentamos confirmación
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/actualizada y auditada exitosamente en MinIO\/S3/i)).toBeInTheDocument();
    });

    // NO se volvió a subir el archivo a S3 (putS3Count sigue en 1)
    expect(putS3Count).toBe(1);
    expect(confirmaciones).toBe(2);
    const confirmRequests = fetchMock.mock.calls.filter(([url, opts]: [string, { method?: string }]) =>
      url.endsWith('/documento-oficial') && opts?.method === 'POST'
    );
    expect(JSON.parse(confirmRequests[0][1].body).uploadId).toBe('33333333-3333-4333-8333-333333333333');
    expect(JSON.parse(confirmRequests[1][1].body).uploadId).toBe('33333333-3333-4333-8333-333333333333');
  });
});
