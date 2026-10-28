// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TupaDynamicFormModal from '../../../src/components/tramite/TupaDynamicFormModal';
import { useAuthStore } from '../../../src/stores/authStore';

describe('TupaDynamicFormModal — Motor de Formularios Dinámicos TUPA 2026', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'jwt-test',
      refreshToken: null,
      usuario: {
        id: 'u-1',
        nombreCompleto: 'Juan Pérez',
        correo: 'juan.perez@test.com',
        rol: 'CIUDADANO',
      },
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('no renderiza nada cuando isOpen es false', () => {
    const { container } = render(
      <TupaDynamicFormModal
        isOpen={false}
        codigoInicial="p1-fila-05"
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza campos y cálculo de importe para ALQUILER (Galpón Agrícola)', async () => {
    const user = userEvent.setup();
    render(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p2-fila-01" // Alquiler del Galpón Agrícola
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Motor de Formularios Dinámicos TUPA 2026')).toBeInTheDocument();
    expect(screen.getByText(/Disponibilidad sujeta a confirmación institucional previa/i)).toBeInTheDocument();

    // Ver cálculo de cantidad con S/ 500.00 base usando selector de label flexible
    const inputCantidad = screen.getByLabelText(/Cantidad/i);
    await user.clear(inputCantidad);
    await user.type(inputCantidad, '2');

    // 2 x S/ 500.00 = S/ 1000.00
    expect(screen.getByText('S/ 1000.00')).toBeInTheDocument();
  });

  it('renderiza aviso de disponibilidad y cálculo para VENTA_BIEN (Venta de Mangos)', async () => {
    const user = userEvent.setup();
    render(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p2-fila-09" // Venta de Mangos
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Disponibilidad sujeta a confirmación institucional previa/i)).toBeInTheDocument();

    // S/ 15.00 base x 5 = S/ 75.00
    const inputCantidad = screen.getByLabelText(/Cantidad/i);
    await user.clear(inputCantidad);
    await user.type(inputCantidad, '5');

    expect(screen.getByText('S/ 75.00')).toBeInTheDocument();
  });

  it('bloquea la radicación para CIUDADANO cuando el tipo es ACTUACION_INTERNA', () => {
    render(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p1-fila-01" // Prácticas Iniciales (ACTUACION_INTERNA)
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Gestión interna institucional/i)).toBeInTheDocument();
    const botonEnviar = screen.getByRole('button', { name: /Registrar Solicitud|Radicar Expediente/i });
    expect(botonEnviar).toBeDisabled();
  });

  it('permite cambiar de procedimiento desde el selector sin recargar la página', async () => {
    const user = userEvent.setup();
    render(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p1-fila-05"
        onClose={vi.fn()}
      />
    );

    // Selector
    const selector = screen.getByLabelText(/Seleccione el Procedimiento o Concepto TUPA/i);
    await user.selectOptions(selector, 'p1-fila-06'); // Certificado de Inglés

    expect(screen.getByText(/Datos del Formulario \(DOCUMENTARIO\)/i)).toBeInTheDocument();
  });

  it('envía solicitud no documentaria y muestra código canónico SOL-2026-XXXXXX', async () => {
    const user = userEvent.setup();
    const mockOnExito = vi.fn();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        idSolicitud: 'sol-din-001',
        codigoSolicitud: 'SOL-2026-000042',
        tipoFormulario: 'VENTA_BIEN',
        montoTotal: 75,
        estado: 'REGISTRADA',
        fechaRegistro: '2026-10-24T20:30:00Z',
      }),
    });

    render(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p2-fila-09" // Venta de Mangos (VENTA_BIEN)
        onClose={vi.fn()}
        onExito={mockOnExito}
      />
    );

    // Llenar teléfono de contacto obligatorio
    const inputTelefono = screen.getByLabelText(/Teléfono \/ WhatsApp/i);
    await user.type(inputTelefono, '961123456');

    const botonEnviar = screen.getByRole('button', { name: /Registrar Solicitud/i });
    await user.click(botonEnviar);

    await waitFor(() => {
      expect(screen.getByText(/¡Solicitud Registrada con Éxito!/i)).toBeInTheDocument();
      expect(screen.getByText('SOL-2026-000042')).toBeInTheDocument();
    });
    expect(mockOnExito).toHaveBeenCalledWith('SOL-2026-000042');
  });

  it('no fabrica un SOL ni muestra éxito cuando el POST falla', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ detail: 'Servicio no disponible' }) });
    const onExito = vi.fn();
    const actor = userEvent.setup();
    render(<TupaDynamicFormModal isOpen codigoInicial="p2-fila-09" onClose={vi.fn()} onExito={onExito} />);
    await actor.type(screen.getByLabelText(/Teléfono \/ WhatsApp/i), '961123456');
    await actor.click(screen.getByRole('button', { name: /Registrar Solicitud/i }));
    expect(await screen.findByText('Servicio no disponible')).toBeInTheDocument();
    expect(screen.queryByText(/Solicitud Registrada con Éxito/i)).not.toBeInTheDocument();
    expect(onExito).not.toHaveBeenCalled();
  });

  it('redirige el documentario aprobado al flujo CUT sin crear SOL', () => {
    globalThis.fetch = vi.fn();
    render(<TupaDynamicFormModal isOpen codigoInicial="p1-fila-06" onClose={vi.fn()} />);
    expect(screen.getByText(/Datos del Formulario \(DOCUMENTARIO\)/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir a radicación CUT/i })).toHaveAttribute('href', '/tramite');
    expect(screen.queryByRole('button', { name: /Registrar Solicitud/i })).not.toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('valida programáticamente la integridad de la matriz 72/72 y las 7 tipologías canónicas', async () => {
    const { TUPA_FORMULARIOS_CONFIG } = await import('../../../src/data/tupaFormulariosConfig');
    expect(TUPA_FORMULARIOS_CONFIG).toHaveLength(72);

    const codigosUnicos = new Set(TUPA_FORMULARIOS_CONFIG.map((c) => c.codigoRef));
    expect(codigosUnicos.size).toBe(72);

    const tipologias = new Set(TUPA_FORMULARIOS_CONFIG.map((c) => c.tipoFormulario));
    expect(Array.from(tipologias).sort()).toEqual([
      'ACADEMICO',
      'ACTUACION_INTERNA',
      'ALQUILER',
      'DOCUMENTARIO',
      'OTRO',
      'SERVICIO',
      'VENTA_BIEN',
    ].sort());

    const conGeneraExpTrue = TUPA_FORMULARIOS_CONFIG.filter((c) => c.generaExpediente === true);
    const conGeneraExpFalse = TUPA_FORMULARIOS_CONFIG.filter((c) => c.generaExpediente === false);

    expect(conGeneraExpTrue).toHaveLength(18);
    expect(conGeneraExpFalse).toHaveLength(54);
    expect(conGeneraExpFalse.filter((c) => c.bloqueadoParaCiudadano)).toHaveLength(5);
    expect(conGeneraExpFalse.filter((c) => !c.bloqueadoParaCiudadano)).toHaveLength(49);

    for (const item of TUPA_FORMULARIOS_CONFIG) {
      expect(item.codigoRef).toBeTruthy();
      expect(item.tipoFormulario).toBeTruthy();
      expect(item.categoria).toBeTruthy();
      expect(item.flujoDestino).toBeTruthy();
      expect(typeof item.monto).toBe('number');
      expect(item.unidadCobro).toBeTruthy();
      expect(typeof item.generaExpediente).toBe('boolean');
    }
  });

  it.each([
    ['p1-fila-06', 'DOCUMENTARIO', true, 'asuntoPetitorio'],
    ['p2-fila-09', 'VENTA_BIEN', false, 'cantidad'],
    ['p2-fila-06', 'ALQUILER', false, 'fechaEvento'],
    ['p5-fila-01', 'ACADEMICO', false, 'programaEstudios'],
    ['p3-fila-08', 'SERVICIO', false, 'detalleServicio'],
    ['p1-fila-01', 'ACTUACION_INTERNA', false, 'motivoInterno'],
    ['p4-fila-01', 'OTRO', false, 'asuntoPetitorio'],
  ] as const)('%s usa %s y el campo %s', async (codigo, tipo, generaCut, campo) => {
    const { obtenerDefinicionTupa } = await import('../../../src/data/tupaFormulariosConfig');
    const def = obtenerDefinicionTupa(codigo);
    expect(def?.tipoFormulario).toBe(tipo);
    expect(def?.generaExpediente).toBe(generaCut);
    expect(def?.campos.some((actual) => actual.nombre === campo)).toBe(true);
  });
});
