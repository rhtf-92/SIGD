import { Navigate, Route, Routes } from "react-router-dom";

import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import { useAuthStore } from "../stores/authStore";
import { obtenerRutaInicialPorRol } from "../utils/rutasPorRol";

import DashboardEjecutivoPage from "../pages/DashboardEjecutivoPage";
import FlujoValidezLegalPage from "../pages/flujos/FlujoValidezLegalPage";
import PasarelaFirmaPage from "../pages/flujos/PasarelaFirmaPage";
import VisorCvdPage from "../pages/flujos/VisorCvdPage";
import WorkflowAcademicoPage from "../pages/flujos/WorkflowAcademicoPage";
import ValidadorPublicoCvdPage from "../pages/validador/ValidadorPublicoCvdPage";
import LoginPage from "../pages/LoginPage";
import CasillaElectronicaPage from "../pages/casilla/CasillaElectronicaPage";
import RegistroCiudadanoPage from "../pages/registro/RegistroCiudadanoPage";
import OfertaAcademicaRegistroPage from "../pages/registro/OfertaAcademicaRegistroPage";
import BandejaExpedientesPage from "../pages/expedientes/BandejaExpedientesPage";
import ExpedienteDetallePage from "../pages/expedientes/ExpedienteDetallePage";
import MesaPartesVirtualPage from "../pages/tramite/MesaPartesVirtualPage";
import VentanillaPresencialPage from "../pages/tramite/VentanillaPresencialPage";
import TramitePage from "../pages/tramite/TramitePage";
import ConsultaPublicaPage from "../pages/tramite/ConsultaPublicaPage";
import ProyectorResolucionesPage from "../pages/flujos/ProyectorResolucionesPage";
import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";

const ROLES_ADMINISTRACION = ["SUPER_ADMIN"] as const;
const ROLES_DIRECCION = ["DIRECTOR"] as const;
const ROLES_DOCENCIA = ["DOCENTE"] as const;
const ROLES_MESA_PARTES = ["MESA_PARTES"] as const;
const ROLES_ESTUDIANTE = ["ESTUDIANTE", "CIUDADANO"] as const;

function InicioPorRol() {
  const usuarioRol = useAuthStore((state) => state.usuario?.rol);
  const tokenStore = useAuthStore((state) => state.accessToken);
  const token = tokenStore ?? window.localStorage.getItem("sigd_token");
  const rol = usuarioRol ?? window.localStorage.getItem("sigd_rol");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={obtenerRutaInicialPorRol(rol)} replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<InicioPorRol />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

      <Route path="/consulta" element={<ConsultaPublicaPage />} />
      <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />

      <Route
        path="/casilla"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_ESTUDIANTE]}>
            <CasillaElectronicaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/casilla-electronica"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_ESTUDIANTE]}>
            <CasillaElectronicaPage />
          </ProtectedRoute>
        }
      />
      <Route path="/registro" element={<RegistroCiudadanoPage />} />
      <Route path="/oferta-academica" element={<OfertaAcademicaRegistroPage />} />

      <Route
        path="/tramite"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_MESA_PARTES, ...ROLES_DIRECCION]}>
            <TramitePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tramite/mesa-partes-virtual"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_MESA_PARTES]}>
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
          <ProtectedRoute requiredRoles={[...ROLES_MESA_PARTES]}>
            <MesaPartesVirtualPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tramite/ventanilla-presencial"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_MESA_PARTES]}>
            <VentanillaPresencialPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ventanilla"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_MESA_PARTES]}>
            <VentanillaPresencialPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_DIRECCION]}>
            <FlujoValidezLegalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujos/titulacion"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_DOCENCIA, ...ROLES_DIRECCION]}>
            <WorkflowAcademicoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujos/proyector-resoluciones"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_DIRECCION]}>
            <ProyectorResolucionesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal/firma"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_DIRECCION]}>
            <PasarelaFirmaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flujo-validez-legal/visor-cvd"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_DIRECCION]}>
            <VisorCvdPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/validador-cvd"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_DIRECCION]}>
            <ValidadorPublicoCvdPage />
          </ProtectedRoute>
        }
      />


      <Route
        path="/administracion"
        element={
          <ProtectedRoute
            requiredRoles={[...ROLES_ADMINISTRACION]}
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
          <ProtectedRoute requiredRoles={[...ROLES_DOCENCIA, ...ROLES_MESA_PARTES, ...ROLES_DIRECCION, ...ROLES_ADMINISTRACION]}>
            <BandejaExpedientesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expedientes/:id"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_DOCENCIA, ...ROLES_MESA_PARTES, ...ROLES_DIRECCION, ...ROLES_ADMINISTRACION]}>
            <ExpedienteDetallePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportes"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_DIRECCION]}>
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes/dashboard"
        element={
          <ProtectedRoute requiredRoles={[...ROLES_DIRECCION]}>
            <DashboardEjecutivoPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}