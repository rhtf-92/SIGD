import ScrollToTop from "./components/common/ScrollToTop";
import SplashScreen from "./components/common/SplashScreen";
import MainLayout from "./layouts/MainLayout";
import AppRouter from "./routes/AppRouter";

export default function App() {
  return (
    <MainLayout>
      <ScrollToTop />
      <SplashScreen />
      <AppRouter />
    </MainLayout>
  );
}
