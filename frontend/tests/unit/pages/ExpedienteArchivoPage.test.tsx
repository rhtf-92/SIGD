import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExpedienteDetallePage from '@/pages/expedientes/ExpedienteDetallePage';
import { apiClient } from '@/api/client';
const fixture = vi.hoisted(() => ({ permiso: true, estado: 'RESUELTO', area: 'area-1', traza: true }));
vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ usuario: { permisos: fixture.permiso ? [{ codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: 'area-1' }, { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: 'area-1' }] : [] } }) }));
vi.mock('@/hooks/useBandejaExpedientes', () => ({ mensajeErrorExpediente: () => 'Error', useExpedienteDetalle: () => ({ data: { idExpediente: 'exp-prueba', cut: 'EXP-PRUEBA', estadoActual: fixture.estado, areaActualId: fixture.area, documentos: [], ultimoMovimiento: fixture.traza && fixture.estado !== 'REGISTRADO' ? { idMovimiento: 'mov-prueba', evento: 'CIERRE', estadoNuevo: fixture.estado, fechaHora: '2026-10-27T12:00:00Z', usuarioOperadorId: '990000001' } : null } }) }));
vi.mock('@/hooks/useExpedienteTimeline', () => ({ useExpedienteTimeline: () => ({ data: [] }) }));
vi.mock('@/hooks/useTablasMaestras', () => ({ useTablasMaestras: () => ({ areasReales: [] }) }));
vi.mock('@/hooks/useExpedienteActions', () => ({ useExpedienteActions: () => ({}) }));
vi.mock('@/components/expedientes/ExpedienteMetadatos', () => ({ default: () => null }));
vi.mock('@/components/expedientes/ExpedienteTimeline', () => ({ default: () => null }));
vi.mock('@/components/expedientes/DerivacionModal', () => ({ default: () => null }));
vi.mock('@/components/expedientes/ObservacionModal', () => ({ default: () => null }));
vi.mock('@/components/expedientes/AcumulacionModal', () => ({ default: () => null }));
vi.mock('@/components/expedientes/ExpedienteActionToast', () => ({ default: () => null }));
function abrir() { return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/expedientes/exp-prueba']}><Routes><Route path='/expedientes/:id' element={<ExpedienteDetallePage />} /></Routes></MemoryRouter></QueryClientProvider>); }
function formulario() {
  fireEvent.click(screen.getByRole('button', { name: /archivar/i }));
  for (const campo of ['estante', 'balda', 'caja']) fireEvent.change(screen.getByLabelText(new RegExp(campo, 'i')), { target: { value: ' A-1 ' } });
}
beforeEach(() => { fixture.permiso = true; fixture.estado = 'RESUELTO'; fixture.area = 'area-1'; fixture.traza = true; vi.mocked(apiClient.post).mockReset(); });
describe('Archivado desde detalle: contrato simulado sin escrituras reales', () => {
  it('advierte de un estado sin actuacion e impide ofrecer archivo', () => {
    fixture.traza = false; abrir();
    expect(screen.getByRole('alert')).toHaveTextContent('no tiene una actuacion documentada');
    expect(screen.queryByRole('button', { name: /archivar/i })).toBeNull();
  });
  it('permite recepcionar un REGISTRADO sin saltarlo a revision', async () => {
    fixture.estado = 'REGISTRADO';
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ok: true, nuevoEstado: 'RECEPCIONADO' } });
    abrir(); fireEvent.click(screen.getByRole('button', { name: /Recepcionar Expediente/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Pendiente de calificacion'));
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/expedientes/exp-prueba/recepcionar', {});
  });
  it('oculta la accion sin facultad o fuera del area autorizada', () => {
    fixture.permiso = false; const vista = abrir(); expect(screen.queryByRole('button', { name: /archivar/i })).toBeNull(); vista.unmount();
    fixture.permiso = true; fixture.area = 'area-ajena'; abrir(); expect(screen.queryByRole('button', { name: /archivar/i })).toBeNull();
  });
  it('no ofrece archivo para un estado distinto de RESUELTO', () => { fixture.estado = 'REGISTRADO'; abrir(); expect(screen.queryByRole('button', { name: /archivar/i })).toBeNull(); });
  it('envia la ubicacion al endpoint original y confirma solo al resolver la peticion', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ok: true } }); abrir(); formulario();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/expedientes/exp-prueba/archivar', { estante: 'A-1', balda: 'A-1', caja: 'A-1', observaciones: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('archivado correctamente');
  });
  it('conserva los campos cuando el backend rechaza la operacion', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Operacion denegada')); abrir(); formulario();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar archivo' })).toBeEnabled());
    expect(screen.getByLabelText(/estante/i)).toHaveValue(' A-1 '); expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
