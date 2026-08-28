import { Route, Routes } from "react-router-dom";

import HomePage from "../pages/HomePage";
import BandejaExpedientesPage from "../pages/expedientes/BandejaExpedientesPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/expedientes"
        element={<BandejaExpedientesPage />}
      />
    </Routes>
  );
}