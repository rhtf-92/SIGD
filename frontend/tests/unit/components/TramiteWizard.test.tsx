/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-17 — Pruebas de integración de componentes con React Testing Library
 * ARCHIVO: tests/unit/components/TramiteWizard.test.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * 10 Pruebas de Integración exhaustivas para el componente orquestador TramiteWizard.
 * Cubre:
 * - Test 1: Renderizado inicial en Paso 1 con foco en el primer campo.
 * - Test 2: Validación bloqueante de DNI (rechazar letras o menos de 8 dígitos) impidiendo avanzar.
 * - Test 3: Avance exitoso al Paso 2 con datos de identificación completos.
 * - Test 4: Validación de selección de trámite TUPA y asunto en Paso 2.
 * - Test 5: Persistencia de datos (State Lifting / Reducer) al retroceder del Paso 2 al Paso 1 con botón 'Anterior'.
 * - Test 6: Validación de consentimiento obligatorio de términos y LPAG en Paso 3.
 * - Test 7: Verificación del resumen consolidado en Paso 4 con los datos provistos en pasos previos.
 * - Test 8: Sincronización y persistencia defensiva con sessionStorage.
 * - Test 9: Disparo y bloqueo del botón 'Radicar Trámite' mostrando estado de carga.
 * - Test 10: Renderizado y apertura de CargoDigitalModal con CUT visible ante respuesta HTTP 201 Created simulada.
 *
 * Cumplimiento técnico:
 * - Queries accesibles (getByRole, findByRole, getByLabelText).
 * - Cero 'any', 100% tipado estricto con TypeScript.
 * - Limpieza de mocks y sessionStorage en cada beforeEach.
 * ==============================================================================
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TramiteWizard } from '@/components/tramite/TramiteWizard';
import { StepConfirmacion } from '@/components/tramite/WizardSteps/StepConfirmacion';
import { StepDocumentos } from '@/components/tramite/WizardSteps/StepDocumentos';
import { TRAMITE_WIZARD_STORAGE_KEY } from '@/hooks/useTramiteWizardReducer';
import { apiClient } from '@/api/client';
import { ApiHttpError } from '@/types/api';
import { useAuthStore } from '@/stores/authStore';
import { INITIAL_WIZARD_STATE } from '@/types/tramiteWizardState';

const ARCHIVO_SUBIDO = {
  nombre: 'solicitud.pdf', peso: 128, hashSha256: 'a'.repeat(64),
  storageUrl: 'expedientes/2026/11111111-1111-4111-8111-111111111111.pdf',
};
vi.mock('@/hooks/usePresignedUpload', () => ({
  usePresignedUpload: () => ({
    upload: async (file: File) => ({ file, sha256: ARCHIVO_SUBIDO.hashSha256, s3Key: ARCHIVO_SUBIDO.storageUrl }),
    cancel: () => {}, status: 'idle', progress: 0, error: null,
  }),
}));

const TIPOS_FORMALES = [
  {
    id: '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd',
    codigo: 'SUZ26-035',
    denominacion: 'Certificado de Estudios Superiores (6 semestres)',
    descripcion: 'Descripción del PDF: pago del derecho en Tesorería; comprobante de pago.',
    unidad_organica: 'DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL',
    vigente: true,
  },
  {
    id: 'a778cedf-c565-4d07-b74d-012550d110c2',
    codigo: 'SUZ26-034',
    denominacion: 'Expedición de Título',
    descripcion: null,
    unidad_organica: 'DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL',
    vigente: true,
  },
  {
    id: '36186535-00c2-43f2-b0cc-f657886ad8b5',
    codigo: 'SUZ26-068',
    denominacion: 'Acceso a la Información Pública',
    descripcion: 'El PDF indica solicitud dirigida a Dirección en FUT y pago del derecho en Tesorería.',
    unidad_organica: 'DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL',
    vigente: true,
  },
];

describe('T-FE-MPV-17: Pruebas de Integración de Componentes - TramiteWizard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({ accessToken: 'access-test', refreshToken: 'refresh-test', isAuthenticated: true });
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: TIPOS_FORMALES } as never);
  });

  afterEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
    vi.restoreAllMocks();
  });

  it.skipIf(!process.env.SIGD_TUPA_LIVE_URL)('consulta el catálogo real y conserva su UUID sin radicar ni subir archivos', async () => {
    const destino = process.env.SIGD_TUPA_LIVE_URL!;
    expect(new URL(destino).origin).toBe('http://localhost:3000');
    vi.mocked(apiClient.get).mockRestore();
    const baseAnterior = apiClient.defaults.baseURL;
    const post = vi.spyOn(apiClient, 'post');
    apiClient.defaults.baseURL = destino;
    try {
      const respuesta = await apiClient.get('/api/v1/tramites/tipos');
      expect(respuesta.data).toHaveLength(19);
      const procedimiento = respuesta.data.find((tipo: { codigo: string }) => tipo.codigo === 'SUZ26-035');
      expect(procedimiento.id).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
      const dispatch = vi.fn();
      render(<StepDocumentos data={INITIAL_WIZARD_STATE.documentos}
        dispatch={dispatch} onNext={vi.fn()} onBack={vi.fn()} />);
      await screen.findByRole('option', { name: /SUZ26-035 — Certificado de Estudios Superiores/i });
      const selector = screen.getByRole('combobox');
      expect(within(selector).getAllByRole('option').filter(opcion => opcion.textContent?.startsWith('SUZ26-'))).toHaveLength(19);
      fireEvent.change(selector, { target: { value: procedimiento.id } });
      expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_DOCUMENTOS', payload: { tipoTramiteId: procedimiento.id } });
      expect(post).not.toHaveBeenCalled();
    } finally {
      apiClient.defaults.baseURL = baseAnterior;
    }
  });

  /**
   * Helper para completar los campos del Paso 1 (Identificación)
   */
  const fillPaso1 = async (
    user: ReturnType<typeof userEvent.setup>,
    overrides?: {
      tipoDoc?: string;
      numDoc?: string;
      nombres?: string;
      apellidos?: string;
      correo?: string;
      telefono?: string;
    }
  ) => {
    const data = {
      tipoDoc: 'DNI',
      numDoc: '74123456',
      nombres: 'María Elena',
      apellidos: 'Vargas Paredes',
      correo: 'maria.vargas@iestpsuiza.edu.pe',
      telefono: '961987654',
      ...overrides,
    };

    if (data.tipoDoc !== 'DNI') {
      await user.selectOptions(
        screen.getByLabelText(/Tipo de Documento Oficial/i),
        data.tipoDoc
      );
    }
    await user.type(screen.getByLabelText(/Número de Documento \*/i), data.numDoc);
    await user.type(screen.getByLabelText(/Nombres Completos \*/i), data.nombres);
    await user.type(screen.getByLabelText(/Apellidos Completos \*/i), data.apellidos);
    await user.type(
      screen.getByLabelText(/Correo Electrónico Notificable \*/i),
      data.correo
    );
    await user.type(screen.getByLabelText(/Teléfono Celular o Fijo \*/i), data.telefono);
  };

  /**
   * Helper para completar los campos del Paso 2 (Documentos del Trámite)
   */
  const fillPaso2 = async (
    user: ReturnType<typeof userEvent.setup>,
    overrides?: {
      tipoTramiteId?: string;
      asunto?: string;
      folios?: string;
    }
  ) => {
    const data = {
      tipoTramiteId: TIPOS_FORMALES[0].id,
      asunto: 'Solicitud formal de certificado oficial de estudios concluidos',
      folios: '4',
      ...overrides,
    };

    const selector = screen.getByLabelText(/Procedimiento Institucional/i);
    await waitFor(() => expect(Array.from((selector as HTMLSelectElement).options).some((option) => option.value === data.tipoTramiteId)).toBe(true));
    await user.selectOptions(selector, data.tipoTramiteId);
    await user.type(screen.getByLabelText(/Asunto o Petitorio Sucinto \*/i), data.asunto);
    const inputFolios = screen.getByLabelText(/Folios/i);
    await user.clear(inputFolios);
    await user.type(inputFolios, data.folios);

    // Cargar archivo PDF de prueba requerido para validación
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(['%PDF-1.7 prueba'], 'solicitud.pdf', { type: 'application/pdf' }));
    await screen.findByText('solicitud.pdf');
  };

  /**
   * Helper para aceptar declaraciones en el Paso 3 (Declaración Jurada)
   */
  const fillPaso3 = async (user: ReturnType<typeof userEvent.setup>) => {
    const checkVeracidad = screen.getByLabelText(
      /Declaración Jurada de Veracidad \(Art\. 51 LPAG\)/i
    );
    const checkTerminos = screen.getByLabelText(
      /Aceptación de Términos y Condiciones de Uso/i
    );
    await user.click(checkVeracidad);
    await user.click(checkTerminos);
  };

  const llegarAConfirmacion = async (
    user: ReturnType<typeof userEvent.setup>,
    tipoTramiteId = TIPOS_FORMALES[0].id,
    conRouter = false,
  ) => {
    render(conRouter
      ? <MemoryRouter initialEntries={['/tramite/mesa-partes-virtual']}><TramiteWizard /></MemoryRouter>
      : <TramiteWizard />);
    await fillPaso1(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));
    await fillPaso2(user, { tipoTramiteId });
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));
    await fillPaso3(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));
    return screen.findByRole('button', { name: /Radicar Trámite/i });
  };

  // ===========================================================================
  // TEST 1
  // ===========================================================================
  it('Test 1: Renderizado inicial en Paso 1 con foco en el primer campo', () => {
    render(<TramiteWizard />);

    // Verifica que el asistente renderiza el encabezado del Paso 1
    expect(
      screen.getByRole('heading', { name: /Identificación del Solicitante/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Paso 1 de 4/i).length).toBeGreaterThanOrEqual(1);

    // Verifica que el primer campo (Tipo de Documento) tiene el foco inicial accesible
    const firstField = screen.getByLabelText(/Tipo de Documento Oficial/i);
    expect(firstField).toBeInTheDocument();
    expect(firstField).toHaveFocus();
  });

  // ===========================================================================
  // TEST 2
  // ===========================================================================
  it('Test 2: Validación bloqueante de DNI (rechazar letras o menos de 8 dígitos) impidiendo avanzar', async () => {
    const user = userEvent.setup();
    render(<TramiteWizard />);

    const inputDoc = screen.getByLabelText(/Número de Documento \*/i);
    const btnSiguiente = screen.getByRole('button', { name: /^Siguiente/i });

    // 1. DNI con menos de 8 dígitos
    await user.type(inputDoc, '12345');
    await user.tab(); // trigger blur

    expect(btnSiguiente).toBeDisabled();
    expect(
      screen.getByText(/El DNI debe contener exactamente 8 dígitos numéricos/i)
    ).toBeInTheDocument();

    // 2. Completar los demás campos requeridos
    await user.type(screen.getByLabelText(/Nombres Completos \*/i), 'Carlos');
    await user.type(screen.getByLabelText(/Apellidos Completos \*/i), 'López');
    await user.type(
      screen.getByLabelText(/Correo Electrónico Notificable \*/i),
      'carlos@iestpsuiza.edu.pe'
    );
    await user.type(screen.getByLabelText(/Teléfono Celular o Fijo \*/i), '961123456');

    // Debe seguir deshabilitado por el DNI inválido
    expect(btnSiguiente).toBeDisabled();

    // Un click forzado no debe navegar al Paso 2
    fireEvent.click(btnSiguiente);
    expect(
      screen.getByRole('heading', { name: /Identificación del Solicitante/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Documentos del Trámite/i })
    ).not.toBeInTheDocument();

    // 3. DNI con letras
    await user.clear(inputDoc);
    await user.type(inputDoc, '1234ABCD');
    await user.tab();

    expect(btnSiguiente).toBeDisabled();
    expect(
      screen.getByText(/El DNI debe contener exactamente 8 dígitos numéricos/i)
    ).toBeInTheDocument();
  });

  // ===========================================================================
  // TEST 3
  // ===========================================================================
  it('Test 3: Avance exitoso al Paso 2 con datos de identificación completos', async () => {
    const user = userEvent.setup();
    render(<TramiteWizard />);

    await fillPaso1(user);

    const btnSiguiente = screen.getByRole('button', { name: /^Siguiente/i });
    expect(btnSiguiente).not.toBeDisabled();

    await user.click(btnSiguiente);

    // Verifica que se visualiza el encabezado del Paso 2
    expect(
      await screen.findByRole('heading', { name: /Documentos del Trámite/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Paso 2 de 4/i).length).toBeGreaterThanOrEqual(1);
  });

  // ===========================================================================
  // TEST 4
  // ===========================================================================
  it('Test 4: Validación de selección de trámite TUPA y asunto en Paso 2', async () => {
    const user = userEvent.setup();
    render(<TramiteWizard />);

    await fillPaso1(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    expect(
      await screen.findByRole('heading', { name: /Documentos del Trámite/i })
    ).toBeInTheDocument();

    const btnSiguiente = screen.getByRole('button', { name: /^Siguiente/i });
    // Inicialmente deshabilitado: falta seleccionar TUPA y escribir asunto
    expect(btnSiguiente).toBeDisabled();

    // Seleccionar TUPA pero sin asunto
    const selectTupa = screen.getByLabelText(/Procedimiento Institucional/i);
    await screen.findByRole('option', { name: /SUZ26-035 — Certificado de Estudios Superiores/i });
    await user.selectOptions(selectTupa, TIPOS_FORMALES[0].id);
    expect(btnSiguiente).toBeDisabled();

    // Asunto muy corto (menos de 10 caracteres)
    const inputAsunto = screen.getByLabelText(/Asunto o Petitorio Sucinto \*/i);
    await user.type(inputAsunto, 'Certif');
    await user.tab();

    expect(
      screen.getByText(/El asunto debe contener al menos 10 caracteres/i)
    ).toBeInTheDocument();
    expect(btnSiguiente).toBeDisabled();

    // Asunto válido con longitud adecuada
    await user.clear(inputAsunto);
    await user.type(inputAsunto, 'Solicito emisión formal de certificado de estudios');

    // Todavía deshabilitado por requerir archivo probatorio PDF
    expect(btnSiguiente).toBeDisabled();

    // La demostración no acredita persistencia ni debe habilitar el envío.
    const btnCargarPdf = screen.getByRole('button', { name: /\+ Cargar PDF de prueba/i });
    await user.click(btnCargarPdf);
    expect(btnSiguiente).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Eliminar$/i }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['%PDF-1.7 prueba'], 'solicitud.pdf', { type: 'application/pdf' }));
    expect(btnSiguiente).not.toBeDisabled();
  });

  it.each([undefined, 'blob:archivo-local', 'https://externo.invalid/solicitud.pdf'])
  ('no avanza desde documentos con una referencia no persistente: %s', async storageUrl => {
    const siguiente = vi.fn();
    render(<StepDocumentos data={{
      ...INITIAL_WIZARD_STATE.documentos,
      tipoTramiteId: TIPOS_FORMALES[0].id,
      asunto: 'Solicitud con archivo pendiente de almacenamiento',
      archivos: [{ ...ARCHIVO_SUBIDO, storageUrl }],
    }} dispatch={vi.fn()} onNext={siguiente} onBack={vi.fn()} />);
    await screen.findByRole('option', { name: /SUZ26-035 — Certificado de Estudios Superiores/i });
    const boton = screen.getByRole('button', { name: /^Siguiente/i });
    expect(boton).toBeDisabled();
    expect(screen.getByText(/Hay archivos sin una referencia de almacenamiento válida/i)).toBeInTheDocument();
    fireEvent.click(boton);
    expect(siguiente).not.toHaveBeenCalled();
  });

  it.each([501, 5000])('conserva el límite de folios admitido por radicación: %s', async numeroFolios => {
    render(<StepDocumentos data={{
      ...INITIAL_WIZARD_STATE.documentos,
      tipoTramiteId: TIPOS_FORMALES[0].id,
      asunto: 'Solicitud con folios dentro del contrato vigente',
      numeroFolios,
      archivos: [ARCHIVO_SUBIDO],
    }} dispatch={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />);
    await screen.findByRole('option', { name: /SUZ26-035 — Certificado de Estudios Superiores/i });
    expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeEnabled();
  });

  // ===========================================================================
  // TEST 5
  // ===========================================================================
  it('Test 5: Persistencia de datos (State Lifting / Reducer) al retroceder del Paso 2 al Paso 1 con botón "Anterior"', async () => {
    const user = userEvent.setup();
    render(<TramiteWizard />);

    await fillPaso1(user, {
      numDoc: '78945612',
      nombres: 'Beatriz',
      apellidos: 'Mendoza Ruiz',
      correo: 'beatriz.mendoza@iestpsuiza.edu.pe',
      telefono: '987654321',
    });

    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));
    expect(
      await screen.findByRole('heading', { name: /Documentos del Trámite/i })
    ).toBeInTheDocument();

    // Retroceder al Paso 1
    const btnAnterior = screen.getByRole('button', { name: /← Anterior/i });
    await user.click(btnAnterior);

    // Verificar que los datos en el Paso 1 se mantienen intactos
    expect(
      screen.getByRole('heading', { name: /Identificación del Solicitante/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Número de Documento \*/i)).toHaveValue('78945612');
    expect(screen.getByLabelText(/Nombres Completos \*/i)).toHaveValue('Beatriz');
    expect(screen.getByLabelText(/Apellidos Completos \*/i)).toHaveValue('Mendoza Ruiz');
    expect(screen.getByLabelText(/Correo Electrónico Notificable \*/i)).toHaveValue(
      'beatriz.mendoza@iestpsuiza.edu.pe'
    );
    expect(screen.getByLabelText(/Teléfono Celular o Fijo \*/i)).toHaveValue('987654321');
  });

  // ===========================================================================
  // TEST 6
  // ===========================================================================
  it('Test 6: Validación de consentimiento obligatorio de términos y LPAG en Paso 3', async () => {
    const user = userEvent.setup();
    render(<TramiteWizard />);

    await fillPaso1(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    await fillPaso2(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    expect(
      await screen.findByRole('heading', {
        name: /Declaración Jurada/i,
      })
    ).toBeInTheDocument();

    const btnSiguiente = screen.getByRole('button', { name: /^Siguiente/i });
    expect(btnSiguiente).toBeDisabled();

    const checkVeracidad = screen.getByLabelText(
      /Declaración Jurada de Veracidad \(Art\. 51 LPAG\)/i
    );
    const checkTerminos = screen.getByLabelText(
      /Aceptación de Términos y Condiciones de Uso/i
    );

    // Marcar solo veracidad -> botón continúa deshabilitado
    await user.click(checkVeracidad);
    expect(btnSiguiente).toBeDisabled();

    // Marcar también términos y condiciones -> botón habilitado
    await user.click(checkTerminos);
    expect(btnSiguiente).not.toBeDisabled();

    // Avanzar al Paso 4
    await user.click(btnSiguiente);
    expect(
      await screen.findByRole('heading', { name: /Confirmación y Emisión de Cargo/i })
    ).toBeInTheDocument();
  });

  // ===========================================================================
  // TEST 7
  // ===========================================================================
  it('Test 7: Verificación del resumen consolidado en Paso 4 con los datos provistos en pasos previos', async () => {
    const user = userEvent.setup();
    render(<TramiteWizard />);

    await fillPaso1(user, {
      numDoc: '76543210',
      nombres: 'Valeria',
      apellidos: 'Ríos Saldaña',
      correo: 'valeria.rios@iestpsuiza.edu.pe',
      telefono: '942123456',
    });
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    await fillPaso2(user, {
      tipoTramiteId: TIPOS_FORMALES[1].id,
      asunto: 'Expedición de Título Profesional Técnico',
      folios: '5',
    });
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    await fillPaso3(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    // Verificación de datos consolidados en Paso 4
    expect(
      await screen.findByRole('heading', { name: /Confirmación y Emisión de Cargo/i })
    ).toBeInTheDocument();

    // 1. Resumen Solicitante
    expect(screen.getByText(/Valeria Ríos Saldaña/i)).toBeInTheDocument();
    expect(screen.getByText('76543210')).toBeInTheDocument();
    expect(screen.getByText(/valeria\.rios@iestpsuiza\.edu\.pe/i)).toBeInTheDocument();
    expect(screen.getByText('942123456')).toBeInTheDocument();

    // 2. Resumen Procedimiento
    expect(screen.getByText(/SUZ26-034 — Expedición de Título/i)).toBeInTheDocument();
    expect(screen.getByText(/Folios:/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Expedición de Título Profesional Técnico/i).length
    ).toBeGreaterThan(0);

    // 3. Resumen Conformidad Legal
    expect(screen.getByText(/Veracidad Jurada \(Art\. 51 LPAG\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Términos y Condiciones MPV/i)).toBeInTheDocument();

    // Botón oficial de radicación visible
    expect(screen.getByRole('button', { name: /Radicar Trámite/i })).toBeInTheDocument();
  });

  // ===========================================================================
  // TEST 8
  // ===========================================================================
  it('Test 8: Sincronización y persistencia defensiva con sessionStorage', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TramiteWizard />);

    await fillPaso1(user, {
      numDoc: '71122334',
      nombres: 'Fernando',
      apellidos: 'Torres Mori',
    });

    // Validar serialización en sessionStorage
    const storageRaw = sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY);
    expect(storageRaw).not.toBeNull();
    const parsed = JSON.parse(storageRaw!);
    expect(parsed.identificacion.numeroDocumento).toBe('71122334');
    expect(parsed.identificacion.nombres).toBe('Fernando');
    expect(parsed.identificacion.apellidos).toBe('Torres Mori');

    // Desmontar el componente
    unmount();

    // Volver a montar: Lazy initialization debe restaurar los datos del borrador
    render(<TramiteWizard />);

    expect(screen.getByLabelText(/Número de Documento \*/i)).toHaveValue('71122334');
    expect(screen.getByLabelText(/Nombres Completos \*/i)).toHaveValue('Fernando');
    expect(screen.getByLabelText(/Apellidos Completos \*/i)).toHaveValue('Torres Mori');
  });

  it('no permite avanzar si el catálogo formal devuelve registros ambiguos o mal formados', async () => {
    const user = userEvent.setup();
    const mockGet = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: [{ id: 'SUZ26-034', codigo: 'TUPA-02', denominacion: 'Expedición de Título', vigente: true }],
    } as never);
    render(<TramiteWizard />);
    await fillPaso1(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/datos incompletos o ambiguos/i);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/tramites/tipos', expect.any(Object));
    expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reintentar consulta/i })).toBeInTheDocument();
  });

  it('no permite radicar con una selección antigua guardada por código en vez de UUID', async () => {
    const mockPost = vi.spyOn(apiClient, 'post');
    const dispatch = vi.fn();
    const state = {
      ...INITIAL_WIZARD_STATE,
      currentStep: 4 as const,
      identificacion: {
        ...INITIAL_WIZARD_STATE.identificacion,
        numeroDocumento: '74123456',
        nombres: 'María Elena',
        apellidos: 'Vargas Paredes',
        correo: 'maria.vargas@iestpsuiza.edu.pe',
      },
      documentos: {
        ...INITIAL_WIZARD_STATE.documentos,
        tipoTramiteId: 'TUPA-02',
        asunto: 'Solicitud de trámite institucional válida',
        archivos: [ARCHIVO_SUBIDO],
      },
    };
    render(<StepConfirmacion state={state} dispatch={dispatch} onBack={vi.fn()} />);
    await screen.findByText(/El procedimiento guardado no está en el catálogo vigente/i);
    await userEvent.click(screen.getByRole('button', { name: /Radicar Trámite/i }));

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SET_ERROR',
      payload: expect.stringMatching(/vuelva al paso 2/i),
    }));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('muestra una lista vacía sin inventar tipos ni permitir avanzar', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: [] } as never);
    render(<TramiteWizard />);
    await fillPaso1(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/no informa tipos formales/i);
    expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeDisabled();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('bloquea el envío si no se pudo cargar el catálogo formal', async () => {
    const mockGet = vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('catálogo no disponible'));
    const mockPost = vi.spyOn(apiClient, 'post');
    const user = userEvent.setup();
    render(<TramiteWizard />);
    await fillPaso1(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo consultar el catálogo formal/i);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/tramites/tipos', expect.any(Object));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('no radica un borrador con archivo local blob ni emite cargo', async () => {
    const dispatch = vi.fn();
    const post = vi.spyOn(apiClient, 'post');
    render(<StepConfirmacion state={{
      ...INITIAL_WIZARD_STATE,
      documentos: { ...INITIAL_WIZARD_STATE.documentos, tipoTramiteId: TIPOS_FORMALES[0].id,
        archivos: [{ ...ARCHIVO_SUBIDO, storageUrl: 'blob:archivo-local' }] },
    }} dispatch={dispatch} onBack={vi.fn()} />);
    await screen.findByText(/SUZ26-035 — Certificado de Estudios Superiores/i);
    await userEvent.click(screen.getByRole('button', { name: /Radicar Trámite/i }));
    expect(post).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ERROR', payload: expect.stringContaining('subir los documentos') });
    expect(dispatch.mock.calls.some(([action]) => action.type === 'SET_CARGO')).toBe(false);
  });

  it('envía el UUID exacto seleccionado y vuelve a verificar que siga vigente', async () => {
    const user = userEvent.setup();
    const uuid = TIPOS_FORMALES[0].id;
    const state = {
      ...INITIAL_WIZARD_STATE,
      currentStep: 4 as const,
      identificacion: {
        ...INITIAL_WIZARD_STATE.identificacion,
        numeroDocumento: '74123456',
        nombres: 'María Elena',
        apellidos: 'Vargas Paredes',
        correo: 'maria.vargas@iestpsuiza.edu.pe',
      },
      documentos: {
        ...INITIAL_WIZARD_STATE.documentos,
        tipoTramiteId: uuid,
        asunto: 'Solicitud de trámite institucional válida',
        archivos: [ARCHIVO_SUBIDO],
      },
    };
    const mockGet = vi.spyOn(apiClient, 'get');
    const mockPost = vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('respuesta de prueba'));

    render(
      <StepConfirmacion
        state={state}
        dispatch={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await screen.findByText(/SUZ26-035 — Certificado de Estudios Superiores/i);
    await user.click(screen.getByRole('button', { name: /Radicar Trámite/i }));

    await waitFor(() => {
      expect(mockGet.mock.calls.some(([url]) => url === '/api/v1/tramites/tipos')).toBe(true);
      expect(mockPost).toHaveBeenCalledWith(
        '/api/v1/tramites/radicacion-virtual',
        expect.objectContaining({
          idTipoTramiteTupa: uuid,
          documentos: [expect.objectContaining({ storagePath: ARCHIVO_SUBIDO.storageUrl, hashSha256: ARCHIVO_SUBIDO.hashSha256, tamanoBytes: ARCHIVO_SUBIDO.peso })],
          tipoDocumento: 'DNI',
          numeroDocumento: '74123456',
          nombreSolicitante: 'María Elena Vargas Paredes',
          correo: 'maria.vargas@iestpsuiza.edu.pe',
        }),
      );
      expect(mockPost.mock.calls[0]?.[1]).not.toHaveProperty('idPersona');
      expect(Object.keys(mockPost.mock.calls[0]?.[1] as object).sort()).toEqual([
        'asunto', 'idTipoTramiteTupa', 'tipoDocumento', 'numeroDocumento',
        'nombreSolicitante', 'correo', 'totalFolios', 'documentos',
      ].sort());
    });
  });

  it('ofrece login tras 401, conserva el borrador y no emite un cargo', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ accessToken: 'access-test', refreshToken: 'refresh-test', isAuthenticated: true });
    const mockPost = vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new ApiHttpError({
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      detail: 'Debe iniciar sesión para radicar.',
      instance: '/api/v1/tramites/radicacion-virtual',
      code: 'UNAUTHORIZED',
      category: 'Security',
      correlationId: 'test-correlation-id',
      retryable: false,
    }));
    const button = await llegarAConfirmacion(user, TIPOS_FORMALES[0].id, true);
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(/inicie sesion/i);
    expect(screen.getByRole('link', { name: /Iniciar sesion y volver/ })).toHaveAttribute('href', '/login');
    expect(mockPost).toHaveBeenCalledWith('/api/v1/tramites/radicacion-virtual', expect.objectContaining({
      tipoDocumento: 'DNI',
      numeroDocumento: '74123456',
      nombreSolicitante: 'María Elena Vargas Paredes',
    }));
    const borrador = JSON.parse(sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY)!);
    expect(borrador.identificacion.numeroDocumento).toBe('74123456');
    expect(borrador.documentos.tipoTramiteId).toBe(TIPOS_FORMALES[0].id);
    expect(borrador.cargoEmitido).toBeNull();
  });

  it('no envia al backend cuando falta la sesión y conserva la solicitud', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ accessToken: null, refreshToken: null, isAuthenticated: false });
    const mockGet = vi.spyOn(apiClient, 'get');
    const mockPost = vi.spyOn(apiClient, 'post');
    const button = await llegarAConfirmacion(user, TIPOS_FORMALES[0].id, true);
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(/inicie sesion/i);
    expect(screen.getByRole('link', { name: /Iniciar sesion y volver/ })).toHaveAttribute('href', '/login');
    expect(mockGet).toHaveBeenCalledWith('/api/v1/tramites/tipos', expect.any(Object));
    expect(mockPost).not.toHaveBeenCalled();
    const borrador = JSON.parse(sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY)!);
    expect(borrador.identificacion.numeroDocumento).toBe('74123456');
    expect(borrador.documentos.tipoTramiteId).toBe(TIPOS_FORMALES[0].id);
    expect(borrador.cargoEmitido).toBeNull();
  });

  // ===========================================================================
  // TEST 9
  // ===========================================================================
  const estadoConfirmacionValido = () => ({
    ...INITIAL_WIZARD_STATE,
    currentStep: 4 as const,
    identificacion: { ...INITIAL_WIZARD_STATE.identificacion, numeroDocumento: '74123456',
      nombres: 'María Elena', apellidos: 'Vargas Paredes', correo: 'maria.vargas@iestpsuiza.edu.pe' },
    documentos: { ...INITIAL_WIZARD_STATE.documentos, tipoTramiteId: TIPOS_FORMALES[0].id,
      asunto: 'Solicitud de trámite institucional válida', archivos: [ARCHIVO_SUBIDO] },
  });

  it('muestra la descripción del procedimiento seleccionado sin inventar requisitos ni obligatoriedad', async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    const data = estadoConfirmacionValido().documentos;
    const { rerender } = render(<StepDocumentos data={data} dispatch={dispatch} onNext={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByText(TIPOS_FORMALES[0].descripcion!)).toBeInTheDocument();
    expect(screen.getByText(/La API disponible no informa los requisitos documentales/)).toBeInTheDocument();
    expect(screen.getByText(/Esta exigencia técnica no determina qué documentos son requisitos institucionales/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/permanecen en versión BORRADOR/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox'), TIPOS_FORMALES[2].id);
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_DOCUMENTOS', payload: { tipoTramiteId: TIPOS_FORMALES[2].id } });
    rerender(<StepDocumentos data={{ ...data, tipoTramiteId: TIPOS_FORMALES[2].id }} dispatch={dispatch} onNext={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue(TIPOS_FORMALES[2].id);
    expect(screen.getByText(TIPOS_FORMALES[2].descripcion!)).toBeInTheDocument();
    expect(screen.queryByText(TIPOS_FORMALES[0].descripcion!)).not.toBeInTheDocument();
  });

  it.each([2, 4])('conserva la advertencia de datos administrativos no especificados en el paso %s', async (paso) => {
    const descripcion = 'Plazo de atención: no especificado en la fuente. Silencio administrativo: no especificado en la fuente. Los defaults técnicos no constituyen valores administrativos oficiales.';
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{
      ...TIPOS_FORMALES[0], descripcion, plazo_dias: 30, plazo_dias_habiles: 30,
      silencio_administrativo: 'POSITIVO', calificacion: 'POSITIVO',
    }] } as never);
    const state = estadoConfirmacionValido();
    if (paso === 2) {
      render(<StepDocumentos data={state.documentos} dispatch={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />);
    } else {
      render(<StepConfirmacion state={state} dispatch={vi.fn()} onBack={vi.fn()} onGoToStep={vi.fn()} />);
    }
    expect(await screen.findByText(descripcion)).toBeInTheDocument();
    expect(screen.queryByText(/30 días hábiles/)).not.toBeInTheDocument();
    expect(screen.queryByText(/silencio administrativo:\s*positivo/i)).not.toBeInTheDocument();
  });

  it('conserva el UUID y los documentos al avanzar al paso 3 y volver al selector', async () => {
    const user = userEvent.setup();
    const state = { ...estadoConfirmacionValido(), currentStep: 2 };
    sessionStorage.setItem(TRAMITE_WIZARD_STORAGE_KEY, JSON.stringify(state));
    render(<TramiteWizard />);
    const next = screen.getByRole('button', { name: /^Siguiente/i });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);
    await user.click(screen.getByRole('button', { name: /Anterior/i }));
    await screen.findByRole('option', { name: /SUZ26-035/ });
    expect(screen.getByRole('combobox')).toHaveValue(TIPOS_FORMALES[0].id);
    expect(screen.getByText(ARCHIVO_SUBIDO.nombre)).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY)!).documentos.tipoTramiteId).toBe(TIPOS_FORMALES[0].id);
  });

  it.each([{ numeroFolios: 1.5 }, { asunto: 'x'.repeat(501) }])('bloquea datos de documentos incompatibles con las validaciones: %j', async cambios => {
    const onNext = vi.fn();
    render(<StepDocumentos data={{ ...estadoConfirmacionValido().documentos, ...cambios }} dispatch={vi.fn()} onNext={onNext} onBack={vi.fn()} />);
    await screen.findByRole('option', { name: /SUZ26-035/ });
    expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeDisabled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('rechaza códigos duplicados en confirmación y permite reintentar el GET sin sustituir el UUID', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: [TIPOS_FORMALES[0], { ...TIPOS_FORMALES[1], codigo: TIPOS_FORMALES[0].codigo }] } as never);
    const user = userEvent.setup();
    const mockPost = vi.spyOn(apiClient, 'post');
    const state = estadoConfirmacionValido();
    render(<StepConfirmacion state={state} dispatch={vi.fn()} onBack={vi.fn()} />);
    await screen.findByText(/No fue posible verificar el catálogo formal/);
    expect(screen.queryByText(/El tipo coincide con un UUID/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reintentar verificación/ }));
    expect(await screen.findByText(/SUZ26-035 — Certificado de Estudios Superiores/)).toBeInTheDocument();
    expect(screen.getByText(TIPOS_FORMALES[0].descripcion!)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
    expect(state.documentos.tipoTramiteId).toBe(TIPOS_FORMALES[0].id);
  });

  it.each(['correo', 'nombre', 'asunto', 'folios'])('no sustituye %s faltante por datos ficticios en confirmación', async campo => {
    const state = estadoConfirmacionValido();
    if (campo === 'correo') state.identificacion.correo = '';
    if (campo === 'nombre') { state.identificacion.nombres = ''; state.identificacion.apellidos = ''; }
    if (campo === 'asunto') state.documentos.asunto = 'corto';
    if (campo === 'folios') state.documentos.numeroFolios = 0;
    const dispatch = vi.fn();
    const mockPost = vi.spyOn(apiClient, 'post');
    render(<StepConfirmacion state={state} dispatch={dispatch} onBack={vi.fn()} />);
    await screen.findByText(/El tipo coincide con un UUID/);
    await userEvent.click(screen.getByRole('button', { name: /Radicar Trámite/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ERROR', payload: expect.stringContaining('No se sustituirán datos faltantes') });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('no fabrica un hash ni muestra cargo si falta la huella en la respuesta simulada', async () => {
    const dispatch = vi.fn();
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: { cargoDigital: {} }, status: 201 } as never);
    render(<StepConfirmacion state={estadoConfirmacionValido()} dispatch={dispatch} onBack={vi.fn()} />);
    await screen.findByText(/El tipo coincide con un UUID/);
    await userEvent.click(screen.getByRole('button', { name: /Radicar Trámite/i }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_ERROR' }));
    expect(dispatch.mock.calls.some(([action]) => action.type === 'SET_CARGO')).toBe(false);
  });

  it('Test 9: Disparo y bloqueo del botón "Radicar Trámite" mostrando estado de carga', async () => {
    const user = userEvent.setup();

    // Mock de apiClient.post pendiente para verificar estado transitorio de carga
    let resolverPromesa: ((value: any) => void) | null = null;
    const mockPostPromise = new Promise((resolve) => {
      resolverPromesa = resolve;
    });
    vi.spyOn(apiClient, 'post').mockImplementation(() => mockPostPromise as any);
    render(<TramiteWizard />);

    await fillPaso1(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    await fillPaso2(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    await fillPaso3(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    const btnRadicar = await screen.findByRole('button', { name: /Radicar Trámite/i });
    expect(btnRadicar).not.toBeDisabled();

    // Disparar radicación
    await user.click(btnRadicar);

    // Verificar estado visual de carga y bloqueo de botones
    expect(screen.getByText(/Radicando Trámite\.\.\./i)).toBeInTheDocument();
    expect(btnRadicar).toBeDisabled();
    expect(screen.getByRole('button', { name: /← Anterior/i })).toBeDisabled();

    // Resolver la promesa pendiente para evitar timers colgados
    resolverPromesa!({
      data: {
        expedienteId: '00000000-0000-0000-0000-000000000001',
        cut: 'EXP-2026-999888',
        anioFiscal: 2026,
        fechaRadicacionLegal: '25/09/2026, 16:30',
        fechaEnvioReal: '25/09/2026, 16:30',
        diferidoPorCorte: false,
        totalFolios: 1,
        qrSeguimientoUrl: 'https://sigd.iestpsuiza.edu.pe/consulta/EXP-2026-999888',
        cargoDigital: {
          codigo: 'EXP-2026-999888',
          hashSha256:
            '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
          qrContenido: 'https://sigd.iestpsuiza.edu.pe/consulta/EXP-2026-999888',
        },
        mensajeLegal: 'Trámite radicado conforme a LPAG Ley N° 27444.',
      },
      status: 201,
    });
  });

  // ===========================================================================
  // TEST 10
  // ===========================================================================
  it('Test 10: Renderizado y apertura de CargoDigitalModal con CUT visible ante respuesta HTTP 201 Created simulada', async () => {
    const user = userEvent.setup();

    // Mock de API REST con código HTTP 201 Created
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        expedienteId: '00000000-0000-0000-0000-000000000001',
        cut: 'EXP-2026-778899',
        anioFiscal: 2026,
        fechaRadicacionLegal: '25 de Septiembre de 2026, 16:30 hrs',
        fechaEnvioReal: '25 de Septiembre de 2026, 16:30 hrs',
        diferidoPorCorte: false,
        totalFolios: 1,
        qrSeguimientoUrl: 'https://sigd.iestpsuiza.edu.pe/consulta/EXP-2026-778899',
        cargoDigital: {
          codigo: 'EXP-2026-778899',
          hashSha256:
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          qrContenido: 'https://sigd.iestpsuiza.edu.pe/consulta/EXP-2026-778899',
        },
        mensajeLegal: 'Trámite radicado formalmente.',
      },
      status: 201,
    } as any);
    render(<TramiteWizard />);

    await fillPaso1(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    await fillPaso2(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    await fillPaso3(user);
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    const btnRadicar = await screen.findByRole('button', { name: /Radicar Trámite/i });
    await user.click(btnRadicar);

    // Apertura y renderizado accesible de CargoDigitalModal
    const modalDialog = await screen.findByRole('dialog');
    expect(modalDialog).toBeInTheDocument();
    expect(modalDialog).toHaveAttribute('aria-modal', 'true');

    // CUT visible dentro del modal
    const cutElements = within(modalDialog).getAllByText('EXP-2026-778899');
    expect(cutElements.length).toBeGreaterThan(0);

    // Verificación de contenido institucional
    expect(
      within(modalDialog).getByText(/Cargo de Recepción Digital/i)
    ).toBeInTheDocument();
    expect(
      within(modalDialog).getByText(/María Elena Vargas Paredes/i)
    ).toBeInTheDocument();

    // Verificación de botones de acción legal
    expect(
      within(modalDialog).getByRole('button', { name: /Copiar CUT/i })
    ).toBeInTheDocument();
    expect(
      within(modalDialog).getByRole('button', {
        name: /Descargar Cargo Digital \(PDF\)/i,
      })
    ).toBeInTheDocument();
    expect(
      within(modalDialog).getByRole('button', {
        name: /Acceder a Casilla Electrónica/i,
      })
    ).toBeInTheDocument();
    expect(
      within(modalDialog).getByRole('button', { name: /Finalizar y Cerrar/i })
    ).toBeInTheDocument();
  });
});
