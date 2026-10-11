// Subrutas del Hub de Administración (ENT-M05-01)
// Se anidan bajo el path "/administracion" protegido en AppRouter.tsx
import React, { Suspense } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

// 👇 IMPORTACIONES OPTIMIZADAS CON LAZY LOADING 👇
const AdministracionPage = React.lazy(
  () => import("../pages/administracion/AdministracionPage"),
);
const AuditoriaPage = React.lazy(
  () => import("../pages/administracion/AuditoriaPage"),
);
const CalendarioLaboralPage = React.lazy(
  () => import("../pages/administracion/CalendarioLaboralPage"),
);
const RolesPermisosPage = React.lazy(
  () => import("../pages/administracion/RolesPermisosPage"),
);
const SeguridadPage = React.lazy(
  () => import("../pages/administracion/SeguridadPage"),
);
const TablasMaestrasPage = React.lazy(
  () => import("../pages/administracion/TablasMaestrasPage"),
);
const UsuariosPage = React.lazy(
  () => import("../pages/administracion/UsuariosPage"),
);

export default function AdminRoutes() {
  return (
    // Envolvemos todo en Suspense. Puedes poner el diseño de "Cargando..." que prefieras.
    <Suspense
      fallback={
        <div style={{ padding: "20px", textAlign: "center" }}>
          Cargando módulo de administración...
        </div>
      }
    >
      <>
        <Route index element={<AdministracionPage />} />
        {/* DoD ENT-M05-02: el directorio de personal solo es accesible para
            SUPER_ADMIN y DIRECTOR mediante guarda de ruta activa. */}
        <Route
          path="usuarios"
          element={
            <ProtectedRoute
              requiredRoles={["SUPER_ADMIN", "DIRECTOR"]}
              requiredModule="Administración"
              requiredAction="editar"
            >
              <UsuariosPage />
            </ProtectedRoute>
          }
        />
        <Route path="roles-permisos" element={<RolesPermisosPage />} />
        <Route path="auditoria" element={<AuditoriaPage />} />
        <Route path="tablas-maestras" element={<TablasMaestrasPage />} />
        <Route path="calendario-laboral" element={<CalendarioLaboralPage />} />
        <Route path="seguridad" element={<SeguridadPage />} />
      </>
    </Suspense>
  );
}
