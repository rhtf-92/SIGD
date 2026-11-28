import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RolesPermisosDirectorioPage from "./RolesPermisosDirectorioPage";
import * as adminService from "../../services/adminDirectorioService";

vi.mock("../../components/administracion/AdminPageHeader", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <header data-testid="admin-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock("../../services/adminDirectorioService", () => ({
  listarRolesDirectorio: vi.fn(),
  listarPermisosDirectorio: vi.fn(),
  obtenerPermisosDeRol: vi.fn(),
  guardarPermisosDeRol: vi.fn(),
  actualizarRolDirectorio: vi.fn(),
  mensajeDeError: vi.fn((e: unknown) => (e instanceof Error ? e.message : "Error simulado")),
}));

const mockRoles: adminService.RolDirectorio[] = [
  {
    rolId: "rol-admin",
    codigo: "ADMINISTRADOR",
    nombre: "Administrador del Sistema",
    descripcion: "Control total",
    vigente: true,
    totalPermisos: 21,
  },
  {
    rolId: "rol-director",
    codigo: "DIRECTOR",
    nombre: "Director",
    descripcion: "Despacho directoral",
    vigente: true,
    totalPermisos: 12,
  },
  {
    rolId: "rol-ciudadano",
    codigo: "CIUDADANO",
    nombre: "Ciudadano",
    descripcion: "Administrado",
    vigente: true,
    totalPermisos: 3,
  },
];

const mockPermisos: adminService.PermisoDirectorio[] = [
  {
    permisoId: "p-ventanilla",
    codigo: "VENTANILLA_RADICAR",
    nombre: "Radicar trámites en ventanilla",
    ambito: "GLOBAL",
  },
  {
    permisoId: "p-exp-leer",
    codigo: "EXPEDIENTE_LEER",
    nombre: "Consultar y leer expedientes",
    ambito: "GLOBAL",
  },
  {
    permisoId: "p-exp-derivar",
    codigo: "EXPEDIENTE_DERIVAR",
    nombre: "Derivar expedientes y pases",
    ambito: "AREA",
  },
  {
    permisoId: "p-firma",
    codigo: "FIRMA_FIRMAR",
    nombre: "Firmar digitalmente documentos",
    ambito: "GLOBAL",
  },
  {
    permisoId: "p-casilla-leer",
    codigo: "CASILLA_LEER",
    nombre: "Consultar notificaciones en casilla",
    ambito: "GLOBAL",
  },
  {
    permisoId: "p-admin-usr",
    codigo: "ADMIN_USUARIOS",
    nombre: "Administrar usuarios y accesos",
    ambito: "GLOBAL",
  },
  {
    permisoId: "p-rep-leer",
    codigo: "REPORTE_LEER",
    nombre: "Consultar reportes MGD",
    ambito: "GLOBAL",
  },
];

describe("RolesPermisosDirectorioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminService.listarRolesDirectorio).mockResolvedValue(mockRoles);
    vi.mocked(adminService.listarPermisosDirectorio).mockResolvedValue(mockPermisos);
    vi.mocked(adminService.obtenerPermisosDeRol).mockResolvedValue(["p-exp-leer", "p-firma"]);
    vi.mocked(adminService.guardarPermisosDeRol).mockResolvedValue(["p-exp-leer", "p-firma", "p-ventanilla"]);
    vi.mocked(adminService.actualizarRolDirectorio).mockResolvedValue(mockRoles[0]!);
  });

  it("renderiza la lista de roles del sistema y la matriz con sus permisos", async () => {
    render(<RolesPermisosDirectorioPage />);

    expect(screen.getByText(/Cargando directorio de permisos y roles/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("Administrador del Sistema").length).toBeGreaterThan(0);
      expect(screen.getByText("Director")).toBeInTheDocument();
      expect(screen.getByText("Ciudadano")).toBeInTheDocument();
    });

    expect(screen.getByText("Radicar trámites en ventanilla")).toBeInTheDocument();
    expect(screen.getByText("Consultar y leer expedientes")).toBeInTheDocument();
  });

  it("permite alternar un permiso individual mediante checkbox", async () => {
    const user = userEvent.setup();
    render(<RolesPermisosDirectorioPage />);

    await waitFor(() => {
      expect(screen.getByText("Radicar trámites en ventanilla")).toBeInTheDocument();
    });

    const checkboxVentanilla = screen.getByRole("checkbox", {
      name: /Radicar trámites en ventanilla/i,
    });
    expect(checkboxVentanilla).not.toBeChecked();

    await user.click(checkboxVentanilla);
    expect(checkboxVentanilla).toBeChecked();
  });

  it("permite marcar todos y desmarcar todos los permisos", async () => {
    const user = userEvent.setup();
    render(<RolesPermisosDirectorioPage />);

    await waitFor(() => {
      expect(screen.getByText("Radicar trámites en ventanilla")).toBeInTheDocument();
    });

    const btnTodos = screen.getByRole("button", { name: /Todos/i });
    await user.click(btnTodos);

    const checkboxes = screen.getAllByRole("checkbox");
    for (const cb of checkboxes) {
      expect(cb).toBeChecked();
    }

    const btnNinguno = screen.getByRole("button", { name: /Ninguno/i });
    await user.click(btnNinguno);

    for (const cb of checkboxes) {
      expect(cb).not.toBeChecked();
    }
  });

  it("permite cargar la plantilla recomendada oficial para el rol", async () => {
    const user = userEvent.setup();
    render(<RolesPermisosDirectorioPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Administrador del Sistema").length).toBeGreaterThan(0);
    });

    const btnPlantilla = screen.getByRole("button", { name: /Cargar plantilla recomendada/i });
    await user.click(btnPlantilla);

    expect(
      screen.getByText(/Plantilla institucional aplicada para el rol "Administrador del Sistema"/i),
    ).toBeInTheDocument();
  });

  it("guarda los permisos seleccionados mediante la API", async () => {
    const user = userEvent.setup();
    render(<RolesPermisosDirectorioPage />);

    await waitFor(() => {
      expect(screen.getByText("Radicar trámites en ventanilla")).toBeInTheDocument();
    });

    const btnGuardar = screen.getByRole("button", { name: /Guardar permisos/i });
    await user.click(btnGuardar);

    expect(adminService.guardarPermisosDeRol).toHaveBeenCalledWith(
      "rol-admin",
      expect.arrayContaining(["p-exp-leer", "p-firma"]),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Permisos guardados y sincronizados exitosamente en la base de datos/i),
      ).toBeInTheDocument();
    });
  });

  it("filtra permisos por texto de búsqueda", async () => {
    const user = userEvent.setup();
    render(<RolesPermisosDirectorioPage />);

    await waitFor(() => {
      expect(screen.getByText("Radicar trámites en ventanilla")).toBeInTheDocument();
    });

    const inputBusqueda = screen.getByPlaceholderText(/Buscar por código o nombre/i);
    await user.type(inputBusqueda, "VENTANILLA");

    expect(screen.getByText("Radicar trámites en ventanilla")).toBeInTheDocument();
    expect(screen.queryByText("Firmar digitalmente documentos")).not.toBeInTheDocument();
  });
});
