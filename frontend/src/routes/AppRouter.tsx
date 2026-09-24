import { Navigate, Route, Routes } from "react-router-dom";

import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import HomePage from "../pages/HomePage";
import SeguridadPage from "../pages/administracion/SeguridadPage";
import DashboardEjecutivoPage from "../pages/reportes/DashboardEjecutivoPage";
import FlujoValidezLegalPage from "../pages/flujos/FlujoValidezLegalPage";
import PasarelaFirmaPage from "../pages/flujos/PasarelaFirmaPage";
import WorkflowAcademicoPage from "../pages/flujos/WorkflowAcademicoPage";
import ValidadorPublicoCvdPage from "../pages/validador/ValidadorPublicoCvdPage";
import LoginPage from "../pages/LoginPage";
import CasillaElectronicaPage from "../pages/casilla/CasillaElectronicaPage";
import RegistroCiudadanoPage from "../pages/registro/RegistroCiudadanoPage";
import BandejaExpedientesPage from "../pages/expedientes/BandejaExpedientesPage";
import ExpedienteDetallePage from "../pages/expedientes/ExpedienteDetallePage";
import MesaPartesVirtualPage from "../pages/tramite/MesaPartesVirtualPage";
import VentanillaPresencialPage from "../pages/tramite/VentanillaPresencialPage";
import TramitePage from "../pages/tramite/TramitePage";
import ProyectorResolucionesPage from "../pages/flujos/ProyectorResolucionesPage";
import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

      <Route path="/casilla" element={<CasillaElectronicaPage />} />
      <Route
        path="/casilla-electronica"
        element={<CasillaElectronicaPage />}
      />
      <Route path="/registro" element={<RegistroCiudadanoPage />} />

      <Route path="/tramite" element={<TramitePage />} />
      <Route
        path="/tramite/mesa-partes-virtual"
        element={<MesaPartesVirtualPage />}
      />
      <Route
        path="/tramite/mesa-partes"
        element={<Navigate to="/tramite/mesa-partes-virtual" replace />}
      />
      <Route
        path="/mesa-partes"
        element={<MesaPartesVirtualPage />}
      />
      <Route
        path="/tramite/ventanilla-presencial"
        element={<VentanillaPresencialPage />}
      />
      <Route
        path="/ventanilla"
        element={<VentanillaPresencialPage />}
      />
      <Route path="/administracion/seguridad" element={<SeguridadPage />} />
      <Route path="/flujo-validez-legal" element={<FlujoValidezLegalPage />} />
      <Route path="/flujos/titulacion" element={<WorkflowAcademicoPage />} />
      <Route
        path="/flujos/proyector-resoluciones"
        element={<ProyectorResolucionesPage />}
      />
      <Route
        path="/flujo-validez-legal/firma"
        element={<PasarelaFirmaPage />}
      />
      <Route path="/validador-cvd" element={<ValidadorPublicoCvdPage />} />


      <Route
        path="/administracion"
        element={
          <ProtectedRoute
            requiredModule="Administración"
            requiredAction="ver"
          />
        }
      >
        {AdminRoutes()}
      </Route>
      <Route
        path="/admin"
        element={<Navigate to="/administracion" replace />}
      />

      <Route path="/expedientes" element={<BandejaExpedientesPage />} />
      <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />

      <Route path="/reportes" element={<DashboardEjecutivoPage />} />
      <Route path="/reportes/dashboard" element={<DashboardEjecutivoPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}