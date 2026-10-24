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

  it('muestra el catálogo completo TUPA 2026 con las 72 entradas y permite filtrar', async () => {
    const user = userEvent.setup();
    renderTransparencia('/transparencia/tupa');

    expect(screen.getByText(/Catálogo Integral TUPA 2026 \(72 Entradas Oficiales\)/i)).toBeInTheDocument();
    expect(screen.getByText('18 Aprobados')).toBeInTheDocument();
    expect(screen.getByText('54 Pendientes')).toBeInTheDocument();

    // Verificación de entradas aprobadas y pendientes
    expect(screen.getByText(/Certificado Modular \(I, II, III y IV\) Por cada Módulo/i)).toBeInTheDocument();
    expect(screen.getByText(/Alquiler del Galpón Agrícola/i)).toBeInTheDocument();

    // Filtro por texto
    const inputBusqueda = screen.getByPlaceholderText(/Buscar por denominación/i);
    await user.type(inputBusqueda, 'Inglés');

    expect(screen.getByText('Certificado de Inglés')).toBeInTheDocument();
    expect(screen.queryByText(/Alquiler del Galpón Agrícola/i)).not.toBeInTheDocument();
  });

  it('exhibe los 10 campos requeridos por entrada y permite filtrar por categoría y radicación', async () => {
    const user = userEvent.setup();
    renderTransparencia('/transparencia/tupa');

    // Encabezados de los 10 campos
    expect(screen.getByText('Código / Ref')).toBeInTheDocument();
    expect(screen.getByText('Denominación y Requisitos')).toBeInTheDocument();
    expect(screen.getByText('Categoría')).toBeInTheDocument();
    expect(screen.getByText('Estado Validación')).toBeInTheDocument();
    expect(screen.getByText('Derecho Pago')).toBeInTheDocument();
    expect(screen.getByText('Plazo')).toBeInTheDocument();
    expect(screen.getByText('Unidad Responsable')).toBeInTheDocument();
    expect(screen.getByText('Base Legal')).toBeInTheDocument();
    expect(screen.getByText('Radica SIGD')).toBeInTheDocument();

    // Filtro por categoría PROCEDIMIENTO_PENDIENTE
    const selectCategoria = screen.getByLabelText(/Categoría:/i);
    await user.selectOptions(selectCategoria, 'PROCEDIMIENTO_PENDIENTE');

    expect(screen.getByText(/Derecho de duplicado de Título/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Acceso a la Información Pública/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Certificado de Inglés/i)).not.toBeInTheDocument();

    // Filtro por radicación SI
    await user.selectOptions(selectCategoria, 'TODAS');
    const selectRadicacion = screen.getByLabelText(/¿Admite Radicación SIGD\?:/i);
    await user.selectOptions(selectRadicacion, 'SI');

    // Debe mostrar los aprobados radicables y no mostrar los comerciales
    expect(screen.getByText('Certificado de Inglés')).toBeInTheDocument();
    expect(screen.queryByText(/Alquiler del Galpón Agrícola/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Venta de Mangos/i)).not.toBeInTheDocument();
  });
});
