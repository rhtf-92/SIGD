import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TramitePage from '../../../src/pages/tramite/TramitePage';
import { useAuthStore } from '../../../src/stores/authStore';

vi.mock('../../../src/components/tramite/TramiteWizard', () => ({ default: () => <div>Wizard</div> }));

describe('CTA TUPA en el trámite ciudadano', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'token-a', refreshToken: null, isAuthenticated: true,
      usuario: { id: 'u-a', nombreCompleto: 'Ana', correo: 'ana@example.test', rol: 'CIUDADANO' } });
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    useAuthStore.setState({ accessToken: null, refreshToken: null, isAuthenticated: false, usuario: null });
  });

  it('ofrece catálogo solamente con autorización vigente', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ autorizado: true }) });
    render(<MemoryRouter><TramitePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('link', { name: /Ver Catálogo TUPA/i })).toHaveAttribute('href', '/tupa'));
    expect(screen.queryByRole('link', { name: /Solicitar acceso TUPA/i })).not.toBeInTheDocument();
  });

  it('ofrece solicitud si el acceso no está aprobado', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ autorizado: false }) });
    render(<MemoryRouter><TramitePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('link', { name: /Solicitar acceso TUPA/i })).toHaveAttribute('href', '/solicitud-acceso-tupa'));
    expect(screen.queryByRole('link', { name: /Ver Catálogo TUPA/i })).not.toBeInTheDocument();
  });

  it('ofrece inicio de sesión y registro a visitantes, sin enlace restringido', () => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, isAuthenticated: false, usuario: null });
    render(<MemoryRouter><TramitePage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Iniciar sesión/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Registrarme/i })).toHaveAttribute('href', '/registro');
    expect(screen.queryByRole('link', { name: /Ver Catálogo TUPA/i })).not.toBeInTheDocument();
  });
});
