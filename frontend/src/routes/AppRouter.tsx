import { Route, Routes } from "react-router-dom";

import HomePage from "../pages/HomePage";
import RegisterPage from "../pages/RegisterPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/registro" element={<RegisterPage />} />
    </Routes>
  );
}