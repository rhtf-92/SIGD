import MainLayout from "./layouts/MainLayout";
import AppRouter from "./routes/AppRouter";

export default function App() {
  return (
    <MainLayout>
      <AppRouter />
    </MainLayout>
  );
}
