import { Navigate, Route, Routes } from "react-router-dom";

import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import HomePage from "../pages/HomePage";

import DashboardEjecutivoPage from "../pages/flujos/FlujoValidezLegalPage";
import FlujoValidezLegalPage from "../pages/flujos/FlujoValidezLegalPage";
import PasarelaFirmaPage from "../pages/flujos/PasarelaFirmaPage";
import VisorCvdPage from "../pages/flujos/VisorCvdPage";
import WorkflowAcademicoPage from "../pages/flujos/WorkflowAcademicoPage";
import ValidadorPublicoCvdPage from "../pages/validador/ValidadorPublicoCvdPage";
import LoginPage from "../pages/LoginPage";
import RecuperarPasswordPage from "../pages/recuperar/RecuperarPasswordPage";
import CasillaElectronicaPage from "../pages/casilla/CasillaElectronicaPage";
import RegistroCiudadanoPage from "../pages/registro/RegistroCiudadanoPage";
import BandejaExpedientesPage from "../pages/expedientes/BandejaExpedientesPage";
import ExpedienteDetallePage from "../pages/expedientes/ExpedienteDetallePage";
import MesaPartesVirtualPage from "../pages/tramite/MesaPartesVirtualPage";
import VentanillaPresencialPage from "../pages/tramite/VentanillaPresencialPage";
import TramitePage from "../pages/tramite/TramitePage";
import ConsultaPublicaPage from "../pages/tramite/ConsultaPublicaPage";
import ProyectorResolucionesPage from "../pages/flujos/ProyectorResolucionesPage";
import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";
import { PageLoader, ErrorConexion } from "../components/common/AnimacionesSistema";

export default function AppRouter() {
  return (
    <>
      <ErrorConexion />
      <Routes>
        <Route path="/" element={<><PageLoader /><HomePage /></>} />
        <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar-password" element={<RecuperarPasswordPage />} />
      <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

      <Route path="/consulta" element={<ConsultaPublicaPage />} />
      <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />

      {/* Públicas sin sesión */}
      <Route path="/registro" element={<RegistroCiudadanoPage />} />
      <Route path="/validador-cvd" element={<ValidadorPublicoCvdPage />} />

      {/* Privadas: solo su rol. Si escribes la URL sin el rol, vas a /acceso-denegado */}
      <Route
        path="/casilla"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES", "ESTUDIANTE"]}
            requiredModule="Documentos"
            requiredAction="ver"
          >
            <CasillaElectronicaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/casilla-electronica"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES", "ESTUDIANTE"]}
            requiredModule="Documentos"
            requiredAction="ver"
          >
            <CasillaElectronicaPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tramite"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "MESA_PARTES", "ESTUDIANTE"]}
            requiredModule="Expedientes"
            requiredAction="ver"
          >
            <TramitePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tramite/mesa-partes-virtual"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "MESA_PARTES", "ESTUDIANTE"]}
            requiredModule="Expedientes"
            requiredAction="ver"
          >
            <MesaPartesVirtualPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tramite/mesa-partes"
        element={<Navigate to="/tramite/mesa-partes-virtual" replace />}
      />
      <Route
        path="/mesa-partes"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "MESA_PARTES", "ESTUDIANTE"]}
            requiredModule="Expedientes"
            requiredAction="ver"
          >
            <MesaPartesVirtualPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tramite/ventanilla-presencial"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "MESA_PARTES"]}
            requiredModule="Expedientes"
            requiredAction="crear"
          >
            <VentanillaPresencialPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ventanilla"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "MESA_PARTES"]}
            requiredModule="Expedientes"
            requiredAction="crear"
          >
            <VentanillaPresencialPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE"]}
            requiredModule="Documentos"
            requiredAction="ver"
          >
            <FlujoValidezLegalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujos/titulacion"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE"]}
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
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE"]}
            requiredModule="Documentos"
            requiredAction="ver"
          >
            <ProyectorResolucionesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal/firma"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE"]}
            requiredModule="Documentos"
            requiredAction="crear"
          >
            <PasarelaFirmaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal/visor-cvd"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR", "DOCENTE"]}
            requiredModule="Documentos"
            requiredAction="ver"
          >
            <VisorCvdPage />
          </ProtectedRoute>
        }
      />


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
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR"]}
            requiredModule="Auditoría"
            requiredAction="ver"
          >
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes/dashboard"
        element={
          <ProtectedRoute
            requiredRoles={["SUPER_ADMIN", "DIRECTOR"]}
            requiredModule="Auditoría"
            requiredAction="ver"
          >
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
      </>
  );
}