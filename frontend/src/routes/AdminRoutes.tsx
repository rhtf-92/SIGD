// Subrutas del Hub de Administracion (ENT-M05-01)
// Se anidan bajo el path "/administracion" protegido en AppRouter.tsx
import { Route } from "react-router-dom";

import AdministracionPage from "../pages/administracion/AdministracionPage";
import AuditoriaPage from "../pages/administracion/AuditoriaPage";
import CalendarioLaboralPage from "../pages/administracion/CalendarioLaboralPage";
import RolesPermisosDirectorioPage from "../pages/administracion/RolesPermisosDirectorioPage";
import SeguridadPage from "../pages/administracion/SeguridadPage";
import TablasMaestrasPage from "../pages/administracion/TablasMaestrasPage";
import UsuariosDirectorioPage from "../pages/administracion/UsuariosDirectorioPage";
import ProtectedRoute from "./ProtectedRoute";

export default function AdminRoutes() {
  return (
    <>
      <Route index element={<AdministracionPage />} />
      {/* Usuarios, roles y permisos: solo el rol ADMINISTRADOR (el backend responde 403 a otros). */}
      <Route
        path="usuarios"
        element={
          <ProtectedRoute requiredRoles={["ADMINISTRADOR"]}>
            <UsuariosDirectorioPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="roles-permisos"
        element={
          <ProtectedRoute requiredRoles={["ADMINISTRADOR"]}>
            <RolesPermisosDirectorioPage />
          </ProtectedRoute>
        }
      />
      <Route path="auditoria" element={<AuditoriaPage />} />
      <Route path="tablas-maestras" element={<TablasMaestrasPage />} />
      <Route path="calendario-laboral" element={<CalendarioLaboralPage />} />
      <Route path="seguridad" element={<SeguridadPage />} />
    </>
  );
}