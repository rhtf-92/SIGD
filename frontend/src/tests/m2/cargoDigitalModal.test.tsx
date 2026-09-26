/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-16 — Pruebas Unitarias de CargoDigitalModal con Acciones Legales
 * ARCHIVO: src/tests/m2/cargoDigitalModal.test.tsx
 * ==============================================================================
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CargoDigitalModal } from '../../components/tramite/CargoDigitalModal';
import type { CargoDigitalResponse } from '../../types/tramiteWizardState';
import type { CargoOficialTramite } from '../../types/cargoOficial';

describe('T-FE-MPV-16: CargoDigitalModal con Botones de Acción Legal', () => {
  const onCloseMock = vi.fn();
  const onDownloadPdfMock = vi.fn();

  const cargoDataMock: CargoDigitalResponse = {
    cut: 'EXP-2026-987654',
    fechaRadicacion: '25 de Septiembre de 2026, 17:30',
    fechaRecepcionOficial: '25 de Septiembre de 2026, 17:30',
    asunto: 'Expedición de Título Profesional Técnico en Computación',
    remitente: 'Lucía Fernández Ramos (DNI: 74859612)',
    hashTransaccion: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    qrValidationUrl: 'https://sigd.iestpsuiza.edu.pe/consulta/EXP-2026-987654',
  };

  const cargoVentanillaMock: CargoOficialTramite = {
    codigoExpediente: 'EXP-2026-000199',
    fechaRecepcionIso: '2026-09-25T18:00:00.000Z',
    fechaIngresoFormalIso: '2026-09-28T08:00:00.000Z',
    horaRecepcion: '18:00:00',
    operadorVentanillaNombre: 'Ventanilla 1',
    sedeInstitucional: 'Sede Central - Jr. Tarapacá N° 645',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'DNI',
      numeroDocumento: '71234567',
      nombreOrazonSocial: 'Pedro Alva',
      correoElectronico: 'palva@gmail.com',
      telefono: '987654321',
    },
    asunto: 'Constancia de No Adeudo',
    documentoPrincipalTipo: 'SOLICITUD',
    cantidadFolios: 2,
    hashSha256Recepcion: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
    horaCorteAplicada: '16:30',
    radicadoDiaSiguiente: true,
    urlSeguimiento: 'https://sigd.iestpsuiza.edu.pe/tramite?cut=EXP-2026-000199',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Renderizado y Estructura Visual', () => {
    it('no renderiza nada cuando isOpen es false', () => {
      render(
        <CargoDigitalModal
          isOpen={false}
          cargoData={cargoDataMock}
          onClose={onCloseMock}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renderiza el modal accesible con rol dialog y aria-modal="true" cuando isOpen es true', () => {
      render(
        <CargoDigitalModal
          isOpen={true}
          cargoData={cargoDataMock}
          onClose={onCloseMock}
        />
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(
        screen.getByRole('heading', { name: /Cargo de Recepción Digital/i })
      ).toBeInTheDocument();
    });

    it('muestra el CUT destacado en tipografía font-mono', () => {
      render(
        <CargoDigitalModal
          isOpen={true}
          cargoData={cargoDataMock}
          onClose={onCloseMock}
        />
      );

      const cutElement = screen.getByText('EXP-2026-987654');
      expect(cutElement).toBeInTheDocument();
      expect(cutElement.className).toContain('font-mono');
    });

    it('renderiza el código QR y los metadatos de integridad (Remitente, Asunto, Hash SHA-256)', () => {
      render(
        <CargoDigitalModal
          isOpen={true}
          cargoData={cargoDataMock}
          onClose={onCloseMock}
        />
      );

      expect(
        screen.getByRole('img', { name: /Código QR de verificación legal/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/Lucía Fernández Ramos/i)).toBeInTheDocument();
      expect(screen.getByText(/Expedición de Título Profesional Técnico en Computación/i)).toBeInTheDocument();
      expect(screen.getByText(/7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069/i)).toBeInTheDocument();
    });
  });

  describe('2. Interactividad y Botones de Acción Legal', () => {
    it('copia el CUT al portapapeles y muestra estado visual temporal "¡Copiado!"', async () => {
      const clipboardMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: clipboardMock,
        },
      });

      render(
        <CargoDigitalModal
          isOpen={true}
          cargoData={cargoDataMock}
          onClose={onCloseMock}
        />
      );

      const copyBtn = screen.getByRole('button', { name: /Copiar CUT/i });
      fireEvent.click(copyBtn);

      expect(clipboardMock).toHaveBeenCalledWith('EXP-2026-987654');

      await waitFor(() => {
        expect(screen.getByText('¡Copiado!')).toBeInTheDocument();
      });
    });

    it('dispara onDownloadPdf al presionar "Descargar Cargo Digital (PDF)"', () => {
      render(
        <CargoDigitalModal
          isOpen={true}
          cargoData={cargoDataMock}
          onClose={onCloseMock}
          onDownloadPdf={onDownloadPdfMock}
        />
      );

      const downloadBtn = screen.getByRole('button', { name: /Descargar Cargo Digital \(PDF\)/i });
      fireEvent.click(downloadBtn);

      expect(onDownloadPdfMock).toHaveBeenCalledTimes(1);
    });

    it('ejecuta onClose al presionar "Finalizar y Cerrar"', () => {
      render(
        <CargoDigitalModal
          isOpen={true}
          cargoData={cargoDataMock}
          onClose={onCloseMock}
        />
      );

      const closeActionBtn = screen.getByRole('button', { name: /Finalizar y Cerrar/i });
      fireEvent.click(closeActionBtn);

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('cierra el modal al pulsar la tecla Escape', () => {
      render(
        <CargoDigitalModal
          isOpen={true}
          cargoData={cargoDataMock}
          onClose={onCloseMock}
        />
      );

      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('permite redirección hacia Casilla Electrónica', () => {
      render(
        <CargoDigitalModal
          isOpen={true}
          cargoData={cargoDataMock}
          onClose={onCloseMock}
        />
      );

      const casillaBtn = screen.getByRole('button', { name: /Acceder a Casilla Electrónica/i });
      expect(casillaBtn).toBeInTheDocument();

      fireEvent.click(casillaBtn);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Retrocompatibilidad con Ventanilla Presencial (CargoOficialTramite)', () => {
    it('renderiza correctamente el cargo presencial con nota normativa de corte horario LPAG', () => {
      render(
        <CargoDigitalModal
          isOpen={true}
          cargo={cargoVentanillaMock}
          onClose={onCloseMock}
        />
      );

      expect(screen.getByText('EXP-2026-000199')).toBeInTheDocument();
      expect(screen.getByText(/Pedro Alva/i)).toBeInTheDocument();
      expect(screen.getByText(/Constancia de No Adeudo/i)).toBeInTheDocument();
      expect(screen.getByText(/Nota Normativa LPAG \(Ley N° 27444\):/i)).toBeInTheDocument();
      expect(screen.getByText(/16:30 hrs/i)).toBeInTheDocument();
    });
  });
});
