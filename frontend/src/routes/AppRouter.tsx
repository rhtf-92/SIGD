import { Navigate, Route, Routes } from "react-router-dom";

import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import HomePage from "../pages/HomePage";

import DashboardEjecutivoPage from "../pages/DashboardEjecutivoPage";
import FlujoValidezLegalPage from "../pages/flujos/FlujoValidezLegalPage";
import PasarelaFirmaPage from "../pages/flujos/PasarelaFirmaPage";
import VisorCvdPage from "../pages/flujos/VisorCvdPage";
import WorkflowAcademicoPage from "../pages/flujos/WorkflowAcademicoPage";
import ValidadorPublicoCvdPage from "../pages/validador/ValidadorPublicoCvdPage";
import LoginPage from "../pages/LoginPage";
import CasillaElectronicaPage from "../pages/casilla/CasillaElectronicaPage";
import RegistroCiudadanoPage from "../pages/registro/RegistroCiudadanoPage";
import BandejaExpedientesPage from "../pages/expedientes/BandejaExpedientesPage";
import ExpedienteDetallePage from "../pages/expedientes/ExpedienteDetallePage";
import VentanillaPresencialPage from "../pages/tramite/VentanillaPresencialPage";
import TramitePage from "../pages/tramite/TramitePage";
import ConsultaPublicaPage from "../pages/tramite/ConsultaPublicaPage";
import ProyectorResolucionesPage from "../pages/flujos/ProyectorResolucionesPage";
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

      <Route
        path="/casilla"
        element={
          <ProtectedRoute>
            <CasillaElectronicaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/casilla-electronica"
        element={
          <ProtectedRoute>
            <CasillaElectronicaPage />
          </ProtectedRoute>
        }
      />
      <Route path="/registro" element={<RegistroCiudadanoPage />} />

      <Route path="/tramite" element={<TramitePage />} />
      <Route
        path="/tramite/mesa-partes-virtual"
        element={<TramitePage />}
      />
      <Route
        path="/tramite/mesa-partes"
        element={<Navigate to="/tramite/mesa-partes-virtual" replace />}
      />
      <Route
        path="/mesa-partes"
        element={<TramitePage />}
      />
      <Route
        path="/tramite/ventanilla-presencial"
        element={
          <ProtectedRoute requiredRoles={["MESA_PARTES", "SUPER_ADMIN"]}>
            <VentanillaPresencialPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ventanilla"
        element={
          <ProtectedRoute requiredRoles={["MESA_PARTES", "SUPER_ADMIN"]}>
            <VentanillaPresencialPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"]}
          >
            <FlujoValidezLegalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujos/titulacion"
        element={
          <ProtectedRoute
            requiredRoles={["DOCENTE", "SUPER_ADMIN", "DIRECTOR"]}
            requiredModule="Expedientes"
            requiredAction="ver"
          >
            <WorkflowAcademicoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujos/proyector-resoluciones"
        element={
          <ProtectedRoute
            requiredRoles={["DIRECTOR", "SUPER_ADMIN"]}
            requiredModule="Documentos"
            requiredAction="crear"
          >
            <ProyectorResolucionesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal/firma"
        element={
          <ProtectedRoute
            requiredRoles={["DIRECTOR", "SUPER_ADMIN"]}
            requiredModule="Documentos"
            requiredAction="editar"
          >
            <PasarelaFirmaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal/visor-cvd"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"]}
          >
            <VisorCvdPage />
          </ProtectedRoute>
        }
      />
      <Route path="/validador-cvd" element={<ValidadorPublicoCvdPage />} />


      <Route
        path="/administracion"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR"]}
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

      <Route
        path="/expedientes"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"]}
            requiredModule="Expedientes"
            requiredAction="ver"
          >
            <BandejaExpedientesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expedientes/:id"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"]}
            requiredModule="Expedientes"
            requiredAction="ver"
          >
            <ExpedienteDetallePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportes"
        element={
          <ProtectedRoute requiredRoles={["DIRECTOR", "SUPER_ADMIN"]}>
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes/dashboard"
        element={
          <ProtectedRoute requiredRoles={["DIRECTOR", "SUPER_ADMIN"]}>
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}