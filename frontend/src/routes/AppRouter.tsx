import { Route, Routes } from "react-router-dom";

import HomePage from "../pages/HomePage";
import AdministracionPage from "../pages/administracion/AdministracionPage";
import AuditoriaPage from "../pages/administracion/AuditoriaPage";
import CalendarioLaboralPage from "../pages/administracion/CalendarioLaboralPage";
import RolesPermisosPage from "../pages/administracion/RolesPermisosPage";
import SeguridadPage from "../pages/administracion/SeguridadPage";
import TablasMaestrasPage from "../pages/administracion/TablasMaestrasPage";
import UsuariosPage from "../pages/administracion/UsuariosPage";
import FlujoValidezLegalPage from "../pages/flujos/FlujoValidezLegalPage";
import PasarelaFirmaPage from "../pages/flujos/PasarelaFirmaPage";
import WorkflowAcademicoPage from "../pages/flujos/WorkflowAcademicoPage";
import ValidadorPublicoCvdPage from "../pages/validador/ValidadorPublicoCvdPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/administracion" element={<AdministracionPage />} />
      <Route path="/administracion/usuarios" element={<UsuariosPage />} />
      <Route
        path="/administracion/roles-permisos"
        element={<RolesPermisosPage />}
      />
      <Route path="/administracion/auditoria" element={<AuditoriaPage />} />
      <Route
        path="/administracion/tablas-maestras"
        element={<TablasMaestrasPage />}
      />
      <Route
        path="/administracion/calendario-laboral"
        element={<CalendarioLaboralPage />}
      />
      <Route path="/administracion/seguridad" element={<SeguridadPage />} />
      <Route path="/flujo-validez-legal" element={<FlujoValidezLegalPage />} />
      <Route path="/flujos/titulacion" element={<WorkflowAcademicoPage />} />
      <Route
        path="/flujo-validez-legal/firma"
        element={<PasarelaFirmaPage />}
      />
      <Route path="/validador-cvd" element={<ValidadorPublicoCvdPage />} />
    </Routes>
  );
}
