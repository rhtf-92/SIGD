import { Route, Routes } from "react-router-dom";

import HomePage from "../pages/HomePage";
import RegistroTramitePage from "../pages/RegistroTramitePage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/tramites/nuevo" element={<RegistroTramitePage />} />
    </Routes>
  );
}
