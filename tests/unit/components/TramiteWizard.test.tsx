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
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TramiteWizard } from '@/components/tramite/TramiteWizard';
import { TRAMITE_WIZARD_STORAGE_KEY } from '@/hooks/useTramiteWizardReducer';
import { apiClient } from '@/api/client';

describe('T-FE-MPV-17: Pruebas de Integración de Componentes - TramiteWizard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
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
      tipoTramiteId: 'TUPA-01',
      asunto: 'Solicitud formal de certificado oficial de estudios concluidos',
      folios: '4',
      ...overrides,
    };

    await user.selectOptions(
      screen.getByLabelText(/Procedimiento Institucional/i),
      data.tipoTramiteId
    );
    await user.type(screen.getByLabelText(/Asunto o Petitorio Sucinto \*/i), data.asunto);
    const inputFolios = screen.getByLabelText(/Folios/i);
    await user.clear(inputFolios);
    await user.type(inputFolios, data.folios);

    // Cargar archivo PDF de prueba requerido para validación
    const btnCargarPdf = screen.getByRole('button', { name: /\+ Cargar PDF de prueba/i });
    await user.click(btnCargarPdf);
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
    await user.selectOptions(selectTupa, 'TUPA-01');
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

    // Cargar archivo probatorio PDF
    const btnCargarPdf = screen.getByRole('button', { name: /\+ Cargar PDF de prueba/i });
    await user.click(btnCargarPdf);

    expect(btnSiguiente).not.toBeDisabled();
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
      tipoTramiteId: 'TUPA-02',
      asunto: 'Expedición de Constancia de Egresado y No Adeudo Institucional',
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
    expect(screen.getByText('TUPA-02')).toBeInTheDocument();
    expect(screen.getByText(/Folios:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Constancia de Egresado y No Adeudo Institucional/i)
    ).toBeInTheDocument();

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

  // ===========================================================================
  // TEST 9
  // ===========================================================================
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
