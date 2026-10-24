import { Navigate, Route, Routes } from "react-router-dom";

import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import HomePage from "../pages/HomePage";
import TransparenciaLegalPage from "../pages/transparencia/TransparenciaLegalPage";

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
import MisExpedientesPage from "../pages/tramite/MisExpedientesPage";
import ConsultaPublicaPage from "../pages/tramite/ConsultaPublicaPage";
import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";

const ROLES_INSTITUCIONALES_EXPEDIENTES = [
  "MESA_PARTES",
  "ESPECIALISTA",
  "SECRETARIO",
  "DIRECTOR",
  "ADMINISTRADOR",
] as const;

export default function AppRouter() {
  return (
    <Routes>
      {/* 1. Módulos Públicos (sin requerimiento de autenticación) */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />
      <Route path="/registro" element={<RegistroCiudadanoPage />} />
      <Route path="/consulta" element={<ConsultaPublicaPage />} />
      <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
      <Route path="/validador-cvd" element={<ValidadorPublicoCvdPage />} />
      <Route path="/flujo-validez-legal" element={<FlujoValidezLegalPage />} />
      <Route path="/transparencia" element={<TransparenciaLegalPage />} />
      <Route path="/transparencia/:seccion" element={<TransparenciaLegalPage />} />

      {/* 2. Módulos del Ciudadano Autenticado */}
      <Route
        path="/tramite"
        element={
          <ProtectedRoute requiredRoles={["CIUDADANO"]}>
            <TramitePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tramite/mesa-partes-virtual"
        element={<Navigate to="/tramite" replace />}
      />
      <Route
        path="/tramite/mesa-partes"
        element={<Navigate to="/tramite" replace />}
      />
      <Route
        path="/mesa-partes"
        element={<Navigate to="/tramite" replace />}
      />

      <Route
        path="/mis-expedientes"
        element={
          <ProtectedRoute requiredRoles={["CIUDADANO"]}>
            <MisExpedientesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/casilla"
        element={
          <ProtectedRoute requiredRoles={["CIUDADANO"]}>
            <CasillaElectronicaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/casilla-electronica"
        element={<Navigate to="/casilla" replace />}
      />

      {/* 3. Módulos de Mesa de Partes Institucional */}
      <Route
        path="/tramite/ventanilla-presencial"
        element={
          <ProtectedRoute requiredRoles={["MESA_PARTES", "ADMINISTRADOR"]}>
            <VentanillaPresencialPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ventanilla"
        element={<Navigate to="/tramite/ventanilla-presencial" replace />}
      />

      {/* 4. Bandeja y Detalle Institucional de Expedientes */}
      <Route
        path="/expedientes"
        element={
          <ProtectedRoute requiredRoles={ROLES_INSTITUCIONALES_EXPEDIENTES}>
            <BandejaExpedientesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expedientes/:id"
        element={
          <ProtectedRoute requiredRoles={ROLES_INSTITUCIONALES_EXPEDIENTES}>
            <ExpedienteDetallePage />
          </ProtectedRoute>
        }
      />

      {/* 5. Reportes y Tableros Directivos */}
      <Route
        path="/reportes"
        element={
          <ProtectedRoute requiredRoles={["DIRECTOR", "ADMINISTRADOR"]}>
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes/dashboard"
        element={
          <ProtectedRoute requiredRoles={["DIRECTOR", "ADMINISTRADOR"]}>
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />

      {/* 6. Panel de Administración y Configuración Institucional */}
      <Route
        path="/calendarizacion-institucional"
        element={
          <ProtectedRoute requiredRoles={["ADMINISTRADOR"]}>
            <CalendarizacionInstitucionalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/institucional/calendarizacion"
        element={<Navigate to="/calendarizacion-institucional" replace />}
      />

      <Route
        path="/administracion"
        element={<ProtectedRoute requiredRoles={["ADMINISTRADOR"]} />}
      >
        {AdminRoutes()}
      </Route>
      <Route
        path="/admin"
        element={<Navigate to="/administracion" replace />}
      />

      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
