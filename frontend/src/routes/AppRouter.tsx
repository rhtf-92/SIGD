import { Navigate, Route, Routes } from "react-router-dom";

import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import HomePage from "../pages/HomePage";

import DashboardEjecutivoPage from "../pages/DashboardEjecutivoPage";
import FlujoValidezLegalPage from "../pages/flujos/FlujoValidezLegalPage";
import CalendarizacionInstitucionalPage from "../pages/administracion/CalendarizacionInstitucionalPage";
import ValidadorPublicoCvdPage from "../pages/validador/ValidadorPublicoCvdPage";
import LoginPage from "../pages/LoginPage";
import CasillaElectronicaPage from "../pages/casilla/CasillaElectronicaPage";
import RegistroCiudadanoPage from "../pages/registro/RegistroCiudadanoPage";
import BandejaExpedientesPage from "../pages/expedientes/BandejaExpedientesPage";
import ExpedienteDetallePage from "../pages/expedientes/ExpedienteDetallePage";
import VentanillaPresencialPage from "../pages/tramite/VentanillaPresencialPage";
import TramitePage from "../pages/tramite/TramitePage";
import ConsultaPublicaPage from "../pages/tramite/ConsultaPublicaPage";
import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

      <Route path="/consulta" element={<ConsultaPublicaPage />} />
      <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />

      <Route path="/casilla" element={<ProtectedRoute><CasillaElectronicaPage /></ProtectedRoute>} />
      <Route
        path="/casilla-electronica"
        element={<ProtectedRoute><CasillaElectronicaPage /></ProtectedRoute>}
      />
      <Route path="/registro" element={<RegistroCiudadanoPage />} />

      <Route path="/tramite" element={<ProtectedRoute><TramitePage /></ProtectedRoute>} />
      <Route
        path="/tramite/mesa-partes-virtual"
        element={<Navigate to="/tramite" replace />}
      />
      <Route
        path="/tramite/mesa-partes"
        element={<Navigate to="/tramite/mesa-partes-virtual" replace />}
      />
      <Route
        path="/mesa-partes"
        element={<Navigate to="/tramite" replace />}
      />
      <Route
        path="/tramite/ventanilla-presencial"
        element={<ProtectedRoute requiredRoles={["MESA_PARTES", "ADMINISTRADOR"]}><VentanillaPresencialPage /></ProtectedRoute>}
      />
      <Route
        path="/ventanilla"
        element={<ProtectedRoute requiredRoles={["MESA_PARTES", "ADMINISTRADOR"]}><VentanillaPresencialPage /></ProtectedRoute>}
      />
      <Route path="/flujo-validez-legal" element={<FlujoValidezLegalPage />} />
      <Route path="/validador-cvd" element={<ValidadorPublicoCvdPage />} />
      <Route path="/calendarizacion-institucional" element={<ProtectedRoute requiredRoles={["ADMINISTRADOR"]}><CalendarizacionInstitucionalPage /></ProtectedRoute>} />
      <Route path="/institucional/calendarizacion" element={<ProtectedRoute requiredRoles={["ADMINISTRADOR"]}><CalendarizacionInstitucionalPage /></ProtectedRoute>} />


      <Route
        path="/administracion"
        element={
          <ProtectedRoute requiredRoles={["ADMINISTRADOR"]} />
        }
      >
        {AdminRoutes()}
      </Route>
      <Route
        path="/admin"
        element={<Navigate to="/administracion" replace />}
      />

      <Route path="/expedientes" element={<ProtectedRoute><BandejaExpedientesPage /></ProtectedRoute>} />
      <Route path="/expedientes/:id" element={<ProtectedRoute><ExpedienteDetallePage /></ProtectedRoute>} />

      <Route path="/reportes" element={<ProtectedRoute requiredRoles={["DIRECTOR", "ADMINISTRADOR"]}><DashboardEjecutivoPage /></ProtectedRoute>} />
      <Route path="/reportes/dashboard" element={<ProtectedRoute requiredRoles={["DIRECTOR", "ADMINISTRADOR"]}><DashboardEjecutivoPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}
