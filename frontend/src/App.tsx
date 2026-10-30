import SplashScreen from "./components/common/SplashScreen";
import MainLayout from "./layouts/MainLayout";
import AppRouter from "./routes/AppRouter";
import { ErrorConexion } from "./components/common/ErrorConexion";

export default function App() {
  return (
    <MainLayout>
      <SplashScreen />
      <ErrorConexion />
      <AppRouter />
    </MainLayout>
  );
}
