import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CrearUsuarioModal from "@/components/administracion/CrearUsuarioModal";
import type { RolInstitucional, PermisoInstitucional } from "@/hooks/useRbacConfig";

const areasMock = [
  { id: "area-1", nombre: "Dirección General" },
  { id: "area-2", nombre: "Mesa de Partes" },
];

const cargosMock = [
  { id: "cargo-1", nombre: "Director General" },
  { id: "cargo-2", nombre: "Operador Mesa de Partes" },
];

const tiposDocMock = [
  { id: "1", codigo: "DNI", nombre: "Documento Nacional de Identidad" },
  { id: "2", codigo: "CE", nombre: "Carné de Extranjería" },
  { id: "3", codigo: "RUC", nombre: "Registro Único de Contribuyentes" },
];

const rolesCatalogoMock: RolInstitucional[] = [
  {
    id: "rol-admin",
    codigo: "ADMINISTRADOR",
    nombre: "Administrador del Sistema",
    descripcion: "Administración técnica y seguridad",
    vigente: true,
    usuarios: 1,
    permisos: ["ADMIN_USUARIOS"],
  },
  {
    id: "rol-dir",
    codigo: "DIRECTOR_GENERAL",
    nombre: "Director General",
    descripcion: "Dirección institucional",
    vigente: true,
    usuarios: 1,
    permisos: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_RESOLVER", "FIRMA_FIRMAR"],
  },
  {
    id: "rol-esp",
    codigo: "ESPECIALISTA",
    nombre: "Especialista de Área",
    descripcion: "Atención técnica de trámites",
    vigente: true,
    usuarios: 3,
    permisos: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER", "EXPEDIENTE_RESOLVER"],
  },
  {
    id: "rol-sec",
    codigo: "SECRETARIA",
    nombre: "Secretaria de Área",
    descripcion: "Recepción y derivación",
    vigente: true,
    usuarios: 2,
    permisos: ["EXPEDIENTE_DERIVAR", "EXPEDIENTE_LEER"],
  },
  {
    id: "rol-ciu",
    codigo: "CIUDADANO",
    nombre: "Ciudadano",
    descripcion: "Administrados externos",
    vigente: true,
    usuarios: 10,
    permisos: [],
  },
  {
    id: "rol-est",
    codigo: "ESTUDIANTE",
    nombre: "Estudiante",
    descripcion: "Alumnos externos",
    vigente: true,
    usuarios: 5,
    permisos: [],
  },
];

const permisosCatalogoMock: PermisoInstitucional[] = [
  {
    id: "perm-1",
    codigo: "ADMIN_USUARIOS",
    nombre: "Administración de Usuarios",
    ambito: "GLOBAL",
    modulo: "Administración",
    descripcion: "Administración integral de cuentas de usuario y roles.",
  },
  {
    id: "perm-2",
    codigo: "EXPEDIENTE_DERIVAR",
    nombre: "Derivación de Expedientes",
    ambito: "AREA",
    modulo: "Trámite Documentario y RutaDoc",
    descripcion: "Derivación y pase de expedientes.",
  },
  {
    id: "perm-3",
    codigo: "EXPEDIENTE_LEER",
    nombre: "Lectura de Expedientes",
    ambito: "AREA",
    modulo: "Trámite Documentario y RutaDoc",
    descripcion: "Consulta y lectura de expedientes del área.",
  },
  {
    id: "perm-4",
    codigo: "EXPEDIENTE_RESOLVER",
    nombre: "Resolución de Expedientes",
    ambito: "AREA",
    modulo: "Trámite Documentario y RutaDoc",
    descripcion: "Emisión de dictamen o resolución sobre expedientes.",
  },
  {
    id: "perm-5",
    codigo: "FIRMA_FIRMAR",
    nombre: "Firma Digital",
    ambito: "GLOBAL",
    modulo: "Gestión Documentaria",
    descripcion: "Emisión y firmado digital con validez legal.",
  },
];

describe("CrearUsuarioModal — Asignación integrada de roles en el registro", () => {
  it("muestra las 4 secciones definitivas y el banner de Configuración de Acceso Institucional", () => {
    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    // 4 secciones requeridas
    expect(screen.getByText("SECCIÓN 1. DATOS DEL TRABAJADOR")).toBeInTheDocument();
    expect(screen.getByText("SECCIÓN 2. VINCULACIÓN INSTITUCIONAL")).toBeInTheDocument();
    expect(screen.getByText("SECCIÓN 3. ASIGNACIÓN DE ROLES Y PERMISOS")).toBeInTheDocument();
    expect(screen.getByText("SECCIÓN 4. CREDENCIALES INICIALES DE ACCESO")).toBeInTheDocument();

    // Banner informativo oficial
    expect(screen.getByText("CONFIGURACIÓN DE ACCESO INSTITUCIONAL")).toBeInTheDocument();
    expect(screen.getByText(/La cuenta se registrará inicialmente como/i)).toBeInTheDocument();
    expect(screen.getByText(/un administrador autorizado podrá habilitar su acceso al SIGD/i)).toBeInTheDocument();
  });

  it("restringe el tipo de documento exclusivamente a DNI para personal interno", () => {
    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const selectTipoDoc = screen.getByLabelText("Tipo de documento");
    expect(within(selectTipoDoc).getByRole("option", { name: /DNI/i })).toBeInTheDocument();
    expect(within(selectTipoDoc).queryByRole("option", { name: /Carné de Extranjería/i })).not.toBeInTheDocument();
    expect(within(selectTipoDoc).queryByRole("option", { name: /Registro Único/i })).not.toBeInTheDocument();
  });

  it("filtra roles externos (CIUDADANO, ESTUDIANTE) y muestra roles internos en el selector", () => {
    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const selectRoles = screen.getByLabelText("Roles institucionales disponibles");
    expect(within(selectRoles).getByRole("option", { name: /Director General/i })).toBeInTheDocument();
    expect(within(selectRoles).getByRole("option", { name: /Especialista de Área/i })).toBeInTheDocument();
    expect(within(selectRoles).getByRole("option", { name: /Secretaria de Área/i })).toBeInTheDocument();
    expect(within(selectRoles).getByRole("option", { name: /Administrador del Sistema/i })).toBeInTheDocument();

    // Roles externos no deben estar disponibles para trabajadores internos
    expect(within(selectRoles).queryByRole("option", { name: /Ciudadano/i })).not.toBeInTheDocument();
    expect(within(selectRoles).queryByRole("option", { name: /Estudiante/i })).not.toBeInTheDocument();
  });

  it("permite agregar múltiples roles y retirarlos de la selección", async () => {
    const user = userEvent.setup();

    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const selectRoles = screen.getByLabelText("Roles institucionales disponibles");
    const btnAgregar = screen.getByRole("button", { name: "Agregar rol" });

    // Seleccionar y agregar Especialista
    await user.selectOptions(selectRoles, "rol-esp");
    await user.click(btnAgregar);

    // Debe aparecer en roles seleccionados
    expect(screen.getByText("Roles seleccionados para el trabajador (1)")).toBeInTheDocument();
    expect(screen.getByText("Especialista de Área")).toBeInTheDocument();

    // Seleccionar y agregar Secretaria
    await user.selectOptions(selectRoles, "rol-sec");
    await user.click(btnAgregar);

    expect(screen.getByText("Roles seleccionados para el trabajador (2)")).toBeInTheDocument();
    expect(screen.getByText("Secretaria de Área")).toBeInTheDocument();

    // Retirar Secretaria
    const btnRetirarSec = screen.getByLabelText("Retirar rol Secretaria de Área");
    await user.click(btnRetirarSec);

    expect(screen.getByText("Roles seleccionados para el trabajador (1)")).toBeInTheDocument();
    expect(screen.queryByText("Secretaria de Área")).not.toBeInTheDocument();
    expect(screen.getByText("Especialista de Área")).toBeInTheDocument();
  });

  it("calcula y deduplica la vista previa de permisos de los roles seleccionados", async () => {
    const user = userEvent.setup();

    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    // Al inicio, 0 permisos
    expect(screen.getByText(/Vista previa de permisos efectivos \(0\)/i)).toBeInTheDocument();

    const selectRoles = screen.getByLabelText("Roles institucionales disponibles");
    const btnAgregar = screen.getByRole("button", { name: "Agregar rol" });

    // Especialista tiene DERIVAR, LEER, RESOLVER (3 permisos)
    await user.selectOptions(selectRoles, "rol-esp");
    await user.click(btnAgregar);

    expect(screen.getByText(/Vista previa de permisos efectivos \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText("Derivación de Expedientes")).toBeInTheDocument();
    expect(screen.getByText("Lectura de Expedientes")).toBeInTheDocument();
    expect(screen.getByText("Resolución de Expedientes")).toBeInTheDocument();

    // Secretaria comparte DERIVAR y LEER. Al agregarla, no debe duplicar permisos (siguen siendo 3)
    await user.selectOptions(selectRoles, "rol-sec");
    await user.click(btnAgregar);

    expect(screen.getByText(/Vista previa de permisos efectivos \(3\)/i)).toBeInTheDocument();

    // Director General agrega FIRMA_FIRMAR (sumando a 4 permisos deduplicados)
    await user.selectOptions(selectRoles, "rol-dir");
    await user.click(btnAgregar);

    expect(screen.getByText(/Vista previa de permisos efectivos \(4\)/i)).toBeInTheDocument();
    expect(screen.getByText("Firma Digital")).toBeInTheDocument();
  });

  it("indica que los permisos individuales no se modifican desde este formulario", () => {
    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Los permisos individuales se gestionan y configuran centralizadamente en el módulo independiente de/i),
    ).toBeInTheDocument();
  });

  it("permite alternar la visibilidad de la contraseña inicial", async () => {
    const user = userEvent.setup();

    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const inputPassword = screen.getByLabelText("Contraseña temporal");
    expect(inputPassword).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByLabelText("Ver contraseña");
    await user.click(toggleBtn);
    expect(inputPassword).toHaveAttribute("type", "text");

    const ocultarBtn = screen.getByLabelText("Ocultar contraseña");
    await user.click(ocultarBtn);
    expect(inputPassword).toHaveAttribute("type", "password");
  });

  it("impide el envío y muestra error si el DNI no tiene 8 dígitos", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const dniInput = screen.getByLabelText("DNI / documento");
    await user.type(dniInput, "1234");
    await user.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(screen.getByText("El DNI debe contener exactamente 8 dígitos numéricos.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("envía los datos del formulario junto con los roles seleccionados al ejecutar onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({});

    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("DNI / documento"), "87654321");
    await user.type(screen.getByLabelText("Nombres"), "Carlos");
    await user.type(screen.getByLabelText("Apellido paterno"), "Paredes");
    await user.type(screen.getByLabelText("Correo institucional"), "cparedes@iestpsuiza.edu.pe");
    await user.selectOptions(screen.getByLabelText("Unidad orgánica"), "area-2");
    await user.selectOptions(screen.getByLabelText("Cargo"), "cargo-2");

    // Seleccionar y agregar rol Especialista
    const selectRoles = screen.getByLabelText("Roles institucionales disponibles");
    await user.selectOptions(selectRoles, "rol-esp");
    await user.click(screen.getByRole("button", { name: "Agregar rol" }));

    await user.type(screen.getByLabelText("Nombre de usuario"), "cparedes");
    await user.type(screen.getByLabelText("Contraseña temporal"), "ClaveSegura2026!");

    await user.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoDocumentoId: 1,
        numeroDocumento: "87654321",
        nombres: "Carlos",
        apellidoPaterno: "Paredes",
        correo: "cparedes@iestpsuiza.edu.pe",
        username: "cparedes",
        passwordInicial: "ClaveSegura2026!",
        areaId: "area-2",
        cargoId: "cargo-2",
      }),
      ["rol-esp"],
    );
  });

  it("permite registrar usuario con correo personal (Gmail) y confirmación de contraseña", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({});

    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("DNI / documento"), "11223344");
    await user.type(screen.getByLabelText("Nombres"), "Tesorero");
    await user.type(screen.getByLabelText("Apellido paterno"), "Personal");
    await user.type(screen.getByLabelText("Correo institucional"), "tesorero.demo@gmail.com");
    await user.selectOptions(screen.getByLabelText("Unidad orgánica"), "area-1");
    await user.selectOptions(screen.getByLabelText("Cargo"), "cargo-1");

    await user.type(screen.getByLabelText("Nombre de usuario"), "tesorero.personal");
    await user.type(screen.getByLabelText("Contraseña temporal"), "T3sorero#2026!");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "T3sorero#2026!");

    await user.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        correo: "tesorero.demo@gmail.com",
        username: "tesorero.personal",
        passwordInicial: "T3sorero#2026!",
      }),
      [],
    );
  });

  it("rechaza el formulario si la confirmación de contraseña no coincide", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <CrearUsuarioModal
        areas={areasMock}
        cargos={cargosMock}
        tiposDocumento={tiposDocMock}
        rolesCatalogo={rolesCatalogoMock}
        permisosCatalogo={permisosCatalogoMock}
        pending={false}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("DNI / documento"), "11223344");
    await user.type(screen.getByLabelText("Nombres"), "Tesorero");
    await user.type(screen.getByLabelText("Apellido paterno"), "Personal");
    await user.type(screen.getByLabelText("Correo institucional"), "tesorero.demo@gmail.com");
    await user.selectOptions(screen.getByLabelText("Unidad orgánica"), "area-1");
    await user.selectOptions(screen.getByLabelText("Cargo"), "cargo-1");

    await user.type(screen.getByLabelText("Nombre de usuario"), "tesorero.personal");
    await user.type(screen.getByLabelText("Contraseña temporal"), "T3sorero#2026!");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "Diferente#2026!");

    await user.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(screen.getByText("Las contraseñas no coinciden. Verifique la confirmación.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
