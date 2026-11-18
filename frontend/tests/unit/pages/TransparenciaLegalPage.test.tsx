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
  it('renderiza la cabecera institucional y la pestaña por defecto de Normativa y permite consultar Privacidad', async () => {
    const user = userEvent.setup();
    renderTransparencia();
    expect(screen.getByText('Transparencia, Legalidad y Protección de Datos')).toBeInTheDocument();
    expect(screen.getByText('TUO de la Ley N.° 27444')).toBeInTheDocument();
    expect(screen.getByText(/Ley del Procedimiento Administrativo General/i)).toBeInTheDocument();

    const tabPrivacidad = screen.getByRole('button', { name: /Política de Privacidad/i });
    await user.click(tabPrivacidad);

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
    expect(screen.getByRole('link', { name: /Presentar solicitud por Mesa de Partes/i })).toHaveAttribute('href', '/mesa-partes');
  });

  it('permite cambiar a la pestaña de Datos Personales y Derechos ARCO y muestra el D.S. 016-2024-JUS', async () => {
    const user = userEvent.setup();
    renderTransparencia();

    const tabDatos = screen.getByRole('button', { name: /Datos Personales y Derechos ARCO/i });
    await user.click(tabDatos);

    expect(screen.getByText('Tratamiento de Datos y Ejercicio de Derechos ARCO')).toBeInTheDocument();
    expect(screen.getByText('Derecho de Acceso')).toBeInTheDocument();
    expect(screen.getByText('Derecho de Rectificación')).toBeInTheDocument();
    expect(screen.getByText('Derecho de Cancelación')).toBeInTheDocument();
    expect(screen.getByText('Derecho de Oposición')).toBeInTheDocument();
    expect(screen.getByText('D.S. 016-2024-JUS Art. 60')).toBeInTheDocument();
  });

  it('permite cambiar a la pestaña de Seguridad de la Cuenta y muestra controles criptográficos y BOLA', async () => {
    const user = userEvent.setup();
    renderTransparencia();

    const tabSeguridad = screen.getByRole('button', { name: /Seguridad de la Cuenta/i });
    await user.click(tabSeguridad);

    expect(screen.getByText('Seguridad de la Cuenta y Control de Acceso')).toBeInTheDocument();
    expect(screen.getByText('Criptografía Argon2id')).toBeInTheDocument();
    expect(screen.getByText('Tokens JWT Efímeros')).toBeInTheDocument();
    expect(screen.getByText('Protección BOLA / RBAC')).toBeInTheDocument();
  });

  it('soporta carga directa vía URL en /transparencia/privacidad, /transparencia/datos-personales y /transparencia/acceso-informacion', () => {
    const { unmount: unmount1 } = renderTransparencia('/transparencia/privacidad');
    expect(screen.getByText('Política de Privacidad y Confidencialidad')).toBeInTheDocument();
    unmount1();

    const { unmount: unmount2 } = renderTransparencia('/transparencia/datos-personales');
    expect(screen.getByText('Tratamiento de Datos y Ejercicio de Derechos ARCO')).toBeInTheDocument();
    unmount2();

    const { unmount: unmount3 } = renderTransparencia('/transparencia/acceso-informacion');
    expect(screen.getByText('Transparencia y Acceso a la Información Pública')).toBeInTheDocument();
    unmount3();
  });

  it('identifica con honestidad que las directivas internas están en proceso de formulación y no inventa números oficiales', () => {
    renderTransparencia('/transparencia/normativa');
    expect(
      screen.getByText(/en proceso de formulación y aprobación institucional mediante resolución directoral/i)
    ).toBeInTheDocument();
  });

  it('en la pestaña de TUPA muestra el panel institucional y enlaces de consulta y solicitud oficial', async () => {
    renderTransparencia('/transparencia/tupa');

    expect(screen.getByText('Catálogo TUPA Institucional 2026')).toBeInTheDocument();
    expect(screen.getByText('Copia Oficial del Documento TUPA y Catálogo de Servicios')).toBeInTheDocument();
    expect(
      screen.getByText(/La descarga de la copia oficial escaneada en formato PDF requiere una solicitud de acceso/i)
    ).toBeInTheDocument();

    // Enlace de consulta abierta al catálogo público
    const linkConsulta = screen.getByRole('link', { name: /Consultar Catálogo Público TUPA/i });
    expect(linkConsulta).toHaveAttribute('href', '/tupa');

    // Enlace de solicitud de copia escaneada oficial en PDF
    const linkSolicitud = screen.getByRole('link', { name: /Solicitar Copia Escaneada Oficial \(PDF\)/i });
    expect(linkSolicitud).toHaveAttribute('href', '/solicitud-acceso-tupa');

    // Confirmar que el detalle de procedimientos individuales no está expuesto aquí
    expect(screen.queryByText(/Alquiler del Galpón Agrícola/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Venta de Mangos/i)).not.toBeInTheDocument();
  });
});
