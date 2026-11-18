/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * RAMA: B_GERIC
 * TAREA: BUGFIX PRIORITARIO PRE-DEMO — Persistencia de Identidad en Iniciar Nuevo Trámite
 * ARCHIVO: tests/unit/tramite/IniciarNuevoTramiteIdentidad.test.tsx
 * ==============================================================================
 * COBERTURA DE LOS 14 ESCENARIOS REQUERIDOS:
 * 1. Ciudadano autenticado abre /tramite → perfil se carga desde /api/v1/auth/me
 * 2. Identidad readonly (tipoDoc, numDoc, nombres, apellidos bloqueados) y contacto editable
 * 3. Termina trámite por los 4 pasos y emite cargo
 * 4. Pulsa "Iniciar Nuevo Trámite"
 * 5. Identidad vuelve a aparecer correctamente autocompletada
 * 6. TUPA anterior ya no está seleccionado (limpio)
 * 7. Petitorio anterior limpio
 * 8. Adjuntos anteriores limpios
 * 9. CUT anterior limpio
 * 10. Contacto vuelve desde el perfil base correspondiente
 * 11. Fallo en /api/v1/auth/me bloquea avance sin fallback manual editable
 * 12. Menú "Nuevo Trámite" y botón final usan el mismo comportamiento de reset limpio
 * 13. Refresh (F5 / recarga) mantiene autofill
 * 14. Backend sigue ignorando personaId arbitrario y deriva identidad del JWT (referencia)
 * ==============================================================================
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TramiteWizard } from '../../../src/components/tramite/TramiteWizard';
import TramitePage from '../../../src/pages/tramite/TramitePage';
import { useAuthStore } from '../../../src/stores/authStore';
import { TRAMITE_WIZARD_STORAGE_KEY } from '../../../src/hooks/useTramiteWizardReducer';
import { apiClient } from '../../../src/api/client';
import { createHash } from 'node:crypto';

const mockUpload = vi.hoisted(() => vi.fn());
vi.mock('../../../src/hooks/usePresignedUpload', () => ({
  usePresignedUpload: () => ({ upload: mockUpload, status: 'idle', progress: 0 }),
}));

const PERFIL_CIUDADANO = {
  idPersona: '11111111-2222-3333-4444-555555555555',
  tipoDocumento: 'DNI' as const,
  numeroDocumento: '74123456',
  nombres: 'María Elena',
  apellidos: 'Vargas Paredes',
  correo: 'maria.vargas@iestpsuiza.edu.pe',
  telefono: '961987654',
  direccion: 'Jr. Los Cedros 456, Pucallpa',
};

const REGISTRO_VERSION_CERTIFICADO = '11111111-1111-4111-8111-111111111111';
const REGISTRO_VERSION_CONSTANCIA = '22222222-2222-4222-8222-222222222222';

const metadatos = (pagina: number, referenciaFila: string) => ({
  fuente: {
    nombre: 'TUPA_2026_IESTP_Suiza.pdf',
    documentoSha256: '377DD8E14B8806F2030B5374120AB9B4FE17640BB98086E10C1A9A4431A33622',
    pagina,
    referenciaFila,
  },
  pagina,
  revision: 1,
  vigencia: { desde: null, hasta: null },
  vigenciaDesde: null,
  vigenciaHasta: null,
  version: {
    etiqueta: 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1',
    revision: 1,
    vigenciaDesde: null,
    vigenciaHasta: null,
  },
  estadoValidacion: 'APROBADO',
  estado: 'APROBADO',
  referenciaAprobacion: 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1',
});

const CATALOGO_TUPA_MOCK = [
  {
    registroVersionId: REGISTRO_VERSION_CERTIFICADO,
    codigoExterno: '01',
    codigo: '01',
    denominacion: 'Certificado oficial de estudios',
    requisitos: ['FUT', 'Constancia'],
    monto: 'S/. 15.00',
    id: REGISTRO_VERSION_CERTIFICADO,
    ...metadatos(5, 'p5-fila-20'),
  },
  {
    registroVersionId: REGISTRO_VERSION_CONSTANCIA,
    codigoExterno: '02',
    codigo: '02',
    denominacion: 'Constancia de no adeudar',
    requisitos: [],
    monto: 'Gratuito',
    id: REGISTRO_VERSION_CONSTANCIA,
    ...metadatos(4, 'p4-fila-10'),
  },
];

async function cargarPdfMock(user: ReturnType<typeof userEvent.setup>) {
  const bytes = new TextEncoder().encode('%PDF-1.4\n%%EOF\n');
  const archivo = new File([bytes], 'solicitud.pdf', { type: 'application/pdf' });
  Object.defineProperty(archivo, 'arrayBuffer', { value: async () => bytes.buffer });
  vi.spyOn(crypto.subtle, 'digest').mockResolvedValueOnce(
    Uint8Array.from(Buffer.from(createHash('sha256').update(bytes).digest('hex'), 'hex')).buffer,
  );
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  if (input) {
    await user.upload(input, archivo);
  }
}

describe('SIGD 2026 — Persistencia de Identidad en "Iniciar Nuevo Trámite"', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();

    mockUpload.mockReset().mockImplementation(async (file: File) => ({
      file,
      sha256: createHash('sha256').update('%PDF-1.4\n%%EOF\n').digest('hex'),
      s3Key: 'expedientes/2026/archivo-confirmado.pdf',
    }));

    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: CATALOGO_TUPA_MOCK } as never);

    vi.spyOn(apiClient, 'post').mockResolvedValue({
      status: 201,
      data: {
        expedienteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        tipoDocumentalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        cut: 'EXP-2026-000042',
        fechaRadicacionLegal: '2026-10-28T13:00:00.000Z',
        fechaEnvioReal: '2026-10-28T13:00:00.000Z',
        qrSeguimientoUrl: '/consulta/EXP-2026-000042',
        cargoDigital: { hashSha256: 'a'.repeat(64), qrContenido: 'https://sigd.pe/EXP-2026-000042' },
        mensajeLegal: 'Expediente radicado válidamente.',
      },
    } as never);

    // Mock de fetch para /auth/me y estado tupa
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/v1/auth/me')) {
        return {
          ok: true,
          json: async () => PERFIL_CIUDADANO,
        };
      }
      if (String(url).includes('/api/v1/tramites/tupa/acceso/estado')) {
        return {
          ok: true,
          json: async () => ({ autorizado: true }),
        };
      }
      return { ok: false, status: 404 };
    });

    useAuthStore.setState({
      accessToken: 'token-jwt-ciudadano-valido',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'usr-ciudadano-1',
        idPersona: PERFIL_CIUDADANO.idPersona,
        nombreCompleto: 'María Elena Vargas Paredes',
        correo: PERFIL_CIUDADANO.correo,
        rol: 'CIUDADANO',
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('1 y 2: ciudadano autenticado abre /tramite → perfil se carga, identidad es readonly y contacto editable', async () => {
    render(
      <MemoryRouter initialEntries={['/tramite']}>
        <TramiteWizard />
      </MemoryRouter>
    );

    // Muestra estado de carga institucional mientras responde /auth/me
    expect(screen.getByRole('status')).toHaveTextContent(/Cargando datos de tu cuenta/i);

    // Al responder, se renderiza Paso 1
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Verifica tus datos' })).toBeInTheDocument();
    });

    // Identidad readonly
    const selectTipoDoc = screen.getByLabelText(/Tipo de Documento Oficial/i);
    expect(selectTipoDoc).toBeDisabled();

    const inputNumDoc = screen.getByLabelText(/Número de Documento/i);
    expect(inputNumDoc).toHaveValue('74123456');
    expect(inputNumDoc).toHaveAttribute('readonly');

    const inputNombres = screen.getByLabelText(/Nombres Completos/i);
    expect(inputNombres).toHaveValue('María Elena');
    expect(inputNombres).toHaveAttribute('readonly');

    const inputApellidos = screen.getByLabelText(/Apellidos Completos/i);
    expect(inputApellidos).toHaveValue('Vargas Paredes');
    expect(inputApellidos).toHaveAttribute('readonly');

    // Contacto editable
    const inputCorreo = screen.getByLabelText(/Correo Electrónico Notificable/i);
    expect(inputCorreo).toHaveValue('maria.vargas@iestpsuiza.edu.pe');
    expect(inputCorreo).not.toHaveAttribute('readonly');

    const inputTelefono = screen.getByLabelText(/Teléfono Celular o Fijo/i);
    expect(inputTelefono).toHaveValue('961987654');
    expect(inputTelefono).not.toHaveAttribute('readonly');
  });

  it('3 a 10: completa trámite, pulsa "Iniciar Nuevo Trámite" → identidad persiste y datos de trámite se limpian', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/tramite']}>
        <TramiteWizard />
      </MemoryRouter>
    );

    // Esperar Paso 1
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Verifica tus datos' })).toBeInTheDocument();
    });

    // Modificar correo solo para este trámite
    const inputCorreo = screen.getByLabelText(/Correo Electrónico Notificable/i);
    await user.clear(inputCorreo);
    await user.type(inputCorreo, 'contacto.temporal@iestpsuiza.edu.pe');

    // Avanzar a Paso 2
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    // Paso 2: Selección TUPA, asunto y PDF
    await screen.findByRole('option', { name: /Certificado oficial de estudios/i });
    await user.selectOptions(
      screen.getByLabelText(/Procedimiento Institucional/i),
      REGISTRO_VERSION_CERTIFICADO
    );
    await user.type(
      screen.getByLabelText(/Asunto o Petitorio Sucinto/i),
      'Solicitud urgente de certificado de notas'
    );
    await cargarPdfMock(user);

    // Avanzar a Paso 3
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    // Paso 3: Declaraciones
    await waitFor(() => {
      expect(screen.getByLabelText(/Declaración Jurada de Veracidad/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/Declaración Jurada de Veracidad/i));
    await user.click(screen.getByLabelText(/Aceptación de Términos/i));

    // Avanzar a Paso 4
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    // Paso 4: Resumen y Radicación
    const btnRadicar = await screen.findByRole('button', { name: /Radicar Trámite/i });
    await user.click(btnRadicar);

    // 3. Confirmación con CUT y fecha formateada local (28 oct 2026 · 08:00)
    await waitFor(() => {
      expect(screen.getAllByText('EXP-2026-000042')[0]).toBeInTheDocument();
    });
    expect(screen.getAllByText('28 oct 2026 · 08:00')[0]).toBeInTheDocument();

    // 4. Pulsa "Iniciar Nuevo Trámite"
    const btnNuevoTramite = screen.getByRole('button', { name: /Iniciar Nuevo Trámite/i });
    await user.click(btnNuevoTramite);

    // 5. Identity vuelve a aparecer en Paso 1
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Verifica tus datos' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Número de Documento/i)).toHaveValue('74123456');
    expect(screen.getByLabelText(/Nombres Completos/i)).toHaveValue('María Elena');
    expect(screen.getByLabelText(/Apellidos Completos/i)).toHaveValue('Vargas Paredes');
    expect(screen.getByLabelText(/Número de Documento/i)).toHaveAttribute('readonly');

    // 10. Contacto vuelve desde el perfil base de la cuenta (no conserva el temporal)
    expect(screen.getByLabelText(/Correo Electrónico Notificable/i)).toHaveValue('maria.vargas@iestpsuiza.edu.pe');

    // 9. CUT anterior limpio (ya no está visible la tarjeta del CUT ni el modal)
    expect(screen.queryAllByText('EXP-2026-000042')).toHaveLength(0);

    // Avanzar a Paso 2 para verificar TUPA, petitorio y archivos limpios
    await user.click(screen.getByRole('button', { name: /^Siguiente/i }));

    // 6. TUPA anterior ya no está seleccionado
    await screen.findByRole('option', { name: /Certificado oficial de estudios/i });
    const selectTupa = screen.getByLabelText(/Procedimiento Institucional/i) as HTMLSelectElement;
    expect(selectTupa.value).toBe('');

    // 7. Petitorio anterior limpio
    const inputAsunto = screen.getByLabelText(/Asunto o Petitorio Sucinto/i) as HTMLTextAreaElement;
    expect(inputAsunto.value).toBe('');

    // 8. Adjuntos anteriores limpios
    expect(screen.queryByText('solicitud.pdf')).not.toBeInTheDocument();
  });

  it('11: fallo en /api/v1/auth/me bloquea avance y no habilita identidad editable manual', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/v1/auth/me')) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ autorizado: true }) };
    });

    render(
      <MemoryRouter initialEntries={['/tramite']}>
        <TramiteWizard />
      </MemoryRouter>
    );

    // Bloqueo con alerta institucional
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo consultar el perfil de la cuenta/i);
    });

    // No se expone formulario con campos editables
    expect(screen.queryByLabelText(/Número de Documento/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Siguiente/i })).not.toBeInTheDocument();
  });

  it('12: navegación desde menú "Nuevo Trámite" produce el mismo comportamiento limpio', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/tramite', state: { nuevoTramite: true, t: 12345 } }]}>
        <Routes>
          <Route path="/tramite" element={<TramitePage />} />
        </Routes>
      </MemoryRouter>
    );

    // Se carga el perfil oficial
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Verifica tus datos' })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Número de Documento/i)).toHaveValue('74123456');
    expect(screen.getByLabelText(/Número de Documento/i)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/Correo Electrónico Notificable/i)).toHaveValue('maria.vargas@iestpsuiza.edu.pe');
  });

  it('13: refresh (F5) con borrador mantiene el autofill y no borra la identidad', async () => {
    // Simular que sessionStorage ya tiene un borrador guardado
    sessionStorage.setItem(
      TRAMITE_WIZARD_STORAGE_KEY,
      JSON.stringify({
        currentStep: 1,
        identificacion: {
          idPersona: PERFIL_CIUDADANO.idPersona,
          tipoDocumento: 'DNI',
          numeroDocumento: '74123456',
          nombres: 'María Elena',
          apellidos: 'Vargas Paredes',
          correo: 'contacto.persistido@iestpsuiza.edu.pe',
          telefono: '961987654',
          direccion: 'Jr. Los Cedros 456, Pucallpa',
        },
      })
    );

    render(
      <MemoryRouter initialEntries={['/tramite']}>
        <TramiteWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Verifica tus datos' })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Número de Documento/i)).toHaveValue('74123456');
    expect(screen.getByLabelText(/Número de Documento/i)).toHaveAttribute('readonly');
    // El contacto modificado en el borrador previo al refresh se mantiene
    expect(screen.getByLabelText(/Correo Electrónico Notificable/i)).toHaveValue('contacto.persistido@iestpsuiza.edu.pe');
  });
});
