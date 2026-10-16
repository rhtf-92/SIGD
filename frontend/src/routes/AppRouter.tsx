import { Navigate, Route, Routes } from "react-router-dom";

import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import HomePage from "../pages/HomePage";

import SeguridadPage from "../pages/administracion/SeguridadPage";
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
import MesaPartesVirtualPage from "../pages/tramite/MesaPartesVirtualPage";
import VentanillaPresencialPage from "../pages/tramite/VentanillaPresencialPage";
import TramitePage from "../pages/tramite/TramitePage";
import ConsultaPublicaPage from "../pages/tramite/ConsultaPublicaPage";
import ProyectorResolucionesPage from "../pages/flujos/ProyectorResolucionesPage";
import AdminRoutes from "./AdminRoutes";
import ModuloGuard from "./ModuloGuard";

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
          <ModuloGuard moduloId="casilla">
            <CasillaElectronicaPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/casilla-electronica"
        element={
          <ModuloGuard moduloId="casilla">
            <CasillaElectronicaPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/registro"
        element={
          <ModuloGuard moduloId="registro">
            <RegistroCiudadanoPage />
          </ModuloGuard>
        }
      />

      <Route
        path="/tramite"
        element={
          <ModuloGuard moduloId="mesa-partes">
            <TramitePage />
          </ModuloGuard>
        }
      />
      <Route
        path="/tramite/mesa-partes-virtual"
        element={
          <ModuloGuard moduloId="mesa-partes">
            <MesaPartesVirtualPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/tramite/mesa-partes"
        element={<Navigate to="/tramite/mesa-partes-virtual" replace />}
      />
      <Route
        path="/mesa-partes"
        element={
          <ModuloGuard moduloId="mesa-partes">
            <MesaPartesVirtualPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/tramite/ventanilla-presencial"
        element={
          <ModuloGuard moduloId="ventanilla">
            <VentanillaPresencialPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/ventanilla"
        element={
          <ModuloGuard moduloId="ventanilla">
            <VentanillaPresencialPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/administracion/seguridad"
        element={
          <ModuloGuard moduloId="administracion">
            <SeguridadPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/flujo-validez-legal"
        element={
          <ModuloGuard moduloId="validez-legal">
            <FlujoValidezLegalPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/flujos/titulacion"
        element={
          <ModuloGuard moduloId="titulacion">
            <WorkflowAcademicoPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/flujo-validez-legal/proyector"
        element={
          <ModuloGuard moduloId="resoluciones">
            <ProyectorResolucionesPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/flujo-validez-legal/firma"
        element={
          <ModuloGuard moduloId="validez-legal">
            <PasarelaFirmaPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/flujo-validez-legal/visor-cvd"
        element={
          <ModuloGuard moduloId="validez-legal">
            <VisorCvdPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/validador-cvd"
        element={
          <ModuloGuard moduloId="validador-cvd">
            <ValidadorPublicoCvdPage />
          </ModuloGuard>
        }
      />

      <Route
        path="/administracion"
        element={<ModuloGuard moduloId="administracion" />}
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
          <ModuloGuard moduloId="expedientes">
            <BandejaExpedientesPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/expedientes/:id"
        element={
          <ModuloGuard moduloId="expedientes">
            <ExpedienteDetallePage />
          </ModuloGuard>
        }
      />

      <Route
        path="/reportes"
        element={
          <ModuloGuard moduloId="reportes">
            <DashboardEjecutivoPage />
          </ModuloGuard>
        }
      />
      <Route
        path="/reportes/dashboard"
        element={
          <ModuloGuard moduloId="reportes">
            <DashboardEjecutivoPage />
          </ModuloGuard>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
