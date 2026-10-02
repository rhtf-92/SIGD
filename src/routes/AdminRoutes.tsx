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

export default function AdminRoutes() {
  return (
    <>
      <Route index element={<AdministracionPage />} />
      <Route path="usuarios" element={<UsuariosPage />} />
      <Route path="roles-permisos" element={<RolesPermisosPage />} />
      <Route path="auditoria" element={<AuditoriaPage />} />
      <Route path="tablas-maestras" element={<TablasMaestrasPage />} />
      <Route path="calendario-laboral" element={<CalendarioLaboralPage />} />
      <Route path="seguridad" element={<SeguridadPage />} />
    </>
  );
}