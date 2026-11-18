import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResolverModal from '../../../src/components/expedientes/ResolverModal';
import { expediente, crearAccionPrueba } from '../../fixtures/expedientesFixtures';
import type { SolicitudResolver, ResultadoResolver } from '../../../src/types/expedienteActions';
import { establecerAdaptadorDnie } from '../../../src/services/dnie/dnieAdapter.factory';
import type { DniHardwareAdapter, EstadoDispositivoDnie } from '../../../src/services/dnie/dnieAdapter.types';
import { apiClient } from '../../../src/api/client';
import { useAuthStore } from '../../../src/stores/authStore';

describe('ResolverModal con DNIe (Fase 5I)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      usuario: {
        id: 'usr-dir-01',
        nombreCompleto: 'Dr. Roberto Mendoza Quispe',
        dni: '99000005',
        rol: 'DIRECTOR',
        roles: ['DIRECTOR'],
        permisos: ['RESOLVER_EXPEDIENTE'],
      } as any,
    });
  });

  afterEach(() => {
    establecerAdaptadorDnie(null);
  });

  it('PM-5I-UI-01: Muestra "Lector No Detectado" cuando no hay hardware conectado', async () => {
    const mockAdapter: DniHardwareAdapter = {
      detectarDispositivo: vi.fn().mockResolvedValue({
        tarjetaDetectada: false,
        estado: 'LECTOR_NO_PRESENTE',
        mensaje: 'No se detectó ningún lector de tarjetas inteligentes.',
        certificados: [],
      } satisfies EstadoDispositivoDnie),
      listarCertificados: vi.fn().mockResolvedValue([]),
      firmarHash: vi.fn(),
    };
    establecerAdaptadorDnie(mockAdapter);

    const ejecutar = vi.fn(async () => true);
    const cerrar = vi.fn();

    render(
      <ResolverModal
        open
        onClose={cerrar}
        expediente={expediente}
        accion={crearAccionPrueba<SolicitudResolver, ResultadoResolver>({ ejecutar })}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Lector No Detectado')).toBeInTheDocument();
    });
    expect(screen.getByText(/No se detectó ningún lector/)).toBeInTheDocument();
    // Botón de emitir resolución debe estar deshabilitado
    const btnResolver = screen.getByRole('button', { name: /Emitir Resolución Formal/i });
    expect(btnResolver).toBeDisabled();
  });

  it('PM-5I-UI-02: Muestra "Inserte Tarjeta DNIe" cuando el lector está presente pero sin tarjeta', async () => {
    const mockAdapter: DniHardwareAdapter = {
      detectarDispositivo: vi.fn().mockResolvedValue({
        tarjetaDetectada: false,
        lectorNombre: 'Bit4id miniLector EVO',
        estado: 'LECTOR_PRESENTE_SIN_TARJETA',
        mensaje: 'Lector Bit4id detectado. Inserte su DNI electrónico en la ranura.',
        certificados: [],
      } satisfies EstadoDispositivoDnie),
      listarCertificados: vi.fn().mockResolvedValue([]),
      firmarHash: vi.fn(),
    };
    establecerAdaptadorDnie(mockAdapter);

    render(
      <ResolverModal
        open
        onClose={vi.fn()}
        expediente={expediente}
        accion={crearAccionPrueba<SolicitudResolver, ResultadoResolver>()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Inserte Tarjeta DNIe')).toBeInTheDocument();
    });
    expect(screen.getByText(/Lector Bit4id detectado/)).toBeInTheDocument();
  });

  it('PM-5I-UI-03: Detecta certificado válido, prepara documento, firma con DNIe y permite resolver', async () => {
    const user = userEvent.setup();
    const mockAdapter: DniHardwareAdapter = {
      detectarDispositivo: vi.fn().mockResolvedValue({
        tarjetaDetectada: true,
        lectorNombre: 'Bit4id miniLector EVO',
        estado: 'CERTIFICADO_VALIDO',
        mensaje: 'Certificado de firma digital de DNIe verificado y listo.',
        certificados: [
          {
            id: 'cert-01',
            subject: 'CN=Dr. Roberto Mendoza Quispe, SERIALNUMBER=DNI 99000005',
            dni: '99000005',
            nombreCompleto: 'Dr. Roberto Mendoza Quispe',
            issuer: 'RENIEC Entidad de Certificación de la Administración Pública',
            serialNumber: '5A12B890',
            thumbprint: 'A1B2C3D4E5F678901234567890ABCDEF12345678',
            validFrom: '2025-01-01T00:00:00Z',
            validTo: '2028-01-01T00:00:00Z',
            esVigente: true,
            algoritmo: 'SHA256withRSA',
            pem: '-----BEGIN CERTIFICATE-----\nMIIE...-----END CERTIFICATE-----',
          },
        ],
      } satisfies EstadoDispositivoDnie),
      listarCertificados: vi.fn().mockResolvedValue([]),
      firmarHash: vi.fn().mockResolvedValue({
        hashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        firmaB64: 'MC0CFQC8...signature...',
        algoritmo: 'SHA256withRSA',
        certificadoPem: '-----BEGIN CERTIFICATE-----\nMIIE...-----END CERTIFICATE-----',
        proveedor: 'MOCK_TEST',
      }),
    };
    establecerAdaptadorDnie(mockAdapter);

    // Mock API client post
    vi.spyOn(apiClient, 'post').mockImplementation((url) => {
      if (url === '/api/v1/firma/dnie/preparar') {
        return Promise.resolve({
          data: {
            preparacionId: 'prep-5i-001',
            expedienteId: expediente.id,
            cut: 'CUT-PRUEBA-001',
            documentoId: 'doc-adj-001',
            documentoNombre: 'Resolucion_Directoral_045.pdf',
            hashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            algoritmoRecomendado: 'SHA256withRSA',
          },
        }) as any;
      }
      if (url === '/api/v1/firma/dnie/verificar-y-registrar') {
        return Promise.resolve({
          data: {
            ok: true,
            documentoId: 'doc-adj-001',
            cvd: 'CVD-2026-TEST5I001',
            estado: 'FIRMADO_DIGITALMENTE',
            verificacion: {
              firmaValida: true,
              certificadoVigente: true,
              cadenaConfiable: true,
              revocacion: 'REVOCACION_NO_VERIFICABLE',
              titular: {
                dni: '99000005',
                nombre: 'Dr. Roberto Mendoza Quispe',
              },
            },
          },
        }) as any;
      }
      return Promise.reject(new Error(`URL no manejada: ${url}`));
    });

    const ejecutar = vi.fn(async () => true);
    const cerrar = vi.fn();

    render(
      <ResolverModal
        open
        onClose={cerrar}
        expediente={expediente}
        accion={crearAccionPrueba<SolicitudResolver, ResultadoResolver>({ ejecutar })}
      />
    );

    // 1. Verificar detección de DNIe y visualización de datos de certificado
    await waitFor(() => {
      expect(screen.getByText('✓ DNIe Conectado y Válido')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Dr. Roberto Mendoza Quispe').length).toBeGreaterThan(0);
    expect(screen.getByText('99000005')).toBeInTheDocument();
    expect(screen.getByText(/Resolucion_Directoral_045.pdf/)).toBeInTheDocument();

    // 2. Ejecutar la firma con DNIe
    const btnFirmar = screen.getByRole('button', { name: /Firmar Documento con DNIe/i });
    expect(btnFirmar).toBeEnabled();
    await user.click(btnFirmar);

    // 3. Verificar que la firma se haya verificado y registrado con CVD
    await waitFor(() => {
      expect(screen.getByText(/Firma Digital Criptográfica Verificada y Asentada/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/CVD-2026-TEST5I001/)).toBeInTheDocument();

    // 4. Ahora el botón "Emitir Resolución Formal" debe estar habilitado
    const btnResolver = screen.getByRole('button', { name: /Emitir Resolución Formal/i });
    expect(btnResolver).toBeEnabled();
    await user.click(btnResolver);

    // 5. Verificar que se ejecuta la acción de resolución
    await waitFor(() => {
      expect(ejecutar).toHaveBeenCalledWith(
        expect.objectContaining({
          expediente,
          resultado_resumen: expect.stringContaining('Se declara PROCEDENTE'),
        })
      );
    });
  });

  it('PM-5I-UI-04: Maneja error en backend durante la preparación y muestra mensaje', async () => {
    const mockAdapter: DniHardwareAdapter = {
      detectarDispositivo: vi.fn().mockResolvedValue({
        tarjetaDetectada: true,
        lectorNombre: 'Bit4id miniLector EVO',
        estado: 'CERTIFICADO_VALIDO',
        mensaje: 'Certificado presente.',
        certificados: [
          {
            id: 'cert-01',
            subject: 'CN=Dr. Roberto Mendoza',
            dni: '99000005',
            nombreCompleto: 'Dr. Roberto Mendoza',
            issuer: 'RENIEC',
            serialNumber: '123',
            thumbprint: 'ABC',
            validFrom: '2025-01-01T00:00:00Z',
            validTo: '2028-01-01T00:00:00Z',
            esVigente: true,
            algoritmo: 'SHA256withRSA',
            pem: 'KEY',
          },
        ],
      } satisfies EstadoDispositivoDnie),
      listarCertificados: vi.fn().mockResolvedValue([]),
      firmarHash: vi.fn(),
    };
    establecerAdaptadorDnie(mockAdapter);

    vi.spyOn(apiClient, 'post').mockRejectedValue({
      response: {
        data: {
          code: 'EXPEDIENTE_NO_EN_FIRMA',
          message: 'El expediente debe encontrarse en estado EN_FIRMA para preparar la suscripción.',
        },
      },
    });

    render(
      <ResolverModal
        open
        onClose={vi.fn()}
        expediente={expediente}
        accion={crearAccionPrueba<SolicitudResolver, ResultadoResolver>()}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('El expediente debe encontrarse en estado EN_FIRMA para preparar la suscripción.')
      ).toBeInTheDocument();
    });
  });

  it('PM-5I-UI-05: Muestra "Bridge No Configurado" cuando el bridge local no está disponible', async () => {
    const mockAdapter: DniHardwareAdapter = {
      detectarDispositivo: vi.fn().mockResolvedValue({
        tarjetaDetectada: false,
        estado: 'BRIDGE_NO_DISPONIBLE',
        mensaje: 'El servicio de integración con puente DNIe local no se encuentra configurado.',
        certificados: [],
      } satisfies EstadoDispositivoDnie),
      listarCertificados: vi.fn().mockResolvedValue([]),
      firmarHash: vi.fn(),
    };
    establecerAdaptadorDnie(mockAdapter);

    render(
      <ResolverModal
        open
        onClose={vi.fn()}
        expediente={expediente}
        accion={crearAccionPrueba<SolicitudResolver, ResultadoResolver>()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bridge No Configurado')).toBeInTheDocument();
    });
    expect(screen.getByText(/El servicio de integración con puente DNIe local no se encuentra configurado/)).toBeInTheDocument();
  });
});
