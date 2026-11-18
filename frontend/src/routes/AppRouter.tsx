import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegistroCiudadanoPage from "../pages/registro/RegistroCiudadanoPage";
import ConsultaPublicaPage from "../pages/tramite/ConsultaPublicaPage";
import CatalogoTupaPage from "../pages/tramite/CatalogoTupaPage";
import RouteLoadingFallback from "../components/common/RouteLoadingFallback";
import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";
import {
  ROLES_ADMIN,
  ROLES_CIUDADANO,
  ROLES_INSTITUCIONALES,
  ROLES_REPORTES,
  ROLES_TESORERIA,
  ROLES_VENTANILLA,
} from "../config/navigation.config";

// Lazy-loaded routes for performance & on-demand chunk delivery
const TransparenciaLegalPage = lazy(() => import("../pages/transparencia/TransparenciaLegalPage"));
const SolicitudAccesoTupaPage = lazy(() => import("../pages/tramite/SolicitudAccesoTupaPage"));
const DashboardEjecutivoPage = lazy(() => import("../pages/DashboardEjecutivoPage"));
const FlujoValidezLegalPage = lazy(() => import("../pages/flujos/FlujoValidezLegalPage"));
const CalendarizacionInstitucionalPage = lazy(
  () => import("../pages/administracion/CalendarizacionInstitucionalPage")
);
const ValidadorPublicoCvdPage = lazy(() => import("../pages/validador/ValidadorPublicoCvdPage"));
const CasillaElectronicaPage = lazy(() => import("../pages/casilla/CasillaElectronicaPage"));
const BandejaExpedientesPage = lazy(() => import("../pages/expedientes/BandejaExpedientesPage"));
const ExpedienteDetallePage = lazy(() => import("../pages/expedientes/ExpedienteDetallePage"));
const VentanillaPresencialPage = lazy(() => import("../pages/tramite/VentanillaPresencialPage"));
const MisExpedientesPage = lazy(() => import("../pages/tramite/MisExpedientesPage"));
const MiPerfilPage = lazy(() => import("../pages/tramite/MiPerfilPage"));
const TesoreriaPage = lazy(() => import("../pages/tesoreria/TesoreriaPage"));
const MesaPartesDigitalPage = lazy(() => import("../pages/tramite/MesaPartesDigitalPage"));

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <Component />
  </Suspense>
);

function RutaTramiteCompatible() {
  const location = useLocation();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoActivo = useAuthStore((s) => s.contextoActivo);

  // Aislamiento estricto de contextos: si está autenticado en contexto institucional, denegar acceso a trámites personales
  if (
    usuario &&
    (usuario.contexto === 'INSTITUCIONAL' ||
      contextoActivo === 'INSTITUCIONAL' ||
      (usuario.rol && usuario.rol !== 'CIUDADANO' && usuario.contexto !== 'PERSONAL'))
  ) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  return <Navigate to={`/mesa-partes${location.search}`} replace state={location.state} />;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* 1. Módulos Públicos (sin requerimiento de autenticación) */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />
        <Route path="/registro" element={<RegistroCiudadanoPage />} />
        <Route path="/consulta" element={<ConsultaPublicaPage />} />
        <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
        <Route path="/validador-cvd" element={withSuspense(ValidadorPublicoCvdPage)} />
        <Route path="/flujo-validez-legal" element={withSuspense(FlujoValidezLegalPage)} />
        <Route path="/transparencia" element={<Navigate to="/transparencia/normativa" replace />} />
        <Route path="/transparencia/:seccion" element={withSuspense(TransparenciaLegalPage)} />
        <Route path="/solicitud-acceso-tupa" element={withSuspense(SolicitudAccesoTupaPage)} />
        <Route path="/tupa" element={<CatalogoTupaPage />} />
        <Route path="/mesa-partes" element={withSuspense(MesaPartesDigitalPage)} />
        <Route path="/mesa-partes-digital" element={<Navigate to="/mesa-partes" replace />} />

        {/* 2. Rutas Compatibles de Radicación Digital y Módulos Ciudadanos */}
        <Route path="/tramite" element={<RutaTramiteCompatible />} />
        <Route path="/tramite/nuevo" element={<RutaTramiteCompatible />} />
        <Route path="/tramite/mesa-partes-virtual" element={<RutaTramiteCompatible />} />
        <Route path="/tramite/mesa-partes" element={<RutaTramiteCompatible />} />

        <Route
          path="/mis-expedientes"
          element={
            <ProtectedRoute requiredRoles={ROLES_CIUDADANO}>
              {withSuspense(MisExpedientesPage)}
            </ProtectedRoute>
          }
        />

        <Route path="/mi-perfil" element={
          <ProtectedRoute requiredRoles={ROLES_CIUDADANO}>{withSuspense(MiPerfilPage)}</ProtectedRoute>
        } />

        <Route
          path="/casilla"
          element={
            <ProtectedRoute requiredRoles={ROLES_CIUDADANO}>
              {withSuspense(CasillaElectronicaPage)}
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
            <ProtectedRoute requiredRoles={ROLES_VENTANILLA}>
              {withSuspense(VentanillaPresencialPage)}
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
            <ProtectedRoute requiredRoles={ROLES_INSTITUCIONALES}>
              {withSuspense(BandejaExpedientesPage)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/expedientes/:id"
          element={
            <ProtectedRoute requiredRoles={ROLES_INSTITUCIONALES}>
              {withSuspense(ExpedienteDetallePage)}
            </ProtectedRoute>
          }
        />

        {/* 4.1 Módulo de Tesorería */}
        <Route
          path="/tesoreria"
          element={
            <ProtectedRoute requiredRoles={ROLES_TESORERIA}>
              {withSuspense(TesoreriaPage)}
            </ProtectedRoute>
          }
        />

        {/* 5. Reportes y Tableros Directivos */}
        <Route
          path="/reportes"
          element={
            <ProtectedRoute requiredRoles={ROLES_REPORTES}>
              {withSuspense(DashboardEjecutivoPage)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes/dashboard"
          element={
            <ProtectedRoute requiredRoles={ROLES_REPORTES}>
              {withSuspense(DashboardEjecutivoPage)}
            </ProtectedRoute>
          }
        />

        {/* 6. Panel de Administración y Configuración Institucional */}
        <Route
          path="/calendarizacion-institucional"
          element={
            <ProtectedRoute requiredRoles={ROLES_ADMIN}>
              {withSuspense(CalendarizacionInstitucionalPage)}
            </ProtectedRoute>
          }
        />
        <Route
          path="/institucional/calendarizacion"
          element={<Navigate to="/calendarizacion-institucional" replace />}
        />

        <Route
          path="/administracion"
          element={<ProtectedRoute requiredRoles={ROLES_ADMIN} />}
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
    </Suspense>
  );
}
