import ErrorBoundary from "./components/common/ErrorBoundary";
import PantallaErroresSistema from "./components/common/PantallaErroresSistema";
import PantallaSinConexion from "./components/common/PantallaSinConexion";
import SplashScreen from "./components/common/SplashScreen";
import MainLayout from "./layouts/MainLayout";
import AppRouter from "./routes/AppRouter";

export default function App() {
  return (
    <ErrorBoundary>
      <MainLayout>
        <SplashScreen />
        <PantallaSinConexion />
        <PantallaErroresSistema />
        <AppRouter />
      </MainLayout>
    </ErrorBoundary>
  );
}
