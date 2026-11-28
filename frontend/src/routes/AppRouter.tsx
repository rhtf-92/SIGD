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
import CasillaLoginPage from "../pages/casilla/CasillaLoginPage";
import CasillaElectronicaPage from "../pages/casilla/CasillaElectronicaPage";
import RegistroCiudadanoPage from "../pages/registro/RegistroCiudadanoPage";
import ActivarCuentaPage from "../pages/registro/ActivarCuentaPage";
import BandejaExpedientesPage from "../pages/expedientes/BandejaExpedientesPage";
import BandejaDocentePage from "../pages/expedientes/BandejaDocentePage";
import SupervisionAreaPage from "../pages/expedientes/SupervisionAreaPage";
import ExpedienteDetallePage from "../pages/expedientes/ExpedienteDetallePage";
import VentanillaPresencialPage from "../pages/tramite/VentanillaPresencialPage";
import TramitePage from "../pages/tramite/TramitePage";
import ConsultaPublicaPage from "../pages/tramite/ConsultaPublicaPage";
import ProyectorResolucionesPage from "../pages/flujos/ProyectorResolucionesPage";
import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";
import TesoreriaPage from '../pages/tesoreria/TesoreriaPage';
import MisExpedientesPage from '../pages/tramite/MisExpedientesPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

      {/* Consulta pública ciudadana (acceso libre) */}
      <Route path="/consulta" element={<ConsultaPublicaPage />} />
      <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
      <Route path="/tramites/consulta-publica" element={<ConsultaPublicaPage />} />
      <Route path="/tramites/consulta-publica/:cut" element={<ConsultaPublicaPage />} />

      {/* Casilla electrónica ciudadana (portal administrado, autenticación obligatoria CIUDADANO) */}
      <Route path="/casilla/login" element={<CasillaLoginPage />} />
      <Route path="/ventanilla-electronica" element={<CasillaLoginPage />} />
      <Route path="/ventanilla-electronica/login" element={<CasillaLoginPage />} />
      <Route
        path="/casilla"
        element={
          <ProtectedRoute requiredRoles={["CIUDADANO"]} redirectTo="/casilla/login">
            <CasillaElectronicaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/casilla-electronica"
        element={<Navigate to="/casilla" replace />}
      />

      {/* Registro ciudadano público y activación */}
      <Route path="/registro" element={<RegistroCiudadanoPage />} />
      <Route path="/activar-cuenta" element={<ActivarCuentaPage />} />
      <Route path="/mis-expedientes" element={<ProtectedRoute><MisExpedientesPage /></ProtectedRoute>} />
      <Route path="/tesoreria" element={<ProtectedRoute requiredRoles={["ADMINISTRADOR", "SUPER_ADMIN", "TESORERO", "CIUDADANO"]}><TesoreriaPage /></ProtectedRoute>} />

      {/* Mesa de partes virtual pública */}
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
        path="/mesa-partes/ventanilla"
        element={<Navigate to="/tramite/ventanilla-presencial" replace />}
      />
      <Route
        path="/mesa-partes/bandeja"
        element={<Navigate to="/expedientes" replace />}
      />
      <Route
        path="/configuracion"
        element={<Navigate to="/administracion" replace />}
      />

      {/* Ventanilla presencial (restringido a MESA_PARTES) */}
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
        element={
          <ProtectedRoute requiredRoles={["MESA_PARTES", "ADMINISTRADOR"]}>
            <VentanillaPresencialPage />
          </ProtectedRoute>
        }
      />

      {/* Flujos documentales y de validez legal protegidos */}
      <Route
        path="/flujo-validez-legal"
        element={
          <ProtectedRoute>
            <FlujoValidezLegalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujos/titulacion"
        element={
          <ProtectedRoute>
            <WorkflowAcademicoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujos/proyector-resoluciones"
        element={
          <ProtectedRoute requiredRoles={["SECRETARIO", "COORDINADOR_AREA", "JEFE_UNIDAD_ACADEMICA", "DIRECTOR", "ADMINISTRADOR", "SUPER_ADMIN"]}>
            <ProyectorResolucionesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal/firma"
        element={
          <ProtectedRoute requiredRoles={["DIRECTOR", "ADMINISTRADOR", "SUPER_ADMIN"]}>
            <PasarelaFirmaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal/visor-cvd"
        element={
          <ProtectedRoute>
            <VisorCvdPage />
          </ProtectedRoute>
        }
      />

      {/* Validador CVD público (acceso libre conforme a normativa) */}
      <Route path="/validador-cvd" element={<ValidadorPublicoCvdPage />} />

      {/* Hub de Administración (protegido por módulo Administración) */}
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

      {/* Bandeja y detalle de expedientes (RutaDoc — restringido a personal institucional operativo) */}
      <Route
        path="/expedientes/mis-evaluaciones"
        element={
          <ProtectedRoute requiredRoles={["DOCENTE"]}>
            <BandejaDocentePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expedientes/supervision"
        element={
          <ProtectedRoute requiredRoles={[
            "COORDINADOR_AREA",
            "JEFE_UNIDAD_ACADEMICA",
            "DIRECTOR"
          ]}>
            <SupervisionAreaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expedientes"
        element={
          <ProtectedRoute
            requiredRoles={[
              "ADMINISTRADOR",
              "SUPER_ADMIN",
              "DIRECTOR",
              "JEFE_UNIDAD_ACADEMICA",
              "COORDINADOR_AREA",
              "SECRETARIO",
              "DOCENTE",
              "MESA_PARTES"
            ]}
            requiredCapacidades={[
              "GESTOR_APOYO_AREA"
            ]}
          >
            <BandejaExpedientesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expedientes/:id"
        element={
          <ProtectedRoute
            requiredRoles={[
              "ADMINISTRADOR",
              "SUPER_ADMIN",
              "DIRECTOR",
              "JEFE_UNIDAD_ACADEMICA",
              "COORDINADOR_AREA",
              "SECRETARIO",
              "DOCENTE",
              "MESA_PARTES"
            ]}
            requiredCapacidades={[
              "GESTOR_APOYO_AREA"
            ]}
          >
            <ExpedienteDetallePage />
          </ProtectedRoute>
        }
      />

      {/* Reportes gerenciales (protegido por módulo Reportes) */}
      <Route
        path="/reportes"
        element={
          <ProtectedRoute requiredModule="Reportes" requiredAction="ver">
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes/dashboard"
        element={
          <ProtectedRoute requiredModule="Reportes" requiredAction="ver">
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
