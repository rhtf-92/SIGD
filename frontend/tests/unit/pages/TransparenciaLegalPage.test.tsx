import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TransparenciaLegalPage from '../../../src/pages/transparencia/TransparenciaLegalPage';

function renderTransparencia(initialEntry = '/transparencia') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/transparencia" element={<TransparenciaLegalPage />} />
        <Route path="/transparencia/:seccion" element={<TransparenciaLegalPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TransparenciaLegalPage — Transparencia, Legalidad y Catálogo TUPA', () => {
  it('renderiza la cabecera institucional y la pestaña por defecto de Privacidad', () => {
    renderTransparencia();
    expect(screen.getByText('Transparencia, Legalidad y Protección de Datos')).toBeInTheDocument();
    expect(screen.getByText('Política de Privacidad y Confidencialidad')).toBeInTheDocument();
    expect(screen.getAllByText(/Ley N.° 29733/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/D.S. N.° 016-2024-JUS/i).length).toBeGreaterThanOrEqual(1);
  });

  it('permite cambiar a la pestaña de Términos de Uso y muestra el TUO de la Ley 27444', async () => {
    const user = userEvent.setup();
    renderTransparencia();

    const tabTerminos = screen.getByRole('button', { name: /Términos de Uso/i });
    await user.click(tabTerminos);

    expect(screen.getByText('Términos y Condiciones de Uso del SIGD')).toBeInTheDocument();
    expect(screen.getAllByText(/D.S. N.° 006-2026-JUS/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Ley del Procedimiento Administrativo General/i).length).toBeGreaterThanOrEqual(1);
  });

  it('permite cambiar a la pestaña de Validez de Firma Digital y muestra la Ley 27269', async () => {
    const user = userEvent.setup();
    renderTransparencia();

    const tabFirma = screen.getByRole('button', { name: /Validez de Firma Digital/i });
    await user.click(tabFirma);

    expect(screen.getByText(/Validez Legal de Firma Digital y Verificación CVD/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ley N.° 27269/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: /Ir al Validador CVD/i })).toHaveAttribute('href', '/validador-cvd');
  });

  it('permite cambiar a la pestaña de Acceso a la Información y muestra la Ley 27806', async () => {
    const user = userEvent.setup();
    renderTransparencia();

    const tabAcceso = screen.getByRole('button', { name: /Acceso a la Información/i });
    await user.click(tabAcceso);

    expect(screen.getAllByText(/Transparencia y Acceso a la Información Pública/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Ley N.° 27806/i).length).toBeGreaterThanOrEqual(1);
  });

  it('en la pestaña de TUPA muestra el panel de acceso restringido y no expone el catálogo completo de forma anónima', async () => {
    renderTransparencia('/transparencia/tupa');

    expect(screen.getByText(/Acceso Restringido al Documento TUPA Institucional/i)).toBeInTheDocument();
    expect(screen.getByText(/Para consultar el documento TUPA institucional completo se requiere una solicitud de acceso/i)).toBeInTheDocument();

    // Botón de solicitar acceso
    const linkSolicitud = screen.getByRole('link', { name: /Solicitar Acceso al Catálogo TUPA/i });
    expect(linkSolicitud).toHaveAttribute('href', '/solicitud-acceso-tupa');

    // Confirmar que el catálogo de 72 entradas NO está expuesto públicamente aquí
    expect(screen.queryByText(/Catálogo Integral TUPA 2026 \(72 Entradas Oficiales\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Alquiler del Galpón Agrícola/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Venta de Mangos/i)).not.toBeInTheDocument();
  });
});
