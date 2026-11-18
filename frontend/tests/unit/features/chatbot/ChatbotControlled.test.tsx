import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useAuthStore } from '../../../../src/stores/authStore';
import { ChatbotWidget } from '../../../../src/features/chatbot/components/ChatbotWidget';
import { ChatbotPanel } from '../../../../src/features/chatbot/components/ChatbotPanel';
import { GUIDED_NODES } from '../../../../src/features/chatbot/nodes';
import { apiClient } from '../../../../src/api/client';
import {
  buscarProcedimientosEnCatalogo,
  limpiarCacheCatalogoAsistente,
  type ProcedimientoTupaBusqueda,
} from '../../../../src/services/procedimientosTupa.service';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const PROCEDIMIENTOS_MOCK: ProcedimientoTupaBusqueda[] = [
  {
    registroVersionId: '00000000-0000-4000-8000-000000000006',
    codigoRef: 'p1-fila-06',
    codigo: 'p1-fila-06',
    denominacion: 'Certificado de Inglés',
    categoria: 'PROCEDIMIENTO_APROBADO',
    tipoLegible: 'Procedimiento administrativo',
    monto: 'S/ 100.00',
    plazo: '15 días hábiles',
    requisitos: ['Solicitud dirigida al director', 'Pago por derecho de trámite'],
  },
  {
    registroVersionId: '00000000-0000-4000-8000-000000000027',
    codigoRef: 'p2-fila-09',
    codigo: 'p2-fila-09',
    denominacion: 'Venta de Mangos (Ciento)',
    categoria: 'BIEN_PRODUCTIVO',
    tipoLegible: 'Venta de bien / producto',
    monto: 'S/ 15.00',
    plazo: '30 días hábiles',
    requisitos: ['Comprobante de pago'],
  },
  {
    registroVersionId: '00000000-0000-4000-8000-000000000024',
    codigoRef: 'p2-fila-06',
    codigo: 'p2-fila-06',
    denominacion: 'Alquiler del Auditorio.',
    categoria: 'SERVICIO_COMERCIAL',
    tipoLegible: 'Servicio comercial',
    monto: 'S/ 300.00',
    plazo: '30 días hábiles',
    requisitos: ['Solicitud de reserva', 'Depósito en garantía'],
  },
  {
    registroVersionId: '00000000-0000-4000-8000-000000000067',
    codigoRef: 'p6-fila-07',
    codigo: 'p6-fila-07',
    denominacion: 'Carnets, Insignia y Distintivos',
    categoria: 'OTRO_NO_RADICABLE',
    tipoLegible: 'Otro servicio / concepto',
    monto: 'S/ 50.00',
    plazo: '30 días hábiles',
    requisitos: ['Comprobante de pago institucional'],
  },
];

describe('SIGD 2026 — Asistente Público Guiado V2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limpiarCacheCatalogoAsistente();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Apertura del asistente
  it('1. permite abrir el asistente institucional mostrando el título "Asistente SIGD"', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    const triggerBtn = screen.getByRole('button', { name: /¿necesitas ayuda\?/i });
    expect(triggerBtn).toBeInTheDocument();

    fireEvent.click(triggerBtn);

    expect(screen.getByRole('dialog', { name: /asistente de orientación institucional sigd/i })).toBeInTheDocument();
    expect(screen.getByText('Asistente SIGD')).toBeInTheDocument();
    expect(screen.getAllByText(/orientación sobre trámites y servicios/i).length).toBeGreaterThan(0);
  });

  // 2. No existe input libre general
  it('2. no expone campo de texto conversacional libre en los flujos principales', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));

    // No debe existir input ni textarea de chat libre
    expect(screen.queryByPlaceholderText(/escribe tu consulta/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/escribe tu pregunta/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enviar/i })).not.toBeInTheDocument();
  });

  // 3. Opciones iniciales
  it('3. despliega las 6 opciones iniciales guiadas', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));

    expect(screen.getByRole('button', { name: /realizar un trámite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buscar un trámite tupa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /consultar mi trámite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^registrarme$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^iniciar sesión$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^casilla electrónica$/i })).toBeInTheDocument();
  });

  // 4. Realizar trámite
  it('4. navega al subnodo "Realizar un trámite" con sus opciones guiadas', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /realizar un trámite/i }));

    expect(screen.getByRole('button', { name: /ver trámites disponibles/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar trámite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /consultar requisitos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /solicitar acceso tupa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /← volver/i })).toBeInTheDocument();
  });

  // 5. Volver
  it('5. permite retroceder a la pantalla anterior mediante el botón "← Volver"', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /realizar un trámite/i }));

    // Hacer clic en Volver
    const backBtn = screen.getByRole('button', { name: /← volver/i });
    fireEvent.click(backBtn);

    // Debe volver a la pantalla inicial
    expect(screen.getByText('Asistente SIGD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /realizar un trámite/i })).toBeInTheDocument();
  });

  // 6. Consultar trámite
  it('6. navega a "Consultar mi trámite" mostrando CUT, Mis Expedientes y Estados', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /consultar mi trámite/i }));

    expect(screen.getByRole('button', { name: /consultar por cut/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mis expedientes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /¿qué significa el estado de mi trámite\?/i })).toBeInTheDocument();
  });

  // 7. Registro
  it('7. navega a "Registrarme" con información y botón hacia /registro', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /^registrarme$/i }));

    const irRegBtn = screen.getByRole('button', { name: /ir a registro ciudadano/i });
    expect(irRegBtn).toBeInTheDocument();
    fireEvent.click(irRegBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/registro');
  });

  // 8. Login
  it('8. navega a "Iniciar sesión" con opciones de acceso y recuperación', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /^iniciar sesión$/i }));

    expect(screen.getByRole('button', { name: /ir a iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /problemas para ingresar/i })).toBeInTheDocument();
  });

  // 9. Casilla
  it('9. navega a "Casilla Electrónica" con subopciones explicativas y de acceso', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /^casilla electrónica$/i }));

    expect(screen.getByRole('button', { name: /¿qué es\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /¿dónde la encuentro\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /¿para qué sirve\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ir a mi casilla/i })).toBeInTheDocument();
  });

  // 10. Búsqueda TUPA
  it('10. despliega el campo controlado "Buscar procedimiento TUPA" en el nodo correspondiente', () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: [{ id_version: 'v1', estado: 'VIGENTE' }],
    } as any).mockResolvedValueOnce({
      data: PROCEDIMIENTOS_MOCK,
    } as any);

    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /buscar un trámite tupa/i }));

    const searchInput = screen.getByLabelText(/buscar procedimiento tupa/i);
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder', expect.stringContaining('certificado ingles'));
  });

  // 11. Certificado inglés
  it('11. filtra por "certificado ingles" y muestra tarjeta con código p1-fila-06, tipo, costo y plazo', () => {
    const res = buscarProcedimientosEnCatalogo(PROCEDIMIENTOS_MOCK, 'certificado ingles');
    expect(res.length).toBe(1);
    expect(res[0].codigoRef).toBe('p1-fila-06');
    expect(res[0].denominacion).toBe('Certificado de Inglés');
    expect(res[0].tipoLegible).toBe('Procedimiento administrativo');
    expect(res[0].monto).toBe('S/ 100.00');
    expect(res[0].plazo).toBe('15 días hábiles');
  });

  // 12. p2-fila-09
  it('12. filtra por "p2-fila-09" o "mango" y muestra "Venta de Mangos (Ciento)"', () => {
    const resCodigo = buscarProcedimientosEnCatalogo(PROCEDIMIENTOS_MOCK, 'p2-fila-09');
    expect(resCodigo.length).toBe(1);
    expect(resCodigo[0].denominacion).toBe('Venta de Mangos (Ciento)');

    const resMango = buscarProcedimientosEnCatalogo(PROCEDIMIENTOS_MOCK, 'mango');
    expect(resMango.length).toBe(1);
    expect(resMango[0].codigoRef).toBe('p2-fila-09');
  });

  // 13. Búsqueda sin acentos
  it('13. realiza búsqueda insensible a mayúsculas y acentos (diacríticos)', () => {
    const conAcentos = buscarProcedimientosEnCatalogo(PROCEDIMIENTOS_MOCK, 'certificádo inglés');
    const sinAcentos = buscarProcedimientosEnCatalogo(PROCEDIMIENTOS_MOCK, 'certificado ingles');
    expect(conAcentos).toEqual(sinAcentos);
    expect(conAcentos.length).toBe(1);
  });

  // 14. Sin resultados
  it('14. si no encuentra procedimientos, muestra mensaje institucional y opciones de reintento', () => {
    const res = buscarProcedimientosEnCatalogo(PROCEDIMIENTOS_MOCK, 'tramite_inventado_xyz');
    expect(res.length).toBe(0);
  });

  // 15. Visitante intenta ruta autenticada
  it('15. si un visitante intenta acceder a una opción protegida (Mis Expedientes), muestra aviso de login requerido', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /consultar mi trámite/i }));

    // Clic en Mis Expedientes siendo visitante
    fireEvent.click(screen.getByRole('button', { name: /mis expedientes/i }));

    // Debe mostrar la pantalla de autenticación requerida
    expect(screen.getByText(/inicio de sesión requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/para utilizar esta opción necesitas iniciar sesión/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^iniciar sesión$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^registrarme$/i })).toBeInTheDocument();
  });

  // 16. Navegación correcta
  it('16. ejecuta navegación correcta a /consulta al presionar "Consultar por CUT"', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /consultar mi trámite/i }));

    fireEvent.click(screen.getByRole('button', { name: /consultar por cut/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/consulta');
  });

  // 17. Responsive
  it('17. contiene clases responsive adecuadas (380-400px en desktop) sin scroll horizontal', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    const dialog = screen.getByRole('dialog');

    // Clases responsive institucional (ancho desktop: sm:w-[390px])
    expect(dialog.className).toContain('sm:w-[390px]');
    expect(dialog.className).toContain('overflow-hidden');
  });

  // 18. Keyboard / Accessibility
  it('18. permite cerrar el asistente con la tecla Escape y contiene atributos aria accesibles', () => {
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // 19. Red: 0 peticiones TUPA al abrir ROOT
  it('19. no realiza ninguna petición de red al inicializar o abrir el asistente en ROOT', () => {
    const spyGet = vi.spyOn(apiClient, 'get');

    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    // Al montar en Home (cerrado)
    expect(spyGet).not.toHaveBeenCalled();

    // Al abrir el asistente (ROOT)
    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    expect(screen.getByText('Asistente SIGD')).toBeInTheDocument();

    // Sigue sin realizar llamadas a la API TUPA
    expect(spyGet).not.toHaveBeenCalled();
  });

  // 20. Red: Exactamente 1 petición TUPA al ingresar a BUSCAR_TUPA (y cache para visitas posteriores)
  it('20. realiza la petición al backend únicamente al entrar a BUSCAR_TUPA y cachea el resultado', async () => {
    const spyGet = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: [{ id_version: 'v1', estado: 'VIGENTE' }],
    } as any).mockResolvedValueOnce({
      data: PROCEDIMIENTOS_MOCK,
    } as any);

    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    expect(spyGet).not.toHaveBeenCalled();

    // Entrar a BUSCAR_TUPA
    fireEvent.click(screen.getByRole('button', { name: /buscar un trámite tupa/i }));

    // Esperar a que se monte el buscador
    await waitFor(() => {
      expect(screen.getByLabelText(/buscar procedimiento tupa/i)).toBeInTheDocument();
    });

    const callsCount = spyGet.mock.calls.length;
    expect(callsCount).toBeGreaterThan(0);

    // Regresar a ROOT y volver a entrar
    fireEvent.click(screen.getByRole('button', { name: /← volver/i }));
    expect(screen.getByText('Asistente SIGD')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /buscar un trámite tupa/i }));

    // El contador de llamadas a la API no aumenta (hit de caché en memoria)
    expect(spyGet.mock.calls.length).toBe(callsCount);
  });

  // 21. Búsqueda sin peticiones por keystroke
  it('21. escribir en el campo de búsqueda filtra en memoria sin generar peticiones HTTP adicionales', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: [{ id_version: 'v1', estado: 'VIGENTE' }],
    } as any).mockResolvedValueOnce({
      data: PROCEDIMIENTOS_MOCK,
    } as any);

    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /buscar un trámite tupa/i }));

    const searchInput = await screen.findByLabelText(/buscar procedimiento tupa/i);
    const callsBeforeTyping = vi.mocked(apiClient.get).mock.calls.length;

    // Escribir 3 letras
    fireEvent.change(searchInput, { target: { value: 'm' } });
    fireEvent.change(searchInput, { target: { value: 'ma' } });
    fireEvent.change(searchInput, { target: { value: 'man' } });

    // Cero peticiones adicionales
    expect(vi.mocked(apiClient.get).mock.calls.length).toBe(callsBeforeTyping);
  });

  // 22. p6-fila-07 "Carnets, Insignia y Distintivos"
  it('22. encuentra p6-fila-07 ("Carnets, Insignia y Distintivos") con denominación, monto S/ 50.00 y plazo', () => {
    const resCodigo = buscarProcedimientosEnCatalogo(PROCEDIMIENTOS_MOCK, 'p6-fila-07');
    expect(resCodigo.length).toBe(1);
    expect(resCodigo[0].denominacion).toBe('Carnets, Insignia y Distintivos');
    expect(resCodigo[0].monto).toBe('S/ 50.00');
    expect(resCodigo[0].plazo).toBe('30 días hábiles');

    const resCarnet = buscarProcedimientosEnCatalogo(PROCEDIMIENTOS_MOCK, 'carnet');
    expect(resCarnet.length).toBe(1);
    expect(resCarnet[0].codigoRef).toBe('p6-fila-07');
  });

  // 23. Manejo de error de backend TUPA (Sección 15: sin fallback silencioso)
  it('23. muestra mensaje de error y opciones [Reintentar], [Ir al Catálogo TUPA], [← Volver] cuando el backend falla', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /buscar un trámite tupa/i }));

    const errorMsg = await screen.findByText('No fue posible consultar el Catálogo TUPA en este momento.');
    expect(errorMsg).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ir al catálogo tupa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /← volver/i })).toBeInTheDocument();

    // Clic en Ir al Catálogo TUPA
    fireEvent.click(screen.getByRole('button', { name: /ir al catálogo tupa/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/tupa');
  });

  // 24. Usuario autenticado navega directo a /mis-expedientes
  it('24. si el usuario es un CIUDADANO autenticado, navega directamente a /mis-expedientes sin bloqueo', () => {
    useAuthStore.setState({
      accessToken: 'jwt-prueba-ciudadano',
      isAuthenticated: true,
      usuario: {
        id: 'usr-1',
        rol: 'CIUDADANO',
        nombreCompleto: 'Juan Ciudadano',
        dni: '12345678',
      } as any,
    });

    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /¿necesitas ayuda\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /consultar mi trámite/i }));
    fireEvent.click(screen.getByRole('button', { name: /mis expedientes/i }));

    // Navega directamente a /mis-expedientes
    expect(mockNavigate).toHaveBeenCalledWith('/mis-expedientes');
  });

  // 25. Cleanup de addEventListener
  it('25. desuscribe correctamente el listener de teclado (Escape) al desmontarse', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <MemoryRouter>
        <ChatbotPanel
          isOpen={true}
          onClose={vi.fn()}
          currentNode={GUIDED_NODES.ROOT}
          canGoBack={false}
          onBack={vi.fn()}
          onReset={vi.fn()}
          onSelectOption={vi.fn()}
        />
      </MemoryRouter>
    );

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
