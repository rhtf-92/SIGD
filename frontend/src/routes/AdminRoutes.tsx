// Subrutas del Hub de Administración (ENT-M05-01)
// Se anidan bajo el path "/administracion" protegido en AppRouter.tsx
import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import RouteLoadingFallback from "../components/common/RouteLoadingFallback";

const AdministracionPage = lazy(() => import("../pages/administracion/AdministracionPage"));
const AuditoriaPage = lazy(() => import("../pages/administracion/AuditoriaPage"));
const CalendarizacionInstitucionalPage = lazy(() => import("../pages/administracion/CalendarizacionInstitucionalPage"));
const CalendarioLaboralPage = lazy(() => import("../pages/administracion/CalendarioLaboralPage"));
const RolesPermisosPage = lazy(() => import("../pages/administracion/RolesPermisosPage"));
const TablasMaestrasPage = lazy(() => import("../pages/administracion/TablasMaestrasPage"));
const UsuariosPage = lazy(() => import("../pages/administracion/UsuariosPage"));
const TupaAdminPage = lazy(() => import("../pages/administracion/TupaAdminPage"));

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <Component />
  </Suspense>
);

export default function AdminRoutes() {
  return (
    <>
      <Route index element={withSuspense(AdministracionPage)} />
      {/* DoD ENT-M05-02: el directorio de personal solo es accesible para
          SUPER_ADMIN y DIRECTOR mediante guarda de ruta activa. */}
      <Route
        path="usuarios"
        element={
          <ProtectedRoute requiredRoles={["ADMINISTRADOR"]}>
            {withSuspense(UsuariosPage)}
          </ProtectedRoute>
        }
      />
      <Route path="roles-permisos" element={withSuspense(RolesPermisosPage)} />
      <Route path="auditoria" element={withSuspense(AuditoriaPage)} />
      <Route path="tablas-maestras" element={withSuspense(TablasMaestrasPage)} />
      <Route path="calendario-laboral" element={withSuspense(CalendarioLaboralPage)} />
      <Route path="calendarizacion-institucional" element={withSuspense(CalendarizacionInstitucionalPage)} />
      <Route
        path="tupa"
        element={
          <ProtectedRoute requiredRoles={["ADMINISTRADOR"]}>
            {withSuspense(TupaAdminPage)}
          </ProtectedRoute>
        }
      />
    </>
  );
}
