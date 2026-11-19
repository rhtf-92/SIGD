import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RolesPermisosPage from '../../../src/pages/administracion/RolesPermisosPage';
import { apiClient } from '../../../src/api/client';

vi.mock('../../../src/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const mockConfig = {
  roles: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      codigo: 'ADMINISTRADOR',
      nombre: 'Administrador del Sistema',
      descripcion: 'Gestión institucional',
      vigente: true,
      usuarios: 2,
      permisos: ['ADMIN_USUARIOS', 'EXPEDIENTE_LEER'],
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      codigo: 'CIUDADANO',
      nombre: 'Ciudadano',
      descripcion: 'Administrado externo',
      vigente: true,
      usuarios: 12,
      permisos: ['EXPEDIENTE_LEER'],
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      codigo: 'ESPECIALISTA',
      nombre: 'Especialista',
      descripcion: 'Atención técnica',
      vigente: true,
      usuarios: 2,
      permisos: ['EXPEDIENTE_DERIVAR'],
    },
  ],
  catalogoPermisos: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      codigo: 'ADMIN_USUARIOS',
      nombre: 'Administrar usuarios y roles',
      ambito: 'GLOBAL' as const,
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      codigo: 'EXPEDIENTE_LEER',
      nombre: 'Leer expedientes',
      ambito: 'GLOBAL' as const,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      codigo: 'EXPEDIENTE_DERIVAR',
      nombre: 'Derivar expedientes',
      ambito: 'AREA' as const,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

describe('Frontend: Seguridad y Protecciones en RolesPermisosPage', () => {
  it('1. Identifica al rol CIUDADANO con insignia EXTERNO y Solo lectura en la lista', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockConfig });
    render(
      <MemoryRouter>
        <RolesPermisosPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Consultando roles/i)).toBeNull();
    });

    expect(screen.getByText('EXTERNO')).toBeDefined();
    expect(screen.getByText('Solo lectura · Inmutable')).toBeDefined();
  });

  it('2. Bloquea edición y guardado cuando se selecciona el rol CIUDADANO', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockConfig });
    render(
      <MemoryRouter>
        <RolesPermisosPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Consultando roles/i)).toBeNull();
    });

    // Seleccionar Ciudadano
    const btnCiudadano = screen.getByRole('button', { name: /Ciudadano/i });
    fireEvent.click(btnCiudadano);

    // Debe mostrar la insignia de rol externo y banner explicativo
    expect(screen.getByText(/ROL EXTERNO · SOLO LECTURA/i)).toBeDefined();
    expect(screen.getByText(/Rol de Servicios Externos — Solo Lectura/i)).toBeDefined();
    expect(screen.getByText(/Sus permisos son inmutables/i)).toBeDefined();

    // Los checkboxes deben estar deshabilitados
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    for (const chk of checkboxes) {
      expect(chk.disabled).toBe(true);
    }

    // El botón de guardado debe estar deshabilitado
    const btnGuardar = screen.getByRole('button', { name: /Rol de solo lectura/i }) as HTMLButtonElement;
    expect(btnGuardar.disabled).toBe(true);
  });

  it('3. Protege ADMIN_USUARIOS contra desmarcado en el rol ADMINISTRADOR', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockConfig });
    render(
      <MemoryRouter>
        <RolesPermisosPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Consultando roles/i)).toBeNull();
    });

    // Administrador es el primer rol seleccionado por defecto
    expect(screen.getByText(/PERFIL MAESTRO/i)).toBeDefined();
    expect(screen.getByText(/Protección contra Autobloqueo/i)).toBeDefined();

    // Checkbox de ADMIN_USUARIOS debe estar marcado y deshabilitado para evitar autobloqueo
    const chkAdmin = screen.getByLabelText('ADMIN_USUARIOS / GLOBAL') as HTMLInputElement;
    expect(chkAdmin.checked).toBe(true);
    expect(chkAdmin.disabled).toBe(true);

    // Checkbox de EXPEDIENTE_LEER debe estar habilitado
    const chkLeer = screen.getByLabelText('EXPEDIENTE_LEER / GLOBAL') as HTMLInputElement;
    expect(chkLeer.disabled).toBe(false);
  });

  it('4. Muestra mensajes institucionales de error cuando el servidor rechaza una operación', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockConfig });
    vi.mocked(apiClient.put).mockRejectedValue({
      response: {
        status: 422,
        data: {
          message: 'El rol Administrador debe conservar obligatoriamente el permiso ADMIN_USUARIOS para prevenir el autobloqueo del sistema.',
        },
      },
    });

    render(
      <MemoryRouter>
        <RolesPermisosPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Consultando roles/i)).toBeNull();
    });

    // Guardar permisos en Administrador
    const btnGuardar = screen.getByRole('button', { name: /Guardar permisos/i });
    fireEvent.click(btnGuardar);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    expect(
      screen.getByText(/El rol Administrador debe conservar obligatoriamente el permiso ADMIN_USUARIOS/i)
    ).toBeDefined();
  });

  it('5. Filtra el catálogo de roles reactivamente mediante el buscador', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockConfig });
    render(
      <MemoryRouter>
        <RolesPermisosPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Consultando roles/i)).toBeNull();
    });

    const inputBusqueda = screen.getByPlaceholderText(/Buscar rol por nombre o código/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Especialista' } });

    // El aside debe contener únicamente Especialista
    const aside = screen.getByRole('complementary');
    expect(within(aside).getByText('Especialista')).toBeDefined();
    expect(screen.getByText('1 de 3 roles encontrados')).toBeDefined();

    // Administrador y Ciudadano no deben aparecer en la lista filtrada del aside
    expect(within(aside).queryByText('Administrador del Sistema')).toBeNull();
    expect(within(aside).queryByText('Ciudadano')).toBeNull();

    // Limpiar búsqueda
    const btnLimpiar = screen.getByRole('button', { name: /Limpiar búsqueda/i });
    fireEvent.click(btnLimpiar);

    expect(within(aside).getByText('Administrador del Sistema')).toBeDefined();
    expect(within(aside).getByText('Ciudadano')).toBeDefined();
  });

  it('6. Permite alternar la expansión de módulos de permisos y expandir/contraer todos', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockConfig });
    render(
      <MemoryRouter>
        <RolesPermisosPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Consultando roles/i)).toBeNull();
    });

    // Módulo Administración y Trámite Documentario tienen permisos asignados en Administrador
    expect(screen.getByText(/Matriz de Permisos por Módulo/i)).toBeDefined();

    // Botón expandir/contraer todos
    const btnExpandirTodos = screen.getByRole('button', { name: /Expandir todos|Contraer todos/i });
    expect(btnExpandirTodos).toBeDefined();

    // Cabecera del módulo Administración
    const btnModuloAdmin = screen.getByRole('button', { name: /Administración/i });
    expect(btnModuloAdmin.getAttribute('aria-expanded')).toBe('true');

    // Al hacer clic, se contrae
    fireEvent.click(btnModuloAdmin);
    expect(btnModuloAdmin.getAttribute('aria-expanded')).toBe('false');

    // Al hacer clic de nuevo, se expande
    fireEvent.click(btnModuloAdmin);
    expect(btnModuloAdmin.getAttribute('aria-expanded')).toBe('true');
  });

  it('7. Detecta modificaciones pendientes y permite revertirlas con Descartar cambios', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockConfig });
    render(
      <MemoryRouter>
        <RolesPermisosPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Consultando roles/i)).toBeNull();
    });

    // Inicialmente no hay cambios pendientes
    expect(screen.getByText(/Sincronizado/i)).toBeDefined();
    const btnDescartar = screen.getByRole('button', { name: /Descartar cambios/i }) as HTMLButtonElement;
    expect(btnDescartar.disabled).toBe(true);

    // Modificar un permiso habilitado: desmarcar EXPEDIENTE_LEER
    const chkLeer = screen.getByLabelText('EXPEDIENTE_LEER / GLOBAL') as HTMLInputElement;
    expect(chkLeer.checked).toBe(true);
    fireEvent.click(chkLeer);
    expect(chkLeer.checked).toBe(false);

    // Debe mostrar indicador de cambios pendientes y habilitar botón Descartar
    expect(screen.getByText(/Modificaciones pendientes de guardar/i)).toBeDefined();
    expect(btnDescartar.disabled).toBe(false);

    // Revertir con Descartar cambios
    fireEvent.click(btnDescartar);

    // Permiso debe volver a estar marcado y el estado vuelve a sincronizado
    expect(chkLeer.checked).toBe(true);
    expect(screen.getByText(/Sincronizado/i)).toBeDefined();
    expect(btnDescartar.disabled).toBe(true);
  });

  it('8. Incorpora altura compartida y desplazamiento vertical independiente en ambos paneles', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockConfig });
    const { container } = render(
      <MemoryRouter>
        <RolesPermisosPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Consultando roles/i)).toBeNull();
    });

    // Contenedor principal con altura compartida
    const gridContenedor = container.querySelector('.lg\\:h-\\[calc\\(100vh-210px\\)\\]');
    expect(gridContenedor).toBeDefined();
    expect(gridContenedor?.className).toContain('items-stretch');

    // Contenedor de la matriz de permisos debe tener desplazamiento independiente y flex-1
    const contenedorScrollMatriz = container.querySelector('.lg\\:overflow-y-auto');
    expect(contenedorScrollMatriz).toBeDefined();
    expect(contenedorScrollMatriz?.className).toContain('overflow-x-hidden');
    expect(contenedorScrollMatriz?.className).toContain('flex-1');
  });
});
