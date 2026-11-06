import MainLayout from "./layouts/MainLayout";
import AppRouter from "./routes/AppRouter";
import ErrorBoundary from "./components/common/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Error en el contenedor principal del SIGD">
      <MainLayout>
        <AppRouter />
      </MainLayout>
    </ErrorBoundary>
  );
}
