import SplashScreen from "./components/common/SplashScreen";
import MainLayout from "./layouts/MainLayout";
import AppRouter from "./routes/AppRouter";

export default function App() {
  return (
    <MainLayout>
      <SplashScreen />
      <AppRouter />
    </MainLayout>
  );
}
