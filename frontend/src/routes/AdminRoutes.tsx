// Subrutas del Hub de Administración (ENT-M05-01)
// Se anidan bajo el path "/administracion" protegido en AppRouter.tsx
import { Route } from "react-router-dom";

import AdministracionPage from "../pages/administracion/AdministracionPage";
import AuditoriaPage from "../pages/administracion/AuditoriaPage";
import CalendarioLaboralPage from "../pages/administracion/CalendarioLaboralPage";
import RolesPermisosPage from "../pages/administracion/RolesPermisosPage";
import SeguridadPage from "../pages/administracion/SeguridadPage";
import TablasMaestrasPage from "../pages/administracion/TablasMaestrasPage";
import UsuariosPage from "../pages/administracion/UsuariosPage";
import ProtectedRoute from "./ProtectedRoute";

export default function AdminRoutes() {
  return (
    <>
      <Route index element={<AdministracionPage />} />
      {/* DoD ENT-M05-02: el directorio de personal solo es accesible para
          SUPER_ADMIN y DIRECTOR mediante guarda de ruta activa. */}
      <Route
        path="usuarios"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR"]}
            requiredModule="Administración"
            requiredAction="editar"
          >
            <UsuariosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="roles-permisos"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN"]}
            requiredModule="Administración"
            requiredAction="editar"
          >
            <RolesPermisosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="auditoria"
        element={
          <ProtectedRoute requiredRoles={["SUPER_ADMIN", "DIRECTOR"]}>
            <AuditoriaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="tablas-maestras"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN"]}
            requiredModule="Administración"
            requiredAction="editar"
          >
            <TablasMaestrasPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="calendario-laboral"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN"]}
            requiredModule="Administración"
            requiredAction="editar"
          >
            <CalendarioLaboralPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="seguridad"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN"]}
            requiredModule="Administración"
            requiredAction="editar"
          >
            <SeguridadPage />
          </ProtectedRoute>
        }
      />
    </>
  );
}