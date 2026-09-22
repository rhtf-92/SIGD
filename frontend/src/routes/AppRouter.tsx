import { Navigate, Route, Routes } from "react-router-dom";

import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import CasillaElectronicaPage from "../pages/casilla/CasillaElectronicaPage";
import RegistroCiudadanoPage from "../pages/registro/RegistroCiudadanoPage";
import BandejaExpedientesPage from "../pages/expedientes/BandejaExpedientesPage";
import ExpedienteDetallePage from "../pages/expedientes/ExpedienteDetallePage";
import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

      <Route path="/casilla" element={<CasillaElectronicaPage />} />
      <Route
        path="/casilla-electronica"
        element={<CasillaElectronicaPage />}
      />
      <Route path="/registro" element={<RegistroCiudadanoPage />} />

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

      <Route path="/expedientes" element={<BandejaExpedientesPage />} />
      <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}