/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-15 — Pruebas Unitarias de las 4 Subvistas Modulares Desacopladas
 * ARCHIVO: src/tests/m2/tramiteWizardSteps.test.tsx
 * ==============================================================================
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  StepIdentificacion,
  StepDocumentos,
  StepDeclaracionJurada,
  StepConfirmacion,
} from '../../components/tramite/WizardSteps';
import {
  INITIAL_IDENTIFICACION,
  INITIAL_DOCUMENTOS,
  INITIAL_DECLARACION,
  INITIAL_WIZARD_STATE,
  type CargoDigitalResponse,
} from '../../types/tramiteWizardState';

describe('T-FE-MPV-15: Subvistas Modulares Desacopladas del Wizard', () => {
  const dispatchMock = vi.fn();
  const onNextMock = vi.fn();
  const onBackMock = vi.fn();
  const onGoToStepMock = vi.fn();
  const onSuccessMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. StepIdentificacion.tsx
  // ===========================================================================
  describe('StepIdentificacion.tsx', () => {
    it('renderiza todos los campos obligatorios del administrado', () => {
      render(
        <StepIdentificacion
          data={INITIAL_IDENTIFICACION}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      expect(screen.getByLabelText(/Tipo de Documento Oficial/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Número de Documento \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nombres Completos \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Apellidos Completos \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Correo Electrónico Notificable \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Teléfono Celular o Fijo \*/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeDisabled();
    });

    it('valida reactivamente el DNI: muestra error si no tiene 8 dígitos numéricos', () => {
      render(
        <StepIdentificacion
          data={{
            ...INITIAL_IDENTIFICACION,
            tipoDocumento: 'DNI',
            numeroDocumento: '12345', // Inválido: 5 dígitos
          }}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      const inputDoc = screen.getByLabelText(/Número de Documento \*/i);
      fireEvent.blur(inputDoc);

      expect(
        screen.getByText(/El DNI debe contener exactamente 8 dígitos numéricos\./i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeDisabled();
    });

    it('valida reactivamente el RUC: muestra error si no tiene 11 dígitos o no inicia con 10/15/17/20', () => {
      render(
        <StepIdentificacion
          data={{
            ...INITIAL_IDENTIFICACION,
            tipoDocumento: 'RUC',
            numeroDocumento: '30123456789', // Inválido: no inicia con 10, 15, 17 o 20
          }}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      const inputDoc = screen.getByLabelText(/Número de Documento \*/i);
      fireEvent.blur(inputDoc);

      expect(
        screen.getByText(/El RUC debe tener 11 dígitos numéricos y comenzar con 10, 15, 17 o 20\./i)
      ).toBeInTheDocument();
    });

    it('despacha UPDATE_IDENTIFICACION al modificar campos del formulario', () => {
      render(
        <StepIdentificacion
          data={INITIAL_IDENTIFICACION}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      const inputNombres = screen.getByLabelText(/Nombres Completos \*/i);
      fireEvent.change(inputNombres, { target: { value: 'Ana Lucía' } });

      expect(dispatchMock).toHaveBeenCalledWith({
        type: 'UPDATE_IDENTIFICACION',
        payload: { nombres: 'Ana Lucía' },
      });
    });

    it('ejecuta onNext al enviar con datos 100% válidos', () => {
      render(
        <StepIdentificacion
          data={{
            tipoDocumento: 'DNI',
            numeroDocumento: '45678901',
            nombres: 'María Elena',
            apellidos: 'Castro Vásquez',
            correo: 'mcastro@iestpsuiza.edu.pe',
            telefono: '961987654',
          }}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      const submitButton = screen.getByRole('button', { name: /^Siguiente/i });
      expect(submitButton).not.toBeDisabled();

      fireEvent.click(submitButton);
      expect(onNextMock).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 2. StepDocumentos.tsx
  // ===========================================================================
  describe('StepDocumentos.tsx', () => {
    it('renderiza selector TUPA, asunto con contador, folios y dropzone de archivos', () => {
      render(
        <StepDocumentos
          data={INITIAL_DOCUMENTOS}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      expect(screen.getByLabelText(/Procedimiento Institucional o Trámite TUPA \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Asunto o Petitorio Sucinto \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Cantidad Estimada de Folios \*/i)).toBeInTheDocument();
      expect(screen.getByText(/Documentación Sustentatoria Principal en PDF/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeDisabled();
    });

    it('valida que el asunto tenga al menos 10 caracteres', () => {
      render(
        <StepDocumentos
          data={{
            ...INITIAL_DOCUMENTOS,
            tipoTramiteId: 'TUPA-01',
            asunto: 'Corto', // Solo 5 caracteres
            numeroFolios: 2,
            archivos: [{ nombre: 'doc.pdf', peso: 1024, hashSha256: 'abc' }],
          }}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      const textareaAsunto = screen.getByLabelText(/Asunto o Petitorio Sucinto \*/i);
      fireEvent.blur(textareaAsunto);

      expect(
        screen.getByText(/El asunto debe contener al menos 10 caracteres/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeDisabled();
    });

    it('permite adjuntar PDF de prueba y despacha UPDATE_DOCUMENTOS con hash SHA-256', () => {
      render(
        <StepDocumentos
          data={INITIAL_DOCUMENTOS}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      const btnPrueba = screen.getByRole('button', { name: /\+ Cargar PDF de prueba/i });
      fireEvent.click(btnPrueba);

      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_DOCUMENTOS',
          payload: expect.objectContaining({
            archivos: expect.arrayContaining([
              expect.objectContaining({
                nombre: 'solicitud_firmada_estudios_2026.pdf',
                hashSha256: expect.any(String),
              }),
            ]),
          }),
        })
      );
    });

    it('ejecuta onBack al hacer clic en Paso Anterior', () => {
      render(
        <StepDocumentos
          data={INITIAL_DOCUMENTOS}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      const btnBack = screen.getByRole('button', { name: /Anterior/i });
      fireEvent.click(btnBack);

      expect(onBackMock).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 3. StepDeclaracionJurada.tsx
  // ===========================================================================
  describe('StepDeclaracionJurada.tsx', () => {
    it('renderiza las declaraciones legales y el recuadro del Art. 51 de la Ley 27444', () => {
      render(
        <StepDeclaracionJurada
          data={INITIAL_DECLARACION}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      expect(screen.getByText(/Principio de Presunción de Veracidad \(Art\. 51 TUO Ley N° 27444\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Declaración Jurada de Veracidad \(Art\. 51 LPAG\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Aceptación de Términos y Condiciones de Uso/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Autorización Expresa para Notificación por Casilla Electrónica/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeDisabled();
    });

    it('despacha UPDATE_DECLARACION al marcar los checkboxes legales', () => {
      render(
        <StepDeclaracionJurada
          data={INITIAL_DECLARACION}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      const checkVeracidad = screen.getByLabelText(/Declaración Jurada de Veracidad \(Art\. 51 LPAG\)/i);
      fireEvent.click(checkVeracidad);

      expect(dispatchMock).toHaveBeenCalledWith({
        type: 'UPDATE_DECLARACION',
        payload: { declaracionVeracidad: true },
      });
    });

    it('habilita el botón Siguiente Paso solo cuando se aceptan veracidad y términos', () => {
      render(
        <StepDeclaracionJurada
          data={{
            declaracionVeracidad: true,
            aceptaTerminos: true,
            autorizaNotificacionCasilla: true,
          }}
          dispatch={dispatchMock}
          onNext={onNextMock}
          onBack={onBackMock}
        />
      );

      const submitButton = screen.getByRole('button', { name: /^Siguiente/i });
      expect(submitButton).not.toBeDisabled();

      fireEvent.click(submitButton);
      expect(onNextMock).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 4. StepConfirmacion.tsx
  // ===========================================================================
  describe('StepConfirmacion.tsx', () => {
    it('muestra el resumen consolidado de los pasos 1, 2 y 3 con enlaces de edición', () => {
      const stateCompleto = {
        ...INITIAL_WIZARD_STATE,
        currentStep: 4 as const,
        identificacion: {
          tipoDocumento: 'DNI' as const,
          numeroDocumento: '71234567',
          nombres: 'Julio',
          apellidos: 'Vargas',
          correo: 'julio@iestpsuiza.edu.pe',
          telefono: '942112233',
        },
        documentos: {
          tipoTramiteId: 'TUPA-01',
          asunto: 'Solicitud formal de constancia de egreso 2026',
          numeroFolios: 3,
          archivos: [{ nombre: 'doc.pdf', peso: 1024, hashSha256: 'abc' }],
        },
        declaracionJurada: {
          declaracionVeracidad: true,
          aceptaTerminos: true,
          autorizaNotificacionCasilla: true,
        },
      };

      render(
        <StepConfirmacion
          state={stateCompleto}
          dispatch={dispatchMock}
          onBack={onBackMock}
          onGoToStep={onGoToStepMock}
          onSuccess={onSuccessMock}
        />
      );

      expect(screen.getByText(/Julio Vargas/i)).toBeInTheDocument();
      expect(screen.getByText(/71234567/i)).toBeInTheDocument();
      expect(screen.getByText(/TUPA-01/i)).toBeInTheDocument();
      expect(screen.getByText(/Solicitud formal de constancia de egreso 2026/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Radicar Trámite/i })).toBeInTheDocument();

      // Probar navegación directa mediante los botones "Editar"
      const editButtons = screen.getAllByRole('button', { name: /Editar/i });
      expect(editButtons.length).toBe(3);

      fireEvent.click(editButtons[0]);
      expect(onGoToStepMock).toHaveBeenCalledWith(1);
    });

    it('radica el expediente al hacer clic en Radicar Solicitud y despacha SET_SUBMITTING y SET_CARGO', async () => {
      const stateListo = {
        ...INITIAL_WIZARD_STATE,
        currentStep: 4 as const,
        identificacion: {
          tipoDocumento: 'DNI' as const,
          numeroDocumento: '88776655',
          nombres: 'Sonia',
          apellidos: 'Pinedo',
          correo: 'sonia@iestpsuiza.edu.pe',
          telefono: '942556677',
        },
        documentos: {
          tipoTramiteId: 'TUPA-02',
          asunto: 'Expedición de constancia oficial de matrícula',
          numeroFolios: 2,
          archivos: [{ nombre: 'anexo.pdf', peso: 5000, hashSha256: 'hash123' }],
        },
        declaracionJurada: {
          declaracionVeracidad: true,
          aceptaTerminos: true,
          autorizaNotificacionCasilla: true,
        },
      };

      render(
        <StepConfirmacion
          state={stateListo}
          dispatch={dispatchMock}
          onBack={onBackMock}
          onGoToStep={onGoToStepMock}
          onSuccess={onSuccessMock}
        />
      );

      const btnRadicar = screen.getByRole('button', { name: /Radicar Trámite/i });
      fireEvent.click(btnRadicar);

      expect(dispatchMock).toHaveBeenCalledWith({
        type: 'SET_SUBMITTING',
        payload: true,
      });

      await waitFor(
        () => {
          expect(dispatchMock).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'SET_CARGO',
              payload: expect.objectContaining({
                cut: expect.stringMatching(/^EXP-2026-\d{6}$/),
                remitente: 'Sonia Pinedo',
              }),
            })
          );
        },
        { timeout: 2500 }
      );
    });

    it('renderiza la vista del Cargo Digital oficial cuando cargoEmitido está presente', () => {
      const cargoEmitidoMock: CargoDigitalResponse = {
        cut: 'EXP-2026-112233',
        fechaRadicacion: '25 de Septiembre de 2026, 16:30',
        fechaRecepcionOficial: '25 de Septiembre de 2026, 16:30',
        asunto: 'Certificado Oficial de Estudios',
        remitente: 'Carlos Mendoza',
        hashTransaccion: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        qrValidationUrl: 'https://sigd.iestpsuiza.edu.pe/consulta/EXP-2026-112233',
      };

      const stateConCargo = {
        ...INITIAL_WIZARD_STATE,
        currentStep: 4 as const,
        cargoEmitido: cargoEmitidoMock,
      };

      render(
        <StepConfirmacion
          state={stateConCargo}
          dispatch={dispatchMock}
          onBack={onBackMock}
          onGoToStep={onGoToStepMock}
          onSuccess={onSuccessMock}
        />
      );

      expect(screen.getByText(/Cargo de Recepción Digital \(CUT\)/i)).toBeInTheDocument();
      expect(screen.getByText('EXP-2026-112233')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copiar Código CUT/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /🖨️ Imprimir Ticket de Cargo/i })).toBeInTheDocument();

      // Probar botón de nuevo trámite
      const btnNuevo = screen.getByRole('button', { name: /Iniciar Nuevo Trámite/i });
      fireEvent.click(btnNuevo);

      expect(dispatchMock).toHaveBeenCalledWith({ type: 'RESET' });
    });
  });
});
