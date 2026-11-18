// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TupaDynamicFormModal from '../../../src/components/tramite/TupaDynamicFormModal';
import { useAuthStore } from '../../../src/stores/authStore';

function renderModal(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

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
    const { container } = renderModal(
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
    renderModal(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p2-fila-01" // Alquiler del Galpón Agrícola
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Solicitud de Servicio Institucional/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Alquiler del Galpón Agrícola/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Aviso de disponibilidad/i)).toBeInTheDocument();

    // Avanzar a Paso 2: Datos
    await user.click(screen.getByRole('button', { name: /Completar Solicitud/i }));

    // Ver cálculo de cantidad con S/ 500.00 base usando selector de label flexible
    const inputCantidad = screen.getByLabelText(/Cantidad/i);
    await user.clear(inputCantidad);
    await user.type(inputCantidad, '2');

    // 2 x S/ 500.00 = S/ 1000.00
    expect(screen.getByText('S/ 1000.00')).toBeInTheDocument();
  });

  it('renderiza aviso de disponibilidad y cálculo para VENTA_BIEN (Venta de Mangos)', async () => {
    const user = userEvent.setup();
    renderModal(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p2-fila-09" // Venta de Mangos
        onClose={vi.fn()}
      />
    );

    expect(screen.getAllByText(/Venta de Mangos/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Aviso de disponibilidad/i)).toBeInTheDocument();

    // Avanzar a Paso 2: Datos
    await user.click(screen.getByRole('button', { name: /Completar Solicitud/i }));

    // S/ 15.00 base x 5 = S/ 75.00
    const inputCantidad = screen.getByLabelText(/Cantidad/i);
    await user.clear(inputCantidad);
    await user.type(inputCantidad, '5');

    expect(screen.getByText('S/ 75.00')).toBeInTheDocument();
  });

  it('bloquea la radicación para CIUDADANO cuando el tipo es ACTUACION_INTERNA', () => {
    renderModal(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p1-fila-01" // Prácticas Iniciales (ACTUACION_INTERNA)
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Gestión interna institucional/i)).toBeInTheDocument();
    const botonCompletar = screen.getByRole('button', { name: /Completar Solicitud/i });
    expect(botonCompletar).toBeDisabled();
  });

  it('permite cambiar de procedimiento cuando se actualiza el código inicial', () => {
    const { rerender } = renderModal(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p1-fila-05"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/p1-fila-05/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <TupaDynamicFormModal
          isOpen={true}
          codigoInicial="p1-fila-06"
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/p1-fila-06/i)).toBeInTheDocument();
    expect(screen.getAllByText(/DOCUMENTARIO/i).length).toBeGreaterThanOrEqual(1);
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

    renderModal(
      <TupaDynamicFormModal
        isOpen={true}
        codigoInicial="p2-fila-09" // Venta de Mangos (VENTA_BIEN)
        onClose={vi.fn()}
        onExito={mockOnExito}
      />
    );

    // Paso 1: Orientación -> Avanzar
    await user.click(screen.getByRole('button', { name: /Completar Solicitud/i }));

    // Paso 2: Llenar campos obligatorios (cantidad y teléfono)
    const inputCantidad = screen.getByLabelText(/Cantidad/i);
    await user.clear(inputCantidad);
    await user.type(inputCantidad, '5');

    const inputTelefono = screen.getByLabelText(/Teléfono \/ WhatsApp/i);
    await user.type(inputTelefono, '961123456');

    // Avanzar a Paso 3: Revisión
    await user.click(screen.getByRole('button', { name: /Revisar Resumen/i }));

    // Paso 3: Confirmar y Enviar
    const botonEnviar = screen.getByRole('button', { name: /Confirmar y Enviar Solicitud/i });
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
    renderModal(<TupaDynamicFormModal isOpen codigoInicial="p2-fila-09" onClose={vi.fn()} onExito={onExito} />);

    // Paso 1 -> Paso 2
    await actor.click(screen.getByRole('button', { name: /Completar Solicitud/i }));

    // Paso 2: Llenar campos obligatorios y avanzar
    const inputCantidad = screen.getByLabelText(/Cantidad/i);
    await actor.clear(inputCantidad);
    await actor.type(inputCantidad, '5');

    await actor.type(screen.getByLabelText(/Teléfono \/ WhatsApp/i), '961123456');
    await actor.click(screen.getByRole('button', { name: /Revisar Resumen/i }));

    // Paso 3: Enviar
    await actor.click(screen.getByRole('button', { name: /Confirmar y Enviar Solicitud/i }));

    expect(await screen.findByText('Servicio no disponible')).toBeInTheDocument();
    expect(screen.queryByText(/¡Solicitud Registrada con Éxito!/i)).not.toBeInTheDocument();
    expect(onExito).not.toHaveBeenCalled();
  });

  it('redirige el documentario aprobado al flujo CUT sin crear SOL', () => {
    globalThis.fetch = vi.fn();
    renderModal(<TupaDynamicFormModal isOpen codigoInicial="p1-fila-06" onClose={vi.fn()} />);
    expect(screen.getAllByText(/DOCUMENTARIO/i).length).toBeGreaterThanOrEqual(1);
    const linkCut = screen.getByRole('link', { name: /Ir a Mesa de Partes Digital \(CUT\)/i });
    expect(linkCut).toHaveAttribute('href', expect.stringContaining('/mesa-partes?procedimiento=p1-fila-06'));
    expect(screen.queryByRole('button', { name: /Completar Solicitud/i })).not.toBeInTheDocument();
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
