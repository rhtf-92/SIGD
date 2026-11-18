// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VentanillaPresencialPage from '../../../src/pages/tramite/VentanillaPresencialPage';
import { TUPA_SUIZA_2026_COMPLETO } from '../../../src/data/tupaSuiza2026CatalogoCompleto';
import { apiClient } from '../../../src/api/client';
import { useAuthStore } from '../../../src/stores/authStore';
import { obtenerCatalogoTupaCompleto } from '../../../src/services/procedimientosTupa.service';

const filasApi = TUPA_SUIZA_2026_COMPLETO.map((item, index) => ({
  registroVersionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  denominacion: item.denominacion,
  monto: item.monto,
  requisitos: item.requisitos,
  estadoValidacion: item.estadoValidacion,
  revision: 1,
  vigenciaDesde: null,
  vigenciaHasta: null,
  fuente: { nombre: 'TUPA_2026_IESTP_Suiza.pdf', referenciaFila: item.referenciaFila, pagina: item.pagina },
}));

const payloadDataDrivenReal = TUPA_SUIZA_2026_COMPLETO.map((item, index) => {
  const montoNum = parseFloat(item.monto?.replace(/[^0-9.]/g, '') || '0') || 0;
  const regId = `11111111-2222-4333-8444-${String(index + 1).padStart(12, '0')}`;
  return {
    registroVersionId: regId,
    id: regId,
    codigo: item.referenciaFila,
    codigoRef: item.referenciaFila,
    codigoExterno: item.referenciaFila,
    denominacion: item.denominacion,
    categoria: item.categoria,
    clasificacion: item.categoria,
    tipoFormulario: item.categoria === 'BIEN_PRODUCTIVO' ? 'VENTA_BIEN' : item.categoria === 'ACTUACION_INTERNA' ? 'ACTUACION_INTERNA' : 'DOCUMENTARIO',
    monto: montoNum > 0 ? `S/ ${montoNum.toFixed(2)}` : 'Gratuito',
    montoNumero: montoNum,
    costoSoles: montoNum,
    unidadCobro: 'PEN',
    plazo: item.plazo,
    plazoDias: 15,
    plazoDiasHabiles: 15,
    requisitos: item.requisitos,
    generaExpediente: item.admiteRadicacionSigd,
    admiteRadicacionSigd: item.admiteRadicacionSigd,
    admiteRadicacion: item.admiteRadicacionSigd,
    calificacion: 'EVALUACION_PREVIA_POSITIVO',
    versionFuente: 'TUPA 2026',
    estadoValidacion: item.estadoValidacion,
    estado: item.estadoValidacion,
    revision: 1,
    pagina: item.pagina,
    vigenciaDesde: null,
    vigenciaHasta: null,
    vigencia: { desde: null, hasta: null },
    version: { etiqueta: 'TUPA 2026', revision: 1, vigenciaDesde: null, vigenciaHasta: null },
    referenciaAprobacion: 'RD-001-2026-IESTP-SUIZA',
    fuente: {
      nombre: 'TUPA_2026_IESTP_Suiza.pdf',
      documentoSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      referenciaFila: item.referenciaFila,
      pagina: item.pagina,
    },
    idProcedimiento: `22222222-3333-4444-8555-${String(index + 1).padStart(12, '0')}`,
    idVersion: 'c281022c-69b0-40b5-8cd4-6b25dea9af35',
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
});

describe('Ventanilla TUPA institucional', () => {
  it('consume 72 filas del endpoint autorizado y busca por nombre o referencia', async () => {
    useAuthStore.setState({ accessToken: 'jwt', refreshToken: null, isAuthenticated: true,
      usuario: { id: 'u1', nombreCompleto: 'Operador', correo: 'operador@example.test', rol: 'MESA_PARTES' } });
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: filasApi });
    const actor = userEvent.setup();
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    const selector = await screen.findByLabelText('Procedimiento TUPA 2026 *');
    await waitFor(() => expect(within(selector).getAllByRole('option')).toHaveLength(74));
    expect(get).toHaveBeenCalledWith('/api/v1/tramites/tupa', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(within(selector).getAllByRole('option')[2]).toHaveTextContent('p1-fila-01');
    expect(within(selector).getAllByRole('option')[73]).toHaveTextContent('p6-fila-07');
    expect(new Set(filasApi.map((r) => r.fuente.referenciaFila)).size).toBe(72);

    const busqueda = screen.getByLabelText(/Buscar TUPA por nombre/i);
    await actor.type(busqueda, 'mango');
    expect(within(selector).getByRole('option', { name: /Venta de Mangos/i })).toBeInTheDocument();
    await actor.clear(busqueda);
    await actor.type(busqueda, 'p2-fila-09');
    expect(within(selector).getByRole('option', { name: /Venta de Mangos/i })).toBeInTheDocument();
    await actor.selectOptions(selector, filasApi.find((r) => r.fuente.referenciaFila === 'p2-fila-09')!.registroVersionId);
    await actor.click(screen.getByRole('button', { name: /Abrir formulario específico/i }));
    expect(screen.getByText(/Datos del Formulario \(VENTA_BIEN\)/i)).toBeInTheDocument();
  });

  it('falla cerrado si backend devuelve un catálogo incompleto', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: filasApi.slice(0, 18) });
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent(/72 entradas esperadas/i);
    expect(screen.getByLabelText('Procedimiento TUPA 2026 *')).toBeDisabled();
  });

  it('DIRECTOR ve las 72 filas y puede abrir SOL, pero no emitir CUT presencial', async () => {
    useAuthStore.setState({ accessToken: 'jwt', refreshToken: null, isAuthenticated: true,
      usuario: { id: 'u-director', nombreCompleto: 'Director', correo: 'dir@example.test', rol: 'DIRECTOR' } });
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: filasApi });
    const actor = userEvent.setup();
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);
    const selector = await screen.findByLabelText('Procedimiento TUPA 2026 *');
    await waitFor(() => expect(within(selector).getAllByRole('option')).toHaveLength(74));
    expect(screen.getByRole('button', { name: /Registrar y Emitir Cargo CUT/i })).toBeDisabled();
    await actor.selectOptions(selector, filasApi.find((r) => r.fuente.referenciaFila === 'p2-fila-09')!.registroVersionId);
    expect(screen.getByRole('button', { name: /Abrir formulario específico/i })).toBeEnabled();
  });

  it('GET catálogo vigente con payload data-driven real adapta 72 entradas y no muestra incompatibilidad', async () => {
    useAuthStore.setState({
      accessToken: 'jwt',
      refreshToken: null,
      isAuthenticated: true,
      usuario: { id: 'u1', nombreCompleto: 'Operador', correo: 'operador@example.test', rol: 'MESA_PARTES' },
    });
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: payloadDataDrivenReal });

    const catalogoAdaptado = await obtenerCatalogoTupaCompleto();
    expect(catalogoAdaptado).toHaveLength(72);
    expect(catalogoAdaptado.filter((r) => r.estadoValidacion === 'APROBADO')).toHaveLength(18);
    expect(catalogoAdaptado.filter((r) => r.estadoValidacion === 'PENDIENTE_VALIDACION')).toHaveLength(54);

    const actor = userEvent.setup();
    render(<MemoryRouter><VentanillaPresencialPage /></MemoryRouter>);

    const selector = await screen.findByLabelText('Procedimiento TUPA 2026 *');
    await waitFor(() => expect(within(selector).getAllByRole('option')).toHaveLength(74));

    expect(screen.queryByText(/Fila TUPA incompleta o incompatible/i)).not.toBeInTheDocument();
    expect(screen.getByText(/72 entradas TUPA disponibles \(18 CUT, 49 SOL, 5 internas\)/i)).toBeInTheDocument();

    // Búsqueda por "mango"
    const busqueda = screen.getByLabelText(/Buscar TUPA por nombre/i);
    await actor.type(busqueda, 'mango');
    expect(within(selector).getByRole('option', { name: /Venta de Mangos/i })).toBeInTheDocument();

    // Búsqueda por "p2-fila-09"
    await actor.clear(busqueda);
    await actor.type(busqueda, 'p2-fila-09');
    expect(within(selector).getByRole('option', { name: /Venta de Mangos/i })).toBeInTheDocument();

    // Búsqueda por "Certificado de Inglés"
    await actor.clear(busqueda);
    await actor.type(busqueda, 'Certificado de Inglés');
    expect(within(selector).getByRole('option', { name: /Certificado de Inglés/i })).toBeInTheDocument();

    // Selección sin incompatibilidad
    const procIngles = payloadDataDrivenReal.find((r) => r.codigoRef === 'p1-fila-06')!;
    await actor.selectOptions(selector, procIngles.registroVersionId);
    expect(screen.getByText(/p1-fila-06 · DOCUMENTARIO · CUT/i)).toBeInTheDocument();
    expect(screen.queryByText(/Fila TUPA incompleta o incompatible/i)).not.toBeInTheDocument();
  });
});
