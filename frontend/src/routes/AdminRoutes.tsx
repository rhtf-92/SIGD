// Subrutas del Hub de Administración (ENT-M05-01)
// Se anidan bajo el path "/administracion" protegido en AppRouter.tsx
import { lazy } from "react";
import { Route } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

const AdministracionPage = lazy(
  () => import("../pages/administracion/AdministracionPage"),
);
const AuditoriaPage = lazy(
  () => import("../pages/administracion/AuditoriaPage"),
);
const CalendarioLaboralPage = lazy(
  () => import("../pages/administracion/CalendarioLaboralPage"),
);
const RolesPermisosPage = lazy(
  () => import("../pages/administracion/RolesPermisosPage"),
);
const SeguridadPage = lazy(
  () => import("../pages/administracion/SeguridadPage"),
);
const TablasMaestrasPage = lazy(
  () => import("../pages/administracion/TablasMaestrasPage"),
);
const UsuariosPage = lazy(
  () => import("../pages/administracion/UsuariosPage"),
);

export default function AdminRoutes() {
  return (
    <>
      <Route index element={<AdministracionPage />} />
      {/* DoD ENT-M05-02: el directorio de personal solo es accesible para
          ADMINISTRADOR y DIRECTOR mediante guarda de ruta activa. */}
      <Route
        path="usuarios"
        element={
          <ProtectedRoute
            requiredRoles={["ADMINISTRADOR", "SUPER_ADMIN", "DIRECTOR"]}
            requiredModule="Administración"
            requiredAction="editar"
          >
            <UsuariosPage />
          </ProtectedRoute>
        }
      />
      <Route path="roles-permisos" element={<ProtectedRoute requiredModule="Roles y Permisos"><RolesPermisosPage /></ProtectedRoute>} />
      <Route path="auditoria" element={<ProtectedRoute requiredModule="Auditoría"><AuditoriaPage /></ProtectedRoute>} />
      <Route path="tablas-maestras" element={<ProtectedRoute requiredModule="Tablas Maestras"><TablasMaestrasPage /></ProtectedRoute>} />
      <Route path="calendario-laboral" element={<ProtectedRoute requiredModule="Calendario Laboral"><CalendarioLaboralPage /></ProtectedRoute>} />
      <Route path="seguridad" element={<ProtectedRoute requiredModule="Seguridad"><SeguridadPage /></ProtectedRoute>} />
    </>
  );
}
