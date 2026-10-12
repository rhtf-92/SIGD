import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";

const AccesoDenegadoPage = lazy(() => import("../pages/AccesoDenegadoPage"));
const HomePage = lazy(() => import("../pages/HomePage"));
const SeguridadPage = lazy(
  () => import("../pages/administracion/SeguridadPage"),
);
const DashboardEjecutivoPage = lazy(
  () => import("../pages/DashboardEjecutivoPage"),
);
const FlujoValidezLegalPage = lazy(
  () => import("../pages/flujos/FlujoValidezLegalPage"),
);
const PasarelaFirmaPage = lazy(
  () => import("../pages/flujos/PasarelaFirmaPage"),
);
const VisorCvdPage = lazy(() => import("../pages/flujos/VisorCvdPage"));
const WorkflowAcademicoPage = lazy(
  () => import("../pages/flujos/WorkflowAcademicoPage"),
);
const ProyectorResolucionesPage = lazy(
  () => import("../pages/flujos/ProyectorResolucionesPage"),
);
const ValidadorPublicoCvdPage = lazy(
  () => import("../pages/validador/ValidadorPublicoCvdPage"),
);
const LoginPage = lazy(() => import("../pages/LoginPage"));
const CasillaElectronicaPage = lazy(
  () => import("../pages/casilla/CasillaElectronicaPage"),
);
const RegistroCiudadanoPage = lazy(
  () => import("../pages/registro/RegistroCiudadanoPage"),
);
const BandejaExpedientesPage = lazy(
  () => import("../pages/expedientes/BandejaExpedientesPage"),
);
const SeguimientoLocalPage = lazy(
  () => import("../pages/expedientes/SeguimientoLocalPage"),
);
const MesaPartesVirtualPage = lazy(
  () => import("../pages/tramite/MesaPartesVirtualPage"),
);
const VentanillaPresencialPage = lazy(
  () => import("../pages/tramite/VentanillaPresencialPage"),
);
const TramitePage = lazy(() => import("../pages/tramite/TramitePage"));
const ConsultaPublicaPage = lazy(
  () => import("../pages/tramite/ConsultaPublicaPage"),
);

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ padding: "20px", textAlign: "center", color: "#003366" }}
    >
      Cargando SIGD SUIZA…
    </div>
  );
}

export default function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

      <Route path="/consulta" element={<ConsultaPublicaPage />} />
      <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />

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
      <Route
        path="/flujo-validez-legal/visor-cvd"
        element={<VisorCvdPage />}
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
      <Route path="/expedientes/:id/seguimiento" element={<SeguimientoLocalPage />} />
      <Route path="/expedientes/:id" element={<SeguimientoLocalPage />} />

      <Route path="/reportes" element={<DashboardEjecutivoPage />} />
      <Route path="/reportes/dashboard" element={<DashboardEjecutivoPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
