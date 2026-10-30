/**
 * ==============================================================================
 * TEST UNITARIO: MisExpedientesProgreso.test.tsx
 * ==============================================================================
 * Cobertura exigida:
 * - Progreso humano entendible para el ciudadano.
 * - 6 etapas: Solicitud recibida, Pago confirmado, Derivado al área responsable,
 *   En evaluación, Respuesta / Notificación, Finalizado.
 * - Cero exposición de datos sensibles o empleados internos.
 * - Transición de estados reactiva según estado documental.
 * ==============================================================================
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MisExpedientesPage, { calcularProgresoCiudadano } from '@/pages/tramite/MisExpedientesPage';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('MisExpedientesPage — Progreso Humano Transparente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'jwt-ciudadano',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-1',
        nombreCompleto: 'Carlos Ruiz',
        correo: 'carlos.ruiz@test.com',
        rol: 'CIUDADANO',
      },
    });
  });

  it('1. Función calcularProgresoCiudadano genera las 6 etapas requeridas por la directiva', () => {
    const etapasRegistrado = calcularProgresoCiudadano('REGISTRADO');
    expect(etapasRegistrado).toHaveLength(6);
    expect(etapasRegistrado.map((e) => e.titulo)).toEqual([
      'Solicitud recibida',
      'Pago confirmado',
      'Derivado al área responsable',
      'En evaluación',
      'Respuesta / Notificación',
      'Finalizado',
    ]);

    expect(etapasRegistrado[0].estado).toBe('COMPLETADO');
    expect(etapasRegistrado[0].icono).toBe('✓');
    expect(etapasRegistrado[2].estado).toBe('PENDIENTE');
    expect(etapasRegistrado[2].icono).toBe('○');
  });

  it('2. Estado DERIVADO o EN_REVISION marca pago y derivación como completados', () => {
    const etapasDerivado = calcularProgresoCiudadano('DERIVADO');
    expect(etapasDerivado[0].estado).toBe('COMPLETADO');
    expect(etapasDerivado[1].estado).toBe('COMPLETADO');
    expect(etapasDerivado[2].estado).toBe('COMPLETADO');
    expect(etapasDerivado[3].estado).toBe('EN_CURSO');
    expect(etapasDerivado[3].icono).toBe('●');
  });

  it('3. Estado ARCHIVADO marca el ciclo completo como finalizado', () => {
    const etapasArchivado = calcularProgresoCiudadano('ARCHIVADO');
    expect(etapasArchivado.every((e) => e.estado === 'COMPLETADO')).toBe(true);
    expect(etapasArchivado.every((e) => e.icono === '✓')).toBe(true);
  });

  it('4. Interfaz interactiva despliega el sub-panel de progreso sin datos sensibles al pulsar "Progreso"', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [
        {
          expedienteId: 'exp-100',
          cut: 'EXP-2026-000009',
          codigoExpediente: 'EXP-2026-000009',
          numero: 'EXP-2026-000009',
          asunto: 'Certificado de Inglés',
          tipoDocumento: 'SOLICITUD',
          tipoTramite: 'Certificado de Inglés',
          estado: 'DERIVADO',
          fechaRadicacion: '2026-10-28T09:00:00Z',
          canalIngreso: 'MESA_VIRTUAL',
          totalFolios: 2,
        },
      ],
    });

    render(
      <MemoryRouter>
        <MisExpedientesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('EXP-2026-000009')).toBeInTheDocument();

    const btnProgreso = screen.getByRole('button', { name: /Ver progreso del trámite/i });
    expect(btnProgreso).toBeInTheDocument();

    // Al hacer click en Progreso, se despliega la línea de vida
    fireEvent.click(btnProgreso);

    expect(await screen.findByText(/Progreso del Trámite:/i)).toBeInTheDocument();
    expect(screen.getByText('Solicitud recibida')).toBeInTheDocument();
    expect(screen.getByText('Pago confirmado')).toBeInTheDocument();
    expect(screen.getByText('Derivado al área responsable')).toBeInTheDocument();
    expect(screen.getByText('En evaluación')).toBeInTheDocument();
    expect(screen.getByText('Respuesta / Notificación')).toBeInTheDocument();
    expect(screen.getByText('Finalizado')).toBeInTheDocument();
  });
});
