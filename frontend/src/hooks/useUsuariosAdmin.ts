// Hook de administración del Directorio de Usuarios (ENT-M05-02)
import { useMemo, useState } from "react";

import type { EstadoUsuario, Usuario } from "../types/usuarioAdmin";

export const CATALOGO_ROLES_USUARIOS = [
  "Administrador",
  "Responsable de Área",
  "Operador",
  "Consulta",
];

export const CATALOGO_AREAS = [
  "Dirección General",
  "Secretaría Académica",
  "Mesa de Partes",
  "Administración",
  "Archivo Central",
  "Coordinación DSI",
];

export const CATALOGO_SEDES = ["Sede Principal"];

const usuariosIniciales: Usuario[] = [
  {
    id: 1,
    nombre: "Juan Carlos Pérez",
    dni: "71234567",
    correo: "jperez@institutosuiza.edu.pe",
    sede: "Sede Principal",
    area: "Mesa de Partes",
    cargo: "Asistente Administrativo",
    rol: "Operador",
    estado: "Activo",
    ultimoAcceso: "29/08/2026 09:42",
  },
  {
    id: 2,
    nombre: "María Fernanda López",
    dni: "74561238",
    correo: "mlopez@institutosuiza.edu.pe",
    sede: "Sede Principal",
    area: "Secretaría Académica",
    cargo: "Secretaria Académica",
    rol: "Responsable de Área",
    estado: "Activo",
    ultimoAcceso: "29/08/2026 08:35",
  },
  {
    id: 3,
    nombre: "Luis Alberto Ramos",
    dni: "70124589",
    correo: "lramos@institutosuiza.edu.pe",
    sede: "Sede Principal",
    area: "Archivo Central",
    cargo: "Encargado de Archivo",
    rol: "Consulta",
    estado: "Inactivo",
    ultimoAcceso: "25/08/2026 16:20",
  },
  {
    id: 4,
    nombre: "Ana Torres García",
    dni: "73654821",
    correo: "atorres@institutosuiza.edu.pe",
    sede: "Sede Principal",
    area: "Administración",
    cargo: "Administradora",
    rol: "Administrador",
    estado: "Bloqueado",
    ultimoAcceso: "28/08/2026 14:12",
  },
];

function siguienteEstado(estado: EstadoUsuario): EstadoUsuario {
  if (estado === "Activo") return "Inactivo";
  if (estado === "Inactivo") return "Bloqueado";
  return "Activo";
}

export function useUsuariosAdmin() {
  const [usuarios, setUsuarios] = useState(usuariosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoUsuario | "Todos">("Todos");
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [mensaje, setMensaje] = useState("");

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      const coincideBusqueda =
        texto === "" ||
        usuario.nombre.toLowerCase().includes(texto) ||
        usuario.dni.includes(texto) ||
        usuario.correo.toLowerCase().includes(texto) ||
        usuario.area.toLowerCase().includes(texto);

      const coincideEstado = estado === "Todos" || usuario.estado === estado;
      return coincideBusqueda && coincideEstado;
    });
  }, [busqueda, estado, usuarios]);

  function actualizarUsuario(usuarioActualizado: Usuario) {
    setUsuarios((actuales) =>
      actuales.map((usuario) =>
        usuario.id === usuarioActualizado.id ? usuarioActualizado : usuario,
      ),
    );
    setMensaje("Cambios aplicados en la vista de demostración.");
    setUsuarioEditando(null);
  }

  function conmutarEstado(id: number) {
    setUsuarios((actuales) =>
      actuales.map((usuario) =>
        usuario.id === id
          ? { ...usuario, estado: siguienteEstado(usuario.estado) }
          : usuario,
      ),
    );
    setMensaje("");
  }

  return {
    usuarios: filtrados,
    totalUsuarios: usuarios.length,
    busqueda,
    setBusqueda,
    estado,
    setEstado,
    usuarioEditando,
    setUsuarioEditando,
    actualizarUsuario,
    conmutarEstado,
    mensaje,
    setMensaje,
  };
}